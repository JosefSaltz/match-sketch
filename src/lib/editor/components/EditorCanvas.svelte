<script lang="ts">
	import type { Attachment } from 'svelte/attachments';
	import type { Point } from '#lib/geometry/types.js';
	import type { EditorState } from '../editor-state.svelte.js';
	import { movedBeyond, PointerGestures } from '../gestures.js';
	import BayLayer from './BayLayer.svelte';
	import ObjectView from './ObjectView.svelte';
	import ScaleBar from './ScaleBar.svelte';
	import SelectionOverlay from './SelectionOverlay.svelte';

	let { editor }: { editor: EditorState } = $props();

	const gestures = new PointerGestures();
	/** Drawn back to front. */
	const objects = $derived([...editor.doc.objects].sort((a, b) => a.z - b.z));
	/** A single pointer pressed while a symbol is armed; placing happens if it lifts in place. */
	let tap: { pointerId: number; start: Point } | null = null;
	/** The pointer dragging the selection, if any. */
	let moving: number | null = null;
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
		if (moving !== null) return; // Extra pointers are ignored while dragging the selection.
		// Commit a field being edited before the selection changes under it.
		(document.activeElement as HTMLElement | null)?.blur();
		const p = local(e);
		capture(e);
		const armed = editor.armedSymbolId;
		const hit = armed ? null : (e.target as Element).closest('[data-object-id]');
		if (hit) {
			// Pressing an object selects it (Shift toggles) and starts moving the selection.
			const id = hit.getAttribute('data-object-id')!;
			narrowTo = null;
			if (e.shiftKey) editor.select([id], 'toggle');
			else if (!editor.selection.includes(id)) editor.select([id]);
			else if (editor.selection.length > 1) narrowTo = id;
			if (editor.selection.includes(id)) {
				moving = e.pointerId;
				editor.beginMove(id, p);
			}
			return;
		}
		gestures.down(e.pointerId, p);
		tap = armed && gestures.active === 1 ? { pointerId: e.pointerId, start: p } : null;
		// Pressing empty space clears the selection, then pans.
		if (!armed && gestures.active === 1 && !e.shiftKey) editor.clearSelection();
	}

	function onMove(e: PointerEvent) {
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
		if (moving === e.pointerId) {
			const moved = editor.preview !== null;
			moving = null;
			editor.endMove();
			if (!moved && narrowTo) editor.select([narrowTo]);
			narrowTo = null;
			return;
		}
		const armed = editor.armedSymbolId;
		if (armed && tap?.pointerId === e.pointerId && !movedBeyond(tap.start, local(e))) {
			editor.placeAt(armed, local(e));
		}
		onCancel(e);
	}

	function onCancel(e: PointerEvent) {
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
		class={{ armed: editor.armedSymbolId !== null }}
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
		<g class="objects">
			{#each objects as obj (obj.id)}
				<ObjectView {editor} {obj} />
			{/each}
		</g>
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
