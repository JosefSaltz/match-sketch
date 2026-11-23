import { and, asc, eq, gt, ne, sql } from 'drizzle-orm';
import {
	MAX_PULL_RECORDS,
	type PullResponse,
	type PushItem,
	type PushResult,
	type ServerRecord,
	type SyncTable,
	type WireRecord
} from '../sync/wire';
import { PLAN_SCHEMA_VERSION } from '../model/plan';
import type { Share } from '../model/share';
import { readPlanDocument } from '../model/upgrade';
import type { Database } from './db/client';
import { canvases, matches, plans, shareTokens } from './db/schema';

type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];
type Db = Database | Tx;

type CanvasRow = typeof canvases.$inferSelect;
type MatchRow = typeof matches.$inferSelect;
type PlanRow = typeof plans.$inferSelect;

const iso = (d: Date | null) => (d ? d.toISOString() : null);

const share = (row: { shareId: string | null; shareOn: boolean }): Share | null =>
	row.shareId ? { id: row.shareId, on: row.shareOn } : null;

function canvasRecord(row: CanvasRow): ServerRecord {
	const { id, version, updatedAt, deletedAt, name, widthFt, depthFt, unit } = row;
	return {
		table: 'canvases',
		id,
		version,
		updatedAt: updatedAt.toISOString(),
		deletedAt: iso(deletedAt),
		name,
		widthFt,
		depthFt,
		unit
	};
}

function matchRecord(row: MatchRow): ServerRecord {
	const { id, version, updatedAt, deletedAt, name, date } = row;
	return {
		table: 'matches',
		id,
		version,
		updatedAt: updatedAt.toISOString(),
		deletedAt: iso(deletedAt),
		name,
		date,
		share: share(row)
	};
}

/** Rows a version 1 app saved go out as version 2 (spec §7.10); newer ones as they are. */
function upgradedDocument(row: PlanRow): { schemaVersion: number; document: unknown } {
	if (row.schemaVersion !== 1) return { schemaVersion: row.schemaVersion, document: row.document };
	try {
		return { schemaVersion: PLAN_SCHEMA_VERSION, document: readPlanDocument(row.document) };
	} catch {
		return { schemaVersion: row.schemaVersion, document: row.document };
	}
}

function planRecord(row: PlanRow): ServerRecord {
	return {
		table: 'plans',
		id: row.id,
		version: row.version,
		updatedAt: row.updatedAt.toISOString(),
		deletedAt: iso(row.deletedAt),
		matchId: row.matchId,
		stageOrder: row.stageOrder,
		sourceCanvasId: row.sourceCanvasId,
		widthFt: row.widthFt,
		depthFt: row.depthFt,
		unit: row.unit,
		share: share(row),
		...upgradedDocument(row)
	};
}

type Existing = { ownerId: string; version: number; server: ServerRecord };

async function findExisting(db: Db, table: SyncTable, id: string): Promise<Existing | null> {
	switch (table) {
		case 'canvases': {
			const [row] = await db.select().from(canvases).where(eq(canvases.id, id)).for('update');
			return row ? { ownerId: row.ownerId, version: row.version, server: canvasRecord(row) } : null;
		}
		case 'matches': {
			const [row] = await db.select().from(matches).where(eq(matches.id, id)).for('update');
			return row ? { ownerId: row.ownerId, version: row.version, server: matchRecord(row) } : null;
		}
		case 'plans': {
			const [row] = await db.select().from(plans).where(eq(plans.id, id)).for('update');
			return row ? { ownerId: row.ownerId, version: row.version, server: planRecord(row) } : null;
		}
	}
}

/** The share columns to write; none when an older app's push left `share` out (keep them). */
function shareValues(record: WireRecord): { shareId?: string | null; shareOn?: boolean } {
	if (record.table === 'canvases' || record.share === undefined) return {};
	return { shareId: record.share?.id ?? null, shareOn: record.share?.on ?? false };
}

/** The record's columns, without the table, id, owner or version. */
function fields(record: WireRecord) {
	const updatedAt = new Date(record.updatedAt);
	const deletedAt = record.deletedAt ? new Date(record.deletedAt) : null;
	const shared = shareValues(record);
	switch (record.table) {
		case 'canvases': {
			const { name, widthFt, depthFt, unit } = record;
			return {
				table: record.table,
				values: { updatedAt, deletedAt, name, widthFt, depthFt, unit }
			};
		}
		case 'matches': {
			const { name, date } = record;
			return { table: record.table, values: { updatedAt, deletedAt, name, date, ...shared } };
		}
		case 'plans': {
			const { matchId, stageOrder, sourceCanvasId, widthFt, depthFt, unit } = record;
			const { document } = record;
			const schemaVersion = PLAN_SCHEMA_VERSION;
			return {
				table: record.table,
				values: {
					updatedAt,
					deletedAt,
					matchId,
					stageOrder,
					sourceCanvasId,
					widthFt,
					depthFt,
					unit,
					schemaVersion,
					document,
					...shared
				}
			};
		}
	}
}

/** Inserts a new record at version 1; false if its id was taken meanwhile. */
async function insertRecord(db: Db, ownerId: string, record: WireRecord): Promise<boolean> {
	const base = { id: record.id, ownerId, version: 1 };
	const f = fields(record);
	const inserted =
		f.table === 'canvases'
			? await db
					.insert(canvases)
					.values({ ...base, ...f.values })
					.onConflictDoNothing()
					.returning({ id: canvases.id })
			: f.table === 'matches'
				? await db
						.insert(matches)
						.values({ ...base, ...f.values })
						.onConflictDoNothing()
						.returning({ id: matches.id })
				: await db
						.insert(plans)
						.values({ ...base, ...f.values })
						.onConflictDoNothing()
						.returning({ id: plans.id });
	return inserted.length > 0;
}

