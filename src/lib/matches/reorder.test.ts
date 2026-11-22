import { describe, expect, it } from 'vitest';
import { moveItem, reorderIndex } from './reorder';

describe('reorderIndex', () => {
	it('counts the midpoints above the pointer', () => {
		expect(reorderIndex([10, 30, 50], 5)).toBe(0);
		expect(reorderIndex([10, 30, 50], 31)).toBe(2);
		expect(reorderIndex([10, 30, 50], 99)).toBe(3);
	});

	it('a pointer exactly on a midpoint stays before it', () => {
		expect(reorderIndex([10, 30], 30)).toBe(1);
	});
});

describe('moveItem', () => {
	it('moves an item down', () => expect(moveItem(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a']));
	it('moves an item up', () => expect(moveItem(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b']));
	it('leaves the input alone', () => {
		const list = ['a', 'b'];
		moveItem(list, 0, 1);
		expect(list).toEqual(['a', 'b']);
	});
});
