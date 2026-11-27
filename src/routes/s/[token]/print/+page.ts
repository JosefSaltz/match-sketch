import { fetchSharedView } from '#lib/share/client.js';
import type { PageLoad } from './$types';

/** The shared stage to print, read live like the viewer (spec §7.11). */
export const load: PageLoad = async ({ params, url, fetch }) => ({
	token: params.token,
	view: await fetchSharedView(params.token, fetch),
	stageId: url.searchParams.get('stage')
});
