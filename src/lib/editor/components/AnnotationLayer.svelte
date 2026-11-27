<script lang="ts">
	import type { Point } from '#lib/geometry/types.js';
	import { formatLength } from '#lib/geometry/units.js';
	import { worldToScreen } from '#lib/geometry/viewport.js';
	import type { LinkAnnotation } from '#lib/model/plan.js';
	import { measureFt, resolveAnchor } from '../annotations.js';
	import type { EditorState } from '../editor-state.svelte.js';

	/**
	 * `below` draws arrows and measure lines under the objects. `above` draws the lines' hit
	 * areas (trimmed back from ends attached to objects, so a press on an object still reaches
	 * it), text labels, and the end handles of a selected line. Hit areas sit above the objects so
	 * a line stays clickable where it crosses a shooting box or other area.
	 */
	let { editor, layer }: { editor: EditorState; layer: 'below' | 'above' } = $props();

	const HEAD_PX = 12;
	const HEAD_HALF_PX = 6;
	const TICK_HALF_PX = 4;
	/** Touch target radius, as for resize handles. */
	const HIT_R = 13;
	/** A line's hit area stops this far short of an end attached to an object. */
	const TRIM_PX = 16;

	type DrawnLink = { a: LinkAnnotation; p: Point; q: Point; u: Point; n: Point; len: number };

	/** A line's screen ends plus its unit direction `u` and normal `n`; skipped if an end is lost. */
	function drawn(a: LinkAnnotation): DrawnLink | null {
		const from = resolveAnchor(editor.doc, a.from);
		const to = resolveAnchor(editor.doc, a.to);
		if (!from || !to) return null;
		const p = worldToScreen(from, editor.viewport);
		const q = worldToScreen(to, editor.viewport);
		const len = Math.hypot(q.x - p.x, q.y - p.y);
		const u = len > 0 ? { x: (q.x - p.x) / len, y: (q.y - p.y) / len } : { x: 1, y: 0 };
		return { a, p, q, u, n: { x: -u.y, y: u.x }, len };
	}

	const links = $derived(
		editor.doc.annotations
			.filter((a): a is LinkAnnotation => a.type !== 'text')
			.map(drawn)
			.filter((d): d is DrawnLink => d !== null)
	);

	/** End handles show for a single selected line. */
	const handled = $derived.by(() => {
		if (editor.selection.length !== 1) return null;
		return links.find((d) => d.a.id === editor.selection[0]) ?? null;
	});

	const handleEnds = $derived(
		handled
			? [
					{ end: 'from', at: handled.p },
					{ end: 'to', at: handled.q }
				]
			: []
	);

	/** The clickable part of a line: shortened at ends attached to objects. */
	function hitSpan(d: DrawnLink): { a: Point; b: Point } | null {
		const cutA = d.a.from.kind === 'object' ? TRIM_PX : 0;
		const cutB = d.a.to.kind === 'object' ? TRIM_PX : 0;
		if (d.len <= cutA + cutB) return null;
		return {
			a: { x: d.p.x + d.u.x * cutA, y: d.p.y + d.u.y * cutA },
			b: { x: d.q.x - d.u.x * cutB, y: d.q.y - d.u.y * cutB }
		};
	}

	function head(d: DrawnLink): string {
		const b = { x: d.q.x - d.u.x * HEAD_PX, y: d.q.y - d.u.y * HEAD_PX };
		const l = { x: b.x + d.n.x * HEAD_HALF_PX, y: b.y + d.n.y * HEAD_HALF_PX };
		const r = { x: b.x - d.n.x * HEAD_HALF_PX, y: b.y - d.n.y * HEAD_HALF_PX };
		return `M${d.q.x} ${d.q.y} L${l.x} ${l.y} L${r.x} ${r.y} Z`;
	}

	function tick(at: Point, n: Point): string {
		return `M${at.x + n.x * TICK_HALF_PX} ${at.y + n.y * TICK_HALF_PX} L${at.x - n.x * TICK_HALF_PX} ${at.y - n.y * TICK_HALF_PX}`;
	}

	const lengthText = (a: LinkAnnotation) => {
		const ft = measureFt(editor.doc, a);
		return ft === null ? '' : formatLength(ft, editor.plan.unit);
	};
