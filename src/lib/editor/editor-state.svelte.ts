import { getEntry } from '../catalog/index';
import { snapPoint, snapStepFeet } from '../geometry/snap';
import type { CanvasSize, Point, Size } from '../geometry/types';
import {
	angleFromPointer,
	resizeFromCorner,
	rotateWorld,
	type Corner
} from '../geometry/transform';
import {
	fitViewport,
	screenToWorld,
	zoomAt,
	zoomLimitsFor,
	type Viewport
} from '../geometry/viewport';
import {
	emptyPlanDocument,
	type Anchor,
	type PlanDisplay,
	type PlanDocument,
	type StageBrief
} from '../model/plan';
import { now, type PlanRecord } from '../store/records';
import {
	addAnnotation,
	anchorAt,
	itemPosition,
	resolveAnchor,
	setAnchor,
	setText
} from './annotations';
import { movedBeyond, TAP_SLOP_PX } from './gestures';
import { createHistory, type History } from './history';
import {
	addObject,
	clampInside,
	deleteItems,
	duplicateObjects,
	MIN_SIZE_FT,
	moveItems,
	reorder,
	setObjectProps,
	type ObjectPatch
} from './ops';
import { SaveQueue, type SaveStatus } from './save-queue';

export type { SaveStatus };

export type NudgeDir = 'left' | 'right' | 'up' | 'down';

/** Palette tools that draw annotations instead of placing symbols. */
export type AnnotationTool = 'text' | 'arrow' | 'measure';

/** An in-progress drag of the selection, previewed until release. */
type MoveDrag = {
	ids: string[];
	anchorId: string;
	startWorld: Point;
	base: PlanDocument;
	/** Where the press started on screen; nothing moves until the pointer leaves the slop. */
	startScreen: Point;
	slopPx: number;
	started: boolean;
};

/** An in-progress drag of a resize or rotate handle, previewed until release. */
type HandleDrag =
	| { kind: 'resize'; id: string; corner: Corner; grab: Point; base: PlanDocument }
	| { kind: 'rotate'; id: string; base: PlanDocument };

/**
 * An in-progress drag of an arrow or measure line's end: drawing a new line (`isNew`, moving its
 * `to` end) or re-anchoring one end of an existing line. The other end stays at `fixed`.
 */
type LinkDrag = {
	id: string;
	isNew: boolean;
	type: 'arrow' | 'measure';
	end: 'from' | 'to';
	fixed: Anchor;
	base: PlanDocument;
};

/** Rotation snaps to this many degrees unless Shift is held. */
export const ROTATE_SNAP_DEG = 15;

