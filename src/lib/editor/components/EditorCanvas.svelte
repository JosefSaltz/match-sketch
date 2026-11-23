<script lang="ts">
	import type { Attachment } from 'svelte/attachments';
	import type { Corner } from '#lib/geometry/transform.js';
	import type { Point } from '#lib/geometry/types.js';
	import type { EditorState } from '../editor-state.svelte.js';
	import { movedBeyond, PointerGestures, TAP_SLOP_PX } from '../gestures.js';
	import AnnotationLayer from './AnnotationLayer.svelte';
	import BayLayer from './BayLayer.svelte';
	import ObjectView from './ObjectView.svelte';
	import ScaleBar from './ScaleBar.svelte';
	import SelectionOverlay from './SelectionOverlay.svelte';
	import { SYMBOL_PX } from '#lib/model/plan.js';
	import StepHighlights from '#lib/walkthrough/StepHighlights.svelte';

	let { editor }: { editor: EditorState } = $props();

	const gestures = new PointerGestures();
	const TOUCH_SLOP_PX = 8;
	/** Drawn back to front. */
	const objects = $derived([...editor.doc.objects].sort((a, b) => a.z - b.z));
	/** A single pointer pressed while a symbol is armed; placing happens if it lifts in place. */
	let tap: { pointerId: number; start: Point } | null = null;
	/** The pointer dragging the selection, if any. */
	let moving: number | null = null;
	/** The pointer dragging a resize or rotate handle, if any. */
	let handling: number | null = null;
	/** The pointer drawing a line or dragging a line's end, if any, and where it last was. */
	let linking: number | null = null;
	let linkAt: Point = { x: 0, y: 0 };
	/** A press on one object of a multi-selection: a tap (no move) narrows the selection to it. */
	let narrowTo: string | null = null;

	function local(e: {
		clientX: number;
		clientY: number;
		currentTarget: EventTarget | null;
	}): Point {
		const target = e.currentTarget as Element;
		const svg = target instanceof SVGSVGElement ? target : (target as SVGElement).ownerSVGElement!;
		const r = svg.getBoundingClientRect();
		return { x: e.clientX - r.left, y: e.clientY - r.top };
	}

	/**
	 * The object under a pointer. Pointer capture and the dragged handle sit on top of it, so look
	 * through everything at that point rather than at the event target.
	 */
	function objectIdAt(e: { clientX: number; clientY: number }): string | null {
		for (const el of document.elementsFromPoint(e.clientX, e.clientY)) {
			const id = el.closest('[data-object-id]')?.getAttribute('data-object-id');
			if (id) return id;
		}
		return null;
	}

	/** Wheel zoom needs a non-passive listener so the page doesn't scroll. */
	const wheelZoom: Attachment<SVGSVGElement> = (svg) => {
		const onWheel = (e: WheelEvent) => {
			e.preventDefault();
			editor.zoomBy(Math.exp(-e.deltaY * 0.0015), local(e));
		};
		svg.addEventListener('wheel', onWheel, { passive: false });
		return () => svg.removeEventListener('wheel', onWheel);
	};

	function capture(e: PointerEvent) {
		try {
			(e.currentTarget as Element).setPointerCapture(e.pointerId);
		} catch {
			// Synthetic events can carry pointer ids the browser doesn't know.
		}
	}

	function onDown(e: PointerEvent) {
		if (e.pointerType === 'mouse' && e.button !== 0) return;
		if (linking !== null) {
			// A second finger while drawing a line means a pinch: drop the line and zoom instead.
			if (e.pointerType !== 'touch') return;
			editor.cancelLink();
			gestures.down(linking, linkAt);
			linking = null;
			gestures.down(e.pointerId, local(e));
			capture(e);
			tap = null;
			return;
		}
		// Extra pointers are ignored while dragging the selection or a handle.
		if (moving !== null || handling !== null) return;
		// Commit a field being edited before the selection changes under it.
		(document.activeElement as HTMLElement | null)?.blur();
		const p = local(e);
		capture(e);
		// A second finger joins the gesture in progress (pan becomes pinch) instead of grabbing
		// whatever it lands on.
		if (gestures.active > 0) {
			gestures.down(e.pointerId, p);
			tap = null;
			return;
		}
		// The arrow and measure tools draw a line from the press to the release.
		if (editor.tool === 'arrow' || editor.tool === 'measure') {
			linking = e.pointerId;
			linkAt = p;
			editor.beginLink(p, objectIdAt(e));
			return;
		}
		const lineEnd = (e.target as Element).closest('[data-annotation-handle]');
		if (lineEnd) {
			linking = e.pointerId;
			linkAt = p;
			editor.beginEndpoint(
				lineEnd.getAttribute('data-link-id')!,
				lineEnd.getAttribute('data-annotation-handle') as 'from' | 'to'
			);
			return;
		}
		// Placing: an armed symbol, or the text tool, puts something down on a tap.
		const armed = editor.armedSymbolId !== null || editor.tool === 'text';
		const handle = armed ? null : (e.target as Element).closest('[data-handle]');
		const selected = editor.selection.length === 1 ? editor.selection[0] : null;
		if (handle && selected) {
			const kind = handle.getAttribute('data-handle')!;
			handling = e.pointerId;
			if (kind === 'rotate') editor.beginRotate(selected);
			else editor.beginResize(selected, kind as Corner, p);
			return;
		}
		const hit = armed
			? null
			: (e.target as Element).closest('[data-object-id], [data-annotation-id]');
		if (hit) {
			// Pressing an object or annotation selects it (Shift toggles) and starts moving the selection.
			const id = (hit.getAttribute('data-object-id') ?? hit.getAttribute('data-annotation-id'))!;
			narrowTo = null;
			if (e.shiftKey) editor.select([id], 'toggle');
			else if (!editor.selection.includes(id)) editor.select([id]);
			else if (editor.selection.length > 1) narrowTo = id;
			if (editor.selection.includes(id)) {
				moving = e.pointerId;
				// Fingers wobble more than a mouse during a tap.
				editor.beginMove(id, p, e.pointerType === 'mouse' ? TAP_SLOP_PX : TOUCH_SLOP_PX);
			}
			return;
		}
		gestures.down(e.pointerId, p);
		tap = armed && gestures.active === 1 ? { pointerId: e.pointerId, start: p } : null;
		// Pressing empty space clears the selection, then pans.
		if (!armed && gestures.active === 1 && !e.shiftKey) editor.clearSelection();
	}

	function onMove(e: PointerEvent) {
		if (linking === e.pointerId) {
			linkAt = local(e);
			editor.updateLink(linkAt, objectIdAt(e));
			return;
		}
		if (handling === e.pointerId) {
			editor.updateHandle(local(e), { shiftKey: e.shiftKey });
			return;
		}
		if (moving === e.pointerId) {
			editor.updateMove(local(e));
			return;
		}
		const action = gestures.move(e.pointerId, local(e));
		if (!action) return;
		if (action.kind === 'pinch') editor.zoomBy(action.factor, action.at);
		editor.panBy(action.dx, action.dy);
	}

	function onUp(e: PointerEvent) {
		if (linking === e.pointerId) {
			linking = null;
			editor.endLink();
			return;
		}
		if (handling === e.pointerId) {
			handling = null;
			editor.endHandle();
			return;
		}
		if (moving === e.pointerId) {
			const moved = editor.preview !== null;
			moving = null;
			editor.endMove();
			if (!moved && narrowTo) editor.select([narrowTo]);
			narrowTo = null;
			return;
		}
		const armed = editor.armedSymbolId;
		if (tap?.pointerId === e.pointerId && !movedBeyond(tap.start, local(e))) {
			if (armed) editor.placeAt(armed, local(e));
			else if (editor.tool === 'text') editor.placeText(local(e));
		}
		onCancel(e);
	}

	function onCancel(e: PointerEvent) {
		if (linking === e.pointerId) {
			linking = null;
			editor.cancelLink();
		}
		if (handling === e.pointerId) {
			handling = null;
			editor.cancelHandle();
		}
		if (moving === e.pointerId) {
			moving = null;
			narrowTo = null;
			editor.cancelMove();
		}
		if (tap?.pointerId === e.pointerId) tap = null;
		gestures.up(e.pointerId);
	}
