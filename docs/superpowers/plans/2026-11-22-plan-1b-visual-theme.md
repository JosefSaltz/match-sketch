# Plan 1b: Visual Theme — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every screen restyled in Tailwind with the varsity look, a theme picker (solid, plaid, authentic camo) applied to the app's chrome, and a repeatable pattern tool that turns licensed reference images into seamless tiles.

**Architecture:** Tailwind 4 (CSS-first, `@tailwindcss/vite`) replaces the per-component CSS. A TypeScript theme registry is the single source for every theme; `applyTheme()` writes the chosen theme's CSS variables and `data-theme` onto `<html>` before the app renders, and the choice is a per-device setting in IndexedDB. Pattern tiles are static WebP files made offline by a Python tool (`tools/patterns/`, run with `uv`), and only tiles from cleared sources are committed.

**Tech Stack:** SvelteKit 3, Svelte 5 runes, TypeScript, Tailwind CSS 4.3 + `@tailwindcss/vite`, `@fontsource/graduate`, Dexie 4, Vitest, Playwright; Python 3.12 with Pillow, NumPy, SciPy, vtracer, pytest (tool only).

**Spec:** `docs/superpowers/specs/2026-11-21-theme-design.md` (parent: `docs/superpowers/specs/2026-11-21-match-sketch-design.md`). The camo spike scripts that proved the pipeline are in `.superpowers/brainstorm/camo-spike/scripts/` (git-ignored; port, don't import).

## Global Constraints

- **Tailwind CSS 4.3** through `@tailwindcss/vite`; configuration is CSS-first (`@theme` in `src/app.css`). No `tailwind.config.js`.
- Display font **Graduate** from `@fontsource/graduate` (OFL-1.1), self-hosted. No request may leave the app's origin (offline-capable app).
- **Theme scope (option A):** the top bar, panel title strips, plan-card headers, dialog header strips, and primary buttons. Lists, forms, dialog bodies, the stage (bay, grid, objects), and printouts stay white.
- **Buttons:** at least 44 px tall (icon buttons 44 × 44), 3 px black border, rounded corners, hard 3 px offset black shadow, press-down on `:active`, labels in the display font. White buttons on patterned bars; patterned primary buttons on white surfaces.
- **Wordmark:** "MATCH SKETCH" as inline SVG text in Graduate, 30 px, 9 px black outline with `stroke-linejoin="round"`, white letters thickened by a 1.6 px white stroke, 5 px offset black block shadow; accessible name "Match Sketch". The compact form (editor bar) is about 20 px with the same treatment scaled by 2/3.
- **Outlined HTML text:** a ring of `text-shadow`s plus a block shadow, scaled with font size; only display text is outlined. Focus rings on patterns: a white ring inside a black ring.
- **Tiles:** WebP, ≤ 250 KB each, seamless, served from `static/themes/<id>.webp`.
- **Public repo:** commit only assets that are public domain, openly licensed for commercial use, our own, or licensed for app use. Tiles from uncleared sources are never committed (spec §8). Never MultiCam, OCP, MARPAT, AOR1/AOR2, CADPAT, or MTP.
- **Default theme:** `coyote` until Task 7 ships the DPM tile, then `dpm` (spec §6.2/§8: M81 once cleared, DPM until then).
- **Migration:** existing e2e specs pass unchanged after every task (their roles, labels, test ids, and texts are the contract). Every `.svelte`/`.svelte.ts` file passes the Svelte MCP `svelte-autofixer` with no issues or suggestions.
- Commits are atomic, Angular style (`type(scope): description`), per `AGENTS.md`.

## Review Focus

1. **The stage stays plain under any theme:** with a patterned theme active, the bay is still filled white and objects still draw in the text color. → Task 5 (e2e).
2. **A saved theme that no longer exists** (removed, renamed, or not yet cleared; or a corrupt setting) opens the app in the default theme without an error. → Task 2 (unit) and Task 4 (e2e).
3. **A tile that fails to load** (404, or offline before caching exists) leaves the theme's base color behind the bar, and the outlined text stays readable. → Task 7 (e2e with the tile request aborted).
4. **Tablet width (1024 × 768):** the editor's single top bar holds all its controls without overflowing or overlapping, and every control is at least 44 px tall. → Task 5 (e2e).
5. **Offline assets:** loading the home page and the editor makes no request outside the app's origin (fonts and tiles are self-hosted). → Task 1 (e2e).

---

## File Structure

```
src/
  app.css                         Tailwind import, @fontsource import, @theme tokens, @utility helpers
  lib/
    ui/                           shared pieces (new)
      Wordmark.svelte             SVG wordmark, size 'full' | 'compact'
      Button.svelte               variant 'primary' | 'secondary' | 'danger' | 'icon'; <a> when href is set
      PanelHeader.svelte          patterned strip with outlined title + optional actions snippet
      Field.svelte                label + control (children snippet), for inputs and selects
      Toggle.svelte               checkbox styled as a switch, label text as a prop
    components/                   existing Dialog, ConfirmDialog, CanvasForm (restyled)
    theme/
      themes.ts                   Theme types, THEMES, DEFAULT_THEME_ID, getTheme()
      apply.ts                    applyTheme()
      credits.ts                  CREDITS
      ThemePicker.svelte          dialog of swatches grouped by family
      CreditsDialog.svelte        "About & credits"
    store/
      db.ts                       version 2 adds `settings`
      settings.ts                 getSetting(), setSetting(), THEME_SETTING
  routes/(app)/+layout.ts         applies the saved theme before rendering
static/themes/*.webp              committed tiles (cleared sources only)
tools/patterns/                   Python tool (uv project), not part of the app build
  pyproject.toml, sources.json, make_tiles.py, patterns/*.py, tests/*.py
```

---

### Task 1: Tailwind, Graduate, tokens, and the wordmark

**Files:**

- Modify: `package.json` (deps), `vite.config.ts`, `src/app.css`, `src/routes/(app)/+page.svelte` (heading only)
- Create: `src/lib/ui/Wordmark.svelte`, `tests/e2e/theme-basics.spec.ts`

**Interfaces:**

- Produces:
  - `src/app.css`: `@import 'tailwindcss';` and `@import '@fontsource/graduate';`. `@theme` holds the current tokens as Tailwind colors (`--color-bg`, `--color-surface`, `--color-border`, `--color-text`, `--color-muted`, `--color-accent`, `--color-danger`, `--color-selection`, same values as today) and `--font-display: 'Graduate', serif`. The existing `var(--color-*)` references keep working. `--space-*` stays until Tasks 3 and 5 remove its last uses.
  - `:root` defaults for the theme variables: `--theme-base: #81613c; --theme-accent: #81613c; --theme-tile: none; --theme-tile-size: auto;`.
  - `@utility` helpers:
    - `bg-theme`: `background: var(--theme-base) var(--theme-tile) 0 0 / var(--theme-tile-size)`.
    - `text-outline-sm` (1.5 px ring, 3 px block), `text-outline-md` (2 px ring, 4 px block), `text-outline-lg` (3 px ring, 5 px block): white text, eight-direction `text-shadow` ring plus an offset block shadow, as in the approved mockups.
    - `focus-ring`: white ring inside a black ring on `:focus-visible`.
  - `Wordmark.svelte`: `let { size = 'full' }: { size?: 'full' | 'compact' } = $props()`. Renders `<svg role="img" aria-label="Match Sketch">` with three `<text>` layers (block shadow, black outline, white fill with white thickening stroke) per Global Constraints. Width and height are fixed per size so the layout doesn't jump while the font loads.

- [ ] **Step 1: Write the failing e2e tests**

```ts
// theme-basics.spec.ts
test('the home page shows the wordmark in Graduate', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByRole('img', { name: 'Match Sketch' })).toBeVisible();
	expect(await page.evaluate(() => document.fonts.check('30px Graduate'))).toBe(true);
});
test('no request leaves the app origin', async ({ page, baseURL }) => {
	// Review Focus #5
	const outside: string[] = [];
	page.on('request', (r) => {
		if (!r.url().startsWith(baseURL!) && !r.url().startsWith('data:')) outside.push(r.url());
	});
	await page.goto('/');
	await createCanvas(page, { name: 'Bay A', width: '50', depth: '25', unit: 'Yards' });
	await createPlanFromCanvas(page, 'Bay A');
	expect(outside).toEqual([]);
});
```

- [ ] **Step 2: Run to verify failure** — `pnpm exec playwright test tests/e2e/theme-basics.spec.ts` → the wordmark test fails (no `img` named "Match Sketch").
- [ ] **Step 3: Install and configure** — `pnpm add -D tailwindcss@^4.3 @tailwindcss/vite` and `pnpm add @fontsource/graduate`. Add `tailwindcss()` before `sveltekit()` in `vite.config.ts`. Write `src/app.css` as above. Commit this on its own: `build(deps): add Tailwind 4 and the Graduate font`.
- [ ] **Step 4: Implement** `Wordmark.svelte` and replace the home page's `<h1>{APP_NAME}</h1>` contents with `<Wordmark />` (the `<h1>` stays, so the heading's name is "Match Sketch").
- [ ] **Step 5: Run** the new spec and the whole suite (`pnpm vitest run && pnpm exec playwright test && pnpm check && pnpm lint`) → all PASS.
- [ ] **Step 6: Commit** — `feat(ui): add the varsity wordmark and Tailwind theme tokens`

