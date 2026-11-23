import { eq, sql } from 'drizzle-orm';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { emptyPlanDocument } from '../model/plan';
import { newShareId } from '../model/share';
import { readPlanDocument } from '../model/upgrade';
import { WireRecordSchema, type WireRecord } from '../sync/wire';
import { createDatabase } from './db/client';
import { canvases, plans } from './db/schema';
import { pullChanges, pushRecords } from './sync';
import { testAdminClient, testDatabaseUrl, uniqueEmail } from './testing/supabase';

const admin = testAdminClient();
const database = createDatabase(testDatabaseUrl());
const db = database.db;
const created: string[] = [];

async function createOwner(): Promise<string> {
	const { data, error } = await admin.auth.admin.createUser({
		email: uniqueEmail('owner'),
		password: 'longenough1',
		email_confirm: true
	});
	if (error || !data.user) throw error ?? new Error('no user');
	created.push(data.user.id);
	return data.user.id;
}

type CanvasWire = Extract<WireRecord, { table: 'canvases' }>;

function canvas(name = 'Bay', id: string = crypto.randomUUID()): CanvasWire {
	return {
		table: 'canvases',
		id,
		updatedAt: new Date().toISOString(),
		deletedAt: null,
		name,
		widthFt: 90,
		depthFt: 60,
		unit: 'yd'
	};
}

function plan(): Extract<WireRecord, { table: 'plans' }> {
	return {
		table: 'plans',
		id: crypto.randomUUID(),
		updatedAt: new Date().toISOString(),
		deletedAt: null,
		matchId: null,
		stageOrder: null,
		sourceCanvasId: null,
		widthFt: 90,
		depthFt: 60,
		unit: 'yd',
		schemaVersion: 2,
		document: emptyPlanDocument()
	};
}

/** Every record the owner has, by following pull cursors from 0. */
async function pullAll(ownerId: string, limit?: number) {
	const records = [];
	let cursor = 0;
	for (;;) {
		const page = await pullChanges(db, ownerId, cursor, limit);
		records.push(...page.records);
		cursor = page.cursor;
		if (!page.more) return { records, cursor };
	}
}

afterEach(async () => {
	for (const id of created.splice(0)) await admin.auth.admin.deleteUser(id);
});

afterAll(async () => {
	await database.close();
});

/** A plan document as an app before schema version 2 wrote it. */
function v1Document(procedure: string) {
	const { steps, ...brief } = emptyPlanDocument().brief;
	void steps;
	return { ...emptyPlanDocument(), brief: { ...brief, procedure } };
}

describe('plan schema version 2', () => {
	it('stores a version 1 push from an older app as version 2', async () => {
		const owner = await createOwner();
		const p = { ...plan(), schemaVersion: 1, document: v1Document('Start\nEngage T1') };
		const [result] = await pushRecords(db, owner, [
			{ record: WireRecordSchema.parse(p), baseVersion: 0 }
		]);
		expect(result.status).toBe('accepted');
		const [row] = await db.select().from(plans).where(eq(plans.id, p.id));
		expect(row.schemaVersion).toBe(2);
		expect(row.document.brief.steps.map((s) => s.text)).toEqual(['Start', 'Engage T1']);
	});

	it('pulls a row a version 1 app saved as version 2', async () => {
		const owner = await createOwner();
		const p = plan();
		await db.insert(plans).values({
			...p,
			ownerId: owner,
			version: 1,
			updatedAt: new Date(p.updatedAt),
			deletedAt: null,
			schemaVersion: 1,
			document: v1Document('Start') as never
		});
		const { records } = await pullAll(owner);
		const pulled = records.find((r) => r.id === p.id);
		if (pulled?.table !== 'plans') throw new Error('expected the plan');
		expect(pulled.schemaVersion).toBe(2);
		expect(readPlanDocument(pulled.document).brief.steps.map((s) => s.text)).toEqual(['Start']);
	});
});

describe('share links', () => {
	const tokenA = 'AbCdEfGhIjKlMnOpQrStUv';

	it('round-trips a pushed share through pull', async () => {
		const owner = await createOwner();
		const p = { ...plan(), share: { id: newShareId(), on: true } };
		await pushRecords(db, owner, [{ record: p, baseVersion: 0 }]);
		const { records } = await pullAll(owner);
		expect(records.find((r) => r.id === p.id)).toMatchObject({ share: p.share });
	});

	it('keeps the stored share when an older app pushes none', async () => {
		const owner = await createOwner();
		const p = { ...plan(), share: { id: newShareId(), on: true } };
		await pushRecords(db, owner, [{ record: p, baseVersion: 0 }]);
		const { share, ...older } = p;
		void share;
		const [result] = await pushRecords(db, owner, [{ record: older, baseVersion: 1 }]);
		expect(result.status).toBe('accepted');
		const [row] = await db.select().from(plans).where(eq(plans.id, p.id));
		expect(row).toMatchObject({ shareId: p.share.id, shareOn: true });
	});

	it('rejects a token another plan or match holds, and applies the rest', async () => {
		const owner = await createOwner();
		const other = await createOwner();
		const theirs = { ...plan(), share: { id: tokenA, on: true } };
		await pushRecords(db, other, [{ record: theirs, baseVersion: 0 }]);
		const match = {
			table: 'matches' as const,
			id: crypto.randomUUID(),
			updatedAt: new Date().toISOString(),
			deletedAt: null,
			name: 'SOF',
			date: '',
			share: { id: tokenA, on: true }
		};
		const fine = plan();
		const results = await pushRecords(db, owner, [
			{ record: { ...plan(), share: { id: tokenA, on: false } }, baseVersion: 0 },
			{ record: match, baseVersion: 0 },
			{ record: fine, baseVersion: 0 }
		]);
		expect(results.map((r) => r.status)).toEqual(['rejected', 'rejected', 'accepted']);
		expect(results[0]).toMatchObject({ reason: 'invalid' });
	});
});

