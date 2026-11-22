import { getEntry } from '../catalog/index';
import { snapPoint, snapStepFeet } from '../geometry/snap';
import type { CanvasSize, Point, Size } from '../geometry/types';
import {
	angleFromPointer,
	resizeFromCorner,
	rotateWorld,
	type Corner
} from '../geometry/transform';
import { fitViewport, screenToWorld, zoomAt, type Viewport } from '../geometry/viewport';
import { emptyPlanDocument, type PlanDisplay, type PlanDocument } from '../model/plan';
import type { PlanRecord } from '../store/records';
import { createHistory, type History } from './history';
import {
	addObject,
	deleteObjects,
	duplicateObjects,
	MIN_SIZE_FT,
	moveObjects,
	reorder,
	setObjectProps,
	type ObjectPatch
} from './ops';

export type NudgeDir = 'left' | 'right' | 'up' | 'down';

/** An in-progress drag of the selection, previewed until release. */
type MoveDrag = { ids: string[]; anchorId: string; startWorld: Point; base: PlanDocument };

/** An in-progress drag of a resize or rotate handle, previewed until release. */
type HandleDrag =
	| { kind: 'resize'; id: string; corner: Corner; grab: Point; base: PlanDocument }
	| { kind: 'rotate'; id: string; base: PlanDocument };

/** Rotation snaps to this many degrees unless Shift is held. */
export const ROTATE_SNAP_DEG = 15;

export type SaveStatus = 'saved' | 'saving' | 'error';
export type EditorDeps = { save: (doc: PlanDocument) => Promise<void> };

const FIT_PADDING_PX = 48;

/**
 * Editor state for one plan. Documents are immutable values held in `$state.raw` (no deep
 * proxies), so they can go straight into history and IndexedDB.
 */
export class EditorState {
	readonly plan: PlanRecord;
	#deps: EditorDeps;
	#history: History<PlanDocument>;

