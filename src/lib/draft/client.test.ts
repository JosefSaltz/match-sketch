import { describe, expect, it } from 'vitest';
import { emptyPlanDocument } from '../model/plan';
import { draftProblem, requestDraft } from './client';
import { draftBrief, type DraftRequest, type DraftResult } from './contract';

const request: DraftRequest = {
	planId: crypto.randomUUID(),
	description: 'Engage the steel.',
	brief: draftBrief(emptyPlanDocument().brief),
	canvas: { widthFt: 60, depthFt: 90, unit: 'yd' },
	symbolSize: 'medium'
};
const result: DraftResult = { status: 'ok', objects: [], unrepresentable: [], dropped: [] };
const reply =
	(status: number, body: unknown): typeof fetch =>
	() =>
		Promise.resolve(Response.json(body, { status }));

describe('requestDraft', () => {
	it('returns the draft', async () => {
		expect(await requestDraft(request, reply(200, result))).toEqual({ ok: true, result });
	});

	it("passes on the server's explanation (cap, pause, not set up)", async () => {
		const capped = reply(429, {
			code: 'capped',
			message: "You've used today's 20 drafts. Drafting resets at midnight UTC."
		});
		expect(await requestDraft(request, capped)).toEqual({
			ok: false,
			message: "You've used today's 20 drafts. Drafting resets at midnight UTC."
		});
	});

	it('says a connection is needed when the request fails', async () => {
		const offline: typeof fetch = () => Promise.reject(new TypeError('Failed to fetch'));
		expect(await requestDraft(request, offline)).toEqual({
			ok: false,
			message: 'Drafting needs a connection.'
		});
	});

	it('gives up on a draft that takes too long', async () => {
		const slow: typeof fetch = (_url, init) =>
			new Promise((_resolve, reject) =>
				init?.signal?.addEventListener('abort', () =>
					reject(new DOMException('timed out', 'TimeoutError'))
				)
			);
		expect(await requestDraft(request, slow, 20)).toEqual({
			ok: false,
			message: 'The draft took too long. Try again.'
		});
	});
});

describe('draftProblem', () => {
	it('explains a refused or failed draft, and nothing else', () => {
		expect(draftProblem({ ...result, status: 'refused' })).toMatch(/declined/);
		expect(draftProblem({ ...result, status: 'failed' })).toMatch(/didn't work/);
		expect(draftProblem({ ...result, status: 'partial' })).toBeNull();
	});
});
