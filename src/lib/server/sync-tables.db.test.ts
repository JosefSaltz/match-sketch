import { eq } from 'drizzle-orm';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { emptyPlanDocument } from '../model/plan';
import { createDatabase } from './db/client';
import { canvases, plans } from './db/schema';
import {
	testAdminClient,
	testDatabaseUrl,
	testPublicClient,
	uniqueEmail
} from './testing/supabase';

const admin = testAdminClient();
const database = createDatabase(testDatabaseUrl());
const db = database.db;
const created: string[] = [];
const PASSWORD = 'longenough1';

async function createUser(): Promise<{ id: string; email: string }> {
	const email = uniqueEmail('sync');
	const { data, error } = await admin.auth.admin.createUser({
		email,
		password: PASSWORD,
		email_confirm: true
	});
	if (error || !data.user) throw error ?? new Error('no user');
	created.push(data.user.id);
	return { id: data.user.id, email };
}

function planRow(ownerId: string) {
	return {
		id: crypto.randomUUID(),
		ownerId,
		version: 1,
		updatedAt: new Date(),
		deletedAt: null,
		matchId: null,
		stageOrder: null,
		sourceCanvasId: null,
		widthFt: 90,
		depthFt: 60,
		unit: 'yd' as const,
		schemaVersion: 2,
		document: emptyPlanDocument()
	};
}

afterEach(async () => {
	for (const id of created.splice(0)) await admin.auth.admin.deleteUser(id);
});

afterAll(async () => {
	await database.close();
});

describe('synced tables', () => {
	it('stamps a rising change_seq on insert and on update', async () => {
		const user = await createUser();
		const row = planRow(user.id);
		const [inserted] = await db.insert(plans).values(row).returning();
		const [canvas] = await db
			.insert(canvases)
			.values({
				id: crypto.randomUUID(),
				ownerId: user.id,
				version: 1,
				updatedAt: new Date(),
				deletedAt: null,
				name: 'Bay',
				widthFt: 90,
				depthFt: 60,
				unit: 'yd'
			})
			.returning();
		expect(canvas.changeSeq).toBeGreaterThan(inserted.changeSeq);
		const [updated] = await db
			.update(plans)
			.set({ version: 2 })
			.where(eq(plans.id, row.id))
			.returning();
		expect(updated.changeSeq).toBeGreaterThan(canvas.changeSeq);
	});

	it("deletes a user's records with the user", async () => {
		const user = await createUser();
		const row = planRow(user.id);
		await db.insert(plans).values(row);
		await admin.auth.admin.deleteUser(user.id);
		created.splice(created.indexOf(user.id), 1);
		expect(await db.select().from(plans).where(eq(plans.id, row.id))).toEqual([]);
	});

	it('keeps the tables out of the Data API', async () => {
		const user = await createUser();
		await db.insert(plans).values(planRow(user.id));
		const client = testPublicClient();
		await client.auth.signInWithPassword({ email: user.email, password: PASSWORD });
		for (const table of ['plans', 'canvases', 'matches']) {
			const signedIn = await client.from(table).select('id');
			expect(signedIn.error?.code).toBe('42501');
			const anon = await testPublicClient().from(table).select('id');
			expect(anon.error?.code).toBe('42501');
		}
	});
});
