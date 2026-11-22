export type SyncLabel =
	'Synced' | 'Syncing…' | 'Changes pending' | 'Offline' | 'Conflict' | 'Sync failed';

/** What the sync indicator says (spec §7.1). A conflict outranks everything until dismissed. */
export function syncLabel(s: {
	online: boolean;
	syncing: boolean;
	pending: number;
	conflicts: number;
	failed: boolean;
}): SyncLabel {
	if (s.conflicts > 0) return 'Conflict';
	if (!s.online) return 'Offline';
	if (s.syncing) return 'Syncing…';
	if (s.failed) return 'Sync failed';
	if (s.pending > 0) return 'Changes pending';
	return 'Synced';
}
