import { describe, expect, it } from 'vitest';
import { clearStoredSession, readStoredAccount } from './stored-session';

const session = { access_token: 'a', refresh_token: 'r', user: { id: 'u-1', email: 'md@x.test' } };
const encoded = 'base64-' + Buffer.from(JSON.stringify(session)).toString('base64url');

describe('readStoredAccount', () => {
	it('reads the account from the session cookie without the network', () => {
		expect(readStoredAccount(`theme=x; sb-127-auth-token=${encoded}`)).toEqual({
			id: 'u-1',
			email: 'md@x.test'
		});
	});

	it('joins a session split across chunk cookies, in chunk order', () => {
		const half = Math.floor(encoded.length / 2);
		const header = `sb-ref-auth-token.1=${encoded.slice(half)}; sb-ref-auth-token.0=${encoded.slice(0, half)}`;
		expect(readStoredAccount(header)?.id).toBe('u-1');
	});

	it('decodes percent-escaped cookie values', () => {
		const plain = encodeURIComponent(JSON.stringify(session));
		expect(readStoredAccount(`sb-ref-auth-token=${plain}`)?.email).toBe('md@x.test');
	});

	it('is null with no session cookie, or one that is not a session', () => {
		expect(readStoredAccount('theme=x')).toBeNull();
		expect(readStoredAccount('')).toBeNull();
		expect(readStoredAccount('sb-ref-auth-token=base64-%%%')).toBeNull();
		expect(readStoredAccount('sb-ref-auth-token=base64-' + btoa('{"user":{}}'))).toBeNull();
	});
});

describe('clearStoredSession', () => {
	it('expires every session cookie and leaves the others', () => {
		const writes: string[] = [];
		const doc = {
			get cookie() {
				return 'theme=x; sb-ref-auth-token.0=a; sb-ref-auth-token.1=b';
			},
			set cookie(value: string) {
				writes.push(value);
			}
		};
		clearStoredSession(doc);
		expect(writes.sort()).toEqual([
			'sb-ref-auth-token.0=; Max-Age=0; Path=/',
			'sb-ref-auth-token.1=; Max-Age=0; Path=/'
		]);
	});
});
