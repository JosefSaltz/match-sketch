import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { createDb, type MatchSketchDB } from './db';
import { getSetting, setSetting, THEME_SETTING } from './settings';

let db: MatchSketchDB;
beforeEach(() => {
	db = createDb(`test-${crypto.randomUUID()}`);
});

describe('settings', () => {
	it('saves and reads a setting', async () => {
		await setSetting(db, THEME_SETTING, 'blaze');
		expect(await getSetting(db, THEME_SETTING)).toBe('blaze');
	});

	it('reads nothing for a setting never saved', async () => {
		expect(await getSetting(db, THEME_SETTING)).toBeUndefined();
	});

	it('overwrites an earlier value', async () => {
		await setSetting(db, THEME_SETTING, 'blaze');
		await setSetting(db, THEME_SETTING, 'coyote');
		expect(await getSetting(db, THEME_SETTING)).toBe('coyote');
	});
});
