import { isAuthRetryableFetchError, type AuthError, type Session } from '@supabase/supabase-js';
import type { StoredAccount } from './stored-session';

/**
 * How long the gate and sign-out wait on the auth client. Offline, a refresh of an expired token
 * retries for about 30 s; past this, the session stored on the device decides.
 */
export const SESSION_WAIT_MS = 1500;

const TIMED_OUT = Symbol('timed out');

function within<T>(promise: Promise<T>, ms: number): Promise<T | typeof TIMED_OUT> {
	return Promise.race([
		promise,
		new Promise<typeof TIMED_OUT>((r) => setTimeout(r, ms, TIMED_OUT))
	]);
}

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

/** A path that a browser would read as another host (`//host`, `/\\host`). */
const protocolRelative = (path: string) => path.startsWith('//') || path.startsWith('/\\');

/** `next` if it is a path on this site (and not the sign-in page itself), else `'/'`. */
export function safeNext(next: string | null | undefined): string {
	if (!next || !next.startsWith('/') || protocolRelative(next)) return '/';
	const url = new URL(next, 'http://same.origin');
	if (url.origin !== 'http://same.origin') return '/';
	if (url.pathname === '/sign-in') return '/';
	const path = url.pathname + url.search + url.hash;
	// Normalising dot segments can turn `/.//host` into `//host`; check the result too.
	return protocolRelative(path) ? '/' : path;
}

type SessionResult = { data: { session: Session | null }; error: AuthError | null };

/**
 * The gate's answer: whether the app may open, and for whom. Offline it trusts the session stored
 * on the device without calling the client; online it waits at most `SESSION_WAIT_MS`.
 */
export async function readSession(
	getSession: () => Promise<SessionResult>,
	stored: () => StoredAccount | null,
	options: { offline: boolean; waitMs?: number }
): Promise<{ state: 'signed-in' | 'signed-out'; account: StoredAccount | null }> {
	const fromStore = () => {
		const account = stored();
		return { state: account ? ('signed-in' as const) : ('signed-out' as const), account };
	};
	if (options.offline) return fromStore();
	const result = await within(getSession(), options.waitMs ?? SESSION_WAIT_MS);
	if (result === TIMED_OUT) return fromStore();
	const user = result.data.session?.user;
	if (user) return { state: 'signed-in', account: { id: user.id, email: user.email ?? null } };
	return sessionState({ session: null, error: result.error }) === 'signed-in'
		? fromStore()
		: { state: 'signed-out', account: null };
}

/**
 * Signs this device out. If the client can't reach the server (offline) or hangs, it clears the
 * stored session itself, so signing out always works.
 */
export async function signOutDevice(
	signOut: () => Promise<{ error: AuthError | null }>,
	clearStored: () => void,
	waitMs = SESSION_WAIT_MS
): Promise<void> {
	const result = await within(signOut(), waitMs).catch((): typeof TIMED_OUT => TIMED_OUT);
	if (result === TIMED_OUT || result.error) clearStored();
}
