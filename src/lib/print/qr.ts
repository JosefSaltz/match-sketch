import { encode } from 'uqr';
import type { Rect } from './layout';

/**
 * The QR code for `text` as rows of dark (true) and light modules, with a 2-module quiet zone.
 * Error correction L keeps the version low, so modules print as large as the header allows (a
 * clean laser print needs little correction).
 */
export function qrModules(text: string): boolean[][] {
	return encode(text, { ecc: 'L', border: 2 }).data;
}

/** One SVG path drawing the dark modules into `rect` (attributes only, for the PDF). */
export function qrPath(modules: boolean[][], rect: Rect): string {
	const k = rect.width / modules.length;
	let d = '';
	modules.forEach((row, y) =>
		row.forEach((dark, x) => {
			if (dark) d += `M${rect.x + x * k} ${rect.y + y * k}h${k}v${k}h${-k}z`;
		})
	);
	return d;
}
