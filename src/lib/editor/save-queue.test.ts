import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SaveQueue, retryDelayMs, type SaveStatus } from './save-queue';

/** A write whose calls the test resolves or rejects by hand. */
function controlledWrite() {
	const calls: { value: string; resolve: () => void; reject: (e: Error) => void }[] = [];
	const write = (value: string) =>
		new Promise<void>((resolve, reject) => {
			calls.push({ value, resolve, reject });
		});
	return { write, calls };
}

const flush = () => Promise.resolve().then(() => Promise.resolve());

describe('SaveQueue', () => {
	let statuses: SaveStatus[];
	beforeEach(() => {
		vi.useFakeTimers();
		statuses = [];
	});
	afterEach(() => vi.useRealTimers());

	it('starts the write synchronously and settles on saved', async () => {
		const { write, calls } = controlledWrite();
		const q = new SaveQueue(write, (s) => statuses.push(s));
		q.save('a');
		expect(calls.map((c) => c.value)).toEqual(['a']);
		expect(q.status).toBe('saving');
		calls[0].resolve();
		await flush();
		expect(q.status).toBe('saved');
		expect(statuses).toEqual(['saving', 'saved']);
	});

	it('runs one write at a time and writes only the latest pending value next', async () => {
		const { write, calls } = controlledWrite();
		const q = new SaveQueue(write, () => {});
		q.save('a');
		q.save('b');
		q.save('c');
		expect(calls.map((c) => c.value)).toEqual(['a']);
		calls[0].resolve();
		await flush();
		expect(calls.map((c) => c.value)).toEqual(['a', 'c']);
		expect(q.status).toBe('saving');
		calls[1].resolve();
		await flush();
		expect(q.status).toBe('saved');
	});

	it('retries a failed write after 1 s, 2 s, 4 s … until it succeeds', async () => {
		const { write, calls } = controlledWrite();
		const q = new SaveQueue(write, (s) => statuses.push(s));
		q.save('a');
		calls[0].reject(new Error('disk full'));
		await flush();
		expect(q.status).toBe('error');
		await vi.advanceTimersByTimeAsync(999);
		expect(calls).toHaveLength(1);
		await vi.advanceTimersByTimeAsync(1);
		expect(calls.map((c) => c.value)).toEqual(['a', 'a']);
		calls[1].reject(new Error('still full'));
		await flush();
		await vi.advanceTimersByTimeAsync(1999);
		expect(calls).toHaveLength(2);
		await vi.advanceTimersByTimeAsync(1);
		expect(calls).toHaveLength(3);
		calls[2].resolve();
		await flush();
		expect(q.status).toBe('saved');
		expect(statuses).toEqual(['saving', 'error', 'saving', 'error', 'saving', 'saved']);
	});

	it('writes a new value right away instead of waiting out a retry', async () => {
		const { write, calls } = controlledWrite();
		const q = new SaveQueue(write, () => {});
		q.save('a');
		calls[0].reject(new Error('fail'));
		await flush();
		q.save('b');
		expect(calls.map((c) => c.value)).toEqual(['a', 'b']);
		calls[1].resolve();
		await flush();
		await vi.advanceTimersByTimeAsync(20_000);
		expect(calls).toHaveLength(2);
		expect(q.status).toBe('saved');
	});

	it('caps the retry delay at 10 s', () => {
		expect([1, 2, 3, 4, 5, 6].map(retryDelayMs)).toEqual([1000, 2000, 4000, 8000, 10000, 10000]);
	});
});
