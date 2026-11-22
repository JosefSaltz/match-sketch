/** Presentation attributes kept from a symbol's root `<svg>` (they style everything inside). */
const KEEP = new Set(['fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin']);

/**
 * A catalog symbol (`<svg viewBox="0 0 100 100" …>…</svg>`) as inner markup plus its root
 * presentation attributes, so print can place it in a `<g>` (no nested `<svg>`, which PDF
 * conversion handles poorly). `currentColor` becomes `ink`, since print can't inherit a CSS color.
 */
export function symbolMarkup(
	svg: string,
	ink = '#1c1c1a'
): { inner: string; rootAttrs: Record<string, string> } {
	const open = svg.match(/<svg\b([^>]*)>/);
	if (!open) return { inner: svg, rootAttrs: {} };
	const rootAttrs: Record<string, string> = {};
	for (const [, name, value] of open[1].matchAll(/([\w-]+)="([^"]*)"/g)) {
		if (KEEP.has(name)) rootAttrs[name] = value === 'currentColor' ? ink : value;
	}
	const start = (open.index ?? 0) + open[0].length;
	const end = svg.lastIndexOf('</svg>');
	const inner = svg.slice(start, end < 0 ? undefined : end).replaceAll('currentColor', ink);
	return { inner, rootAttrs };
}

const cache = new Map<string, ReturnType<typeof symbolMarkup>>();

/** `symbolMarkup` for a catalog entry, parsed once per symbol and ink. */
export function markupFor(
	id: string,
	svg: string,
	ink = '#1c1c1a'
): ReturnType<typeof symbolMarkup> {
	const key = `${id} ${ink}`;
	let m = cache.get(key);
	if (!m) {
		m = symbolMarkup(svg, ink);
		cache.set(key, m);
	}
	return m;
}
