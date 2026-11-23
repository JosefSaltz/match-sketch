import { describe, expect, it } from 'vitest';
import { InviteInputSchema, inviteErrorMessage } from './users';

describe('inviteErrorMessage', () => {
	it('explains an address that already has an account', () => {
		expect(inviteErrorMessage({ code: 'email_exists', message: 'A user with this email…' })).toBe(
			'That email already has an account. If they can’t sign in, they can use “Forgot your password?” on the sign-in page.'
		);
	});

	it('explains the email rate limit', () => {
		expect(inviteErrorMessage({ code: 'over_email_send_rate_limit', message: 'rate' })).toBe(
			'Too many invite emails were sent. Try again in an hour.'
		);
	});

	it('passes anything else through', () => {
		expect(inviteErrorMessage({ message: 'Database down' })).toBe(
			"Couldn't send the invite: Database down"
		);
	});
});

describe('InviteInputSchema', () => {
	it('rejects something that is not an email', () => {
		expect(InviteInputSchema.safeParse({ email: 'not-an-email', displayName: '' }).success).toBe(
			false
		);
	});

	it('trims the name and keeps it optional', () => {
		expect(InviteInputSchema.parse({ email: 'md@x.test', displayName: '  Pat ' })).toEqual({
			email: 'md@x.test',
			displayName: 'Pat'
		});
	});
});
