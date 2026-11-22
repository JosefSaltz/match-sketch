import { describe, expect, it } from 'vitest';
import { syncLabel } from './status';

const calm = { online: true, syncing: false, pending: 0, conflicts: 0, failed: false };

describe('syncLabel', () => {
	it.each([
		[{}, 'Synced'],
		[{ pending: 2 }, 'Changes pending'],
		[{ failed: true, pending: 1 }, 'Sync failed'],
		[{ syncing: true, failed: true }, 'Syncing…'],
		[{ online: false, syncing: true, pending: 3 }, 'Offline'],
		[{ conflicts: 1, online: false }, 'Conflict']
	] as const)('%o reads %s', (overrides, label) => {
		expect(syncLabel({ ...calm, ...overrides })).toBe(label);
	});
});
