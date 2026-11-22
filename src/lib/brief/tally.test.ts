import { describe, expect, it } from 'vitest';
import { emptyPlanDocument, type PlanObject } from '../model/plan';
import { targetsTally, targetsText } from './tally';

let z = 0;
function obj(symbolId: string, extra: Partial<PlanObject> = {}): PlanObject {
	return { id: crypto.randomUUID(), symbolId, x: 1, y: 1, rotation: 0, z: z++, ...extra };
}

describe('targetsTally', () => {
	it('sums counts per target type in catalog order', () => {
		expect(
			targetsTally([
				obj('steel-static'),
				obj('paper', { count: 4 }),
				obj('steel-static', { count: 2 })
			])
		).toBe('4 paper targets, 3 static steel');
	});

	it('uses the singular for one', () => {
		expect(targetsTally([obj('popper')])).toBe('1 knock-down popper');
	});

	it('ignores props, areas, markers and unknown symbols', () => {
		expect(targetsTally([obj('barrel'), obj('shooting-box'), obj('nope')])).toBe('');
	});

	it('counts an object without a count as one', () => {
		expect(targetsTally([obj('paper'), obj('paper')])).toBe('2 paper targets');
	});
});

describe('targetsTally with the full set', () => {
	it('keeps the case of proper names and abbreviations', () => {
		expect(
			targetsTally([
				obj('texas-star'),
				obj('plate-kd', { count: 2 }),
				obj('no-shoot', { count: 3 })
			])
		).toBe('3 no-shoots, 2 KD plates, 1 Texas star');
	});

	it('uses the special plurals', () => {
		expect(targetsTally([obj('ducks', { count: 2 }), obj('paper-hard-cover', { count: 2 })])).toBe(
			'2 papers with hard cover, 2 ducks in a row'
		);
	});
});

describe('targetsText', () => {
	it('an override wins over the tally', () => {
		const doc = emptyPlanDocument();
		const withOverride = {
			...doc,
			objects: [obj('paper')],
			brief: { ...doc.brief, targetsOverride: '6 paper' }
		};
		expect(targetsText(withOverride)).toBe('6 paper');
	});

	it('falls back to the tally without an override', () => {
		expect(targetsText({ ...emptyPlanDocument(), objects: [obj('paper')] })).toBe('1 paper target');
	});
});
