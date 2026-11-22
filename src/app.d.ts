// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { createServerClient } from '@supabase/ssr';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			/** Per-request server client; verify the user with `getClaims()`. */
			supabase: ReturnType<typeof createServerClient>;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
