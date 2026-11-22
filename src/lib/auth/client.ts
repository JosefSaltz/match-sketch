import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '$app/env/public';

let client: SupabaseClient | undefined;

/** The browser's Supabase client. It keeps the session in cookies, which the server reads too. */
export function getSupabase(): SupabaseClient {
	client ??= createBrowserClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
	return client;
}
