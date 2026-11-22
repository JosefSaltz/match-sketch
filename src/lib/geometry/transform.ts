import { snapValue } from './snap';
import type { Point } from './types';

export type Corner = 'ne' | 'nw' | 'se' | 'sw';

/** A footprint object: center position, rotation (deg clockwise as displayed), size in ft. */
export type FootprintBox = {
	x: number;
	y: number;
	rotation: number;
	widthFt: number;
	depthFt: number;
};

const RAD = Math.PI / 180;

/** Rotates a world vector clockwise as displayed (downrange is up on screen). */
export function rotateWorld(v: Point, deg: number): Point {
	const c = Math.cos(deg * RAD);
	const s = Math.sin(deg * RAD);
	return { x: v.x * c + v.y * s, y: -v.x * s + v.y * c };
}

export function normalizeDegrees(deg: number): number {
	const n = ((deg % 360) + 360) % 360;
	return n === 0 ? 0 : n; // avoid -0
}

/** Rotation that points an object's "up" from `center` toward `pointer`; 0 = downrange. */
export function angleFromPointer(center: Point, pointer: Point, snapDeg: number | null): number {
	const deg = Math.atan2(pointer.x - center.x, pointer.y - center.y) / RAD;
	const snapped = snapDeg === null ? deg : Math.round(deg / snapDeg) * snapDeg;
	return normalizeDegrees(snapped);
}

const CORNER_SIGNS: Record<Corner, { sx: 1 | -1; sy: 1 | -1 }> = {
	ne: { sx: 1, sy: 1 },
	nw: { sx: -1, sy: 1 },
	se: { sx: 1, sy: -1 },
	sw: { sx: -1, sy: -1 }
};

/**
 * Resizes a footprint by dragging one corner while the opposite corner stays fixed.
 * Width runs along the object's local x (right at rotation 0), depth along local y
 * (downrange at rotation 0). Sizes snap to `step` and never drop below `minFt`.
 */
export function resizeFromCorner(
	box: FootprintBox,
	corner: Corner,
	pointer: Point,
	step: number | null,
	minFt = 0.5
): Pick<FootprintBox, 'x' | 'y' | 'widthFt' | 'depthFt'> {
	const { sx, sy } = CORNER_SIGNS[corner];
	const ux = rotateWorld({ x: 1, y: 0 }, box.rotation);
	const uy = rotateWorld({ x: 0, y: 1 }, box.rotation);
	const fixed = {
		x: box.x - sx * (box.widthFt / 2) * ux.x - sy * (box.depthFt / 2) * uy.x,
		y: box.y - sx * (box.widthFt / 2) * ux.y - sy * (box.depthFt / 2) * uy.y
	};
	const v = { x: pointer.x - fixed.x, y: pointer.y - fixed.y };
	const along = (u: Point) => v.x * u.x + v.y * u.y;
	const widthFt = Math.max(minFt, snapValue(sx * along(ux), step));
	const depthFt = Math.max(minFt, snapValue(sy * along(uy), step));
	return {
		x: fixed.x + sx * (widthFt / 2) * ux.x + sy * (depthFt / 2) * uy.x,
		y: fixed.y + sx * (widthFt / 2) * ux.y + sy * (depthFt / 2) * uy.y,
		widthFt,
		depthFt
	};
}
