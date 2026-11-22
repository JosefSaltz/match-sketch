import { DEFAULT_THEME_ID } from './themes';

/**
 * The theme in use on this device, shared by every screen. The app layout sets it on load and
 * the picker updates it; app routes render only in the browser, so module state is safe here.
 */
export const currentTheme = $state({ id: DEFAULT_THEME_ID });
