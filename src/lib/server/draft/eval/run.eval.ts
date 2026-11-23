/**
 * Runs Draft from text on the reference stages with the real model and grades the drafts.
 * Costs real money: run only on purpose (pnpm eval:draft), never in CI. See tools/draft-eval.
 */
import Anthropic from '@anthropic-ai/sdk';
import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { estimateCostUsd } from '../cost';
import { anthropicDraftClient, draftLayout, type DraftEffort } from '../service';
import { EVAL_CASES } from './cases';
import { claudeCliDraftClient } from './cli-client';
import { gradeDraft } from './grade';

const effort = (process.env.EVAL_EFFORT ?? 'medium') as DraftEffort;

/** `cli`: through the local `claude` CLI (a Claude subscription); otherwise the API with a key. */
const viaCli = process.env.DRAFT_EVAL_CLIENT === 'cli';

/** Runs `fn` over `items`, at most `limit` at a time, keeping their order. */
async function pooled<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
	const out: R[] = new Array<R>(items.length);
	let next = 0;
	const worker = async () => {
		while (next < items.length) {
			const i = next++;
			out[i] = await fn(items[i]);
		}
	};
	await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
	return out;
}

// Only on purpose: an API key in the shell alone doesn't start a paid run.
it.skipIf(process.env.RUN_DRAFT_EVAL !== '1' || (!viaCli && !process.env.ANTHROPIC_API_KEY))(
	`drafts the reference stages at ${effort} effort`,
	async () => {
		// The production client (streaming, one retry, the service's own deadline), or the CLI.
		const client = viaCli ? claudeCliDraftClient() : anthropicDraftClient(new Anthropic());
		const rows = await pooled(EVAL_CASES, 3, async (c) => {
			const started = Date.now();
			const outcome = await draftLayout({ client, request: c.request, effort });
			const grade = gradeDraft(c, outcome.result);
			return {
				stage: c.name,
				status: outcome.result.status,
				score: +grade.score.toFixed(2),
				...grade.checks,
				objects: outcome.result.objects.length,
				dropped: outcome.result.dropped.length,
				seconds: Math.round((Date.now() - started) / 1000),
				costUsd: +estimateCostUsd(outcome.model, outcome.usage).toFixed(4),
				model: outcome.model,
				error: outcome.error,
				result: outcome.result
			};
		});
		console.table(rows.map((row) => ({ ...row, result: undefined })));
		const mean = rows.reduce((s, r) => s + r.score, 0) / rows.length;
		const cost = rows.reduce((s, r) => s + r.costUsd, 0);
		console.log(
			`${viaCli ? 'cli' : 'api'}, effort ${effort}: mean score ${mean.toFixed(3)}, cost $${cost.toFixed(3)}`
		);
		mkdirSync('tools/draft-eval/out', { recursive: true });
		const stamp = new Date().toISOString().replaceAll(':', '-');
		writeFileSync(
			`tools/draft-eval/out/${stamp}-${effort}.json`,
			JSON.stringify({ effort, mean, cost, rows }, null, 2)
		);
		expect(rows).toHaveLength(EVAL_CASES.length);
	},
	1_800_000
);