---

### Task 2: Theme registry, applying a theme, and the saved choice

**Files:**

- Create: `src/lib/theme/themes.ts`, `themes.test.ts`, `src/lib/theme/apply.ts`, `apply.test.ts`, `src/lib/store/settings.ts`, `settings.test.ts`
- Modify: `src/lib/store/db.ts`, `src/routes/(app)/+layout.ts`

**Interfaces:**

- Produces:
  - `themes.ts`:
    - `type ThemeFamily = 'solid' | 'plaid' | 'camo'`
    - `type Theme = { id: string; name: string; family: ThemeFamily; base: string; accent: string; tile?: { src: string; width: number; height: number }; credit?: string }` (`tile.width`/`height` are the display size in CSS px; `credit` is an id in `CREDITS`, Task 8).
    - `THEMES: readonly Theme[]`, starting with the five solids: `coyote` "Coyote" `#81613c`, `ranger-green` "Ranger Green" `#4a5240`, `wolf-grey` "Wolf Grey" `#5e6366`, `blackout` "Blackout" `#1f1f1f`, `blaze` "Blaze" `#e8590c` (accent = base for solids).
    - `DEFAULT_THEME_ID = 'coyote'`.
    - `getTheme(id: string | null | undefined): Theme` returns the default for unknown ids.
  - `apply.ts`: `type ThemeRoot = { dataset: Record<string, string | undefined>; style: { setProperty(name: string, value: string): void } }`. `applyTheme(theme: Theme, root: ThemeRoot): void` sets `dataset.theme = theme.id`, `--theme-base`, `--theme-accent`, `--theme-tile` (`url("<src>")` or `none`), and `--theme-tile-size` (`"<w>px <h>px"` or `auto`). The registry is the only source of theme values: there is no hand-written per-theme CSS. (Spec §6.1 sketched generated `[data-theme]` blocks; writing the variables inline from the registry gives the same single-source guarantee with less machinery.)
  - `db.ts`: `this.version(2).stores({ ..., settings: 'key' })` (keeps the v1 stores); `declare settings: Table<{ key: string; value: string; updatedAt: string }, string>`.
  - `settings.ts`: `THEME_SETTING = 'theme'`; `getSetting(db, key): Promise<string | undefined>`; `setSetting(db, key, value): Promise<void>` (stamps `updatedAt` with `now()` from `records.ts`).
  - `(app)/+layout.ts` `load`: reads `THEME_SETTING`, calls `applyTheme(getTheme(saved), document.documentElement)`, returns `{ themeId }`. The app routes have `ssr = false`, so `load` runs before the first render and no default-theme flash shows.

