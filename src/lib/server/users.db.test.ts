import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { createDatabase } from './db/client';
import { setRole } from './profiles';
import { testAdminClient, testPublicClient, uniqueEmail } from './testing/supabase';
import { listUsers } from './users';

const admin = testAdminClient();
const database = createDatabase(process.env.DATABASE_URL ?? '');
const created: string[] = [];

afterEach(async () => {
	for (const id of created.splice(0)) await admin.auth.admin.deleteUser(id);
});

afterAll(async () => {
	await database.close();
});

describe('listUsers', () => {
	it('marks who has signed in and carries their role', async () => {
		const invitedEmail = uniqueEmail('waiting');
		const activeEmail = uniqueEmail('active');
		const invited = await admin.auth.admin.inviteUserByEmail(invitedEmail);
		const active = await admin.auth.admin.createUser({
			email: activeEmail,
			password: 'longenough1',
			email_confirm: true
		});
		created.push(invited.data.user!.id, active.data.user!.id);
		await setRole(database.db, active.data.user!.id, 'admin');
		await testPublicClient().auth.signInWithPassword({
			email: activeEmail,
			password: 'longenough1'
		});

		const rows = await listUsers(admin, database.db);
		expect(rows.find((r) => r.email === invitedEmail)).toMatchObject({
			status: 'invited',
			role: 'md',
			lastSignInAt: null
		});
		expect(rows.find((r) => r.email === invitedEmail)?.invitedAt).toBeTruthy();
		expect(rows.find((r) => r.email === activeEmail)).toMatchObject({
			status: 'active',
			role: 'admin'
		});
		const emails = rows.map((r) => r.email);
		expect(emails).toEqual([...emails].sort());
	});
});
