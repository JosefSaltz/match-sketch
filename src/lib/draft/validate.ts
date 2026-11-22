import { getEntry } from '../catalog';
import type { DraftPlacement, Placement } from './contract';

export const MAX_PLACEMENTS = 200;
const MIN_FOOTPRINT_FT = 0.5;
const MAX_FOOTPRINT_FT = 200;
const MAX_LABEL = 24;

export type PlacementProblem = { index: number; reason: string };

/**
 * Checks each placement against the catalog and the bay (spec §7.5 step 4) and normalises what
 * it can: rotation into [0, 360), counts clamped to 1–99, footprint sizes from the catalog.
 */
export function validatePlacements(
	placements: DraftPlacement[],
	canvas: { widthFt: number; depthFt: number }
): { valid: Placement[]; problems: PlacementProblem[] } {
	const valid: Placement[] = [];
	const problems: PlacementProblem[] = [];
	const labels = new Set<string>();
	placements.forEach((p, index) => {
		const fail = (reason: string) => problems.push({ index, reason });
		if (index >= MAX_PLACEMENTS) return fail(`more than ${MAX_PLACEMENTS} placements`);
		const entry = getEntry(p.symbolId);
		if (!entry) return fail(`unknown symbol "${p.symbolId}"`);
		if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return fail('position is not a number');
		if (p.x < 0 || p.x > canvas.widthFt || p.y < 0 || p.y > canvas.depthFt) {
			return fail(
				`(${p.x}, ${p.y}) is outside the bay (0–${canvas.widthFt} ft across, 0–${canvas.depthFt} ft deep)`
			);
		}
		if (p.count !== null && p.count !== 1 && !entry.countable) {
			return fail(`only targets have a count; "${p.symbolId}" is not a target`);
		}
		const label = p.label?.trim() ?? '';
		if (label.length > MAX_LABEL)
			return fail(`label "${label}" is longer than ${MAX_LABEL} characters`);
		if (label && labels.has(label)) return fail(`label "${label}" is used twice`);
		const placement: Placement = {
			symbolId: p.symbolId,
			x: p.x,
			y: p.y,
			rotation: ((p.rotation % 360) + 360) % 360 || 0
		};
		if (entry.kind === 'footprint') {
			const widthFt = p.widthFt ?? entry.footprint.widthFt;
			const depthFt = p.depthFt ?? entry.footprint.depthFt;
			const sane = (v: number) =>
				Number.isFinite(v) && v >= MIN_FOOTPRINT_FT && v <= MAX_FOOTPRINT_FT;
			if (!sane(widthFt) || !sane(depthFt)) {
				return fail(
					`size ${widthFt} × ${depthFt} ft is not between ${MIN_FOOTPRINT_FT} and ${MAX_FOOTPRINT_FT} ft`
				);
			}
			placement.widthFt = widthFt;
			placement.depthFt = depthFt;
		}
		if (entry.countable && p.count !== null && p.count > 1) {
			placement.count = Math.min(99, Math.round(p.count));
		}
		if (label) {
			labels.add(label);
			placement.label = label;
		}
		valid.push(placement);
	});
	return { valid, problems };
}
