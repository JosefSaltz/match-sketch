import { defineEnvVars } from '@sveltejs/kit/env';
import { z } from 'zod';

const required = z.string().min(1);

export const variables = defineEnvVars({
	SUPABASE_URL: {
		public: true,
		// Inlined at build so the app opens offline; Coolify passes it as a build arg.
		static: true,
		schema: z.url(),
		description: 'Supabase project URL (local: `pnpm db:env`).'
	},
	SUPABASE_PUBLISHABLE_KEY: {
		public: true,
		static: true,
		schema: required,
		description: 'Supabase publishable key (`sb_publishable_…`); safe in the browser.'
	},
	SUPABASE_SECRET_KEY: {
		schema: required,
		description: 'Supabase secret key (`sb_secret_…`); server only, bypasses RLS.'
	},
	DATABASE_URL: {
		schema: z.url(),
		description: 'Postgres connection string for Drizzle (hosted: the session pooler, port 5432).'
	}
});
