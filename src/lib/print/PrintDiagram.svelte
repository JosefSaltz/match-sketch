<svelte:options namespace="svg" />

<script lang="ts">
	import { getEntry } from '#lib/catalog/index.js';
	import { footprintShapes, paintAttrs } from '#lib/catalog/footprint-shapes.js';
	import { measureFt, resolveAnchor } from '#lib/editor/annotations.js';
	import { localBox, rotatedBounds } from '#lib/editor/object-geometry.js';
	import { toDrawn, type DepthMap } from '#lib/geometry/depth-map.js';
	import { gridChoice, scaleBar } from '#lib/geometry/grid.js';
	import type { CanvasSize, Point } from '#lib/geometry/types.js';
	import { formatLength, formatNumber, toFeet, type LengthUnit } from '#lib/geometry/units.js';
	import { worldToScreen, type Viewport } from '#lib/geometry/viewport.js';
	import type { LinkAnnotation, PlanDocument, PlanObject, Step } from '#lib/model/plan.js';
	import StepHighlights from '#lib/walkthrough/StepHighlights.svelte';
	import type { Rect } from './layout.js';
	import { markupFor } from './symbol-markup.js';

	/**
	 * The stage diagram for print and PDF: styled only with SVG attributes (no CSS classes,
	 * `currentColor` or nested `<svg>`), so the PDF conversion draws exactly what prints.
	 * `view` is the part of the bay to show in drawn feet (a tile); without it the whole bay fits
	 * `area`, leaving room for the downrange arrow above and the scale bar below.
	 */
	type Props = {
		doc: PlanDocument;
		canvas: CanvasSize;
		unit: LengthUnit;
		area: Rect;
		view?: Rect | null;
		symbolPx: number;
		depth: DepthMap | null;
		tiles?: Rect[];
		/** Thumbnails leave out the arrow, scale bar and labels. */
		bare?: boolean;
		/**
		 * A walkthrough step to show (spec §7.10): its marked objects and arrows stand out, everything
		 * else fades back.
		 */
		step?: Step | null;
	};
	let {
		doc,
		canvas,
		unit,
		area,
		view = null,
		symbolPx,
		depth,
		tiles = [],
		bare = false,
		step = null
	}: Props = $props();

	const INK = '#1c1c1a';
	const FONT = 'Helvetica, Arial, sans-serif';
	const STRIP_FILL = '#eef1f5';
	const uid = $props.id();

	const drawnDepth = $derived(toDrawn(canvas.depthFt, depth));
	const shown = $derived(view ?? { x: 0, y: 0, width: canvas.widthFt, height: drawnDepth });
	/**
	 * Room around the bay so nothing printed is cut off: above for the downrange arrow and for
	 * targets standing on the back line (a full symbol tall), at the sides for half a symbol and
	 * labels (and the strip's distance ticks on the left), below for the scale bar.
	 */
	const pad = $derived({
		top: symbolPx + 34,
		bottom: Math.max(36, symbolPx / 2 + 20),
		left: symbolPx / 2 + 14 + (depth || doc.display.gridFt ? 46 : 0),
		right: symbolPx / 2 + 48
	});
	const inner = $derived(
		view || bare
			? area
			: {
					x: area.x + pad.left,
					y: area.y + pad.top,
					width: Math.max(1, area.width - pad.left - pad.right),
					height: Math.max(1, area.height - pad.top - pad.bottom)
				}
	);
	const scale = $derived(Math.min(inner.width / shown.width, inner.height / shown.height));
	const vp: Viewport = $derived({
		scale,
		offsetX: inner.x + (inner.width - shown.width * scale) / 2 - shown.x * scale,
		offsetY: inner.y + inner.height - (inner.height - shown.height * scale) / 2 + shown.y * scale,
		depth
	});
	const at = (p: Point) => worldToScreen(p, vp);

	const bay = $derived.by(() => {
		const top = at({ x: 0, y: canvas.depthFt });
		const bottom = at({ x: 0, y: 0 }).y;
		return { x: top.x, y: top.y, width: canvas.widthFt * scale, height: bottom - top.y };
	});

	/**
	 * The plan's grid choice: off; a light grid every 5 yd (or 10 ft), coarser when it would be
	 * denser than 10 px; or guide lines every N ft, darker, with distance labels on the left.
	 */
	const choice = $derived(gridChoice(doc.display));
	const guides = $derived(typeof choice === 'number' ? choice : null);
	const grid = $derived.by(() => {
		const xs: number[] = [];
		const ys: { y: number; sy: number }[] = [];
		if (choice === 'off') return { xs, ys };
		let step = guides ?? (unit === 'yd' ? 15 : 10);
		if (guides === null) while (step * scale < 10) step *= 2;
		for (let x = step; x < canvas.widthFt - 1e-9; x += step) xs.push(at({ x, y: 0 }).x);
		for (let y = step; y < canvas.depthFt - 1e-9; y += step) {
			if (!depth || y < depth.fromFt) ys.push({ y, sy: at({ x: 0, y }).y });
		}
		return { xs, ys };
	});

	const strip = $derived(
		depth ? { top: bay.y, bottom: at({ x: 0, y: depth.fromFt }).y, map: depth } : null
	);
	const ticks = $derived.by(() => {
		if (!strip || bare) return [];
		const { fromFt, toFt, drawnFt } = strip.map;
		const pxPerFt = (scale * drawnFt) / (toFt - fromFt);
		const step = [5, 10, 25, 50, 100, 250, 500, 1000].find((v) => toFeet(v, unit) * pxPerFt >= 18);
		if (!step) return [];
		const stepFt = toFeet(step, unit);
		const out: { label: string; y: number }[] = [];
		for (let ft = Math.floor(fromFt / stepFt + 1) * stepFt; ft <= toFt + 1e-9; ft += stepFt) {
			out.push({
				label: `${formatNumber(ft / toFeet(1, unit))} ${unit}`,
				y: at({ x: 0, y: ft }).y
			});
		}
		return out;
	});

	function tear(y: number): string {
		let d = `M${bay.x - 6} ${y}`;
		for (let x = bay.x + 2, up = true; x <= bay.x + bay.width + 6; x += 8, up = !up) {
			d += ` L${x} ${y + (up ? -3 : 3)}`;
		}
		return d;
	}

	const objects = $derived([...doc.objects].sort((a, b) => a.z - b.z));
	const FADED = 0.25;
	const marked = $derived(new Set(step?.marks.map((m) => m.objectId) ?? []));
	/** Whether the step singles anything out; a step that doesn't leaves the drawing as it is. */
	const focused = $derived(step !== null && (step.marks.length > 0 || step.arrows.length > 0));
	/** Opacity of an object or arrow in the step: full when it is part of it. */
	const fade = (inStep: boolean) => (focused && !inStep ? FADED : undefined);
	/** Copies drawn behind the front glyph when one object stands for several targets. */
	function cluster(obj: PlanObject, box: { width: number; height: number }) {
		const count = obj.count ?? 1;
		return count > 1
			? Array.from({ length: Math.min(count - 1, 2) }, (_, i) => {
					const k = 2 - i;
					return { k, dx: k * box.width * 0.25, dy: -k * box.height * 0.12 };
				})
			: [];
	}

	type Link = { a: LinkAnnotation; p: Point; q: Point; u: Point; n: Point; len: number };
	const links = $derived(
		doc.annotations
			.filter((a): a is LinkAnnotation => a.type !== 'text')
			.flatMap((a) => {
				const from = resolveAnchor(doc, a.from);
				const to = resolveAnchor(doc, a.to);
				if (!from || !to) return [];
				const p = at(from);
				const q = at(to);
				const len = Math.hypot(q.x - p.x, q.y - p.y);
				const u = len > 0 ? { x: (q.x - p.x) / len, y: (q.y - p.y) / len } : { x: 1, y: 0 };
				return [{ a, p, q, u, n: { x: -u.y, y: u.x }, len } satisfies Link];
			})
	);
	const texts = $derived(doc.annotations.filter((a) => a.type === 'text'));

	const bar = $derived(scaleBar(scale, unit, 110));
	const tileRects = $derived(
		tiles.map((t) => ({
			x: vp.offsetX + t.x * scale,
			y: vp.offsetY - (t.y + t.height) * scale,
			width: t.width * scale,
			height: t.height * scale
		}))
	);