- [ ] **Step 1: Write the failing tests**

```ts
// themes.test.ts
it('has unique ids and complete entries', () => {
	expect(new Set(THEMES.map((t) => t.id)).size).toBe(THEMES.length);
	for (const t of THEMES) expect(t.base).toMatch(/^#[0-9a-f]{6}$/);
});
it('every tile exists under static/themes', () => {
	for (const t of THEMES.filter((t) => t.tile))
		expect(existsSync(`static${t.tile!.src}`)).toBe(true);
});
it('falls back to the default for unknown or missing ids (Review Focus #2)', () => {
	expect(getTheme('no-such-theme').id).toBe(DEFAULT_THEME_ID);
	expect(getTheme(undefined).id).toBe(DEFAULT_THEME_ID);
});
// apply.test.ts — a fake root records dataset and setProperty calls
it('writes the theme id and variables', () => {
	applyTheme(getTheme('ranger-green'), root);
	expect(root.dataset.theme).toBe('ranger-green');
	expect(props['--theme-base']).toBe('#4a5240');
	expect(props['--theme-tile']).toBe('none');
});
// settings.test.ts (fake-indexeddb, as in plans.test.ts)
it('saves and reads a setting', async () => {
	await setSetting(db, THEME_SETTING, 'blaze');
	expect(await getSetting(db, THEME_SETTING)).toBe('blaze');
});
```

