import type { RequestHandler } from './$types';

/** Coolify's health check (docker-compose.yml). It checks only that the server answers. */
export const GET: RequestHandler = () =>
	new Response('ok', { headers: { 'content-type': 'text/plain', 'cache-control': 'no-store' } });
