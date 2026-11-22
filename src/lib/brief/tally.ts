import { CATALOG } from '../catalog/index';
import type { PlanDocument, PlanObject } from '../model/plan';

/**
 * The computed Targets line of the stage brief, e.g. "4 paper targets, 3 static steel": target
 * objects only, counts summed per symbol, in catalog order. Empty when there are no targets.
 */
export function targetsTally(objects: PlanObject[]): string {
	const counts = new Map<string, number>();
	for (const o of objects) counts.set(o.symbolId, (counts.get(o.symbolId) ?? 0) + (o.count ?? 1));
	const parts: string[] = [];
	for (const entry of CATALOG) {
		const n = entry.category === 'target' ? counts.get(entry.id) : undefined;
		if (!n) continue;
		const name = n === 1 ? entry.name : (entry.plural ?? `${entry.name}s`);
		parts.push(`${n} ${name.toLowerCase()}`);
	}
	return parts.join(', ');
}

/** What the brief shows for Targets: the MD's override, or else the computed tally. */
export function targetsText(doc: PlanDocument): string {
	return doc.brief.targetsOverride ?? targetsTally(doc.objects);
}
