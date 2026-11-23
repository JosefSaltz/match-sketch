import { z } from 'zod';
import { StageBriefSchema, SYMBOL_SIZES, type StageBrief } from '../model/plan';
import { procedureText } from '../model/procedure';

/**
 * What Claude returns for a draft (spec §7.5 step 3). Kept loose for structured output; the
 * rules (known symbols, on the bay, sizes, unique labels) live in validatePlacements.
 */
export const DraftPlacementSchema = z.object({
	symbolId: z.string(),
	x: z.number(),
	y: z.number(),
	rotation: z.number(),
	label: z.string().nullable(),
	count: z.int().nullable(),
	widthFt: z.number().nullable(),
	depthFt: z.number().nullable()
});
export type DraftPlacement = z.infer<typeof DraftPlacementSchema>;

export const DraftOutputSchema = z.object({
	placements: z.array(DraftPlacementSchema),
	/** Things in the description the catalog can't draw, in the MD's words. */
	unrepresentable: z.array(z.string())
});
export type DraftOutput = z.infer<typeof DraftOutputSchema>;

/** A placement that passed validation: ready to become a plan object. */
export type Placement = {
	symbolId: string;
	x: number;
	y: number;
	rotation: number;
	label?: string;
	count?: number;
	widthFt?: number;
	depthFt?: number;
};

/** Longest text field sent to the model; the procedure and notes are the long ones. */
const MAX_FIELD = 4000;
const field = z.string().max(MAX_FIELD);

/**
 * The brief as a draft request may carry it: every field the prompt uses is bounded, so one
 * request can't send an arbitrarily large (and expensive) prompt. The procedure goes as its text;
 * the model never sees the steps' ids or highlights.
 */
const DraftBriefSchema = StageBriefSchema.omit({ steps: true }).extend({
	matchName: z.string().max(200),
	stageNumber: z.string().max(20),
	stageName: z.string().max(200),
	startPosition: field,
	gunReady: field,
	procedure: field,
	roundCount: z.string().max(500),
	parTime: z.string().max(200),
	targetsOverride: z.string().max(500).nullable(),
	notes: z
		.array(z.object({ id: z.string().max(100), title: z.string().max(200), body: field }))
		.max(10)
});

export const DraftRequestSchema = z.object({
	planId: z.uuid(),
	description: z.string().trim().min(1).max(MAX_FIELD),
	brief: DraftBriefSchema,
	canvas: z.object({
		widthFt: z.number().positive(),
		depthFt: z.number().positive(),
		unit: z.enum(['ft', 'yd'])
	}),
	symbolSize: z.enum(SYMBOL_SIZES)
});
export type DraftRequest = z.infer<typeof DraftRequestSchema>;

/** The brief as a draft request carries it. */
export function draftBrief(brief: StageBrief): DraftRequest['brief'] {
	const { steps, ...rest } = brief;
	return { ...rest, procedure: procedureText(steps) };
}

export type DraftStatus = 'ok' | 'repaired' | 'partial' | 'failed' | 'refused';

export type DraftResult = {
	status: DraftStatus;
	objects: Placement[];
	unrepresentable: string[];
	/** Placements that still failed after the repair round, and why. */
	dropped: { what: string; reason: string }[];
};
