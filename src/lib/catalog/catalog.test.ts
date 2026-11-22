import { describe, it, expect } from 'vitest';
import { CATALOG, getEntry, searchCatalog } from './index';

describe('catalog', () => {
	it('has unique ids and drawable entries', () => {
		expect(new Set(CATALOG.map((e) => e.id)).size).toBe(CATALOG.length);
		for (const e of CATALOG) {
			if (e.kind === 'symbol') expect(e.svg).toContain('<svg');
			else expect(e.footprint.widthFt).toBeGreaterThan(0);
		}
	});

	it('looks entries up by id', () => {
		expect(getEntry('popper')?.name).toBe('Popper');
		expect(getEntry('nope')).toBeUndefined();
	});

	it('searches names and aliases, case-insensitively', () => {
		expect(searchCatalog('pepper').map((e) => e.id)).toEqual(['popper']);
		expect(searchCatalog('WALL').map((e) => e.id)).toEqual(['wall']);
		expect(searchCatalog('').length).toBe(CATALOG.length);
	});
});
