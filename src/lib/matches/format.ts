/**
 * A match date (`YYYY-MM-DD`) for display. Read as a local calendar day: `new Date('2026-11-29')`
 * is UTC midnight, which shows as Nov 28 west of Greenwich. "No date" when blank.
 */
export function formatMatchDate(date: string): string {
	if (!date) return 'No date';
	const [y, m, d] = date.split('-').map(Number);
	return new Date(y, m - 1, d).toLocaleDateString(undefined, {
		month: 'short',
		day: 'numeric',
		year: 'numeric'
	});
}

/** "1 stage", "3 stages". */
export function stageCount(n: number): string {
	return `${n} ${n === 1 ? 'stage' : 'stages'}`;
}
