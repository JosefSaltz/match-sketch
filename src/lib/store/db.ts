import Dexie, { type Table } from 'dexie';
import { PLAN_SCHEMA_VERSION } from '../model/plan';
import { readPlanDocument } from '../model/upgrade';
import type { CanvasRecord, MatchRecord, PlanRecord } from './records';

/** A per-device preference, e.g. the chosen theme. */
export type SettingRecord = { key: string; value: string; updatedAt: string };

export class MatchSketchDB extends Dexie {
	declare canvases: Table<CanvasRecord, string>;
	declare plans: Table<PlanRecord, string>;
	declare settings: Table<SettingRecord, string>;
	declare matches: Table<MatchRecord, string>;

	constructor(name: string) {
		super(name);
		this.version(1).stores({
			canvases: 'id, name, updatedAt, dirty',
			plans: 'id, updatedAt, matchId, dirty'
		});
		this.version(2).stores({
			canvases: 'id, name, updatedAt, dirty',
			plans: 'id, updatedAt, matchId, dirty',
			settings: 'key'
		});
		this.version(3).stores({
			canvases: 'id, name, updatedAt, dirty',
			plans: 'id, updatedAt, matchId, dirty',
			settings: 'key',
			matches: 'id, updatedAt, dirty'
		});
		// Plan schema version 2: the procedure became steps. Not marked dirty: the server upgrades
		// its copy the same way when it reads it.
		this.version(4)
			.stores({
				canvases: 'id, name, updatedAt, dirty',
				plans: 'id, updatedAt, matchId, dirty',
				settings: 'key',
				matches: 'id, updatedAt, dirty'
			})
			.upgrade((tx) =>
				tx
					.table('plans')
					.toCollection()
					.modify((plan: { schemaVersion: number; document: unknown }) => {
						if (plan.schemaVersion !== 1) return;
						plan.document = readPlanDocument(plan.document);
						plan.schemaVersion = PLAN_SCHEMA_VERSION;
					})
			);
	}
}

export function createDb(name = 'match-sketch'): MatchSketchDB {
	return new MatchSketchDB(name);
}
