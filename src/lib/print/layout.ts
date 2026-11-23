import { toDrawn, type DepthMap } from '../geometry/depth-map';
import type { CanvasSize } from '../geometry/types';
import { toFeet, type LengthUnit } from '../geometry/units';
import type { StageBrief } from '../model/plan';
import { displaySteps } from '../model/procedure';
import { MARGIN_PX, PX_PER_IN, pageSize, type Orientation } from './page';
import { wrapText, type Measure } from './wrap';

export type Rect = { x: number; y: number; width: number; height: number };

/** Lines of text set from (x, y) (the top of the first line), one per `lineHeight`. */
export type TextBlock = {
	x: number;
	y: number;
	width: number;
	lines: string[];
	fontPx: number;
	lineHeight: number;
	bold?: boolean;
};

/** The title and stage number are fitted to the header (sizes from the injected measure). */
export type PageHeader = {
	rect: Rect;
	number: string;
	title: string;
	sub: string;
	titleX: number;
	titleFontPx: number;
	/** Width of the black stage-number block; 0 when there is no number. */
	numberBlockWidth: number;
	numberFontPx: number;
	/** The QR code to the shared link at the header's right end (spec §7.11), if shared. */
	qr: { rect: Rect; caption: TextBlock; link: string } | null;
};
export type PageFooter = { y: number; left: string; right: string };
export type Fact = { label: string; box: Rect; block: TextBlock };
type PageBase = { size: { width: number; height: number }; header: PageHeader; footer: PageFooter };

/** Layout B: header, a large diagram, the facts strip, then the procedure beside the notes. */
export type StagePage = PageBase & {
	kind: 'stage';
	diagram: Rect;
	/** Tile outlines (drawn feet) shown on the overview when printing tiles. */
	tiles: Rect[];
	facts: Fact[];
	headings: TextBlock[];
	procedure: TextBlock[];
	notes: TextBlock[];
	/** Set when the procedure and notes moved to the following page. */
	pointer: string | null;
};
export type ContinuedPage = PageBase & {
	kind: 'continued';
	headings: TextBlock[];
	/** The full facts, when one was too long for page 1's strip. */
	facts: TextBlock[];
	procedure: TextBlock[];
	notes: TextBlock[];
};
/** One part of the diagram at a fixed scale; `tile` is in drawn feet of the bay. */
export type TilePage = PageBase & {
	kind: 'tile';
	diagram: Rect;
	tile: Rect;
	index: number;
	count: number;
};
export type PrintPage = StagePage | ContinuedPage | TilePage;

export type PlanPrintInput = {
	title: string;
	stageNumber: string;
	matchName: string;
	date: string;
	brief: StageBrief;
	/** The Targets line (override or computed tally). */
	targets: string;
	canvas: CanvasSize;
	depth: DepthMap | null;
	unit: LengthUnit;
	orientation: Orientation;
	mode: 'fit' | { tileScaleFtPerIn: number };
	/** The viewer link printed as a QR code on the stage page; null when not shared. */
	link: string | null;
};

const HEADER_H = 60;
const SLIM_HEADER_H = 30;
const GAP = 12;
const BODY_PX = 13;
const LINE_H = 17;
const HEADING_PX = 9;
const HEADING_H = 14;
const FACT_LABEL_PX = 9;
const FACT_PX = 12;
const FACT_LINE_H = 15;
const FACT_PAD = 6;
const MIN_PROCEDURE_LINES = 4;
/** The facts and procedure take at most this share of the page, so the diagram stays large. */
const BELOW_DIAGRAM_MAX = 0.45;
/** Paper overlap between neighbouring tiles. */
export const TILE_OVERLAP_PX = 24;
/** Paper margin tiles leave around the bay, so a target standing on an edge prints whole. */
export const TILE_MARGIN_PX = 56;
const TILE_SCALES = [5, 10, 20, 50];

function frame(o: Orientation) {
	const size = pageSize(o);
	return {
		size,
		x: MARGIN_PX,
		top: MARGIN_PX,
		width: size.width - MARGIN_PX * 2,
		bottom: size.height - MARGIN_PX
	};
}

