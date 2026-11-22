import type { PlanDocument } from '../model/plan';
import type { MatchSketchDB } from '../store/db';
import { savePlanDocument, StalePlanError } from '../store/plans';
import { conflictName, keepAsConflictedCopy, type ConflictCopy } from '../sync/engine';

export type PlanSaver = {
	/** The stored plan's `updatedAt` this editor's document is based on. */
	readonly base: string;
	/** The versions the next edit may follow: `base`, plus the save in flight (for the journal). */
	readonly bases: string[];
	save(document: PlanDocument, at: string): Promise<void>;
};

/**
 * Saves the editor's document without ever writing over another device's version: each save
 * expects the version the editor last loaded or wrote. If a pull or conflict replaced the plan
 * meanwhile, the edit is kept as a conflicted copy (later saves go to the copy) and `onStale`
 * tells the page to reopen the plan as it now is.
 */
export function createPlanSaver(options: {
	db: MatchSketchDB;
	planId: string;
	base: string;
	onStale: (copy: ConflictCopy | null) => void;
	now?: () => Date;
}): PlanSaver {
	const { db, planId, onStale, now = () => new Date() } = options;
	let base = options.base;
	let copyId: string | null = null;
	let staleAt: Date | null = null;
	let inFlight: string | null = null;
	return {
		get base() {
			return base;
		},
		get bases() {
			return inFlight ? [base, inFlight] : [base];
		},
		async save(document, at) {
			if (copyId && staleAt) {
				// The copy keeps its conflicted name while the editor catches up.
				const name = conflictName(document.brief.stageName.trim() || 'Untitled stage', staleAt);
				await savePlanDocument(
					db,
					copyId,
					{ ...document, brief: { ...document.brief, stageName: name } },
					at
				);
				return;
			}
			if (staleAt) return;
			inFlight = at;
			try {
				await savePlanDocument(db, planId, document, at, base);
				base = at;
			} catch (e) {
				if (!(e instanceof StalePlanError)) throw e;
				staleAt = now();
				const copy = await keepAsConflictedCopy(db, planId, document, staleAt);
				copyId = copy?.id ?? null;
				onStale(copy);
			} finally {
				inFlight = null;
			}
		}
	};
}
