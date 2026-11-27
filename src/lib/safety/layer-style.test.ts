import { describe, expect, it } from 'vitest';
import { COLOR, DASH, FILL } from './layer-style';
import { LAYER_IDS } from './sources';

describe('layer style', () => {
	it('gives every layer its own color and its own dash, so either alone tells them apart', () => {
		expect(new Set(LAYER_IDS.map((id) => COLOR[id])).size).toBe(LAYER_IDS.length);
		expect(new Set(LAYER_IDS.map((id) => DASH[id] ?? 'solid')).size).toBe(LAYER_IDS.length);
	});
	it('draws the Army splash in olive drab and the rest in Okabe–Ito colors', () => {
		expect(COLOR).toEqual({
			'ar385-splash': '#4B5320',
			'pnz-splash': '#CC79A7',
			'fan-9mm': '#0072B2',
			'fan-556': '#009E73'
		});
	});
	it('fills the Army splash wedge red, and every other zone in its line color', () => {
		expect(FILL['ar385-splash']).toBe('#D55E00');
		for (const id of LAYER_IDS.filter((id) => id !== 'ar385-splash'))
			expect(FILL[id]).toBe(COLOR[id]);
	});
});
