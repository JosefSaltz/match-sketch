import type { LayerId } from './sources.js';

/**
 * How each layer is drawn, shared by the canvas and the legend. Color and dash each tell the
 * layers apart on their own: color on screen, dash on a black-and-white printout.
 */

/** Stroke dash per layer: AR solid, Pistol NZ, 9mm, 5.56. */
export const DASH: Record<LayerId, string | undefined> = {
	'ar385-splash': undefined,
	'pnz-splash': '6 4',
	'fan-9mm': '14 6',
	'fan-556': '10 4 2 4'
};

/** Okabe–Ito colors, distinguishable with the common color vision deficiencies. */
export const COLOR: Record<LayerId, string> = {
	'ar385-splash': '#D55E00',
	'pnz-splash': '#CC79A7',
	'fan-9mm': '#0072B2',
	'fan-556': '#009E73'
};
