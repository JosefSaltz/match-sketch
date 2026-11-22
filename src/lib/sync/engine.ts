import type { PlanDocument } from '../model/plan';
import type { MatchSketchDB } from '../store/db';
import { nextStageOrder } from '../store/matches';
import {
	newSyncMeta,
	now as timestamp,
	type CanvasRecord,
	type MatchRecord,
	type PlanRecord
} from '../store/records';
import {
	getSetting,
	setSetting,
	SYNC_CONFLICTS,
	SYNC_CURSOR,
	SYNC_CURSOR_SCHEMA
} from '../store/settings';
import {
	fromServer,
	MAX_PUSH_RECORDS,
	SUPPORTED_SCHEMA_VERSION,
	SYNC_TABLES,
	toWire,
	WireRecordSchema,
	type PullResponse,
	type PushItem,
	type PushResult,
	type ServerRecord,
	type SyncTable
} from './wire';

/** How the engine reaches the server (src/lib/sync/transport.ts in the app; fakes in tests). */
export type Transport = {
	push(records: PushItem[]): Promise<PushResult[]>;
	pull(cursor: number): Promise<PullResponse>;
};

/** A copy of this device's version, saved because another device changed the record first. */
export type ConflictCopy = { table: SyncTable; id: string; name: string };

export type SyncOutcome = {
	pushed: number;
	pulled: number;
	/** Records a pull changed on this device, so open screens can re-read them. */
	changed: { table: SyncTable; id: string }[];
	conflicts: ConflictCopy[];
	/** A pulled plan was saved by a newer app; this one must reload to show it. */
	needsReload: boolean;
	/** Dirty records the server refused (another user's id) or that fail validation. */
	stuck: number;
};

type AnyRecord = CanvasRecord | MatchRecord | PlanRecord;
type Dirty = { table: SyncTable; record: AnyRecord };

const tableOf = (db: MatchSketchDB, table: SyncTable) => db.table<AnyRecord, string>(table);

/** Names are at most this long (CanvasInputSchema, MatchInputSchema). */
const MAX_NAME = 80;

/**
 * `"<name> (conflicted copy, Nov 22 3:04 PM)"` in the device's local time, with a long name
 * shortened ("…") so the copy still passes validation and can sync.
 */
export function conflictName(name: string, at: Date): string {
	const day = at.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
	const time = at.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
	const suffix = ` (conflicted copy, ${day} ${time})`;
	const room = MAX_NAME - suffix.length;
	const base = name.length <= room ? name : `${name.slice(0, room - 1).trimEnd()}…`;
	return `${base}${suffix}`;
}

function recordName(table: SyncTable, record: AnyRecord): string {
	if (table === 'plans') {
		return (record as PlanRecord).document.brief.stageName.trim() || 'Untitled stage';
	}
	return (record as CanvasRecord | MatchRecord).name;
}

async function dirtyRecords(db: MatchSketchDB): Promise<Dirty[]> {
	const all: Dirty[] = [];
	// Canvases and matches first, so a device's plans arrive after what they point at.
	for (const table of SYNC_TABLES) {
		const records = await tableOf(db, table).where('dirty').equals(1).toArray();
		all.push(...records.map((record) => ({ table, record })));
	}
	return all;
}

/** Records the new version; clears `dirty` only if nothing changed since the push was read. */
async function applyAccepted(db: MatchSketchDB, sent: Dirty, version: number): Promise<void> {
	const table = tableOf(db, sent.table);
	await db.transaction('rw', table, async () => {
		const current = await table.get(sent.record.id);
		if (!current) return;
		const unchanged =
			current.updatedAt === sent.record.updatedAt && current.deletedAt === sent.record.deletedAt;
		await table.update(sent.record.id, unchanged ? { version, dirty: 0 } : { version });
	});
}

/**
 * Keeps the server's record and saves this device's version (as it is now, including any edit
 * made during the push) as a new record named as a conflicted copy (spec §7.9).
 */
async function applyConflict(
	db: MatchSketchDB,
	sent: Dirty,
	server: ServerRecord,
	at: Date
): Promise<{ copy: ConflictCopy | null; needsReload: boolean }> {
	const table = tableOf(db, sent.table);
	let needsReload = false;
	try {
		fromServer(server);
	} catch {
		// A plan from a newer app: this one can't hold it, so it keeps its own version (still
		// dirty) and makes no copy; syncing pauses until the reload brings the newer app.
		return { copy: null, needsReload: true };
	}
	const copy = await db.transaction('rw', db.canvases, db.matches, db.plans, async () => {
		const current = (await table.get(sent.record.id)) ?? sent.record;
		const name = conflictName(recordName(sent.table, current), at);
		const meta = { ...newSyncMeta(), updatedAt: timestamp() };
		let record: AnyRecord;
		if (sent.table === 'plans') {
			const plan = current as PlanRecord;
			record = {
				...plan,
				...meta,
				stageOrder: plan.matchId ? await nextStageOrder(db, plan.matchId) : null,
				document: { ...plan.document, brief: { ...plan.document.brief, stageName: name } }
			};
		} else {
			record = { ...(current as CanvasRecord | MatchRecord), ...meta, name };
		}
		// A deleted record that conflicts with an edit elsewhere needs no copy: the edit wins.
		if (current.deletedAt === null) await table.add(record);
		try {
			await table.put(fromServer(server));
		} catch {
			needsReload = true;
		}
		return current.deletedAt === null ? { table: sent.table, id: record.id, name } : null;
	});
	return { copy, needsReload };
}

async function registerConflicts(db: MatchSketchDB, copies: ConflictCopy[]): Promise<void> {
	if (copies.length === 0) return;
	const all = [...(await pendingConflicts(db)), ...copies];
	await setSetting(db, SYNC_CONFLICTS, JSON.stringify(all));
}

