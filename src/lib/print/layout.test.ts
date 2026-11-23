import { stepsFromText } from '../model/procedure';
import { describe, expect, it } from 'vitest';
import { emptyPlanDocument } from '../model/plan';
import {
	defaultTileScale,
	layoutPlan,
	tileGrid,
	type PlanPrintInput,
	type PrintPage
} from './layout';
import { MARGIN_PX, pageSize } from './page';
import { wrapText, type Measure } from './wrap';

/** A fixed-width stand-in for real font metrics: every character is half the font size wide. */
const measure: Measure = (text, px) => text.length * px * 0.5;

const brief = {
	...emptyPlanDocument().brief,
	stageNumber: '3',
	stageName: 'Bunker Down',
	startPosition: 'Standing in Box A',
	gunReady: 'Loaded, holstered',
	steps: stepsFromText([], 'Engage T1–T4 from Box A.\nMove to Box B.'),
	roundCount: '21 rds',
	parTime: '120 s'
};

function input(extra: Partial<PlanPrintInput> = {}): PlanPrintInput {
	return {
		title: 'Bunker Down',
		stageNumber: '3',
		matchName: 'DRRC November',
		date: 'Nov 29, 2026',
		brief,
		targets: '4 paper targets',
		canvas: { widthFt: 150, depthFt: 90 },
		depth: null,
		unit: 'yd',
		orientation: 'portrait',
		mode: 'fit',
		link: null,
		...extra
	};
}

const lines = (n: number) =>
	Array.from({ length: n }, (_, i) => `Step ${i + 1} of the course of fire`).join('\n');

describe('wrapText', () => {
	it('wraps by words and hard-breaks words longer than the line', () => {
		expect(wrapText('aaa bbb ccc', 30, 10, measure)).toEqual(['aaa', 'bbb', 'ccc']);
		expect(wrapText('aaaaaaaaaaaa', 30, 10, measure)).toEqual(['aaaaaa', 'aaaaaa']);
	});

	it('keeps line breaks and blank lines', () => {
		expect(wrapText('one\n\ntwo', 1000, 10, measure)).toEqual(['one', '', 'two']);
	});
});

describe('layoutPlan', () => {
	it('fits a short stage on one page in layout B order', () => {
		const pages = layoutPlan(input(), measure);
		expect(pages).toHaveLength(1);
		const p = pages[0];
		if (p.kind !== 'stage') throw new Error('expected a stage page');
		const { width, height } = pageSize('portrait');
		expect(p.header.rect.y).toBeGreaterThanOrEqual(MARGIN_PX);
		expect(p.diagram.y).toBeGreaterThan(p.header.rect.y + p.header.rect.height);
		expect(p.facts.map((f) => f.label)).toEqual([
			'Start position',
			'Gun ready',
			'Round count',
			'Targets',
			'Par time'
		]);
		expect(p.facts[0].box.y).toBeGreaterThan(p.diagram.y + p.diagram.height);
		expect(p.procedure[0].y).toBeGreaterThan(p.facts[0].box.y + p.facts[0].box.height);
		expect(p.procedure.flatMap((b) => b.lines)).toEqual([
			'1. Engage T1–T4 from Box A.',
			'2. Move to Box B.'
		]);
		expect(p.pointer).toBeNull();
		expect(p.diagram.x + p.diagram.width).toBeLessThanOrEqual(width - MARGIN_PX);
		expect(p.diagram.height).toBeGreaterThan(height * 0.45);
	});

	it('does not double-number steps the MD numbered', () => {
		const [p] = layoutPlan(
			input({ brief: { ...brief, steps: stepsFromText([], '1. Start\n\n2) Move') } }),
			measure
		);
		if (p.kind !== 'stage') throw new Error('expected a stage page');
		expect(p.procedure.flatMap((b) => b.lines)).toEqual(['1. Start', '2. Move']);
	});

	it('moves a long procedure and the notes to page 2 with a pointer', () => {
		const pages = layoutPlan(
			input({ brief: { ...brief, steps: stepsFromText([], lines(40)) } }),
			measure
		);
		expect(pages.map((p) => p.kind)).toEqual(['stage', 'continued']);
		const [first, second] = pages;
		if (first.kind !== 'stage' || second.kind !== 'continued') throw new Error('kinds');
		expect(first.pointer).toBe('Stage procedure and notes on page 2');
		expect(first.procedure).toEqual([]);
		expect(second.procedure.flatMap((b) => b.lines)).toHaveLength(40);
	});

	it('continues a procedure longer than a page onto page 3', () => {
		const pages = layoutPlan(
			input({ brief: { ...brief, steps: stepsFromText([], lines(90)) } }),
			measure
		);
		expect(pages.map((p) => p.kind)).toEqual(['stage', 'continued', 'continued']);
		const shown = pages.flatMap((p) =>
			p.kind === 'continued' ? p.procedure.flatMap((b) => b.lines) : []
		);
		expect(shown).toHaveLength(90);
	});

	it('numbers footers page x of y', () => {
		const pages = layoutPlan(
			input({ brief: { ...brief, steps: stepsFromText([], lines(40)) } }),
			measure
		);
		expect(pages.map((p) => p.footer.right)).toEqual(['Page 1 of 2', 'Page 2 of 2']);
		expect(pages[0].footer.left).toBe('DRRC November · Stage 3');
	});

	it('lays out landscape pages wider than tall', () => {
		const [p] = layoutPlan(input({ orientation: 'landscape' }), measure);
		if (p.kind !== 'stage') throw new Error('expected a stage page');
		expect(p.diagram.width).toBeGreaterThan(p.diagram.height);
		expect(p.diagram.x + p.diagram.width).toBeLessThanOrEqual(
			pageSize('landscape').width - MARGIN_PX
		);
	});

	it('adds one page per tile after the overview in tile mode', () => {
		const pages = layoutPlan(
			input({ canvas: { widthFt: 120, depthFt: 900 }, mode: { tileScaleFtPerIn: 30 } }),
			measure
		);
		const tiles = pages.filter((p): p is Extract<PrintPage, { kind: 'tile' }> => p.kind === 'tile');
		expect(pages[0].kind).toBe('stage');
		expect(tiles.length).toBeGreaterThan(1);
		expect(tiles.map((t) => t.header.title)).toContain(
			`Stage 3 · Bunker Down · Tile 1 of ${tiles.length}`
		);
	});
});

