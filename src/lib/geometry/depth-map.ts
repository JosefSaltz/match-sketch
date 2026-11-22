import type { ScaleBreak } from '../model/plan';

/**
 * A scale break (spec §7.4, variant C): true depth from `fromFt` to `toFt` (the end of the bay)
 * is drawn as `drawnFt` of depth. Data always stays in true feet; only drawing goes through this.
 */
export type DepthMap = { fromFt: number; toFt: number; drawnFt: number };

/** How deep the squeezed strip is drawn: 25 yd, or less for a shorter far zone. */
export const SQUEEZED_DRAWN_FT = 75;

/** The plan's break as a depth map, or `null` when there is none (or it can't apply). */
export function depthMapFor(breaks: ScaleBreak[], depthFt: number): DepthMap | null {
	const b = breaks[0];
	if (!b || !(b.fromFt > 0) || !(b.fromFt < depthFt)) return null;
	return {
		fromFt: b.fromFt,
		toFt: depthFt,
		drawnFt: Math.min(SQUEEZED_DRAWN_FT, depthFt - b.fromFt)
	};
}

/** True depth → drawn depth. */
export function toDrawn(y: number, map: DepthMap | null): number {
	if (!map || y <= map.fromFt) return y;
	return map.fromFt + ((y - map.fromFt) * map.drawnFt) / (map.toFt - map.fromFt);
}

/** Drawn depth → true depth (the inverse of `toDrawn`). */
export function toTrue(d: number, map: DepthMap | null): number {
	if (!map || d <= map.fromFt) return d;
	return map.fromFt + ((d - map.fromFt) * (map.toFt - map.fromFt)) / map.drawnFt;
}
