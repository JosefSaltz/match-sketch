import { targetsText } from '../brief/tally';
import { depthMapFor } from '../geometry/depth-map';
import { formatMatchDate } from '../matches/format';
import { effectiveStageNumber, type PlanRecord } from '../store/records';
import type { PlanPrintInput } from './layout';
import type { Orientation } from './page';

/** What printing needs to know about the plan's match, if it has one. */
export type PrintMatch = { name: string; date: string; order: string[] };

/** Everything `layoutPlan` needs for one plan. */
export function printInput(
	plan: PlanRecord,
	match: PrintMatch | null,
	opts: { orientation: Orientation; mode: PlanPrintInput['mode'] }
): PlanPrintInput {
	const brief = plan.document.brief;
	return {
		title: brief.stageName.trim() || 'Untitled stage',
		stageNumber: effectiveStageNumber(plan, match?.order ?? null),
		matchName: match?.name ?? brief.matchName.trim(),
		date: match?.date ? formatMatchDate(match.date) : '',
		brief,
		targets: targetsText(plan.document),
		canvas: { widthFt: plan.widthFt, depthFt: plan.depthFt },
		depth: depthMapFor(plan.document.scaleBreaks, plan.depthFt),
		unit: plan.unit,
		orientation: opts.orientation,
		mode: opts.mode
	};
}
