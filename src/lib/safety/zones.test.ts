import { describe, expect, it } from 'vitest';
import { emptyPlanDocument, type PlanDocument, type PlanObject } from '../model/plan';
import { FAN_SOURCES, FT_PER_M, LAYER_IDS, SPLASH_SOURCES } from './sources';
import {
	FAR_FT,
	NO_DANGER_ZONES,
	dangerZones,
	faceNormal,
	fanZone,
	isFiringPoint,
	isSteel,
	splashZone,
	type DangerToggles
} from './zones';

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
	Math.hypot(a.x - b.x, a.y - b.y);
const deg = (r: number) => (r * 180) / Math.PI;

describe('faceNormal', () => {
	it('points to the shooter and turns clockwise on screen', () => {
		const cases: [number, number, number][] = [
			[0, 0, -1],
			[90, -1, 0],
			[180, 0, 1],
			[270, 1, 0]
		];
		for (const [r, x, y] of cases) {
			const n = faceNormal(r);
			expect(n.x).toBeCloseTo(x, 9);
			expect(n.y).toBeCloseTo(y, 9);
		}
	});
});

describe('splashZone', () => {
	const t = { id: 't', x: 0, y: 0, rotation: 0 };
	it('draws the AR 385-63 wedges on the shooter side', () => {
		const z = splashZone(t, SPLASH_SOURCES['ar385-splash']);
		const r = Math.cos((20 * Math.PI) / 180) * 150;
		const s = Math.sin((20 * Math.PI) / 180) * 150;
		expect(z.right.rayEnd.x).toBeCloseTo(r, 3);
		expect(z.right.rayEnd.y).toBeCloseTo(-s, 3);
		expect(z.left.rayEnd.x).toBeCloseTo(-r, 3);
		expect(z.left.rayEnd.y).toBeCloseTo(-s, 3);
		for (const side of [z.left, z.right]) {
			expect(side.wedge).toHaveLength(22);
			for (const p of side.wedge) {
				expect(dist(p, z.origin)).toBeLessThanOrEqual(150 + 1e-6);
				expect(p.y).toBeLessThanOrEqual(1e-9);
			}
			expect(side.wedge.at(-1)).toEqual(side.rayEnd);
		}
		expect(z.left.beyond).toBeUndefined();
		expect(z.right.beyond).toBeUndefined();
	});
	it('follows the plate rotation', () => {
		const z = splashZone({ ...t, rotation: 90 }, SPLASH_SOURCES['ar385-splash']);
		expect(z.left.rayEnd.x).toBeLessThan(0);
		expect(z.right.rayEnd.x).toBeLessThan(0);
	});
	it('carries the Pistol NZ ray on past the published reach', () => {
		const z = splashZone(t, SPLASH_SOURCES['pnz-splash']);
		for (const side of [z.left, z.right]) {
			expect(dist(side.rayEnd, z.origin)).toBeCloseTo(30 * FT_PER_M, 6);
			expect(side.beyond).toBeDefined();
			expect(dist(side.beyond!, z.origin)).toBeCloseTo(FAR_FT, 3);
			const k = FAR_FT / dist(side.rayEnd, z.origin);
			expect(side.beyond!.x).toBeCloseTo(side.rayEnd.x * k, 3);
			expect(side.beyond!.y).toBeCloseTo(side.rayEnd.y * k, 3);
		}
	});
});

describe('fanZone', () => {
	const F = { id: 'f', x: 0, y: 0 };
	const T = { id: 't', x: 0, y: 30 };
	for (const src of Object.values(FAN_SOURCES)) {
		it(`builds the batwing for ${src.label}`, () => {
			const z = fanZone(F, T, src)!;
			const e = (d: number) => ({
				x: Math.sin((-d * Math.PI) / 180),
				y: Math.cos((d * Math.PI) / 180)
			});
			const eL = e(src.dispersionDeg);
			const outL = { x: -eL.y, y: eL.x };
			const rel = (p: { x: number; y: number }) => ({ x: p.x - F.x, y: p.y - F.y });
			const [, A, B, C] = z.left.outline;
			const along = (p: { x: number; y: number }) => rel(p).x * eL.x + rel(p).y * eL.y;
			const perp = (p: { x: number; y: number }) => rel(p).x * outL.x + rel(p).y * outL.y;
			const tan = (d: number) => Math.tan((d * Math.PI) / 180);
			expect(z.left.outline[0]).toEqual({ x: 0, y: 0 });
			expect(deg(Math.atan2(-A.x, A.y))).toBeCloseTo(src.dispersionDeg + src.pDeg, 6);
			expect(perp(A)).toBeCloseTo(src.wM * FT_PER_M, 6);
			expect(along(A)).toBeCloseTo((src.wM / tan(src.pDeg)) * FT_PER_M, 6);
			expect(perp(B)).toBeCloseTo(src.wM * FT_PER_M, 6);
			expect(along(B)).toBeCloseTo((src.yM - src.wM / tan(src.qDeg)) * FT_PER_M, 6);
			expect(along(C)).toBeCloseTo(src.yM * FT_PER_M, 6);
			expect(perp(C)).toBeCloseTo(0, 6);
			const [dl, dr] = z.dispersion;
			expect(dist(dl, F)).toBeCloseTo(src.xM * FT_PER_M, 6);
			expect(dist(dr, F)).toBeCloseTo(src.xM * FT_PER_M, 6);
			expect(deg(Math.atan2(-dl.x, dl.y))).toBeCloseTo(5, 6);
			expect(deg(Math.atan2(-dr.x, dr.y))).toBeCloseTo(-5, 6);
			for (const p of z.left.outline.slice(1)) expect(p.x).toBeLessThan(0);
			for (const p of z.right.outline.slice(1)) expect(p.x).toBeGreaterThan(0);
		});
	}
	it('returns null when the points coincide', () => {
		expect(fanZone(F, { id: 't', x: 0, y: 0 }, FAN_SOURCES['fan-9mm'])).toBeNull();
	});
});

