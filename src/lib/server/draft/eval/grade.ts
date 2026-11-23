import { getEntry } from '../../../catalog';
import type { DraftResult, Placement } from '../../../draft/contract';
import { minSpacingFt } from '../../../draft/spacing';
import type { EvalCase } from './cases';

/** Target symbols that stand for the same thing in a stage's TARGETS line. */
const SAME_AS: Record<string, string> = {
	'popper-static': 'popper',
	'popper-trigger': 'popper',
	'popper-auto-reset': 'popper',
	'paper-hard-cover': 'paper'
};
const kindOf = (symbolId: string) => SAME_AS[symbolId] ?? symbolId;

export type Grade = {
	score: number;
	checks: {
		/** Share of the expected target types present. */
		targetTypes: number;
		/** Share of the expected target types whose count is within one of the brief. */
		targetCounts: number;
		/** Share of the labels the procedure names that appear on objects. */
		labels: number;
		targetsDownrange: boolean;
		onBay: boolean;
		noOverlap: boolean;
	};
};

function tally(objects: Placement[]): Map<string, number> {
	const counts = new Map<string, number>();
	for (const o of objects) {
		if (getEntry(o.symbolId)?.category !== 'target') continue;
		const kind = kindOf(o.symbolId);
		counts.set(kind, (counts.get(kind) ?? 0) + (o.count ?? 1));
	}
	return counts;
}

/**
 * Grades a draft on the spec's eval criteria (§7.5): right symbols, right counts, labels that
 * match the procedure, targets downrange of the shooting areas, nothing off the bay, and no
 * fixed-size symbols overlapping at print scale. The score is the mean of the six checks.
 */
export function gradeDraft(c: EvalCase, result: DraftResult): Grade {
	const counts = tally(result.objects);
	const expected = Object.entries(c.targets);
	const targetTypes = expected.filter(([kind]) => counts.has(kind)).length / expected.length;
	const targetCounts =
		expected.filter(([kind, n]) => Math.abs((counts.get(kind) ?? 0) - n) <= 1).length /
		expected.length;
	const present = new Set(result.objects.map((o) => o.label).filter(Boolean));
	const labels = c.labels.length
		? c.labels.filter((l) => present.has(l)).length / c.labels.length
		: 1;

	const areas = result.objects.filter((o) => o.label && /^SA-\d+$/.test(o.label));
	const targets = result.objects.filter((o) => getEntry(o.symbolId)?.category === 'target');
	const mean = (os: Placement[]) => os.reduce((s, o) => s + o.y, 0) / os.length;
	const targetsDownrange =
		areas.length === 0 || targets.length === 0 || mean(targets) > mean(areas);

	const spacing = minSpacingFt(c.request.canvas, c.request.symbolSize);
	const fixed = result.objects.filter((o) => getEntry(o.symbolId)?.kind === 'symbol');
	let overlaps = 0;
	for (let i = 0; i < fixed.length; i++) {
		for (let j = i + 1; j < fixed.length; j++) {
			if (Math.hypot(fixed[i].x - fixed[j].x, fixed[i].y - fixed[j].y) < spacing) overlaps++;
		}
	}

	const checks = {
		targetTypes,
		targetCounts,
		labels,
		targetsDownrange,
		onBay: result.dropped.length === 0 && result.status !== 'failed',
		noOverlap: overlaps === 0
	};
	const parts = [
		targetTypes,
		targetCounts,
		labels,
		Number(targetsDownrange),
		Number(checks.onBay),
		Number(checks.noOverlap)
	];
	// A draft that never came back drew nothing; checks that pass on nothing don't count.
	const usable = result.status !== 'failed' && result.status !== 'refused';
	return { score: usable ? parts.reduce((s, p) => s + p, 0) / parts.length : 0, checks };
}
