import { isAuthRetryableFetchError, type AuthError, type Session } from '@supabase/supabase-js';

/**
 * Whether the app may open, from `auth.getSession()`'s result. A retryable fetch error means the
 * client has a stored session it couldn't refresh (offline); the spec trusts it until the device
 * is back online, so the app opens on local data.
 */
export function sessionState(result: {
	session: Session | null;
	error: AuthError | null;
}): 'signed-in' | 'signed-out' {
	if (result.session) return 'signed-in';
	return isAuthRetryableFetchError(result.error) ? 'signed-in' : 'signed-out';
}

/** `next` if it is a path on this site (and not the sign-in page itself), else `'/'`. */
export function safeNext(next: string | null | undefined): string {
	if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return '/';
	const url = new URL(next, 'http://same.origin');
	if (url.origin !== 'http://same.origin') return '/';
	if (url.pathname === '/sign-in') return '/';
	return url.pathname + url.search + url.hash;
}
