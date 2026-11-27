import { describe, expect, it } from 'vitest';
import { newShareId, SHARE_TOKEN, shareUrl, ShareSchema } from './share';

describe('share links', () => {
	it('makes a fresh 22-character token each time', () => {
		const a = newShareId();
		expect(a).toMatch(SHARE_TOKEN);
		expect(newShareId()).not.toBe(a);
		expect(ShareSchema.safeParse({ id: a, on: true }).success).toBe(true);
	});

	it('rejects tokens of the wrong shape', () => {
		expect(ShareSchema.safeParse({ id: 'short', on: true }).success).toBe(false);
		expect(ShareSchema.safeParse({ id: `${'a'.repeat(21)}/`, on: true }).success).toBe(false);
	});

	it('builds the viewer address for a stage and for a stage of a match', () => {
		const t = 'AbCdEfGhIjKlMnOpQrStUv';
		expect(shareUrl('https://ms.example/', t)).toBe(`https://ms.example/s/${t}`);
		const stage = '0b6f3c1e-8a7d-4c2b-9e1f-2a3b4c5d6e7f';
		expect(shareUrl('https://ms.example', t, stage)).toBe(
			`https://ms.example/s/${t}?stage=${stage}`
		);
	});
});
