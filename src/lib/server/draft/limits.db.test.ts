import { sql } from 'drizzle-orm';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { createDatabase } from '../db/client';
import { testAdminClient, testDatabaseUrl, uniqueEmail } from '../testing/supabase';
import { draftsToday, logDraft, spendToday, withDraftLock, type DraftLogRow } from './limits';

const admin = testAdminClient();
const database = createDatabase(testDatabaseUrl());
const db = database.db;
const created: string[] = [];

async function createOwner(): Promise<string> {
	const { data, error } = await admin.auth.admin.createUser({
		email: uniqueEmail('drafter'),
		password: 'longenough1',
		email_confirm: true
	});
	if (error || !data.user) throw error ?? new Error('no user');
	created.push(data.user.id);
	return data.user.id;
}

function row(ownerId: string, overrides: Partial<DraftLogRow> = {}): DraftLogRow {
	return {
		ownerId,
		planId: crypto.randomUUID(),
		model: 'claude-opus-5-5',
		status: 'ok',
		inputTokens: 1000,
		outputTokens: 500,
		cacheReadTokens: 0,
		costUsd: 0.014,
		error: null,
		request: {},
		response: {},
		...overrides
	};
}

afterEach(async () => {
	for (const id of created.splice(0)) await admin.auth.admin.deleteUser(id);
});

afterAll(async () => {
	await database.close();
});

describe('draft limits', () => {
	it("counts a user's drafts today, but not refused-before-sending ones", async () => {
		const owner = await createOwner();
		const other = await createOwner();
		await logDraft(db, row(owner));
		await logDraft(db, row(owner, { status: 'repaired' }));
		await logDraft(
			db,
			row(owner, { status: 'capped', inputTokens: 0, outputTokens: 0, costUsd: 0 })
		);
		await logDraft(db, row(other));
		expect(await draftsToday(db, owner)).toBe(2);
	});

	it('counts only today (UTC)', async () => {
		const owner = await createOwner();
		await logDraft(db, row(owner));
		await db.execute(
			sql`update public.ai_drafts set created_at = date_trunc('day', now() at time zone 'utc') at time zone 'utc' - interval '1 minute' where owner_id = ${owner}`
		);
		await logDraft(db, row(owner));
		expect(await draftsToday(db, owner)).toBe(1);
	});

	it("adds up everyone's spend today", async () => {
		const a = await createOwner();
		const b = await createOwner();
		const before = await spendToday(db);
		await logDraft(db, row(a, { costUsd: 0.25 }));
		await logDraft(db, row(b, { costUsd: 0.5 }));
		expect(await spendToday(db)).toBeCloseTo(before + 0.75, 6);
	});

	it('lets one draft run per user at a time', async () => {
		const owner = await createOwner();
		let release!: () => void;
		const first = withDraftLock(
			db,
			owner,
			() => new Promise<string>((r) => (release = () => r('first')))
		);
		await new Promise((r) => setTimeout(r, 50));
		expect(await withDraftLock(db, owner, () => Promise.resolve('second'))).toBeNull();
		release();
		expect(await first).toBe('first');
		expect(await withDraftLock(db, owner, () => Promise.resolve('third'))).toBe('third');
	});
});
