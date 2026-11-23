import { getDb } from '#lib/store/index.js';
import { parseClickParams } from '#lib/audio/click.js';
import { sounds } from '#lib/audio/sounds.svelte.js';
import {
	CLICK_SOUND_SETTING,
	getSetting,
	SOUNDS_SETTING,
	THEME_SETTING
} from '#lib/store/settings.js';
import { applyTheme } from '#lib/theme/apply.js';
import { currentTheme } from '#lib/theme/current.svelte.js';
import { getTheme } from '#lib/theme/themes.js';
import type { LayoutLoad } from './$types';

// The app reads and writes the local IndexedDB store and keeps its session in the browser, so
// every page renders only in the browser. Server code: hooks, /health and the admin page's load.
export const ssr = false;
export const prerender = false;

export const load: LayoutLoad = async () => {
	// Apply the saved theme before anything renders, so the default never flashes first.
	const theme = getTheme(await getSetting(getDb(), THEME_SETTING));
	applyTheme(theme, document.documentElement);
	currentTheme.id = theme.id;
	sounds.on = (await getSetting(getDb(), SOUNDS_SETTING)) !== 'off';
	sounds.click = parseClickParams(await getSetting(getDb(), CLICK_SOUND_SETTING));
	return { themeId: theme.id };
};
