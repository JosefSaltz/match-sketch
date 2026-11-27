import { targetsText } from '../brief/tally';
import { depthMapFor } from '../geometry/depth-map';
import { formatMatchDate } from '../matches/format';
import { shareUrl, type Share } from '../model/share';
import { effectiveStageNumber, type PlanRecord } from '../store/records';
import type { PlanPrintInput } from './layout';
import type { Orientation } from './page';

/** What printing needs to know about the plan's match, if it has one. */
export type PrintMatch = {
	name: string;
	date: string;
	order: string[];
	/** The match's link, for stages printed with its QR code. */
	share?: Share | null;
};

/** Everything `layoutPlan` needs for one plan. */
export function printInput(
	plan: PlanRecord,
	match: PrintMatch | null,
	opts: { orientation: Orientation; mode: PlanPrintInput['mode'] },
	link: string | null = null
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
		mode: opts.mode,
		link
	};
}

/**
 * The link a stage's printout points to (spec §7.11): the stage's own if it is shared, else its
 * shared match's, opened at the stage; null when neither is shared.
 */
export function stageLink(
	origin: string,
	plan: Pick<PlanRecord, 'id' | 'share'>,
	match: { share?: Share | null } | null
): string | null {
	if (plan.share?.on) return shareUrl(origin, plan.share.id);
	if (match?.share?.on) return shareUrl(origin, match.share.id, plan.id);
	return null;
}
