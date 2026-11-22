/**
 * To-scale drawings of footprint objects (walls, boxes, fences…), seen from above.
 *
 * Shapes are in screen px in the object's own frame: centered on (0, 0), x to the right, y down
 * on screen, so the top edge (y = -h/2) faces downrange at rotation 0. Line widths come from
 * the `paint` (see FootprintShape.svelte), so a wall looks the same at every zoom.
 */
export const FOOTPRINT_STYLES = [
	'solid',
	'outline',
	'line',
	'start-box',
	'wall-port',
	'half-wall-port',
	'v-wall',
	'door',
	'car',
	'table',
	'pallet',
	'bench',
	'stairs',
	'platform',
	'wobble',
	'barrier',
	'berm',
	'fence'
] as const;
export type FootprintStyle = (typeof FOOTPRINT_STYLES)[number];

/**
 * `fill`: ink at 0.75 opacity · `tint`: light fill with an ink outline · `hit`: clear but
 * clickable, ink outline · `ink`: 2 px line · `detail`: 1.25 px line.
 */
export type Paint = 'fill' | 'tint' | 'hit' | 'ink' | 'detail';
export type Shape = {
	el: 'rect' | 'line' | 'path' | 'circle';
	attrs: Record<string, number | string>;
	paint: Paint;
};

/** Thin bars (lines, walls) never draw thinner than this. */
export const LINE_MIN_PX = 3;

const r = (n: number) => Math.round(n * 100) / 100;
const rect = (x: number, y: number, w: number, h: number, paint: Paint, rx = 0): Shape => ({
	el: 'rect',
	attrs:
		rx > 0
			? { x: r(x), y: r(y), width: r(w), height: r(h), rx: r(rx) }
			: { x: r(x), y: r(y), width: r(w), height: r(h) },
	paint
});
const line = (x1: number, y1: number, x2: number, y2: number, paint: Paint): Shape => ({
	el: 'line',
	attrs: { x1: r(x1), y1: r(y1), x2: r(x2), y2: r(y2) },
	paint
});
const path = (d: (string | number)[], paint: Paint): Shape => ({
	el: 'path',
	attrs: { d: d.map((v) => (typeof v === 'number' ? r(v) : v)).join(' ') },
	paint
});
const circle = (cx: number, cy: number, rad: number, paint: Paint): Shape => ({
	el: 'circle',
	attrs: { cx: r(cx), cy: r(cy), r: r(Math.max(0, rad)) },
	paint
});

/** An ellipse filling `rx` × `ry` about the center, as four cubic curves. */
function ellipse(rx: number, ry: number, paint: Paint): Shape {
	const k = 0.5523;
	return path(
		[
			'M',
			-rx,
			0,
			'C',
			-rx,
			-k * ry,
			-k * rx,
			-ry,
			0,
			-ry,
			'C',
			k * rx,
			-ry,
			rx,
			-k * ry,
			rx,
			0,
			'C',
			rx,
			k * ry,
			k * rx,
			ry,
			0,
			ry,
			'C',
			-k * rx,
			ry,
			-rx,
			k * ry,
			-rx,
			0,
			'Z'
		],
		paint
	);
}

/** A wall of `w` with a port (opening) of 30% of its width in the middle. */
function portWall(w: number, h: number, paint: Paint): Shape[] {
	const t = Math.max(h, LINE_MIN_PX);
	const gap = w * 0.3;
	const piece = (w - gap) / 2;
	return [
		rect(-w / 2, -t / 2, piece, t, paint),
		rect(gap / 2, -t / 2, piece, t, paint),
		line(-gap / 2, 0, gap / 2, 0, 'detail')
	];
}

/** Diagonal hatch lines clipped to the box, at most about 40 of them. */
function hatch(w: number, h: number): Shape[] {
	const step = Math.max(10, (w + h) / 40);
	const out: Shape[] = [];
	for (let c = -(w + h) / 2 + step; c < (w + h) / 2; c += step) {
		// The line y = x - c, clipped to the box.
		const x1 = Math.max(-w / 2, -h / 2 + c);
		const x2 = Math.min(w / 2, h / 2 + c);
		if (x2 - x1 > 0.5) out.push(line(x1, x1 - c, x2, x2 - c, 'detail'));
	}
	return out;
}

