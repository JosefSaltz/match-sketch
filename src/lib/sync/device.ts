import type { MatchSketchDB } from '../store/db';
import { journalKey } from '../store/journal';
import {
	deleteSetting,
	getSetting,
	setSetting,
	SYNC_OWNER,
	SYNC_SETTINGS
} from '../store/settings';
import { SYNC_TABLES } from './wire';

export type Added = { plans: number; canvases: number; matches: number };

/**
 * Ties the device's local records to the signed-in account. On the first sign-in, records made
 * before accounts existed (version 0) are the account's now; they are already dirty, so the
 * next sync uploads them (spec §9, 2026-11-22).
 */
export async function adoptDevice(
	db: MatchSketchDB,
	accountId: string
): Promise<{ state: 'adopted' | 'same' | 'other-account'; added: Added }> {
	const none: Added = { plans: 0, canvases: 0, matches: 0 };
	const owner = await getSetting(db, SYNC_OWNER);
	if (owner === accountId) return { state: 'same', added: none };
	if (owner) return { state: 'other-account', added: none };
	await setSetting(db, SYNC_OWNER, accountId);
	const count = (table: 'plans' | 'canvases' | 'matches') =>
		db
			.table<{ version: number; deletedAt: string | null }>(table)
			.filter((r) => r.version === 0 && r.deletedAt === null)
			.count();
	return {
		state: 'adopted',
		added: {
			plans: await count('plans'),
			canvases: await count('canvases'),
			matches: await count('matches')
		}
	};
}

const NOUNS: Record<keyof Added, [string, string]> = {
	plans: ['plan', 'plans'],
	canvases: ['canvas', 'canvases'],
	matches: ['match', 'matches']
};

/** "Added 2 plans and 1 canvas from this device to your account.", or null if nothing was. */
export function addedNotice(added: Added): string | null {
	const parts = (Object.keys(NOUNS) as (keyof Added)[])
		.filter((kind) => added[kind] > 0)
		.map((kind) => `${added[kind]} ${NOUNS[kind][added[kind] === 1 ? 0 : 1]}`);
	if (parts.length === 0) return null;
	const list =
		parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}`;
	return `Added ${list} from this device to your account.`;
}

/** Records with changes this device hasn't synced (deletions included). */
export async function unsyncedCount(db: MatchSketchDB): Promise<number> {
	let total = 0;
	for (const table of SYNC_TABLES) total += await db.table(table).where('dirty').equals(1).count();
	return total;
}

export type ClearableStorage = Pick<Storage, 'length' | 'key' | 'removeItem'>;

/**
 * Removes the account's data from the device on sign-out: synced records, sync settings and
 * unsaved-edit journal entries. Device preferences (theme, sounds) stay.
 */
export async function clearLocalData(db: MatchSketchDB, storage: ClearableStorage): Promise<void> {
	await db.transaction('rw', db.canvases, db.matches, db.plans, db.settings, async () => {
		await Promise.all([db.canvases.clear(), db.matches.clear(), db.plans.clear()]);
		for (const key of SYNC_SETTINGS) await deleteSetting(db, key);
	});
	const prefix = journalKey('');
	const keys: string[] = [];
	for (let i = 0; i < storage.length; i++) {
		const key = storage.key(i);
		if (key?.startsWith(prefix)) keys.push(key);
	}
	for (const key of keys) storage.removeItem(key);
}

/** The sign-out warning for `count` unsynced changes (count > 0). */
export function unsyncedWarning(count: number): string {
	return count === 1
		? "1 change on this device hasn't synced. Signing out deletes it."
		: `${count} changes on this device haven't synced. Signing out deletes them.`;
}