Add one `apply.test.ts` case with a theme that has a tile: `--theme-tile` is `url("/themes/x.webp")` and `--theme-tile-size` is `"1500px 454px"`.

- [ ] **Step 2: Run to verify failure** — `pnpm vitest run src/lib/theme src/lib/store/settings.test.ts` → FAIL (modules missing).
- [ ] **Step 3: Implement** the modules, the Dexie v2 stores, and the layout `load`.
- [ ] **Step 4: Run** the whole suite → PASS.
- [ ] **Step 5: Commit** — `feat(theme): add the theme registry and the saved theme choice`

---

### Task 3: Shared pieces; home and new-plan screens in Tailwind

**Files:**

- Create: `src/lib/ui/{Button,PanelHeader,Field,Toggle}.svelte`, `tests/e2e/theme-home.spec.ts`
- Modify: `src/routes/(app)/+page.svelte`, `src/routes/(app)/plans/new/+page.svelte`, `src/lib/components/{CanvasForm,Dialog,ConfirmDialog}.svelte`, `tests/e2e/helpers.ts`

**Interfaces:**

- Consumes: `Wordmark` (Task 1); `bg-theme`, `text-outline-*`, `focus-ring` (Task 1).
- Produces:
  - `Button.svelte`: `{ variant?: 'primary' | 'secondary' | 'danger' | 'icon'; href?: string; children: Snippet; ...rest }`. Renders `<a>` when `href` is set, otherwise `<button type="button">` (rest props pass through: `onclick`, `disabled`, `aria-*`, `type`). Primary = `bg-theme` with `text-outline-sm` label; secondary = white with black label; danger = white with `--color-danger` label; icon = 44 × 44.
  - `PanelHeader.svelte`: `{ title: string; level?: 2 | 3; actions?: Snippet }`, a `bg-theme` strip with the title in `text-outline-sm` display type inside an `<h2>`/`<h3>`, so existing `aria-labelledby` targets keep their text.
  - `Field.svelte`: `{ label: string; id: string; error?: string; children: Snippet }` (label above the control, error text below).
  - `Toggle.svelte`: `{ label: string; checked: boolean (bindable); id?: string }`, a native checkbox styled as a switch, so `getByLabel(...).check()` still works.
  - `Dialog.svelte`: same props as today; the header is a `bg-theme` strip with the outlined title, and the body is white.
  - `helpers.ts`: `themeBaseRgb(page: Page): Promise<string>` returns the current `--theme-base` as `rgb(r, g, b)`, so color assertions don't depend on which theme is the default.
- Layout:
  - **Home:** a `bg-theme` top bar with `<h1><Wordmark /></h1>` and the page actions ("New plan" link, "New canvas" button). The "Plans" section becomes a grid of cards, one `<li>` each: a patterned header with `planTitle(plan)` in outlined type, and a white body with dimensions, "Edited …", and Open / Duplicate / Delete. The "Canvases" section stays a white list with a `PanelHeader`. The region names ("Plans", "Canvases") stay. "New canvas" appears once on the page.
  - **New plan:** the same top bar (wordmark links home); the form uses `Field`/`Toggle`/`Button`.

- [ ] **Step 1: Write the failing e2e tests**

