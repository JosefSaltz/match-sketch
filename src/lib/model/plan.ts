import { z } from 'zod';

export const SYMBOL_SIZES = ['small', 'medium', 'large'] as const;
export type SymbolSize = (typeof SYMBOL_SIZES)[number];

/** Fixed on-screen size of symbol glyphs, in px. */
export const SYMBOL_PX: Record<SymbolSize, number> = { small: 24, medium: 32, large: 44 };

const finite = z.number().refine(Number.isFinite, 'Must be a finite number');

export const PlanObjectSchema = z.object({
	id: z.uuid(),
	symbolId: z.string().min(1),
	x: finite,
	y: finite,
	rotation: finite.refine((r) => r >= 0 && r < 360, 'Rotation must be in [0, 360)'),
	label: z.string().max(24).optional(),
	count: z.int().min(1).max(99).optional(),
	widthFt: finite.refine((v) => v > 0, 'Must be positive').optional(),
	depthFt: finite.refine((v) => v > 0, 'Must be positive').optional(),
	z: z.int()
});
export type PlanObject = z.infer<typeof PlanObjectSchema>;

export const StageBriefSchema = z.object({
	matchName: z.string(),
	stageNumber: z.string(),
	stageName: z.string(),
	startPosition: z.string(),
	gunReady: z.string(),
	procedure: z.string(),
	roundCount: z.string(),
	parTime: z.string(),
	targetsOverride: z.string().nullable(),
	notes: z.array(z.object({ id: z.string(), title: z.string(), body: z.string() }))
});
export type StageBrief = z.infer<typeof StageBriefSchema>;

export const ScaleBreakSchema = z
	.object({ fromFt: finite, toFt: finite })
	.refine((b) => b.fromFt < b.toFt, 'A scale break must start before it ends');
export type ScaleBreak = z.infer<typeof ScaleBreakSchema>;

export const PlanDisplaySchema = z.object({
	snap: z.enum(['off', '1ft', '1yd', '5yd']),
	symbolSize: z.enum(SYMBOL_SIZES),
	showGrid: z.boolean()
});
export type PlanDisplay = z.infer<typeof PlanDisplaySchema>;

export const PlanDocumentSchema = z.object({
	brief: StageBriefSchema,
	objects: z.array(PlanObjectSchema),
	// Plan 2 defines annotations (text, arrows, measure lines); empty until then.
	annotations: z.array(z.unknown()).max(0),
	scaleBreaks: z.array(ScaleBreakSchema),
	display: PlanDisplaySchema
});
export type PlanDocument = z.infer<typeof PlanDocumentSchema>;

export function emptyPlanDocument(): PlanDocument {
	return {
		brief: {
			matchName: '',
			stageNumber: '',
			stageName: '',
			startPosition: '',
			gunReady: '',
			procedure: '',
			roundCount: '',
			parTime: '',
			targetsOverride: null,
			notes: []
		},
		objects: [],
		annotations: [],
		scaleBreaks: [],
		display: { snap: '1ft', symbolSize: 'medium', showGrid: true }
	};
}
