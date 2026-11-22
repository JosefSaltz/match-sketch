import { createClient } from '@supabase/supabase-js';

/** The auth admin API on the local stack (secret key), for setting up e2e scenarios. */
export function adminClient() {
	const url = process.env.SUPABASE_URL;
	const key = process.env.SUPABASE_SECRET_KEY;
	if (!url || !key) throw new Error('Supabase env is not set; run e2e with pnpm test:e2e');
	return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Invites `email` the way the admin page does; throws on error. */
export async function invite(email: string): Promise<void> {
	const { error } = await adminClient().auth.admin.inviteUserByEmail(email);
	if (error) throw error;
}

export function uniqueEmail(prefix: string): string {
	return `${prefix}-${crypto.randomUUID()}@match-sketch.test`;
}
