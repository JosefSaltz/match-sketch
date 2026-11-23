import { describe, expect, it } from 'vitest';
import { emptyPlanDocument } from '../model/plan';
import type { CanvasRecord, MatchRecord, PlanRecord } from '../store/records';
import {
	fromServer,
	PushRequestSchema,
	ServerRecordSchema,
	toWire,
	WireRecordSchema
} from './wire';

const meta = {
	id: crypto.randomUUID(),
	version: 3,
	updatedAt: '2026-11-22T17:30:00.000Z',
	deletedAt: null,
	dirty: 1 as const
};
const canvas: CanvasRecord = { ...meta, name: 'Bay 4', widthFt: 90, depthFt: 60, unit: 'yd' };
const match: MatchRecord = { ...meta, name: 'SOF 2026', date: '2026-05-02' };
const plan: PlanRecord = {
	...meta,
	matchId: crypto.randomUUID(),
	stageOrder: 2,
	sourceCanvasId: null,
	widthFt: 90,
	depthFt: 60,
	unit: 'yd',
	schemaVersion: 2,
	document: emptyPlanDocument()
};

/** A plan document as an app before schema version 2 wrote it. */
function v1Document(procedure: string) {
	const { steps, ...brief } = emptyPlanDocument().brief;
	void steps;
	return { ...emptyPlanDocument(), brief: { ...brief, procedure } };
}

describe('plan schema versions', () => {
	it('reads a version 1 plan from the server as version 2', () => {
		const server = ServerRecordSchema.parse({
			...toWire('plans', plan),
			version: 4,
			schemaVersion: 1,
			document: v1Document('Start\nEngage T1')
		});
		const local = fromServer(server) as PlanRecord;
		expect(local.schemaVersion).toBe(2);
		expect(local.document.brief.steps.map((s) => s.text)).toEqual(['Start', 'Engage T1']);
	});

	it('leaves a plan from a newer app to a reload', () => {
		const server = ServerRecordSchema.parse({
			...toWire('plans', plan),
			version: 4,
			schemaVersion: 3,
			document: {}
		});
		expect(() => fromServer(server)).toThrow('newer-schema');
	});

	it('takes a version 1 push from an older app, upgraded', () => {
		const wire = WireRecordSchema.parse({
			...toWire('plans', plan),
			schemaVersion: 1,
			document: v1Document('Start')
		});
		if (wire.table !== 'plans') throw new Error('expected a plan');
		expect(wire.document.brief.steps.map((s) => s.text)).toEqual(['Start']);
	});
});

describe('wire records', () => {
	it.each([
		['canvases', canvas],
		['matches', match],
		['plans', plan]
	] as const)('round-trips a %s record through the wire and back', (table, record) => {
		const wire = WireRecordSchema.parse(toWire(table, record));
		expect(wire).not.toHaveProperty('dirty');
		expect(wire).not.toHaveProperty('version');
		const server = ServerRecordSchema.parse({ ...wire, version: 4 });
		expect(fromServer(server)).toEqual({ ...record, version: 4, dirty: 0 });
	});

	it('rejects a plan whose document is invalid', () => {
		const wire = { ...toWire('plans', plan), document: { objects: 'nope' } };
		expect(WireRecordSchema.safeParse(wire).success).toBe(false);
	});

	it('rejects a canvas outside the allowed size', () => {
		expect(WireRecordSchema.safeParse(toWire('canvases', { ...canvas, widthFt: 1 })).success).toBe(
			false
		);
	});

	it('takes at most 50 records in one push', () => {
		const item = { record: toWire('canvases', canvas), baseVersion: 0 };
		expect(PushRequestSchema.safeParse({ records: Array(50).fill(item) }).success).toBe(true);
		expect(PushRequestSchema.safeParse({ records: Array(51).fill(item) }).success).toBe(false);
	});

	it('recognises a plan from a newer app but will not apply it', () => {
		const newer = { ...toWire('plans', plan), version: 1, schemaVersion: 3, document: { v: 2 } };
		const server = ServerRecordSchema.parse(newer);
		expect(() => fromServer(server)).toThrow('newer-schema');
	});
});
