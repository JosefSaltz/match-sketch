import { newShareId, type Share } from '../model/share';
import type { MatchSketchDB } from './db';
import { StalePlanError } from './plans';
import { now, type MatchRecord, type PlanRecord } from './records';

export type ShareAction = 'on' | 'off' | 'reset';

/**
 * The share after an action (spec §7.11): turning it on keeps the link if there is one, turning
 * it off keeps the link for later, and a reset makes a new link that stays on.
 */
export function nextShare(current: Share | null, action: ShareAction): Share {
	switch (action) {
		case 'on':
			return { id: current?.id ?? newShareId(), on: true };
		case 'off':
			return { id: current?.id ?? newShareId(), on: false };
		case 'reset':
			return { id: newShareId(), on: current?.on ?? true };
	}
}

/**
 * Saves a plan's share; `at` is when the change was made. With `expectedUpdatedAt`, it saves only
 * if the stored plan is still that version (else `StalePlanError`), like `savePlanDocument`.
 */
export async function savePlanShare(
	db: MatchSketchDB,
	id: string,
	share: Share,
	at: string = now(),
	expectedUpdatedAt?: string
): Promise<PlanRecord> {
	return db.transaction('rw', db.plans, async () => {
		const current = await db.plans.get(id);
		if (!current || current.deletedAt !== null) throw new StalePlanError(id);
		if (expectedUpdatedAt !== undefined && current.updatedAt !== expectedUpdatedAt) {
			throw new StalePlanError(id);
		}
		const saved: PlanRecord = { ...current, share, updatedAt: at, dirty: 1 };
		await db.plans.put(saved);
		return saved;
	});
}

export async function saveMatchShare(
	db: MatchSketchDB,
	id: string,
	share: Share
): Promise<MatchRecord> {
	return db.transaction('rw', db.matches, async () => {
		const current = await db.matches.get(id);
		if (!current || current.deletedAt !== null) throw new Error(`Match ${id} not found`);
		const saved: MatchRecord = { ...current, share, updatedAt: now(), dirty: 1 };
		await db.matches.put(saved);
		return saved;
	});
}
