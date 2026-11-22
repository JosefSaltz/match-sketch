import { sql } from 'drizzle-orm';
import {
	type AnyPgColumn,
	bigint,
	doublePrecision,
	index,
	integer,
	jsonb,
	pgEnum,
	pgPolicy,
	pgSequence,
	pgTable,
	text,
	timestamp,
	uuid
} from 'drizzle-orm/pg-core';
import type { PlanDocument } from '../../model/plan';
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

/**
 * Stamps every write to a synced table; a client pulls the rows with `change_seq` above its
 * cursor. Updates get a new value from the `bump_change_seq` trigger (custom migration).
 */
export const syncChangeSeq = pgSequence('sync_change_seq');

export const lengthUnit = pgEnum('length_unit', ['ft', 'yd']);

/**
 * Columns every synced record has (spec §7.8). Ids come from the client, so records can be
 * created offline. `updatedAt` is when the edit was made, on the device that made it.
 */
const syncColumns = () => ({
	id: uuid().primaryKey(),
	ownerId: uuid('owner_id')
		.notNull()
		.references(() => authUsers.id, { onDelete: 'cascade' }),
	version: integer().notNull(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
	deletedAt: timestamp('deleted_at', { withTimezone: true }),
	changeSeq: bigint('change_seq', { mode: 'number' })
		.notNull()
		.default(sql`nextval('sync_change_seq')`)
});

/** Owners read their own rows if the Data API is ever granted access (it isn't today). */
const syncPolicies = (name: string, t: { ownerId: AnyPgColumn; changeSeq: AnyPgColumn }) => [
	pgPolicy(`${name}_select_own`, {
		for: 'select',
		to: authenticatedRole,
		using: sql`(select auth.uid()) = ${t.ownerId}`
	}),
	index(`${name}_owner_change_seq`).on(t.ownerId, t.changeSeq)
];

export const canvases = pgTable(
	'canvases',
	{
		...syncColumns(),
		name: text().notNull(),
		widthFt: doublePrecision('width_ft').notNull(),
		depthFt: doublePrecision('depth_ft').notNull(),
		unit: lengthUnit().notNull()
	},
	(t) => syncPolicies('canvases', t)
);

export const matches = pgTable(
	'matches',
	{
		...syncColumns(),
		name: text().notNull(),
		/** `YYYY-MM-DD`, or '' when the match has no date yet (as on the device). */
		date: text().notNull()
	},
	(t) => syncPolicies('matches', t)
);

/** No foreign keys between synced records: offline devices push them in any order. */
export const plans = pgTable(
	'plans',
	{
		...syncColumns(),
		matchId: uuid('match_id'),
		stageOrder: integer('stage_order'),
		sourceCanvasId: uuid('source_canvas_id'),
		widthFt: doublePrecision('width_ft').notNull(),
		depthFt: doublePrecision('depth_ft').notNull(),
		unit: lengthUnit().notNull(),
		schemaVersion: integer('schema_version').notNull(),
		document: jsonb().$type<PlanDocument>().notNull()
	},
	(t) => syncPolicies('plans', t)
);
