import { afterEach, describe, expect, it } from 'vitest';
import { testAdminClient, testPublicClient, uniqueEmail } from './testing/supabase';

const admin = testAdminClient();
const created: string[] = [];

afterEach(async () => {
	for (const id of created.splice(0)) await admin.auth.admin.deleteUser(id);
});

describe('local auth config', () => {
	it('refuses public sign-up', async () => {
		const { data, error } = await testPublicClient().auth.signUp({
			email: uniqueEmail('signup'),
			password: 'longenough1'
		});
		if (data.user) created.push(data.user.id);
		expect(error?.code).toBe('signup_disabled');
	});

	it('still lets the server create users', async () => {
		const { data, error } = await admin.auth.admin.createUser({
			email: uniqueEmail('created'),
			password: 'longenough1',
			email_confirm: true
		});
		if (data.user) created.push(data.user.id);
		expect(error).toBeNull();
		expect(data.user?.id).toBeTruthy();
	});
});
