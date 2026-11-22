import type { CatalogEntry } from '../catalog/index';
import type { PlanObject } from '../model/plan';

/** An axis-aligned box in screen px. */
export type Rect = { x: number; y: number; width: number; height: number };

/**
 * The object's drawn box in screen px, relative to its screen position and before rotation.
 * Symbols are `symbolPx` square: above the point when anchored at the base, centered otherwise.
 * Footprints are drawn to scale around their center.
 */
export function localBox(
	obj: PlanObject,
	entry: CatalogEntry | undefined,
	scale: number,
	symbolPx: number
): Rect {
	if (entry?.kind === 'footprint') {
		const width = (obj.widthFt ?? entry.footprint.widthFt) * scale;
		const height = (obj.depthFt ?? entry.footprint.depthFt) * scale;
		return { x: -width / 2, y: -height / 2, width, height };
	}
	const s = symbolPx;
	return { x: -s / 2, y: entry?.anchor === 'base' ? -s : -s / 2, width: s, height: s };
}

/** Axis-aligned bounds of `box` after rotating it `deg` clockwise (on screen) about the origin. */
export function rotatedBounds(box: Rect, deg: number): Rect {
	const rad = (deg * Math.PI) / 180;
	const c = Math.cos(rad);
	const s = Math.sin(rad);
	const xs: number[] = [];
	const ys: number[] = [];
	for (const [x, y] of [
		[box.x, box.y],
		[box.x + box.width, box.y],
		[box.x, box.y + box.height],
		[box.x + box.width, box.y + box.height]
	]) {
		xs.push(x * c - y * s);
		ys.push(x * s + y * c);
	}
	const x = Math.min(...xs);
	const y = Math.min(...ys);
	return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}
