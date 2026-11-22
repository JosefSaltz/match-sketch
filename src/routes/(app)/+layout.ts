import { redirect } from '@sveltejs/kit';
import { getSupabase } from '#lib/auth/client.js';
import { readSession } from '#lib/auth/session.js';
import { readStoredAccount } from '#lib/auth/stored-session.js';
import type { LayoutLoad } from './$types';

/**
 * App pages need a session on this device. Offline, or when the auth server doesn't answer in
 * time, the session stored on the device is enough (spec §7.9).
 */
export const load: LayoutLoad = async ({ url }) => {
	const supabase = getSupabase();
	const { state, account } = await readSession(
		() => supabase.auth.getSession(),
		() => readStoredAccount(document.cookie),
		{ offline: !navigator.onLine }
	);
	if (state === 'signed-out') {
		redirect(307, `/sign-in?next=${encodeURIComponent(url.pathname + url.search)}`);
	}
	return { account: { id: account?.id ?? null, email: account?.email ?? null } };
};
