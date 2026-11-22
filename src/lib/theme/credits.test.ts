import { describe, expect, it } from 'vitest';
import { CREDITS, OGL_STATEMENT } from './credits';
import { THEMES } from './themes';

describe('credits', () => {
	it('credits every theme that uses someone else’s image', () => {
		const ids = new Set(CREDITS.map((c) => c.id));
		for (const t of THEMES) if (t.credit) expect(ids.has(t.credit), t.id).toBe(true);
	});

	it('carries the OGL attribution statement for DPM', () => {
		expect(OGL_STATEMENT).toBe(
			'Contains public sector information licensed under the Open Government Licence v1.0'
		);
		expect(CREDITS.find((c) => c.id === 'dpm')?.note).toBe(OGL_STATEMENT);
	});

	it('credits the Graduate font', () => {
		const font = CREDITS.find((c) => c.id === 'font-graduate');
		expect(font?.license).toBe('SIL Open Font License 1.1');
	});
});
