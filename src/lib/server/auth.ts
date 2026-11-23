import { error, redirect, type RequestEvent } from '@sveltejs/kit';
import { serverDb } from './db';
import { getProfile } from './profiles';

export type SignedInUser = { id: string; email: string };

/** The verified user (`getClaims()` checks the JWT); otherwise redirects to sign-in. */
export async function requireUser(event: RequestEvent): Promise<SignedInUser> {
	const { data, error: claimsError } = await event.locals.supabase.auth.getClaims();
	const claims = claimsError ? null : data?.claims;
	if (!claims?.sub) {
		redirect(303, `/sign-in?next=${encodeURIComponent(event.url.pathname)}`);
	}
	return { id: claims.sub, email: typeof claims.email === 'string' ? claims.email : '' };
}

/** The verified user if their profile is an admin's; otherwise a 403. */
export async function requireAdmin(event: RequestEvent): Promise<SignedInUser> {
	const user = await requireUser(event);
	const profile = await getProfile(serverDb(), user.id);
	if (profile?.role !== 'admin') error(403, 'Admins only');
	return user;
}
