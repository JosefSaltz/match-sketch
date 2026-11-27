import type { FootprintStyle } from './footprint-shapes';

export type Category = 'target' | 'prop' | 'structure' | 'area' | 'marker';

export type AutoLabel = { prefix: string; style: 'number' | 'letter' };

type BaseEntry = {
	id: string;
	name: string;
	aliases: string[];
	category: Category;
	/** Groups variants of one target type in the palette (e.g. `poppers`); a `FAMILIES` id. */
	family?: string;
	/** Plural display name for counts (e.g. the Targets tally); defaults to `name` + "s". */
	plural?: string;
	/** Keep the name's case in running text (the tally), e.g. "KD plate", "Texas star". */
	keepCase?: boolean;
	/** Targets: one object can stand for several (e.g. "KD ×4"). */
	countable: boolean;
	/** Steel the shooter hits: draws ricochet danger zones (danger-zones spec §4.1). */
	steel?: boolean;
	autoLabel?: AutoLabel;
};

/** Drawn at a fixed screen/print size at its true position. `svg` uses viewBox 0 0 100 100. */
export type SymbolEntry = BaseEntry & { kind: 'symbol'; svg: string; anchor: 'base' | 'center' };

/** Drawn to scale; position is the center. */
export type FootprintEntry = BaseEntry & {
	kind: 'footprint';
	footprint: { style: FootprintStyle; widthFt: number; depthFt: number };
};

export type CatalogEntry = SymbolEntry | FootprintEntry;

/** Variants of one target type, listed together in the palette. */
export type SymbolFamily = { id: string; name: string };
