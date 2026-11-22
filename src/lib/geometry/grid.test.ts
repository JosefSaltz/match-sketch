import { describe, it, expect } from 'vitest';
import { gridSpacing, scaleBar, visibleGridLines } from './grid';

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

describe('visibleGridLines', () => {
	it('returns interior lines of a fitted bay', () => {
		const lines = visibleGridLines(
			{ widthFt: 150, depthFt: 75 },
			{ scale: 6, offsetX: 50, offsetY: 525 },
			{ width: 1000, height: 600 },
			15
		);
		expect(lines.xs).toEqual([15, 30, 45, 60, 75, 90, 105, 120, 135]);
		expect(lines.ys).toEqual([15, 30, 45, 60]);
	});

	it('only returns lines on screen when zoomed far into a huge bay', () => {
		// Review Focus #2: never one line per foot across a 3000 ft bay
		const lines = visibleGridLines(
			{ widthFt: 3000, depthFt: 3000 },
			{ scale: 200, offsetX: 0, offsetY: 600 },
			{ width: 1000, height: 600 },
			1
		);
		expect(lines.xs.length).toBeLessThanOrEqual(6);
		expect(lines.ys.length).toBeLessThanOrEqual(4);
	});
});
