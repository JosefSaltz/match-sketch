import { snapStepFeet } from '../geometry/snap';
import type { CanvasSize, Point, Size } from '../geometry/types';
import { fitViewport, zoomAt, type Viewport } from '../geometry/viewport';
import { emptyPlanDocument, type PlanDocument } from '../model/plan';
import type { PlanRecord } from '../store/records';
import { createHistory, type History } from './history';

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
}