/** Where a tile page's diagram goes: below the slim header, to the bottom margin. */
export function tileArea(o: Orientation): Rect {
	const f = frame(o);
	const y = f.top + SLIM_HEADER_H + GAP;
	return { x: f.x, y, width: f.width, height: f.bottom - y };
}

/** The procedure as numbered steps (numbers typed into the procedure are replaced). */
function numberedSteps(brief: StageBrief): string[] {
	return displaySteps(brief.steps).map((s, i) => `${i + 1}. ${s.text}`);
}

type Line = { text: string; bold: boolean; part: 'facts' | 'procedure' | 'notes' };

function procedureLines(brief: StageBrief, width: number, measure: Measure): Line[] {
	return numberedSteps(brief).flatMap((s) =>
		wrapText(s, width, BODY_PX, measure).map((text) => ({
			text,
			bold: false,
			part: 'procedure' as const
		}))
	);
}

function noteLines(brief: StageBrief, width: number, measure: Measure): Line[] {
	return brief.notes.flatMap((n) => [
		...(n.title.trim()
			? wrapText(n.title.trim(), width, BODY_PX, measure, true).map((text) => ({
					text,
					bold: true,
					part: 'notes' as const
				}))
			: []),
		...wrapText(n.body, width, BODY_PX, measure).map((text) => ({
			text,
			bold: false,
			part: 'notes' as const
		}))
	]);
}

/** Groups consecutive lines of the same weight into blocks set from `y`. */
function blocks(lines: Line[], x: number, y: number, width: number): TextBlock[] {
	const out: TextBlock[] = [];
	for (const line of lines) {
		const last = out.at(-1);
		if (last && !!last.bold === line.bold) {
			last.lines.push(line.text);
		} else {
			out.push({
				x,
				y: y + (out.length ? out.reduce((n, b) => n + b.lines.length, 0) * LINE_H : 0),
				width,
				lines: [line.text],
				fontPx: BODY_PX,
				lineHeight: LINE_H,
				bold: line.bold || undefined
			});
		}
	}
	return out;
}

function heading(text: string, x: number, y: number, width: number): TextBlock {
	return { x, y, width, lines: [text], fontPx: HEADING_PX, lineHeight: HEADING_H, bold: true };
}

const NUMBER_BLOCK_MIN = 84;
const TITLE_PX = 24;
const TITLE_MIN_PX = 14;
const SUB_PX = 12;
const QR_CAPTION_W = 62;
const QR_CAPTION_PX = 8;
const QR_CAPTION_LINE_H = 10;

function headerFor(input: PlanPrintInput, o: Orientation, measure: Measure): PageHeader {
	const f = frame(o);
	const rect = { x: f.x, y: f.top, width: f.width, height: HEADER_H };
	const number = input.stageNumber;
	let numberFontPx = 32;
	let numberBlockWidth = 0;
	if (number) {
		while (
			numberFontPx > TITLE_MIN_PX &&
			measure(number, numberFontPx, true) > NUMBER_BLOCK_MIN - 12
		) {
			numberFontPx -= 2;
		}
		numberBlockWidth = Math.max(
			NUMBER_BLOCK_MIN,
			Math.ceil(measure(number, numberFontPx, true)) + 16
		);
	}
	const titleX = rect.x + (number ? numberBlockWidth + 14 : 12);
	// The QR code is a square the header's height at its right end, its caption to the left.
	const qrRect = input.link
		? { x: rect.x + rect.width - HEADER_H, y: rect.y, width: HEADER_H, height: HEADER_H }
		: null;
	const caption: TextBlock | null = qrRect
		? {
				x: qrRect.x - QR_CAPTION_W - 4,
				y: rect.y + (HEADER_H - 2 * QR_CAPTION_LINE_H) / 2 - 2,
				width: QR_CAPTION_W,
				lines: ['Scan for the', 'walkthrough'],
				fontPx: QR_CAPTION_PX,
				lineHeight: QR_CAPTION_LINE_H,
				bold: true
			}
		: null;
	const right = caption ? caption.x : rect.x + rect.width;
	const room = right - titleX - 8;
	// Shrink a long name to fit; if it still doesn't, cut it with an ellipsis.
	let title = input.title;
	let titleFontPx = TITLE_PX;
	while (titleFontPx > TITLE_MIN_PX && measure(title.toUpperCase(), titleFontPx, true) > room) {
		titleFontPx -= 1;
	}
	while (title.length > 1 && measure(title.toUpperCase(), titleFontPx, true) > room) {
		title = `${title.slice(0, -2).trimEnd()}…`;
	}
	// The match line shares the room: cut it before it runs under the QR code.
	let sub = [input.matchName, input.date].filter(Boolean).join(' · ');
	while (sub.length > 1 && measure(sub, SUB_PX, false) > room) {
		sub = `${sub.slice(0, -2).trimEnd()}…`;
	}
	return {
		rect,
		number,
		title,
		sub,
		titleX,
		titleFontPx,
		numberBlockWidth,
		numberFontPx,
		qr: qrRect && caption && input.link ? { rect: qrRect, caption, link: input.link } : null
	};
}

