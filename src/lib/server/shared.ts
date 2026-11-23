import { and, asc, eq, isNull } from 'drizzle-orm';
import { SHARE_TOKEN } from '../model/share';
import { readPlanDocument } from '../model/upgrade';
import type { SharedPlan, SharedView } from '../share/view';
import { effectiveStageNumber } from '../store/records';
import type { Database } from './db/client';
import { matches, plans } from './db/schema';

type PlanRow = typeof plans.$inferSelect;
type MatchRow = typeof matches.$inferSelect;

/** A match's live stages, in stage order (as the device lists them). */
async function stagesOf(db: Database, match: MatchRow): Promise<PlanRow[]> {
	return db
		.select()
		.from(plans)
		.where(
			and(eq(plans.matchId, match.id), eq(plans.ownerId, match.ownerId), isNull(plans.deletedAt))
		)
		.orderBy(asc(plans.stageOrder), asc(plans.id));
}

function sharedPlan(row: PlanRow, order: string[] | null): SharedPlan | null {
	let document;
	try {
		document = readPlanDocument(row.document);
	} catch {
		return null; // Saved by a newer app; this server can't show it.
	}
	return {
		id: row.id,
		widthFt: row.widthFt,
		depthFt: row.depthFt,
		unit: row.unit,
		stageNumber: effectiveStageNumber({ id: row.id, document }, order),
		document
	};
}

/**
 * What the share link `token` shows, or null when it isn't a link that is on (spec §7.11). Off,
 * reset, deleted and unknown links all look the same, so a link tells nothing about whether it
 * ever existed.
 */
export async function getSharedView(db: Database, token: string): Promise<SharedView | null> {
	if (!SHARE_TOKEN.test(token)) return null;
	const live = <T extends typeof plans | typeof matches>(t: T) =>
		and(eq(t.shareId, token), eq(t.shareOn, true), isNull(t.deletedAt));

	const [planRow] = await db.select().from(plans).where(live(plans)).limit(1);
	if (planRow) {
		const [match] = planRow.matchId
			? await db
					.select()
					.from(matches)
					.where(
						and(
							eq(matches.id, planRow.matchId),
							eq(matches.ownerId, planRow.ownerId),
							isNull(matches.deletedAt)
						)
					)
					.limit(1)
			: [];
		const order = match ? (await stagesOf(db, match)).map((p) => p.id) : null;
		const plan = sharedPlan(planRow, order);
		if (!plan) return null;
		return {
			kind: 'plan',
			plan,
			matchName: match?.name ?? plan.document.brief.matchName.trim(),
			date: match?.date ?? ''
		};
	}

	const [matchRow] = await db.select().from(matches).where(live(matches)).limit(1);
	if (!matchRow) return null;
	const rows = await stagesOf(db, matchRow);
	const order = rows.map((p) => p.id);
	return {
		kind: 'match',
		match: { name: matchRow.name, date: matchRow.date },
		plans: rows.flatMap((row) => sharedPlan(row, order) ?? [])
	};
}
