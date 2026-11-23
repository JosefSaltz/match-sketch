import { z } from 'zod';
import type { PlanDocument } from '../model/plan';
import { AnyPlanDocumentSchema } from '../model/upgrade';
import type { MatchSketchDB } from './db';
import { savePlanDocument } from './plans';
import type { PlanRecord } from './records';

/**
 * A synchronous safety net for the newest edit of each plan. IndexedDB writes are async, and
 * a reload right after an edit can abort them; localStorage writes finish before the call
 * returns. On load, an entry newer than the stored plan is written back into IndexedDB.
 */
export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/**
 * `bases`: the stored plan's `updatedAt` values the edit may follow, the editor's last saved
 * version and any save still in flight (absent in older entries).
 */
const EntrySchema = z.object({
	at: z.string(),
	bases: z.array(z.string()).optional(),
	/** Entries written before schema version 2 hold a version 1 document. */
	document: AnyPlanDocumentSchema
});

export function journalKey(planId: string): string {
	return `match-sketch:unsaved:${planId}`;
}

export function writeJournal(
	storage: StorageLike,
	planId: string,
	document: PlanDocument,
	at = new Date().toISOString(),
	bases?: string[]
): void {
	try {
		storage.setItem(journalKey(planId), JSON.stringify({ at, bases, document }));
	} catch {
		// Storage full or unavailable: the IndexedDB save still runs; only the safety net is lost.
	}
}

export function clearJournal(storage: StorageLike, planId: string): void {
	try {
		storage.removeItem(journalKey(planId));
	} catch {
		// Nothing to clean up if storage is unavailable.
	}
}

/** The journaled document if it is valid and newer than `savedAt`; stale or bad entries are dropped. */
export function readNewerJournal(
	storage: StorageLike,
	planId: string,
	savedAt: string
): PlanDocument | null {
	const entry = readEntry(storage, planId);
	if (entry && entry.at > savedAt) return entry.document;
	if (entry) clearJournal(storage, planId);
	return null;
}

/** The valid journal entry for the plan, or null (an invalid one is dropped). */
function readEntry(storage: StorageLike, planId: string): z.infer<typeof EntrySchema> | null {
	let raw: string | null;
	try {
		raw = storage.getItem(journalKey(planId));
	} catch {
		return null;
	}
	if (raw === null) return null;
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		parsed = null;
	}
	const entry = EntrySchema.safeParse(parsed);
	if (entry.success) return entry.data;
	clearJournal(storage, planId);
	return null;
}

/**
 * Applies a newer journal entry to the stored plan (then clears it); otherwise returns `plan`.
 * If writing it back fails, the plan still opens with the recovered document and the entry is
 * kept, so the editor's next save (or the next load) can store it.
 *
 * An entry made on a version the device no longer has (a pull replaced it meanwhile) is not
 * applied over the other device's version: it goes to `onStale`, which keeps it as a copy.
 */
export async function recoverUnsavedEdits(
	db: MatchSketchDB,
	storage: StorageLike,
	plan: PlanRecord,
	onStale?: (document: PlanDocument) => Promise<void>
): Promise<PlanRecord> {
	const entry = readEntry(storage, plan.id);
	if (!entry) return plan;
	// Made on a version this device no longer has, whatever the clocks say: keep, don't apply.
	if (entry.bases !== undefined && !entry.bases.includes(plan.updatedAt)) {
		try {
			await onStale?.(entry.document);
			clearJournal(storage, plan.id);
		} catch {
			// Keep the entry for the next load.
		}
		return plan;
	}
	if (entry.at <= plan.updatedAt) {
		clearJournal(storage, plan.id);
		return plan;
	}
	try {
		const saved = await savePlanDocument(db, plan.id, entry.document);
		clearJournal(storage, plan.id);
		return saved;
	} catch {
		return { ...plan, document: entry.document };
	}
}
