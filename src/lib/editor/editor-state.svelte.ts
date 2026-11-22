import { getEntry } from '../catalog/index';
import { snapPoint, snapStepFeet } from '../geometry/snap';
import type { CanvasSize, Point, Size } from '../geometry/types';
import { fitViewport, screenToWorld, zoomAt, type Viewport } from '../geometry/viewport';
import { emptyPlanDocument, type PlanDisplay, type PlanDocument } from '../model/plan';
import type { PlanRecord } from '../store/records';
import { createHistory, type History } from './history';
import {
	addObject,
	deleteObjects,
	duplicateObjects,
	moveObjects,
	reorder,
	setObjectProps,
	type ObjectPatch
} from './ops';

export type NudgeDir = 'left' | 'right' | 'up' | 'down';

/** An in-progress drag of the selection, previewed until release. */
type MoveDrag = { ids: string[]; anchorId: string; startWorld: Point; base: PlanDocument };

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
