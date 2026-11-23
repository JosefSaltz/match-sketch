import type { Step } from './plan';

/** The procedure as one block of text: its steps' lines, blank ones included. */
export function procedureText(steps: Step[]): string {
	return steps.map((s) => s.text).join('\n');
}

/** Pairs of (old index, new index) for the longest common subsequence of equal lines. */
function commonLines(a: string[], b: string[]): [number, number][] {
	const n = a.length;
	const m = b.length;
	// len[i][j]: LCS length of a[i:] and b[j:].
	const len = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
	for (let i = n - 1; i >= 0; i--) {
		for (let j = m - 1; j >= 0; j--) {
			len[i][j] = a[i] === b[j] ? len[i + 1][j + 1] + 1 : Math.max(len[i + 1][j], len[i][j + 1]);
		}
	}
	const pairs: [number, number][] = [];
	let i = 0;
	let j = 0;
	while (i < n && j < m) {
		if (a[i] === b[j]) {
			pairs.push([i, j]);
			i++;
			j++;
		} else if (len[i + 1][j] >= len[i][j + 1]) i++;
		else j++;
	}
	return pairs;
}

const newStep = (text: string): Step => ({ id: crypto.randomUUID(), text, marks: [], arrows: [] });

/**
 * The procedure's steps after its text changed to `text`, one per line (spec §7.10). Unchanged
 * lines keep their step; inside each changed run, old and new lines pair up in order, so an edited
 * or split line keeps its id (and its highlights). Extra new lines are new steps.
 */
export function stepsFromText(prev: Step[], text: string): Step[] {
	if (text === '') return [];
	const lines = text.split('\n');
	const old = prev.map((s) => s.text);
	// One edit changes one run of lines: lines equal at both ends keep their steps first, so a
	// line typed into never borrows another (often blank) line's step in the middle diff.
	let head = 0;
	while (head < old.length && head < lines.length && old[head] === lines[head]) head++;
	let tail = 0;
	while (
		tail < old.length - head &&
		tail < lines.length - head &&
		old[old.length - 1 - tail] === lines[lines.length - 1 - tail]
	) {
		tail++;
	}
	const pairs = commonLines(
		old.slice(head, old.length - tail),
		lines.slice(head, lines.length - tail)
	).map(([i, j]): [number, number] => [i + head, j + head]);

	const next: Step[] = prev.slice(0, head);
	let i = head;
	let j = head;
	const fillRun = (toI: number, toJ: number) => {
		while (j < toJ) {
			next.push(i < toI ? { ...prev[i++], text: lines[j] } : newStep(lines[j]));
			j++;
		}
		i = toI;
	};
	for (const [pi, pj] of pairs) {
		fillRun(pi, pj);
		next.push(prev[pi]);
		i = pi + 1;
		j = pj + 1;
	}
	fillRun(old.length - tail, lines.length - tail);
	return [...next, ...prev.slice(old.length - tail)];
}

/** A step's text as shown and printed: trimmed, without a number typed at its start. */
export function stepLabel(text: string): string {
	return text.trim().replace(/^\d+[.)]\s*/, '');
}

/** The steps a walkthrough pages through and print numbers: the non-blank ones, as labels. */
export function displaySteps(steps: Step[]): Step[] {
	return steps.flatMap((s) => {
		const text = stepLabel(s.text);
		return text ? [{ ...s, text }] : [];
	});
}
