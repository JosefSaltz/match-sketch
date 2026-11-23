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

/** How long a whole draft (both calls) may take on the server; the browser waits a little longer. */
export const DRAFT_DEADLINE_MS = 240_000;
/** The repair round runs only if at least this much of the deadline is left. */
export const REPAIR_MIN_MS = 90_000;

type CreateParams = Anthropic.Beta.MessageCreateParamsNonStreaming;

/** How the service reaches Claude; tests script it, the server uses anthropicDraftClient. */
export type DraftClient = {
	send(params: CreateParams, options: { signal: AbortSignal }): Promise<Anthropic.Beta.BetaMessage>;
};

/**
 * Streams each call, so a long reply (thinking plus a big draft) never hits the SDK's request
 * timeout; the service's own deadline aborts it instead. Retries only failures to start.
 */
export function anthropicDraftClient(client: Anthropic): DraftClient {
	return {
		send: (params, { signal }) =>
			client.beta.messages.stream(params, { signal, maxRetries: 1 }).finalMessage()
	};
}

export type DraftOutcome = {
	result: DraftResult;
	usage: DraftUsage;
	/** The model that answered (a fallback may serve a declined request). */
	model: string;
	error: string | null;
	/** A call failed without reporting usage; its cost is unknown (the caller assumes the worst). */
	unmetered: boolean;
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

function readOutput(content: Anthropic.Beta.BetaContentBlock[]): DraftOutput | null {
	const text = content
		.filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
		.map((b) => b.text)
		.join('');
	try {
		const parsed = DraftOutputSchema.safeParse(JSON.parse(text));
		return parsed.success ? parsed.data : null;
	} catch {
		return null;
	}
}

/**
 * Drafts a layout for the request with Claude (spec §7.5): structured output, one repair round
 * for placements that fail the checks (if the deadline allows), then whatever still fails is
 * dropped and reported. Never throws: failures and refusals come back as a result with no
 * objects, with whatever usage the calls reported.
 */
export async function draftLayout(options: {
	client: DraftClient;
	request: DraftRequest;
	effort: DraftEffort;
	now?: () => number;
}): Promise<DraftOutcome> {
	const { client, request, effort, now = Date.now } = options;
	const { system, messages } = buildDraftPrompt(request);
	const usage: DraftUsage = {
		inputTokens: 0,
		outputTokens: 0,
		cacheReadTokens: 0,
		cacheWriteTokens: 0
	};
	let model: string = DRAFT_MODEL;
	let unmetered = false;
	const deadline = now() + DRAFT_DEADLINE_MS;

	async function ask(conversation: Anthropic.Beta.BetaMessageParam[]): Promise<Reply> {
		let response: Anthropic.Beta.BetaMessage;
		try {
			response = await client.send(
				{
					model: DRAFT_MODEL,
					max_tokens: 16000,
					betas: ['server-side-fallback-2026-07-01', 'structured-outputs-2025-12-15'],
					fallbacks: 'default',
					output_config: { effort, format: betaZodOutputFormat(DraftOutputSchema) },
					system,
					messages: conversation
				},
				{ signal: AbortSignal.timeout(Math.max(1, deadline - now())) }
			);
		} catch (e) {
			unmetered = true;
			const message = e instanceof Anthropic.APIError || e instanceof Error ? e.message : String(e);
			return { kind: 'failed', error: message };
		}
		// Usage first: a refused or cut-off reply was still billed.
		model = response.model;
		usage.inputTokens += response.usage.input_tokens;
		usage.outputTokens += response.usage.output_tokens;
		usage.cacheReadTokens += response.usage.cache_read_input_tokens ?? 0;
		usage.cacheWriteTokens += response.usage.cache_creation_input_tokens ?? 0;
		if (response.stop_reason === 'refusal') return { kind: 'refused' };
		if (response.stop_reason === 'max_tokens') {
			return { kind: 'failed', error: 'The draft was too long and was cut off' };
		}
		const output = readOutput(response.content);
		if (!output)
			return { kind: 'failed', error: `No usable draft in the reply (${response.stop_reason})` };
		return { kind: 'output', output, content: response.content };
	}

	const done = (result: DraftResult, error: string | null): DraftOutcome => ({
		result,
		usage,
		model,
		error,
		unmetered
	});
	const none = (status: 'failed' | 'refused', error: string | null) =>
		done({ status, objects: [], unrepresentable: [], dropped: [] }, error);

	const first = await ask(messages);
	if (first.kind === 'refused') return none('refused', null);
	if (first.kind === 'failed') return none('failed', first.error);

	const canvas = request.canvas;
	const checked = validatePlacements(first.output.placements, canvas);
	const trimmed = (output: DraftOutput, problems: PlacementProblem[]) =>
		problems.map((p) => ({ what: describe(output.placements[p.index]), reason: p.reason }));
	if (checked.problems.length === 0) {
		return done(
			{
				status: 'ok',
				objects: checked.valid,
				unrepresentable: first.output.unrepresentable,
				dropped: []
			},
			null
		);
	}
	if (deadline - now() < REPAIR_MIN_MS) {
		return done(
			{
				status: 'partial',
				objects: checked.valid,
				unrepresentable: first.output.unrepresentable,
				dropped: trimmed(first.output, checked.problems)
			},
			null
		);
	}

	const second = await ask([
		...messages,
		{ role: 'assistant', content: first.content },
		{ role: 'user', content: repairMessage(first.output.placements, checked.problems) }
	]);
	if (second.kind !== 'output') {
		// Keep the good part of the first draft.
		const error =
			second.kind === 'refused' ? 'The repair round was refused' : `Repair failed: ${second.error}`;
		return done(
			{
				status: 'partial',
				objects: checked.valid,
				unrepresentable: first.output.unrepresentable,
				dropped: trimmed(first.output, checked.problems)
			},
			error
		);
	}
	const recheck = validatePlacements(second.output.placements, canvas);
	const dropped = trimmed(second.output, recheck.problems);
	return done(
		{
			status: dropped.length > 0 ? 'partial' : 'repaired',
			objects: recheck.valid,
			unrepresentable: second.output.unrepresentable,
			dropped
		},
		null
	);
}
