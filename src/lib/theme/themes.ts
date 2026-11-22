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

/** Every theme the app offers; the single source for their colors and tiles. */
export const THEMES: readonly Theme[] = [
	solid('coyote', 'Coyote', '#81613c'),
	solid('ranger-green', 'Ranger Green', '#4a5240'),
	solid('wolf-grey', 'Wolf Grey', '#5e6366'),
	solid('blackout', 'Blackout', '#1f1f1f'),
	solid('blaze', 'Blaze', '#e8590c')
];

export const DEFAULT_THEME_ID = 'coyote';

const BY_ID = new Map(THEMES.map((t) => [t.id, t]));

/** The theme with this id, or the default for unknown, retired or missing ids. */
export function getTheme(id: string | null | undefined): Theme {
	return (id && BY_ID.get(id)) || BY_ID.get(DEFAULT_THEME_ID)!;
}