describe('dangerZones', () => {
	const obj = (id: string, symbolId: string, x: number, y: number, extra = {}): PlanObject => ({
		id,
		symbolId,
		x,
		y,
		rotation: 0,
		z: 0,
		...extra
	});
	const doc: PlanDocument = {
		...emptyPlanDocument(),
		objects: [
			obj('s1', 'steel-static', 10, 40),
			obj('s2', 'popper', 30, 50, { count: 4 }),
			obj('p1', 'paper', 20, 45),
			obj('f1', 'shooting-position', 5, 5),
			obj('f2', 'shooting-box', 25, 5),
			obj('f3', 'shooting-position', 10, 40)
		]
	};
	const on = (...ids: (typeof LAYER_IDS)[number][]): DangerToggles => ({
		...NO_DANGER_ZONES,
		...Object.fromEntries(ids.map((i) => [i, true]))
	});
	const all = on(...LAYER_IDS);
	const keys = (z: ReturnType<typeof dangerZones>) => ({
		splash: z.splash.map((s) => s.key).sort(),
		fans: z.fans.map((f) => f.key).sort()
	});

	it('classifies objects', () => {
		expect(isSteel(doc.objects[0])).toBe(true);
		expect(isSteel(doc.objects[2])).toBe(false);
		expect(isFiringPoint(doc.objects[3])).toBe(true);
		expect(isFiringPoint(doc.objects[4])).toBe(true);
		expect(isFiringPoint(doc.objects[0])).toBe(false);
	});
	it('draws nothing with every toggle off', () => {
		expect(dangerZones(doc, NO_DANGER_ZONES, [])).toEqual({ splash: [], fans: [] });
	});
	it('draws one splash per steel target', () => {
		const z = dangerZones(doc, on('ar385-splash'), []);
		expect(keys(z).splash).toEqual(['ar385-splash:s1', 'ar385-splash:s2']);
		expect(z.fans).toEqual([]);
	});
	it('draws fans for each firing point and steel target, skipping coincident', () => {
		const z = dangerZones(doc, on('fan-9mm'), []);
		expect(keys(z).fans).toEqual(
			['f1:s1', 'f1:s2', 'f2:s1', 'f2:s2', 'f3:s2'].map((k) => `fan-9mm:${k}`)
		);
		expect(z.splash).toEqual([]);
	});
	it('narrows to a selected steel target', () => {
		const z = dangerZones(doc, all, ['s1']);
		expect(keys(z).splash).toEqual(['ar385-splash:s1', 'pnz-splash:s1']);
		expect(z.fans.every((f) => f.targetId === 's1')).toBe(true);
		expect(z.fans.length).toBe(4);
	});
	it('narrows to a selected firing point', () => {
		const z = dangerZones(doc, all, ['f1']);
		expect(z.fans.every((f) => f.firingPointId === 'f1')).toBe(true);
		expect(z.fans.length).toBe(4);
		expect(z.splash.length).toBe(4);
	});
	it('unions a selected target and firing point', () => {
		const z = dangerZones(doc, on('fan-9mm', 'ar385-splash'), ['s1', 'f1']);
		expect(keys(z).fans).toEqual(['f1:s1', 'f1:s2', 'f2:s1'].map((k) => `fan-9mm:${k}`));
		expect(keys(z).splash).toEqual(['ar385-splash:s1', 'ar385-splash:s2']);
	});
	it('draws everything when nothing relevant is selected', () => {
		const z = dangerZones(doc, all, ['p1']);
		expect(z.splash.length).toBe(4);
		expect(z.fans.length).toBe(10);
	});
});
