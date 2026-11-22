import { sql } from 'drizzle-orm';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { createDatabase } from '../db/client';
import { testAdminClient, testDatabaseUrl, uniqueEmail } from '../testing/supabase';
import {
	DRAFT_RESERVE_USD,
	draftsToday,
	logDraft,
	MAX_RUNNING_DRAFTS,
	reserveDraft,
	settleDraft,
	spendToday,
	type DraftLogRow
} from './limits';

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

	const reserve = (ownerId: string, over: Partial<{ cap: number; ceilingUsd: number }> = {}) =>
		reserveDraft(db, {
			ownerId,
			planId: crypto.randomUUID(),
			request: {},
			cap: 20,
			ceilingUsd: 1e9,
			...over
		});

	it('lets one draft run per user at a time, without holding a connection while it runs', async () => {
		const owner = await createOwner();
		const first = await reserve(owner);
		expect(first.kind).toBe('reserved');
		expect((await reserve(owner)).kind).toBe('busy');
		if (first.kind === 'reserved') await settleDraft(db, first.id, settled());
		expect((await reserve(owner)).kind).toBe('reserved');
	});

	it('counts a running draft against the spend ceiling before it finishes', async () => {
		const a = await createOwner();
		const b = await createOwner();
		const ceilingUsd = (await spendToday(db)) + DRAFT_RESERVE_USD / 2;
		expect((await reserve(a, { ceilingUsd })).kind).toBe('reserved');
		expect((await reserve(b, { ceilingUsd })).kind).toBe('paused');
	});

	it('releases a draft left pending by a crash', async () => {
		const owner = await createOwner();
		const stuck = await reserve(owner);
		if (stuck.kind !== 'reserved') throw new Error('not reserved');
		await db.execute(
			sql`update public.ai_drafts set created_at = now() - interval '11 minutes' where id = ${stuck.id}`
		);
		expect((await reserve(owner)).kind).toBe('reserved');
	});

	it(`runs at most ${MAX_RUNNING_DRAFTS} drafts at once across the site`, async () => {
		const owners = await Promise.all(
			Array.from({ length: MAX_RUNNING_DRAFTS + 1 }, () => createOwner())
		);
		const kinds = [];
		for (const owner of owners) kinds.push((await reserve(owner)).kind);
		expect(kinds.filter((k) => k === 'reserved')).toHaveLength(MAX_RUNNING_DRAFTS);
		expect(kinds.at(-1)).toBe('site-busy');
	});
});

function settled() {
	return {
		model: 'claude-opus-5-5',
		status: 'ok' as const,
		inputTokens: 10,
		outputTokens: 10,
		cacheReadTokens: 0,
		costUsd: 0.001,
		error: null,
		response: {}
	};
}
