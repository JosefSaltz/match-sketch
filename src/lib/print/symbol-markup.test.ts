import { describe, expect, it } from 'vitest';
import { getEntry } from '../catalog/index';
import { paintAttrs } from '../catalog/footprint-shapes';
import { symbolMarkup } from './symbol-markup';

describe('symbolMarkup', () => {
	it('unwraps a catalog SVG into inner markup and its root attributes', () => {
		const entry = getEntry('paper');
		if (entry?.kind !== 'symbol') throw new Error('paper is a symbol');
		const { inner, rootAttrs } = symbolMarkup(entry.svg, '#1c1c1a');
		expect(inner).not.toContain('<svg');
		expect(inner).not.toContain('currentColor');
		expect(rootAttrs['stroke-width']).toBe('5');
		expect(rootAttrs.stroke).toBe('#1c1c1a');
		expect(rootAttrs).not.toHaveProperty('viewBox');
		expect(rootAttrs).not.toHaveProperty('xmlns');
	});
});

describe('paintAttrs', () => {
	it('styles footprints with attributes, clear but clickable on screen', () => {
		expect(paintAttrs('hit', 'currentColor').fill).toBe('transparent');
		expect(paintAttrs('fill', 'currentColor')).toMatchObject({ 'fill-opacity': 0.75 });
	});

	it('uses no transparent fill and a solid ink for print', () => {
		expect(paintAttrs('hit', '#1c1c1a', true).fill).toBe('none');
		expect(paintAttrs('ink', '#1c1c1a', true).stroke).toBe('#1c1c1a');
	});
});
