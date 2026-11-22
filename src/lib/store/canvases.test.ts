import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { createDb, type MatchSketchDB } from './db';
import { createCanvas, deleteCanvas, listCanvases } from './canvases';

let db: MatchSketchDB;
beforeEach(() => {
	db = createDb(`test-${crypto.randomUUID()}`);
});

describe('canvas repository', () => {
	it('creates canvases with sync fields and lists them by name', async () => {
		const c = await createCanvas(db, { name: 'Bay B', widthFt: 150, depthFt: 75, unit: 'yd' });
		expect(c).toMatchObject({ version: 0, dirty: 1, deletedAt: null, name: 'Bay B' });
		expect(c.id).toMatch(/^[0-9a-f-]{36}$/);
		await createCanvas(db, { name: 'Bay A', widthFt: 30, depthFt: 30, unit: 'ft' });
		expect((await listCanvases(db)).map((x) => x.name)).toEqual(['Bay A', 'Bay B']);
	});

	it('rejects bad dimensions and blank names', async () => {
		// Review Focus #3
		for (const bad of [0, -1, Number.NaN, 3001]) {
			await expect(
				createCanvas(db, { name: 'X', widthFt: bad, depthFt: 30, unit: 'ft' })
			).rejects.toThrow();
		}
		await expect(
			createCanvas(db, { name: '   ', widthFt: 30, depthFt: 30, unit: 'ft' })
		).rejects.toThrow();
		expect(await listCanvases(db)).toEqual([]);
	});

	it('soft-deletes so the deletion can sync later', async () => {
		const c = await createCanvas(db, { name: 'Bay B', widthFt: 150, depthFt: 75, unit: 'yd' });
		await createCanvas(db, { name: 'Bay A', widthFt: 30, depthFt: 30, unit: 'ft' });
		await deleteCanvas(db, c.id);
		expect((await listCanvases(db)).map((x) => x.name)).toEqual(['Bay A']);
		expect((await db.canvases.get(c.id))?.deletedAt).not.toBeNull();
	});
});
