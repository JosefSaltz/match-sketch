export type SaveStatus = 'saved' | 'saving' | 'error';

/** Delay before retry number `attempt` (1-based): 1 s, 2 s, 4 s, … capped at 10 s. */
export function retryDelayMs(attempt: number): number {
	return Math.min(1000 * 2 ** (attempt - 1), 10_000);
}

/**
 * Runs saves one at a time. A save starts synchronously when nothing is in flight (so the
 * write begins inside the caller's turn); saves that arrive meanwhile collapse to the latest
 * value. A failed save is retried with backoff until it succeeds; a newer save skips the wait.
 */
export class SaveQueue<T> {
	#write: (value: T) => Promise<unknown>;
	#onStatus: (status: SaveStatus) => void;
	#status: SaveStatus = 'saved';
	#inFlight = false;
	#pending: { value: T } | null = null;
	#failures = 0;
	#timer: ReturnType<typeof setTimeout> | null = null;

	constructor(write: (value: T) => Promise<unknown>, onStatus: (status: SaveStatus) => void) {
		this.#write = write;
		this.#onStatus = onStatus;
	}

	get status(): SaveStatus {
		return this.#status;
	}

	save(value: T): void {
		this.#pending = { value };
		if (this.#inFlight) return;
		if (this.#timer !== null) {
			clearTimeout(this.#timer);
			this.#timer = null;
		}
		this.#next();
	}

	#next(): void {
		const job = this.#pending;
		if (!job) return;
		this.#pending = null;
		this.#inFlight = true;
		this.#set('saving');
		let write: Promise<unknown>;
		try {
			write = this.#write(job.value);
		} catch (err) {
			write = Promise.reject(err instanceof Error ? err : new Error(String(err)));
		}
		write.then(
			() => {
				this.#inFlight = false;
				this.#failures = 0;
				if (this.#pending) this.#next();
				else this.#set('saved');
			},
			() => {
				this.#inFlight = false;
				this.#failures += 1;
				// Retry the failed value unless a newer one is already waiting.
				this.#pending ??= job;
				this.#set('error');
				this.#timer = setTimeout(() => {
					this.#timer = null;
					this.#next();
				}, retryDelayMs(this.#failures));
			}
		);
	}

	#set(status: SaveStatus): void {
		if (status === this.#status) return;
		this.#status = status;
		this.#onStatus(status);
	}
}
