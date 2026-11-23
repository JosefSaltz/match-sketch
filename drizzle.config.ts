import { defineConfig } from 'drizzle-kit';

// Migrations land in supabase/migrations with Supabase timestamp names, so `supabase db reset`
// (local) and `supabase db push --remote` (hosted) apply them.
export default defineConfig({
	dialect: 'postgresql',
	schema: './src/lib/server/db/schema.ts',
	out: './supabase/migrations',
	migrations: { prefix: 'supabase' },
	dbCredentials: { url: process.env.DATABASE_URL ?? '' },
	schemaFilter: ['public']
});
