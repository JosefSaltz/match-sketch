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

/** What the shooter does with an object in a walkthrough step (spec §7.10), in legend order. */
export const MEANINGS = ['start', 'move', 'shoot', 'activate', 'avoid'] as const;
export type Meaning = (typeof MEANINGS)[number];

export const MarkSchema = z.object({ objectId: z.uuid(), meaning: z.enum(MEANINGS) });
export type Mark = z.infer<typeof MarkSchema>;

/** One line of the stage procedure, with what its walkthrough step highlights. */
export const StepSchema = z.object({
	id: z.uuid(),
	text: z.string().max(2000),
	marks: z.array(MarkSchema).max(200),
	arrows: z.array(z.uuid()).max(200)
});
export type Step = z.infer<typeof StepSchema>;

export const StageBriefSchema = z.object({
	matchName: z.string(),
	stageNumber: z.string(),
	stageName: z.string(),
	startPosition: z.string(),
	gunReady: z.string(),
	/** The stage procedure, one step per line (spec §7.2, §7.10). */
	steps: z.array(StepSchema).max(500),
	roundCount: z.string(),
	parTime: z.string(),
	targetsOverride: z.string().nullable(),
	notes: z.array(z.object({ id: z.string(), title: z.string(), body: z.string() }))
});
export type StageBrief = z.infer<typeof StageBriefSchema>;

/** Where an end of an arrow or measure line sits: on an object (follows it) or a fixed point. */
export const AnchorSchema = z.discriminatedUnion('kind', [
	z.object({ kind: z.literal('object'), objectId: z.uuid() }),
	z.object({ kind: z.literal('point'), x: finite, y: finite })
]);
export type Anchor = z.infer<typeof AnchorSchema>;

const link = { id: z.uuid(), from: AnchorSchema, to: AnchorSchema };

/** Text labels, movement arrows and measure lines, drawn at a fixed size (spec §7.3). */
export const AnnotationSchema = z.discriminatedUnion('type', [
	z.object({
		id: z.uuid(),
		type: z.literal('text'),
		x: finite,
		y: finite,
		text: z.string().min(1).max(200)
	}),
	z.object({ type: z.literal('arrow'), ...link }),
	z.object({ type: z.literal('measure'), ...link })
]);
export type Annotation = z.infer<typeof AnnotationSchema>;
export type TextAnnotation = Extract<Annotation, { type: 'text' }>;
export type LinkAnnotation = Extract<Annotation, { type: 'arrow' | 'measure' }>;

export const ScaleBreakSchema = z
	.object({ fromFt: finite, toFt: finite })
	.refine((b) => b.fromFt < b.toFt, 'A scale break must start before it ends');
export type ScaleBreak = z.infer<typeof ScaleBreakSchema>;

export const PlanDisplaySchema = z.object({
	snap: z.enum(['off', '1ft', '1yd', '5yd']),
	symbolSize: z.enum(SYMBOL_SIZES),
	showGrid: z.boolean(),
	/** Guide lines every this many feet, labelled with distances; absent = the fine grid. */
	gridFt: finite.refine((v) => v > 0, 'Must be positive').optional()
});
export type PlanDisplay = z.infer<typeof PlanDisplaySchema>;

/** The plan document version `PlanDocumentSchema` describes (`plans.schema_version`). */
export const PLAN_SCHEMA_VERSION = 2;

export const PlanDocumentSchema = z.object({
	brief: StageBriefSchema,
	objects: z.array(PlanObjectSchema),
	annotations: z.array(AnnotationSchema),
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
			steps: [],
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