</script>

<div class="stage" bind:clientWidth={editor.screenWidth} bind:clientHeight={editor.screenHeight}>
	<svg
		{@attach wheelZoom}
		class={{ armed: editor.armedSymbolId !== null || editor.tool !== null }}
		data-stage
		width={editor.screenWidth}
		height={editor.screenHeight}
		role="application"
		aria-label="Stage canvas"
		onpointerdown={onDown}
		onpointermove={onMove}
		onpointerup={onUp}
		onpointercancel={onCancel}
	>
		<rect class="background" x="0" y="0" width={editor.screenWidth} height={editor.screenHeight} />
		<BayLayer {editor} />
		<AnnotationLayer {editor} layer="below" />
		<g class="objects">
			{#each objects as obj (obj.id)}
				<ObjectView {editor} {obj} />
			{/each}
		</g>
		<AnnotationLayer {editor} layer="above" />
		{#if editor.panel === 'walkthrough' && editor.activeStep}
			<StepHighlights
				doc={editor.doc}
				step={editor.activeStep}
				viewport={editor.viewport}
				symbolPx={SYMBOL_PX[editor.doc.display.symbolSize]}
				arrows
			/>
		{/if}
		<SelectionOverlay {editor} />
		<ScaleBar {editor} />
	</svg>
</div>

<style>
	.stage {
		position: relative;
		width: 100%;
		height: 100%;
		overflow: hidden;
		background: var(--color-surface);
	}
	svg {
		display: block;
		touch-action: none;
		user-select: none;
	}
	.background {
		fill: transparent;
		cursor: grab;
	}
	.armed,
	.armed .background {
		cursor: crosshair;
	}
</style>
