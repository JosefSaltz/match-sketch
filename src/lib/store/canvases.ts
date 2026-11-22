import type { MatchSketchDB } from './db';
import {
	CanvasInputSchema,
	newSyncMeta,
	now,
	type CanvasInput,
	type CanvasRecord
} from './records';

export async function listCanvases(db: MatchSketchDB): Promise<CanvasRecord[]> {
	const all = await db.canvases.toArray();
	return all
		.filter((c) => c.deletedAt === null)
		.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}

export async function createCanvas(db: MatchSketchDB, input: CanvasInput): Promise<CanvasRecord> {
	const record: CanvasRecord = { ...newSyncMeta(), ...CanvasInputSchema.parse(input) };
	await db.canvases.add(record);
	return record;
}

export async function updateCanvas(
	db: MatchSketchDB,
	id: string,
	input: CanvasInput
): Promise<CanvasRecord> {
	const changes = CanvasInputSchema.parse(input);
	const existing = await db.canvases.get(id);
	if (!existing || existing.deletedAt) throw new Error(`Canvas ${id} not found`);
	const record: CanvasRecord = { ...existing, ...changes, updatedAt: now(), dirty: 1 };
	await db.canvases.put(record);
	return record;
}

export async function deleteCanvas(db: MatchSketchDB, id: string): Promise<void> {
	const stamp = now();
	await db.canvases.update(id, { deletedAt: stamp, updatedAt: stamp, dirty: 1 });
}
