import { toDrawn, toTrue, type DepthMap } from './depth-map';
import type { CanvasSize, Point, Size } from './types';

/**
 * `scale` is screen px per world ft. `offsetX`/`offsetY` are the screen position of the world
 * origin (the bay's uprange-left corner). World y grows downrange, which is drawn upward.
 * `depth`, when set, is the plan's scale break: depth is drawn through it (true feet in data).
 */
export type Viewport = { scale: number; offsetX: number; offsetY: number; depth?: DepthMap | null };

export const ZOOM_LIMITS = { min: 0.05, max: 200 };

/**
 * Zoom limits for a bay that fits at `fitScale` px/ft: the defaults, widened so a tiny bay can
 * still zoom in (to 8× its fit) and a huge one can still zoom out (to ¼ of its fit).
 */
export function zoomLimitsFor(fitScale: number): { min: number; max: number } {
	return {
		min: Math.min(ZOOM_LIMITS.min, fitScale / 4),
		max: Math.max(ZOOM_LIMITS.max, fitScale * 8)
	};
}

export function worldToScreen(p: Point, vp: Viewport): Point {
	return {
		x: vp.offsetX + p.x * vp.scale,
		y: vp.offsetY - toDrawn(p.y, vp.depth ?? null) * vp.scale
	};
}

export function screenToWorld(p: Point, vp: Viewport): Point {
	return {
		x: (p.x - vp.offsetX) / vp.scale,
		y: toTrue((vp.offsetY - p.y) / vp.scale, vp.depth ?? null)
	};
}

/** Largest scale that fits the whole bay (its drawn depth, with a break) in the padded screen. */
export function fitViewport(
	canvas: CanvasSize,
	screen: Size,
	paddingPx = 48,
	depth: DepthMap | null = null
): Viewport {
	const availW = Math.max(screen.width - paddingPx * 2, 1);
	const availH = Math.max(screen.height - paddingPx * 2, 1);
	const drawnDepth = toDrawn(canvas.depthFt, depth);
	const scale = Math.min(availW / canvas.widthFt, availH / drawnDepth);
	const vp: Viewport = {
		scale,
		offsetX: (screen.width - canvas.widthFt * scale) / 2,
		offsetY: (screen.height + drawnDepth * scale) / 2
	};
	if (depth) vp.depth = depth;
	return vp;
}

/** Zooms by `factor` about `screenPt`, keeping the world point under it fixed. */
export function zoomAt(
	vp: Viewport,
	screenPt: Point,
	factor: number,
	limits = ZOOM_LIMITS
): Viewport {
	const scale = Math.min(limits.max, Math.max(limits.min, vp.scale * factor));
	const world = screenToWorld(screenPt, vp);
	return {
		...vp,
		scale,
		offsetX: screenPt.x - world.x * scale,
		offsetY: screenPt.y + toDrawn(world.y, vp.depth ?? null) * scale
	};
}
