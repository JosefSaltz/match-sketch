import type { CanvasSize, Point, Size } from './types';

/**
 * `scale` is screen px per world ft. `offsetX`/`offsetY` are the screen position of the world
 * origin (the bay's uprange-left corner). World y grows downrange, which is drawn upward.
 */
export type Viewport = { scale: number; offsetX: number; offsetY: number };

export const ZOOM_LIMITS = { min: 0.05, max: 200 };

export function worldToScreen(p: Point, vp: Viewport): Point {
	return { x: vp.offsetX + p.x * vp.scale, y: vp.offsetY - p.y * vp.scale };
}

export function screenToWorld(p: Point, vp: Viewport): Point {
	return { x: (p.x - vp.offsetX) / vp.scale, y: (vp.offsetY - p.y) / vp.scale };
}

/** Largest scale that fits the whole bay inside the padded screen, centered. */
export function fitViewport(canvas: CanvasSize, screen: Size, paddingPx = 48): Viewport {
	const availW = Math.max(screen.width - paddingPx * 2, 1);
	const availH = Math.max(screen.height - paddingPx * 2, 1);
	const scale = Math.min(availW / canvas.widthFt, availH / canvas.depthFt);
	return {
		scale,
		offsetX: (screen.width - canvas.widthFt * scale) / 2,
		offsetY: (screen.height + canvas.depthFt * scale) / 2
	};
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
	return { scale, offsetX: screenPt.x - world.x * scale, offsetY: screenPt.y + world.y * scale };
}
