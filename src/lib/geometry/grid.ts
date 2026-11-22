import type { CanvasSize, Size } from './types';
import { formatNumber, toFeet, type LengthUnit } from './units';
import { screenToWorld, type Viewport } from './viewport';

const GRID_MULTIPLIERS = [1, 5, 10, 50, 100, 500, 1000];
// Sub-unit lengths keep the bar short on tiny bays and at high zoom.
const NICE_LENGTHS = [
	0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000
];
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
		label: `${chosen < 1 ? String(chosen) : formatNumber(chosen)} ${unit}`,
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

/** How the stage's grid is drawn: off, the fine grid that follows Snap, or guides every N ft. */
export type GridChoice = 'off' | 'fine' | number;

export function gridChoice(display: { showGrid: boolean; gridFt?: number }): GridChoice {
	if (!display.showGrid) return 'off';
	return display.gridFt ?? 'fine';
}

const GUIDE_STEPS = [5, 10, 25, 50];

/** Guide spacings offered for a plan's unit: every 5, 10, 25 or 50 of it. */
export function guideOptions(unit: LengthUnit): { ft: number; label: string }[] {
	return GUIDE_STEPS.map((v) => ({ ft: toFeet(v, unit), label: `Every ${v} ${unit}` }));
}
