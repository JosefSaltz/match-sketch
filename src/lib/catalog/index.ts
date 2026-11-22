import { ENTRIES, FAMILIES } from './entries';
import type { CatalogEntry, Category, SymbolFamily } from './types';

export type {
	CatalogEntry,
	Category,
	SymbolEntry,
	FootprintEntry,
	AutoLabel,
	SymbolFamily
} from './types';
export { FAMILIES };

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

function searchTerms(e: CatalogEntry): string[] {
	const family = e.family ? FAMILIES[e.family]?.name : undefined;
	return family ? [e.name, ...e.aliases, family] : [e.name, ...e.aliases];
}

/** Case-insensitive substring match on name, aliases and family name, in catalog order. */
export function searchCatalog(query: string): CatalogEntry[] {
	const q = query.trim().toLowerCase();
	if (!q) return [...CATALOG];
	return CATALOG.filter((e) => searchTerms(e).some((t) => t.toLowerCase().includes(q)));
}

export type FamilyItem = { kind: 'family'; family: SymbolFamily; entries: CatalogEntry[] };
export type PaletteItem = { kind: 'entry'; entry: CatalogEntry } | FamilyItem;
export type PaletteGroup = { category: Category; label: string; items: PaletteItem[] };

/**
 * The palette's tree for a search: categories in `CATEGORY_ORDER` (empty ones dropped), each
 * listing entries in catalog order with family members nested where the first member sits.
 */
export function paletteGroups(query: string): PaletteGroup[] {
	const matches = searchCatalog(query);
	return CATEGORY_ORDER.flatMap((category) => {
		const items: PaletteItem[] = [];
		const families = new Map<string, FamilyItem>();
		for (const entry of matches) {
			if (entry.category !== category) continue;
			const family = entry.family ? FAMILIES[entry.family] : undefined;
			if (!family) {
				items.push({ kind: 'entry', entry });
				continue;
			}
			let item = families.get(family.id);
			if (!item) {
				item = { kind: 'family', family, entries: [] };
				families.set(family.id, item);
				items.push(item);
			}
			item.entries.push(entry);
		}
		return items.length ? [{ category, label: CATEGORY_LABEL[category], items }] : [];
	});
}
