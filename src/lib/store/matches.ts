import type { MatchSketchDB } from './db';
import {
	MatchInputSchema,
	newSyncMeta,
	now,
	type MatchInput,
	type MatchRecord,
	type PlanRecord
} from './records';

/** Matches that aren't deleted: newest date first, undated last, then by name. */
export async function listMatches(db: MatchSketchDB): Promise<MatchRecord[]> {
	const all = await db.matches.toArray();
	return all
		.filter((m) => m.deletedAt === null)
		.sort((a, b) => {
			if (a.date !== b.date) {
				if (!a.date) return 1;
				if (!b.date) return -1;
				return a.date < b.date ? 1 : -1;
			}
			return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
		});
}

export async function createMatch(db: MatchSketchDB, input: MatchInput): Promise<MatchRecord> {
	const record: MatchRecord = { ...newSyncMeta(), ...MatchInputSchema.parse(input) };
	await db.matches.add(record);
	return record;
}

export async function getMatch(db: MatchSketchDB, id: string): Promise<MatchRecord | undefined> {
	const m = await db.matches.get(id);
	return m && m.deletedAt === null ? m : undefined;
}

export async function updateMatch(
	db: MatchSketchDB,
	id: string,
	input: MatchInput
): Promise<MatchRecord> {
	const changes = MatchInputSchema.parse(input);
	const existing = await getMatch(db, id);
	if (!existing) throw new Error(`Match ${id} not found`);
	const record: MatchRecord = { ...existing, ...changes, updatedAt: now(), dirty: 1 };
	await db.matches.put(record);
	return record;
}

/** Deletes a match; its plans are kept and become unassigned. */
export async function deleteMatch(db: MatchSketchDB, id: string): Promise<void> {
	await db.transaction('rw', db.matches, db.plans, async () => {
		const stamp = now();
		await db.matches.update(id, { deletedAt: stamp, updatedAt: stamp, dirty: 1 });
		await db.plans
			.where('matchId')
			.equals(id)
			.modify({ matchId: null, stageOrder: null, updatedAt: stamp, dirty: 1 });
	});
}

/** The match's stages (plans not deleted), in stage order. */
export async function listMatchPlans(db: MatchSketchDB, matchId: string): Promise<PlanRecord[]> {
	const plans = await db.plans.where('matchId').equals(matchId).toArray();
	return plans
		.filter((p) => p.deletedAt === null)
		.sort((a, b) => (a.stageOrder ?? 0) - (b.stageOrder ?? 0));
}

/** The `stageOrder` that puts a plan after the match's last stage. */
export async function nextStageOrder(db: MatchSketchDB, matchId: string): Promise<number> {
	const plans = await listMatchPlans(db, matchId);
	return plans.reduce((max, p) => Math.max(max, (p.stageOrder ?? -1) + 1), 0);
}

/** Puts a plan into a match as its last stage, or takes it out (`null`). */
export async function assignPlan(
	db: MatchSketchDB,
	planId: string,
	matchId: string | null
): Promise<void> {
	const stageOrder = matchId ? await nextStageOrder(db, matchId) : null;
	await db.plans.update(planId, { matchId, stageOrder, updatedAt: now(), dirty: 1 });
}

/** Sets the match's stage order to `orderedPlanIds`. */
export async function reorderMatchPlans(
	db: MatchSketchDB,
	matchId: string,
	orderedPlanIds: string[]
): Promise<void> {
	await db.transaction('rw', db.plans, async () => {
		const stamp = now();
		for (const [i, id] of orderedPlanIds.entries()) {
			const plan = await db.plans.get(id);
			if (plan?.matchId !== matchId) continue;
			await db.plans.update(id, { stageOrder: i, updatedAt: stamp, dirty: 1 });
		}
	});
}

/**
 * Plans in no live match: unassigned ones, and ones whose match was deleted (on another device,
 * or by a conflict), which would otherwise be in no list at all.
 */
export function unassignedPlans(plans: PlanRecord[], matches: MatchRecord[]): PlanRecord[] {
	const live = new Set(matches.filter((m) => m.deletedAt === null).map((m) => m.id));
	return plans.filter((p) => p.matchId === null || !live.has(p.matchId));
}
