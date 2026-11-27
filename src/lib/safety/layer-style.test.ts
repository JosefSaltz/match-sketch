import { describe, expect, it } from 'vitest';
import { COLOR, DASH } from './layer-style';
import { LAYER_IDS } from './sources';

describe('layer style', () => {
	it('gives every layer its own color and its own dash, so either alone tells them apart', () => {
		expect(new Set(LAYER_IDS.map((id) => COLOR[id])).size).toBe(LAYER_IDS.length);
		expect(new Set(LAYER_IDS.map((id) => DASH[id] ?? 'solid')).size).toBe(LAYER_IDS.length);
	});
	it('uses the Okabe–Ito colorblind-safe palette', () => {
		expect(COLOR).toEqual({
			'ar385-splash': '#D55E00',
			'pnz-splash': '#CC79A7',
			'fan-9mm': '#0072B2',
			'fan-556': '#009E73'
		});
	});
});
