import { describe, expect, it } from 'vitest';
import { MEANINGS } from '../model/plan';
import { MEANING_STYLES, meaningsUsed } from './meanings';

describe('meaning styles', () => {
	it('follow the spec colors and labels, in legend order', () => {
		expect(Object.keys(MEANING_STYLES)).toEqual([...MEANINGS]);
		expect(MEANINGS.map((m) => [MEANING_STYLES[m].label, MEANING_STYLES[m].color])).toEqual([
			['Start', '#2e7d32'],
			['Move', '#1565c0'],
			['Shoot', '#d84315'],
			['Activate', '#f9a825'],
			['Avoid', '#616161']
		]);
	});

	it('give every meaning its own badge shape', () => {
		const glyphs = new Set(MEANINGS.map((m) => MEANING_STYLES[m].glyph.d));
		expect(glyphs.size).toBe(MEANINGS.length);
	});

	it('lists the meanings a step uses once each, in legend order', () => {
		const id = crypto.randomUUID();
		expect(
			meaningsUsed([
				{ objectId: id, meaning: 'shoot' },
				{ objectId: id, meaning: 'start' },
				{ objectId: id, meaning: 'shoot' }
			])
		).toEqual(['start', 'shoot']);
	});
});
