import { describe, expect, it } from 'vitest';
import { pdfFileName, toWinAnsi } from './pdf-text';

describe('toWinAnsi', () => {
	it('keeps text the standard fonts can draw', () => {
		expect(toWinAnsi('T1–T4 × 2 — “ok” café')).toBe('T1–T4 × 2 — “ok” café');
	});

	it('swaps look-alikes and marks the rest', () => {
		expect(toWinAnsi('−5 s → SA-2 🎯')).toBe('-5 s -> SA-2 ?');
	});
});

describe('pdfFileName', () => {
	it('keeps a readable title and drops unsafe characters', () => {
		expect(pdfFileName('Stage 3 — Bunker/Down')).toBe('Stage 3  BunkerDown.pdf');
		expect(pdfFileName('  ')).toBe('plan.pdf');
	});
});
