import { eq } from 'drizzle-orm';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { draftBrief, type DraftOutput } from '../../draft/contract';
import { emptyPlanDocument } from '../../model/plan';
import { createDatabase } from '../db/client';
import { aiDrafts } from '../db/schema';
import { testAdminClient, testDatabaseUrl, uniqueEmail } from '../testing/supabase';
import { handleDraft } from './handle';
import { DRAFT_RESERVE_USD } from './limits';
import type { DraftClient } from './service';

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

const output: DraftOutput = {
	placements: [
		{
			symbolId: 'popper',
			x: 10,
			y: 50,
			rotation: 0,
			label: null,
			count: 2,
			widthFt: null,
			depthFt: null
		}
	],
	unrepresentable: ['a bucket of sequence cards']
};

/** A client that answers every call with `output` after `delayMs`. */
function stubClient(delayMs = 0): DraftClient {
	return {
		send: () =>
			new Promise((resolve) =>
				setTimeout(
					() =>
						resolve({
							model: 'claude-opus-5-5',
							stop_reason: 'end_turn',
							content: [{ type: 'text', text: JSON.stringify(output) }],
							usage: {
								input_tokens: 1000,
								output_tokens: 500,
								cache_read_input_tokens: 0,
								cache_creation_input_tokens: 0
							}
						} as never),
					delayMs
				)
			)
	};
}

/** A client whose call fails before any usage is known. */
const failingClient: DraftClient = { send: () => Promise.reject(new Error('socket hang up')) };

function body() {
	return {
		planId: crypto.randomUUID(),
		description: 'Engage two poppers from SA-1.',
		brief: draftBrief(emptyPlanDocument().brief),
		canvas: { widthFt: 60, depthFt: 90, unit: 'yd' },
		symbolSize: 'medium'
	};
}

const limits = { cap: 20, ceilingUsd: 1e9 };

afterEach(async () => {
	for (const id of created.splice(0)) await admin.auth.admin.deleteUser(id);
});

afterAll(async () => {
	await database.close();
});

describe('handleDraft', () => {
	it('drafts, logs the usage and cost, and returns the result', async () => {
		const owner = await createOwner();
		const res = await handleDraft({
			db,
			ownerId: owner,
			body: body(),
			client: stubClient(),
			...limits
		});
		expect(res.status).toBe(200);
		expect(res.body).toMatchObject({
			status: 'ok',
			unrepresentable: ['a bucket of sequence cards']
		});
		const [row] = await db.select().from(aiDrafts).where(eq(aiDrafts.ownerId, owner));
		expect(row).toMatchObject({
			status: 'ok',
			inputTokens: 1000,
			outputTokens: 500,
			model: 'claude-opus-5-5'
		});
		expect(row.costUsd).toBeCloseTo((1000 * 4 + 500 * 20) / 1e6, 6);
	});

	it('charges a call that failed without usage at the worst case', async () => {
		const owner = await createOwner();
		const res = await handleDraft({
			db,
			ownerId: owner,
			body: body(),
			client: failingClient,
			...limits
		});
		expect(res.body).toMatchObject({ status: 'failed' });
		const [row] = await db.select().from(aiDrafts).where(eq(aiDrafts.ownerId, owner));
		expect(row).toMatchObject({ status: 'failed', error: 'socket hang up' });
		expect(row.costUsd).toBeCloseTo(DRAFT_RESERVE_USD, 6);
	});

	it('refuses a bad request and says when drafting is not set up', async () => {
		const owner = await createOwner();
		expect(
			(
				await handleDraft({
					db,
					ownerId: owner,
					body: { nope: 1 },
					client: stubClient(),
					...limits
				})
			).status
		).toBe(400);
		const res = await handleDraft({ db, ownerId: owner, body: body(), client: null, ...limits });
		expect(res).toMatchObject({
			status: 503,
			body: { code: 'not-set-up', message: "Drafting isn't set up on this server." }
		});
	});

	it("stops a user at the day's cap, and logs it", async () => {
		const owner = await createOwner();
		const capped = { ...limits, cap: 1 };
		expect(
			(await handleDraft({ db, ownerId: owner, body: body(), client: stubClient(), ...capped }))
				.status
		).toBe(200);
		const res = await handleDraft({
			db,
			ownerId: owner,
			body: body(),
			client: stubClient(),
			...capped
		});
		expect(res).toMatchObject({
			status: 429,
			body: {
				code: 'capped',
				message: "You've used today's 1 drafts. Drafting resets at midnight UTC."
			}
		});
		const statuses = (await db.select().from(aiDrafts).where(eq(aiDrafts.ownerId, owner))).map(
			(r) => r.status
		);
		expect(statuses.sort()).toEqual(['capped', 'ok']);
	});

	it('pauses drafting for everyone at the spend ceiling', async () => {
		const owner = await createOwner();
		const res = await handleDraft({
			db,
			ownerId: owner,
			body: body(),
			client: stubClient(),
			cap: 20,
			ceilingUsd: 0
		});
		expect(res).toMatchObject({
			status: 503,
			body: { code: 'paused', message: 'Drafting is paused for today.' }
		});
	});

	it('runs one draft at a time per user (Review Focus #2)', async () => {
		const owner = await createOwner();
		const [a, b] = await Promise.all([
			handleDraft({ db, ownerId: owner, body: body(), client: stubClient(300), ...limits }),
			new Promise((r) => setTimeout(r, 50)).then(() =>
				handleDraft({ db, ownerId: owner, body: body(), client: stubClient(300), ...limits })
			)
		]);
		expect([a.status, b.status].sort()).toEqual([200, 429]);
	});
});
