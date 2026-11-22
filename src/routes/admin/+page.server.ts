import { fail } from '@sveltejs/kit';
import { requireAdmin } from '#lib/server/auth.js';
import { serverDb } from '#lib/server/db/index.js';
import { adminClient } from '#lib/server/supabase-admin.js';
import { InviteInputSchema, inviteUser, listUsers } from '#lib/server/users.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	await requireAdmin(event);
	return { users: await listUsers(adminClient(), serverDb()) };
};

export const actions = {
	invite: async (event) => {
		await requireAdmin(event);
		const form = await event.request.formData();
		const text = (name: string) => {
			const value = form.get(name);
			return typeof value === 'string' ? value : '';
		};
		const email = text('email').trim();
		const parsed = InviteInputSchema.safeParse({ email, displayName: text('displayName') });
		if (!parsed.success) return fail(400, { email, error: 'Enter a valid email address.' });
		const { error } = await inviteUser(adminClient(), parsed.data);
		if (error) return fail(400, { email, error });
		return { invited: parsed.data.email };
	}
} satisfies Actions;
