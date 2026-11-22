import { describe, expect, it } from 'vitest';
import { clickStepFt, gridCell } from './grid-cross';

describe('gridCell', () => {
	it('names the grid point nearest a position', () => {
		expect(gridCell({ x: 0.4, y: 0.4 }, 1)).toBe('0:0');
		expect(gridCell({ x: 0.6, y: 0.4 }, 1)).toBe('1:0');
		expect(gridCell({ x: 14, y: 16 }, 15)).toBe('1:1');
	});

	it('changes only when a grid line is crossed', () => {
		const a = gridCell({ x: 9.6, y: 5 }, 3);
		expect(gridCell({ x: 10.4, y: 5.4 }, 3)).toBe(a);
		expect(gridCell({ x: 10.4 + 3, y: 5.4 }, 3)).not.toBe(a);
	});
});

describe('clickStepFt', () => {
	it('clicks on each snap step when Snap is on', () => {
		expect(clickStepFt({ snapFt: 3, grid: 'fine', fineFt: 1 })).toBe(3);
	});

	it('follows the visible grid when Snap is off', () => {
		expect(clickStepFt({ snapFt: null, grid: 'fine', fineFt: 5 })).toBe(5);
		expect(clickStepFt({ snapFt: null, grid: 75, fineFt: 5 })).toBe(75);
	});

	it('stays quiet with no snap and no grid', () => {
		expect(clickStepFt({ snapFt: null, grid: 'off', fineFt: 5 })).toBeNull();
	});
});
