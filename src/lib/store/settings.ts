import type { MatchSketchDB } from './db';
import { now } from './records';

/** The app theme chosen on this device (a theme id). */
export const THEME_SETTING = 'theme';
/** Drag clicks on this device: 'on' (default) or 'off'. */
export const SOUNDS_SETTING = 'sounds';

/** The account whose records this device holds (an auth user id). */
export const SYNC_OWNER = 'sync-owner';
/** The last change sequence pulled from the server. */
export const SYNC_CURSOR = 'sync-cursor';
/** Conflicted copies the MD hasn't looked at yet (JSON list of ConflictCopy). */
export const SYNC_CONFLICTS = 'sync-conflicts';
/** Settings that belong to the signed-in account and are cleared with it on sign-out. */
export const SYNC_SETTINGS = [SYNC_OWNER, SYNC_CURSOR, SYNC_CONFLICTS] as const;

export async function getSetting(db: MatchSketchDB, key: string): Promise<string | undefined> {
	return (await db.settings.get(key))?.value;
}

export async function setSetting(db: MatchSketchDB, key: string, value: string): Promise<void> {
	await db.settings.put({ key, value, updatedAt: now() });
}

export async function deleteSetting(db: MatchSketchDB, key: string): Promise<void> {
	await db.settings.delete(key);
}
