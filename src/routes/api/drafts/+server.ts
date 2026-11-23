import Anthropic from '@anthropic-ai/sdk';
import { ANTHROPIC_API_KEY, DRAFT_DAILY_CAP, DRAFT_DAILY_SPEND_USD } from '$app/env/private';
import { FEATURE_DRAFT_FROM_TEXT } from '$app/env/public';
import { error } from '@sveltejs/kit';
import { requireApiUser } from '#lib/server/auth.js';
import { serverDb } from '#lib/server/db/index.js';
import { handleDraft } from '#lib/server/draft/handle.js';
import { anthropicDraftClient, type DraftClient } from '#lib/server/draft/service.js';
import type { RequestHandler } from './$types';

let client: DraftClient | null | undefined;

/** The Claude client, or null when ANTHROPIC_API_KEY isn't set (drafting is then "not set up"). */
function claude(): DraftClient | null {
	client ??= ANTHROPIC_API_KEY
		? anthropicDraftClient(new Anthropic({ apiKey: ANTHROPIC_API_KEY }))
		: null;
	return client;
}

/** Draft from text (spec §7.5): the editor posts the brief and bay; the reply is the draft. */
export const POST: RequestHandler = async (event) => {
	// Behind a feature flag: while it is off, the endpoint doesn't exist.
	if (!FEATURE_DRAFT_FROM_TEXT) error(404, 'Not found');
	const user = await requireApiUser(event);
	const body: unknown = await event.request.json().catch(() => null);
	const { status, body: reply } = await handleDraft({
		db: serverDb(),
		ownerId: user.id,
		body,
		client: claude(),
		cap: DRAFT_DAILY_CAP,
		ceilingUsd: DRAFT_DAILY_SPEND_USD
	});
	return Response.json(reply, { status, headers: { 'cache-control': 'no-store' } });
};
