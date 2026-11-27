import { describe, expect, it } from 'vitest';
import type { Viewport } from '../geometry/viewport';
import { worldToScreen } from '../geometry/viewport';
import { FAN_SOURCES, SPLASH_SOURCES } from './sources';
import {
	bayRect,
	clipPolygon,
	clipPolyline,
	densify,
	exitPoint,
	formatPublished,
	formatPublishedRange,
	toPathData,
	zoneTags
} from './paths';
import { fanZone, splashZone } from './zones';

const r10 = { minX: 0, minY: 0, maxX: 10, maxY: 10 };
const inside = (p: { x: number; y: number }, r = r10) =>
	p.x >= r.minX - 1e-9 && p.x <= r.maxX + 1e-9 && p.y >= r.minY - 1e-9 && p.y <= r.maxY + 1e-9;
const onBoundary = (p: { x: number; y: number }, r: typeof r10) =>
	inside(p, r) &&
	(Math.abs(p.x - r.minX) < 1e-6 ||
		Math.abs(p.x - r.maxX) < 1e-6 ||
		Math.abs(p.y - r.minY) < 1e-6 ||
		Math.abs(p.y - r.maxY) < 1e-6);

describe('bayRect', () => {
	it('spans 0..width and 0..depth', () => {
		expect(bayRect({ widthFt: 60, depthFt: 30 })).toEqual({ minX: 0, minY: 0, maxX: 60, maxY: 30 });
	});
});

describe('clipPolygon', () => {
	it('keeps inside vertices and adds crossings for a half-outside triangle', () => {
		const out = clipPolygon(
			[
				{ x: 2, y: 2 },
				{ x: 8, y: 2 },
				{ x: 5, y: 20 }
			],
			r10
		);
		expect(out.length).toBeGreaterThan(3);
		expect(out.every((p) => inside(p))).toBe(true);
		expect(out).toContainEqual({ x: 2, y: 2 });
		expect(out).toContainEqual({ x: 8, y: 2 });
		expect(out.some((p) => p.y === 10)).toBe(true);
	});
	it('returns [] for a polygon fully outside', () => {
		expect(
			clipPolygon(
				[
					{ x: 20, y: 20 },
					{ x: 30, y: 20 },
					{ x: 25, y: 30 }
				],
				r10
			)
		).toEqual([]);
	});
});

describe('clipPolyline', () => {
	it('returns one piece with ends on the edges for a line crossing twice', () => {
		const pieces = clipPolyline(
			[
				{ x: -5, y: 5 },
				{ x: 15, y: 5 }
			],
			r10
		);
		expect(pieces).toEqual([
			[
				{ x: 0, y: 5 },
				{ x: 10, y: 5 }
			]
		]);
	});
});

describe('exitPoint', () => {
	it('finds where a line leaves the rect', () => {
		expect(
			exitPoint(
				[
					{ x: 5, y: 5 },
					{ x: 5, y: 50 }
				],
				r10
			)
		).toEqual({ x: 5, y: 10 });
	});
	it('is null for a line that starts outside and never enters', () => {
		expect(
			exitPoint(
				[
					{ x: 20, y: 5 },
					{ x: 20, y: 50 }
				],
				r10
			)
		).toBeNull();
	});
	it('is null when the line stays inside', () => {
		expect(
			exitPoint(
				[
					{ x: 1, y: 1 },
					{ x: 9, y: 9 }
				],
				r10
			)
		).toBeNull();
	});
	it('counts a point on the boundary as inside when the next is outside', () => {
		expect(
			exitPoint(
				[
					{ x: 5, y: 10 },
					{ x: 5, y: 20 }
				],
				r10
			)
		).toEqual({ x: 5, y: 10 });
	});
});

describe('densify', () => {
	it('splits a 100 ft segment into 11 collinear points at step 10', () => {
		const out = densify(
			[
				{ x: 0, y: 0 },
				{ x: 0, y: 100 }
			],
			10
		);
		expect(out).toHaveLength(11);
		expect(out.every((p) => p.x === 0)).toBe(true);
		expect(out[10]).toEqual({ x: 0, y: 100 });
	});
	it('also splits the closing segment of a closed ring without repeating the start', () => {
		const out = densify(
			[
				{ x: 0, y: 0 },
				{ x: 10, y: 0 },
				{ x: 10, y: 10 }
			],
			5,
			true
		);
		expect(out).toHaveLength(7);
		expect(out[0]).toEqual({ x: 0, y: 0 });
	});
});

