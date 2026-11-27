import { z } from 'zod';

/** A share link's token: 16 random bytes, base64url (spec §7.11). */
export const SHARE_TOKEN = /^[A-Za-z0-9_-]{22}$/;

/**
 * A plan's or match's read-only link. The token stays while sharing is turned off and on, so
 * printed QR codes keep working; only resetting the link replaces it.
 */
export const ShareSchema = z.object({ id: z.string().regex(SHARE_TOKEN), on: z.boolean() });
export type Share = z.infer<typeof ShareSchema>;

export function newShareId(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(16));
	return btoa(String.fromCharCode(...bytes))
		.replaceAll('+', '-')
		.replaceAll('/', '_')
		.replace(/=+$/, '');
}

/** The viewer's address for a share token; `stageId` opens one stage of a shared match. */
export function shareUrl(origin: string, token: string, stageId?: string): string {
	const url = `${origin.replace(/\/$/, '')}/s/${token}`;
	return stageId ? `${url}?stage=${encodeURIComponent(stageId)}` : url;
}
