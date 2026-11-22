export type EditorCommand =
	| 'undo'
	| 'redo'
	| 'delete'
	| 'duplicate'
	| 'deselect'
	| 'nudge-left'
	| 'nudge-right'
	| 'nudge-up'
	| 'nudge-down';

export type KeyLike = { key: string; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean };
export type TargetLike = { tagName: string; isContentEditable: boolean };

const TEXT_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

const ARROWS: Record<string, EditorCommand> = {
	ArrowLeft: 'nudge-left',
	ArrowRight: 'nudge-right',
	ArrowUp: 'nudge-up',
	ArrowDown: 'nudge-down'
};

/**
 * Maps a key press to an editor command. Keys typed into form fields or editable content
 * always belong to that field, so they never delete objects or undo the document.
 */
export function commandForKey(e: KeyLike, target: TargetLike): EditorCommand | null {
	if (TEXT_TAGS.has(target.tagName.toUpperCase()) || target.isContentEditable) return null;
	const mod = e.ctrlKey || e.metaKey;
	const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
	if (mod) {
		if (k === 'z') return e.shiftKey ? 'redo' : 'undo';
		if (k === 'y') return 'redo';
		if (k === 'd') return 'duplicate';
		return null;
	}
	if (k === 'Delete' || k === 'Backspace') return 'delete';
	if (k === 'Escape') return 'deselect';
	return ARROWS[k] ?? null;
}
