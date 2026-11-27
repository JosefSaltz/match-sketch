/**
 * Local dev only: `pnpm dev:no-auth` opens app pages without signing in, so the editor can be
 * tried without the Supabase stack. A build never honors the flag (`dev` is false there).
 */
export function authBypassed({ dev, flag }: { dev: boolean; flag: boolean }): boolean {
	return dev && flag;
}

/**
 * The account app pages see while sign-in is skipped. No id, so sync never starts: data stays in
 * this browser's local database.
 */
export const DEV_ACCOUNT: { id: string | null; email: string | null } = {
	id: null,
	email: 'Sign-in skipped (local dev)'
};
