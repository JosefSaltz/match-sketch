import { describe, expect, it } from 'vitest';
import { emptyPlanDocument } from '../model/plan';
import { fetchSharedView, sharedStage } from './client';
import type { SharedPlan, SharedView } from './view';

const plan = (stageNumber: string): SharedPlan => ({
	id: crypto.randomUUID(),
	widthFt: 90,
	depthFt: 60,
	unit: 'yd',
	stageNumber,
	document: emptyPlanDocument()
});

describe('fetchSharedView', () => {
	it('returns null for a link that is not shared', async () => {
		const notFound = () => Promise.resolve(Response.json({ error: 'not-found' }, { status: 404 }));
		expect(await fetchSharedView('x', notFound)).toBeNull();
	});

	it('returns a valid view and refuses an odd one', async () => {
		const view: SharedView = { kind: 'plan', plan: plan('1'), matchName: '', date: '' };
		expect(await fetchSharedView('x', () => Promise.resolve(Response.json(view)))).toEqual(view);
		const odd = () => Promise.resolve(Response.json({ kind: 'plan' }));
		expect(await fetchSharedView('x', odd)).toBeNull();
	});
});

describe('sharedStage', () => {
	const view: SharedView = {
		kind: 'match',
		match: { name: 'SOF', date: '2026-05-02' },
		plans: [plan('1'), plan('2')]
	};

	it('finds a stage of a shared match, and nothing for an unknown one', () => {
		expect(sharedStage(view, view.plans[1].id)).toMatchObject({ index: 1, count: 2 });
		expect(sharedStage(view, crypto.randomUUID())).toBeNull();
		expect(sharedStage(view, null)).toBeNull();
	});
});
