import type { Measure } from './wrap';

/** The print font: Helvetica in the PDF, Helvetica or Arial (same metrics) in the browser. */
export const PRINT_FONT = 'Helvetica, Arial, sans-serif';

let ctx: CanvasRenderingContext2D | null = null;

/** Measures text with a canvas in the print font (browser only). */
export const measureText: Measure = (text, fontPx, bold) => {
	ctx ??= document.createElement('canvas').getContext('2d');
	if (!ctx) return text.length * fontPx * 0.55;
	ctx.font = `${bold ? 'bold ' : ''}${fontPx}px ${PRINT_FONT}`;
	return ctx.measureText(text).width;
};
