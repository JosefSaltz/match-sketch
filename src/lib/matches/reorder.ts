/**
 * Where a dragged row lands: the number of other rows whose midpoint (screen y) is above the
 * pointer. That is its index in the list without the dragged row.
 */
export function reorderIndex(midpoints: number[], pointerY: number): number {
	return midpoints.filter((m) => m < pointerY).length;
}

/** A copy of `list` with the item at `from` moved to index `to`. */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
	const next = [...list];
	const [item] = next.splice(from, 1);
	next.splice(to, 0, item);
	return next;
}
