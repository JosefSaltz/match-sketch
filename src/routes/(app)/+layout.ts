import { getDb } from '#lib/store/index.js';
import { getSetting, THEME_SETTING } from '#lib/store/settings.js';
import { applyTheme } from '#lib/theme/apply.js';
import { currentTheme } from '#lib/theme/current.svelte.js';
import { getTheme } from '#lib/theme/themes.js';
import type { LayoutLoad } from './$types';

// App routes read and write the local IndexedDB store, so they render only in the browser.
export const ssr = false;
export const prerender = false;

export const load: LayoutLoad = async () => {
	// Apply the saved theme before anything renders, so the default never flashes first.
	const theme = getTheme(await getSetting(getDb(), THEME_SETTING));
	applyTheme(theme, document.documentElement);
	currentTheme.id = theme.id;
	return { themeId: theme.id };
};
