import { expect, test } from './fixtures';

/** Symbol entries in the catalog: 19 targets, 10 props, the dump box and the shooting position. */
const SYMBOL_COUNT = 31;

test('every symbol fits inside its box at all three sizes', async ({ page }) => {
	await page.goto('/symbols');
	await expect(page.getByRole('heading', { level: 1, name: 'Symbols' })).toBeVisible();
	const report = await page.evaluate(() => {
		const out: string[] = [];
		const holders = [...document.querySelectorAll<HTMLElement>('[data-symbol]')];
		for (const holder of holders) {
			const svg = holder.querySelector('svg')!;
			const toSvg = svg.getScreenCTM()!.inverse();
			let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
			const shapes = svg.querySelectorAll<SVGGraphicsElement>(
				'path, circle, rect, ellipse, line, polygon, polyline'
			);
			for (const el of shapes) {
				const b = el.getBBox();
				const m = toSvg.multiply(el.getScreenCTM()!);
				const style = getComputedStyle(el);
				const half = style.stroke === 'none' ? 0 : parseFloat(style.strokeWidth) / 2;
				for (const [x, y] of [
					[b.x - half, b.y - half],
					[b.x + b.width + half, b.y + b.height + half]
				]) {
					const p = new DOMPoint(x, y).matrixTransform(m);
					[x0, y0, x1, y1] = [
						Math.min(x0, p.x),
						Math.min(y0, p.y),
						Math.max(x1, p.x),
						Math.max(y1, p.y)
					];
				}
			}
			const size = `${holder.dataset.symbol}@${holder.dataset.size}`;
			if (x0 < -0.5 || y0 < -0.5 || x1 > 100.5 || y1 > 100.5) {
				out.push(`${size}: ${x0.toFixed(1)},${y0.toFixed(1)} to ${x1.toFixed(1)},${y1.toFixed(1)}`);
			}
			const r = svg.getBoundingClientRect();
			if (Math.round(r.width) !== Number(holder.dataset.size))
				out.push(`${size}: drawn ${r.width}px`);
		}
		return { count: holders.length, out };
	});
	expect(report.out).toEqual([]);
	expect(report.count).toBe(3 * SYMBOL_COUNT);
});

test('every footprint draws on the sheet', async ({ page }) => {
	await page.goto('/symbols');
	const empty = await page.evaluate(() =>
		[...document.querySelectorAll<SVGElement>('[data-footprint]')]
			.filter((f) => !f.querySelector('rect, line, path, circle'))
			.map((f) => f.dataset.footprint)
	);
	expect(empty).toEqual([]);
	await expect(page.locator('[data-footprint]')).toHaveCount(19);
});

test('the sheet can show grayscale', async ({ page }) => {
	await page.goto('/symbols');
	await page.getByLabel('Grayscale').check();
	await expect(page.getByRole('main')).toHaveCSS('filter', 'grayscale(1)');
});
