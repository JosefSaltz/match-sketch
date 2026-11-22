import { ENTRIES } from './entries';
import type { CatalogEntry, Category } from './types';

export type { CatalogEntry, Category, SymbolEntry, FootprintEntry, AutoLabel } from './types';

export const CATALOG: readonly CatalogEntry[] = ENTRIES;

export const CATEGORY_ORDER: Category[] = ['target', 'prop', 'structure', 'area', 'marker'];

export const CATEGORY_LABEL: Record<Category, string> = {
	target: 'Targets',
	prop: 'Props',
	structure: 'Structures',
	area: 'Areas',
	marker: 'Markers'
};

const BY_ID = new Map(CATALOG.map((e) => [e.id, e]));

export function getEntry(id: string): CatalogEntry | undefined {
	return BY_ID.get(id);
}

/** Case-insensitive substring match on name and aliases, in catalog order. */
export function searchCatalog(query: string): CatalogEntry[] {
	const q = query.trim().toLowerCase();
	if (!q) return [...CATALOG];
	return CATALOG.filter(
		(e) => e.name.toLowerCase().includes(q) || e.aliases.some((a) => a.toLowerCase().includes(q))
	);
}