/**
 * Saves `document` as a conflicted copy of plan `planId`: for an edit made in an open editor on a
 * version a pull or conflict has since replaced, so neither version is lost (spec §7.9).
 */
export async function keepAsConflictedCopy(
	db: MatchSketchDB,
	planId: string,
	document: PlanDocument,
	at: Date
): Promise<ConflictCopy | null> {
	const stored = await db.plans.get(planId);
	if (!stored) return null;
	const name = conflictName(document.brief.stageName.trim() || 'Untitled stage', at);
	const copy: PlanRecord = {
		...stored,
		...newSyncMeta(),
		updatedAt: timestamp(),
		stageOrder: stored.matchId ? await nextStageOrder(db, stored.matchId) : null,
		document: { ...document, brief: { ...document.brief, stageName: name } }
	};
	await db.plans.add(copy);
	const conflict: ConflictCopy = { table: 'plans', id: copy.id, name };
	await registerConflicts(db, [conflict]);
	return conflict;
}

/**
 * Applies a pulled record unless the device has changes of its own (push decides those) or
 * already has this version (its own push coming back).
 */
export async function applyPulled(
	db: MatchSketchDB,
	server: ServerRecord
): Promise<'applied' | 'kept-local' | 'newer'> {
	let local: AnyRecord;
	try {
		local = fromServer(server);
	} catch {
		return 'newer';
	}
	const table = tableOf(db, server.table);
	return db.transaction('rw', table, async () => {
		const current = await table.get(server.id);
		if (current && (current.dirty === 1 || current.version >= server.version)) return 'kept-local';
		await table.put(local);
		return 'applied';
	});
}

function readConflicts(raw: string | undefined): ConflictCopy[] {
	try {
		const list: unknown = JSON.parse(raw ?? '[]');
		return Array.isArray(list) ? (list as ConflictCopy[]) : [];
	} catch {
		return [];
	}
}

/** The conflicted copies the MD hasn't dismissed. */
export async function pendingConflicts(db: MatchSketchDB): Promise<ConflictCopy[]> {
	return readConflicts(await getSetting(db, SYNC_CONFLICTS));
}

/** A push body stays well under adapter-node's default 512 kB limit. */
const MAX_PUSH_BYTES = 256 * 1024;

/** Dirty records in pushes of at most MAX_PUSH_RECORDS and (one big record aside) MAX_PUSH_BYTES. */
function batches(dirty: Dirty[]): Dirty[][] {
	const out: Dirty[][] = [];
	let batch: Dirty[] = [];
	let bytes = 0;
	for (const item of dirty) {
		const size = JSON.stringify(toWire(item.table, item.record)).length;
		const full =
			batch.length === MAX_PUSH_RECORDS || (batch.length > 0 && bytes + size > MAX_PUSH_BYTES);
		if (full) {
			out.push(batch);
			batch = [];
			bytes = 0;
		}
		batch.push(item);
		bytes += size;
	}
	if (batch.length > 0) out.push(batch);
	return out;
}

/** One round: push every dirty record, then pull everything changed since the cursor. */
export async function syncOnce(
	db: MatchSketchDB,
	transport: Transport,
	now: () => Date = () => new Date()
): Promise<SyncOutcome> {
	const outcome: SyncOutcome = {
		pushed: 0,
		pulled: 0,
		changed: [],
		conflicts: [],
		needsReload: false,
		stuck: 0
	};

	const dirty: Dirty[] = [];
	for (const item of await dirtyRecords(db)) {
		// The store validates on save; a record that still fails would sink its whole batch.
		if (WireRecordSchema.safeParse(toWire(item.table, item.record)).success) {
			dirty.push(item);
		} else {
			outcome.stuck += 1;
		}
	}
	for (const batch of batches(dirty)) {
		const results = await transport.push(
			batch.map(({ table, record }) => ({
				record: toWire(table, record),
				baseVersion: record.version
			}))
		);
		for (const result of results) {
			const sent = batch.find((b) => b.table === result.table && b.record.id === result.id);
			if (!sent) continue;
			if (result.status === 'accepted') {
				await applyAccepted(db, sent, result.version);
				outcome.pushed += 1;
			} else if (result.status === 'conflict') {
				const { copy, needsReload } = await applyConflict(db, sent, result.server, now());
				if (copy) outcome.conflicts.push(copy);
				outcome.needsReload ||= needsReload;
				// The device's record now holds the other version; open screens must re-read it.
				if (!needsReload) outcome.changed.push({ table: sent.table, id: sent.record.id });
			} else {
				outcome.stuck += 1;
			}
		}
	}

	// Records this app skipped as too new come back once it's updated: a cursor stored by an
	// app with an older plan schema starts over (pulling again is cheap; known versions are skipped).
	const schema = String(SUPPORTED_SCHEMA_VERSION);
	const sameSchema = (await getSetting(db, SYNC_CURSOR_SCHEMA)) === schema;
	let cursor = sameSchema ? Number((await getSetting(db, SYNC_CURSOR)) ?? 0) || 0 : 0;
	for (;;) {
		const page = await transport.pull(cursor);
		for (const record of page.records) {
			const applied = await applyPulled(db, record);
			if (applied === 'applied') {
				outcome.pulled += 1;
				outcome.changed.push({ table: record.table, id: record.id });
			} else if (applied === 'newer') {
				outcome.needsReload = true;
			}
		}
		// Records kept local or too new were looked at on purpose; the cursor moves past them.
		cursor = page.cursor;
		await setSetting(db, SYNC_CURSOR, String(cursor));
		await setSetting(db, SYNC_CURSOR_SCHEMA, schema);
		if (!page.more) break;
	}

	await registerConflicts(db, outcome.conflicts);
	return outcome;
}
