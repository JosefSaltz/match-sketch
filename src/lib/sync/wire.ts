import { z } from 'zod';
import { PlanDocumentSchema } from '../model/plan';
import {
	CanvasInputSchema,
	MatchInputSchema,
	type CanvasRecord,
	type MatchRecord,
	type PlanRecord
} from '../store/records';

/**
 * The sync wire format, shared by the client and the server (spec §7.8, §7.9). Records travel
 * as the device stores them, minus `dirty`; the server owns `version` and the owner.
 */

export type SyncTable = 'canvases' | 'matches' | 'plans';
export const SYNC_TABLES: readonly SyncTable[] = ['canvases', 'matches', 'plans'];

/** The plan document schema this app understands. */
export const SUPPORTED_SCHEMA_VERSION = 1;

export const MAX_PUSH_RECORDS = 50;
export const MAX_PULL_RECORDS = 200;

const meta = {
	id: z.uuid(),
	updatedAt: z.iso.datetime(),
	deletedAt: z.iso.datetime().nullable()
};

const canvasFields = { ...meta, ...CanvasInputSchema.shape };
const matchFields = { ...meta, ...MatchInputSchema.shape };
const planFields = {
	...meta,
	matchId: z.uuid().nullable(),
	stageOrder: z.int().min(0).nullable(),
	sourceCanvasId: z.uuid().nullable(),
	widthFt: CanvasInputSchema.shape.widthFt,
	depthFt: CanvasInputSchema.shape.depthFt,
	unit: CanvasInputSchema.shape.unit
};

export const WireRecordSchema = z.discriminatedUnion('table', [
	z.object({ table: z.literal('canvases'), ...canvasFields }),
	z.object({ table: z.literal('matches'), ...matchFields }),
	z.object({
		table: z.literal('plans'),
		...planFields,
		schemaVersion: z.literal(SUPPORTED_SCHEMA_VERSION),
		document: PlanDocumentSchema
	})
]);
export type WireRecord = z.infer<typeof WireRecordSchema>;

const version = { version: z.int().min(1) };

/**
 * A record as the server has it. Plans are lenient about the schema version and document, so a
 * plan saved by a newer app is recognised (and left alone) instead of failing the whole pull.
 */
export const ServerRecordSchema = z.discriminatedUnion('table', [
	z.object({ table: z.literal('canvases'), ...canvasFields, ...version }),
	z.object({ table: z.literal('matches'), ...matchFields, ...version }),
	z.object({
		table: z.literal('plans'),
		...planFields,
		...version,
		schemaVersion: z.int().min(1),
		document: z.unknown()
	})
]);
export type ServerRecord = z.infer<typeof ServerRecordSchema>;

export const PushRequestSchema = z.object({
	records: z
		.array(z.object({ record: WireRecordSchema, baseVersion: z.int().min(0) }))
		.max(MAX_PUSH_RECORDS)
});
export type PushRequest = z.infer<typeof PushRequestSchema>;
export type PushItem = PushRequest['records'][number];

const table = z.enum(['canvases', 'matches', 'plans']);

export const PushResultSchema = z.discriminatedUnion('status', [
	z.object({ status: z.literal('accepted'), table, id: z.uuid(), version: z.int().min(1) }),
	z.object({ status: z.literal('conflict'), table, id: z.uuid(), server: ServerRecordSchema }),
	z.object({
		status: z.literal('rejected'),
		table,
		id: z.uuid(),
		reason: z.enum(['not-found', 'invalid'])
	})
]);
export type PushResult = z.infer<typeof PushResultSchema>;

export const PushResponseSchema = z.object({ results: z.array(PushResultSchema) });

export const PullResponseSchema = z.object({
	records: z.array(ServerRecordSchema),
	cursor: z.int().min(0),
	more: z.boolean()
});
export type PullResponse = z.infer<typeof PullResponseSchema>;

type LocalRecord = { canvases: CanvasRecord; matches: MatchRecord; plans: PlanRecord };

/** The record as it goes up: without `dirty` or `version`. */
export function toWire<T extends SyncTable>(table: T, record: LocalRecord[T]): WireRecord {
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	const { dirty, version, ...fields } = record;
	// `T` ties the table to its record type, which TypeScript can't follow through the spread.
	return { table, ...fields } as unknown as WireRecord;
}

function withoutTable<R extends { table: SyncTable }>(record: R): Omit<R, 'table'> {
	const { table, ...fields } = record;
	void table;
	return fields;
}

/** The device's copy of a server record (clean). Throws `newer-schema` for a newer plan. */
export function fromServer(record: ServerRecord): CanvasRecord | MatchRecord | PlanRecord {
	switch (record.table) {
		case 'canvases':
			return { ...withoutTable(record), dirty: 0 };
		case 'matches':
			return { ...withoutTable(record), dirty: 0 };
		case 'plans': {
			if (record.schemaVersion !== SUPPORTED_SCHEMA_VERSION) throw new Error('newer-schema');
			const document = PlanDocumentSchema.parse(record.document);
			return {
				...withoutTable(record),
				schemaVersion: SUPPORTED_SCHEMA_VERSION,
				document,
				dirty: 0
			};
		}
	}
}
