import { describe, expect, it } from 'vitest';
import { flag } from './env';

describe('flag', () => {
	it('is off unless set to a true value', () => {
		for (const v of [undefined, '', ' ', 'false', '0', 'off', 'FALSE']) expect(flag(v)).toBe(false);
		for (const v of ['true', '1', 'on', 'True', ' on ']) expect(flag(v)).toBe(true);
	});

	it('refuses anything else, so a typo fails the build instead of hiding the feature', () => {
		expect(() => flag('yes please')).toThrow(/true or false/);
	});
});
