import { describe, expect, it } from 'vitest';
import { authBypassed, DEV_ACCOUNT } from './dev-bypass';

describe('authBypassed', () => {
	it('skips sign-in only on the dev server with the flag on', () => {
		expect(authBypassed({ dev: true, flag: true })).toBe(true);
	});

	it('never skips sign-in in a build, even with the flag on', () => {
		expect(authBypassed({ dev: false, flag: true })).toBe(false);
	});

	it('keeps sign-in on the dev server when the flag is off', () => {
		expect(authBypassed({ dev: true, flag: false })).toBe(false);
	});
});

describe('DEV_ACCOUNT', () => {
	it('has no account id, so sync never starts against a made-up account', () => {
		expect(DEV_ACCOUNT.id).toBeNull();
	});
});