describe('layoutPlan edge cases (final review)', () => {
	const stage = (pages: PrintPage[]) => {
		const p = pages[0];
		if (p.kind !== 'stage') throw new Error('expected a stage page');
		return p;
	};

	it('puts the QR code to a shared link at the right of the stage header', () => {
		const link = 'https://ms.example/s/AbCdEfGhIjKlMnOpQrStUv';
		const [plain] = layoutPlan(input(), measure);
		const [shared] = layoutPlan(input({ link }), measure);
		expect(plain.header.qr).toBeNull();
		const qr = shared.header.qr!;
		expect(qr.link).toBe(link);
		const h = shared.header.rect;
		expect(qr.rect).toEqual({
			x: h.x + h.width - h.height,
			y: h.y,
			width: h.height,
			height: h.height
		});
		expect(qr.caption.lines).toEqual(['Scan for the', 'walkthrough']);
		expect(qr.caption.x + qr.caption.width).toBeLessThanOrEqual(qr.rect.x);
		// The title area ends before the caption.
		const long = layoutPlan(
			input({ link, title: 'A very long stage name '.repeat(4) }),
			measure
		)[0];
		expect(
			long.header.titleX + measure(long.header.title.toUpperCase(), long.header.titleFontPx, true)
		).toBeLessThanOrEqual(long.header.qr!.caption.x);
	});

	it('cuts a long match line before the QR code', () => {
		const link = 'https://ms.example/s/AbCdEfGhIjKlMnOpQrStUv';
		const [p] = layoutPlan(
			input({ link, matchName: 'A very long match name '.repeat(6) }),
			measure
		);
		expect(p.header.sub.endsWith('…')).toBe(true);
		expect(p.header.titleX + measure(p.header.sub, 12, false)).toBeLessThanOrEqual(
			p.header.qr!.caption.x
		);
	});

	it('prints the QR code only on the stage page, not continued or tile pages', () => {
		const link = 'https://ms.example/s/AbCdEfGhIjKlMnOpQrStUv';
		const long = layoutPlan(
			input({ link, brief: { ...brief, steps: stepsFromText([], lines(40)) } }),
			measure
		);
		expect(long.map((p) => p.header.qr !== null)).toEqual([true, false]);
		const tiled = layoutPlan(input({ link, mode: { tileScaleFtPerIn: 10 } }), measure);
		expect(tiled.filter((p) => p.header.qr !== null).map((p) => p.kind)).toEqual(['stage']);
	});

	it('shrinks a long stage name to fit the header', () => {
		const title = 'Moving Targets Through The Shoot House Of Horrors And Back Again Twice';
		const p = stage(layoutPlan(input({ title }), measure));
		expect(p.header.titleFontPx).toBeLessThan(24);
		const room = p.header.rect.x + p.header.rect.width - p.header.titleX - 8;
		expect(measure(p.header.title.toUpperCase(), p.header.titleFontPx, true)).toBeLessThanOrEqual(
			room
		);
	});

	it('widens the number block for a long stage number', () => {
		const p = stage(layoutPlan(input({ stageNumber: 'Classifier 99-11' }), measure));
		const h = p.header;
		expect(h.numberBlockWidth).toBeGreaterThanOrEqual(
			measure('Classifier 99-11', h.numberFontPx, true) + 12
		);
		expect(h.titleX).toBeGreaterThan(h.rect.x + h.numberBlockWidth);
	});

	it('lets the facts strip grow to show a long fact in full', () => {
		const gunReady = 'Rifle loaded, chamber empty, safety on, held at port arms. '.repeat(4).trim();
		const p = stage(layoutPlan(input({ brief: { ...brief, gunReady } }), measure));
		const shown = p.facts[1].block.lines.join(' ');
		expect(shown).not.toContain('…');
		expect(shown.replace(/\s+/g, ' ')).toBe(gunReady);
	});

	it('prints a fact too long for page 1 in full on the next page, and says so', () => {
		const gunReady = 'Shotgun empty, staged on the table in SA-2 with the action open. '
			.repeat(30)
			.trim();
		const pages = layoutPlan(input({ brief: { ...brief, gunReady } }), measure);
		const first = stage(pages);
		expect(first.pointer).toMatch(/on page 2$/);
		const rest = pages
			.filter((p) => p.kind === 'continued')
			.flatMap((p) =>
				p.kind === 'continued' ? [...p.headings, ...p.facts, ...p.procedure, ...p.notes] : []
			)
			.flatMap((b) => b.lines)
			.join(' ');
		expect(rest).toContain('STAGE FACTS');
		expect(rest.replace(/\s+/g, ' ')).toContain(gunReady.slice(-60));
	});
});