</script>

{#snippet label(text: string, x: number, y: number, px: number, anchor = 'middle')}
	<text
		{x}
		{y}
		font-family={FONT}
		font-size={px}
		font-weight="bold"
		text-anchor={anchor}
		fill="#fff"
		stroke="#fff"
		stroke-width="3"
		stroke-linejoin="round"
	>
		{text}
	</text>
	<text
		{x}
		{y}
		font-family={FONT}
		font-size={px}
		font-weight="bold"
		text-anchor={anchor}
		fill={INK}
	>
		{text}
	</text>
{/snippet}

<defs>
	<clipPath id="{uid}-clip">
		<rect x={area.x} y={area.y} width={area.width} height={area.height} />
	</clipPath>
</defs>
<g clip-path="url(#{uid}-clip)">
	<rect x={bay.x} y={bay.y} width={bay.width} height={bay.height} fill="#fff" stroke="none" />
	<g stroke={guides ? '#9ca3af' : '#d9d9d6'} stroke-width={guides ? 1 : 0.6}>
		{#each grid.xs as x (x)}
			<line x1={x} x2={x} y1={bay.y} y2={bay.y + bay.height} />
		{/each}
		{#each grid.ys as g (g.y)}
			<line x1={bay.x} x2={bay.x + bay.width} y1={g.sy} y2={g.sy} />
		{/each}
	</g>
	{#if guides && !bare}
		{#each grid.ys as g (g.y)}
			<text
				x={bay.x - 6}
				y={g.sy + 3}
				font-family={FONT}
				font-size="8"
				font-weight="bold"
				text-anchor="end"
				fill="#555"
			>
				{formatLength(g.y, unit)}
			</text>
		{/each}
	{/if}
	{#if strip}
		<g data-print-strip>
			<rect
				x={bay.x}
				y={strip.top}
				width={bay.width}
				height={strip.bottom - strip.top}
				fill={STRIP_FILL}
			/>
			<path d={tear(strip.bottom)} fill="none" stroke={INK} stroke-width="1.5" />
			{#if !bare}
				{@render label(
					`Not to scale beyond ${formatLength(strip.map.fromFt, unit)}`,
					bay.x + bay.width - 6,
					strip.bottom - 8,
					10,
					'end'
				)}
			{/if}
			{#each ticks as t (t.label)}
				<line x1={bay.x - 5} x2={bay.x} y1={t.y} y2={t.y} stroke={INK} stroke-width="1" />
				<text
					x={bay.x - 7}
					y={t.y + 3}
					font-family={FONT}
					font-size="8"
					text-anchor="end"
					fill="#555"
				>
					{t.label}
				</text>
			{/each}
		</g>
	{/if}
	<rect
		x={bay.x}
		y={bay.y}
		width={bay.width}
		height={bay.height}
		fill="none"
		stroke={INK}
		stroke-width="1.5"
	/>

	{#each links as l (l.a.id)}
		{#if l.a.type === 'arrow'}
			{@const stop = Math.max(0, l.len - 10)}
			{@const shown = step?.arrows.includes(l.a.id) ?? false}
			<g opacity={fade(shown)} data-print-arrow={l.a.id}>
				<line
					x1={l.p.x}
					y1={l.p.y}
					x2={l.p.x + l.u.x * stop}
					y2={l.p.y + l.u.y * stop}
					stroke={INK}
					stroke-width={shown ? 3 : 1.8}
					stroke-dasharray="6 4"
				/>
				<path
					d="M{l.q.x} {l.q.y} L{l.q.x - l.u.x * 11 + l.n.x * 5} {l.q.y - l.u.y * 11 + l.n.y * 5} L{l
						.q.x -
						l.u.x * 11 -
						l.n.x * 5} {l.q.y - l.u.y * 11 - l.n.y * 5} Z"
					fill={INK}
				/>
			</g>
		{:else}
			{@const ft = measureFt(doc, l.a)}
			<line x1={l.p.x} y1={l.p.y} x2={l.q.x} y2={l.q.y} stroke={INK} stroke-width="1.2" />
			<path
				d="M{l.p.x + l.n.x * 4} {l.p.y + l.n.y * 4} L{l.p.x - l.n.x * 4} {l.p.y - l.n.y * 4} M{l.q
					.x +
					l.n.x * 4} {l.q.y + l.n.y * 4} L{l.q.x - l.n.x * 4} {l.q.y - l.n.y * 4}"
				stroke={INK}
				stroke-width="1.2"
			/>
			{#if ft !== null && !bare}
				{@render label(formatLength(ft, unit), (l.p.x + l.q.x) / 2, (l.p.y + l.q.y) / 2 + 3, 10)}
			{/if}
		{/if}
	{/each}

	{#each objects as obj (obj.id)}
		{@const entry = getEntry(obj.symbolId)}
		{@const pos = at(obj)}
		{@const box = localBox(obj, entry, scale, symbolPx)}
		{@const bounds = rotatedBounds(box, obj.rotation)}
		<g
			data-print-object={obj.symbolId}
			transform="translate({pos.x} {pos.y})"
			opacity={fade(marked.has(obj.id))}
		>
			<g transform="rotate({obj.rotation})">
				{#if entry?.kind === 'footprint'}
					{#each footprintShapes(entry.footprint.style, box.width, box.height) as s, i (i)}
						<svelte:element this={s.el} {...s.attrs} {...paintAttrs(s.paint, INK, true)} />
					{/each}
				{:else if entry?.kind === 'symbol'}
					{@const m = markupFor(entry.id, entry.svg, INK)}
					{#each cluster(obj, box) as c (c.k)}
						<g
							transform="translate({box.x + c.dx} {box.y + c.dy}) scale({box.width / 100})"
							opacity="0.55"
							{...m.rootAttrs}
						>
							<!-- Catalog SVG is bundled with the app, never user input. -->
							<!-- eslint-disable-next-line svelte/no-at-html-tags -->
							{@html m.inner}
						</g>
					{/each}
					<g transform="translate({box.x} {box.y}) scale({box.width / 100})" {...m.rootAttrs}>
						<!-- eslint-disable-next-line svelte/no-at-html-tags -->
						{@html m.inner}
					</g>
				{/if}
			</g>
			{#if !bare}
				{#if (obj.count ?? 1) > 1}
					<g transform="translate({bounds.x + bounds.width} {bounds.y})">
						<rect x="-11" y="-7" width="22" height="14" rx="7" fill={INK} />
						<text
							x="0"
							y="3.5"
							font-family={FONT}
							font-size="9"
							font-weight="bold"
							text-anchor="middle"
							fill="#fff"
						>
							×{obj.count}
						</text>
					</g>
				{/if}
				{#if obj.label}
					{@render label(obj.label, 0, bounds.y + bounds.height + 11, 10)}
				{/if}
				{#if depth && obj.y > depth.fromFt}
					{@render label(
						formatLength(obj.y, unit),
						bounds.x + bounds.width + 4,
						bounds.y + bounds.height / 2 + 3,
						10,
						'start'
					)}
				{/if}
			{/if}
		</g>
	{/each}

	{#if step}
		<StepHighlights {doc} {step} viewport={vp} {symbolPx} />
	{/if}

	{#if !bare}
		{#each texts as t (t.id)}
			{@const p = at(t)}
			{@render label(t.text, p.x, p.y + 4, 11)}
		{/each}
	{/if}

	{#each tileRects as r, i (i)}
		<rect
			x={r.x}
			y={r.y}
			width={r.width}
			height={r.height}
			fill="none"
			stroke="#b42318"
			stroke-width="1.2"
			stroke-dasharray="5 3"
		/>
		{@render label(String(i + 1), r.x + 10, r.y + 16, 12)}
	{/each}
</g>

{#if !bare}
	{#if !view}
		{@const ax = bay.x + bay.width / 2}
		<g>
			<line x1={ax} x2={ax} y1={area.y + 28} y2={area.y + 10} stroke="#555" stroke-width="1.5" />
			<path
				d="M{ax - 5} {area.y + 16} L{ax} {area.y + 8} L{ax + 5} {area.y + 16}"
				fill="none"
				stroke="#555"
				stroke-width="1.5"
			/>
			<text x={ax + 9} y={area.y + 22} font-family={FONT} font-size="9" fill="#555">Downrange</text>
		</g>
		<g data-print-scalebar transform="translate({area.x + 6} {area.y + area.height - 10})">
			<rect x="-4" y="-18" width={bar.px + (depth ? 130 : 30)} height="24" fill="#fff" />
			<path d="M0 0H{bar.px}M0 -5V0M{bar.px} -5V0" fill="none" stroke={INK} stroke-width="1.5" />
			<text x="0" y="-8" font-family={FONT} font-size="9" fill={INK}>
				{bar.label}{depth ? ' · outside the strip' : ''}
			</text>
		</g>
	{/if}
{/if}
