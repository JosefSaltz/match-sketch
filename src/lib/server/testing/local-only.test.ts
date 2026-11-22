import { describe, expect, it } from 'vitest';
import { requireLocal } from './local-only';

describe('requireLocal', () => {
	it('accepts the local stack', () => {
		expect(requireLocal('http://127.0.0.1:54321')).toBe('http://127.0.0.1:54321');
		expect(requireLocal('postgresql://postgres:postgres@127.0.0.1:54322/postgres')).toMatch(
			/^postgresql:/
		);
		expect(requireLocal('http://localhost:54321')).toBe('http://localhost:54321');
	});

	it('refuses a hosted project, so tests never create users there', () => {
		expect(() => requireLocal('https://zmuadxeutafbnnfopqqx.supabase.co')).toThrow(
			/only run against the local Supabase stack/
		);
		expect(() =>
			requireLocal('postgresql://postgres.ref:pw@aws-0-us-west-2.pooler.supabase.com:5432/postgres')
		).toThrow(/local Supabase stack/);
	});

	it('refuses a missing value', () => {
		expect(() => requireLocal(undefined)).toThrow(/not set/);
	});
});
