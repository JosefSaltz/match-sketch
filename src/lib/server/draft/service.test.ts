import Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it } from 'vitest';
import { CATALOG } from '../../catalog';
import type { DraftOutput, DraftPlacement, DraftRequest } from '../../draft/contract';
import { emptyPlanDocument } from '../../model/plan';
import { estimateCostUsd } from './cost';
import { buildDraftPrompt } from './prompt';
import { draftLayout, type DraftClient } from './service';

const brief = {
	...emptyPlanDocument().brief,
	procedure: 'Proceed to SA-1 and engage 4 static steel.'
};
const request: DraftRequest = {
	planId: crypto.randomUUID(),
	description: brief.procedure,
	brief,
	canvas: { widthFt: 90, depthFt: 150, unit: 'yd' },
	symbolSize: 'medium'
};
const place = (over: Partial<DraftPlacement> = {}): DraftPlacement => ({
	symbolId: 'steel-static',
	x: 45,
	y: 120,
	rotation: 0,
	label: null,
	count: 4,
	widthFt: null,
	depthFt: null,
	...over
});
const usage = {
	input_tokens: 1000,
	output_tokens: 400,
	cache_read_input_tokens: 3000,
	cache_creation_input_tokens: 0
};

/** A client whose replies are scripted; records what it was asked. */
function stub(
	replies: (Partial<{ stop_reason: string; parsed_output: DraftOutput | null }> | Error)[]
) {
	const calls: { messages: unknown[] }[] = [];
	const client = {
		beta: {
			messages: {
				parse: (params: { messages: unknown[] }) => {
					calls.push(params);
					const reply = replies.shift();
					if (!reply || reply instanceof Error)
						return Promise.reject(reply ?? new Error('no reply'));
					return Promise.resolve({
						model: 'claude-opus-5-5',
						stop_reason: 'end_turn',
						content: [{ type: 'text', text: '{}' }],
						usage,
						...reply
					});
				}
			}
		}
	} as unknown as DraftClient;
	return { client, calls };
}

const output = (...placements: DraftPlacement[]): DraftOutput => ({
	placements,
	unrepresentable: []
});

describe('draftLayout', () => {
	it('returns a valid draft as is', async () => {
		const { client } = stub([
			{
				parsed_output: output(
					place(),
					place({ symbolId: 'shooting-box', label: 'SA-1', y: 20, count: null })
				)
			}
		]);
		const { result, usage: used } = await draftLayout({ client, request, effort: 'medium' });
		expect(result.status).toBe('ok');
		expect(result.objects).toHaveLength(2);
		expect(used).toEqual({
			inputTokens: 1000,
			outputTokens: 400,
			cacheReadTokens: 3000,
			cacheWriteTokens: 0
		});
	});

	it('sends the problems back once and uses the repaired draft (Review Focus #1)', async () => {
		const { client, calls } = stub([
			{ parsed_output: output(place({ symbolId: 'unicorn' }), place()) },
			{ parsed_output: output(place({ symbolId: 'popper' }), place()) }
		]);
		const { result, usage: used } = await draftLayout({ client, request, effort: 'medium' });
		expect(result.status).toBe('repaired');
		expect(result.objects.map((o) => o.symbolId)).toEqual(['popper', 'steel-static']);
		expect(calls).toHaveLength(2);
		expect(JSON.stringify(calls[1].messages.at(-1))).toMatch(/unknown symbol \\"unicorn\\"/);
		expect(used.inputTokens).toBe(2000);
	});

	it('drops what still fails after the repair and says why', async () => {
		const bad = place({ x: 400 });
		const { client } = stub([
			{ parsed_output: output(bad, place()) },
			{ parsed_output: output(bad, place()) }
		]);
		const { result } = await draftLayout({ client, request, effort: 'medium' });
		expect(result.status).toBe('partial');
		expect(result.objects).toHaveLength(1);
		expect(result.dropped).toEqual([
			{
				what: expect.stringContaining('steel-static') as string,
				reason: expect.stringMatching(/outside the bay/) as string
			}
		]);
	});

	it('gives nothing back on a refusal (Review Focus #3)', async () => {
		const { client } = stub([{ stop_reason: 'refusal', parsed_output: null }]);
		const { result } = await draftLayout({ client, request, effort: 'medium' });
		expect(result).toMatchObject({ status: 'refused', objects: [] });
	});

	it('reports a failed call instead of throwing', async () => {
		const { client } = stub([new Anthropic.APIConnectionError({ message: 'socket hang up' })]);
		const outcome = await draftLayout({ client, request, effort: 'medium' });
		expect(outcome.result).toMatchObject({ status: 'failed', objects: [] });
		expect(outcome.error).toMatch(/socket hang up|Connection error/);
	});
});

describe('buildDraftPrompt', () => {
	it('lists every catalog symbol once, and carries the spacing and the procedure', () => {
		const { system, messages } = buildDraftPrompt(request);
		const text = JSON.stringify({ system, messages });
		for (const entry of CATALOG) expect(text.split(`\\"id\\":\\"${entry.id}\\"`)).toHaveLength(2);
		expect(text).toContain(brief.procedure);
		expect(text).toMatch(/at least \d+(\.5)? ft apart/);
		expect(system.at(-1)).toHaveProperty('cache_control', { type: 'ephemeral' });
	});
});

describe('estimateCostUsd', () => {
	it('prices Opus 5.5 usage, and an unknown model at the highest rate', () => {
		const tokens = {
			inputTokens: 1_000_000,
			outputTokens: 100_000,
			cacheReadTokens: 1_000_000,
			cacheWriteTokens: 0
		};
		expect(estimateCostUsd('claude-opus-5-5', tokens)).toBeCloseTo(4 + 2 + 0.2, 6);
		expect(estimateCostUsd('some-new-model', tokens)).toBeGreaterThanOrEqual(
			estimateCostUsd('claude-opus-5-5', tokens)
		);
	});
});
