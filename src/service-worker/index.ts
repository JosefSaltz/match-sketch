/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />
import { version } from '$app/env';
import { assets, immutable } from '$app/manifest';
import { resolve } from '$app/paths';
import { self } from '$app/service-worker';
import { networkFirst } from '../lib/net/network-first';

/**
 * Lets a device that has signed in before open the app with no network (spec §7.9). The built
 * app and static files are precached per deployment. Every page renders in the browser, so one
 * cached shell serves any navigation while offline.
 */
const CACHE = `match-sketch-${version}`;
const SHELL = resolve('/sign-in');
// Manifest paths are relative to the app's base path, which is the worker's scope.
const base = new URL(self.registration.scope).pathname;
const FILES = [...immutable, ...assets].map((file) => `${base}${file.path}`);
const precached = new Set(FILES);

/** Server routes that must always reach the server, never a cache. */
function neverCached(url: URL): boolean {
	return (
		url.pathname.startsWith('/api/') ||
		url.pathname === '/admin' ||
		url.pathname === '/health' ||
		url.pathname.endsWith('/__data.json')
	);
}

self.addEventListener('install', (event) => {
	event.waitUntil(
		(async () => {
			const cache = await caches.open(CACHE);
			await cache.addAll([...FILES, SHELL]);
			await self.skipWaiting();
		})()
	);
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
			await self.clients.claim();
		})()
	);
});

self.addEventListener('fetch', (event) => {
	const { request } = event;
	if (request.method !== 'GET') return;
	const url = new URL(request.url);
	if (url.origin !== self.location.origin || neverCached(url)) return;

	if (precached.has(url.pathname)) {
		event.respondWith(caches.match(url.pathname).then((cached) => cached ?? fetch(request)));
		return;
	}

	if (request.mode === 'navigate') {
		// Network first, so a deploy shows at once; the cached shell when offline or on weak signal.
		event.respondWith(
			networkFirst(
				() => fetch(request),
				() => caches.match(SHELL),
				3000
			)
		);
	}
});