export type EditorDeps = {
	/** Writes the document to IndexedDB, stamped with the time of the edit. */
	save: (doc: PlanDocument, at: string) => Promise<void>;
	/** A synchronous copy of the newest edit that survives a reload (see store/journal). */
	journal?: { write: (doc: PlanDocument, at: string) => void; clear: () => void };
};

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
	/** The selected annotations, in document order. */
	selectedAnnotations = $derived(this.doc.annotations.filter((a) => this.selection.includes(a.id)));
	armedSymbolId = $state<string | null>(null);
	/** The armed annotation tool; arming one disarms the symbol and the other way round. */
	tool = $state<AnnotationTool | null>(null);
	saveStatus = $state<SaveStatus>('saved');
	canUndo = $state(false);
	canRedo = $state(false);
	/** Which tab the right column shows. */
	panel = $state<'properties' | 'brief'>('properties');
	/** The field being typed in; its keystrokes share one undo step (see setBrief). */
	#typing: string | null = null;
	#queue: SaveQueue<{ doc: PlanDocument; at: string }>;

	constructor(plan: PlanRecord, deps: EditorDeps) {
		this.plan = plan;
		this.#deps = deps;
		this.#history = createHistory(plan.document);
		this.#current = plan.document;
		this.#queue = new SaveQueue(
			({ doc, at }) => deps.save(doc, at),
			(status) => {
				this.saveStatus = status;
				if (status === 'saved') deps.journal?.clear();
			}
		);
	}

	/** The plan's own copy of the bay dimensions. */
	get canvas(): CanvasSize {
		return { widthFt: this.plan.widthFt, depthFt: this.plan.depthFt };
	}

	commit(next: PlanDocument): void {
		this.#typing = null;
		// A change from elsewhere (e.g. a key press) ends any drag, so its release can't undo it.
		this.#endDrags();
		this.#history.push(next);
		this.#show(next);
	}

	undo(): void {
		if (!this.#history.canUndo) return;
		this.#typing = null;
		this.#endDrags();
		this.#show(this.#history.undo());
	}

	redo(): void {
		if (!this.#history.canRedo) return;
		this.#typing = null;
		this.#endDrags();
		this.#show(this.#history.redo());
	}

	/** Makes `doc` current and saves it right away: journal first (synchronous), then IndexedDB. */
	#show(doc: PlanDocument): void {
		this.#current = doc;
		this.preview = null;
		this.canUndo = this.#history.canUndo;
		this.canRedo = this.#history.canRedo;
		// Undo can remove selected items; keep only those that still exist.
		const kept = this.selection.filter(
			(id) => doc.objects.some((o) => o.id === id) || doc.annotations.some((a) => a.id === id)
		);
		if (kept.length !== this.selection.length) this.selection = kept;
		// One timestamp per edit, shared by the journal and the stored plan, so recovery can tell
		// which is newer even when an earlier save lands after this edit was journaled.
		const at = now();
		this.#deps.journal?.write(doc, at);
		this.#queue.save({ doc, at });
	}

	#endDrags(): void {
		this.#move = null;
		this.#handle = null;
		this.#link = null;
		this.preview = null;
	}

	setPreview(doc: PlanDocument | null): void {
		this.preview = doc;
	}

	/** Arms a palette symbol so the next tap on the stage places it; `null` disarms. */
	arm(symbolId: string | null): void {
		this.armedSymbolId = symbolId;
		if (symbolId) this.tool = null;
	}

	armTool(tool: AnnotationTool | null): void {
		this.tool = tool;
		if (tool) this.armedSymbolId = null;
	}

	/**
	 * Places a text label reading "Text" at a screen point (snapped, inside the bay), selects it,
	 * shows the Properties tab so it can be typed, and disarms the tool. Returns its id.
	 */
	placeText(screenPt: Point): string {
		const world = screenToWorld(screenPt, this.viewport);
		const at = clampInside(snapPoint(world, this.snapStep()), this.canvas);
		const id = crypto.randomUUID();
		this.commit(addAnnotation(this.#current, { id, type: 'text', ...at, text: 'Text' }));
		this.selection = [id];
		this.panel = 'properties';
		this.tool = null;
		return id;
	}

	#link: LinkDrag | null = null;

	/** Starts drawing a line with the armed arrow or measure tool; the press is its start. */
	beginLink(screenPt: Point, hitObjectId: string | null): void {
		const type = this.tool;
		if (type !== 'arrow' && type !== 'measure') return;
		const base = this.#current;
		const world = screenToWorld(screenPt, this.viewport);
		this.#link = {
			id: crypto.randomUUID(),
			isNew: true,
			type,
			end: 'to',
			fixed: anchorAt(base, hitObjectId, world, this.canvas, this.snapStep()),
			base
		};
	}

	/** Starts dragging one end of an existing line; the other end stays put. */
	beginEndpoint(id: string, end: 'from' | 'to'): void {
		const base = this.#current;
		const a = base.annotations.find((x) => x.id === id);
		if (!a || a.type === 'text') return;
		this.#link = { id, isNew: false, type: a.type, end, fixed: end === 'to' ? a.from : a.to, base };
	}

	/** Previews the line with its moving end on the object under the pointer, or a snapped point. */
	updateLink(screenPt: Point, hitObjectId: string | null): void {
		const l = this.#link;
		if (!l) return;
		const world = screenToWorld(screenPt, this.viewport);
		const moving = anchorAt(l.base, hitObjectId, world, this.canvas, this.snapStep());
		this.preview = l.isNew
			? addAnnotation(l.base, { id: l.id, type: l.type, from: l.fixed, to: moving })
			: setAnchor(l.base, l.id, l.end, moving);
	}

	/**
	 * Commits the previewed line once. A new line is selected and its tool disarmed. A line whose
	 * ends land on the same spot (a tap, or both ends on one object) commits nothing.
	 */
	endLink(): void {
		const l = this.#link;
		const preview = this.preview;
		this.#link = null;
		const a = preview?.annotations.find((x) => x.id === l?.id);
		if (!l || !preview || !a || a.type === 'text') {
			this.preview = null;
			return;
		}
		const from = resolveAnchor(preview, a.from);
		const to = resolveAnchor(preview, a.to);
		if (!from || !to || (from.x === to.x && from.y === to.y)) {
			this.preview = null;
			return;
		}
		this.commit(preview);
		if (l.isNew) {
			this.selection = [l.id];
			this.tool = null;
		}
	}

	cancelLink(): void {
		this.#link = null;
		this.preview = null;
	}

	/** Sets a text label's text; blank text keeps the old text. */
	setText(id: string, text: string): void {
		const next = setText(this.#current, id, text);
		if (next !== this.#current) this.commit(next);
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

	/** Back to fitting the whole bay; stays fitted through resizes until the next zoom or pan. */
	fit(): void {
		this.#manualViewport = null;
	}

	zoomBy(factor: number, at?: Point): void {
		const p = at ?? { x: this.screen.width / 2, y: this.screen.height / 2 };
		const fitScale = fitViewport(this.canvas, this.screen, FIT_PADDING_PX).scale;
		this.#manualViewport = zoomAt(this.viewport, p, factor, zoomLimitsFor(fitScale));
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
		this.commit(deleteItems(this.#current, this.selection));
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
		this.commit(moveItems(this.#current, this.selection, delta, this.canvas));
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

	/**
	 * Changes brief fields. `typing` names the field being typed in: consecutive calls with the
	 * same name replace the last undo step instead of adding one, so a field visit undoes in one
	 * step while every keystroke is still saved. Any other edit, undo, redo or `endTyping` ends it.
	 */
	setBrief(patch: Partial<StageBrief>, typing?: string): void {
		const doc = this.#current;
		const next = { ...doc, brief: { ...doc.brief, ...patch } };
		if (typing !== undefined && typing === this.#typing) {
			this.#history.replace(next);
			this.#show(next);
			return;
		}
		this.commit(next);
		this.#typing = typing ?? null;
	}

	/** Ends the current typing run (the field lost focus). */
	endTyping(): void {
		this.#typing = null;
	}

	addNoteSection(): void {
		const notes = this.#current.brief.notes;
		this.setBrief({ notes: [...notes, { id: crypto.randomUUID(), title: '', body: '' }] });
	}

	updateNoteSection(id: string, patch: { title?: string; body?: string }, typing?: string): void {
		const notes = this.#current.brief.notes.map((n) => (n.id === id ? { ...n, ...patch } : n));
		this.setBrief({ notes }, typing);
	}

	removeNoteSection(id: string): void {
		this.setBrief({ notes: this.#current.brief.notes.filter((n) => n.id !== id) });
	}

	setDisplay(patch: Partial<PlanDisplay>): void {
		const doc = this.#current;
		this.commit({ ...doc, display: { ...doc.display, ...patch } });
	}

	#move: MoveDrag | null = null;

	/**
	 * Starts dragging the current selection, grabbed by object `id` at a screen point. Nothing
	 * moves until the pointer travels more than `slopPx`, so a wobbly tap stays a tap.
	 */
	beginMove(id: string, screenPt: Point, slopPx = TAP_SLOP_PX): void {
		const ids = this.selection.includes(id) ? this.selection : [id];
		this.#move = {
			ids,
			anchorId: id,
			startWorld: screenToWorld(screenPt, this.viewport),
			base: this.#current,
			startScreen: screenPt,
			slopPx,
			started: false
		};
	}

	/** Previews the move. With snap on, the grabbed object lands on the grid; the rest follow. */
	updateMove(screenPt: Point): void {
		const m = this.#move;
		if (!m) return;
		if (!m.started) {
			if (!movedBeyond(m.startScreen, screenPt, m.slopPx)) return;
			m.started = true;
		}
		const anchor = itemPosition(m.base, m.anchorId);
		if (!anchor) return;
		const w = screenToWorld(screenPt, this.viewport);
		const target = snapPoint(
			{ x: anchor.x + w.x - m.startWorld.x, y: anchor.y + w.y - m.startWorld.y },
			this.snapStep()
		);
		const delta = { x: target.x - anchor.x, y: target.y - anchor.y };
		this.preview =
			delta.x === 0 && delta.y === 0 ? null : moveItems(m.base, m.ids, delta, this.canvas);
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
