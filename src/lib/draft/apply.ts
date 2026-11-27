import { getEntry } from '../catalog';
import type { PlanDocument, PlanObject } from '../model/plan';
import { pruneMarks } from '../editor/walkthrough';
import type { Placement } from './contract';

/**
 * The plan with its objects replaced by the draft (spec §7.5 step 5). Arrows and measure lines
 * tied to a replaced object go with it; text labels, point-to-point lines, the brief, the scale
 * break and display settings stay; walkthrough marks on replaced objects go. One commit, so one
 * undo step.
 */
export function applyDraft(doc: PlanDocument, placements: Placement[]): PlanDocument {
	// Footprints (walls, boxes, berms) go underneath, so they never hide a target or prop.
	const ordered = [
		...placements.filter((p) => getEntry(p.symbolId)?.kind === 'footprint'),
		...placements.filter((p) => getEntry(p.symbolId)?.kind !== 'footprint')
	];
	const objects: PlanObject[] = ordered.map((p, z) => ({
		id: crypto.randomUUID(),
		symbolId: p.symbolId,
		x: p.x,
		y: p.y,
		rotation: p.rotation,
		...(p.label !== undefined && { label: p.label }),
		...(p.count !== undefined && { count: p.count }),
		...(p.widthFt !== undefined && { widthFt: p.widthFt }),
		...(p.depthFt !== undefined && { depthFt: p.depthFt }),
		z
	}));
	const annotations = doc.annotations.filter(
		(a) => a.type === 'text' || (a.from.kind === 'point' && a.to.kind === 'point')
	);
	return pruneMarks({ ...doc, objects, annotations });
}
