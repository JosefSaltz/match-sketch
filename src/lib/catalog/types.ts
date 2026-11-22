export type Category = 'target' | 'prop' | 'structure' | 'area' | 'marker';

export type AutoLabel = { prefix: string; style: 'number' | 'letter' };

type BaseEntry = {
	id: string;
	name: string;
	aliases: string[];
	category: Category;
	/** Targets: one object can stand for several (e.g. "KD ×4"). */
	countable: boolean;
	autoLabel?: AutoLabel;
};

/** Drawn at a fixed screen/print size at its true position. `svg` uses viewBox 0 0 100 100. */
export type SymbolEntry = BaseEntry & { kind: 'symbol'; svg: string; anchor: 'base' | 'center' };

/** Drawn to scale; position is the center. */
export type FootprintEntry = BaseEntry & {
	kind: 'footprint';
	footprint: { style: 'solid' | 'outline' | 'line'; widthFt: number; depthFt: number };
};

export type CatalogEntry = SymbolEntry | FootprintEntry;
