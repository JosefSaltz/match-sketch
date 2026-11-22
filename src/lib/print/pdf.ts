import { jsPDF } from 'jspdf';
import 'svg2pdf.js';
import type { Orientation } from './page';
import { toWinAnsi } from './pdf-text';

/**
 * Draws each page SVG into one Letter PDF as vectors (jsPDF + svg2pdf.js) and saves it. Pages are
 * cloned and their text mapped to WinAnsi, so the preview on screen is left untouched.
 */
export async function downloadPdf(
	pages: SVGSVGElement[],
	orientation: Orientation,
	filename: string
): Promise<void> {
	const doc = new jsPDF({ unit: 'pt', format: 'letter', orientation });
	const [width, height] = orientation === 'portrait' ? [612, 792] : [792, 612];
	for (const [i, page] of pages.entries()) {
		if (i > 0) doc.addPage('letter', orientation);
		const copy = page.cloneNode(true) as SVGSVGElement;
		for (const t of copy.querySelectorAll('text')) t.textContent = toWinAnsi(t.textContent ?? '');
		await doc.svg(copy, { x: 0, y: 0, width, height });
	}
	doc.save(filename);
}
