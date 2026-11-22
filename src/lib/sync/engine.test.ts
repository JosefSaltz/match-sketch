import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { emptyPlanDocument } from '../model/plan';
import { createCanvas, updateCanvas } from '../store/canvases';
import { createDb, type MatchSketchDB } from '../store/db';
import { createMatch, updateMatch } from '../store/matches';
import { createPlan, deletePlan, getPlan, savePlanDocument } from '../store/plans';
import { getSetting, SYNC_CONFLICTS, SYNC_CURSOR } from '../store/settings';
import { conflictName, syncOnce, type Transport } from './engine';
import type { PullResponse, PushItem, PushResult, ServerRecord, WireRecord } from './wire';

/** An in-memory server with the push/pull rules of src/lib/server/sync.ts. */
class FakeServer implements Transport {
	rows = new Map<string, { record: ServerRecord; seq: number }>();
	seq = 0;
	/** Runs before a push answers, e.g. to edit the device's record while the push is in flight. */
	beforeAnswer: (() => Promise<void>) | null = null;

	async push(items: PushItem[]): Promise<PushResult[]> {
		const results: PushResult[] = items.map(({ record, baseVersion }) => {
			const ref = { table: record.table, id: record.id };
			const row = this.rows.get(record.id);
			if (row && row.record.version !== baseVersion) {
				return { status: 'conflict', ...ref, server: row.record };
			}
			const version = row ? row.record.version + 1 : 1;
			this.rows.set(record.id, { record: { ...record, version }, seq: ++this.seq });
			return { status: 'accepted', ...ref, version };
		});
		if (this.beforeAnswer) await this.beforeAnswer();
		return results;
	}

	pull(cursor: number): Promise<PullResponse> {
		const after = [...this.rows.values()]
			.filter((r) => r.seq > cursor)
			.sort((a, b) => a.seq - b.seq);
		return Promise.resolve({
			records: after.map((r) => r.record),
			cursor: after.at(-1)?.seq ?? cursor,
			more: false
		});
	}

	/** Another device's edit, straight into the server. */
	edit(record: WireRecord) {
		const row = this.rows.get(record.id);
		this.rows.set(record.id, {
			record: { ...record, version: (row?.record.version ?? 0) + 1 },
			seq: ++this.seq
		});
	}
}

const bay = { name: 'Bay 4', widthFt: 90, depthFt: 60, unit: 'yd' as const };
const at = new Date('2026-11-22T15:04:00');
let db: MatchSketchDB;
let server: FakeServer;

beforeEach(() => {
	db = createDb(`sync-${crypto.randomUUID()}`);
	server = new FakeServer();
});

async function namedPlan(name: string) {
	const plan = await createPlan(db, { canvas: bay, sourceCanvasId: null });
	const document = emptyPlanDocument();
	document.brief.stageName = name;
	return savePlanDocument(db, plan.id, document);
}

describe('syncOnce: push', () => {
	it('pushes a new plan and marks it clean at version 1', async () => {
		const plan = await namedPlan('Bay drill');
		const outcome = await syncOnce(db, server, () => at);
		expect(outcome.pushed).toBe(1);
		expect(await getPlan(db, plan.id)).toMatchObject({ version: 1, dirty: 0 });
		expect(server.rows.get(plan.id)?.record).toMatchObject({ table: 'plans', version: 1 });
	});

	it('keeps an edit made while its push is in flight (Review Focus #2)', async () => {
		const plan = await namedPlan('First');
		server.beforeAnswer = async () => {
			server.beforeAnswer = null;
			const edited = emptyPlanDocument();
			edited.brief.stageName = 'Second';
			await savePlanDocument(db, plan.id, edited);
		};
		await syncOnce(db, server, () => at);
		expect(await getPlan(db, plan.id)).toMatchObject({ version: 1, dirty: 1 });
		await syncOnce(db, server, () => at);
		expect(await getPlan(db, plan.id)).toMatchObject({ version: 2, dirty: 0 });
		const record = server.rows.get(plan.id)?.record;
		expect(record?.table === 'plans' && record.document).toMatchObject({
			brief: { stageName: 'Second' }
		});
	});
});

