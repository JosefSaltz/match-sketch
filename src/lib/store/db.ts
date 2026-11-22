import Dexie, { type Table } from 'dexie';
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
	}
}

export function createDb(name = 'match-sketch'): MatchSketchDB {
	return new MatchSketchDB(name);
}