</script>

{#if layer === 'below'}
	<g class="links">
		{#each links as d (d.a.id)}
			{@const selected = editor.selection.includes(d.a.id)}
			<g
				data-testid="annotation"
				data-annotation-id={d.a.id}
				data-annotation-type={d.a.type}
				class={['annotation', d.a.type, { selected }]}
			>
				{#if d.a.type === 'arrow'}
					{@const stop = Math.max(0, d.len - HEAD_PX + 2)}
					<line
						class="arrow-line"
						x1={d.p.x}
						y1={d.p.y}
						x2={d.p.x + d.u.x * stop}
						y2={d.p.y + d.u.y * stop}
					/>
					<path class="arrow-head" d={head(d)} />
				{:else}
					<line class="measure-line" x1={d.p.x} y1={d.p.y} x2={d.q.x} y2={d.q.y} />
					<path class="measure-line" d="{tick(d.p, d.n)} {tick(d.q, d.n)}" />
					<text
						data-testid="measure-label"
						class="measure-label"
						x={(d.p.x + d.q.x) / 2}
						y={(d.p.y + d.q.y) / 2}
						dy="0.35em"
					>
						{lengthText(d.a)}
					</text>
				{/if}
			</g>
		{/each}
	</g>
{:else}
	<g class="labels">
		{#each links as d (d.a.id)}
			{@const span = hitSpan(d)}
			{#if span}
				<g class="annotation" data-annotation-id={d.a.id}>
					<line
						data-testid="link-hit"
						class="hit"
						x1={span.a.x}
						y1={span.a.y}
						x2={span.b.x}
						y2={span.b.y}
					/>
				</g>
			{/if}
		{/each}
		{#each editor.doc.annotations as a (a.id)}
			{#if a.type === 'text'}
				{@const at = worldToScreen(a, editor.viewport)}
				<g
					data-testid="annotation"
					data-annotation-id={a.id}
					data-annotation-type="text"
					class={['annotation', { selected: editor.selection.includes(a.id) }]}
					transform="translate({at.x} {at.y})"
				>
					<text data-testid="annotation-text" class="text" dy="0.35em">{a.text}</text>
				</g>
			{/if}
		{/each}
		{#each handleEnds as h (h.end)}
			<g
				class="handle"
				data-testid="annotation-handle-{h.end}"
				data-annotation-handle={h.end}
				data-link-id={handled?.a.id}
				transform="translate({h.at.x} {h.at.y})"
			>
				<circle class="handle-hit" r={HIT_R} />
				<circle class="dot" r="6" />
			</g>
		{/each}
	</g>
{/if}

<style>
	.annotation {
		cursor: grab;
		color: var(--color-text);
	}
	.annotation.selected {
		color: var(--color-selection);
	}
	.hit {
		stroke: transparent;
		stroke-width: 14;
		pointer-events: stroke;
	}
	.arrow-line,
	.measure-line {
		fill: none;
		stroke: currentColor;
		pointer-events: none;
	}
	.arrow-line {
		stroke-width: 2;
		stroke-dasharray: 6 4;
	}
	.arrow-head {
		fill: currentColor;
		pointer-events: none;
	}
	.measure-line {
		stroke-width: 1.5;
	}
	.measure-label {
		fill: currentColor;
		font-size: 12px;
		font-weight: 700;
		text-anchor: middle;
		paint-order: stroke;
		stroke: #fff;
		stroke-width: 4px;
		stroke-linejoin: round;
		pointer-events: none;
	}
	.text {
		fill: currentColor;
		font-size: 13px;
		font-weight: 600;
		text-anchor: middle;
		paint-order: stroke;
		stroke: #fff;
		stroke-width: 3px;
		stroke-linejoin: round;
	}
	.selected .text {
		text-decoration: underline dashed;
	}
	.handle {
		cursor: grab;
	}
	.handle-hit {
		fill: transparent;
	}
	.dot {
		fill: #fff;
		stroke: var(--color-selection);
		stroke-width: 2;
	}
</style>
