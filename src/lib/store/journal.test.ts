import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { emptyPlanDocument, type PlanDocument } from '../model/plan';
import { createCanvas } from './canvases';
import { createDb, type MatchSketchDB } from './db';
import {
	clearJournal,
	journalKey,
	readNewerJournal,
	recoverUnsavedEdits,
	writeJournal,
	type StorageLike
} from './journal';
import { createPlan, getPlan } from './plans';

function memoryStorage(): StorageLike & { map: Map<string, string> } {
	const map = new Map<string, string>();
	return {
		map,
		getItem: (k) => map.get(k) ?? null,
		setItem: (k, v) => void map.set(k, v),
		removeItem: (k) => void map.delete(k)
	};
}

const docWith = (stageName: string): PlanDocument => {
	const d = emptyPlanDocument();
	return { ...d, brief: { ...d.brief, stageName } };
};

describe('unsaved-edit journal', () => {
	it('returns an entry written after the last save', () => {
		const s = memoryStorage();
		writeJournal(s, 'p1', docWith('Gauntlet'), '2026-11-21T10:00:01.000Z');
		expect(readNewerJournal(s, 'p1', '2026-11-21T10:00:00.000Z')?.brief.stageName).toBe('Gauntlet');
	});

	it('drops an entry the saved plan already covers', () => {
		const s = memoryStorage();
		writeJournal(s, 'p1', docWith('Old'), '2026-11-21T10:00:00.000Z');
		expect(readNewerJournal(s, 'p1', '2026-11-21T10:00:00.000Z')).toBeNull();
		expect(s.map.has(journalKey('p1'))).toBe(false);
	});

	it('drops entries that are not valid documents', () => {
		const s = memoryStorage();
		s.setItem(journalKey('p1'), '{not json');
		expect(readNewerJournal(s, 'p1', '2000-01-01T00:00:00.000Z')).toBeNull();
		s.setItem(journalKey('p1'), JSON.stringify({ at: '2999-01-01T00:00:00.000Z', document: {} }));
		expect(readNewerJournal(s, 'p1', '2000-01-01T00:00:00.000Z')).toBeNull();
		expect(s.map.has(journalKey('p1'))).toBe(false);
	});

	it('never throws when storage is full or unavailable', () => {
		const full: StorageLike = {
			getItem: () => null,
			setItem: () => {
				throw new Error('QuotaExceededError');
			},
			removeItem: () => {}
		};
		expect(() => writeJournal(full, 'p1', docWith('x'))).not.toThrow();
	});

	it('clears an entry', () => {
		const s = memoryStorage();
		writeJournal(s, 'p1', docWith('x'));
		clearJournal(s, 'p1');
		expect(s.map.size).toBe(0);
	});
});

describe('recoverUnsavedEdits', () => {
	let db: MatchSketchDB;
	beforeEach(() => {
		db = createDb(`test-${crypto.randomUUID()}`);
	});

	it('saves a newer journal entry into the plan and clears it', async () => {
		const bay = await createCanvas(db, { name: 'Bay A', widthFt: 150, depthFt: 75, unit: 'yd' });
		const plan = await createPlan(db, { canvas: bay, sourceCanvasId: bay.id });
		const s = memoryStorage();
		writeJournal(s, plan.id, docWith('Recovered'), '2999-01-01T00:00:00.000Z');
		const recovered = await recoverUnsavedEdits(db, s, plan);
		expect(recovered.document.brief.stageName).toBe('Recovered');
		expect((await getPlan(db, plan.id))?.document.brief.stageName).toBe('Recovered');
		expect(s.map.size).toBe(0);
	});

	it('leaves the plan alone when there is nothing newer', async () => {
		const bay = await createCanvas(db, { name: 'Bay A', widthFt: 150, depthFt: 75, unit: 'yd' });
		const plan = await createPlan(db, { canvas: bay, sourceCanvasId: bay.id });
		const s = memoryStorage();
		expect(await recoverUnsavedEdits(db, s, plan)).toBe(plan);
	});
});
