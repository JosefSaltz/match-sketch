import { describe, expect, it } from 'vitest';
import { depthMapFor, SQUEEZED_DRAWN_FT, toDrawn, toTrue } from './depth-map';

const map = { fromFt: 90, toFt: 900, drawnFt: 75 };

describe('depth map', () => {
	it('leaves depths before the break alone', () => {
		expect(toDrawn(0, map)).toBe(0);
		expect(toDrawn(90, map)).toBe(90);
		expect(toTrue(45, map)).toBe(45);
	});

	it('squeezes the rest of the bay into the strip', () => {
		expect(toDrawn(900, map)).toBe(165);
		expect(toDrawn(495, map)).toBeCloseTo(127.5);
	});

	it('round-trips every depth', () => {
		for (const y of [0, 30, 90, 91, 300, 450, 899, 900, 1000]) {
			expect(toTrue(toDrawn(y, map), map)).toBeCloseTo(y, 9);
		}
	});

	it('is the identity without a break', () => {
		expect(toDrawn(500, null)).toBe(500);
		expect(toTrue(500, null)).toBe(500);
	});

	it('reads the first break, squeezed to 25 yd or less', () => {
		expect(depthMapFor([{ fromFt: 90, toFt: 900 }], 900)).toEqual(map);
		expect(SQUEEZED_DRAWN_FT).toBe(75);
		expect(depthMapFor([{ fromFt: 60, toFt: 100 }], 100)).toEqual({
			fromFt: 60,
			toFt: 100,
			drawnFt: 40
		});
	});

	it('ignores a missing or impossible break', () => {
		expect(depthMapFor([], 900)).toBeNull();
		expect(depthMapFor([{ fromFt: 900, toFt: 950 }], 900)).toBeNull();
		expect(depthMapFor([{ fromFt: -5, toFt: 900 }], 900)).toBeNull();
	});
});
