import { and, eq, gte, notInArray, sql } from 'drizzle-orm';
import type { Database } from '../db/client';
import { aiDrafts } from '../db/schema';

export type DraftLogRow = Omit<typeof aiDrafts.$inferInsert, 'id' | 'createdAt'>;

/** 00:00 UTC today, computed by the database so every server agrees. */
const startOfUtcDay = sql`(date_trunc('day', now() at time zone 'utc') at time zone 'utc')`;

export async function logDraft(db: Database, row: DraftLogRow): Promise<void> {
	await db.insert(aiDrafts).values(row);
}

/** The user's drafts today that reached the model (capped/paused requests don't count). */
export async function draftsToday(db: Database, ownerId: string): Promise<number> {
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

/** Everyone's estimated model spend today, in US dollars. */
export async function spendToday(db: Database): Promise<number> {
	const [row] = await db
		.select({ usd: sql<string>`coalesce(sum(${aiDrafts.costUsd}), 0)` })
		.from(aiDrafts)
		.where(gte(aiDrafts.createdAt, startOfUtcDay));
	return Number(row?.usd ?? 0);
}

/**
 * Runs `fn` unless this user already has a draft running (then returns null). The lock is a
 * transaction-scoped advisory lock in its own namespace, so it never blocks the user's sync.
 */
export async function withDraftLock<T>(
	db: Database,
	ownerId: string,
	fn: () => Promise<T>
): Promise<T | null> {
	return db.transaction(async (tx) => {
		const [row] = await tx.execute<{ locked: boolean }>(
			sql`select pg_try_advisory_xact_lock(hashtextextended(${`draft:${ownerId}`}, 0)) as locked`
		);
		if (!row?.locked) return null;
		return fn();
	});
}
