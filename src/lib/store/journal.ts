import { z } from 'zod';
import { PlanDocumentSchema, type PlanDocument } from '../model/plan';
import type { MatchSketchDB } from './db';
import { savePlanDocument } from './plans';
import type { PlanRecord } from './records';

/**
 * A synchronous safety net for the newest edit of each plan. IndexedDB writes are async, and
 * a reload right after an edit can abort them; localStorage writes finish before the call
 * returns. On load, an entry newer than the stored plan is written back into IndexedDB.
 */
export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const EntrySchema = z.object({ at: z.string(), document: PlanDocumentSchema });

export function journalKey(planId: string): string {
	return `match-sketch:unsaved:${planId}`;
}

export function writeJournal(
	storage: StorageLike,
	planId: string,
	document: PlanDocument,
	at = new Date().toISOString()
): void {
	try {
		storage.setItem(journalKey(planId), JSON.stringify({ at, document }));
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
	if (entry.success && entry.data.at > savedAt) return entry.data.document;
	clearJournal(storage, planId);
	return null;
}

/** Applies a newer journal entry to the stored plan (then clears it); otherwise returns `plan`. */
export async function recoverUnsavedEdits(
	db: MatchSketchDB,
	storage: StorageLike,
	plan: PlanRecord
): Promise<PlanRecord> {
	const document = readNewerJournal(storage, plan.id, plan.updatedAt);
	if (!document) return plan;
	const saved = await savePlanDocument(db, plan.id, document);
	clearJournal(storage, plan.id);
	return saved;
}
