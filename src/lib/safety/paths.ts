/** Clipping, depth-mapped SVG paths and edge tags for danger zones. Pure. Spec §4.4. */
import { fromFeet, type LengthUnit } from '../geometry/units';
import type { CanvasSize, Point } from '../geometry/types';
import { worldToScreen, type Viewport } from '../geometry/viewport';
import { FT_PER_M, FAN_SOURCES, SPLASH_SOURCES, type LayerId } from './sources';
import type { ZoneSet } from './zones';

export type Rect = { minX: number; minY: number; maxX: number; maxY: number };

export function bayRect(c: CanvasSize): Rect {
	return { minX: 0, minY: 0, maxX: c.widthFt, maxY: c.depthFt };
}

const isInside = (p: Point, r: Rect) =>
	p.x >= r.minX && p.x <= r.maxX && p.y >= r.minY && p.y <= r.maxY;

/** Liang–Barsky: the parameter range [t0, t1] of segment a→b inside r, or null. */
function clipSegment(a: Point, b: Point, r: Rect): [number, number] | null {
	const dx = b.x - a.x;
	const dy = b.y - a.y;
	let t0 = 0;
	let t1 = 1;
	const edges: [number, number][] = [
		[-dx, a.x - r.minX],
		[dx, r.maxX - a.x],
		[-dy, a.y - r.minY],
		[dy, r.maxY - a.y]
	];
	for (const [p, q] of edges) {
		if (p === 0) {
			if (q < 0) return null;
		} else {
			const t = q / p;
			if (p < 0) {
				if (t > t1) return null;
				t0 = Math.max(t0, t);
			} else {
				if (t < t0) return null;
				t1 = Math.min(t1, t);
			}
		}
	}
	return t0 > t1 ? null : [t0, t1];
}

const lerp = (a: Point, b: Point, t: number): Point =>
	t === 0 ? { ...a } : t === 1 ? { ...b } : { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };

/** Sutherland–Hodgman against the four edges of r; [] when nothing is inside. */
export function clipPolygon(poly: Point[], r: Rect): Point[] {
	type Edge = { inside: (p: Point) => boolean; cross: (a: Point, b: Point) => Point };
	const edges: Edge[] = [
		{
			inside: (p) => p.x >= r.minX,
			cross: (a, b) => ({ x: r.minX, y: a.y + ((b.y - a.y) * (r.minX - a.x)) / (b.x - a.x) })
		},
		{
			inside: (p) => p.x <= r.maxX,
			cross: (a, b) => ({ x: r.maxX, y: a.y + ((b.y - a.y) * (r.maxX - a.x)) / (b.x - a.x) })
		},
		{
			inside: (p) => p.y >= r.minY,
			cross: (a, b) => ({ x: a.x + ((b.x - a.x) * (r.minY - a.y)) / (b.y - a.y), y: r.minY })
		},
		{
			inside: (p) => p.y <= r.maxY,
			cross: (a, b) => ({ x: a.x + ((b.x - a.x) * (r.maxY - a.y)) / (b.y - a.y), y: r.maxY })
		}
	];
	let out = poly;
	for (const e of edges) {
		const input = out;
		out = [];
		for (let i = 0; i < input.length; i++) {
			const cur = input[i];
			const prev = input[(i + input.length - 1) % input.length];
			if (e.inside(cur)) {
				if (!e.inside(prev)) out.push(e.cross(prev, cur));
				out.push(cur);
			} else if (e.inside(prev)) {
				out.push(e.cross(prev, cur));
			}
		}
		if (out.length === 0) return [];
	}
	return out;
}

/** The pieces of an open polyline inside r, in order. */
export function clipPolyline(line: Point[], r: Rect): Point[][] {
	const pieces: Point[][] = [];
	let current: Point[] | null = null;
	for (let i = 0; i + 1 < line.length; i++) {
		const a = line[i];
		const b = line[i + 1];
		const t = clipSegment(a, b, r);
		if (!t) {
			current = null;
			continue;
		}
		const [t0, t1] = t;
		if (current && t0 === 0) {
			current.push(lerp(a, b, t1));
		} else {
			current = [lerp(a, b, t0), lerp(a, b, t1)];
			pieces.push(current);
		}
		if (t1 < 1) current = null;
	}
	return pieces;
}