describe('share tokens stay with their first owner', () => {
	const matchWith = (id: string, token: string) => ({
		table: 'matches' as const,
		id,
		updatedAt: new Date().toISOString(),
		deletedAt: null,
		name: 'Not yours',
		date: '',
		share: { id: token, on: true }
	});

	it("rejects a match that borrows a shared plan's id and token", async () => {
		const victim = await createOwner();
		const attacker = await createOwner();
		const shared = { ...plan(), share: { id: newShareId(), on: true } };
		await pushRecords(db, victim, [{ record: shared, baseVersion: 0 }]);
		const [result] = await pushRecords(db, attacker, [
			{ record: matchWith(shared.id, shared.share.id), baseVersion: 0 }
		]);
		expect(result).toMatchObject({ status: 'rejected', reason: 'invalid' });
	});

	it('never hands a reset link to another account, so old QR codes stay safe', async () => {
		const victim = await createOwner();
		const attacker = await createOwner();
		const old = newShareId();
		const shared = { ...plan(), share: { id: old, on: true } };
		await pushRecords(db, victim, [{ record: shared, baseVersion: 0 }]);
		// The victim resets the link: the old token is free in plans and matches, but still theirs.
		await pushRecords(db, victim, [
			{ record: { ...shared, share: { id: newShareId(), on: true } }, baseVersion: 1 }
		]);
		const [result] = await pushRecords(db, attacker, [
			{ record: { ...plan(), share: { id: old, on: true } }, baseVersion: 0 }
		]);
		expect(result).toMatchObject({ status: 'rejected', reason: 'invalid' });
		// The owner may bring their old token back.
		const [mine] = await pushRecords(db, victim, [
			{ record: { ...plan(), share: { id: old, on: true } }, baseVersion: 0 }
		]);
		expect(mine.status).toBe('accepted');
	});
});

describe('pushRecords', () => {
	it('accepts a new record at version 1', async () => {
		const owner = await createOwner();
		const record = canvas();
		expect(await pushRecords(db, owner, [{ record, baseVersion: 0 }])).toEqual([
			{ status: 'accepted', table: 'canvases', id: record.id, version: 1 }
		]);
	});

	it('accepts an update based on the current version', async () => {
		const owner = await createOwner();
		const record = canvas('Before');
		await pushRecords(db, owner, [{ record, baseVersion: 0 }]);
		const [result] = await pushRecords(db, owner, [
			{ record: { ...record, name: 'After' }, baseVersion: 1 }
		]);
		expect(result).toMatchObject({ status: 'accepted', version: 2 });
		const [row] = await db.select().from(canvases).where(eq(canvases.id, record.id));
		expect(row.name).toBe('After');
	});

	it('answers a stale base version with the server record', async () => {
		const owner = await createOwner();
		const record = canvas('Server');
		await pushRecords(db, owner, [{ record, baseVersion: 0 }]);
		await pushRecords(db, owner, [{ record: { ...record, name: 'Server 2' }, baseVersion: 1 }]);
		const [result] = await pushRecords(db, owner, [
			{ record: { ...record, name: 'Stale' }, baseVersion: 1 }
		]);
		expect(result).toMatchObject({
			status: 'conflict',
			server: { table: 'canvases', id: record.id, name: 'Server 2', version: 2 }
		});
	});

	it("leaves another user's record alone and says nothing about it (Review Focus #4)", async () => {
		const owner = await createOwner();
		const intruder = await createOwner();
		const record = canvas('Mine');
		await pushRecords(db, owner, [{ record, baseVersion: 0 }]);
		const [result] = await pushRecords(db, intruder, [
			{ record: { ...record, name: 'Taken' }, baseVersion: 1 }
		]);
		expect(result).toEqual({
			status: 'rejected',
			table: 'canvases',
			id: record.id,
			reason: 'not-found'
		});
		const [row] = await db.select().from(canvases).where(eq(canvases.id, record.id));
		expect(row).toMatchObject({ name: 'Mine', ownerId: owner, version: 1 });
	});
});

