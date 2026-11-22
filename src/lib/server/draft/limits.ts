import { and, eq, gte, lt, notInArray, sql } from 'drizzle-orm';
import type { Database } from '../db/client';
import { aiDrafts } from '../db/schema';

export type DraftLogRow = Omit<typeof aiDrafts.$inferInsert, 'id' | 'createdAt'>;
type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];
type Db = Database | Tx;

/**
 * What a running draft reserves against the spend ceiling until it is settled: two calls at
 * about 20k input tokens and up to 16k output tokens each, at Opus 5.5 prices.
 */
export const DRAFT_RESERVE_USD = 0.8;
/** Drafts running at once across the site, well below the database pool. */
export const MAX_RUNNING_DRAFTS = 5;
/** A draft pending longer than this was cut off (a restart, a crash) and is released. */
export const STALE_DRAFT_MINUTES = 10;

/** 00:00 UTC today, computed by the database so every server agrees. */
const startOfUtcDay = sql`(date_trunc('day', now() at time zone 'utc') at time zone 'utc')`;
const staleBefore = sql`now() - make_interval(mins => ${STALE_DRAFT_MINUTES})`;

export async function logDraft(db: Db, row: DraftLogRow): Promise<void> {
	await db.insert(aiDrafts).values(row);
}

/** The user's drafts today that reached the model or are running (not capped/paused ones). */
export async function draftsToday(db: Db, ownerId: string): Promise<number> {
	const [row] = await db
		.select({ n: sql<number>`count(*)::int` })
		.from(aiDrafts)
		.where(
			and(
				eq(aiDrafts.ownerId, ownerId),
				gte(aiDrafts.createdAt, startOfUtcDay),
				notInArray(aiDrafts.status, ['capped', 'paused'])
			)
		);
	return row?.n ?? 0;
}

/** Everyone's estimated model spend today in US dollars, running drafts at their reserve. */
export async function spendToday(db: Db): Promise<number> {
	const [row] = await db
		.select({ usd: sql<string>`coalesce(sum(${aiDrafts.costUsd}), 0)` })
		.from(aiDrafts)
		.where(gte(aiDrafts.createdAt, startOfUtcDay));
	return Number(row?.usd ?? 0);
}

export type Reservation =
	| { kind: 'reserved'; id: string }
	| { kind: 'busy' }
	| { kind: 'capped' }
	| { kind: 'paused' }
	| { kind: 'site-busy' };

/**
 * Checks the limits and, if they allow it, records a pending draft reserving its worst-case
 * cost, in one short transaction serialized across the site, so concurrent drafts can't all
 * slip under the cap or the ceiling. No connection is held while the model runs; the caller
 * settles the row afterwards (settleDraft).
 */
export async function reserveDraft(
	db: Database,
	options: { ownerId: string; planId: string; request: unknown; cap: number; ceilingUsd: number }
): Promise<Reservation> {
	const { ownerId, planId, request, cap, ceilingUsd } = options;
	const refused = (status: 'capped' | 'paused') => ({
		ownerId,
		planId,
		model: 'none',
		status,
		inputTokens: 0,
		outputTokens: 0,
		cacheReadTokens: 0,
		costUsd: 0,
		error: null,
		request,
		response: {}
	});
	return db.transaction(async (tx) => {
		await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended('match-sketch:drafts', 0))`);
		await tx
			.update(aiDrafts)
			.set({ status: 'failed', error: 'The draft did not finish (server restarted?)' })
			.where(and(eq(aiDrafts.status, 'pending'), lt(aiDrafts.createdAt, staleBefore)));
		const [pending] = await tx
			.select({
				mine: sql<number>`count(*) filter (where ${aiDrafts.ownerId} = ${ownerId})::int`,
				all: sql<number>`count(*)::int`
			})
			.from(aiDrafts)
			.where(eq(aiDrafts.status, 'pending'));
		if ((pending?.mine ?? 0) > 0) return { kind: 'busy' };
		if ((await draftsToday(tx, ownerId)) >= cap) {
			await logDraft(tx, refused('capped'));
			return { kind: 'capped' };
		}
		if ((await spendToday(tx)) >= ceilingUsd) {
			await logDraft(tx, refused('paused'));
			return { kind: 'paused' };
		}
		if ((pending?.all ?? 0) >= MAX_RUNNING_DRAFTS) return { kind: 'site-busy' };
		const [row] = await tx
			.insert(aiDrafts)
			.values({
				ownerId,
				planId,
				model: 'pending',
				status: 'pending',
				inputTokens: 0,
				outputTokens: 0,
				cacheReadTokens: 0,
				costUsd: DRAFT_RESERVE_USD,
				error: null,
				request,
				response: {}
			})
			.returning({ id: aiDrafts.id });
		return { kind: 'reserved', id: row.id };
	});
}

/** Records how a reserved draft went, replacing its reserve with the real cost. */
export async function settleDraft(
	db: Database,
	id: string,
	final: Pick<
		DraftLogRow,
		| 'model'
		| 'status'
		| 'inputTokens'
		| 'outputTokens'
		| 'cacheReadTokens'
		| 'costUsd'
		| 'error'
		| 'response'
	>
): Promise<void> {
	await db.update(aiDrafts).set(final).where(eq(aiDrafts.id, id));
}
