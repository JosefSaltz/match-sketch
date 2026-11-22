import { describe, it, expect } from 'vitest';
import { commandForKey } from './shortcuts';

const key = (
	k: string,
	o: Partial<{ ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }> = {}
) => ({ key: k, ctrlKey: false, metaKey: false, shiftKey: false, ...o });
const body = { tagName: 'BODY', isContentEditable: false };

describe('commandForKey', () => {
	it('maps editing keys to commands', () => {
		expect(commandForKey(key('Backspace'), body)).toBe('delete');
		expect(commandForKey(key('Delete'), body)).toBe('delete');
		expect(commandForKey(key('z', { ctrlKey: true }), body)).toBe('undo');
		expect(commandForKey(key('z', { metaKey: true, shiftKey: true }), body)).toBe('redo');
		expect(commandForKey(key('y', { ctrlKey: true }), body)).toBe('redo');
		expect(commandForKey(key('d', { ctrlKey: true }), body)).toBe('duplicate');
		expect(commandForKey(key('Escape'), body)).toBe('deselect');
		expect(commandForKey(key('ArrowUp'), body)).toBe('nudge-up');
		expect(commandForKey(key('ArrowDown'), body)).toBe('nudge-down');
		expect(commandForKey(key('ArrowLeft'), body)).toBe('nudge-left');
		expect(commandForKey(key('ArrowRight'), body)).toBe('nudge-right');
	});

	it('leaves Alt+Arrow to the browser (back/forward)', () => {
		expect(commandForKey({ ...key('ArrowLeft'), altKey: true }, body)).toBeNull();
	});

	it('ignores plain letters and unmodified z', () => {
		expect(commandForKey(key('z'), body)).toBeNull();
		expect(commandForKey(key('d'), body)).toBeNull();
	});

	it('leaves keys in text fields alone (Review Focus #1)', () => {
		for (const tagName of ['INPUT', 'TEXTAREA', 'SELECT']) {
			expect(commandForKey(key('Backspace'), { tagName, isContentEditable: false })).toBeNull();
			expect(
				commandForKey(key('z', { ctrlKey: true }), { tagName, isContentEditable: false })
			).toBeNull();
		}
		expect(commandForKey(key('Delete'), { tagName: 'DIV', isContentEditable: true })).toBeNull();
	});
});
