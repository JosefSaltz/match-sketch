import { describe, it, expect } from 'vitest';
import { nextLabel } from './labels';
import { getEntry } from '../catalog/index';

const sa = getEntry('shooting-position')!;
const dump = getEntry('dump-box')!;
const o = (symbolId: string, label?: string) => ({
	id: crypto.randomUUID(),
	symbolId,
	x: 0,
	y: 0,
	rotation: 0,
	z: 0,
	label
});

describe('nextLabel', () => {
	it('starts numbered series at 1', () => {
		expect(nextLabel([], sa)).toBe('SA-1');
	});

	it('continues after the highest existing number', () => {
		expect(nextLabel([o('shooting-position', 'SA-1'), o('shooting-position', 'SA-3')], sa)).toBe(
			'SA-4'
		);
	});

	it('continues letter series past Z', () => {
		expect(nextLabel([o('dump-box', 'A'), o('dump-box', 'B')], dump)).toBe('C');
		expect(
			nextLabel(
				Array.from({ length: 26 }, (_, i) => o('dump-box', String.fromCharCode(65 + i))),
				dump
			)
		).toBe('AA');
	});

	it('gives no label to entries without auto labels', () => {
		expect(nextLabel([], getEntry('popper')!)).toBeUndefined();
	});
});
