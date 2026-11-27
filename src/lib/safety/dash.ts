import type { LayerId } from './sources.js';

/** Stroke dash per layer (grayscale-readable): AR solid, Pistol NZ, 9mm, 5.56. Shared by the canvas and the legend. */
export const DASH: Record<LayerId, string | undefined> = {
	'ar385-splash': undefined,
	'pnz-splash': '6 4',
	'fan-9mm': '14 6',
	'fan-556': '10 4 2 4'
};
