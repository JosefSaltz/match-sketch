import { describe, it, expect } from 'vitest';
import {
	movedBeyond,
	offStage,
	overRemoveBin,
	PointerGestures,
	REMOVE_BIN,
	removeBinCenter,
	TAP_SLOP_PX
} from './gestures';

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

describe('offStage', () => {
	const size = { width: 800, height: 600 };
	it('is false anywhere on the stage, edges included', () => {
		expect(offStage({ x: 0, y: 0 }, size)).toBe(false);
		expect(offStage({ x: 400, y: 300 }, size)).toBe(false);
		expect(offStage({ x: 800, y: 600 }, size)).toBe(false);
	});
	it('is true once the pointer leaves the stage on any side', () => {
		expect(offStage({ x: -1, y: 300 }, size)).toBe(true);
		expect(offStage({ x: 801, y: 300 }, size)).toBe(true);
		expect(offStage({ x: 400, y: -1 }, size)).toBe(true);
		expect(offStage({ x: 400, y: 601 }, size)).toBe(true);
	});
});

describe('overRemoveBin', () => {
	const size = { width: 400, height: 800 };
	const c = removeBinCenter(size);

	it('sits centred near the bottom of the stage', () => {
		expect(c).toEqual({ x: 200, y: 800 - REMOVE_BIN.bottom });
	});

	it('is true over the bin and a little around it, for a finger', () => {
		expect(overRemoveBin(c, size)).toBe(true);
		expect(overRemoveBin({ x: c.x + REMOVE_BIN.hit - 1, y: c.y }, size)).toBe(true);
	});

	it('is false away from the bin', () => {
		expect(overRemoveBin({ x: c.x + REMOVE_BIN.hit + 1, y: c.y }, size)).toBe(false);
		expect(overRemoveBin({ x: 200, y: 100 }, size)).toBe(false);
	});
});
