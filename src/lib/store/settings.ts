import type { MatchSketchDB } from './db';
import { now } from './records';

/** The app theme chosen on this device (a theme id). */
export const THEME_SETTING = 'theme';

export async function getSetting(db: MatchSketchDB, key: string): Promise<string | undefined> {
	return (await db.settings.get(key))?.value;
}

export async function setSetting(db: MatchSketchDB, key: string, value: string): Promise<void> {
	await db.settings.put({ key, value, updatedAt: now() });
}
