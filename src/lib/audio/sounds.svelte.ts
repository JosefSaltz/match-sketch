import { DEFAULT_CLICK, type ClickParams } from './click';

/**
 * Whether the editor plays its drag clicks on this device, and how they sound; loaded with the
 * app (see +layout.ts) and tuned on /sounds.
 */
export const sounds = $state<{ on: boolean; click: ClickParams }>({
	on: true,
	click: { ...DEFAULT_CLICK }
});
