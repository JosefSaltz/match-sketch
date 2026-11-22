import type { MatchSketchDB } from '../store/db';
import { setSetting, SYNC_CONFLICTS } from '../store/settings';
import { addedNotice, adoptDevice, unsyncedCount } from './device';
import { pendingConflicts, syncOnce, type ConflictCopy, type Transport } from './engine';
import { SYNC_TABLES, type SyncTable } from './wire';

/** Wait after the last local edit before syncing. */
export const SYNC_DELAY_MS = 2000;
/** Sync this often while online, to pick up other devices' changes. */
export const SYNC_INTERVAL_MS = 30_000;
/** One tab syncs at a time. */
export const SYNC_LOCK = 'match-sketch-sync';

export type SyncState = {
	online: boolean;
	syncing: boolean;
	/** Records with changes not yet synced. */
	pending: number;
	conflicts: ConflictCopy[];
	failed: boolean;
	needsReload: boolean;
	/** The device holds another account's data; syncing is paused. */
	otherAccount: boolean;
	/** The first-sign-in message, until dismissed. */
	notice: string | null;
	/** Bumped when a pull changes records, with the records it changed. */
	revision: number;
	changed: { table: SyncTable; id: string }[];
};

export function initialSyncState(online: boolean): SyncState {
	return {
		online,
		syncing: false,
		pending: 0,
		conflicts: [],
		failed: false,
		needsReload: false,
		otherAccount: false,
		notice: null,
		revision: 0,
		changed: []
	};
}

export type Timers = {
	setTimeout(fn: () => void, ms: number): unknown;
	clearTimeout(id: unknown): void;
	setInterval(fn: () => void, ms: number): unknown;
	clearInterval(id: unknown): void;
};

export type LoopOptions = {
	db: MatchSketchDB;
	accountId: string;
	transport: Transport;
	timers: Timers;
	/** Fires `online` and `offline`. */
	win: EventTarget | null;
	/** Fires `visibilitychange`. */
	doc: Pick<Document, 'visibilityState' | 'addEventListener' | 'removeEventListener'> | null;
	locks?: Pick<LockManager, 'request'> | null;
};

export type Loop = {
	/** Resolves once the device is adopted and the first sync has started. */
	ready: Promise<void>;
	syncNow(): Promise<void>;
	dismissConflicts(): Promise<void>;
	stop(): void;
};

/**
 * Keeps `state` and the server in step: syncs on start, 2 s after local edits settle, every
 * 30 s, on reconnect and when the tab becomes visible (plan 5b Global Constraints).
 */
export function createLoop(state: SyncState, options: LoopOptions): Loop {
	const { db, accountId, transport, timers, win, doc, locks } = options;
	let stopped = false;
	let ready = false;
	let running: Promise<void> | null = null;
	let again = false;
	let debounce: unknown = null;
	let countTimer: unknown = null;

	async function refreshPending() {
		state.pending = await unsyncedCount(db);
	}

	function run(): Promise<void> {
		if (stopped || !ready || state.otherAccount || !state.online) return Promise.resolve();
		if (running) {
			again = true;
			return running;
		}
		running = (async () => {
			state.syncing = true;
			try {
				const once = () => syncOnce(db, transport);
				const outcome = locks ? await locks.request(SYNC_LOCK, once) : await once();
				state.failed = outcome.stuck > 0;
				state.needsReload ||= outcome.needsReload;
				if (outcome.changed.length > 0) {
					state.changed = outcome.changed;
					state.revision += 1;
				}
				state.conflicts = await pendingConflicts(db);
			} catch {
				state.failed = true;
			} finally {
				state.syncing = false;
				await refreshPending().catch(() => {});
				running = null;
				if (again && !stopped) {
					again = false;
					void run();
				}
			}
		})();
		return running;
	}

	function onLocalChange() {
		if (stopped) return;
		timers.clearTimeout(debounce);
		debounce = timers.setTimeout(() => void run(), SYNC_DELAY_MS);
		// Hooks run inside the write's transaction; count once it has committed.
		timers.clearTimeout(countTimer);
		countTimer = timers.setTimeout(() => void refreshPending(), 300);
	}

	// Writes from the sync itself are clean (dirty 0) and don't trigger another sync.
	const unhook = SYNC_TABLES.map((name) => {
		const table = db.table<{ dirty: 0 | 1 }>(name);
		const creating = (_key: unknown, obj: { dirty: 0 | 1 }) => {
			if (obj.dirty === 1) onLocalChange();
		};
		const updating = (mods: object, _key: unknown, obj: { dirty: 0 | 1 }) => {
			const dirty = 'dirty' in mods ? mods.dirty : obj.dirty;
			if (dirty === 1) onLocalChange();
		};
		table.hook('creating', creating);
		table.hook('updating', updating);
		return () => {
			table.hook('creating').unsubscribe(creating);
			table.hook('updating').unsubscribe(updating);
		};
	});

	const onOnline = () => {
		state.online = true;
		void run();
	};
	const onOffline = () => {
		state.online = false;
	};
	const onVisible = () => {
		if (doc?.visibilityState === 'visible') void run();
	};
	win?.addEventListener('online', onOnline);
	win?.addEventListener('offline', onOffline);
	doc?.addEventListener('visibilitychange', onVisible);
	const interval = timers.setInterval(() => void run(), SYNC_INTERVAL_MS);

	const readyPromise = (async () => {
		const adoption = await adoptDevice(db, accountId);
		if (stopped) return;
		if (adoption.state === 'other-account') {
			state.otherAccount = true;
			return;
		}
		state.otherAccount = false;
		if (adoption.state === 'adopted') state.notice = addedNotice(adoption.added);
		state.conflicts = await pendingConflicts(db);
		await refreshPending();
		ready = true;
		void run();
	})();

	return {
		ready: readyPromise,
		syncNow: run,
		async dismissConflicts() {
			await setSetting(db, SYNC_CONFLICTS, '[]');
			state.conflicts = [];
		},
		stop() {
			stopped = true;
			timers.clearTimeout(debounce);
			timers.clearTimeout(countTimer);
			timers.clearInterval(interval);
			win?.removeEventListener('online', onOnline);
			win?.removeEventListener('offline', onOffline);
			doc?.removeEventListener('visibilitychange', onVisible);
			for (const off of unhook) off();
		}
	};
}
