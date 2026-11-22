import { defineEnvVars } from '@sveltejs/kit/env';
import { z } from 'zod';

const required = z.string().min(1);

export const variables = defineEnvVars({
	SUPABASE_URL: {
		public: true,
		// Inlined at build so the app opens offline; Coolify passes it as a build arg.
		static: true,
		schema: z.url(),
		description: 'Supabase project URL (local: from `supabase status`, see scripts/local-env.ts).'
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
	},
	ANTHROPIC_API_KEY: {
		// Optional: without it, Draft from text answers "not set up" and the rest of the app works.
		schema: (value) => value || undefined,
		description: 'Claude API key for Draft from text; server only, never sent to the browser.'
	},
	DRAFT_DAILY_CAP: {
		schema: (value) => positiveNumber(value, 20),
		description: 'Drafts each user may request per UTC day (default 20).'
	},
	DRAFT_DAILY_SPEND_USD: {
		schema: (value) => positiveNumber(value, 10),
		description:
			'Estimated model spend per UTC day, site-wide, before drafting pauses (default 10).'
	}
});

function positiveNumber(value: string | undefined, fallback: number): number {
	if (value === undefined || value === '') return fallback;
	const n = Number(value);
	if (!Number.isFinite(n) || n < 0)
		throw new Error(`Expected a number of 0 or more, got "${value}"`);
	return n;
}