export function footprintShapes(style: FootprintStyle, w: number, h: number): Shape[] {
	const m = Math.min(w, h);
	switch (style) {
		case 'solid':
			return [rect(-w / 2, -h / 2, w, h, 'fill')];
		case 'outline':
			return [rect(-w / 2, -h / 2, w, h, 'hit')];
		case 'line': {
			const t = Math.max(h, LINE_MIN_PX);
			return [rect(-w / 2, -t / 2, w, t, 'fill')];
		}
		case 'start-box': {
			// A small triangle pointing downrange marks the start.
			const s = m * 0.35;
			return [
				rect(-w / 2, -h / 2, w, h, 'hit'),
				path(['M', 0, -s / 2, 'L', s / 2, s / 2, 'L', -s / 2, s / 2, 'Z'], 'fill')
			];
		}
		case 'wall-port':
			return portWall(w, h, 'fill');
		case 'half-wall-port':
			return portWall(w, h, 'tint');
		case 'v-wall': {
			// Two bars from the back corners meeting at the front center.
			const t = Math.min(Math.min(Math.max(m * 0.12, LINE_MIN_PX), 10), Math.max(m / 2, 1));
			const bar = (side: 1 | -1) => {
				const b = { x: side * (w / 2 - t), y: h / 2 - t / 2 };
				const a = { x: 0, y: -h / 2 + t / 2 };
				const len = Math.hypot(a.x - b.x, a.y - b.y) || 1;
				const n = { x: (-(a.y - b.y) / len) * (t / 2), y: ((a.x - b.x) / len) * (t / 2) };
				return path(
					[
						'M',
						b.x + n.x,
						b.y + n.y,
						'L',
						a.x + n.x,
						a.y + n.y,
						'L',
						a.x - n.x,
						a.y - n.y,
						'L',
						b.x - n.x,
						b.y - n.y,
						'Z'
					],
					'fill'
				);
			};
			return [bar(-1), bar(1)];
		}
		case 'door': {
			// The opening along the back edge, the leaf swung open from the left hinge, its swing.
			const leaf = Math.min(w, h);
			const hx = -w / 2;
			const hy = h / 2;
			return [
				line(hx, hy, w / 2, hy, 'detail'),
				line(hx, hy, hx, hy - leaf, 'ink'),
				path(['M', hx, hy - leaf, 'Q', hx + leaf, hy - leaf, hx + leaf, hy], 'detail')
			];
		}
		case 'car':
			return [
				rect(-w / 2, -h / 2, w, h, 'tint', m * 0.2),
				line(-w / 2 + w * 0.15, -h / 2 + h * 0.25, w / 2 - w * 0.15, -h / 2 + h * 0.25, 'detail'),
				line(-w / 2 + w * 0.15, h / 2 - h * 0.2, w / 2 - w * 0.15, h / 2 - h * 0.2, 'detail')
			];
		case 'table': {
			const leg = m * 0.06;
			const ix = w / 2 - w * 0.12;
			const iy = h / 2 - h * 0.15;
			return [
				rect(-w / 2, -h / 2, w, h, 'tint'),
				...[
					[-ix, -iy],
					[ix, -iy],
					[-ix, iy],
					[ix, iy]
				].map(([x, y]) => circle(x, y, leg, 'fill'))
			];
		}
		case 'pallet':
			return [
				rect(-w / 2, -h / 2, w, h, 'hit'),
				...[-w / 4, 0, w / 4].map((x) => line(x, -h / 2, x, h / 2, 'detail'))
			];
		case 'bench':
			return [rect(-w / 2, -h / 2, w, h, 'tint', m / 2)];
		case 'stairs':
			return [
				rect(-w / 2, -h / 2, w, h, 'hit'),
				...[1, 2, 3, 4].map((k) =>
					line(-w / 2, -h / 2 + (h * k) / 5, w / 2, -h / 2 + (h * k) / 5, 'detail')
				)
			];
		case 'platform':
			return [rect(-w / 2, -h / 2, w, h, 'tint'), ...hatch(w, h)];
		case 'wobble':
			return [
				rect(-w / 2, -h / 2, w, h, 'tint'),
				line(-w * 0.4, 0, w * 0.4, 0, 'detail'),
				path(['M', -w * 0.3, -h * 0.25, 'Q', -w * 0.42, 0, -w * 0.3, h * 0.25], 'detail'),
				path(['M', w * 0.3, -h * 0.25, 'Q', w * 0.42, 0, w * 0.3, h * 0.25], 'detail')
			];
		case 'barrier': {
			const t = Math.max(h, LINE_MIN_PX);
			const post = Math.min(LINE_MIN_PX, w / 4);
			return [
				line(-w / 2, 0, w / 2, 0, 'detail'),
				rect(-w / 2, -t / 2, post, t, 'fill'),
				rect(w / 2 - post, -t / 2, post, t, 'fill')
			];
		}
		case 'berm':
			return [
				ellipse(w / 2, h / 2, 'tint'),
				ellipse(w / 3, h / 3, 'detail'),
				ellipse(w / 6, h / 6, 'detail')
			];
		case 'fence': {
			// A line with an x every 12 px (at most 200), like mesh.
			const marks: Shape[] = [];
			const step = Math.max(12, w / 200);
			for (let x = -w / 2 + 6; x <= w / 2 - 6; x += step) {
				marks.push(line(x - 2, -2, x + 2, 2, 'detail'), line(x - 2, 2, x + 2, -2, 'detail'));
			}
			return [line(-w / 2, 0, w / 2, 0, 'ink'), ...marks];
		}
	}
}
