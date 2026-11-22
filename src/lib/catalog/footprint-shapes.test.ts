import { describe, expect, it } from 'vitest';
import { FOOTPRINT_STYLES, footprintShapes, type Shape } from './footprint-shapes';

/** Every number in a shape: attribute values and the coordinates in a path. */
function numbersIn(s: Shape): number[] {
	const out: number[] = [];
	for (const [k, v] of Object.entries(s.attrs)) {
		if (k === 'd')
			out.push(
				...String(v)
					.match(/-?\d*\.?\d+(?:e-?\d+)?/g)!
					.map(Number)
			);
		else if (typeof v === 'number') out.push(v);
	}
	return out;
}

/** The x/y points a shape touches (circles by their extremes). */
function pointsOf(s: Shape): [number, number][] {
	const a = s.attrs as Record<string, number>;
	if (s.el === 'rect')
		return [
			[a.x, a.y],
			[a.x + a.width, a.y + a.height]
		];
	if (s.el === 'line')
		return [
			[a.x1, a.y1],
			[a.x2, a.y2]
		];
	if (s.el === 'circle')
		return [
			[a.cx - a.r, a.cy - a.r],
			[a.cx + a.r, a.cy + a.r]
		];
	const n = numbersIn(s);
	const pts: [number, number][] = [];
	for (let i = 0; i + 1 < n.length; i += 2) pts.push([n[i], n[i + 1]]);
	return pts;
}

function withinBox(s: Shape, w: number, h: number, slack: number): boolean {
	return pointsOf(s).every(
		([x, y]) => Math.abs(x) <= w / 2 + slack + 1e-9 && Math.abs(y) <= h / 2 + slack + 1e-9
	);
}

describe('footprintShapes', () => {
	it('draws every style inside its box', () => {
		for (const style of FOOTPRINT_STYLES) {
			const shapes = footprintShapes(style, 120, 40);
			expect(shapes.length, style).toBeGreaterThan(0);
			for (const s of shapes) expect(withinBox(s, 120, 40, 2), `${style} ${s.el}`).toBe(true);
		}
	});

	it('writes paths with absolute M, L, Q, C and Z commands only', () => {
		for (const style of FOOTPRINT_STYLES) {
			for (const s of footprintShapes(style, 120, 40)) {
				if (s.el === 'path') expect(String(s.attrs.d), style).toMatch(/^[MLQCZ\d\s.,-]+$/);
			}
		}
	});

	it('keeps the inside of an outline clickable', () => {
		expect(footprintShapes('outline', 50, 50)[0].paint).toBe('hit');
	});

	it('stays finite and non-negative when tiny or thin', () => {
		for (const style of FOOTPRINT_STYLES) {
			for (const [w, h] of [
				[2, 2],
				[60, 0.4],
				[0.4, 60]
			]) {
				for (const s of footprintShapes(style, w, h)) {
					for (const v of numbersIn(s)) expect(Number.isFinite(v), style).toBe(true);
					const a = s.attrs as Record<string, number>;
					if (s.el === 'rect') expect(Math.min(a.width, a.height), style).toBeGreaterThanOrEqual(0);
					if (s.el === 'circle') expect(a.r, style).toBeGreaterThanOrEqual(0);
				}
			}
		}
	});

	it('thickens a line to 3 px', () => {
		const [bar] = footprintShapes('line', 80, 0.5);
		expect(bar.el).toBe('rect');
		expect(bar.attrs.height).toBe(3);
		expect(bar.attrs.y).toBe(-1.5);
	});

	it('keeps the plain styles as before', () => {
		expect(footprintShapes('solid', 40, 10)).toEqual([
			{ el: 'rect', attrs: { x: -20, y: -5, width: 40, height: 10 }, paint: 'fill' }
		]);
		expect(footprintShapes('outline', 40, 10)).toEqual([
			{ el: 'rect', attrs: { x: -20, y: -5, width: 40, height: 10 }, paint: 'hit' }
		]);
	});

	it('cuts a port into a wall', () => {
		const fills = footprintShapes('wall-port', 100, 6).filter((s) => s.paint === 'fill');
		expect(fills).toHaveLength(2);
		const right = fills.map((s) => Number(s.attrs.x) + Number(s.attrs.width));
		expect(Math.min(...right)).toBeLessThan(0); // left piece ends before the middle
	});
});
