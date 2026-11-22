import { sql } from 'drizzle-orm';
import { pgEnum, pgPolicy, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { authenticatedRole, authUsers } from 'drizzle-orm/supabase';

export const profileRole = pgEnum('profile_role', ['md', 'admin']);

/**
 * One row per auth user, created by the `on_auth_user_created` trigger (custom migration).
 * Signed-in users may read only their own row; nobody changes it through the Data API.
 */
export const profiles = pgTable(
	'profiles',
	{
		id: uuid()
			.primaryKey()
			.references(() => authUsers.id, { onDelete: 'cascade' }),
		displayName: text('display_name').notNull().default(''),
		role: profileRole().notNull().default('md'),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [
		pgPolicy('profiles_select_own', {
			for: 'select',
			to: authenticatedRole,
			using: sql`(select auth.uid()) = ${t.id}`
		})
	]
);

export type Profile = typeof profiles.$inferSelect;
export type ProfileRole = Profile['role'];
