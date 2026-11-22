import { describe, it, expect } from 'vitest';
import { createHistory } from './history';

describe('history', () => {
	it('undoes and redoes, and a new push clears redo', () => {
		const h = createHistory(1);
		h.push(2);
		h.push(3);
		expect(h.current).toBe(3);
		expect(h.undo()).toBe(2);
		expect(h.undo()).toBe(1);
		expect(h.canUndo).toBe(false);
		expect(h.redo()).toBe(2);
		h.push(9);
		expect(h.canRedo).toBe(false);
	});

	it('keeps at most `limit` undo steps', () => {
		const lim = createHistory(0, { limit: 3 });
		[1, 2, 3, 4, 5].forEach((n) => lim.push(n));
		lim.undo();
		lim.undo();
		lim.undo();
		expect(lim.current).toBe(2);
		expect(lim.canUndo).toBe(false);
	});

	it('replace swaps the current value without adding an undo step', () => {
		const h = createHistory(1);
		h.push(2);
		h.replace(3);
		expect(h.current).toBe(3);
		expect(h.undo()).toBe(1);
		expect(h.redo()).toBe(3);
	});

	it('replace clears redo', () => {
		const h = createHistory(1);
		h.push(2);
		h.undo();
		h.replace(5);
		expect(h.canRedo).toBe(false);
	});
});
