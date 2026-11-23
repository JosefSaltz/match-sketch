import type { PlanDocument } from '../model/plan';
import type { Share } from '../model/share';
import type { MatchSketchDB } from '../store/db';
import { savePlanDocument, StalePlanError } from '../store/plans';
import { now as stamp } from '../store/records';
import { savePlanShare } from '../store/share';
import { conflictName, keepAsConflictedCopy, type ConflictCopy } from '../sync/engine';

export type PlanSaver = {
	/** The stored plan's `updatedAt` this editor's document is based on. */
	readonly base: string;
	/** The versions the next edit may follow: `base`, plus writes not done yet (for the journal). */
	readonly bases: string[];
	save(document: PlanDocument, at: string): Promise<void>;
	/**
	 * Saves the plan's share link. Runs after any save already asked for, on the same version
	 * chain, so turning sharing on mid-save never looks like another device's edit.
	 */
	setShare(share: Share): Promise<void>;
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
	/** Versions asked for and not yet written (in order): the next edit may follow any of them. */
	const pending: string[] = [];
	/** Saves and share changes run one at a time, in the order they were asked for. */
	let chain: Promise<unknown> = Promise.resolve();
	const queued = (op: () => Promise<void>): Promise<void> => {
		const run = chain.then(op, op);
		chain = run.catch(() => {});
		return run;
	};

	/** Writes through `write` on the current base; a stale base keeps the edit as a copy. */
	async function onBase(at: string, write: () => Promise<unknown>, document?: PlanDocument) {
		try {
			await write();
			base = at;
		} catch (e) {
			if (!(e instanceof StalePlanError)) throw e;
			staleAt = now();
			const copy = document ? await keepAsConflictedCopy(db, planId, document, staleAt) : null;
			copyId = copy?.id ?? null;
			onStale(copy);
		}
	}

	/** Queues a write stamped `at`, counted in `bases` from now until it is done. */
	function track(at: string, op: () => Promise<void>): Promise<void> {
		pending.push(at);
		return queued(op).finally(() => pending.splice(pending.indexOf(at), 1));
	}

	return {
		get base() {
			return base;
		},
		get bases() {
			return [base, ...pending];
		},
		save(document, at) {
			return track(at, () => saveNow(document, at));
		},
		setShare(share) {
			const at = stamp();
			return track(at, async () => {
				// After the plan went stale, the page reopens it; the change is made there again.
				if (staleAt) return;
				const result = await savePlanShare(db, planId, share, at);
				// Follow the write only if it was on our version; otherwise the next document save
				// finds the other version and keeps the edit as a conflicted copy, as usual.
				if (result?.replaced === base) base = at;
			});
		}
	};

	async function saveNow(document: PlanDocument, at: string): Promise<void> {
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
		await onBase(at, () => savePlanDocument(db, planId, document, at, base), document);
	}
}
