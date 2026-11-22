import { AuthApiError, AuthRetryableFetchError, type Session } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { safeNext, sessionState } from './session';

const session = { access_token: 't', user: { id: 'u' } } as unknown as Session;

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
		'/sign-in'
	])('sends %s home', (next) => {
		expect(safeNext(next)).toBe('/');
	});
});
