import type { Point } from '../geometry/types';

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
