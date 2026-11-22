import { z } from 'zod';
import { StageBriefSchema, SYMBOL_SIZES } from '../model/plan';

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

export const DraftRequestSchema = z.object({
	planId: z.uuid(),
	description: z.string().trim().min(1).max(4000),
	brief: StageBriefSchema,
	canvas: z.object({
		widthFt: z.number().positive(),
		depthFt: z.number().positive(),
		unit: z.enum(['ft', 'yd'])
	}),
	symbolSize: z.enum(SYMBOL_SIZES)
});
export type DraftRequest = z.infer<typeof DraftRequestSchema>;

export type DraftStatus = 'ok' | 'repaired' | 'partial' | 'failed' | 'refused';

export type DraftResult = {
	status: DraftStatus;
	objects: Placement[];
	unrepresentable: string[];
	/** Placements that still failed after the repair round, and why. */
	dropped: { what: string; reason: string }[];
};
