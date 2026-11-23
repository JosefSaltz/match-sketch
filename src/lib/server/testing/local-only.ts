const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]']);

/**
 * `url` if it points at this machine. Tests create users with known passwords and admin roles,
 * so they refuse to run against anything but the local Supabase stack (spec §9).
 */
export function requireLocal(url: string | undefined): string {
	if (!url) throw new Error('Supabase env is not set; run tests with pnpm test:db or test:e2e');
	const { hostname } = new URL(url);
	if (!LOCAL_HOSTS.has(hostname)) {
		throw new Error(`Tests only run against the local Supabase stack, not ${hostname}`);
	}
	return url;
}
