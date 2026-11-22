/** Reads the local stack's Mailpit inbox (MAILPIT_URL, set by scripts/local-env.ts). */

type Summary = { ID: string };

function mailpit(): string {
	const url = process.env.MAILPIT_URL;
	if (!url) throw new Error('MAILPIT_URL is not set; run e2e with pnpm test:e2e');
	return url;
}

/** Messages sent to `address`, newest first. */
export async function messagesTo(address: string): Promise<Summary[]> {
	const query = encodeURIComponent(`to:"${address}"`);
	const res = await fetch(`${mailpit()}/api/v1/search?query=${query}`);
	if (!res.ok) throw new Error(`Mailpit search failed: ${res.status}`);
	return ((await res.json()) as { messages: Summary[] }).messages;
}

/** The /accept-invite link in the newest email to `address`, waiting for it to arrive. */
export async function inviteLinkFor(address: string, timeoutMs = 10_000): Promise<string> {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		const [newest] = await messagesTo(address);
		if (newest) {
			const res = await fetch(`${mailpit()}/api/v1/message/${newest.ID}`);
			const { HTML } = (await res.json()) as { HTML: string };
			const href = /href="([^"]*\/accept-invite[^"]*)"/.exec(HTML)?.[1];
			if (!href) throw new Error('The invite email has no /accept-invite link');
			return href.replaceAll('&amp;', '&');
		}
		await new Promise((r) => setTimeout(r, 250));
	}
	throw new Error(`No email to ${address} within ${timeoutMs} ms`);
}
