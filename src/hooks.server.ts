import { createServerClient } from '@supabase/ssr';
import type { Handle } from '@sveltejs/kit/hooks';
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '$app/env/public';

/**
 * A Supabase client per request, reading the session from the browser's cookies. Server code
 * verifies it with `getClaims()` (src/lib/server/auth.ts), never `getSession()`.
 */
export const handle: Handle = async ({ event, resolve }) => {
	event.locals.supabase = createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
		cookies: {
			getAll: () => event.cookies.getAll(),
			setAll: (cookiesToSet, headers) => {
				for (const { name, value, options } of cookiesToSet) {
					event.cookies.set(name, value, { ...options, path: '/' });
				}
				if (Object.keys(headers).length > 0) event.setHeaders(headers);
			}
		}
	});
	return resolve(event, {
		filterSerializedResponseHeaders: (name) =>
			name === 'content-range' || name === 'x-supabase-api-version'
	});
};