/** First point where the polyline goes from inside the rect to outside; null if it never does. */
export function exitPoint(line: Point[], r: Rect): Point | null {
	return exitOf(line, r)?.at ?? null;
}

/** Adds points so no segment is longer than maxStepFt (straight world lines bend through a break). */
export function densify(line: Point[], maxStepFt: number, closed = false): Point[] {
	if (line.length === 0) return [];
	const out: Point[] = [];
	const count = closed ? line.length : line.length - 1;
	for (let i = 0; i < count; i++) {
		const a = line[i];
		const b = line[(i + 1) % line.length];
		const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / maxStepFt));
		for (let k = 0; k < n; k++) out.push(k === 0 ? { ...a } : lerp(a, b, k / n));
	}
	if (!closed) out.push({ ...line[line.length - 1] });
	return out;
}

const num = (v: number) => String(Number(v.toFixed(2)));

/** World points → SVG path data in screen px through worldToScreen. */
export function toPathData(points: Point[], vp: Viewport, closed: boolean): string {
	if (points.length === 0) return '';
	const parts = points.map((p, i) => {
		const s = worldToScreen(p, vp);
		return `${i === 0 ? 'M' : 'L'}${num(s.x)} ${num(s.y)}`;
	});
	return parts.join(' ') + (closed ? ' Z' : '');
}

const meters = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
const whole = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const inUnit = (m: number, unit: LengthUnit) => Math.round(fromFeet(m * FT_PER_M, unit));

/** "50 yd (45.72 m)": plan unit rounded to whole, source meters as published. */
export function formatPublished(m: number, unit: LengthUnit): string {
	return `${whole.format(inUnit(m, unit))} ${unit} (${meters.format(m)} m)`;
}

/** "≥ 27–33 yd (25–30 m)". */
export function formatPublishedRange(fromM: number, toM: number, unit: LengthUnit): string {
	return `≥ ${whole.format(inUnit(fromM, unit))}–${whole.format(inUnit(toM, unit))} ${unit} (${meters.format(fromM)}–${meters.format(toM)} m)`;
}

/** 0 inside the rect, otherwise the Euclidean distance to it. */
export function distanceOutside(p: Point, r: Rect): number {
	const dx = Math.max(r.minX - p.x, 0, p.x - r.maxX);
	const dy = Math.max(r.minY - p.y, 0, p.y - r.maxY);
	return Math.hypot(dx, dy);
}

/** "46 yd past bay": derived distance in the plan unit only, whole number. */
export function formatPast(ft: number, unit: LengthUnit): string {
	return `${whole.format(Math.round(fromFeet(Math.max(0, ft), unit)))} ${unit} past bay`;
}

/** dir is the unit direction (world feet) of the segment crossing the bay edge at `at`, pointing outward. */
export type EdgeTag = { key: string; at: Point; text: string; dir: Point; layer: LayerId };

type Exit = { at: Point; dir: Point };

/** Where the polyline first leaves the rect, and the crossing segment's outward unit direction. */
function exitOf(line: Point[], r: Rect): Exit | null {
	for (let i = 0; i + 1 < line.length; i++) {
		const a = line[i];
		const b = line[i + 1];
		if (!isInside(a, r) || isInside(b, r)) continue;
		const t = clipSegment(a, b, r);
		if (!t) continue;
		const len = Math.hypot(b.x - a.x, b.y - a.y);
		return { at: lerp(a, b, t[1]), dir: { x: (b.x - a.x) / len, y: (b.y - a.y) / len } };
	}
	return null;
}

