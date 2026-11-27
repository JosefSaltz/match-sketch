import { sql } from 'drizzle-orm';
import {
	type AnyPgColumn,
	bigint,
	boolean,
	doublePrecision,
	index,
	integer,
	jsonb,
	numeric,
	pgEnum,
	pgPolicy,
	pgSequence,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
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

/**
 * A record's read-only link (spec §7.11): the token is kept while sharing is off, so the same
 * link (and printed QR codes) work again when it is turned back on. Tokens are unique across
 * plans and matches; the server checks the other table on push.
 */
const shareColumns = () => ({
	shareId: text('share_id').unique(),
	shareOn: boolean('share_on').notNull().default(false)
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
		...shareColumns(),
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
		...shareColumns(),
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

/**
 * Every share token ever used, with the account that first used it. A token never moves to
 * another account, even after its record resets the link or is deleted, so a printed QR code
 * can't be taken over. No foreign key: a token outlives its account for the same reason.
 * Server only: RLS on, no policies, no grants.
 */
export const shareTokens = pgTable('share_tokens', {
	token: text().primaryKey(),
	ownerId: uuid('owner_id').notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
}).enableRLS();

export const draftStatus = pgEnum('draft_status', [
	/** Running: the row reserves the draft's worst-case cost until it is settled. */
	'pending',
	'ok',
	'repaired',
	'partial',
	'failed',
	'refused',
	'capped',
	'paused'
]);

/**
 * One row per "Draft from text" request (spec §7.5 step 6): for cost tracking, the per-user
 * daily cap and the site-wide spend ceiling. Server only: RLS on, no policies, no grants.
 */
export const aiDrafts = pgTable(
	'ai_drafts',
	{
		id: uuid().primaryKey().defaultRandom(),
		ownerId: uuid('owner_id')
			.notNull()
			.references(() => authUsers.id, { onDelete: 'cascade' }),
		planId: uuid('plan_id').notNull(),
		model: text().notNull(),
		status: draftStatus().notNull(),
		inputTokens: integer('input_tokens').notNull(),
		outputTokens: integer('output_tokens').notNull(),
		cacheReadTokens: integer('cache_read_tokens').notNull(),
		costUsd: numeric('cost_usd', { precision: 10, scale: 6, mode: 'number' }).notNull(),
		error: text(),
		request: jsonb().notNull(),
		response: jsonb().notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [
		index('ai_drafts_owner_created').on(t.ownerId, t.createdAt),
		index('ai_drafts_created').on(t.createdAt),
		// One running draft per user. (Created in its own migration: a new enum value can't be
		// used in the transaction that adds it.)
		uniqueIndex('ai_drafts_one_pending')
			.on(t.ownerId)
			.where(sql`${t.status} = 'pending'`)
	]
).enableRLS();
