/** Danger zone geometry in true feet. Pure: no Svelte, no DOM. Spec §3.2 and §4. */
import { getEntry } from '../catalog';
import type { Point } from '../geometry/types';
import type { PlanDocument, PlanObject } from '../model/plan';
import {
	FAN_SOURCES,
	FT_PER_M,
	LAYER_IDS,
	SPLASH_SOURCES,
	type FanSource,
	type FanSourceId,
	type LayerId,
	type SplashSource,
	type SplashSourceId
} from './sources';

export type DangerToggles = Record<LayerId, boolean>;
export const NO_DANGER_ZONES: DangerToggles = {
	'ar385-splash': false,
	'pnz-splash': false,
	'fan-9mm': false,
	'fan-556': false
};
export const FIRING_POINT_IDS: readonly string[] = ['shooting-position', 'shooting-box'];

export type SplashSide = {
	/** Closed polygon: the origin, then an arc from the face line to the 20° ray at reach. */
	wedge: Point[];
	/** End of the 20° ray at the published reach. */
	rayEnd: Point;
	/** 'minimum' sources only: the same ray carried on far past any bay (FAR_FT), drawn dashed. */
	beyond?: Point;
};
export type SplashZone = {
	key: string;
	sourceId: SplashSourceId;
	objectId: string;
	origin: Point;
	left: SplashSide;
	right: SplashSide;
};
export type FanSide = {
	/** Open outline F → A → B → C (spec §3.2). */
	outline: [Point, Point, Point, Point];
};
export type FanZone = {
	key: string;
	sourceId: FanSourceId;
	firingPointId: string;
	targetId: string;
	origin: Point;
	/** Ends of the two dispersion edges at Distance X. */
	dispersion: [Point, Point];
	left: FanSide;
	right: FanSide;
};
export type ZoneSet = { splash: SplashZone[]; fans: FanZone[] };

export const FAR_FT = 20_000;

const rad = (d: number) => (d * Math.PI) / 180;

/** Unit normal of a plate's face, pointing to the shooter: (0, −1) at 0°, turning clockwise. */
export function faceNormal(rotationDeg: number): Point {
	const r = rad(rotationDeg);
	return { x: -Math.sin(r), y: -Math.cos(r) };
}

const at = (o: Point, d: Point, len: number): Point => ({ x: o.x + d.x * len, y: o.y + d.y * len });

export function splashZone(
	target: Pick<PlanObject, 'id' | 'x' | 'y' | 'rotation'>,
	src: SplashSource
): SplashZone {
	const origin = { x: target.x, y: target.y };
	const n = faceNormal(target.rotation);
	const r = rad(target.rotation);
	const u = { x: Math.cos(r), y: -Math.sin(r) };
	const reach = src.reachM * FT_PER_M;
	const side = (sign: 1 | -1): SplashSide => {
		const dir = (a: number): Point => ({
			x: Math.cos(rad(a)) * sign * u.x + Math.sin(rad(a)) * n.x,
			y: Math.cos(rad(a)) * sign * u.y + Math.sin(rad(a)) * n.y
		});
		const wedge: Point[] = [origin];
		for (let a = 0; a < src.angleDeg; a++) wedge.push(at(origin, dir(a), reach));
		const rayEnd = at(origin, dir(src.angleDeg), reach);
		wedge.push(rayEnd);
		const out: SplashSide = { wedge, rayEnd };
		if (src.reachKind === 'minimum') out.beyond = at(origin, dir(src.angleDeg), FAR_FT);
		return out;
	};
	return {
		key: `${src.id}:${target.id}`,
		sourceId: src.id,
		objectId: target.id,
		origin,
		left: side(-1),
		right: side(1)
	};
}

export function fanZone(
	firing: Pick<PlanObject, 'id' | 'x' | 'y'>,
	target: Pick<PlanObject, 'id' | 'x' | 'y'>,
	src: FanSource
): FanZone | null {
	const dx = target.x - firing.x;
	const dy = target.y - firing.y;
	const len = Math.hypot(dx, dy);
	if (len === 0) return null;
	const g = { x: dx / len, y: dy / len };
	const origin = { x: firing.x, y: firing.y };
	const rot = (v: Point, deg: number): Point => ({
		x: v.x * Math.cos(rad(deg)) - v.y * Math.sin(rad(deg)),
		y: v.x * Math.sin(rad(deg)) + v.y * Math.cos(rad(deg))
	});
	const ft = (m: number) => m * FT_PER_M;
	const tan = (d: number) => Math.tan(rad(d));
	const side = (sign: 1 | -1) => {
		const e = rot(g, sign * src.dispersionDeg);
		const out = rot(e, sign * 90);
		const w = ft(src.wM);
		const A = at(at(origin, e, ft(src.wM / tan(src.pDeg))), out, w);
		const B = at(at(origin, e, ft(src.yM - src.wM / tan(src.qDeg))), out, w);
		const C = at(origin, e, ft(src.yM));
		return { end: at(origin, e, ft(src.xM)), outline: [origin, A, B, C] as FanSide['outline'] };
	};
	const left = side(1);
	const right = side(-1);
	return {
		key: `${src.id}:${firing.id}:${target.id}`,
		sourceId: src.id,
		firingPointId: firing.id,
		targetId: target.id,
		origin,
		dispersion: [left.end, right.end],
		left: { outline: left.outline },
		right: { outline: right.outline }
	};
}

export function isSteel(obj: PlanObject): boolean {
	return getEntry(obj.symbolId)?.steel === true;
}

export function isFiringPoint(obj: PlanObject): boolean {
	return FIRING_POINT_IDS.includes(obj.symbolId);
}

/** Spec §4.3: with no steel target or firing point selected draw all, else the union per selected. */
export function dangerZones(
	doc: PlanDocument,
	toggles: DangerToggles,
	selection: readonly string[]
): ZoneSet {
	const targets = doc.objects.filter(isSteel);
	const firings = doc.objects.filter(isFiringPoint);
	const selected = new Set(selection);
	const selTargets = new Set(targets.filter((t) => selected.has(t.id)).map((t) => t.id));
	const selFirings = new Set(firings.filter((f) => selected.has(f.id)).map((f) => f.id));
	const all = selTargets.size === 0 && selFirings.size === 0;

	const splash: SplashZone[] = [];
	const fans: FanZone[] = [];
	for (const id of LAYER_IDS) {
		if (!toggles[id]) continue;
		if (id in SPLASH_SOURCES) {
			const src = SPLASH_SOURCES[id as SplashSourceId];
			for (const t of targets) {
				if (all || selTargets.has(t.id) || selFirings.size > 0) splash.push(splashZone(t, src));
			}
		} else {
			const src = FAN_SOURCES[id as FanSourceId];
			for (const f of firings) {
				for (const t of targets) {
					if (!all && !selFirings.has(f.id) && !selTargets.has(t.id)) continue;
					const z = fanZone(f, t, src);
					if (z) fans.push(z);
				}
			}
		}
	}
	return { splash, fans };
}
