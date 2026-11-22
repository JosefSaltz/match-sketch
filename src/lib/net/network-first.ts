/**
 * The network's answer if it comes within `timeoutMs`; otherwise (or if it fails) the fallback.
 * With no fallback, it keeps waiting for the network. On weak signal the browser still thinks
 * it's online, so without a deadline an offline-capable app would just hang.
 */
export async function networkFirst(
	fromNetwork: () => Promise<Response>,
	fallback: () => Promise<Response | undefined>,
	timeoutMs: number
): Promise<Response> {
	const network = fromNetwork();
	let timer: ReturnType<typeof setTimeout> | undefined;
	const deadline = new Promise<'late'>((resolve) => {
		timer = setTimeout(() => resolve('late'), timeoutMs);
	});
	try {
		const first = await Promise.race([network, deadline]);
		if (first !== 'late') return first;
	} catch {
		const cached = await fallback();
		if (cached) return cached;
		throw new Error('The network failed and nothing is cached');
	} finally {
		clearTimeout(timer);
	}
	const cached = await fallback();
	return cached ?? network;
}
