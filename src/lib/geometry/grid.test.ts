import { describe, it, expect } from 'vitest';
import { gridSpacing, scaleBar } from './grid';

describe('gridSpacing', () => {
	it('keeps the base spacing when lines are far enough apart', () => {
		expect(gridSpacing(1, 20)).toBe(1);
	});

	it('coarsens the grid when lines would be closer than 8 px', () => {
		expect(gridSpacing(1, 2)).toBe(5);
		expect(gridSpacing(3, 0.5)).toBe(30);
	});

	it('does not draw a line per foot on a very long bay', () => {
		// Review Focus #2: a 3000 ft bay at ~0.4 px/ft
		expect(gridSpacing(1, 0.4)).toBe(50);
	});
});

describe('scaleBar', () => {
	it('picks the largest round length that fits', () => {
		expect(scaleBar(10, 'ft')).toEqual({ lengthFt: 10, label: '10 ft', px: 100 });
		expect(scaleBar(10, 'yd')).toEqual({ lengthFt: 6, label: '2 yd', px: 60 });
	});

	it('is not fooled by floating point at the limit', () => {
		expect(scaleBar(0.4, 'yd')).toEqual({ lengthFt: 300, label: '100 yd', px: 120 });
	});
});
