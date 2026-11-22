import { createDb, type MatchSketchDB } from './db';

let db: MatchSketchDB | undefined;

/** The app's local database (browser only). */
export function getDb(): MatchSketchDB {
	db ??= createDb();
	return db;
}

export type { MatchSketchDB } from './db';
