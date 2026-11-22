import Dexie, { type Table } from 'dexie';
import type { CanvasRecord, PlanRecord } from './records';

export class MatchSketchDB extends Dexie {
	declare canvases: Table<CanvasRecord, string>;
	declare plans: Table<PlanRecord, string>;

	constructor(name: string) {
		super(name);
		this.version(1).stores({
			canvases: 'id, name, updatedAt, dirty',
			plans: 'id, updatedAt, matchId, dirty'
		});
	}
}

export function createDb(name = 'match-sketch'): MatchSketchDB {
	return new MatchSketchDB(name);
}
