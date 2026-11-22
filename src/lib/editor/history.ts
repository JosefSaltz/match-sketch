export interface History<T> {
	readonly current: T;
	readonly canUndo: boolean;
	readonly canRedo: boolean;
	push(next: T): void;
	/** Makes `next` current without adding an undo step; clears redo. */
	replace(next: T): void;
	undo(): T;
	redo(): T;
}

/** Linear undo/redo over immutable values. `limit` = maximum number of undo steps kept. */
export function createHistory<T>(initial: T, opts: { limit?: number } = {}): History<T> {
	const limit = opts.limit ?? 200;
	const past: T[] = [];
	let future: T[] = [];
	let current = initial;

	return {
		get current() {
			return current;
		},
		get canUndo() {
			return past.length > 0;
		},
		get canRedo() {
			return future.length > 0;
		},
		push(next: T) {
			past.push(current);
			if (past.length > limit) past.shift();
			current = next;
			future = [];
		},
		replace(next: T) {
			current = next;
			future = [];
		},
		undo() {
			const prev = past.pop();
			if (prev === undefined) return current;
			future.push(current);
			current = prev;
			return current;
		},
		redo() {
			const next = future.pop();
			if (next === undefined) return current;
			past.push(current);
			current = next;
			return current;
		}
	};
}
