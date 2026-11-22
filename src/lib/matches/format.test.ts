import { describe, expect, it } from 'vitest';
import { formatMatchDate, stageCount } from './format';

describe('formatMatchDate', () => {
	it('reads the date as a local calendar day', () => {
		const shown = formatMatchDate('2026-11-29');
		expect(shown).toBe(
			new Date(2026, 10, 29).toLocaleDateString(undefined, {
				month: 'short',
				day: 'numeric',
				year: 'numeric'
			})
		);
		expect(shown).toContain('29');
	});

	it('says "No date" when blank', () => {
		expect(formatMatchDate('')).toBe('No date');
	});
});

describe('stageCount', () => {
	it('pluralizes', () => {
		expect(stageCount(0)).toBe('0 stages');
		expect(stageCount(1)).toBe('1 stage');
		expect(stageCount(3)).toBe('3 stages');
	});
});