describe('syncOnce: conflicts', () => {
	it("keeps the server's plan and saves this device's version as a conflicted copy", async () => {
		const plan = await namedPlan('Bay drill');
		await syncOnce(db, server, () => at);
		const theirs = server.rows.get(plan.id)!.record as Extract<ServerRecord, { table: 'plans' }>;
		server.edit({
			...theirs,
			document: { ...emptyPlanDocument(), brief: { ...emptyPlanDocument().brief, stageName: 'B' } }
		} as WireRecord);
		const mine = emptyPlanDocument();
		mine.brief.stageName = 'A';
		await savePlanDocument(db, plan.id, mine);

		const outcome = await syncOnce(db, server, () => at);

		expect(await getPlan(db, plan.id)).toMatchObject({
			version: 2,
			dirty: 0,
			document: { brief: { stageName: 'B' } }
		});
		expect(outcome.conflicts).toHaveLength(1);
		const copy = await getPlan(db, outcome.conflicts[0].id);
		expect(copy?.document.brief.stageName).toBe('A (conflicted copy, Nov 22 3:04 PM)');
		// The copy is a new record; it goes up on the next sync.
		expect(copy).toMatchObject({ version: 0, dirty: 1 });
		expect(JSON.parse((await getSetting(db, SYNC_CONFLICTS)) ?? '[]')).toEqual(outcome.conflicts);
	});

	it('names conflicted canvas and match copies the same way', async () => {
		const canvas = await createCanvas(db, bay);
		const match = await createMatch(db, { name: 'SOF', date: '2026-05-02' });
		await syncOnce(db, server, () => at);
		for (const id of [canvas.id, match.id]) server.edit(server.rows.get(id)!.record as WireRecord);
		await updateCanvas(db, canvas.id, { ...bay, name: 'Bay 5' });
		await updateMatch(db, match.id, { name: 'SOF Day 2', date: '2026-05-02' });

		const outcome = await syncOnce(db, server, () => at);

		expect(outcome.conflicts.map((c) => c.name).sort()).toEqual([
			'Bay 5 (conflicted copy, Nov 22 3:04 PM)',
			'SOF Day 2 (conflicted copy, Nov 22 3:04 PM)'
		]);
	});

	it('formats the conflicted name in a readable local time', () => {
		expect(conflictName('Stage 3', new Date('2026-01-05T09:07:00'))).toBe(
			'Stage 3 (conflicted copy, Jan 5 9:07 AM)'
		);
	});
});

describe('syncOnce: pull', () => {
	it('applies records from other devices, keeps deletions, and stores the cursor', async () => {
		const plan = await namedPlan('Shared');
		await syncOnce(db, server, () => at);
		const record = server.rows.get(plan.id)!.record as WireRecord;
		server.edit({ ...record, deletedAt: '2026-11-22T16:00:00.000Z' });
		const outcome = await syncOnce(db, server, () => at);
		expect(outcome.pulled).toBeGreaterThan(0);
		expect(await getPlan(db, plan.id)).toBeUndefined(); // deleted
		expect(Number(await getSetting(db, SYNC_CURSOR))).toBe(server.seq);
	});

	it('does not overwrite a record with local changes', async () => {
		const plan = await namedPlan('Local');
		await syncOnce(db, server, () => at);
		const local = emptyPlanDocument();
		local.brief.stageName = 'Still local';
		await savePlanDocument(db, plan.id, local);
		// A pull on its own (no push) must leave the dirty record alone.
		server.edit(server.rows.get(plan.id)!.record as WireRecord);
		const page = await server.pull(0);
		const { applyPulled } = await import('./engine');
		for (const record of page.records) await applyPulled(db, record);
		expect((await getPlan(db, plan.id))?.document.brief.stageName).toBe('Still local');
	});

	it('leaves a plan from a newer app alone and asks for a reload', async () => {
		const plan = await namedPlan('Future');
		await syncOnce(db, server, () => at);
		const record = server.rows.get(plan.id)!.record;
		server.rows.set(plan.id, {
			record: {
				...record,
				version: 2,
				schemaVersion: 2,
				document: { future: true }
			} as ServerRecord,
			seq: ++server.seq
		});
		const outcome = await syncOnce(db, server, () => at);
		expect(outcome.needsReload).toBe(true);
		expect((await getPlan(db, plan.id))?.version).toBe(1);
		expect(Number(await getSetting(db, SYNC_CURSOR))).toBe(server.seq);
	});

	it('pushes a deletion', async () => {
		const plan = await namedPlan('Gone');
		await syncOnce(db, server, () => at);
		await deletePlan(db, plan.id);
		await syncOnce(db, server, () => at);
		expect(server.rows.get(plan.id)?.record.deletedAt).not.toBeNull();
	});
});
