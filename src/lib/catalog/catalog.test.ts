import { describe, it, expect } from 'vitest';
import { CATALOG, CATEGORY_ORDER, FAMILIES, getEntry, paletteGroups, searchCatalog } from './index';

const POPPERS = ['popper', 'popper-static', 'popper-trigger', 'popper-auto-reset'];

describe('catalog', () => {
	it('has unique ids and drawable entries', () => {
		expect(new Set(CATALOG.map((e) => e.id)).size).toBe(CATALOG.length);
		for (const e of CATALOG) {
			if (e.kind === 'symbol') expect(e.svg).toContain('<svg');
			else expect(e.footprint.widthFt).toBeGreaterThan(0);
		}
	});

	it('looks entries up by id', () => {
		expect(getEntry('popper')?.name).toBe('Knock-down popper');
		expect(getEntry('nope')).toBeUndefined();
	});

	it('searches names and aliases, case-insensitively', () => {
		expect(searchCatalog('pepper').map((e) => e.id)).toEqual(['popper']);
		expect(searchCatalog('WALL').map((e) => e.id)).toEqual(['wall']);
		expect(searchCatalog('').length).toBe(CATALOG.length);
	});

	it('searches family names', () => {
		expect(searchCatalog('Poppers').map((e) => e.id)).toEqual(POPPERS);
	});
});

describe('families', () => {
	it('only uses known families, each within one category', () => {
		const categoryOf = new Map<string, string>();
		for (const e of CATALOG) {
			if (!e.family) continue;
			expect(FAMILIES[e.family]?.id).toBe(e.family);
			expect(categoryOf.get(e.family) ?? e.category).toBe(e.category);
			categoryOf.set(e.family, e.category);
		}
	});

	it('groups the popper variants as countable base-anchored targets', () => {
		const poppers = CATALOG.filter((e) => e.family === 'poppers');
		expect(poppers.map((e) => e.id)).toEqual(POPPERS);
		for (const e of poppers) {
			expect(e.category).toBe('target');
			expect(e.countable).toBe(true);
			expect(e.kind === 'symbol' && e.anchor).toBe('base');
		}
	});
});

describe('paletteGroups', () => {
	it('lists every category in order', () => {
		expect(paletteGroups('').map((g) => g.label)).toEqual([
			'Targets',
			'Props',
			'Structures',
			'Areas',
			'Markers'
		]);
		expect(paletteGroups('').map((g) => g.category)).toEqual(CATEGORY_ORDER);
	});

	it('nests a family where its first member sits', () => {
		const targets = paletteGroups('')[0];
		expect(
			targets.items.map((i) => (i.kind === 'family' ? `family:${i.family.id}` : i.entry.id))
		).toEqual(['paper', 'family:poppers', 'steel-static']);
		const family = targets.items[1];
		expect(family.kind === 'family' && family.entries.map((e) => e.id)).toEqual(POPPERS);
	});

	it('keeps only matches and drops empty categories', () => {
		const groups = paletteGroups('static');
		expect(groups.map((g) => g.category)).toEqual(['target']);
		const [family, steel] = groups[0].items;
		expect(family.kind === 'family' && family.entries.map((e) => e.id)).toEqual(['popper-static']);
		expect(steel.kind === 'entry' && steel.entry.id).toBe('steel-static');
		expect(paletteGroups('zzz')).toEqual([]);
	});
});
