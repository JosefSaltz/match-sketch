import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { Database } from './db/client';
import type { ProfileRole } from './db/schema';
import { listProfiles } from './profiles';

export const InviteInputSchema = z.object({
	email: z.email().max(254),
	displayName: z.string().trim().max(80)
});
export type InviteInput = z.infer<typeof InviteInputSchema>;

/** A row on the admin page. `active` once the user has signed in (accepting signs them in). */
export type UserRow = {
	id: string;
	email: string;
	displayName: string;
	role: ProfileRole;
	status: 'invited' | 'active';
	invitedAt: string | null;
	lastSignInAt: string | null;
};

/** Every auth user with their profile, sorted by email. */
export async function listUsers(admin: SupabaseClient, db: Database): Promise<UserRow[]> {
	const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
	if (error) throw error;
	const profiles = new Map((await listProfiles(db)).map((p) => [p.id, p]));
	return data.users
		.map((user): UserRow => {
			const profile = profiles.get(user.id);
			return {
				id: user.id,
				email: user.email ?? '',
				displayName: profile?.displayName ?? '',
				role: profile?.role ?? 'md',
				status: user.last_sign_in_at ? 'active' : 'invited',
				invitedAt: user.invited_at ?? null,
				lastSignInAt: user.last_sign_in_at ?? null
			};
		})
		.sort((a, b) => a.email.localeCompare(b.email));
}

/** What to tell the admin when an invite fails. */
export function inviteErrorMessage(error: { code?: string; message: string }): string {
	if (error.code === 'email_exists') {
		return 'That email already has an account. If they can’t sign in, they can use “Forgot your password?” on the sign-in page.';
	}
	if (error.code === 'over_email_send_rate_limit') {
		return 'Too many invite emails were sent. Try again in an hour.';
	}
	return `Couldn't send the invite: ${error.message}`;
}

/** Sends Supabase's invite email; the profile trigger names the user from `displayName`. */
export async function inviteUser(
	admin: SupabaseClient,
	input: InviteInput
): Promise<{ error: string | null }> {
	const { error } = await admin.auth.admin.inviteUserByEmail(input.email, {
		data: input.displayName ? { display_name: input.displayName } : {}
	});
	return { error: error ? inviteErrorMessage(error) : null };
}
