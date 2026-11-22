import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import {
	DraftOutputSchema,
	type DraftOutput,
	type DraftPlacement,
	type DraftRequest,
	type DraftResult
} from '../../draft/contract';
import { validatePlacements, type PlacementProblem } from '../../draft/validate';
import type { DraftUsage } from './cost';
import { buildDraftPrompt } from './prompt';

export const DRAFT_MODEL = 'claude-opus-5-5';
export type DraftEffort = 'low' | 'medium' | 'high' | 'xhigh' | 'max';
export type DraftClient = Pick<Anthropic, 'beta'>;

export type DraftOutcome = {
	result: DraftResult;
	usage: DraftUsage;
	/** The model that answered (a fallback may serve a declined request). */
	model: string;
	error: string | null;
};

type Reply =
	| { kind: 'output'; output: DraftOutput; content: Anthropic.Beta.BetaContentBlock[] }
	| { kind: 'refused' }
	| { kind: 'failed'; error: string };

function describe(p: DraftPlacement): string {
	const label = p.label ? ` "${p.label}"` : '';
	return `${p.symbolId}${label} at (${p.x}, ${p.y})`;
}

function repairMessage(placements: DraftPlacement[], problems: PlacementProblem[]): string {
	const lines = problems.map(
		(p) => `- placement ${p.index} (${describe(placements[p.index])}): ${p.reason}`
	);
	return `Some placements can't be used:\n${lines.join('\n')}\n\nReturn the whole draft again with these fixed. Keep the placements that were fine.`;
}

/**
 * Drafts a layout for the request with Claude (spec §7.5): structured output, one repair round
 * for placements that fail the checks, then whatever still fails is dropped and reported. Never
 * throws: failures and refusals come back as a result with no objects.
 */
export async function draftLayout(options: {
	client: DraftClient;
	request: DraftRequest;
	effort: DraftEffort;
}): Promise<DraftOutcome> {
	const { client, request, effort } = options;
	const { system, messages } = buildDraftPrompt(request);
	const usage: DraftUsage = {
		inputTokens: 0,
		outputTokens: 0,
		cacheReadTokens: 0,
		cacheWriteTokens: 0
	};
	let model: string = DRAFT_MODEL;

	async function ask(conversation: Anthropic.Beta.BetaMessageParam[]): Promise<Reply> {
		try {
			const response = await client.beta.messages.parse({
				model: DRAFT_MODEL,
				max_tokens: 16000,
				betas: ['server-side-fallback-2026-07-01'],
				fallbacks: 'default',
				output_config: { effort, format: betaZodOutputFormat(DraftOutputSchema) },
				system,
				messages: conversation
			});
			model = response.model;
			usage.inputTokens += response.usage.input_tokens;
			usage.outputTokens += response.usage.output_tokens;
			usage.cacheReadTokens += response.usage.cache_read_input_tokens ?? 0;
			usage.cacheWriteTokens += response.usage.cache_creation_input_tokens ?? 0;
			if (response.stop_reason === 'refusal') return { kind: 'refused' };
			if (!response.parsed_output)
				return { kind: 'failed', error: `No draft in the reply (${response.stop_reason})` };
			return { kind: 'output', output: response.parsed_output, content: response.content };
		} catch (e) {
			const message = e instanceof Anthropic.APIError || e instanceof Error ? e.message : String(e);
			return { kind: 'failed', error: message };
		}
	}

	const none = (status: 'failed' | 'refused', error: string | null): DraftOutcome => ({
		result: { status, objects: [], unrepresentable: [], dropped: [] },
		usage,
		model,
		error
	});

	const first = await ask(messages);
	if (first.kind === 'refused') return none('refused', null);
	if (first.kind === 'failed') return none('failed', first.error);

	const canvas = request.canvas;
	const checked = validatePlacements(first.output.placements, canvas);
	if (checked.problems.length === 0) {
		return {
			result: {
				status: 'ok',
				objects: checked.valid,
				unrepresentable: first.output.unrepresentable,
				dropped: []
			},
			usage,
			model,
			error: null
		};
	}

	const second = await ask([
		...messages,
		{ role: 'assistant', content: first.content },
		{ role: 'user', content: repairMessage(first.output.placements, checked.problems) }
	]);
	// If the repair round itself fails, keep the good part of the first draft.
	const final = second.kind === 'output' ? second.output : first.output;
	const recheck = second.kind === 'output' ? validatePlacements(final.placements, canvas) : checked;
	const dropped = recheck.problems.map((p) => ({
		what: describe(final.placements[p.index]),
		reason: p.reason
	}));
	return {
		result: {
			status: dropped.length > 0 ? 'partial' : 'repaired',
			objects: recheck.valid,
			unrepresentable: final.unrepresentable,
			dropped
		},
		usage,
		model,
		error: second.kind === 'failed' ? second.error : null
	};
}
