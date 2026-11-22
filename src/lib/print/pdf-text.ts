/** Characters the PDF's standard fonts (WinAnsi) can show besides ASCII and Latin-1. */
const WIN_ANSI_EXTRA = new Set('€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ');
const SUBSTITUTES: Record<string, string> = { '−': '-', '→': '->', '←': '<-', '≈': '~' };

/** Text the standard PDF fonts can draw: common look-alikes swapped in, the rest as "?". */
export function toWinAnsi(text: string): string {
	let out = '';
	for (const ch of text) {
		const code = ch.codePointAt(0) ?? 0;
		if ((code >= 32 && code <= 126) || (code >= 160 && code <= 255) || WIN_ANSI_EXTRA.has(ch)) {
			out += ch;
		} else {
			out += SUBSTITUTES[ch] ?? '?';
		}
	}
	return out;
}

/** A file name from a title: letters, digits, spaces, dashes and underscores only. */
export function pdfFileName(title: string): string {
	const base = title.replace(/[^\p{L}\p{N} _-]+/gu, '').trim();
	return `${base || 'plan'}.pdf`;
}
