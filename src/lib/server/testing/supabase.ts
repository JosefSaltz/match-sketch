/** Test-only helpers for *.db.test.ts files, which run against the local Supabase stack. */
import { createClient } from '@supabase/supabase-js';
import { requireLocal } from './local-only';

function env(name: string): string {
	const value = process.env[name];
	if (!value) throw new Error(`${name} is not set; run db tests with pnpm test:db`);
	return value;
}

const noSession = { auth: { persistSession: false, autoRefreshToken: false } };

const supabaseUrl = () => requireLocal(process.env.SUPABASE_URL);

/** The local stack's Postgres URL, for Drizzle in db tests. */
export function testDatabaseUrl(): string {
	return requireLocal(process.env.DATABASE_URL);
}

/** A client with the secret key (bypasses RLS; can use the auth admin API). */
export function testAdminClient() {
	return createClient(supabaseUrl(), env('SUPABASE_SECRET_KEY'), noSession);
}

/** A client with the publishable key, as the browser has. */
export function testPublicClient() {
	return createClient(supabaseUrl(), env('SUPABASE_PUBLISHABLE_KEY'), noSession);
}

/** A unique address for a test user. */
export function uniqueEmail(prefix = 'test'): string {
	return `${prefix}-${crypto.randomUUID()}@match-sketch.test`;
}