/** Spec §4.4: published numbers, plus how far each leaving line runs past the bay edge. */
export function zoneTags(zones: ZoneSet, r: Rect, unit: LengthUnit): EdgeTag[] {
	const tags: EdgeTag[] = [];
	for (const z of zones.splash) {
		const src = SPLASH_SOURCES[z.sourceId];
		const minimum = src.reachKind === 'minimum' && src.reachFromM !== undefined;
		const published = minimum
			? formatPublishedRange(src.reachFromM!, src.reachM, unit)
			: formatPublished(src.reachM, unit);
		for (const part of ['left', 'right'] as const) {
			const side = z[part];
			const ex = exitOf([z.origin, side.beyond ?? side.rayEnd], r);
			if (!ex) continue;
			const tail = minimum
				? 'no stated limit'
				: formatPast(
						src.reachM * FT_PER_M - Math.hypot(ex.at.x - z.origin.x, ex.at.y - z.origin.y),
						unit
					);
			tags.push({
				key: `${z.key}:${part}-ray`,
				at: ex.at,
				dir: ex.dir,
				text: `${published} · ${tail}`,
				layer: z.sourceId
			});
		}
	}
	for (const z of zones.fans) {
		const src = FAN_SOURCES[z.sourceId];
		(['left', 'right'] as const).forEach((part, i) => {
			const outline = z[part].outline;
			const disp = exitOf([z.origin, z.dispersion[i]], r);
			if (disp)
				tags.push({
					key: `${z.key}:${part}-dispersion`,
					at: disp.at,
					dir: disp.dir,
					layer: z.sourceId,
					text: `X ${formatPublished(src.xM, unit)} · ${formatPast(
						src.xM * FT_PER_M - Math.hypot(disp.at.x - z.origin.x, disp.at.y - z.origin.y),
						unit
					)}`
				});
			const ric = exitOf(outline, r);
			if (ric) {
				const reach = Math.max(...outline.slice(1).map((p) => distanceOutside(p, r)));
				tags.push({
					key: `${z.key}:${part}-ricochet`,
					at: ric.at,
					dir: ric.dir,
					layer: z.sourceId,
					text: `W ${formatPublished(src.wM, unit)} · Y ${formatPublished(src.yM, unit)} · reaches ${formatPast(reach, unit)}`
				});
			}
		});
	}
	return tags;
}

/** The bay edge a line leaves by: left/right in x, uprange (y = 0) or downrange (y = depth). */
export type BayEdge = 'left' | 'right' | 'uprange' | 'downrange';

/** One line of a tag group, drawn in its layer's color. */
export type TagLine = { text: string; layer: LayerId };

/** Tags that leave at one point, drawn as one arrow with stacked lines. */
export type TagGroup = { key: string; at: Point; dir: Point; edge: BayEdge; lines: TagLine[] };

/** Of the edges p lies on, the one dir leaves through most directly (decides corners). */
function edgeOf(p: Point, dir: Point, r: Rect, eps: number): BayEdge {
	const edges: { edge: BayEdge; on: boolean; out: number }[] = [
		{ edge: 'left', on: Math.abs(p.x - r.minX) <= eps, out: -dir.x },
		{ edge: 'right', on: Math.abs(p.x - r.maxX) <= eps, out: dir.x },
		{ edge: 'uprange', on: Math.abs(p.y - r.minY) <= eps, out: -dir.y },
		{ edge: 'downrange', on: Math.abs(p.y - r.maxY) <= eps, out: dir.y }
	];
	const on = edges.filter((e) => e.on);
	return (on.length > 0 ? on : edges).reduce((a, b) => (b.out > a.out ? b : a)).edge;
}

/** Groups tags whose exit points lie within eps feet of each other, so they never overprint. */
export function groupTags(tags: EdgeTag[], r: Rect, eps = 1e-6): TagGroup[] {
	const groups: TagGroup[] = [];
	for (const t of tags) {
		const g = groups.find(
			(g) => Math.abs(g.at.x - t.at.x) <= eps && Math.abs(g.at.y - t.at.y) <= eps
		);
		if (!g) {
			groups.push({
				key: t.key,
				at: t.at,
				dir: t.dir,
				edge: edgeOf(t.at, t.dir, r, eps),
				lines: [{ text: t.text, layer: t.layer }]
			});
		} else {
			g.key += `+${t.key}`;
			if (!g.lines.some((l) => l.text === t.text && l.layer === t.layer))
				g.lines.push({ text: t.text, layer: t.layer });
		}
	}
	return groups;
}
