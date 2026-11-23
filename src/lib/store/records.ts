import { z } from 'zod';
import type { LengthUnit } from '../geometry/units';
import type { PLAN_SCHEMA_VERSION, PlanDocument } from '../model/plan';

/** Fields every user-editable record carries so it can sync later (Plan 5). */
export type SyncMeta = {
	id: string;
	/** Server version; 0 = never synced. */
	version: number;
	updatedAt: string;
	deletedAt: string | null;
	/** 1 = has local changes not yet synced. Numeric so IndexedDB can index it. */
	dirty: 0 | 1;
};

export type CanvasRecord = SyncMeta & {
	name: string;
	widthFt: number;
	depthFt: number;
	unit: LengthUnit;
};

export type PlanRecord = SyncMeta & {
	matchId: string | null;
	stageOrder: number | null;
	sourceCanvasId: string | null;
	widthFt: number;
	depthFt: number;
	unit: LengthUnit;
	schemaVersion: typeof PLAN_SCHEMA_VERSION;
	document: PlanDocument;
};

/** A match groups stage plans; its plans point at it with `matchId` and are ordered by `stageOrder`. */
export type MatchRecord = SyncMeta & {
	name: string;
	/** `YYYY-MM-DD`, or '' when the match has no date yet. */
	date: string;
};

export const MatchInputSchema = z.object({
	name: z.string().trim().min(1).max(80),
	date: z.union([z.literal(''), z.iso.date()])
});
export type MatchInput = z.infer<typeof MatchInputSchema>;

export const MIN_CANVAS_FT = 3;
export const MAX_CANVAS_FT = 3000;

const dimension = z.number().min(MIN_CANVAS_FT).max(MAX_CANVAS_FT);

export const CanvasInputSchema = z.object({
	name: z.string().trim().min(1).max(80),
	widthFt: dimension,
	depthFt: dimension,
	unit: z.enum(['ft', 'yd'])
});
export type CanvasInput = z.infer<typeof CanvasInputSchema>;

let lastTimestamp = 0;

/** Monotonic ISO timestamp: never repeats or goes backwards within this session. */
export function now(): string {
	const t = Math.max(Date.now(), lastTimestamp + 1);
	lastTimestamp = t;
	return new Date(t).toISOString();
}

export function newSyncMeta(): SyncMeta {
	return { id: crypto.randomUUID(), version: 0, updatedAt: now(), deletedAt: null, dirty: 1 };
}

/**
 * The stage number to show: the one typed in the brief, else the plan's 1-based place in its
 * match's order (`matchOrder`: plan ids in stage order), else ''.
 */
export function effectiveStageNumber(
	plan: Pick<PlanRecord, 'id' | 'document'>,
	matchOrder: string[] | null
): string {
	const typed = plan.document.brief.stageNumber.trim();
	if (typed) return typed;
	const i = matchOrder ? matchOrder.indexOf(plan.id) : -1;
	return i >= 0 ? String(i + 1) : '';
}

export function planTitle(
	plan: Pick<PlanRecord, 'document'>,
	stageNumber: string = plan.document.brief.stageNumber
): string {
	const n = stageNumber.trim();
	const name = plan.document.brief.stageName.trim();
	if (n && name) return `Stage ${n} — ${name}`;
	if (n) return `Stage ${n}`;
	return name || 'Untitled stage';
}
