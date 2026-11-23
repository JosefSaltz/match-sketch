import { fetchSharedView } from '#lib/share/client.js';
import type { PageLoad } from './$types';

/** A shared stage or match, read live from the server: no account, no local data (spec §7.11). */
export const load: PageLoad = async ({ params, url, fetch }) => ({
	token: params.token,
	view: await fetchSharedView(params.token, fetch),
	stageId: url.searchParams.get('stage')
});