function slimHeader(input: PlanPrintInput, o: Orientation, title: string): PageHeader {
	const f = frame(o);
	return {
		rect: { x: f.x, y: f.top, width: f.width, height: SLIM_HEADER_H },
		number: '',
		title,
		sub: '',
		titleX: f.x,
		titleFontPx: 13,
		numberBlockWidth: 0,
		numberFontPx: 0,
		qr: null
	};
}

function stageLabel(input: PlanPrintInput): string {
	return input.stageNumber ? `Stage ${input.stageNumber} · ${input.title}` : input.title;
}

function footerFor(input: PlanPrintInput, o: Orientation): PageFooter {
	const f = frame(o);
	const left = input.matchName
		? `${input.matchName}${input.stageNumber ? ` · Stage ${input.stageNumber}` : ''}`
		: stageLabel(input);
	return { y: f.bottom + 20, left, right: '' };
}

/**
 * Lays out one plan's pages: the layout B page, then continuation pages if the procedure and
 * notes don't fit, then tile pages in tile mode. Footers read "Page x of y" within the plan
 * (see `numberPages` to number a longer document).
 */
export function layoutPlan(input: PlanPrintInput, measure: Measure): PrintPage[] {
	const o = input.orientation;
	const f = frame(o);
	const header = headerFor(input, o, measure);
	const headerBottom = header.rect.y + header.rect.height;

	// Facts strip: five boxes in a row.
	const factValues: [string, string][] = [
		['Start position', input.brief.startPosition],
		['Gun ready', input.brief.gunReady],
		['Round count', input.brief.roundCount],
		['Targets', input.targets],
		['Par time', input.brief.parTime]
	];
	const boxW = f.width / factValues.length;
	const fullFacts = factValues.map(([, v]) =>
		wrapText(v.trim() || '—', boxW - FACT_PAD * 2, FACT_PX, measure)
	);
	// The strip grows to show long facts, within the space below the diagram (keeping a line for
	// the pointer); a fact longer still is cut here and printed in full on the next page.
	const belowBudget = (f.bottom - headerBottom - GAP) * BELOW_DIAGRAM_MAX - GAP;
	const factsMaxLines = Math.max(
		2,
		Math.floor((belowBudget - HEADING_H - LINE_H - FACT_PAD * 2 - FACT_LABEL_PX - 4) / FACT_LINE_H)
	);
	const factsCut = fullFacts.some((l) => l.length > factsMaxLines);
	const factLines = fullFacts.map((l) =>
		l.length > factsMaxLines ? [...l.slice(0, factsMaxLines - 1), '…'] : l
	);
	const factsH =
		FACT_PAD * 2 + FACT_LABEL_PX + 4 + Math.max(...factLines.map((l) => l.length)) * FACT_LINE_H;

	// Procedure (left, 62%) beside the notes (right).
	const procW = Math.round(f.width * 0.62) - 8;
	const notesX = f.x + procW + 16;
	const notesW = f.width - procW - 16;
	const proc = procedureLines(input.brief, procW, measure);
	const notes = noteLines(input.brief, notesW, measure);
	const neededH = HEADING_H + Math.max(proc.length, notes.length) * LINE_H;
	const budget = (f.bottom - headerBottom - GAP) * BELOW_DIAGRAM_MAX - factsH - GAP;
	const fits = !factsCut && neededH <= budget;
	const blockH = fits
		? Math.max(neededH, HEADING_H + MIN_PROCEDURE_LINES * LINE_H)
		: HEADING_H + LINE_H;

	const blockY = f.bottom - blockH;
	const factsY = blockY - GAP - factsH;
	const diagram = {
		x: f.x,
		y: headerBottom + GAP,
		width: f.width,
		height: factsY - GAP - (headerBottom + GAP)
	};
	const facts: Fact[] = factValues.map(([label], i) => {
		const box = { x: f.x + i * boxW, y: factsY, width: boxW, height: factsH };
		return {
			label,
			box,
			block: {
				x: box.x + FACT_PAD,
				y: box.y + FACT_PAD + FACT_LABEL_PX + 4,
				width: boxW - FACT_PAD * 2,
				lines: factLines[i],
				fontPx: FACT_PX,
				lineHeight: FACT_LINE_H
			}
		};
	});

	const footer = footerFor(input, o);
	const tiles =
		input.mode === 'fit'
			? []
			: tileGrid(
					input.canvas,
					input.depth,
					tileArea(o),
					input.mode.tileScaleFtPerIn,
					TILE_OVERLAP_PX,
					TILE_MARGIN_PX
				);
	const stage: StagePage = {
		kind: 'stage',
		size: f.size,
		header,
		diagram,
		tiles,
		facts,
		headings: fits
			? [
					heading('STAGE PROCEDURE', f.x, blockY, procW),
					...(notes.length ? [heading('NOTES', notesX, blockY, notesW)] : [])
				]
			: [],
		procedure: fits ? blocks(proc, f.x, blockY + HEADING_H, procW) : [],
		notes: fits ? blocks(notes, notesX, blockY + HEADING_H, notesW) : [],
		pointer: fits
			? null
			: factsCut
				? 'Full stage facts, procedure and notes on page 2'
				: 'Stage procedure and notes on page 2',
		footer
	};
	const pages: PrintPage[] = [stage];

	if (!fits) {
		// The procedure, then the notes, full width, paged by whole lines.
		const fullProc = procedureLines(input.brief, f.width, measure);
		const fullNotes = noteLines(input.brief, f.width, measure);
		type Item = Line | { heading: string };
		const factLinesFull: Line[] = factsCut
			? factValues.flatMap(([label, v]) => [
					{ text: label, bold: true, part: 'facts' as const },
					...wrapText(v.trim() || '—', f.width, BODY_PX, measure).map((text) => ({
						text,
						bold: false,
						part: 'facts' as const
					}))
				])
			: [];
		const stream: Item[] = [
			...(factsCut ? [{ heading: 'STAGE FACTS' }, ...factLinesFull] : []),
			{ heading: 'STAGE PROCEDURE' },
			...fullProc,
			...(fullNotes.length ? [{ heading: 'NOTES' }, ...fullNotes] : [])
		];
		const top = f.top + SLIM_HEADER_H + GAP;
		const perPage = Math.max(1, Math.floor((f.bottom - top) / LINE_H));
		for (let start = 0; start < stream.length; start += perPage) {
			const chunk = stream.slice(start, start + perPage);
			const headings: TextBlock[] = [];
			const factLinesOnPage: Line[] = [];
			const procLines: Line[] = [];
			const notesLinesOnPage: Line[] = [];
			let factsY: number | null = null;
			let procY: number | null = null;
			let notesY: number | null = null;
			chunk.forEach((item, i) => {
				const y = top + i * LINE_H;
				if ('heading' in item) {
					headings.push(heading(item.heading, f.x, y + (LINE_H - HEADING_H), f.width));
				} else if (item.part === 'facts') {
					factsY ??= y;
					factLinesOnPage.push(item);
				} else if (item.part === 'procedure') {
					procY ??= y;
					procLines.push(item);
				} else {
					notesY ??= y;
					notesLinesOnPage.push(item);
				}
			});
			pages.push({
				kind: 'continued',
				size: f.size,
				header: slimHeader(input, o, `${stageLabel(input)} (continued)`),
				headings,
				facts: factsY === null ? [] : blocks(factLinesOnPage, f.x, factsY, f.width),
				procedure: procY === null ? [] : blocks(procLines, f.x, procY, f.width),
				notes: notesY === null ? [] : blocks(notesLinesOnPage, f.x, notesY, f.width),
				footer: footerFor(input, o)
			});
		}
	}

	const area = tileArea(o);
	tiles.forEach((tile, i) => {
		pages.push({
			kind: 'tile',
			size: f.size,
			header: slimHeader(input, o, `${stageLabel(input)} · Tile ${i + 1} of ${tiles.length}`),
			diagram: area,
			tile,
			index: i + 1,
			count: tiles.length,
			footer: footerFor(input, o)
		});
	});

	return numberPages(pages, 0, pages.length);
}

