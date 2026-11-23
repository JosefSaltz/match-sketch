import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { networkFirst } from './network-first';

const ok = (text: string) => new Response(text);
const never = () => new Promise<Response>(() => {});

beforeEach(() => {
	vi.useFakeTimers();
});
afterEach(() => {
	vi.useRealTimers();
});

describe('networkFirst', () => {
	it('uses the network when it answers in time', async () => {
		const response = await networkFirst(
			() => Promise.resolve(ok('net')),
			() => Promise.resolve(ok('cache')),
			3000
		);
		expect(await response.text()).toBe('net');
	});

	it('falls back when the network fails', async () => {
		const response = await networkFirst(
			() => Promise.reject(new TypeError('offline')),
			() => Promise.resolve(ok('cache')),
			3000
		);
		expect(await response.text()).toBe('cache');
	});

	it('falls back on weak signal instead of hanging', async () => {
		const pending = networkFirst(never, () => Promise.resolve(ok('cache')), 3000);
		await vi.advanceTimersByTimeAsync(3000);
		expect(await (await pending).text()).toBe('cache');
	});

	it('keeps waiting for the network when there is nothing to fall back on', async () => {
		let answer!: (r: Response) => void;
		const pending = networkFirst(
			() => new Promise<Response>((r) => (answer = r)),
			() => Promise.resolve(undefined),
			3000
		);
		await vi.advanceTimersByTimeAsync(5000);
		answer(ok('late'));
		expect(await (await pending).text()).toBe('late');
	});
});
