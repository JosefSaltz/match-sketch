import { DraftRequestSchema } from '../../draft/contract';
import type { Database } from '../db/client';
import { estimateCostUsd } from './cost';
import { reserveDraft, settleDraft } from './limits';
import { draftLayout, type DraftClient, type DraftEffort } from './service';

/** The effort the eval settled on (tools/draft-eval/README.md). */
export const DRAFT_EFFORT: DraftEffort = 'medium';

export type DraftResponse = { status: number; body: unknown };

/**
 * POST /api/drafts for a signed-in user (spec §7.5, §6): validate, then reserve the draft
 * against the limits (one at a time per user, the daily cap, the spend ceiling, a site-wide
 * running limit), then the model, then settle the reserved ai_drafts row with the real cost.
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

	const reservation = await reserveDraft(db, {
		ownerId,
		planId: request.planId,
		request,
		cap,
		ceilingUsd
	});
	switch (reservation.kind) {
		case 'busy':
			return {
				status: 429,
				body: { code: 'busy', message: 'A draft is already running for you.' }
			};
		case 'capped': {
			const message = `You've used today's ${cap} drafts. Drafting resets at midnight UTC.`;
			return { status: 429, body: { code: 'capped', cap, message } };
		}
		case 'paused':
			return { status: 503, body: { code: 'paused', message: 'Drafting is paused for today.' } };
		case 'site-busy':
			return {
				status: 503,
				body: { code: 'site-busy', message: 'Drafting is busy right now. Try again in a minute.' }
			};
	}

	// The model call holds no database connection; the reserved row is settled afterwards.
	const outcome = await draftLayout({ client, request, effort });
	try {
		await settleDraft(db, reservation.id, {
			model: outcome.model,
			status: outcome.result.status,
			inputTokens: outcome.usage.inputTokens,
			outputTokens: outcome.usage.outputTokens,
			cacheReadTokens: outcome.usage.cacheReadTokens,
			costUsd: estimateCostUsd(outcome.model, outcome.usage),
			error: outcome.error,
			response: outcome.result
		});
	} catch (e) {
		// The MD still gets the draft; the row stays pending and expires with its reserve.
		console.error('Could not record a finished draft', e);
	}
	return { status: 200, body: outcome.result };
}