describe('pullChanges', () => {
	it("returns the owner's records in change order, deleted ones included, and nobody else's", async () => {
		const owner = await createOwner();
		const other = await createOwner();
		const a = canvas('A');
		const b = canvas('B');
		await pushRecords(db, owner, [
			{ record: a, baseVersion: 0 },
			{ record: b, baseVersion: 0 }
		]);
		await pushRecords(db, other, [{ record: canvas('Theirs'), baseVersion: 0 }]);
		await pushRecords(db, owner, [
			{ record: { ...a, deletedAt: new Date().toISOString() }, baseVersion: 1 }
		]);
		const { records } = await pullAll(owner);
		expect(records.map((r) => [r.id, r.deletedAt !== null])).toEqual([
			[b.id, false],
			[a.id, true]
		]);
	});

	it('pages through 250 records with the cursor', async () => {
		const owner = await createOwner();
		const items = Array.from({ length: 250 }, (_, i) => ({
			record: canvas(`Bay ${i}`),
			baseVersion: 0
		}));
		for (let i = 0; i < items.length; i += 50) await pushRecords(db, owner, items.slice(i, i + 50));
		const first = await pullChanges(db, owner, 0);
		expect(first.records).toHaveLength(200);
		expect(first.more).toBe(true);
		const second = await pullChanges(db, owner, first.cursor);
		expect(second.records).toHaveLength(50);
		expect(second.more).toBe(false);
		expect(new Set([...first.records, ...second.records].map((r) => r.id)).size).toBe(250);
	});

	it('reads every table as of one moment, so a push landing mid-pull is not half seen', async () => {
		const owner = await createOwner();
		const c = canvas('Mid-pull');
		const p = plan();
		// A write that holds the plans table until it commits, with a canvas and a plan in it.
		const write = db.transaction(async (tx) => {
			await tx.execute(sql`lock table public.plans in access exclusive mode`);
			await tx.insert(canvases).values({
				id: c.id,
				ownerId: owner,
				version: 1,
				updatedAt: new Date(c.updatedAt),
				deletedAt: null,
				name: c.name,
				widthFt: c.widthFt,
				depthFt: c.depthFt,
				unit: c.unit
			});
			await tx.insert(plans).values({
				id: p.id,
				ownerId: owner,
				version: 1,
				updatedAt: new Date(p.updatedAt),
				deletedAt: null,
				matchId: null,
				stageOrder: null,
				sourceCanvasId: null,
				widthFt: 90,
				depthFt: 60,
				unit: 'yd',
				schemaVersion: 2,
				document: p.document
			});
			await new Promise((r) => setTimeout(r, 400));
		});
		await new Promise((r) => setTimeout(r, 100));
		// The canvases are read before the write commits; the plans read waits for the lock.
		const first = await pullChanges(db, owner, 0);
		await write;
		const second = await pullChanges(db, owner, first.cursor);
		const ids = [...first.records, ...second.records].map((r) => r.id).sort();
		expect(ids).toEqual([c.id, p.id].sort());
	});

	it('never skips a row when pushes of several tables race pulls (Review Focus #3)', async () => {
		const owner = await createOwner();
		const ids: string[] = [];
		const seen: string[] = [];
		let cursor = 0;
		let pushing = true;
		const puller = (async () => {
			while (pushing) {
				const page = await pullChanges(db, owner, cursor, 5);
				seen.push(...page.records.map((r) => r.id));
				cursor = page.cursor;
			}
		})();
		await Promise.all(
			Array.from({ length: 40 }, () => {
				const c = canvas('Race');
				const p = { ...plan(), sourceCanvasId: c.id };
				ids.push(c.id, p.id);
				return pushRecords(db, owner, [
					{ record: c, baseVersion: 0 },
					{ record: p, baseVersion: 0 }
				]);
			})
		);
		pushing = false;
		await puller;
		for (;;) {
			const page = await pullChanges(db, owner, cursor, 5);
			seen.push(...page.records.map((r) => r.id));
			cursor = page.cursor;
			if (!page.more) break;
		}
		expect(seen.sort()).toEqual([...ids].sort());
	});

	it('never skips a row when pushes race each other and pulls (Review Focus #3)', async () => {
		const owner = await createOwner();
		const ids = Array.from({ length: 20 }, () => crypto.randomUUID());
		const seen: string[] = [];
		let cursor = 0;
		let pushing = true;
		const puller = (async () => {
			while (pushing) {
				const page = await pullChanges(db, owner, cursor, 3);
				seen.push(...page.records.map((r) => r.id));
				cursor = page.cursor;
			}
		})();
		await Promise.all(
			ids.map((id) => pushRecords(db, owner, [{ record: canvas('Race', id), baseVersion: 0 }]))
		);
		pushing = false;
		await puller;
		for (;;) {
			const page = await pullChanges(db, owner, cursor, 3);
			seen.push(...page.records.map((r) => r.id));
			cursor = page.cursor;
			if (!page.more) break;
		}
		expect(seen.sort()).toEqual([...ids].sort());
	});
});