	#current = $state.raw<PlanDocument>(emptyPlanDocument());
	/** A temporary document shown while dragging; committed on release. */
	preview = $state.raw<PlanDocument | null>(null);
	doc = $derived(this.preview ?? this.#current);

	/** Size of the canvas element in px; bound directly by the canvas component. */
	screenWidth = $state(0);
	screenHeight = $state(0);
	screen: Size = $derived({ width: this.screenWidth, height: this.screenHeight });

	/** Set once the user zooms or pans; until then the view fits the bay (and refits on resize). */
	#manualViewport = $state.raw<Viewport | null>(null);
	viewport: Viewport = $derived(
		this.#manualViewport ?? fitViewport(this.canvas, this.screen, FIT_PADDING_PX)
	);

	selection = $state.raw<string[]>([]);
	/** The selected objects, in document order. */
	selectedObjects = $derived(this.doc.objects.filter((o) => this.selection.includes(o.id)));
	armedSymbolId = $state<string | null>(null);
	saveStatus = $state<SaveStatus>('saved');

	constructor(plan: PlanRecord, deps: EditorDeps) {
		this.plan = plan;
		this.#deps = deps;
		this.#history = createHistory(plan.document);
		this.#current = plan.document;
	}

	/** The plan's own copy of the bay dimensions. */
	get canvas(): CanvasSize {
		return { widthFt: this.plan.widthFt, depthFt: this.plan.depthFt };
	}

	commit(next: PlanDocument): void {
		// A change from elsewhere (e.g. a key press) ends any drag, so its release can't undo it.
		this.#move = null;
		this.#handle = null;
		this.#history.push(next);
		this.#current = next;
		this.preview = null;
		void this.#save(next);
	}

	setPreview(doc: PlanDocument | null): void {
		this.preview = doc;
	}

	/** Arms a palette symbol so the next tap on the stage places it; `null` disarms. */
	arm(symbolId: string | null): void {
		this.armedSymbolId = symbolId;
	}

	/**
	 * Places a new object at a screen point (snapped, clamped to the bay), commits it, selects
	 * it, and disarms. Returns the new object's id.
	 */
	placeAt(symbolId: string, screenPt: Point): string {
		const entry = getEntry(symbolId);
		if (!entry) throw new Error(`Unknown symbol: ${symbolId}`);
		const world = screenToWorld(screenPt, this.viewport);
		const { doc, id } = addObject(this.#current, entry, world, this.canvas, this.snapStep());
		this.commit(doc);
		this.selection = [id];
		this.armedSymbolId = null;
		return id;
	}

	async #save(doc: PlanDocument): Promise<void> {
		this.saveStatus = 'saving';
		try {
			await this.#deps.save(doc);
			this.saveStatus = 'saved';
		} catch {
			this.saveStatus = 'error';
		}
	}

	/** Back to fitting the whole bay; stays fitted through resizes until the next zoom or pan. */
	fit(): void {
		this.#manualViewport = null;
	}

	zoomBy(factor: number, at?: Point): void {
		const p = at ?? { x: this.screen.width / 2, y: this.screen.height / 2 };
		this.#manualViewport = zoomAt(this.viewport, p, factor);
	}

	panBy(dxPx: number, dyPx: number): void {
		const vp = this.viewport;
		this.#manualViewport = { ...vp, offsetX: vp.offsetX + dxPx, offsetY: vp.offsetY + dyPx };
	}

	snapStep(): number | null {
		return snapStepFeet(this.doc.display.snap);
	}

	select(ids: string[], mode: 'replace' | 'toggle' = 'replace'): void {
		if (mode === 'replace') {
			this.selection = [...ids];
			return;
		}
		const kept = this.selection.filter((id) => !ids.includes(id));
		const added = ids.filter((id) => !this.selection.includes(id));
		this.selection = [...kept, ...added];
	}

	clearSelection(): void {
		if (this.selection.length) this.selection = [];
	}

	deleteSelected(): void {
		if (!this.selection.length) return;
		this.commit(deleteObjects(this.#current, this.selection));
		this.selection = [];
	}

	/** Copies the selection one snap step (or 1 ft) right and toward the shooter, then selects the copies. */
	duplicateSelected(): void {
		if (!this.selection.length) return;
		const step = this.snapStep() ?? 1;
		const { doc, ids } = duplicateObjects(
			this.#current,
			this.selection,
			{ x: step, y: -step },
			this.canvas
		);
		this.commit(doc);
		this.selection = ids;
	}

	/** Moves the selection by one snap step (or 1 ft); "up" is downrange. */
	nudge(dir: NudgeDir): void {
		if (!this.selection.length) return;
		const s = this.snapStep() ?? 1;
		const delta = {
			left: { x: -s, y: 0 },
			right: { x: s, y: 0 },
			up: { x: 0, y: s },
			down: { x: 0, y: -s }
		}[dir];
		this.commit(moveObjects(this.#current, this.selection, delta, this.canvas));
	}

	setProps(id: string, patch: ObjectPatch): void {
		this.commit(setObjectProps(this.#current, id, patch, this.canvas));
	}

	bringToFront(id: string): void {
		this.commit(reorder(this.#current, id, 'front'));
	}

	sendToBack(id: string): void {
		this.commit(reorder(this.#current, id, 'back'));
	}

	setDisplay(patch: Partial<PlanDisplay>): void {
		const doc = this.#current;
		this.commit({ ...doc, display: { ...doc.display, ...patch } });
	}

	#move: MoveDrag | null = null;

	/** Starts dragging the current selection, grabbed by object `id` at a screen point. */
	beginMove(id: string, screenPt: Point): void {
		const ids = this.selection.includes(id) ? this.selection : [id];
		this.#move = {
			ids,
			anchorId: id,
			startWorld: screenToWorld(screenPt, this.viewport),
			base: this.#current
		};
	}

	/** Previews the move. With snap on, the grabbed object lands on the grid; the rest follow. */
	updateMove(screenPt: Point): void {
		const m = this.#move;
		if (!m) return;
		const anchor = m.base.objects.find((o) => o.id === m.anchorId);
		if (!anchor) return;
		const w = screenToWorld(screenPt, this.viewport);
		const target = snapPoint(
			{ x: anchor.x + w.x - m.startWorld.x, y: anchor.y + w.y - m.startWorld.y },
			this.snapStep()
		);
		const delta = { x: target.x - anchor.x, y: target.y - anchor.y };
		this.preview =
			delta.x === 0 && delta.y === 0 ? null : moveObjects(m.base, m.ids, delta, this.canvas);
	}

	#handle: HandleDrag | null = null;

	/**
	 * Starts resizing from a corner. `screenPt` is where the handle was grabbed; the corner then
	 * keeps that offset from the pointer instead of jumping to it.
	 */
	beginResize(id: string, corner: Corner, screenPt?: Point): void {
		const base = this.#current;
		let grab = { x: 0, y: 0 };
		const obj = base.objects.find((o) => o.id === id);
		const entry = obj && getEntry(obj.symbolId);
		if (obj && screenPt && entry?.kind === 'footprint') {
			const half = {
				x: ((obj.widthFt ?? entry.footprint.widthFt) / 2) * (corner.endsWith('e') ? 1 : -1),
				y: ((obj.depthFt ?? entry.footprint.depthFt) / 2) * (corner.startsWith('n') ? 1 : -1)
			};
			const off = rotateWorld(half, obj.rotation);
			const press = screenToWorld(screenPt, this.viewport);
			grab = { x: obj.x + off.x - press.x, y: obj.y + off.y - press.y };
		}
		this.#handle = { kind: 'resize', id, corner, grab, base };
	}

	beginRotate(id: string): void {
		this.#handle = { kind: 'rotate', id, base: this.#current };
	}

	/** Previews a handle drag: resize snaps sizes to the snap step; rotation snaps to 15° unless Shift. */
	updateHandle(screenPt: Point, opts: { shiftKey: boolean }): void {
		const h = this.#handle;
		if (!h) return;
		const obj = h.base.objects.find((o) => o.id === h.id);
		if (!obj) return;
		const world = screenToWorld(screenPt, this.viewport);
		if (h.kind === 'rotate') {
			const rotation = angleFromPointer(obj, world, opts.shiftKey ? null : ROTATE_SNAP_DEG);
			this.preview =
				rotation === obj.rotation ? null : setObjectProps(h.base, h.id, { rotation }, this.canvas);
			return;
		}
		const entry = getEntry(obj.symbolId);
		if (entry?.kind !== 'footprint') return;
		const box = {
			x: obj.x,
			y: obj.y,
			rotation: obj.rotation,
			widthFt: obj.widthFt ?? entry.footprint.widthFt,
			depthFt: obj.depthFt ?? entry.footprint.depthFt
		};
		const pointer = { x: world.x + h.grab.x, y: world.y + h.grab.y };
		const next = resizeFromCorner(box, h.corner, pointer, this.snapStep(), MIN_SIZE_FT);
		this.preview = setObjectProps(h.base, h.id, next, this.canvas);
	}

	/** Commits the previewed handle drag once; a press without a change commits nothing. */
	endHandle(): void {
		const preview = this.preview;
		this.#handle = null;
		if (preview) this.commit(preview);
		else this.preview = null;
	}

	cancelHandle(): void {
		this.#handle = null;
		this.preview = null;
	}

	/** Drops an in-progress move without changing the document (e.g. the browser took the pointer). */
	cancelMove(): void {
		this.#move = null;
		this.preview = null;
	}

	/** Commits the previewed move once; a press without movement changes nothing. */
	endMove(): void {
		const preview = this.preview;
		this.#move = null;
		if (preview) this.commit(preview);
		else this.preview = null;
	}
}
