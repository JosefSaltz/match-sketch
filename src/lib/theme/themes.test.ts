import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DEFAULT_THEME_ID, getTheme, THEMES } from './themes';

describe('theme registry', () => {
	it('has unique ids and complete entries', () => {
		expect(new Set(THEMES.map((t) => t.id)).size).toBe(THEMES.length);
		for (const t of THEMES) {
			expect(t.name.length).toBeGreaterThan(0);
			expect(t.base).toMatch(/^#[0-9a-f]{6}$/);
			expect(t.accent).toMatch(/^#[0-9a-f]{6}$/);
		}
	});

	it('starts with the five solids', () => {
		expect(THEMES.filter((t) => t.family === 'solid').map((t) => [t.id, t.name, t.base])).toEqual([
			['coyote', 'Coyote', '#81613c'],
			['ranger-green', 'Ranger Green', '#4a5240'],
			['wolf-grey', 'Wolf Grey', '#5e6366'],
			['blackout', 'Blackout', '#1f1f1f'],
			['blaze', 'Blaze', '#e8590c']
		]);
	});

	it('every tile exists under static/themes', () => {
		const broken = THEMES.filter(
			(t) => t.tile && (t.tile.src !== `/themes/${t.id}.webp` || !existsSync(`static${t.tile.src}`))
		).map((t) => t.id);
		expect(broken).toEqual([]);
	});

	it('offers three plaids and seven camo patterns, each camo credited', () => {
		expect(THEMES.filter((t) => t.family === 'plaid')).toHaveLength(3);
		const camo = THEMES.filter((t) => t.family === 'camo');
		expect(camo.map((t) => t.id)).toEqual([
			'dpm',
			'm81',
			'erdl',
			'tiger-stripe',
			'dbdu',
			'dcu',
			'desert-night'
		]);
		for (const t of camo) expect(t.credit).toBe(t.id);
		expect(DEFAULT_THEME_ID).toBe('dpm');
	});

	it('falls back to the default for unknown or missing ids (Review Focus #2)', () => {
		expect(getTheme(DEFAULT_THEME_ID).id).toBe(DEFAULT_THEME_ID);
		expect(getTheme('no-such-theme').id).toBe(DEFAULT_THEME_ID);
		expect(getTheme(undefined).id).toBe(DEFAULT_THEME_ID);
		expect(getTheme(null).id).toBe(DEFAULT_THEME_ID);
	});
});