```ts
// theme-home.spec.ts
test('home has a patterned top bar with the page actions', async ({ page }) => {
	await page.goto('/');
	const bar = page.getByRole('banner');
	await expect(bar.getByRole('img', { name: 'Match Sketch' })).toBeVisible();
	await expect(bar.getByRole('link', { name: 'New plan' })).toBeVisible();
	await expect(bar.getByRole('button', { name: 'New canvas' })).toBeVisible();
});
test('plans show as cards with a patterned header', async ({ page }) => {
	await page.goto('/');
	await createCanvas(page, { name: 'Bay A', width: '50', depth: '25', unit: 'Yards' });
	await createPlanFromCanvas(page, 'Bay A');
	await page.goto('/');
	const card = page.getByRole('region', { name: 'Plans' }).getByRole('listitem');
	await expect(card.locator('header')).toHaveCSS('background-color', await themeBaseRgb(page));
});
test('buttons are big enough to touch', async ({ page }) => {
	await page.goto('/');
	for (const b of await page.getByRole('button').all())
		expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44);
});
```

- [ ] **Step 2: Run to verify failure** → FAIL (no banner, no card header).
- [ ] **Step 3: Implement** the shared pieces and restyle the five files. Remove their `<style>` blocks except where a style can't be expressed as utilities.
- [ ] **Step 4: Run** the whole suite. The existing `canvas-library`, `new-plan`, and `smoke` specs must pass unchanged → PASS.
- [ ] **Step 5: Commit** — split into `feat(ui): add shared button, panel header, field and toggle` and `feat(ui): restyle the home and new-plan screens`.

---

### Task 4: Theme picker

**Files:**

- Create: `src/lib/theme/ThemePicker.svelte`, `tests/e2e/theme-picker.spec.ts`
- Modify: `src/routes/(app)/+page.svelte`, `src/routes/(app)/plans/new/+page.svelte` (a "Theme" button in each top bar)

**Interfaces:**

- Consumes: `THEMES`, `getTheme`, `applyTheme` (Task 2); `getSetting`, `setSetting`, `THEME_SETTING` (Task 2); `Dialog`, `Button` (Task 3).
- Produces: `ThemePicker.svelte`: `{ open: boolean (bindable); current: string; onchange: (id: string) => void }`.
  - A dialog titled "Theme" with one group per family, in the order Solid, Plaid, Camo (empty families are hidden).
  - Each swatch is a button named after the theme, with `aria-pressed` on the current one and a preview of its tile or base color.
  - Choosing a swatch calls `applyTheme` at once, saves the setting, and calls `onchange`. The dialog stays open so you can compare.
  - Top bars get a secondary **Theme** button that opens it.

- [ ] **Step 1: Write the failing e2e tests**

```ts
// theme-picker.spec.ts
test('choosing a theme applies it and survives a reload', async ({ page }) => {
	await page.goto('/');
	await page.getByRole('button', { name: 'Theme' }).click();
	await page.getByRole('dialog').getByRole('button', { name: 'Ranger Green' }).click();
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'ranger-green');
	await page.reload();
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'ranger-green');
});
test('a saved theme that no longer exists opens in the default (Review Focus #2)', async ({ page }) => {
	await page.goto('/');
	await page.evaluate(async () => {
		const req = indexedDB.open('match-sketch');
		await new Promise((r) => (req.onsuccess = r));
		const tx = req.result.transaction('settings', 'readwrite');
		tx.objectStore('settings').put({ key: 'theme', value: 'retired-camo', updatedAt: '' });
		await new Promise((r) => (tx.oncomplete = r));
	});
	await page.reload();
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'coyote');
});
```

- [ ] **Step 2: Run to verify failure** → FAIL (no Theme button).
- [ ] **Step 3: Implement** the picker and the Theme buttons.
- [ ] **Step 4: Run** the whole suite → PASS.
- [ ] **Step 5: Commit** — `feat(theme): add the theme picker`

---

### Task 5: Editor in Tailwind with one themed top bar

**Files:**

- Create: `tests/e2e/theme-editor.spec.ts`
- Modify: `src/lib/editor/components/{Toolbar,EditorView,Palette,PropertiesPanel}.svelte`, `src/routes/(app)/plans/[id]/+page.svelte`

**Interfaces:**

