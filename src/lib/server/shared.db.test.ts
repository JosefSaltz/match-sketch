import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { emptyPlanDocument, type PlanDocument } from '../model/plan';
import { newShareId } from '../model/share';
import { stepsFromText } from '../model/procedure';
import { createDatabase } from './db/client';
import { matches, plans } from './db/schema';
import { getSharedView } from './shared';
import { testAdminClient, testDatabaseUrl, uniqueEmail } from './testing/supabase';

const admin = testAdminClient();
const database = createDatabase(testDatabaseUrl());
const db = database.db;
const created: string[] = [];

async function createOwner(): Promise<string> {
	const { data, error } = await admin.auth.admin.createUser({
		email: uniqueEmail('sharer'),
		password: 'longenough1',
		email_confirm: true
	});
	if (error || !data.user) throw error ?? new Error('no user');
	created.push(data.user.id);
	return data.user.id;
}

function doc(stageName: string): PlanDocument {
	const d = emptyPlanDocument();
	return { ...d, brief: { ...d.brief, stageName, steps: stepsFromText([], 'Start\nEngage T1') } };
}

async function insertPlan(
	ownerId: string,
	fields: Partial<typeof plans.$inferInsert> & { stageName: string }
) {
	const { stageName, ...rest } = fields;
	const id = crypto.randomUUID();
	await db.insert(plans).values({
		id,
		ownerId,
		version: 1,
		updatedAt: new Date(),
		widthFt: 90,
		depthFt: 60,
		unit: 'yd',
		schemaVersion: 2,
		document: doc(stageName),
		sourceCanvasId: crypto.randomUUID(),
		...rest
	});
	return id;
}

async function insertMatch(ownerId: string, fields: Partial<typeof matches.$inferInsert> = {}) {
	const id = crypto.randomUUID();
	await db.insert(matches).values({
		id,
		ownerId,
		version: 1,
		updatedAt: new Date(),
		name: 'SOF 2026',
		date: '2026-05-02',
		...fields
	});
	return id;
}

afterEach(async () => {
	for (const id of created.splice(0)) await admin.auth.admin.deleteUser(id);
});

afterAll(async () => {
	await database.close();
});

describe('getSharedView', () => {
	it('shows a shared plan without owner, version or source canvas', async () => {
		const owner = await createOwner();
		const token = newShareId();
		const id = await insertPlan(owner, { stageName: 'Bay drill', shareId: token, shareOn: true });
		const view = await getSharedView(db, token);
		expect(view).toMatchObject({ kind: 'plan', plan: { id, stageNumber: '' }, matchName: '' });
		if (view?.kind !== 'plan') throw new Error('expected a plan');
		expect(view.plan.document.brief.stageName).toBe('Bay drill');
		const keys = JSON.stringify(view);
		for (const leak of ['ownerId', 'owner_id', 'version', 'sourceCanvasId', owner]) {
			expect(keys).not.toContain(leak);
		}
	});

	it('names a shared stage after its match and numbers it by the match order', async () => {
		const owner = await createOwner();
		const match = await insertMatch(owner);
		await insertPlan(owner, { stageName: 'First', matchId: match, stageOrder: 0 });
		const token = newShareId();
		await insertPlan(owner, {
			stageName: 'Second',
			matchId: match,
			stageOrder: 1,
			shareId: token,
			shareOn: true
		});
		expect(await getSharedView(db, token)).toMatchObject({
			kind: 'plan',
			plan: { stageNumber: '2' },
			matchName: 'SOF 2026',
			date: '2026-05-02'
		});
	});

	it("lists a shared match's live stages in order, and only the owner's", async () => {
		const owner = await createOwner();
		const stranger = await createOwner();
		const token = newShareId();
		const match = await insertMatch(owner, { shareId: token, shareOn: true });
		await insertPlan(owner, { stageName: 'Two', matchId: match, stageOrder: 2 });
		await insertPlan(owner, { stageName: 'One', matchId: match, stageOrder: 1 });
		await insertPlan(owner, {
			stageName: 'Deleted',
			matchId: match,
			stageOrder: 3,
			deletedAt: new Date()
		});
		await insertPlan(stranger, { stageName: 'Not theirs', matchId: match, stageOrder: 0 });
		const view = await getSharedView(db, token);
		if (view?.kind !== 'match') throw new Error('expected a match');
		expect(view.match).toEqual({ name: 'SOF 2026', date: '2026-05-02' });
		expect(view.plans.map((p) => [p.document.brief.stageName, p.stageNumber])).toEqual([
			['One', '1'],
			['Two', '2']
		]);
	});

	it('shows nothing for links that are off, deleted, unknown or malformed (Review Focus #4)', async () => {
		const owner = await createOwner();
		const off = newShareId();
		const deleted = newShareId();
		const offMatch = newShareId();
		await insertPlan(owner, { stageName: 'Off', shareId: off, shareOn: false });
		await insertPlan(owner, {
			stageName: 'Gone',
			shareId: deleted,
			shareOn: true,
			deletedAt: new Date()
		});
		await insertMatch(owner, { shareId: offMatch, shareOn: false });
		for (const token of [off, deleted, offMatch, newShareId(), 'nope', `${off}x`]) {
			expect(await getSharedView(db, token)).toBeNull();
		}
	});
});
