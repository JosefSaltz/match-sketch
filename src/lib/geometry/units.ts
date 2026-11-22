export type LengthUnit = 'ft' | 'yd';

const FEET_PER: Record<LengthUnit, number> = { ft: 1, yd: 3 };

export function toFeet(value: number, unit: LengthUnit): number {
	return value * FEET_PER[unit];
}

export function fromFeet(ft: number, unit: LengthUnit): number {
	return ft / FEET_PER[unit];
}

/** Rounds to one decimal and drops a trailing ".0", e.g. 45 ft in yd -> "15 yd". */
export function formatLength(ft: number, unit: LengthUnit): string {
	return `${formatNumber(fromFeet(ft, unit))} ${unit}`;
}

/** One decimal place at most, no trailing ".0". */
export function formatNumber(value: number): string {
	const rounded = Math.round(value * 10) / 10;
	return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}
