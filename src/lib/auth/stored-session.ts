/**
 * Reads and clears the session @supabase/ssr's browser client keeps in cookies, without the
 * network. The cookie is `sb-<ref>-auth-token` (split into `.0`, `.1`, … when long), holding
 * `base64-` + base64url(JSON session).
 */

const AUTH_COOKIE = /^(sb-.+-auth-token)(?:\.(\d+))?$/;
const BASE64_PREFIX = 'base64-';

export type StoredAccount = { id: string; email: string | null };

function cookies(header: string): { name: string; value: string }[] {
	return header
		.split(';')
		.map((part) => part.trim())
		.filter(Boolean)
		.map((part) => {
			const eq = part.indexOf('=');
			return eq < 0
				? { name: part, value: '' }
				: { name: part.slice(0, eq), value: part.slice(eq + 1) };
		});
}

function authCookies(header: string) {
	return cookies(header).flatMap(({ name, value }) => {
		const match = AUTH_COOKIE.exec(name);
		return match ? [{ name, key: match[1], chunk: match[2] ? Number(match[2]) : -1, value }] : [];
	});
}

function decodeBase64Url(text: string): string {
	const base64 = text.replace(/-/g, '+').replace(/_/g, '/');
	const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
	return new TextDecoder().decode(bytes);
}

/** The signed-in account stored on this device, or `null`. */
export function readStoredAccount(cookieHeader: string): StoredAccount | null {
	const parts = authCookies(cookieHeader).sort((a, b) => a.chunk - b.chunk);
	if (parts.length === 0) return null;
	try {
		let value = parts.map((p) => decodeURIComponent(p.value)).join('');
		if (value.startsWith(BASE64_PREFIX)) value = decodeBase64Url(value.slice(BASE64_PREFIX.length));
		const session = JSON.parse(value) as { user?: { id?: unknown; email?: unknown } };
		const id = session.user?.id;
		if (typeof id !== 'string' || !id) return null;
		const email = session.user?.email;
		return { id, email: typeof email === 'string' ? email : null };
	} catch {
		return null;
	}
}

/** Expires every session cookie, for signing out when the client can't reach the server. */
export function clearStoredSession(doc: { cookie: string }): void {
	for (const { name } of authCookies(doc.cookie)) {
		doc.cookie = `${name}=; Max-Age=0; Path=/`;
	}
}