describe('toPathData through a scale break', () => {
	const vp: Viewport = {
		scale: 2,
		offsetX: 10,
		offsetY: 700,
		depth: { fromFt: 90, toFt: 300, drawnFt: 75 }
	};
	it('stays finite and ends where worldToScreen puts the last point', () => {
		const pts = densify(
			[
				{ x: 10, y: 0 },
				{ x: 10, y: 300 }
			],
			10
		);
		const d = toPathData(pts, vp, false);
		const nums = d.match(/-?\d+(\.\d+)?/g)!.map(Number);
		expect(nums.every(Number.isFinite)).toBe(true);
		expect(d.startsWith('M')).toBe(true);
		const last = worldToScreen({ x: 10, y: 300 }, vp);
		expect(nums.slice(-2)).toEqual([last.x, last.y].map((v) => Number(v.toFixed(2))));
	});
	it('closes with Z when closed', () => {
		expect(
			toPathData(
				[
					{ x: 0, y: 0 },
					{ x: 1, y: 0 },
					{ x: 1, y: 1 }
				],
				{ scale: 1, offsetX: 0, offsetY: 0 },
				true
			)
		).toMatch(/Z$/);
	});
});

describe('formatPublished', () => {
	it('shows the plan unit rounded, then the source meters', () => {
		expect(formatPublished(45.72, 'yd')).toBe('50 yd (45.72 m)');
		expect(formatPublished(45.72, 'ft')).toBe('150 ft (45.72 m)');
		expect(formatPublished(1800, 'yd')).toBe('1,969 yd (1,800 m)');
	});
	it('formats a range', () => {
		expect(formatPublishedRange(25, 30, 'yd')).toBe('≥ 27–33 yd (25–30 m)');
	});
});

describe('zoneTags', () => {
	it('tags two ricochet sides and two dispersion edges of a 9mm fan', () => {
		const bay = { widthFt: 60, depthFt: 30 };
		const r = bayRect(bay);
		const fan = fanZone(
			{ id: 'f', x: 30, y: 2 },
			{ id: 't', x: 30, y: 25 },
			FAN_SOURCES['fan-9mm']
		)!;
		const tags = zoneTags({ splash: [], fans: [fan] }, r, 'yd');
		const ric = tags.filter((t) => t.text.startsWith('W '));
		const disp = tags.filter((t) => t.text.startsWith('X '));
		expect(ric).toHaveLength(2);
		expect(disp).toHaveLength(2);
		expect(tags).toHaveLength(4);
		for (const t of ric) expect(t.text).toBe('W 436 yd (399 m) · Y 1,324 yd (1,211 m)');
		for (const t of disp) expect(t.text).toBe('X 1,969 yd (1,800 m)');
		for (const t of tags) expect(onBoundary(t.at, r)).toBe(true);
		expect(new Set(tags.map((t) => t.key)).size).toBe(4);
	});
	it('has no tags for an AR splash whose rays stay in a big bay', () => {
		const z = splashZone({ id: 'a', x: 200, y: 200, rotation: 0 }, SPLASH_SOURCES['ar385-splash']);
		expect(
			zoneTags({ splash: [z], fans: [] }, bayRect({ widthFt: 400, depthFt: 400 }), 'yd')
		).toEqual([]);
	});
	it('tags a Pistol NZ ray with the range at the bay edge', () => {
		const z = splashZone({ id: 'p', x: 30, y: 15, rotation: 0 }, SPLASH_SOURCES['pnz-splash']);
		const r = bayRect({ widthFt: 60, depthFt: 30 });
		const tags = zoneTags({ splash: [z], fans: [] }, r, 'yd');
		expect(tags.length).toBeGreaterThan(0);
		for (const t of tags) {
			expect(t.text).toBe('≥ 27–33 yd (25–30 m)');
			expect(onBoundary(t.at, r)).toBe(true);
		}
	});
});
