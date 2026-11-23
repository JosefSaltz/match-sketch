import { describe, expect, it } from 'vitest';
import { checkNewPassword } from './password';

describe('checkNewPassword', () => {
	it('wants at least 8 characters', () => {
		expect(checkNewPassword('short1', 'short1')).toBe('Use at least 8 characters.');
	});

	it('wants both entries to match', () => {
		expect(checkNewPassword('long-password-1', 'long-password-2')).toBe(
			"The passwords don't match."
		);
	});

	it('accepts a long, matching password', () => {
		expect(checkNewPassword('long-password-1', 'long-password-1')).toBeNull();
	});
});
