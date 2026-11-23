import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { createCanvas } from '../store/canvases';
import { createDb, type MatchSketchDB } from '../store/db';
import { journalKey } from '../store/journal';
import { createPlan } from '../store/plans';
import {
	getSetting,
	setSetting,
	SOUNDS_SETTING,
	SYNC_CURSOR,
	SYNC_OWNER,
	THEME_SETTING
} from '../store/settings';
import { addedNotice, adoptDevice, clearLocalData, unsyncedCount, unsyncedWarning } from './device';

const bay = { name: 'Bay 4', widthFt: 90, depthFt: 60, unit: 'yd' as const };
let db: MatchSketchDB;

beforeEach(() => {
	db = createDb(`device-${crypto.randomUUID()}`);
});

function memoryStorage() {
	const map = new Map<string, string>();
	return {
		map,
		get length() {
			return map.size;
		},
		key: (i: number) => [...map.keys()][i] ?? null,
		getItem: (k: string) => map.get(k) ?? null,
		setItem: (k: string, v: string) => void map.set(k, v),
		removeItem: (k: string) => void map.delete(k)
	};
}

describe('adoptDevice', () => {
	it('adopts local data from before accounts on a first sign-in', async () => {
		await createPlan(db, { canvas: bay, sourceCanvasId: null });
		await createPlan(db, { canvas: bay, sourceCanvasId: null });
		await createCanvas(db, bay);
		const result = await adoptDevice(db, 'user-1');
		expect(result).toEqual({ state: 'adopted', added: { plans: 2, canvases: 1, matches: 0 } });
		expect(await getSetting(db, SYNC_OWNER)).toBe('user-1');
		expect(addedNotice(result.added)).toBe(
			'Added 2 plans and 1 canvas from this device to your account.'
		);
	});

	it('is quiet on a fresh device and on later sign-ins', async () => {
		expect(addedNotice((await adoptDevice(db, 'user-1')).added)).toBeNull();
		await createPlan(db, { canvas: bay, sourceCanvasId: null });
		expect((await adoptDevice(db, 'user-1')).state).toBe('same');
	});

	it("notices another account's data on the device", async () => {
		await setSetting(db, SYNC_OWNER, 'user-1');
		expect((await adoptDevice(db, 'user-2')).state).toBe('other-account');
	});
});

describe('addedNotice', () => {
	it('lists only what was added, in plain English', () => {
		expect(addedNotice({ plans: 1, canvases: 0, matches: 0 })).toBe(
			'Added 1 plan from this device to your account.'
		);
		expect(addedNotice({ plans: 3, canvases: 2, matches: 1 })).toBe(
			'Added 3 plans, 2 canvases and 1 match from this device to your account.'
		);
	});
});

describe('unsyncedCount and clearLocalData', () => {
	it('counts records with changes not yet synced', async () => {
		await createPlan(db, { canvas: bay, sourceCanvasId: null });
		await createCanvas(db, bay);
		expect(await unsyncedCount(db)).toBe(2);
	});

	it("clears the account's data but keeps the device's preferences", async () => {
		const plan = await createPlan(db, { canvas: bay, sourceCanvasId: null });
		await createCanvas(db, bay);
		await setSetting(db, THEME_SETTING, 'woodland');
		await setSetting(db, SOUNDS_SETTING, 'off');
		await setSetting(db, SYNC_OWNER, 'user-1');
		await setSetting(db, SYNC_CURSOR, '42');
		const storage = memoryStorage();
		storage.setItem(journalKey(plan.id), '{}');
		storage.setItem('other-app-key', 'x');

		await clearLocalData(db, storage);

		expect(await db.plans.count()).toBe(0);
		expect(await db.canvases.count()).toBe(0);
		expect(await getSetting(db, SYNC_OWNER)).toBeUndefined();
		expect(await getSetting(db, SYNC_CURSOR)).toBeUndefined();
		expect(await getSetting(db, THEME_SETTING)).toBe('woodland');
		expect(await getSetting(db, SOUNDS_SETTING)).toBe('off');
		expect([...storage.map.keys()]).toEqual(['other-app-key']);
	});
});

describe('unsyncedWarning', () => {
	it('warns about one change, or several', () => {
		expect(unsyncedWarning(1)).toBe(
			"1 change on this device hasn't synced. Signing out deletes it."
		);
		expect(unsyncedWarning(3)).toBe(
			"3 changes on this device haven't synced. Signing out deletes them."
		);
	});
});