describe('tileGrid', () => {
	const area = { width: 730, height: 900 };

	it('tiles a 40 × 300 yd bay at 1 in = 10 yd with overlap, covering it all', () => {
		const tiles = tileGrid({ widthFt: 120, depthFt: 900 }, null, area, 30);
		// 1 in = 30 ft: a tile holds 730/96*30 ≈ 228 ft across and 281 ft deep.
		expect(tiles).toHaveLength(4);
		expect(Math.min(...tiles.map((t) => t.y))).toBe(0);
		expect(Math.max(...tiles.map((t) => t.y + t.height))).toBeGreaterThanOrEqual(900);
		const overlapFt = (24 / 96) * 30;
		const ys = [...new Set(tiles.map((t) => t.y))].sort((a, b) => a - b);
		for (let i = 1; i < ys.length; i++) {
			expect(ys[i]).toBeLessThanOrEqual(ys[i - 1] + tiles[0].height - overlapFt + 1e-6);
		}
	});

	it('leaves a paper margin around the bay so edge objects print whole', () => {
		const tiles = tileGrid({ widthFt: 120, depthFt: 900 }, null, area, 30, 24, 56);
		const marginFt = (56 / 96) * 30;
		expect(Math.min(...tiles.map((t) => t.y))).toBeCloseTo(-marginFt);
		expect(Math.max(...tiles.map((t) => t.y + t.height))).toBeGreaterThanOrEqual(
			900 + marginFt - 1e-6
		);
		expect(Math.min(...tiles.map((t) => t.x))).toBeLessThanOrEqual(-marginFt + 1e-6);
	});

	it('uses one tile when the bay fits', () => {
		expect(tileGrid({ widthFt: 60, depthFt: 60 }, null, area, 30)).toHaveLength(1);
	});

	it('tiles the drawn depth when there is a scale break', () => {
		const depth = { fromFt: 90, toFt: 900, drawnFt: 75 };
		const tiles = tileGrid({ widthFt: 120, depthFt: 900 }, depth, area, 30);
		expect(Math.max(...tiles.map((t) => t.y + t.height))).toBeLessThan(400);
	});

	it('picks the coarsest scale that still needs tiles', () => {
		expect(defaultTileScale({ widthFt: 120, depthFt: 900 }, null, area, 'yd')).toBe(60);
		expect(defaultTileScale({ widthFt: 30, depthFt: 30 }, null, area, 'ft')).toBe(5);
	});
});
