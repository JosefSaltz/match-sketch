import type { Theme } from './themes';

/** The bits of an element applyTheme touches (`document.documentElement` in the app). */
export type ThemeRoot = {
	dataset: Record<string, string | undefined>;
	style: { setProperty(name: string, value: string): void };
};

/** Writes the theme's id and CSS variables onto the root, straight from the registry. */
export function applyTheme(theme: Theme, root: ThemeRoot): void {
	root.dataset.theme = theme.id;
	root.style.setProperty('--theme-base', theme.base);
	root.style.setProperty('--theme-accent', theme.accent);
	root.style.setProperty('--theme-tile', theme.tile ? `url("${theme.tile.src}")` : 'none');
	root.style.setProperty(
		'--theme-tile-size',
		theme.tile ? `${theme.tile.width}px ${theme.tile.height}px` : 'auto'
	);
}
