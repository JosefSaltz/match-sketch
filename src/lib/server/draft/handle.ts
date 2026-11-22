import { DraftRequestSchema } from '../../draft/contract';
import type { Database } from '../db/client';
import { estimateCostUsd } from './cost';
import { draftsToday, logDraft, spendToday, withDraftLock } from './limits';
import { DRAFT_MODEL, draftLayout, type DraftClient, type DraftEffort } from './service';

/** The effort the eval settled on (tools/draft-eval/README.md). */
export const DRAFT_EFFORT: DraftEffort = 'medium';

export type DraftResponse = { status: number; body: unknown };

const NO_USAGE = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, costUsd: 0 };

/**
 * POST /api/drafts for a signed-in user (spec §7.5, §6): validate, one draft at a time per
 * user, the per-user daily cap, the site-wide spend ceiling, then the model; every request
 * that gets past validation is logged in ai_drafts.
 */
export async function handleDraft(options: {
	db: Database;
	ownerId: string;
	body: unknown;
	client: DraftClient | null;
	cap: number;
	ceilingUsd: number;
	effort?: DraftEffort;
}): Promise<DraftResponse> {
	const { db, ownerId, client, cap, ceilingUsd, effort = DRAFT_EFFORT } = options;
	const parsed = DraftRequestSchema.safeParse(options.body);
	if (!parsed.success) {
		return { status: 400, body: { code: 'invalid', issues: parsed.error.issues } };
	}
	if (!client) {
		return {
			status: 503,
			body: { code: 'not-set-up', message: "Drafting isn't set up on this server." }
		};
	}
	const request = parsed.data;
	const logged = { ownerId, planId: request.planId, request, error: null };

	const ran = await withDraftLock(db, ownerId, async (): Promise<DraftResponse> => {
		if ((await draftsToday(db, ownerId)) >= cap) {
			await logDraft(db, {
				...logged,
				...NO_USAGE,
				model: DRAFT_MODEL,
				status: 'capped',
				response: {}
			});
			const message = `You've used today's ${cap} drafts. Drafting resets at midnight UTC.`;
			return { status: 429, body: { code: 'capped', cap, message } };
		}
		if ((await spendToday(db)) >= ceilingUsd) {
			await logDraft(db, {
				...logged,
				...NO_USAGE,
				model: DRAFT_MODEL,
				status: 'paused',
				response: {}
			});
			return { status: 503, body: { code: 'paused', message: 'Drafting is paused for today.' } };
		}
		const outcome = await draftLayout({ client, request, effort });
		await logDraft(db, {
			...logged,
			model: outcome.model,
			status: outcome.result.status,
			inputTokens: outcome.usage.inputTokens,
			outputTokens: outcome.usage.outputTokens,
			cacheReadTokens: outcome.usage.cacheReadTokens,
			costUsd: estimateCostUsd(outcome.model, outcome.usage),
			error: outcome.error,
			response: outcome.result
		});
		return { status: 200, body: outcome.result };
	});
	return (
		ran ?? { status: 429, body: { code: 'busy', message: 'A draft is already running for you.' } }
	);
}
