import type { Point, Size } from '../geometry/types';

/** How far a pointer may move, in px, and still count as a tap rather than a drag. */
export const TAP_SLOP_PX = 4;

export function movedBeyond(a: Point, b: Point, px = TAP_SLOP_PX): boolean {
	return Math.hypot(b.x - a.x, b.y - a.y) > px;
}

/** A pointer (stage px) outside the stage: dropping a dragged item there removes it. */
export function offStage(p: Point, size: Size): boolean {
	return p.x < 0 || p.y < 0 || p.x > size.width || p.y > size.height;
}

/**
 * The remove bin shown at the bottom of the stage during a drag (stage px). On a phone the stage
 * fills the screen, so there is no "off the stage" to drag to; the bin is the target instead.
 * `hit` is wider than the drawn `radius` so a finger needn't land exactly.
 */
export const REMOVE_BIN = { radius: 32, hit: 52, bottom: 72 } as const;

export function removeBinCenter(size: Size): Point {
	return { x: size.width / 2, y: size.height - REMOVE_BIN.bottom };
}

/** A pointer (stage px) over the remove bin: dropping a dragged item there removes it. */
export function overRemoveBin(p: Point, size: Size): boolean {
	const c = removeBinCenter(size);
	return Math.hypot(p.x - c.x, p.y - c.y) < REMOVE_BIN.hit;
}

export type GestureAction =
	| { kind: 'pan'; dx: number; dy: number }
	| { kind: 'pinch'; factor: number; at: Point; dx: number; dy: number };

/**
 * Tracks pointers on empty canvas: one pointer pans, two pinch-zoom about their midpoint.
 * Plain (non-reactive) bookkeeping; the caller applies the returned actions.
 */
export class PointerGestures {
	#pointers = new Map<number, Point>();

	get active(): number {
		return this.#pointers.size;
	}

	down(id: number, p: Point): void {
		this.#pointers.set(id, p);
	}

	up(id: number): void {
		this.#pointers.delete(id);
	}

	move(id: number, p: Point): GestureAction | null {
		const prev = this.#pointers.get(id);
		if (!prev) return null;
		this.#pointers.set(id, p);
		if (this.#pointers.size === 1) return { kind: 'pan', dx: p.x - prev.x, dy: p.y - prev.y };
		if (this.#pointers.size !== 2) return null;
		const other = [...this.#pointers].find(([key]) => key !== id)![1];
		const before = Math.hypot(prev.x - other.x, prev.y - other.y);
		const after = Math.hypot(p.x - other.x, p.y - other.y);
		const at = { x: (prev.x + other.x) / 2, y: (prev.y + other.y) / 2 };
		const mid = { x: (p.x + other.x) / 2, y: (p.y + other.y) / 2 };
		return {
			kind: 'pinch',
			factor: before > 0 ? after / before : 1,
			at,
			dx: mid.x - at.x,
			dy: mid.y - at.y
		};
	}
}