async function updateRecord(db: Db, record: WireRecord, version: number): Promise<void> {
	const f = fields(record);
	if (f.table === 'canvases') {
		await db
			.update(canvases)
			.set({ ...f.values, version })
			.where(eq(canvases.id, record.id));
	} else if (f.table === 'matches') {
		await db
			.update(matches)
			.set({ ...f.values, version })
			.where(eq(matches.id, record.id));
	} else {
		await db
			.update(plans)
			.set({ ...f.values, version })
			.where(eq(plans.id, record.id));
	}
}

/**
 * Whether the record may use its share token: the token must be this owner's (the first push
 * of a token claims it for good) and no other plan or match may hold it.
 */
async function tokenAllowed(db: Db, ownerId: string, record: WireRecord): Promise<boolean> {
	if (record.table === 'canvases' || !record.share) return true;
	const token = record.share.id;
	// The primary key settles concurrent claims: a second claimant waits, then reads the owner.
	await db.insert(shareTokens).values({ token, ownerId }).onConflictDoNothing();
	const [claim] = await db
		.select({ ownerId: shareTokens.ownerId })
		.from(shareTokens)
		.where(eq(shareTokens.token, token));
	if (claim?.ownerId !== ownerId) return false;
	// Only the record itself is left out, in its own table.
	const otherPlan = record.table === 'plans' ? ne(plans.id, record.id) : undefined;
	const otherMatch = record.table === 'matches' ? ne(matches.id, record.id) : undefined;
	const [p] = await db
		.select({ id: plans.id })
		.from(plans)
		.where(and(eq(plans.shareId, token), otherPlan))
		.limit(1);
	if (p) return false;
	const [m] = await db
		.select({ id: matches.id })
		.from(matches)
		.where(and(eq(matches.shareId, token), otherMatch))
		.limit(1);
	return m === undefined;
}

async function pushOne(tx: Tx, ownerId: string, item: PushItem): Promise<PushResult> {
	const { record, baseVersion } = item;
	const ref = { table: record.table, id: record.id };
	// Someone else's token, or one another record holds (which would also break the unique index
	// and the transaction).
	if (!(await tokenAllowed(tx, ownerId, record))) {
		return { status: 'rejected', ...ref, reason: 'invalid' };
	}
	let existing = await findExisting(tx, record.table, record.id);
	if (!existing) {
		if (await insertRecord(tx, ownerId, record)) return { status: 'accepted', ...ref, version: 1 };
		// Another owner created the same id concurrently.
		existing = await findExisting(tx, record.table, record.id);
		if (!existing) throw new Error(`Record ${record.id} vanished`);
	}
	// Someone else's record: answer as if it didn't exist.
	if (existing.ownerId !== ownerId) return { status: 'rejected', ...ref, reason: 'not-found' };
	if (existing.version !== baseVersion)
		return { status: 'conflict', ...ref, server: existing.server };
	const version = existing.version + 1;
	await updateRecord(tx, record, version);
	return { status: 'accepted', ...ref, version };
}

/**
 * Applies a device's changes for `ownerId`, in one transaction. The per-owner advisory lock
 * serializes an owner's pushes, so their change_seq values commit in order and a pull cursor
 * never passes a row that commits later (spec §7.9; plan 5b Decision 1).
 */
export async function pushRecords(
	db: Database,
	ownerId: string,
	items: PushItem[]
): Promise<PushResult[]> {
	return db.transaction(async (tx) => {
		await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${ownerId}::text, 0))`);
		const results: PushResult[] = [];
		for (const item of items) results.push(await pushOne(tx, ownerId, item));
		return results;
	});
}

/** The owner's records changed after `cursor`, oldest change first, deleted ones included. */
export async function pullChanges(
	db: Database,
	ownerId: string,
	cursor: number,
	limit: number = MAX_PULL_RECORDS
): Promise<PullResponse> {
	// One more than the page from each table tells whether anything is left.
	const take = limit + 1;
	// All three tables are read as of one moment: in separate snapshots, a push committing
	// between the reads could be half seen and the cursor would pass its other rows for good.
	const [c, m, p] = await db.transaction(
		(tx) =>
			Promise.all([
				tx
					.select()
					.from(canvases)
					.where(and(eq(canvases.ownerId, ownerId), gt(canvases.changeSeq, cursor)))
					.orderBy(asc(canvases.changeSeq))
					.limit(take),
				tx
					.select()
					.from(matches)
					.where(and(eq(matches.ownerId, ownerId), gt(matches.changeSeq, cursor)))
					.orderBy(asc(matches.changeSeq))
					.limit(take),
				tx
					.select()
					.from(plans)
					.where(and(eq(plans.ownerId, ownerId), gt(plans.changeSeq, cursor)))
					.orderBy(asc(plans.changeSeq))
					.limit(take)
			]),
		{ isolationLevel: 'repeatable read', accessMode: 'read only' }
	);
	const changes = [
		...c.map((row) => ({ seq: row.changeSeq, record: canvasRecord(row) })),
		...m.map((row) => ({ seq: row.changeSeq, record: matchRecord(row) })),
		...p.map((row) => ({ seq: row.changeSeq, record: planRecord(row) }))
	].sort((a, b) => a.seq - b.seq);
	const page = changes.slice(0, limit);
	return {
		records: page.map((change) => change.record),
		cursor: page.at(-1)?.seq ?? cursor,
		more: changes.length > limit
	};
}