- Consumes: `Wordmark` (size `'compact'`), `Button`, `PanelHeader`, `Field` (Tasks 1, 3); `ThemePicker` (Task 4).
- Produces:
  - **Toolbar** = one `<header>` with `bg-theme`:
    - The compact wordmark inside a link to the plans list, named "Match Sketch", with a 44 px tall target.
    - The stage title in `text-outline-md`, then the dimensions.
    - Zoom out / Zoom in / Fit, Undo / Redo, the save status, the Snap and Symbol size selects, and Theme.
    - The controls are white secondary buttons and selects, at least 44 px tall. The bar wraps onto a second row before anything overlaps.
    - Every existing accessible name and `data-testid="save-status"` stays.
  - **Palette and Properties** each start with a `PanelHeader` ("Symbols", "Properties"); their lists and fields stay white.
  - The stage SVG (`EditorCanvas`, `BayLayer`, `ScaleBar`, `ObjectView`, `SelectionOverlay`) keeps its scoped CSS and stays theme-free.

- [ ] **Step 1: Write the failing e2e tests**

```ts
// theme-editor.spec.ts (beforeEach: canvas "Bay A" 50 × 25 yd, plan created, editor open)
test('the editor bar is themed and the wordmark links home', async ({ page }) => {
	await expect(page.getByRole('banner')).toHaveCSS('background-color', await themeBaseRgb(page));
	await page.getByRole('link', { name: 'Match Sketch' }).click();
	await expect(page).toHaveURL(/\/$/);
});
test('the stage stays white under a patterned theme (Review Focus #1)', async ({ page }) => {
	await page.getByRole('button', { name: 'Theme' }).click();
	await page.getByRole('dialog').getByRole('button', { name: 'Blackout' }).click();
	await page.keyboard.press('Escape');
	await expect(page.getByTestId('bay')).toHaveCSS('fill', 'rgb(255, 255, 255)');
});
test.describe('tablet', () => {
	test.use({ viewport: { width: 1024, height: 768 } });
	test('the top bar fits and its controls are touch-sized (Review Focus #4)', async ({ page }) => {
		const bar = page.getByRole('banner');
		expect(await bar.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
		for (const c of await bar.locator('button, select, a').all())
			expect((await c.boundingBox())!.height).toBeGreaterThanOrEqual(44);
	});
});
```

