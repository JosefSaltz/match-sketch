import { describe, expect, it } from 'vitest';
import { qrModules, qrPath } from './qr';

const LINK = 'https://match-sketch.example/s/AbCdEfGhIjKlMnOpQrStUv';

describe('qrModules', () => {
	it('is a square with a light 2-module border', () => {
		const m = qrModules(LINK);
		expect(m.every((row) => row.length === m.length)).toBe(true);
		for (const i of [0, 1, m.length - 2, m.length - 1]) {
			expect(m[i].some(Boolean)).toBe(false);
			expect(m.some((row) => row[i])).toBe(false);
		}
	});

	it('has the three finder patterns just inside the border', () => {
		const m = qrModules(LINK);
		const n = m.length;
		// A finder pattern's dark outer ring: its top row is seven dark modules.
		const finderTop = (y: number, x: number) => m[y].slice(x, x + 7).every(Boolean);
		expect(finderTop(2, 2)).toBe(true);
		expect(finderTop(2, n - 9)).toBe(true);
		expect(finderTop(n - 9, 2)).toBe(true);
		expect(finderTop(n - 9, n - 9)).toBe(false);
	});

	it('is the same code every time for the same link', () => {
		expect(qrModules(LINK)).toEqual(qrModules(LINK));
	});
});

describe('qrPath', () => {
	it('draws one square per dark module, scaled into the rect', () => {
		const d = qrPath(
			[
				[true, false],
				[false, true]
			],
			{ x: 10, y: 20, width: 8, height: 8 }
		);
		expect(d).toBe('M10 20h4v4h-4zM14 24h4v4h-4z');
	});
});
