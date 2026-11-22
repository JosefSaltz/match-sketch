import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export type Database = PostgresJsDatabase<typeof schema>;

/** A Drizzle database on `url` (postgres-js, up to 10 connections). */
export function createDatabase(url: string): { db: Database; close(): Promise<void> } {
	const client = postgres(url, { max: 10 });
	return { db: drizzle(client, { schema }), close: () => client.end() };
}
