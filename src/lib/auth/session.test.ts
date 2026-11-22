import { AuthApiError, AuthRetryableFetchError, type Session } from '@supabase/supabase-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readSession, safeNext, SESSION_WAIT_MS, sessionState, signOutDevice } from './session';

const session = { access_token: 't', user: { id: 'u', email: 'u@x.test' } } as unknown as Session;

describe('sessionState', () => {
	it('is signed in with a session', () => {
		expect(sessionState({ session, error: null })).toBe('signed-in');
	});

	it('is signed out with no session and no error', () => {
		expect(sessionState({ session: null, error: null })).toBe('signed-out');
	});

	it('trusts a stored session the client could not refresh offline (Review Focus #2)', () => {
		const error = new AuthRetryableFetchError('Failed to fetch', 0);
		expect(sessionState({ session: null, error })).toBe('signed-in');
	});

	it('is signed out when the server rejects the refresh token', () => {
		const error = new AuthApiError('Invalid Refresh Token', 400, 'refresh_token_not_found');
		expect(sessionState({ session: null, error })).toBe('signed-out');
	});
});

describe('safeNext (Review Focus #1)', () => {
	it('keeps a same-origin path with its query', () => {
		expect(safeNext('/plans/abc?x=1')).toBe('/plans/abc?x=1');
	});

	it.each([
		null,
		undefined,
		'',
		'//evil.example',
		'https://evil.example',
		'/\\evil.example',
		'javascript:alert(1)',
		'plans/abc',
		'/sign-in?next=/',
		'/sign-in',
		'/.//evil.example',
		'/x/..//evil.example',
		'/%2e//evil.example',
		'/./\\evil.example'
	])('sends %s home', (next) => {
		expect(safeNext(next)).toBe('/');
	});
});

describe('readSession', () => {
	const stored = { id: 'stored', email: 'stored@x.test' };
	const never = () => new Promise<never>(() => {});

	beforeEach(() => {
		vi.useFakeTimers();
	});
	afterEach(() => {
		vi.useRealTimers();
	});

	it('uses the client session when it answers', async () => {
		const result = await readSession(
			() => Promise.resolve({ data: { session }, error: null }),
			() => null,
			{
				offline: false
			}
		);
		expect(result).toEqual({ state: 'signed-in', account: { id: 'u', email: 'u@x.test' } });
	});

	it('offline, opens on the stored session without asking the client', async () => {
		const getSession = vi.fn(never);
		const result = await readSession(getSession, () => stored, { offline: true });
		expect(result).toEqual({ state: 'signed-in', account: stored });
		expect(getSession).not.toHaveBeenCalled();
	});

	it('offline with nothing stored, is signed out', async () => {
		expect((await readSession(never, () => null, { offline: true })).state).toBe('signed-out');
	});

	it('stops waiting on a stuck refresh and opens on the stored session', async () => {
		const pending = readSession(never, () => stored, { offline: false });
		await vi.advanceTimersByTimeAsync(SESSION_WAIT_MS);
		expect(await pending).toEqual({ state: 'signed-in', account: stored });
	});

	it('trusts a stored session the client could not refresh', async () => {
		const error = new AuthRetryableFetchError('Failed to fetch', 0);
		const result = await readSession(
			() => Promise.resolve({ data: { session: null }, error }),
			() => stored,
			{ offline: false }
		);
		expect(result).toEqual({ state: 'signed-in', account: stored });
	});
});

describe('signOutDevice', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});
	afterEach(() => {
		vi.useRealTimers();
	});

	it('leaves clearing to the client when signing out works', async () => {
		const clear = vi.fn();
		await signOutDevice(() => Promise.resolve({ error: null }), clear);
		expect(clear).not.toHaveBeenCalled();
	});

	it('clears the stored session itself when the client fails (offline)', async () => {
		const clear = vi.fn();
		const error = new AuthRetryableFetchError('Failed to fetch', 0);
		await signOutDevice(() => Promise.resolve({ error }), clear);
		expect(clear).toHaveBeenCalledOnce();
	});

	it('clears the stored session itself when the client hangs', async () => {
		const clear = vi.fn();
		const pending = signOutDevice(() => new Promise<never>(() => {}), clear);
		await vi.advanceTimersByTimeAsync(SESSION_WAIT_MS);
		await pending;
		expect(clear).toHaveBeenCalledOnce();
	});
});
