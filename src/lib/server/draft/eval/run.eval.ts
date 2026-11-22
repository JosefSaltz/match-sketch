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
import { gradeDraft } from './grade';

const effort = (process.env.EVAL_EFFORT ?? 'medium') as DraftEffort;

// Only on purpose: an API key in the shell alone doesn't start a paid run.
it.skipIf(!process.env.ANTHROPIC_API_KEY || process.env.RUN_DRAFT_EVAL !== '1')(
	`drafts the reference stages at ${effort} effort`,
	async () => {
		// The production client: streaming, one retry, the service's own deadline.
		const client = anthropicDraftClient(new Anthropic());
		const rows = await Promise.all(
			EVAL_CASES.map(async (c) => {
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
			})
		);
		console.table(rows.map((row) => ({ ...row, result: undefined })));
		const mean = rows.reduce((s, r) => s + r.score, 0) / rows.length;
		const cost = rows.reduce((s, r) => s + r.costUsd, 0);
		console.log(`effort ${effort}: mean score ${mean.toFixed(3)}, cost $${cost.toFixed(3)}`);
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
