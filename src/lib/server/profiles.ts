import { asc, eq } from 'drizzle-orm';
import type { Database } from './db/client';
import { profiles, type Profile, type ProfileRole } from './db/schema';

export async function getProfile(db: Database, id: string): Promise<Profile | null> {
	const [row] = await db.select().from(profiles).where(eq(profiles.id, id)).limit(1);
	return row ?? null;
}

export async function listProfiles(db: Database): Promise<Profile[]> {
	return db.select().from(profiles).orderBy(asc(profiles.createdAt));
}

export async function setRole(db: Database, id: string, role: ProfileRole): Promise<void> {
	await db.update(profiles).set({ role }).where(eq(profiles.id, id));
}
