import { redirect } from '@sveltejs/kit';
import { getSupabase } from '#lib/auth/client.js';
import { sessionState } from '#lib/auth/session.js';
import type { LayoutLoad } from './$types';

/** App pages need a session on this device; offline, a stored one is enough (spec §7.9). */
export const load: LayoutLoad = async ({ url }) => {
	const { data, error } = await getSupabase().auth.getSession();
	if (sessionState({ session: data.session, error }) === 'signed-out') {
		redirect(307, `/sign-in?next=${encodeURIComponent(url.pathname + url.search)}`);
	}
	return { account: { email: data.session?.user.email ?? null } };
};
