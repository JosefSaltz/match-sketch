/**
 * Runs a command with the local Supabase stack's URLs and keys in its environment, so dev and
 * tests need no .env file: `node scripts/local-env.ts vitest --run`.
 *
 * Variables already set in the environment win, so a real .env (or CI env) overrides the stack.
 */
import { execFileSync, spawn } from 'node:child_process';

/** `supabase status -o json` field → the app's variable name (src/env.ts). */
const NAMES: Record<string, string> = {
	API_URL: 'SUPABASE_URL',
	PUBLISHABLE_KEY: 'SUPABASE_PUBLISHABLE_KEY',
	SECRET_KEY: 'SUPABASE_SECRET_KEY',
	DB_URL: 'DATABASE_URL',
	MAILPIT_URL: 'MAILPIT_URL'
};

/** The local stack's variables, renamed for the app; throws if the stack isn't running. */
export function localEnv(): Record<string, string> {
	let raw: string;
	try {
		raw = execFileSync('supabase', ['status', '-o', 'json'], {
			encoding: 'utf8',
			stdio: ['ignore', 'pipe', 'ignore']
		});
	} catch {
		throw new Error('The local Supabase stack is not running. Start it with: pnpm db:start');
	}
	const status = JSON.parse(raw.slice(raw.indexOf('{'))) as Record<string, string>;
	// Feature flags default on locally, so dev and the tests exercise them; export one to override.
	const env: Record<string, string> = { FEATURE_DRAFT_FROM_TEXT: 'true' };
	for (const [field, name] of Object.entries(NAMES)) {
		if (status[field]) env[name] = status[field];
	}
	return env;
}

/**
 * Stand-ins for `pnpm dev:no-auth` when the stack isn't running: enough for the app to start and
 * open the editor. Sign-in, sync, sharing and drafting don't work against them.
 */
const NO_STACK_ENV: Record<string, string> = {
	SUPABASE_URL: 'http://127.0.0.1:54321',
	SUPABASE_PUBLISHABLE_KEY: 'no-stack',
	SUPABASE_SECRET_KEY: 'no-stack',
	DATABASE_URL: 'postgres://postgres:postgres@127.0.0.1:54322/postgres',
	FEATURE_DRAFT_FROM_TEXT: 'false'
};

/** The stack's variables, or with sign-in skipped and no stack, stand-ins and a warning. */
function envForRun(): Record<string, string> {
	try {
		return localEnv();
	} catch (error) {
		if (process.env.DEV_SKIP_AUTH !== 'true') throw error;
		console.warn(
			'The local Supabase stack is not running: starting with sign-in skipped and stand-in settings. Sync, sharing and drafting will not work.'
		);
		return NO_STACK_ENV;
	}
}

if (import.meta.main) {
	const [command, ...args] = process.argv.slice(2);
	if (!command) {
		console.error('Usage: node scripts/local-env.ts <command> [args...]');
		process.exit(2);
	}
	const child = spawn(command, args, {
		stdio: 'inherit',
		env: { ...envForRun(), ...process.env }
	});
	child.on('exit', (code, signal) => {
		if (signal) process.kill(process.pid, signal);
		process.exit(code ?? 1);
	});
}
