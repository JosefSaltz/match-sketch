import { formatNumber, toFeet, type LengthUnit } from './units';

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
