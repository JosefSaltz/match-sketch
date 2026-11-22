import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { createDatabase } from './db/client';
import { getProfile } from './profiles';
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

async function createUser(email: string, displayName?: string): Promise<string> {
	const { data, error } = await admin.auth.admin.createUser({
		email,
		password: PASSWORD,
		email_confirm: true,
		user_metadata: displayName === undefined ? {} : { display_name: displayName }
	});
	if (error || !data.user) throw error ?? new Error('no user');
	created.push(data.user.id);
	return data.user.id;
}

async function signedInClient(email: string) {
	const client = testPublicClient();
	const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
	if (error) throw error;
	return client;
}

afterEach(async () => {
	for (const id of created.splice(0)) await admin.auth.admin.deleteUser(id);
});

afterAll(async () => {
	await database.close();
});

describe('profiles', () => {
	it('gives a new user an md profile named from the invite', async () => {
		const id = await createUser(uniqueEmail('pat'), 'Pat');
		expect(await getProfile(db, id)).toMatchObject({ id, role: 'md', displayName: 'Pat' });
	});

	it('names the profile from the email when no name is given', async () => {
		const id = await createUser(`range.officer-${crypto.randomUUID()}@x.test`);
		const profile = await getProfile(db, id);
		expect(profile?.displayName).toMatch(/^range\.officer-/);
	});

	it('deletes the profile with the user', async () => {
		const id = await createUser(uniqueEmail('gone'));
		await admin.auth.admin.deleteUser(id);
		created.splice(created.indexOf(id), 1);
		expect(await getProfile(db, id)).toBeNull();
	});

	it('lets a signed-in user read only their own profile', async () => {
		const emailA = uniqueEmail('a');
		const a = await createUser(emailA);
		await createUser(uniqueEmail('b'));
		const client = await signedInClient(emailA);
		const { data, error } = await client.from('profiles').select('id');
		expect(error).toBeNull();
		expect(data).toEqual([{ id: a }]);
		const anon = await testPublicClient().from('profiles').select('id');
		expect(anon.data ?? []).toEqual([]);
	});

	it('ignores a user rewriting their own role (Review Focus #4)', async () => {
		const email = uniqueEmail('sneaky');
		const id = await createUser(email);
		const client = await signedInClient(email);
		await client.from('profiles').update({ role: 'admin' }).eq('id', id);
		expect((await getProfile(db, id))?.role).toBe('md');
	});
});