/**
 * Numbers footers "Page x of y" for pages that start at document page `offset + 1` in a document
 * of `total` pages, and points a stage page at the page that continues it.
 */
export function numberPages(pages: PrintPage[], offset: number, total: number): PrintPage[] {
	return pages.map((p, i) => {
		const footer = { ...p.footer, right: `Page ${offset + i + 1} of ${total}` };
		if (p.kind === 'stage' && p.pointer) {
			return {
				...p,
				footer,
				pointer: p.pointer.replace(/on page \d+$/, `on page ${offset + i + 2}`)
			};
		}
		return { ...p, footer };
	});
}

/**
 * Tiles covering the bay's drawn area (true width × drawn depth) plus `marginPx` of paper around
 * it, at `ftPerIn`, each tile the size of `areaPx` on paper, neighbours overlapping by
 * `overlapPx`. Row by row from the shooter's end, left to right; a bay that fits is centered.
 */
export function tileGrid(
	canvas: CanvasSize,
	depth: DepthMap | null,
	areaPx: { width: number; height: number },
	ftPerIn: number,
	overlapPx = TILE_OVERLAP_PX,
	marginPx = 0
): Rect[] {
	const ftPerPx = ftPerIn / PX_PER_IN;
	const margin = marginPx * ftPerPx;
	const tileW = areaPx.width * ftPerPx;
	const tileH = areaPx.height * ftPerPx;
	const overlap = overlapPx * ftPerPx;
	const drawnDepth = toDrawn(canvas.depthFt, depth);
	/** Tile starts covering [-margin, size + margin]. */
	const starts = (size: number, tile: number) => {
		const span = size + margin * 2;
		if (span <= tile) return [-margin - (tile - span) / 2];
		const n = Math.ceil((span - overlap) / (tile - overlap));
		return Array.from(
			{ length: n },
			(_, i) => Math.min(i * (tile - overlap), span - tile) - margin
		);
	};
	const out: Rect[] = [];
	for (const y of starts(drawnDepth, tileH)) {
		for (const x of starts(canvas.widthFt, tileW)) out.push({ x, y, width: tileW, height: tileH });
	}
	return out;
}

/** The coarsest of 1 in = 5, 10, 20 or 50 (plan units) that still needs tiles; else the finest. */
export function defaultTileScale(
	canvas: CanvasSize,
	depth: DepthMap | null,
	areaPx: { width: number; height: number },
	unit: LengthUnit
): number {
	const scales = TILE_SCALES.map((v) => toFeet(v, unit));
	const needing = scales.filter((s) => tileGrid(canvas, depth, areaPx, s).length > 1);
	return needing.length ? needing[needing.length - 1] : scales[0];
}

/** The tile scales offered, in feet per inch, for a plan's unit. */
export function tileScales(unit: LengthUnit): { ftPerIn: number; label: string }[] {
	return TILE_SCALES.map((v) => ({ ftPerIn: toFeet(v, unit), label: `1 in = ${v} ${unit}` }));
}
