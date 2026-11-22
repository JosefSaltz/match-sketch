import Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it } from 'vitest';
import { CATALOG } from '../../catalog';
import { DRAFT_TIMEOUT_MS } from '../../draft/client';
import type { DraftOutput, DraftPlacement, DraftRequest } from '../../draft/contract';
import { emptyPlanDocument } from '../../model/plan';
import { estimateCostUsd } from './cost';
import { STALE_DRAFT_MINUTES } from './limits';
import { buildDraftPrompt } from './prompt';
import { DRAFT_DEADLINE_MS, draftLayout, REPAIR_MIN_MS, type DraftClient } from './service';

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
const output = (...placements: DraftPlacement[]): DraftOutput => ({
	placements,
	unrepresentable: []
});

type Reply = { stop_reason?: string; text?: string; elapseMs?: number } | Error;

/** A client whose replies are scripted (and may take fake time); records what it was sent. */
function stub(replies: Reply[], clock = { now: 0 }) {
	const calls: { messages: unknown[] }[] = [];
	const client: DraftClient = {
		send: (params) => {
			calls.push(params);
			const reply = replies.shift();
			if (!reply || reply instanceof Error) return Promise.reject(reply ?? new Error('no reply'));
			clock.now += reply.elapseMs ?? 1000;
			return Promise.resolve({
				model: 'claude-opus-5-5',
				stop_reason: reply.stop_reason ?? 'end_turn',
				content: [{ type: 'text', text: reply.text ?? '' }],
				usage
			} as unknown as Anthropic.Beta.BetaMessage);
		}
	};
	return { client, calls, now: () => clock.now };
}

const json = (o: DraftOutput) => JSON.stringify(o);
const run = (s: ReturnType<typeof stub>) =>
	draftLayout({ client: s.client, request, effort: 'medium', now: s.now });

describe('draftLayout', () => {
	it('returns a valid draft as is', async () => {
		const s = stub([
			{
				text: json(
					output(place(), place({ symbolId: 'shooting-box', label: 'SA-1', y: 20, count: null }))
				)
			}
		]);
		const { result, usage: used, unmetered } = await run(s);
		expect(result.status).toBe('ok');
		expect(result.objects).toHaveLength(2);
		expect(used).toEqual({
			inputTokens: 1000,
			outputTokens: 400,
			cacheReadTokens: 3000,
			cacheWriteTokens: 0
		});
		expect(unmetered).toBe(false);
	});

	it('sends the problems back once and uses the repaired draft (Review Focus #1)', async () => {
		const s = stub([
			{ text: json(output(place({ symbolId: 'unicorn' }), place())) },
			{ text: json(output(place({ symbolId: 'popper' }), place())) }
		]);
		const { result, usage: used } = await run(s);
		expect(result.status).toBe('repaired');
		expect(result.objects.map((o) => o.symbolId)).toEqual(['popper', 'steel-static']);
		expect(s.calls).toHaveLength(2);
		expect(JSON.stringify(s.calls[1].messages.at(-1))).toMatch(/unknown symbol \\"unicorn\\"/);
		expect(used.inputTokens).toBe(2000);
	});

	it('drops what still fails after the repair and says why', async () => {
		const bad = place({ x: 400 });
		const s = stub([{ text: json(output(bad, place())) }, { text: json(output(bad, place())) }]);
		const { result } = await run(s);
		expect(result.status).toBe('partial');
		expect(result.objects).toHaveLength(1);
		expect(result.dropped).toEqual([
			{
				what: expect.stringContaining('steel-static') as string,
				reason: expect.stringMatching(/outside the bay/) as string
			}
		]);
	});

	it('reports a refusal, even one that came after part of the draft, and counts its tokens (Review Focus #3)', async () => {
		const s = stub([{ stop_reason: 'refusal', text: '{"placements":[{"symbolId":"pap' }]);
		const { result, usage: used } = await run(s);
		expect(result).toMatchObject({ status: 'refused', objects: [] });
		expect(used.outputTokens).toBe(400);
	});

	it('reports a draft cut off at the token limit as failed, and counts its tokens', async () => {
		const s = stub([{ stop_reason: 'max_tokens', text: '{"placements":[' }]);
		const outcome = await run(s);
		expect(outcome.result).toMatchObject({ status: 'failed', objects: [] });
		expect(outcome.usage.outputTokens).toBe(400);
		expect(outcome.error).toMatch(/too long/);
	});

	it('reports a failed call instead of throwing, and flags its cost as unknown', async () => {
		const s = stub([new Anthropic.APIConnectionError({ message: 'socket hang up' })]);
		const outcome = await run(s);
		expect(outcome.result).toMatchObject({ status: 'failed', objects: [] });
		expect(outcome.error).toMatch(/socket hang up|Connection error/);
		expect(outcome.unmetered).toBe(true);
	});

	it('skips the repair round when the deadline is too close, keeping what was good', async () => {
		const slow = DRAFT_DEADLINE_MS - REPAIR_MIN_MS + 1000;
		const s = stub([
			{ text: json(output(place({ symbolId: 'unicorn' }), place())), elapseMs: slow }
		]);
		const { result } = await run(s);
		expect(s.calls).toHaveLength(1);
		expect(result.status).toBe('partial');
		expect(result.objects).toHaveLength(1);
		expect(result.dropped[0].reason).toMatch(/unknown symbol/);
	});

	it('records a refused repair round', async () => {
		const s = stub([
			{ text: json(output(place({ symbolId: 'unicorn' }), place())) },
			{ stop_reason: 'refusal', text: '' }
		]);
		const outcome = await run(s);
		expect(outcome.result.status).toBe('partial');
		expect(outcome.error).toMatch(/repair/i);
	});
});

describe('draft timing', () => {
	it('lets the browser wait longer than the server works, and a stuck draft expire after both', () => {
		expect(DRAFT_TIMEOUT_MS).toBeGreaterThan(DRAFT_DEADLINE_MS);
		expect(STALE_DRAFT_MINUTES * 60_000).toBeGreaterThan(DRAFT_TIMEOUT_MS);
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

	it('says where a symbol stands and which way it faces', () => {
		const text = JSON.stringify(buildDraftPrompt(request).system);
		expect(text).toMatch(/centre/);
		expect(text).toMatch(/24 characters/);
		expect(text).toMatch(/rotation 0/);
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
