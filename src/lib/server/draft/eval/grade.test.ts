import { describe, expect, it } from 'vitest';
import type { DraftResult, Placement } from '../../../draft/contract';
import type { EvalCase } from './cases';
import { gradeDraft } from './grade';

const theCase: EvalCase = {
	name: 'test stage',
	request: {
		planId: '00000000-0000-4000-8000-000000000000',
		description: 'From SA-1 engage the poppers; from SA-2 the static steel.',
		brief: {
			matchName: '',
			stageNumber: '1',
			stageName: '',
			startPosition: '',
			gunReady: '',
			procedure: 'From SA-1 engage the poppers; from SA-2 the static steel.',
			roundCount: '',
			parTime: '',
			targetsOverride: null,
			notes: []
		},
		canvas: { widthFt: 90, depthFt: 150, unit: 'yd' },
		symbolSize: 'medium'
	},
	targets: { popper: 4, 'steel-static': 2 },
	labels: ['SA-1', 'SA-2']
};

const sa = (label: string, x: number): Placement => ({
	symbolId: 'shooting-box',
	x,
	y: 10,
	rotation: 0,
	label,
	widthFt: 6,
	depthFt: 6
});
const perfect: DraftResult = {
	status: 'ok',
	objects: [
		sa('SA-1', 20),
		sa('SA-2', 70),
		{ symbolId: 'popper', x: 20, y: 100, rotation: 0, count: 4 },
		{ symbolId: 'steel-static', x: 70, y: 120, rotation: 0, count: 2 }
	],
	unrepresentable: [],
	dropped: []
};

describe('gradeDraft', () => {
	it('scores a draft that gets everything right as 1', () => {
		expect(gradeDraft(theCase, perfect).score).toBe(1);
	});

	it('marks down a missing target type and its count', () => {
		const result = {
			...perfect,
			objects: perfect.objects.filter((o) => o.symbolId !== 'steel-static')
		};
		const { checks, score } = gradeDraft(theCase, result);
		expect(checks.targetTypes).toBe(0.5);
		expect(checks.targetCounts).toBe(0.5);
		expect(score).toBeLessThan(1);
	});

	it('counts popper variants as poppers', () => {
		const result = {
			...perfect,
			objects: perfect.objects.map((o) =>
				o.symbolId === 'popper' ? { ...o, symbolId: 'popper-static' } : o
			)
		};
		expect(gradeDraft(theCase, result).checks.targetCounts).toBe(1);
	});

	it('fails a draft that had placements dropped off the bay', () => {
		const result = {
			...perfect,
			dropped: [{ what: 'popper at (400, 10)', reason: 'outside the bay' }]
		};
		expect(gradeDraft(theCase, result).checks.onBay).toBe(false);
	});

	it('notices fixed-size symbols standing on top of each other', () => {
		const result = {
			...perfect,
			objects: [...perfect.objects, { symbolId: 'barrel', x: 20.5, y: 100.5, rotation: 0 }]
		};
		expect(gradeDraft(theCase, result).checks.noOverlap).toBe(false);
	});

	it('wants targets downrange of the shooting areas', () => {
		const result = {
			...perfect,
			objects: perfect.objects.map((o) => (o.label ? { ...o, y: 140 } : o))
		};
		expect(gradeDraft(theCase, result).checks.targetsDownrange).toBe(false);
	});

	it('scores a draft that never came back as 0', () => {
		for (const status of ['failed', 'refused'] as const) {
			expect(
				gradeDraft(theCase, { status, objects: [], unrepresentable: [], dropped: [] }).score
			).toBe(0);
		}
	});
});
