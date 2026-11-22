import { describe, it, expect } from 'vitest';
import { movedBeyond, PointerGestures, TAP_SLOP_PX } from './gestures';

describe('PointerGestures', () => {
	it('pans with one pointer', () => {
		const g = new PointerGestures();
		g.down(1, { x: 10, y: 10 });
		expect(g.move(1, { x: 15, y: 7 })).toEqual({ kind: 'pan', dx: 5, dy: -3 });
	});

	it('pinch-zooms about the midpoint with two pointers', () => {
		const g = new PointerGestures();
		g.down(1, { x: 0, y: 0 });
		g.down(2, { x: 10, y: 0 });
		expect(g.move(2, { x: 20, y: 0 })).toEqual({
			kind: 'pinch',
			factor: 2,
			at: { x: 5, y: 0 },
			dx: 5,
			dy: 0
		});
	});

	it('ignores pointers it is not tracking and forgets released ones', () => {
		const g = new PointerGestures();
		expect(g.move(9, { x: 1, y: 1 })).toBeNull();
		g.down(1, { x: 0, y: 0 });
		g.up(1);
		expect(g.active).toBe(0);
		expect(g.move(1, { x: 5, y: 5 })).toBeNull();
	});
});

describe('movedBeyond', () => {
	it('counts only moves farther than the slop as drags', () => {
		expect(movedBeyond({ x: 0, y: 0 }, { x: 3, y: 0 })).toBe(false);
		expect(movedBeyond({ x: 0, y: 0 }, { x: 4, y: 0 })).toBe(false);
		expect(movedBeyond({ x: 0, y: 0 }, { x: 3, y: 3 })).toBe(true);
		expect(movedBeyond({ x: 0, y: 0 }, { x: 3, y: 0 }, 2)).toBe(true);
		expect(TAP_SLOP_PX).toBe(4);
	});
});
