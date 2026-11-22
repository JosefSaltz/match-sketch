/** Width of `text` in px at `fontPx` (bold or regular). Injected so layout stays pure. */
export type Measure = (text: string, fontPx: number, bold: boolean) => number;

/**
 * Splits `text` into lines no wider than `maxWidth`: by words, breaking a word that is longer
 * than a line by characters. Line breaks in the text are kept, including blank lines.
 */
export function wrapText(
	text: string,
	maxWidth: number,
	fontPx: number,
	measure: Measure,
	bold = false
): string[] {
	const fits = (s: string) => measure(s, fontPx, bold) <= maxWidth;
	const out: string[] = [];
	for (const paragraph of text.split('\n')) {
		const words = paragraph.split(/\s+/).filter(Boolean);
		if (!words.length) {
			out.push('');
			continue;
		}
		let line = '';
		for (let word of words) {
			const joined = line ? `${line} ${word}` : word;
			if (fits(joined)) {
				line = joined;
				continue;
			}
			if (line) out.push(line);
			// A word wider than the line is broken by characters.
			while (!fits(word)) {
				let n = word.length - 1;
				while (n > 1 && !fits(word.slice(0, n))) n--;
				out.push(word.slice(0, n));
				word = word.slice(n);
			}
			line = word;
		}
		out.push(line);
	}
	return out;
}
