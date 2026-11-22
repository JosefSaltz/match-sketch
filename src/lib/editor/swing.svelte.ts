import type { Point } from '../geometry/types';
import { atRest, feed, REST, step } from './swing';

/**
 * The swing of whatever is being dragged (see swing.ts), animated with requestAnimationFrame.
 * `ids` are the swinging items and `pivot` the screen point they hang from (the pointer). After
 * a drop it keeps swinging around the drop point until it settles. Off with reduced motion.
 */
export class DragSwing {
	angle = $state(0);
	pivot = $state<Point>({ x: 0, y: 0 });
	ids = $state.raw<readonly string[]>([]);

	#s = REST;
	#last: { x: number; t: number } | null = null;
	#frame = 0;
	#enabled =
		typeof window !== 'undefined' &&
		typeof window.matchMedia === 'function' &&
		!window.matchMedia('(prefers-reduced-motion: reduce)').matches;

	/** The pointer moved while dragging `ids`. */
	move(ids: readonly string[], pointer: Point): void {
		if (!this.#enabled) return;
		this.ids = ids;
		this.pivot = pointer;
		const t = performance.now();
		if (this.#last) this.#s = feed(this.#s, pointer.x - this.#last.x, t - this.#last.t);
		this.#last = { x: pointer.x, t };
		this.#run();
	}

	/** The drag ended: keep swinging until it settles. */
	release(): void {
		this.#last = null;
	}

	/** Stop at once (a cancelled drag). */
	stop(): void {
		if (this.#frame) cancelAnimationFrame(this.#frame);
		this.#frame = 0;
		this.#last = null;
		this.#s = REST;
		this.angle = 0;
		this.ids = [];
	}

	/** An SVG transform that swings an item about the pivot, or '' when it isn't swinging. */
	transformFor(id: string): string {
		if (this.angle === 0 || !this.ids.includes(id)) return '';
		return `rotate(${this.angle.toFixed(2)} ${this.pivot.x} ${this.pivot.y})`;
	}

	#run(): void {
		if (this.#frame) return;
		let prev = performance.now();
		const tick = (t: number) => {
			this.#s = step(this.#s, t - prev);
			prev = t;
			if (atRest(this.#s)) {
				this.#s = REST;
				this.angle = 0;
				this.#frame = 0;
				if (!this.#last) this.ids = [];
				return;
			}
			this.angle = this.#s.angle;
			this.#frame = requestAnimationFrame(tick);
		};
		this.#frame = requestAnimationFrame(tick);
	}
}
