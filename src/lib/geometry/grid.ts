import type { CanvasSize, Size } from './types';
import { formatNumber, toFeet, type LengthUnit } from './units';
import { screenToWorld, type Viewport } from './viewport';

const GRID_MULTIPLIERS = [1, 5, 10, 50, 100, 500, 1000];
const NICE_LENGTHS = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000];
const EPSILON = 1e-9;

/**
 * World spacing (ft) between grid lines: the base step, coarsened until lines are at least
 * `minPx` apart on screen. Keeps very large bays from drawing thousands of lines.
 */
export function gridSpacing(baseFt: number, pxPerFt: number, minPx = 8): number {
	for (const m of GRID_MULTIPLIERS) {
		const spacing = baseFt * m;
		if (spacing * pxPerFt >= minPx - EPSILON) return spacing;
	}
	return baseFt * GRID_MULTIPLIERS[GRID_MULTIPLIERS.length - 1];
}

/** The largest round length (in display units) whose bar fits within `maxPx`. */
export function scaleBar(
	pxPerFt: number,
	unit: LengthUnit,
	maxPx = 120
): { lengthFt: number; label: string; px: number } {
	let chosen = NICE_LENGTHS[0];
	for (const length of NICE_LENGTHS) {
		if (toFeet(length, unit) * pxPerFt <= maxPx + EPSILON) chosen = length;
	}
	const lengthFt = toFeet(chosen, unit);
	return {
		lengthFt,
		label: `${formatNumber(chosen)} ${unit}`,
		px: Math.round(lengthFt * pxPerFt * 100) / 100
	};
}

/** Multiples of `spacingFt` strictly inside the bay and within the visible screen area. */
export function visibleGridLines(
	canvas: CanvasSize,
	vp: Viewport,
	screen: Size,
	spacingFt: number
): { xs: number[]; ys: number[] } {
	const topLeft = screenToWorld({ x: 0, y: 0 }, vp);
	const bottomRight = screenToWorld({ x: screen.width, y: screen.height }, vp);
	const along = (lo: number, hi: number, limit: number) => {
		const out: number[] = [];
		const start = Math.max(spacingFt, Math.ceil(Math.max(lo, 0) / spacingFt) * spacingFt);
		for (let v = start; v < limit - EPSILON && v <= hi + EPSILON; v += spacingFt) out.push(v);
		return out;
	};
	return {
		xs: along(topLeft.x, bottomRight.x, canvas.widthFt),
		ys: along(bottomRight.y, topLeft.y, canvas.depthFt)
	};
}
