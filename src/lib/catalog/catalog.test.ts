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
		expect(searchCatalog('WALL').map((e) => e.id)).toEqual([
			'wall',
			'wall-port',
			'half-wall-port',
			'v-wall'
		]);
		expect(searchCatalog('').length).toBe(CATALOG.length);
	});

	it('finds targets by common aliases', () => {
		expect(searchCatalog('IPSC').map((e) => e.id)).toContain('paper');
		expect(searchCatalog('knock-down plate').map((e) => e.id)).toEqual(['plate-kd']);
	});

	it('shares no alias between entries, nor uses another entry’s name as one', () => {
		const owner = new Map<string, string>();
		for (const e of CATALOG) owner.set(e.name.toLowerCase(), e.id);
		const seen = new Map<string, string>();
		for (const e of CATALOG) {
			for (const a of e.aliases) {
				const k = a.toLowerCase();
				expect(seen.get(k) ?? e.id, `alias "${a}"`).toBe(e.id);
				expect(owner.get(k) ?? e.id, `alias "${a}" is another entry's name`).toBe(e.id);
				seen.set(k, e.id);
			}
		}
	});

	it('has the props, drawn from above at a fixed size', () => {
		const props = CATALOG.filter((e) => e.category === 'prop' && e.id !== 'dump-box');
		expect(props.map((e) => e.id)).toEqual([
			'barrel',
			'barrels-stacked',
			'tire',
			'chair',
			'ammo-can',
			'bucket',
			'crate',
			'tree',
			'target-stand',
			'sawhorse'
		]);
		for (const e of props) expect(e.kind === 'symbol' && e.anchor, e.id).toBe('center');
	});

	it('has the structures, drawn to scale with their own styles', () => {
		const sizes = Object.fromEntries(
			CATALOG.filter((e) => e.category === 'structure').map((e) => [
				e.id,
				e.kind === 'footprint'
					? `${e.footprint.style} ${e.footprint.widthFt}x${e.footprint.depthFt}`
					: 'symbol'
			])
		);
		expect(sizes).toEqual({
			wall: 'solid 8x0.5',
			'wall-port': 'wall-port 8x0.5',
			'half-wall-port': 'half-wall-port 8x0.5',
			'v-wall': 'v-wall 6x3',
			door: 'door 3x3',
			car: 'car 6x15',
			table: 'table 6x3',
			pallet: 'pallet 4x4',
			'chopper-seat': 'bench 5x2',
			plank: 'bench 8x1',
			stairs: 'stairs 4x6',
			platform: 'platform 8x8',
			wobble: 'wobble 4x4',
			barrier: 'barrier 6x0.5',
			berm: 'berm 20x6',
			fence: 'fence 10x0.3'
		});
	});

	it('finds structures by their common names', () => {
		expect(searchCatalog('sticks').map((e) => e.id)).toEqual(['barrier']);
		expect(searchCatalog('mound').map((e) => e.id)).toEqual(['berm']);
		expect(searchCatalog('VTAC').map((e) => e.id)).toEqual(['v-wall']);
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

	it('has the full target set, every target in a family', () => {
		const targets = CATALOG.filter((e) => e.category === 'target');
		expect(targets).toHaveLength(19);
		for (const e of targets) {
			expect(e.family, e.id).toBeDefined();
			expect(e.countable, e.id).toBe(true);
			expect(e.kind === 'symbol' && e.anchor, e.id).toBe('base');
		}
		expect(Object.keys(FAMILIES)).toEqual(['paper', 'poppers', 'steel', 'movers']);
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
		).toEqual(['family:paper', 'family:poppers', 'family:steel', 'family:movers']);
		const family = targets.items[1];
		expect(family.kind === 'family' && family.entries.map((e) => e.id)).toEqual(POPPERS);
	});

	it('keeps only matches and drops empty categories', () => {
		const groups = paletteGroups('static');
		expect(groups.map((g) => g.category)).toEqual(['target']);
		const [poppers, steel] = groups[0].items;
		expect(poppers.kind === 'family' && poppers.entries.map((e) => e.id)).toEqual([
			'popper-static'
		]);
		expect(steel.kind === 'family' && steel.entries.map((e) => e.id)).toEqual(['steel-static']);
		expect(paletteGroups('zzz')).toEqual([]);
	});
});
