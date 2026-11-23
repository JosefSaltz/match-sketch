import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDb, type MatchSketchDB } from '../store/db';
import { createPlan } from '../store/plans';
import type { Transport } from './engine';
import { createLoop, initialSyncState, type SyncState, type Timers } from './loop';

/** Timers that only move when the test says so. */
function manualTimers() {
	let now = 0;
	let next = 1;
	const due = new Map<number, { at: number; fn: () => void; every?: number }>();
	const timers: Timers = {
		setTimeout: (fn, ms) => (due.set(next, { at: now + ms, fn }), next++),
		clearTimeout: (id) => void due.delete(id as number),
		setInterval: (fn, ms) => (due.set(next, { at: now + ms, fn, every: ms }), next++),
		clearInterval: (id) => void due.delete(id as number)
	};
	function advance(ms: number) {
		const end = now + ms;
		for (;;) {
			const [id, t] = [...due.entries()].sort((a, b) => a[1].at - b[1].at)[0] ?? [];
			if (!t || t.at > end) break;
			now = t.at;
			if (t.every) t.at += t.every;
			else due.delete(id);
			t.fn();
		}
		now = end;
	}
	return { timers, advance };
}

function fakeTransport() {
	const calls = { push: 0, pull: 0 };
	let fail = false;
	const transport: Transport = {
		push(items) {
			calls.push += 1;
			if (fail) return Promise.reject(new Error('down'));
			return Promise.resolve(
				items.map((i) => ({
					status: 'accepted' as const,
					table: i.record.table,
					id: i.record.id,
					version: i.baseVersion + 1
				}))
			);
		},
		pull() {
			calls.pull += 1;
			if (fail) return Promise.reject(new Error('down'));
			return Promise.resolve({ records: [], cursor: 0, more: false });
		}
	};
	return { transport, calls, setFail: (f: boolean) => (fail = f) };
}

const bay = { name: 'Bay', widthFt: 90, depthFt: 60, unit: 'yd' as const };
let db: MatchSketchDB;
let state: SyncState;
let win: EventTarget;

beforeEach(() => {
	db = createDb(`loop-${crypto.randomUUID()}`);
	state = initialSyncState(true);
	win = new EventTarget();
});

function start(transport: Transport, timers: Timers) {
	return createLoop(state, { db, accountId: 'user-1', transport, timers, win, doc: null });
}

describe('the sync loop', () => {
	it('syncs on start, then 2 s after a local edit settles, once for a burst of edits', async () => {
		const { timers, advance } = manualTimers();
		const { transport, calls } = fakeTransport();
		const loop = start(transport, timers);
		await vi.waitFor(() => expect(calls.pull).toBe(1));
		await vi.waitFor(() => expect(state.syncing).toBe(false));

		await createPlan(db, { canvas: bay, sourceCanvasId: null });
		advance(1000);
		await createPlan(db, { canvas: bay, sourceCanvasId: null });
		advance(1999);
		expect(calls.pull).toBe(1);
		advance(1);
		await vi.waitFor(() => expect(calls.pull).toBe(2));
		expect(calls.push).toBe(1);
		await vi.waitFor(() => expect(state.pending).toBe(0));
		loop.stop();
	});

	it('shows a local edit as pending straight away', async () => {
		const { timers } = manualTimers();
		const { transport, calls } = fakeTransport();
		const loop = start(transport, timers);
		await vi.waitFor(() => expect(calls.pull).toBe(1));
		await vi.waitFor(() => expect(state.syncing).toBe(false));
		expect(state.pending).toBe(0);
		await createPlan(db, { canvas: bay, sourceCanvasId: null });
		expect(state.pending).toBeGreaterThan(0);
		loop.stop();
	});

	it('syncs when the device comes back online and shows it was offline', async () => {
		const { timers } = manualTimers();
		const { transport, calls } = fakeTransport();
		const loop = start(transport, timers);
		await vi.waitFor(() => expect(calls.pull).toBe(1));
		win.dispatchEvent(new Event('offline'));
		expect(state.online).toBe(false);
		win.dispatchEvent(new Event('online'));
		expect(state.online).toBe(true);
		await vi.waitFor(() => expect(calls.pull).toBe(2));
		loop.stop();
	});

	it('marks a failed sync and retries on the next interval', async () => {
		const { timers, advance } = manualTimers();
		const { transport, calls, setFail } = fakeTransport();
		setFail(true);
		const loop = start(transport, timers);
		await vi.waitFor(() => expect(state.failed).toBe(true));
		setFail(false);
		advance(30_000);
		await vi.waitFor(() => expect(state.failed).toBe(false));
		expect(calls.pull).toBe(2);
		loop.stop();
	});

	it('stops syncing when stopped', async () => {
		const { timers, advance } = manualTimers();
		const { transport, calls } = fakeTransport();
		const loop = start(transport, timers);
		await vi.waitFor(() => expect(calls.pull).toBe(1));
		await vi.waitFor(() => expect(state.syncing).toBe(false));
		loop.stop();
		await createPlan(db, { canvas: bay, sourceCanvasId: null });
		advance(60_000);
		win.dispatchEvent(new Event('online'));
		await new Promise((r) => setTimeout(r, 50));
		expect(calls.pull).toBe(1);
	});

	it('lets sign-out wait for a round that is still running', async () => {
		const { timers } = manualTimers();
		let release!: () => void;
		const transport: Transport = {
			push: () => Promise.resolve([]),
			pull: () =>
				new Promise((resolve) => {
					release = () => resolve({ records: [], cursor: 0, more: false });
				})
		};
		const loop = start(transport, timers);
		await vi.waitFor(() => expect(release).toBeTypeOf('function'));
		loop.stop();
		let settled = false;
		const waiting = loop.settled().then(() => (settled = true));
		await new Promise((r) => setTimeout(r, 20));
		expect(settled).toBe(false);
		release();
		await waiting;
		expect(settled).toBe(true);
	});

	it('pauses syncing once a reload is needed', async () => {
		const { timers } = manualTimers();
		const { transport, calls } = fakeTransport();
		const loop = start(transport, timers);
		await vi.waitFor(() => expect(calls.pull).toBe(1));
		await vi.waitFor(() => expect(state.syncing).toBe(false));
		state.needsReload = true;
		await loop.syncNow();
		win.dispatchEvent(new Event('online'));
		await new Promise((r) => setTimeout(r, 20));
		expect(calls.pull).toBe(1);
		loop.stop();
	});

	it("pauses for another account's data and says so", async () => {
		const { timers } = manualTimers();
		const { transport, calls } = fakeTransport();
		const first = createLoop(state, {
			db,
			accountId: 'user-1',
			transport,
			timers,
			win,
			doc: null
		});
		await first.ready;
		await vi.waitFor(() => expect(state.syncing).toBe(false));
		first.stop();
		const other = initialSyncState(true);
		const loop = createLoop(other, { db, accountId: 'user-2', transport, timers, win, doc: null });
		await loop.ready;
		expect(other.otherAccount).toBe(true);
		const pulls = calls.pull;
		win.dispatchEvent(new Event('online'));
		await new Promise((r) => setTimeout(r, 50));
		expect(calls.pull).toBe(pulls);
		loop.stop();
	});
});