- [ ] **Step 2: Run to verify failure** → FAIL (the bar isn't themed; no wordmark link).
- [ ] **Step 3: Implement** the restyle. Remove the `.toolbar`/`.palette`/`.properties` style blocks in favor of utilities, and remove the last uses of `--space-*` (then drop those tokens from `app.css`).
- [ ] **Step 4: Run** the whole suite. Every editor spec (`editor-place`, `editor-edit`, `editor-handles`, `editor-history`, `new-plan`) must pass unchanged → PASS.
- [ ] **Step 5: Commit** — `feat(editor): restyle the editor with one themed top bar`

---

### Task 6: Pattern tool

**Files:**

- Create: `tools/patterns/pyproject.toml`, `tools/patterns/sources.json`, `tools/patterns/make_tiles.py`, `tools/patterns/patterns/{sources,separate,seamless,plaid,render,preview}.py`, `tools/patterns/tests/test_patterns.py`
- Modify: `.gitignore` (`tools/patterns/.cache/`, `tools/patterns/out/`), `.prettierignore` if needed

**Interfaces:**

- Produces:
  - `sources.json`: a list of entries.
    - Camo fields: `{ id, name, kind: 'photo', cleared: boolean, source: { file_page, url, author, license, sha256 }, colors: number, palette: [hex...], crop?: [x0, y0, x1, y1], work_width: number, seam_band: number, tile_width: number }`.
    - Plaid fields: `{ id, name, kind: 'plaid', cleared: true, sett: [[hex, threads], ...], thread_px: number }`.
    - Initial camo entries:
      - `dpm` and `dbdu`, cleared and supported now. (UCP was dropped by the user.)
      - `m81`, `erdl`, `dcu`, `tiger-stripe` and `desert-night`, with `cleared: false`, their sources and licenses as spec §7 records them, and their kinds (`flat`, `grid`) marked "not yet supported".
    - Plaids:
      - `buffalo-check`: red `#b3141b` / black `#1a1a1a`, equal bands.
      - `hunter`: green / navy / black with a thin yellow line.
      - `range-day`: tan / olive with a thin orange line.
    - The setts are original; choose thread counts that read as those patterns.
  - `make_tiles.py <id>... | --all [--preview]`:
    - Downloads each source into the git-ignored `.cache/` once, and verifies its `sha256`.
    - Builds the tile.
    - Writes `static/themes/<id>.webp` only when `cleared` is true; otherwise it writes `tools/patterns/out/<id>.webp`.
    - `--preview` writes `tools/patterns/out/review.html` showing each tile on a mock app bar, a repeated area with seam markers, and the reference image.
  - Pipeline (port from the spike scripts; spec §6.6):
    - **Photo:** flat-field the lighting, median denoise, k-means in CIE Lab into `colors` clusters, and remove specks.
    - **Seam:** signed-distance blending over `seam_band` px on each axis.
    - **Palette:** recolor to the entry's `palette`.
    - **Render:** WebP at `tile_width`, ≤ 250 KB.
    - **Plaid:** a mirrored sett rendered as a 2/2 twill (warp color where `(x + y) mod 4 < 2`, weft otherwise), so the tile is periodic by construction.

- [ ] **Step 1: Write the failing pytest tests**

```python
# tests/test_patterns.py — synthetic inputs, no downloads
def test_seam_blend_makes_wrap_as_smooth_as_the_interior():
    labels = random_blobs(seed=1, size=(400, 600), colors=4)
    tile = seamless(labels, band=60, axes=(0, 1))
    assert wrap_mismatch(tile) <= 1.5 * neighbour_mismatch(tile)

def test_plaid_tile_is_periodic_and_uses_only_sett_colors():
    img = plaid([("#b3141b", 8), ("#1a1a1a", 8)], thread_px=4)
    assert set(colors_of(img)) <= {(0xb3, 0x14, 0x1b), (0x1a, 0x1a, 0x1a)}
    assert img.width == img.height == 2 * (8 + 8) * 4


def test_tile_stays_under_the_size_budget(tmp_path):
    out = render_webp(random_blobs(seed=3, size=(900, 1300), colors=4), PALETTE4, tmp_path / "t.webp", 1600)
    assert out.stat().st_size <= 250_000
```

- [ ] **Step 2: Run to verify failure** — `cd tools/patterns && uv run pytest` → FAIL (modules missing).
- [ ] **Step 3: Implement** the modules and CLI.
- [ ] **Step 4: Run** `uv run pytest` → PASS, then `uv run make_tiles.py --all --preview`. It writes the cleared and plaid tiles and the review page, and skips unsupported kinds with a message.
- [ ] **Step 5: Commit** — `feat(tooling): add the pattern tool for seamless theme tiles` (the tool, the manifest, and the tests only; no tiles yet).

---

### Task 7: Plaid and camo themes, reviewed by the user

**Files:**

- Create: `static/themes/{buffalo-check,hunter,range-day,dpm,dbdu}.webp` (only those the user approves), `tests/e2e/theme-tiles.spec.ts`
- Modify: `tools/patterns/sources.json` (calibrated palettes, crops), `src/lib/theme/themes.ts`

**Interfaces:**

- Consumes: the pattern tool (Task 6); `Theme`, `THEMES` (Task 2).
- Produces:
  - **Registry:** entries for each approved tile, with `tile.src = '/themes/<id>.webp'`, the display size from the manifest's tile width, and a `credit` id for camo. Names: `dpm` "Woodland DPM", `dbdu` "Chocolate Chip", `buffalo-check` "Buffalo Check", `hunter` "Hunter", `range-day` "Range Day".
  - **Display sizes:**
    - Plaids: about 64–128 px per sett repeat.
    - DPM: about 690 px wide.
    - 6-color desert: chosen at review.
  - **Default:** `DEFAULT_THEME_ID = 'dpm'` once DPM is approved.
  - **User checkpoint (spec §6.7):**
    - Show `tools/patterns/out/review.html` for every tile.
    - Calibrate each camo palette by eye to the richness the user picked for M81 (khaki `#c8ae5c`, green `#336530`, brown `#644c2a`, black `#202927`).
    - Commit only tiles the user approves. A weak result (e.g. the 6-color desert garment crop) waits for a better source.

- [ ] **Step 1: Write the failing e2e tests**

```ts
// theme-tiles.spec.ts
test('a camo theme paints its tile on the top bar', async ({ page }) => {
	await page.goto('/');
	await page.getByRole('button', { name: 'Theme' }).click();
	await page.getByRole('dialog').getByRole('button', { name: 'Woodland DPM' }).click();
	await expect(page.getByRole('banner')).toHaveCSS('background-image', /\/themes\/dpm\.webp/);
});
test('a tile that fails to load leaves the base color (Review Focus #3)', async ({ page }) => {
	await page.route('**/themes/*.webp', (r) => r.abort());
	await page.goto('/');
	await page.getByRole('button', { name: 'Theme' }).click();
	await page.getByRole('dialog').getByRole('button', { name: 'Woodland DPM' }).click();
	await expect(page.getByRole('banner')).toHaveCSS('background-color', await themeBaseRgb(page));
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'dpm');
	await expect(page.getByRole('banner').getByRole('img', { name: 'Match Sketch' })).toBeVisible();
});
test('the default theme is DPM', async ({ page }) => {
	await page.goto('/');
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'dpm');
});
```

Update Task 4's fallback e2e to expect `dpm`.

- [ ] **Step 2: Run to verify failure** → FAIL (no DPM theme).
- [ ] **Step 3: Generate, calibrate, and review** with the user: `uv run make_tiles.py dpm dbdu buffalo-check hunter range-day --preview`, then `--ship` the approved ones. Record the calibrated palettes and the 6-color desert crop in `sources.json`, regenerate, and get the user's approval per tile.
- [ ] **Step 4: Add** the approved tiles and registry entries; switch the default to `dpm`.
- [ ] **Step 5: Run** the whole suite. The registry unit test confirms every tile file exists → PASS.
- [ ] **Step 6: Commit** — `feat(theme): add plaid themes` and `feat(theme): add authentic camo themes (DPM, 6-color desert)` (the latter lists only what was approved), and `chore(tooling): record calibrated palettes` if the manifest changed separately.

---

### Task 8: About & credits

**Files:**

- Create: `src/lib/theme/credits.ts`, `credits.test.ts`, `src/lib/theme/CreditsDialog.svelte`, `tests/e2e/credits.spec.ts`
- Modify: `src/routes/(app)/+page.svelte` (an "About & credits" button), `src/lib/theme/ThemePicker.svelte` (a link to it)

**Interfaces:**

- Consumes: `THEMES` (`credit` ids), `Dialog`, `Button`.
- Produces:
  - `credits.ts`: `type Credit = { id: string; title: string; author: string; license: string; url: string; note?: string }` and `CREDITS: readonly Credit[]`.
    - One entry per committed tile source, plus the font: "Graduate" by Eduardo Tunni, SIL Open Font License 1.1.
    - The DPM entry's `note` is exactly: "Contains public sector information licensed under the Open Government Licence v1.0".
  - `CreditsDialog.svelte`: a dialog titled "About & credits" listing every credit, with the source as a link.

- [ ] **Step 1: Write the failing tests**

```ts
// credits.test.ts
it('every theme credit exists', () => {
	const ids = new Set(CREDITS.map((c) => c.id));
	for (const t of THEMES) if (t.credit) expect(ids.has(t.credit)).toBe(true);
});
// credits.spec.ts
test('credits show the OGL statement and the font license', async ({ page }) => {
	await page.goto('/');
	await page.getByRole('button', { name: 'About & credits' }).click();
	const d = page.getByRole('dialog');
	await expect(d).toContainText(
		'Contains public sector information licensed under the Open Government Licence v1.0'
	);
	await expect(d).toContainText('SIL Open Font License');
});
```

- [ ] **Step 2: Run to verify failure** → FAIL.
- [ ] **Step 3: Implement** the credits list, the dialog, and the two entry points.
- [ ] **Step 4: Run** the whole suite (`pnpm vitest run && pnpm exec playwright test && pnpm check && pnpm lint`) → PASS.
- [ ] **Step 5: Commit** — `feat(theme): add the About & credits dialog`
