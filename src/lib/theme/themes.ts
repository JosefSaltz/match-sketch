export type ThemeFamily = 'solid' | 'plaid' | 'camo';

/**
 * One app theme. `tile.width`/`height` are the tile's display size in CSS px; `credit` is an id
 * in CREDITS for themes made from someone else's image.
 */
export type Theme = {
	id: string;
	name: string;
	family: ThemeFamily;
	base: string;
	accent: string;
	tile?: { src: string; width: number; height: number };
	credit?: string;
};

const solid = (id: string, name: string, color: string): Theme => ({
	id,
	name,
	family: 'solid',
	base: color,
	accent: color
});

/**
 * A theme drawn from a tile in static/themes (made by tools/patterns). `width`/`height` are the
 * tile's display size in CSS px; `base` shows behind it (and alone if the tile can't load).
 */
const tiled = (
	family: 'plaid' | 'camo',
	id: string,
	name: string,
	base: string,
	accent: string,
	width: number,
	height: number
): Theme => ({
	id,
	name,
	family,
	base,
	accent,
	tile: { src: `/themes/${id}.webp`, width, height },
	...(family === 'camo' ? { credit: id } : {})
});

/** Every theme the app offers; the single source for their colors and tiles. */
export const THEMES: readonly Theme[] = [
	solid('coyote', 'Coyote', '#81613c'),
	solid('ranger-green', 'Ranger Green', '#4a5240'),
	solid('wolf-grey', 'Wolf Grey', '#5e6366'),
	solid('blackout', 'Blackout', '#1f1f1f'),
	solid('blaze', 'Blaze', '#e8590c'),
	tiled('plaid', 'buffalo-check', 'Buffalo Check', '#b3141b', '#b3141b', 128, 128),
	tiled('plaid', 'hunter', 'Hunter', '#1e4d2b', '#1e4d2b', 200, 200),
	tiled('plaid', 'range-day', 'Range Day', '#c9a66b', '#4a5240', 152, 152),
	tiled('camo', 'dpm', 'Woodland DPM', '#616421', '#542f1e', 690, 478),
	tiled('camo', 'm81', 'M81 Woodland', '#644c2a', '#336530', 1500, 454),
	tiled('camo', 'erdl', 'ERDL', '#3c5d38', '#3c5d38', 940, 285),
	tiled('camo', 'tiger-stripe', 'Tiger Stripe', '#6c6b41', '#6c6b41', 640, 640),
	tiled('camo', 'dbdu', 'Chocolate Chip', '#ae9581', '#8c685c', 800, 580),
	tiled('camo', 'dcu', '3-Color Desert', '#bbb18e', '#80603f', 300, 300),
	tiled('camo', 'desert-night', 'Desert Night', '#262a1d', '#4a5040', 768, 480)
];

/** Woodland DPM: authentic, cleanly licensed (UK OGL), and readable under the white wordmark. */
export const DEFAULT_THEME_ID = 'dpm';

const BY_ID = new Map(THEMES.map((t) => [t.id, t]));

/** The theme with this id, or the default for unknown, retired or missing ids. */
export function getTheme(id: string | null | undefined): Theme {
	return (id && BY_ID.get(id)) || BY_ID.get(DEFAULT_THEME_ID)!;
}
