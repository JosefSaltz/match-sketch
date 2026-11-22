/**
 * Creates and promotes users through the admin API (dev and tests; never in the app).
 *
 *   pnpm users:promote <email>     make an existing user an admin (local stack)
 *
 * Reads SUPABASE_URL, SUPABASE_SECRET_KEY and DATABASE_URL from the environment.
 */
import { createClient } from '@supabase/supabase-js';
import postgres from 'postgres';

export type Role = 'md' | 'admin';

function env(name: string): string {
	const value = process.env[name];
	if (!value) throw new Error(`${name} is not set`);
	return value;
}

/**
 * Dev and test users have known passwords, so this script only touches the local stack (the
 * tests' guard is src/lib/server/testing/local-only.ts; Node can't import app modules here).
 */
function localUrl(name: string): string {
	const url = env(name);
	const { hostname } = new URL(url);
	if (!['127.0.0.1', 'localhost', '[::1]'].includes(hostname)) {
		throw new Error(`scripts/users.ts only runs against the local stack, not ${hostname}`);
	}
	return url;
}

function adminClient() {
	return createClient(localUrl('SUPABASE_URL'), env('SUPABASE_SECRET_KEY'), {
		auth: { persistSession: false, autoRefreshToken: false }
	});
}

async function setRole(sql: postgres.Sql, filter: { id: string } | { email: string }, role: Role) {
	const rows =
		'id' in filter
			? await sql`update public.profiles set role = ${role} where id = ${filter.id} returning id`
			: await sql`update public.profiles set role = ${role}
				where id = (select id from auth.users where email = ${filter.email}) returning id`;
	if (rows.length === 0) throw new Error('No profile found for that user');
}

/** Creates the user (or resets their password) with a confirmed email and `role`; returns the id. */
export async function ensureUser(user: {
	email: string;
	password: string;
	role: Role;
	displayName?: string;
}): Promise<string> {
	const admin = adminClient();
	const metadata = user.displayName ? { display_name: user.displayName } : {};
	const created = await admin.auth.admin.createUser({
		email: user.email,
		password: user.password,
		email_confirm: true,
		user_metadata: metadata
	});
	let id = created.data.user?.id;
	if (!id) {
		if (created.error?.code !== 'email_exists')
			throw created.error ?? new Error('createUser failed');
		const sql = postgres(localUrl('DATABASE_URL'), { max: 1 });
		try {
			const [row] = await sql<
				{ id: string }[]
			>`select id from auth.users where email = ${user.email}`;
			id = row.id;
		} finally {
			await sql.end();
		}
		const { error } = await admin.auth.admin.updateUserById(id, { password: user.password });
		if (error) throw error;
	}
	const sql = postgres(localUrl('DATABASE_URL'), { max: 1 });
	try {
		await setRole(sql, { id }, user.role);
	} finally {
		await sql.end();
	}
	return id;
}

if (import.meta.main) {
	const [command, email] = process.argv.slice(2);
	if (command !== 'promote' || !email) {
		console.error('Usage: node scripts/users.ts promote <email>');
		process.exit(2);
	}
	const sql = postgres(localUrl('DATABASE_URL'), { max: 1 });
	try {
		await setRole(sql, { email }, 'admin');
		console.log(`${email} is now an admin.`);
	} finally {
		await sql.end();
	}
}
