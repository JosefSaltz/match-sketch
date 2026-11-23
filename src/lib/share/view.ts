import { z } from 'zod';
import { PlanDocumentSchema } from '../model/plan';

/**
 * What a share link shows (spec §7.11): only what a viewer needs to see and print the stage,
 * never the owner, versions or the source canvas.
 */
export const SharedPlanSchema = z.object({
	id: z.uuid(),
	widthFt: z.number(),
	depthFt: z.number(),
	unit: z.enum(['ft', 'yd']),
	/** The typed stage number, else the stage's place in its match. */
	stageNumber: z.string(),
	document: PlanDocumentSchema
});
export type SharedPlan = z.infer<typeof SharedPlanSchema>;

export const SharedViewSchema = z.discriminatedUnion('kind', [
	z.object({
		kind: z.literal('plan'),
		plan: SharedPlanSchema,
		/** The plan's match if it has one, else the match name typed in its brief. */
		matchName: z.string(),
		date: z.string()
	}),
	z.object({
		kind: z.literal('match'),
		match: z.object({ name: z.string(), date: z.string() }),
		plans: z.array(SharedPlanSchema)
	})
]);
export type SharedView = z.infer<typeof SharedViewSchema>;
