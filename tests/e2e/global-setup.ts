import { ensureUser } from '../../scripts/users';
import { ADMIN, MD } from './support/accounts';

/** Checks the local Supabase stack is up and creates the test accounts. */
export default async function globalSetup(): Promise<void> {
	const url = process.env.SUPABASE_URL;
	const key = process.env.SUPABASE_PUBLISHABLE_KEY;
	const up =
		url && key
			? await fetch(`${url}/auth/v1/health`, { headers: { apikey: key } }).then(
					(r) => r.ok,
					() => false
				)
			: false;
	if (!up) {
		throw new Error('Start the local stack: pnpm db:start (then run e2e with pnpm test:e2e)');
	}
	await ensureUser({ ...MD, role: 'md', displayName: 'Test MD' });
	await ensureUser({ ...ADMIN, role: 'admin', displayName: 'Test Admin' });
}
