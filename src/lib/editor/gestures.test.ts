import { describe, it, expect } from 'vitest';
import { PointerGestures } from './gestures';

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
