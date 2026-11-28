<script lang="ts">
	import type { Attachment } from 'svelte/attachments';
	import type { Corner } from '#lib/geometry/transform.js';
	import type { Point } from '#lib/geometry/types.js';
	import type { EditorState } from '../editor-state.svelte.js';
	import {
		movedBeyond,
		offStage,
		overRemoveBin,
		PointerGestures,
		REMOVE_BIN,
		TAP_SLOP_PX
	} from '../gestures.js';
	import AnnotationLayer from './AnnotationLayer.svelte';
	import BayLayer from './BayLayer.svelte';
	import DangerZoneLayer from './DangerZoneLayer.svelte';
	import DangerZoneLegend from './DangerZoneLegend.svelte';
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
	/** Something is being dragged (objects, or the view when panning): the closed hand shows. */
	let grabbing = $state(false);
	/** Objects are being dragged (not the view, not a handle): the remove bin shows. */
	let carrying = $state(false);
	/** Where the pointer is (page px) while a drag is off the stage, for the "Release to remove" tag. */
	let offAt = $state({ x: 0, y: 0 });
	/** A red trash can, outlined in white so it reads on any background. */
	const REMOVE_CURSOR = `url("data:image/svg+xml,${encodeURIComponent(
		"<svg xmlns='http://www.w3.org/2000/svg' width='28' height='28' viewBox='0 0 24 24'><g fill='none' stroke-linecap='round' stroke-linejoin='round'><path d='M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6' stroke='white' stroke-width='4.5'/><path d='M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6' stroke='#b91c1c' stroke-width='2.2'/></g></svg>"
	)}") 14 14`;
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
			const p = local(e);
			editor.updateMove(p);
			grabbing = editor.preview !== null;
			carrying = grabbing;
			// Pulled off the stage or onto the bin: releasing removes it, so say so before the release.
			editor.dragOff = carrying && (offStage(p, editor.screen) || overRemoveBin(p, editor.screen));
			offAt = { x: e.clientX, y: e.clientY };
			return;
		}
		const action = gestures.move(e.pointerId, local(e));
		if (!action) return;
		grabbing = editor.armedSymbolId === null && editor.tool === null;
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
			grabbing = false;
			carrying = false;
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
			carrying = false;
			editor.cancelMove();
		}
		if (tap?.pointerId === e.pointerId) tap = null;
		gestures.up(e.pointerId);
		if (moving === null && gestures.active === 0) grabbing = false;
	}
</script>

<div class="stage" bind:clientWidth={editor.screenWidth} bind:clientHeight={editor.screenHeight}>
	<svg
		{@attach wheelZoom}
		class={{
			armed: editor.armedSymbolId !== null || editor.tool !== null,
			grabbing,
			removing: editor.dragOff
		}}
		style:--remove-cursor={REMOVE_CURSOR}
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
		<DangerZoneLayer {editor} />
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
	<!-- The drop target for removing: a phone's stage fills the screen, so it has no "off". -->
	<div
		class={['remove-bin', { shown: carrying, hot: editor.dragOff }]}
		style:width="{REMOVE_BIN.radius * 2}px"
		style:height="{REMOVE_BIN.radius * 2}px"
		style:bottom="{REMOVE_BIN.bottom - REMOVE_BIN.radius}px"
		data-testid="remove-bin"
		aria-hidden="true"
	>
		<svg viewBox="0 0 24 24" width="28" height="28">
			<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" />
		</svg>
	</div>
	<DangerZoneLegend {editor} />
</div>
{#if editor.dragOff}
	<div
		data-testid="remove-hint"
		class="remove-hint"
		role="status"
		style:left="{offAt.x + 18}px"
		style:top="{offAt.y + 18}px"
	>
		Release to remove
	</div>
{/if}

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
	/* While dragging, the closed hand wins over every hover cursor underneath. */
	.grabbing,
	.grabbing :global(*) {
		cursor: grabbing !important;
	}
	/* Off the stage, the trash can replaces the hand: releasing now removes what is dragged. */
	.removing,
	.removing :global(*) {
		cursor: var(--remove-cursor), no-drop !important;
	}
	.remove-bin {
		position: absolute;
		left: 50%;
		display: grid;
		place-items: center;
		border: 3px solid var(--color-danger);
		border-radius: 9999px;
		background: #fff;
		color: var(--color-danger);
		box-shadow: 3px 3px 0 #000;
		pointer-events: none;
		opacity: 0;
		translate: -50% 1rem;
		scale: 0.8;
		transition:
			opacity 150ms ease-out,
			translate 150ms ease-out,
			scale 150ms ease-out,
			background-color 100ms,
			color 100ms;
	}
	.remove-bin svg {
		fill: none;
		stroke: currentColor;
		stroke-width: 2.2;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.remove-bin.shown {
		opacity: 1;
		translate: -50% 0;
		scale: 1;
	}
	/* Releasing now removes what is dragged. */
	.remove-bin.hot {
		background: var(--color-danger);
		color: #fff;
		scale: 1.15;
	}
	@media (prefers-reduced-motion: reduce) {
		.remove-bin {
			transition: none;
		}
	}
	.remove-hint {
		position: fixed;
		z-index: 50;
		pointer-events: none;
		padding: 2px 8px;
		border: 2px solid var(--color-danger);
		border-radius: 6px;
		background: #fff;
		color: var(--color-danger);
		font-size: 0.8125rem;
		font-weight: 700;
		white-space: nowrap;
	}
</style>
