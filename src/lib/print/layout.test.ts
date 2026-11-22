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
	procedure: 'Engage T1–T4 from Box A.\nMove to Box B.',
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
		const [p] = layoutPlan(input({ brief: { ...brief, procedure: '1. Start\n2) Move' } }), measure);
		if (p.kind !== 'stage') throw new Error('expected a stage page');
		expect(p.procedure.flatMap((b) => b.lines)).toEqual(['1. Start', '2. Move']);
	});

	it('moves a long procedure and the notes to page 2 with a pointer', () => {
		const pages = layoutPlan(input({ brief: { ...brief, procedure: lines(40) } }), measure);
		expect(pages.map((p) => p.kind)).toEqual(['stage', 'continued']);
		const [first, second] = pages;
		if (first.kind !== 'stage' || second.kind !== 'continued') throw new Error('kinds');
		expect(first.pointer).toBe('Stage procedure and notes on page 2');
		expect(first.procedure).toEqual([]);
		expect(second.procedure.flatMap((b) => b.lines)).toHaveLength(40);
	});

	it('continues a procedure longer than a page onto page 3', () => {
		const pages = layoutPlan(input({ brief: { ...brief, procedure: lines(90) } }), measure);
		expect(pages.map((p) => p.kind)).toEqual(['stage', 'continued', 'continued']);
		const shown = pages.flatMap((p) =>
			p.kind === 'continued' ? p.procedure.flatMap((b) => b.lines) : []
		);
		expect(shown).toHaveLength(90);
	});

	it('numbers footers page x of y', () => {
		const pages = layoutPlan(input({ brief: { ...brief, procedure: lines(40) } }), measure);
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
