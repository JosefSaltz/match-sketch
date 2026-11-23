import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_URL } from '$app/env/public';
import { SUPABASE_SECRET_KEY } from '$app/env/private';

let client: SupabaseClient | undefined;

/** The auth admin API with the secret key. Server only: it bypasses RLS. */
export function adminClient(): SupabaseClient {
	client ??= createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
		auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
	});
	return client;
}
