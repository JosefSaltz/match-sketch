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
	const env: Record<string, string> = {};
	for (const [field, name] of Object.entries(NAMES)) {
		if (status[field]) env[name] = status[field];
	}
	return env;
}

if (import.meta.main) {
	const [command, ...args] = process.argv.slice(2);
	if (!command) {
		console.error('Usage: node scripts/local-env.ts <command> [args...]');
		process.exit(2);
	}
	const child = spawn(command, args, {
		stdio: 'inherit',
		env: { ...localEnv(), ...process.env }
	});
	child.on('exit', (code, signal) => {
		if (signal) process.kill(process.pid, signal);
		process.exit(code ?? 1);
	});
}
