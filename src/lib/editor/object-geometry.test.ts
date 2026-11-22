import { describe, it, expect } from 'vitest';
import { getEntry } from '../catalog/index';
import type { PlanObject } from '../model/plan';
import { localBox, rotatedBounds, type Rect } from './object-geometry';

const obj = (o: Partial<PlanObject>): PlanObject => ({
	id: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
	symbolId: 'popper',
	x: 10,
	y: 10,
	rotation: 0,
	z: 0,
	...o
});

const close = (r: Rect, want: Rect) => {
	for (const k of ['x', 'y', 'width', 'height'] as const) expect(r[k]).toBeCloseTo(want[k], 9);
};

describe('localBox', () => {
	it('puts base-anchored symbols above their point', () => {
		expect(localBox(obj({ symbolId: 'popper' }), getEntry('popper'), 6, 32)).toEqual({
			x: -16,
			y: -32,
			width: 32,
			height: 32
		});
	});

	it('centers center-anchored symbols on their point', () => {
		expect(localBox(obj({ symbolId: 'barrel' }), getEntry('barrel'), 6, 44)).toEqual({
			x: -22,
			y: -22,
			width: 44,
			height: 44
		});
	});

	it('draws footprints to scale, centered', () => {
		const wall = obj({ symbolId: 'wall', widthFt: 8, depthFt: 0.5 });
		expect(localBox(wall, getEntry('wall'), 10, 32)).toEqual({
			x: -40,
			y: -2.5,
			width: 80,
			height: 5
		});
	});

	it("falls back to the entry's default footprint size", () => {
		expect(localBox(obj({ symbolId: 'start-box' }), getEntry('start-box'), 10, 32)).toEqual({
			x: -15,
			y: -15,
			width: 30,
			height: 30
		});
	});

	it('gives unknown symbols a centered symbol box', () => {
		expect(localBox(obj({ symbolId: 'gone' }), undefined, 10, 24)).toEqual({
			x: -12,
			y: -12,
			width: 24,
			height: 24
		});
	});
});

describe('rotatedBounds', () => {
	const glyph: Rect = { x: -16, y: -32, width: 32, height: 32 };

	it('leaves an unrotated box alone', () => {
		close(rotatedBounds(glyph, 0), glyph);
	});

	it('rotates clockwise on screen', () => {
		close(rotatedBounds(glyph, 90), { x: 0, y: -16, width: 32, height: 32 });
		close(rotatedBounds(glyph, 180), { x: -16, y: 0, width: 32, height: 32 });
	});

	it('grows to hold a box rotated off-axis', () => {
		const r = rotatedBounds({ x: -40, y: -2.5, width: 80, height: 5 }, 45);
		const half = (40 + 2.5) * Math.SQRT1_2;
		close(r, { x: -half, y: -half, width: half * 2, height: half * 2 });
	});
});
