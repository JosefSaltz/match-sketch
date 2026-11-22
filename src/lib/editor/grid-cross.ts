import type { GridChoice } from '../geometry/grid';
import type { Point } from '../geometry/types';

/** The grid point nearest `p` at `stepFt` spacing, as a key that changes when a line is crossed. */
export function gridCell(p: Point, stepFt: number): string {
	return `${Math.round(p.x / stepFt)}:${Math.round(p.y / stepFt)}`;
}

/**
 * How far apart drag clicks are: every snap step when Snap is on, otherwise the grid lines on
 * screen (the fine grid's spacing, or the guides); no clicks with neither.
 */
export function clickStepFt(o: {
	snapFt: number | null;
	grid: GridChoice;
	fineFt: number;
}): number | null {
	if (o.snapFt) return o.snapFt;
	if (o.grid === 'off') return null;
	return o.grid === 'fine' ? o.fineFt : o.grid;
}
