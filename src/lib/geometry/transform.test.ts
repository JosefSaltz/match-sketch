import { describe, it, expect } from 'vitest';
import { rotateWorld, normalizeDegrees, angleFromPointer, resizeFromCorner } from './transform';

describe('rotation', () => {
	it('rotates clockwise as displayed (downrange up)', () => {
		const r = rotateWorld({ x: 0, y: 1 }, 90);
		expect(r.x).toBeCloseTo(1);
		expect(r.y).toBeCloseTo(0);
		const r2 = rotateWorld({ x: 1, y: 0 }, 90);
		expect(r2.x).toBeCloseTo(0);
		expect(r2.y).toBeCloseTo(-1);
	});

	it('normalizes degrees into [0, 360)', () => {
		expect(normalizeDegrees(-15)).toBe(345);
		expect(normalizeDegrees(370)).toBe(10);
	});

	it('derives an angle from a pointer, 0 = downrange', () => {
		expect(angleFromPointer({ x: 0, y: 0 }, { x: 1, y: 0 }, null)).toBeCloseTo(90);
		expect(angleFromPointer({ x: 0, y: 0 }, { x: 0, y: 1 }, null)).toBeCloseTo(0);
		expect(angleFromPointer({ x: 0, y: 0 }, { x: -1, y: -1 }, 15)).toBe(225);
	});
});

describe('resizeFromCorner', () => {
	const box = { x: 10, y: 10, rotation: 0, widthFt: 4, depthFt: 2 };

	it('keeps the opposite corner fixed', () => {
		expect(resizeFromCorner(box, 'ne', { x: 14, y: 13 }, null)).toEqual({
			x: 11,
			y: 11,
			widthFt: 6,
			depthFt: 4
		});
	});

	it('works in the object frame when rotated', () => {
		const rotated = resizeFromCorner({ ...box, rotation: 90 }, 'ne', { x: 12, y: 7 }, null);
		expect(rotated.widthFt).toBeCloseTo(5);
		expect(rotated.depthFt).toBeCloseTo(3);
		expect(rotated.x).toBeCloseTo(10.5);
		expect(rotated.y).toBeCloseTo(9.5);
	});

	it('snaps sizes to the step', () => {
		expect(resizeFromCorner(box, 'ne', { x: 14.2, y: 13 }, 3)).toEqual({
			x: 11,
			y: 10.5,
			widthFt: 6,
			depthFt: 3
		});
	});

	it('never shrinks below the minimum or flips', () => {
		const tiny = resizeFromCorner(box, 'ne', { x: 0, y: 0 }, null);
		expect(tiny.widthFt).toBe(0.5);
		expect(tiny.depthFt).toBe(0.5);
	});
});
