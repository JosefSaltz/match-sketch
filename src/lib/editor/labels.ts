import type { CatalogEntry } from '../catalog/index';
import type { PlanObject } from '../model/plan';

/** A, B, …, Z, AA, AB, … (bijective base 26). */
function lettersToNumber(s: string): number | null {
	if (!/^[A-Z]+$/.test(s)) return null;
	let n = 0;
	for (const ch of s) n = n * 26 + (ch.charCodeAt(0) - 64);
	return n;
}

function numberToLetters(n: number): string {
	let s = '';
	while (n > 0) {
		const r = (n - 1) % 26;
		s = String.fromCharCode(65 + r) + s;
		n = Math.floor((n - 1) / 26);
	}
	return s;
}

/**
 * Next label in an entry's auto-label series (e.g. SA-4 after SA-1 and SA-3; C after A and B).
 * Uses the highest existing value + 1 among objects of the same symbol. Undefined if the entry
 * has no auto label.
 */
export function nextLabel(objects: PlanObject[], entry: CatalogEntry): string | undefined {
	const auto = entry.autoLabel;
	if (!auto) return undefined;
	let max = 0;
	for (const o of objects) {
		if (o.symbolId !== entry.id || !o.label?.startsWith(auto.prefix)) continue;
		const rest = o.label.slice(auto.prefix.length);
		const n =
			auto.style === 'number' ? (/^\d+$/.test(rest) ? Number(rest) : null) : lettersToNumber(rest);
		if (n !== null && n > max) max = n;
	}
	const next = max + 1;
	return auto.prefix + (auto.style === 'number' ? String(next) : numberToLetters(next));
}
