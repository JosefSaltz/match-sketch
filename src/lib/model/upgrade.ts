import { z } from 'zod';
import { PlanDocumentSchema, StageBriefSchema, type PlanDocument } from './plan';
import { stepsFromText } from './procedure';

/** Schema version 1: the procedure was one string (spec §7.2 before Plan 7). */
export const PlanDocumentV1Schema = PlanDocumentSchema.extend({
	brief: StageBriefSchema.omit({ steps: true }).extend({ procedure: z.string() })
});
export type PlanDocumentV1 = z.infer<typeof PlanDocumentV1Schema>;

/** A version 1 document as version 2: the procedure split into steps, one per line. */
export function upgradeV1(doc: PlanDocumentV1): PlanDocument {
	const { procedure, ...brief } = doc.brief;
	return { ...doc, brief: { ...brief, steps: stepsFromText([], procedure) } };
}

/** Either version of a plan document, parsed as version 2. */
export const AnyPlanDocumentSchema = z.union([
	PlanDocumentSchema,
	PlanDocumentV1Schema.transform(upgradeV1).pipe(PlanDocumentSchema)
]);

/**
 * A plan document from storage, the network or an older app: version 2 as it is, version 1
 * upgraded. Throws a ZodError when it is neither.
 */
export function readPlanDocument(document: unknown): PlanDocument {
	const v2 = PlanDocumentSchema.safeParse(document);
	if (v2.success) return v2.data;
	const v1 = PlanDocumentV1Schema.safeParse(document);
	if (v1.success) return PlanDocumentSchema.parse(upgradeV1(v1.data));
	throw v2.error;
}
