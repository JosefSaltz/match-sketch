import type { MatchSketchDB } from '../store/db';
import type { Transport } from './engine';
import { createLoop, initialSyncState, SYNC_LOCK, type Loop, type SyncState } from './loop';

/** The app's sync status, shown by SyncStatus.svelte and read by pages after a pull. */
export const syncState: SyncState = $state(
	initialSyncState(typeof navigator === 'undefined' ? true : navigator.onLine)
);

let current: Loop | null = null;

const browserTimers = {
	setTimeout: (fn: () => void, ms: number) => setTimeout(fn, ms),
	clearTimeout: (id: unknown) => clearTimeout(id as ReturnType<typeof setTimeout>),
	setInterval: (fn: () => void, ms: number) => setInterval(fn, ms),
	clearInterval: (id: unknown) => clearInterval(id as ReturnType<typeof setInterval>)
};

/** Starts syncing the signed-in account on this device; returns a function that stops it. */
export function startSync(options: {
	db: MatchSketchDB;
	accountId: string;
	transport: Transport;
}): () => void {
	current?.stop();
	const loop = createLoop(syncState, {
		...options,
		timers: browserTimers,
		win: window,
		doc: document,
		locks: navigator.locks ?? null
	});
	current = loop;
	return () => {
		loop.stop();
		if (current === loop) current = null;
	};
}

/** Syncs now (e.g. before sign-out); resolves when the round is done. */
export function syncNow(): Promise<void> {
	return current?.syncNow() ?? Promise.resolve();
}

/** Clears the conflict indicator once the MD has seen the copies. */
export function dismissConflicts(): Promise<void> {
	return current?.dismissConflicts() ?? Promise.resolve();
}

/** Stops syncing and waits for a round that is still running (sign-out clears the device next). */
export async function stopSync(): Promise<void> {
	const loop = current;
	current = null;
	loop?.stop();
	await loop?.settled();
}

/**
 * Runs `fn` while no tab is in a sync round: sync rounds hold the same lock, so sign-out can
 * clear the device without a round writing the account's records back afterwards.
 */
export function withSyncLock<T>(fn: () => Promise<T>): Promise<T> {
	return navigator.locks ? navigator.locks.request(SYNC_LOCK, fn) : fn();
}
