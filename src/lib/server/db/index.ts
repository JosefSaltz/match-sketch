import { DATABASE_URL } from '$app/env/private';
import { createDatabase, type Database } from './client';

let database: Database | undefined;

/** The server's database (lazily connected from DATABASE_URL). */
export function serverDb(): Database {
	database ??= createDatabase(DATABASE_URL).db;
	return database;
}

export type { Database } from './client';
