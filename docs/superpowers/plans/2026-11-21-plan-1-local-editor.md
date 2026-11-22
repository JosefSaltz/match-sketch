# Plan 1: Local Editor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A working, browser-only stage designer: define and save canvases, create plans from them, place/move/rotate/resize/label symbols on a snapping grid, undo/redo, with everything saved in IndexedDB.

**Architecture:** SvelteKit 3 app whose app routes render only in the browser (`ssr = false`) and read/write a local IndexedDB store (Dexie). All geometry, schema, and editing logic lives in pure TypeScript modules under `src/lib` with Vitest unit tests; Svelte components are thin views over an `EditorState` class. The stage renders as plain SVG. Records already carry the sync fields the later accounts/sync plan needs.

**Tech Stack:** SvelteKit 3, Svelte 5 (runes), TypeScript, Dexie 4 (IndexedDB), Zod 4, Vitest 4 (unit), Playwright (e2e), pnpm.

**Spec:** `docs/superpowers/specs/2026-11-21-match-sketch-design.md`

### Plan sequence (this is Plan 1 of 6; details and status in `docs/superpowers/plans/ROADMAP.md`)

1. **Local editor** (this plan)
2. Stage brief, Targets tally, measure lines, text/arrow annotations, matches
3. Symbol library art (style sketches reviewed with the user first, then the full set from spec §7.7)
4. Print & PDF (page design mockups reviewed with the user first; fit/tile, overflow page, match print, plan thumbnails on the home page)
5. Accounts & sync (Supabase, Drizzle, invites/admin, sync endpoints, conflicts, service worker offline shell)
6. Draft from text (Claude route, validation/repair, caps, spend ceiling, eval)

Between Plans 1 and 2: a throwaway **scale break** spike on top of this editor, shown to the user (spec §7.4).

## Global Constraints

- TypeScript everywhere; SvelteKit 3 (config lives in `vite.config.ts`, there is no `svelte.config.js`); Svelte 5 runes.
- Validation with **Zod**. No Effect.
- The stage is rendered as **plain SVG** in the DOM. No canvas libraries.
- All symbols are **original** SVG. No stock clip art or photos.
- Lengths are **stored in feet** (decimal numbers). Display/entry unit per canvas/plan: `'ft' | 'yd'`.
- Coordinates: origin at the **uprange-left** corner; `x` = feet from the left edge; `y` = feet **downrange** from the uprange edge. Downrange is drawn toward the **top** of the screen.
- `rotation` is degrees **clockwise as displayed**, normalized to `[0, 360)`. `0` means the object's "up" points downrange.
- Snap settings: `'off' | '1ft' | '1yd' | '5yd'` (1 ft, 3 ft, 15 ft).
- **Footprint** objects (walls, boxes, fault lines) are drawn to scale; position = center. **Symbol** objects (targets, small props, markers) are drawn at a fixed screen size (small 24 px, medium 32 px, large 44 px), position = true point.
- Canvas dimensions: **3 ft to 3000 ft** each way. Canvas name: 1–80 characters.
- Record ids are client-generated UUIDs (`crypto.randomUUID()`); every record has sync fields `version` (0 = never synced), `updatedAt` (ISO string), `deletedAt` (ISO string or null), `dirty` (`0 | 1`, numeric so IndexedDB can index it).
- A plan **copies** canvas dimensions; editing a library canvas never changes existing plans.
- Interaction uses **Pointer Events** (mouse, pen, touch) with pointer capture. Desktop and tablet are targets.
- Testing: **Vitest** unit tests for logic, **Playwright** e2e tests for user behavior. Test-first.
- Package manager: **pnpm**.

## Review Focus

1. **Keyboard shortcuts while typing:** pressing Backspace/Delete or Ctrl+Z inside a text field must edit the field, never delete objects or undo the document. → Task 10 (unit test on `commandForKey`, e2e on the Label field).
2. **Extreme canvas sizes (e.g. 3000 × 150 ft, or 3 × 3 ft):** fit-to-screen works, the grid never draws hundreds of thousands of lines, and the scale bar picks a sane length. → Task 2 (`gridSpacing`, `scaleBar` tests) and Task 8 (e2e with a 1000 × 50 yd canvas).
3. **Bad dimension input (blank, 0, negative, letters, too large):** an inline error in the user's unit, nothing saved, no `NaN` stored. → Task 6 (repo rejects) and Task 7 (e2e).
4. **Reloading right after an edit:** the edit is still there. → Task 12 (e2e reload immediately after a drop).
5. **Touch input on a tablet:** tap selects, one-finger drag moves an object. → Task 10 (e2e with a touch context).

---

## File Structure

```
src/
  app.css                                   global tokens and base styles
  routes/
    +layout.svelte                          imports app.css
    (app)/+layout.ts                        ssr = false, prerender = false
    (app)/+page.svelte                      Home: plans list + canvas library
    (app)/plans/new/+page.svelte            New plan flow
    (app)/plans/[id]/+page.svelte           Editor page
  lib/
    app-info.ts                             APP_NAME
    geometry/
      types.ts                              Point, Size
      units.ts                              ft/yd conversion + formatting
      snap.ts                               snap steps and snapping
      grid.ts                               grid spacing + scale bar
      viewport.ts                           world <-> screen, fit, zoom
      transform.ts                          rotation, angle from pointer, footprint resize
    model/
      plan.ts                               Zod schemas + types for the plan document
    catalog/
      types.ts                              CatalogEntry types
      entries.ts                            placeholder entries (Plan 3 replaces the art)
      svg/*.svg                             placeholder glyphs
      index.ts                              getEntry, searchCatalog, CATEGORY_ORDER
    editor/
      labels.ts                             nextLabel
      ops.ts                                pure document operations
      history.ts                            undo/redo stack
      shortcuts.ts                          key -> command mapping
      editor-state.svelte.ts                EditorState (runes) used by components
      components/
        EditorCanvas.svelte                 SVG root: pan/zoom, pointer routing
        BayLayer.svelte                     bay outline, grid, downrange arrow
        ScaleBar.svelte
        ObjectView.svelte                   renders one object (dispatches by kind)
        SelectionOverlay.svelte             selection outline + handles
        Palette.svelte
        PropertiesPanel.svelte
        Toolbar.svelte
    store/
      records.ts                            record types + input schemas
      db.ts                                 Dexie database
      canvases.ts                           canvas repository
      plans.ts                              plan repository
      index.ts                              getDb() browser singleton
    components/
      CanvasForm.svelte                     name/width/depth/unit form (home + new plan)
tests/e2e/
  helpers.ts
  smoke.spec.ts, canvas-library.spec.ts, new-plan.spec.ts, editor-place.spec.ts,
  editor-edit.spec.ts, editor-handles.spec.ts, editor-history.spec.ts
```

Unit tests sit next to their module as `*.test.ts`.

**Test ids used by e2e (pin these):** `bay`, `scale-bar`, `object` (with `data-object-id`, `data-symbol-id`), `object-label`, `object-count`, `selection`, `handle-rotate`, `handle-ne|nw|se|sw`, `palette-item-<symbolId>`, `save-status`.

---

### Task 1: Scaffold the app and test tooling

**Files:**

- Create: SvelteKit project files at repo root (via `sv create`), `src/lib/app-info.ts`, `src/lib/app-info.test.ts`, `src/routes/(app)/+layout.ts`, `src/routes/(app)/+page.svelte`, `src/app.css`, `tests/e2e/smoke.spec.ts`
- Modify: `playwright.config.ts` (testDir), `.gitignore` (merge), keep existing `README.md`

**Interfaces:**

- Produces: `APP_NAME: 'Match Sketch'` from `src/lib/app-info.ts`; scripts `pnpm vitest run <file>`, `pnpm exec playwright test <file>`, `pnpm check`, `pnpm lint`.

- [ ] **Step 1: Branch**

Run: `git switch -c feat/local-editor`

- [ ] **Step 2: Scaffold into the existing repo**

Run: `pnpm dlx sv create . --template minimal --types ts --add vitest="usages:unit" playwright prettier eslint --install pnpm --no-dir-check`
Expected: project files created; `vite.config.ts`, `playwright.config.ts`, `package.json` exist. If the CLI still prompts, answer to match the flags.

- [ ] **Step 3: Restore and merge repo files**

Run: `git checkout -- README.md` (keep the original README). Ensure `.gitignore` contains `node_modules`, `.svelte-kit`, `build`, `test-results`, `playwright-report`, `.env*` (with `!.env.example`). Add `docs/superpowers/` to `.prettierignore` so `pnpm lint` doesn't reformat the design docs.

- [ ] **Step 4: Add dependencies and browsers**

Run: `pnpm add dexie zod && pnpm add -D fake-indexeddb && pnpm exec playwright install chromium`

- [ ] **Step 5: Point Playwright at `tests/e2e`**

In `playwright.config.ts` set `testDir: 'tests/e2e'`; delete any sample e2e test the scaffold created elsewhere.

- [ ] **Step 6: Write the failing tests**

```ts
// src/lib/app-info.test.ts
import { describe, it, expect } from 'vitest';
import { APP_NAME } from './app-info';
describe('app info', () => {
	it('names the app', () => expect(APP_NAME).toBe('Match Sketch'));
});
```

```ts
// tests/e2e/smoke.spec.ts
import { test, expect } from '@playwright/test';
test('home shows the app name', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByRole('heading', { level: 1, name: 'Match Sketch' })).toBeVisible();
});
```

- [ ] **Step 7: Run them to see them fail**

Run: `pnpm vitest run src/lib/app-info.test.ts` → FAIL (module not found).
Run: `pnpm exec playwright test tests/e2e/smoke.spec.ts` → FAIL (no heading).

- [ ] **Step 8: Implement**

`src/lib/app-info.ts`: `export const APP_NAME = 'Match Sketch';`
`src/routes/(app)/+layout.ts`: `export const ssr = false; export const prerender = false;`
`src/routes/(app)/+page.svelte`: `<h1>{APP_NAME}</h1>` (remove the scaffold's root `src/routes/+page.svelte` so `/` resolves to the `(app)` group page).
`src/app.css`: CSS custom properties for colors, spacing, font stack; imported from `src/routes/+layout.svelte`.

- [ ] **Step 9: Run tests, type check, lint**

Run: `pnpm vitest run && pnpm exec playwright test && pnpm check && pnpm lint`
Expected: all PASS, 0 errors.

- [ ] **Step 10: Commit** (include the spec and this plan)

```bash
git add -A
git commit -m "chore: scaffold SvelteKit 3 app with Vitest and Playwright"
```

---

### Task 2: Units, snapping, grid spacing, scale bar

**Files:**

- Create: `src/lib/geometry/types.ts`, `units.ts`, `snap.ts`, `grid.ts` and `units.test.ts`, `snap.test.ts`, `grid.test.ts`

**Interfaces:**

- Produces:
  - `type Point = { x: number; y: number }`, `type Size = { width: number; height: number }`, `type CanvasSize = { widthFt: number; depthFt: number }`
  - `type LengthUnit = 'ft' | 'yd'`; `toFeet(value: number, unit: LengthUnit): number`; `fromFeet(ft: number, unit: LengthUnit): number`; `formatLength(ft: number, unit: LengthUnit): string`
  - `type SnapSetting = 'off' | '1ft' | '1yd' | '5yd'`; `snapStepFeet(s: SnapSetting): number | null`; `snapValue(v: number, step: number | null): number`; `snapPoint(p: Point, step: number | null): Point`
  - `gridSpacing(baseFt: number, pxPerFt: number, minPx = 8): number`; `scaleBar(pxPerFt: number, unit: LengthUnit, maxPx = 120): { lengthFt: number; label: string; px: number }`

- [ ] **Step 1: Write the failing tests**

```ts
// units.test.ts
expect(toFeet(15, 'yd')).toBe(45);
expect(toFeet(45, 'ft')).toBe(45);
expect(fromFeet(45, 'yd')).toBe(15);
expect(formatLength(45, 'yd')).toBe('15 yd');
expect(formatLength(7.5, 'yd')).toBe('2.5 yd');
expect(formatLength(10, 'yd')).toBe('3.3 yd');
expect(formatLength(12, 'ft')).toBe('12 ft');
expect(formatLength(0.25, 'ft')).toBe('0.3 ft');

// snap.test.ts
expect(snapStepFeet('off')).toBeNull();
expect(snapStepFeet('1ft')).toBe(1);
expect(snapStepFeet('1yd')).toBe(3);
expect(snapStepFeet('5yd')).toBe(15);
expect(snapPoint({ x: 4.4, y: 7.6 }, 3)).toEqual({ x: 3, y: 9 });
expect(snapPoint({ x: 4.4, y: 7.6 }, null)).toEqual({ x: 4.4, y: 7.6 });

// grid.test.ts
expect(gridSpacing(1, 20)).toBe(1);
expect(gridSpacing(1, 2)).toBe(5);
expect(gridSpacing(3, 0.5)).toBe(30);
// Review Focus #2: a 3000 ft bay at ~0.4 px/ft must not draw a line per foot
expect(gridSpacing(1, 0.4)).toBe(50);
expect(scaleBar(10, 'ft')).toEqual({ lengthFt: 10, label: '10 ft', px: 100 });
expect(scaleBar(10, 'yd')).toEqual({ lengthFt: 6, label: '2 yd', px: 60 });
expect(scaleBar(0.4, 'yd')).toEqual({ lengthFt: 300, label: '100 yd', px: 120 });
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm vitest run src/lib/geometry` → FAIL (modules missing).

- [ ] **Step 3: Implement the modules**

`formatLength`: convert, round to 1 decimal, drop a trailing `.0`, append unit. `gridSpacing`: try `baseFt × m` for `m` in `[1, 5, 10, 50, 100, 500, 1000]`, return the first whose `× pxPerFt ≥ minPx`. `scaleBar`: nice lengths in display units `[1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000]`; pick the largest whose pixel length is `≤ maxPx + 1e-9` (fall back to the smallest), and round `px` to 2 decimals (`0.4 × 3 × 100` is `120.00000000000001` in floating point).

- [ ] **Step 4: Run to verify pass**

Run: `pnpm vitest run src/lib/geometry` → PASS

- [ ] **Step 5: Commit**

`git add src/lib/geometry && git commit -m "feat: units, snapping, grid spacing and scale bar"`

---

### Task 3: Viewport and object transforms

**Files:**

- Create: `src/lib/geometry/viewport.ts`, `transform.ts`, `viewport.test.ts`, `transform.test.ts`

**Interfaces:**

- Consumes: `Point`, `Size`, `CanvasSize` (Task 2).
- Produces:
  - `type Viewport = { scale: number; offsetX: number; offsetY: number }` — `scale` px per ft; `offsetX/offsetY` = screen position of the world origin (uprange-left corner).
  - `worldToScreen(p: Point, vp: Viewport): Point` (screen y = `offsetY − y × scale`); `screenToWorld(p: Point, vp: Viewport): Point`
  - `fitViewport(canvas: CanvasSize, screen: Size, paddingPx = 48): Viewport`
  - `zoomAt(vp: Viewport, screenPt: Point, factor: number, limits = { min: 0.05, max: 200 }): Viewport`
  - `rotateWorld(v: Point, deg: number): Point` (clockwise as displayed); `normalizeDegrees(deg: number): number`
  - `angleFromPointer(center: Point, pointer: Point, snapDeg: number | null): number`
  - `type Corner = 'ne' | 'nw' | 'se' | 'sw'`; `type FootprintBox = { x: number; y: number; rotation: number; widthFt: number; depthFt: number }`; `resizeFromCorner(box: FootprintBox, corner: Corner, pointer: Point, step: number | null, minFt = 0.5): Pick<FootprintBox, 'x' | 'y' | 'widthFt' | 'depthFt'>`. Local axes: width along the object's local x (right at rotation 0), depth along local y (downrange at rotation 0). `n` = +depth side, `e` = +width side.

- [ ] **Step 1: Write the failing tests**

```ts
// viewport.test.ts
const vp = { scale: 10, offsetX: 50, offsetY: 400 };
expect(worldToScreen({ x: 0, y: 0 }, vp)).toEqual({ x: 50, y: 400 });
expect(worldToScreen({ x: 10, y: 5 }, vp)).toEqual({ x: 150, y: 350 });
expect(screenToWorld({ x: 150, y: 350 }, vp)).toEqual({ x: 10, y: 5 });
expect(fitViewport({ widthFt: 150, depthFt: 75 }, { width: 1000, height: 600 }, 50)).toEqual({
	scale: 6,
	offsetX: 50,
	offsetY: 525
});
const z = zoomAt(vp, { x: 150, y: 350 }, 2);
expect(z.scale).toBe(20);
expect(screenToWorld({ x: 150, y: 350 }, z)).toEqual({ x: 10, y: 5 });
expect(zoomAt(vp, { x: 0, y: 0 }, 1000).scale).toBe(200);

// transform.test.ts
const r = rotateWorld({ x: 0, y: 1 }, 90);
expect(r.x).toBeCloseTo(1);
expect(r.y).toBeCloseTo(0);
const r2 = rotateWorld({ x: 1, y: 0 }, 90);
expect(r2.x).toBeCloseTo(0);
expect(r2.y).toBeCloseTo(-1);
expect(normalizeDegrees(-15)).toBe(345);
expect(normalizeDegrees(370)).toBe(10);
expect(angleFromPointer({ x: 0, y: 0 }, { x: 1, y: 0 }, null)).toBeCloseTo(90);
expect(angleFromPointer({ x: 0, y: 0 }, { x: 0, y: 1 }, null)).toBeCloseTo(0);
expect(angleFromPointer({ x: 0, y: 0 }, { x: -1, y: -1 }, 15)).toBe(225);
const box = { x: 10, y: 10, rotation: 0, widthFt: 4, depthFt: 2 };
expect(resizeFromCorner(box, 'ne', { x: 14, y: 13 }, null)).toEqual({
	x: 11,
	y: 11,
	widthFt: 6,
	depthFt: 4
});
const rotated = resizeFromCorner({ ...box, rotation: 90 }, 'ne', { x: 12, y: 7 }, null);
expect(rotated.widthFt).toBeCloseTo(5);
expect(rotated.depthFt).toBeCloseTo(3);
expect(rotated.x).toBeCloseTo(10.5);
expect(rotated.y).toBeCloseTo(9.5);
expect(resizeFromCorner(box, 'ne', { x: 14.2, y: 13 }, 3)).toEqual({
	x: 11,
	y: 10.5,
	widthFt: 6,
	depthFt: 3
});
const tiny = resizeFromCorner(box, 'ne', { x: 0, y: 0 }, null);
expect(tiny.widthFt).toBe(0.5);
expect(tiny.depthFt).toBe(0.5);
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm vitest run src/lib/geometry/viewport.test.ts src/lib/geometry/transform.test.ts` → FAIL

- [ ] **Step 3: Implement**

`rotateWorld(v, θ)` = `(x cosθ + y sinθ, −x sinθ + y cosθ)`. `angleFromPointer` = `atan2(dx, dy)` in degrees, normalized, then rounded to `snapDeg` if given. `resizeFromCorner`: compute the opposite (fixed) corner in world space, express the pointer relative to it in local axes (`rotateWorld(·, −rotation)`), take the **signed** extent along the dragged corner's directions (e.g. for `ne`, +x and +y), snap each to `step` (if any), clamp to `minFt` (so dragging past the fixed corner yields the minimum, not a flip), and place the new center at fixed corner + half the extents along those directions.

- [ ] **Step 4: Run to verify pass** → PASS

- [ ] **Step 5: Commit**

`git add src/lib/geometry && git commit -m "feat: viewport math and footprint transforms"`

---

### Task 4: Plan document schema, placeholder catalog, labels

**Files:**

- Create: `src/lib/model/plan.ts`, `plan.test.ts`, `src/lib/catalog/types.ts`, `entries.ts`, `index.ts`, `catalog.test.ts`, `src/lib/catalog/svg/{paper,popper,steel-static,barrel,dump-box,shooting-position}.svg`, `src/lib/editor/labels.ts`, `labels.test.ts`

**Interfaces:**

- Consumes: `SnapSetting`, `LengthUnit` (Task 2).
- Produces:
  - Zod schemas + inferred types in `model/plan.ts`:
    - `PlanObject = { id: string (uuid); symbolId: string; x: number; y: number; rotation: number (≥0, <360); label?: string (≤ 24 chars); count?: number (int 1–99); widthFt?: number (>0); depthFt?: number (>0); z: number (int) }`. All numbers finite.
    - `StageBrief = { matchName, stageNumber, stageName, startPosition, gunReady, procedure, roundCount, parTime: string; targetsOverride: string | null; notes: { id: string; title: string; body: string }[] }`
    - `ScaleBreak = { fromFt: number; toFt: number }` (from < to)
    - `PlanDisplay = { snap: SnapSetting; symbolSize: 'small' | 'medium' | 'large'; showGrid: boolean }`
    - `PlanDocument = { brief: StageBrief; objects: PlanObject[]; annotations: unknown[] (Plan 2 defines it; schema = empty array for now); scaleBreaks: ScaleBreak[]; display: PlanDisplay }`
    - `PlanDocumentSchema`, `emptyPlanDocument(): PlanDocument` (snap `'1ft'`, symbolSize `'medium'`, showGrid `true`, all strings `''`, `targetsOverride: null`, empty arrays)
    - `SYMBOL_PX: Record<'small' | 'medium' | 'large', number> = { small: 24, medium: 32, large: 44 }`
  - `catalog/types.ts`: `type Category = 'target' | 'prop' | 'structure' | 'area' | 'marker'`; `type CatalogEntry = { id; name; aliases: string[]; category: Category; countable: boolean; autoLabel?: { prefix: string; style: 'number' | 'letter' } } & ({ kind: 'symbol'; svg: string; anchor: 'base' | 'center' } | { kind: 'footprint'; footprint: { style: 'solid' | 'outline' | 'line'; widthFt: number; depthFt: number } })`
  - `catalog/index.ts`: `CATALOG: readonly CatalogEntry[]`, `CATEGORY_ORDER: Category[] = ['target', 'prop', 'structure', 'area', 'marker']`, `CATEGORY_LABEL: Record<Category, string>` (`Targets`, `Props`, `Structures`, `Areas`, `Markers`), `getEntry(id: string): CatalogEntry | undefined`, `searchCatalog(query: string): CatalogEntry[]`
  - `editor/labels.ts`: `nextLabel(objects: PlanObject[], entry: CatalogEntry): string | undefined`

Placeholder entries (Plan 3 replaces the art, keeps ids):

| id                  | name              | category  | kind                       | details                                                                       |
| ------------------- | ----------------- | --------- | -------------------------- | ----------------------------------------------------------------------------- |
| `paper`             | Paper target      | target    | symbol, base               | countable                                                                     |
| `popper`            | Popper            | target    | symbol, base               | countable; aliases `pepper popper`                                            |
| `steel-static`      | Static steel      | target    | symbol, base               | countable; aliases `steel plate`, `plate`                                     |
| `barrel`            | Barrel            | prop      | symbol, center             | aliases `drum`                                                                |
| `dump-box`          | Dump box          | prop      | symbol, center             | autoLabel `{ prefix: '', style: 'letter' }`                                   |
| `shooting-position` | Shooting position | marker    | symbol, center             | autoLabel `{ prefix: 'SA-', style: 'number' }`; aliases `shooting area`, `SA` |
| `wall`              | Wall              | structure | footprint solid 8 × 0.5 ft |                                                                               |
| `shooting-box`      | Shooting box      | area      | footprint outline 4 × 4 ft |                                                                               |
| `start-box`         | Start box         | area      | footprint outline 3 × 3 ft |                                                                               |
| `fault-line`        | Fault line        | area      | footprint line 8 × 0.25 ft |                                                                               |

Glyph SVGs use `viewBox="0 0 100 100"`, a single stroke weight, and `currentColor`, so they render in black and white.

- [ ] **Step 1: Write the failing tests**

```ts
// plan.test.ts
const doc = emptyPlanDocument();
expect(PlanDocumentSchema.parse(doc)).toEqual(doc);
expect(doc.display).toEqual({ snap: '1ft', symbolSize: 'medium', showGrid: true });
const obj = { id: crypto.randomUUID(), symbolId: 'popper', x: 1, y: 2, rotation: 0, z: 0 };
expect(PlanDocumentSchema.safeParse({ ...doc, objects: [{ ...obj, count: 0 }] }).success).toBe(
	false
);
expect(PlanDocumentSchema.safeParse({ ...doc, objects: [{ ...obj, rotation: 360 }] }).success).toBe(
	false
);
expect(PlanDocumentSchema.safeParse({ ...doc, objects: [{ ...obj, x: Number.NaN }] }).success).toBe(
	false
);
expect(
	PlanDocumentSchema.safeParse({ ...doc, scaleBreaks: [{ fromFt: 50, toFt: 40 }] }).success
).toBe(false);

// catalog.test.ts
expect(new Set(CATALOG.map((e) => e.id)).size).toBe(CATALOG.length);
for (const e of CATALOG) {
	if (e.kind === 'symbol') expect(e.svg).toContain('<svg');
	else expect(e.footprint.widthFt).toBeGreaterThan(0);
}
expect(getEntry('popper')?.name).toBe('Popper');
expect(getEntry('nope')).toBeUndefined();
expect(searchCatalog('pepper').map((e) => e.id)).toEqual(['popper']);
expect(searchCatalog('WALL').map((e) => e.id)).toEqual(['wall']);
expect(searchCatalog('').length).toBe(CATALOG.length);

// labels.test.ts
const sa = getEntry('shooting-position')!;
const dump = getEntry('dump-box')!;
const o = (symbolId: string, label?: string) => ({
	id: crypto.randomUUID(),
	symbolId,
	x: 0,
	y: 0,
	rotation: 0,
	z: 0,
	label
});
expect(nextLabel([], sa)).toBe('SA-1');
expect(nextLabel([o('shooting-position', 'SA-1'), o('shooting-position', 'SA-3')], sa)).toBe(
	'SA-4'
);
expect(nextLabel([o('dump-box', 'A'), o('dump-box', 'B')], dump)).toBe('C');
expect(
	nextLabel(
		Array.from({ length: 26 }, (_, i) => o('dump-box', String.fromCharCode(65 + i))),
		dump
	)
).toBe('AA');
expect(nextLabel([], getEntry('popper')!)).toBeUndefined();
```

- [ ] **Step 2: Run to verify failure** — `pnpm vitest run src/lib/model src/lib/catalog src/lib/editor/labels.test.ts` → FAIL

- [ ] **Step 3: Implement** the schemas, entries (SVGs imported with `?raw`), search (case-insensitive substring over name and aliases, catalog order preserved), and `nextLabel` (highest existing number + 1; letters continue A…Z, AA, AB…).

- [ ] **Step 4: Run to verify pass** → PASS

- [ ] **Step 5: Commit** — `git commit -m "feat: plan document schema, placeholder catalog, auto labels"`

---

### Task 5: Pure editor operations and undo history

**Files:**

- Create: `src/lib/editor/ops.ts`, `ops.test.ts`, `history.ts`, `history.test.ts`

**Interfaces:**

- Consumes: `PlanDocument`, `PlanObject` (Task 4), `CatalogEntry`, `getEntry`, `nextLabel` (Task 4), `snapPoint`, `CanvasSize`, `Point` (Task 2), `normalizeDegrees` (Task 3).
- Produces (all pure; never mutate inputs):
  - `addObject(doc: PlanDocument, entry: CatalogEntry, at: Point, canvas: CanvasSize, step: number | null): { doc: PlanDocument; id: string }` — snaps, clamps inside the canvas, `rotation 0`, `z` = max+1, `count: 1` if countable, footprint default size, `label` = `nextLabel(...)` when the entry has `autoLabel`.
  - `moveObjects(doc, ids: string[], delta: Point, canvas: CanvasSize): PlanDocument` — clamps each object inside the canvas.
  - `setObjectProps(doc, id: string, patch: Partial<Pick<PlanObject, 'x' | 'y' | 'rotation' | 'label' | 'count' | 'widthFt' | 'depthFt'>>, canvas: CanvasSize): PlanDocument` — normalizes rotation, clamps count to 1–99, sizes to ≥ 0.5 ft, positions inside the canvas.
  - `deleteObjects(doc, ids: string[]): PlanDocument`
  - `duplicateObjects(doc, ids: string[], offset: Point, canvas: CanvasSize): { doc: PlanDocument; ids: string[] }` — auto-labelled entries get fresh labels.
  - `reorder(doc, id: string, to: 'front' | 'back'): PlanDocument`
  - `history.ts`: `interface History<T> { readonly current: T; readonly canUndo: boolean; readonly canRedo: boolean; push(next: T): void; undo(): T; redo(): T }`; `createHistory<T>(initial: T, opts?: { limit?: number }): History<T>` (default limit 200; `undo`/`redo` at the ends return `current` unchanged).

- [ ] **Step 1: Write the failing tests**

```ts
// ops.test.ts  (canvas = { widthFt: 150, depthFt: 75 })
const popper = getEntry('popper')!,
	wall = getEntry('wall')!,
	sa = getEntry('shooting-position')!;
const a = addObject(emptyPlanDocument(), popper, { x: 10.4, y: 20.6 }, canvas, 1);
expect(a.doc.objects[0]).toMatchObject({
	id: a.id,
	symbolId: 'popper',
	x: 10,
	y: 21,
	rotation: 0,
	count: 1,
	z: 0
});
expect(
	addObject(emptyPlanDocument(), wall, { x: 5, y: 5 }, canvas, null).doc.objects[0]
).toMatchObject({ widthFt: 8, depthFt: 0.5 });
const s1 = addObject(emptyPlanDocument(), sa, { x: 1, y: 1 }, canvas, null);
const s2 = addObject(s1.doc, sa, { x: 2, y: 1 }, canvas, null);
expect(s2.doc.objects.map((o) => o.label)).toEqual(['SA-1', 'SA-2']);
expect(
	addObject(emptyPlanDocument(), popper, { x: -5, y: 200 }, canvas, null).doc.objects[0]
).toMatchObject({ x: 0, y: 75 });
const before = structuredClone(a.doc);
const moved = moveObjects(a.doc, [a.id], { x: 5, y: -3 }, canvas);
expect(moved.objects[0]).toMatchObject({ x: 15, y: 18 });
expect(a.doc).toEqual(before); // input not mutated
expect(moveObjects(a.doc, [a.id], { x: 500, y: 0 }, canvas).objects[0].x).toBe(150);
expect(setObjectProps(a.doc, a.id, { rotation: -90 }, canvas).objects[0].rotation).toBe(270);
expect(setObjectProps(a.doc, a.id, { count: 0 }, canvas).objects[0].count).toBe(1);
expect(setObjectProps(a.doc, a.id, { count: 150 }, canvas).objects[0].count).toBe(99);
expect(deleteObjects(a.doc, [a.id, 'missing']).objects).toEqual([]);
const d = duplicateObjects(s2.doc, [s2.doc.objects[0].id], { x: 1, y: -1 }, canvas);
expect(d.ids).toHaveLength(1);
expect(d.doc.objects.at(-1)).toMatchObject({ x: 2, y: 0, label: 'SA-3' });
expect(d.ids[0]).not.toBe(s2.doc.objects[0].id);
const front = reorder(s2.doc, s2.doc.objects[0].id, 'front');
expect(front.objects.find((o) => o.label === 'SA-1')!.z).toBe(2);

// history.test.ts
const h = createHistory(1);
h.push(2);
h.push(3);
expect(h.current).toBe(3);
expect(h.undo()).toBe(2);
expect(h.undo()).toBe(1);
expect(h.canUndo).toBe(false);
expect(h.redo()).toBe(2);
h.push(9);
expect(h.canRedo).toBe(false);
const lim = createHistory(0, { limit: 3 });
[1, 2, 3, 4, 5].forEach((n) => lim.push(n));
lim.undo();
lim.undo();
lim.undo();
expect(lim.current).toBe(2);
expect(lim.canUndo).toBe(false);
```

- [ ] **Step 2: Run to verify failure** — `pnpm vitest run src/lib/editor` → FAIL
- [ ] **Step 3: Implement** `ops.ts` and `history.ts` to the signatures above.
- [ ] **Step 4: Run to verify pass** → PASS
- [ ] **Step 5: Commit** — `git commit -m "feat: pure editor operations and undo history"`

---

### Task 6: Local store (Dexie) with canvas and plan repositories

**Files:**

- Create: `src/lib/store/records.ts`, `db.ts`, `canvases.ts`, `plans.ts`, `index.ts`, `canvases.test.ts`, `plans.test.ts`

**Interfaces:**

- Consumes: `PlanDocumentSchema`, `emptyPlanDocument`, `PlanDocument` (Task 4), `LengthUnit` (Task 2).
- Produces:
  - `records.ts`: `type SyncMeta = { id: string; version: number; updatedAt: string; deletedAt: string | null; dirty: 0 | 1 }`; `type CanvasRecord = SyncMeta & { name: string; widthFt: number; depthFt: number; unit: LengthUnit }`; `type PlanRecord = SyncMeta & { matchId: string | null; stageOrder: number | null; sourceCanvasId: string | null; widthFt: number; depthFt: number; unit: LengthUnit; schemaVersion: 1; document: PlanDocument }`; `CanvasInputSchema` (name trimmed 1–80 chars; widthFt and depthFt finite, 3–3000; unit enum); `type CanvasInput`; `planTitle(plan: PlanRecord): string` (`"Stage 3 — Bunker"`, `"Stage 3"`, `"Bunker"`, or `"Untitled stage"`).
  - `db.ts`: `class MatchSketchDB extends Dexie { canvases!: Table<CanvasRecord, string>; plans!: Table<PlanRecord, string> }` with stores `canvases: 'id, name, updatedAt, dirty'`, `plans: 'id, updatedAt, matchId, dirty'`; `createDb(name = 'match-sketch'): MatchSketchDB`.
  - `canvases.ts`: `listCanvases(db): Promise<CanvasRecord[]>` (not deleted, by name), `createCanvas(db, input: CanvasInput): Promise<CanvasRecord>`, `updateCanvas(db, id, input: CanvasInput): Promise<CanvasRecord>`, `deleteCanvas(db, id): Promise<void>` (soft delete).
  - `plans.ts`: `listPlans(db): Promise<PlanRecord[]>` (not deleted, `updatedAt` desc), `createPlan(db, input: { canvas: CanvasInput; sourceCanvasId: string | null }): Promise<PlanRecord>`, `getPlan(db, id): Promise<PlanRecord | undefined>` (undefined if deleted), `savePlanDocument(db, id, document: PlanDocument): Promise<PlanRecord>`, `duplicatePlan(db, id): Promise<PlanRecord>` (brief.stageName = `(stageName || 'Untitled stage') + ' (copy)'`), `deletePlan(db, id): Promise<void>`.
  - Every write sets `dirty: 1` and a fresh `updatedAt`, and leaves `version` unchanged. Inputs are validated with Zod; invalid input rejects with `ZodError`.
  - `records.ts` also exports `now(): string`, a monotonic ISO timestamp: if the current millisecond is not later than the last value returned, it returns the last value + 1 ms. This keeps "most recently edited" ordering stable when writes land in the same millisecond.
  - `index.ts`: `getDb(): MatchSketchDB` (lazy browser singleton).

- [ ] **Step 1: Write the failing tests** (top of each file: `import 'fake-indexeddb/auto';` and `const db = createDb(\`test-${crypto.randomUUID()}\`)`in`beforeEach`)

```ts
// canvases.test.ts
const c = await createCanvas(db, { name: 'Bay B', widthFt: 150, depthFt: 75, unit: 'yd' });
expect(c).toMatchObject({ version: 0, dirty: 1, deletedAt: null, name: 'Bay B' });
expect(c.id).toMatch(/^[0-9a-f-]{36}$/);
await createCanvas(db, { name: 'Bay A', widthFt: 30, depthFt: 30, unit: 'ft' });
expect((await listCanvases(db)).map((x) => x.name)).toEqual(['Bay A', 'Bay B']);
// Review Focus #3
for (const bad of [0, -1, Number.NaN, 3001]) {
	await expect(
		createCanvas(db, { name: 'X', widthFt: bad, depthFt: 30, unit: 'ft' })
	).rejects.toThrow();
}
await expect(
	createCanvas(db, { name: '   ', widthFt: 30, depthFt: 30, unit: 'ft' })
).rejects.toThrow();
await deleteCanvas(db, c.id);
expect((await listCanvases(db)).map((x) => x.name)).toEqual(['Bay A']);
expect((await db.canvases.get(c.id))?.deletedAt).not.toBeNull();

// plans.test.ts
const bay = await createCanvas(db, { name: 'Bay A', widthFt: 150, depthFt: 75, unit: 'yd' });
const p = await createPlan(db, { canvas: bay, sourceCanvasId: bay.id });
expect(p).toMatchObject({
	widthFt: 150,
	depthFt: 75,
	unit: 'yd',
	sourceCanvasId: bay.id,
	schemaVersion: 1
});
expect(p.document).toEqual(emptyPlanDocument());
await updateCanvas(db, bay.id, { name: 'Bay A', widthFt: 300, depthFt: 75, unit: 'yd' });
expect((await getPlan(db, p.id))?.widthFt).toBe(150); // copy, not link
const bad = {
	...p.document,
	objects: [
		{ id: crypto.randomUUID(), symbolId: 'popper', x: 1, y: 1, rotation: 0, z: 0, count: 0 }
	]
};
await expect(savePlanDocument(db, p.id, bad)).rejects.toThrow();
const good = {
	...p.document,
	brief: { ...p.document.brief, stageNumber: '3', stageName: 'Bunker' }
};
await savePlanDocument(db, p.id, good);
expect((await getPlan(db, p.id))?.document).toEqual(good);
expect(planTitle((await getPlan(db, p.id))!)).toBe('Stage 3 — Bunker');
const dup = await duplicatePlan(db, p.id);
expect(dup.document.brief.stageName).toBe('Bunker (copy)');
expect((await listPlans(db))[0].id).toBe(dup.id);
await deletePlan(db, p.id);
expect(await getPlan(db, p.id)).toBeUndefined();
```

- [ ] **Step 2: Run to verify failure** — `pnpm vitest run src/lib/store` → FAIL
- [ ] **Step 3: Implement** to the interfaces above.
- [ ] **Step 4: Run to verify pass** → PASS
- [ ] **Step 5: Commit** — `git commit -m "feat: IndexedDB store with canvas and plan repositories"`

---

### Task 7: Home page canvas library

**Files:**

- Create: `src/lib/components/CanvasForm.svelte`, `tests/e2e/helpers.ts`, `tests/e2e/canvas-library.spec.ts`
- Modify: `src/routes/(app)/+page.svelte`

**Interfaces:**

- Consumes: `getDb`, `listCanvases`, `createCanvas`, `updateCanvas`, `deleteCanvas`, `CanvasInputSchema` (Task 6); `toFeet`, `fromFeet` (Task 2).
- Produces:
  - `CanvasForm.svelte` props: `{ initial?: { name: string; width: number; depth: number; unit: LengthUnit }; submitLabel: string; onsubmit: (input: CanvasInput, saveToLibrary: boolean) => void; oncancel?: () => void; showSaveToLibrary?: boolean }`.
    - `showSaveToLibrary` adds a **Save to my canvas library** checkbox.
    - `oncancel` adds a **Cancel** button.
    - Fields: **Name**, **Width**, **Depth**, **Unit** (options `Feet`, `Yards`; default `Yards`).
    - Width and Depth are `<input type="text" inputmode="decimal">`, not `type="number"`. Playwright can't fill letters into number inputs, and the form must show its own message for them anyway.
    - Values are entered in the chosen unit and converted to feet.
  - The home page has two `<section aria-labelledby>` regions with headings **Plans** and **Canvases**, so tests can scope by `getByRole('region', { name })`. Plans gets its content in Task 8.
  - Validation copy (exact): `Name is required`; `Enter a width between 3 and 3000 ft` / `Enter a width between 1 and 1000 yd`; the same pattern for depth.
  - Home: `<h1>Match Sketch</h1>`, a section with heading **Canvases** and a **New canvas** button that opens the form in a `<dialog>`. Each canvas row shows the name and `"<w> × <d> <unit>"` (e.g. `50 × 25 yd`), with **Edit** and **Delete** buttons. Delete asks "Delete canvas "<name>"?" with **Delete** / **Cancel**.
  - `helpers.ts`: `createCanvas(page, c: { name: string; width: string; depth: string; unit: 'Feet' | 'Yards' }): Promise<void>`

- [ ] **Step 1: Write the failing e2e tests**

```ts
// canvas-library.spec.ts
test('create a canvas and keep it after reload', async ({ page }) => {
	await page.goto('/');
	await createCanvas(page, { name: 'Bay A', width: '50', depth: '25', unit: 'Yards' });
	const row = page.getByRole('listitem').filter({ hasText: 'Bay A' });
	await expect(row).toContainText('50 × 25 yd');
	await page.reload();
	await expect(row).toContainText('50 × 25 yd');
});
test('rejects bad dimensions and saves nothing', async ({ page }) => {
	// Review Focus #3
	await page.goto('/');
	await page.getByRole('button', { name: 'New canvas' }).click();
	await page.getByLabel('Name').fill('Bad');
	await page.getByLabel('Unit').selectOption({ label: 'Yards' });
	for (const v of ['', '0', '-5', 'abc', '1001']) {
		await page.getByLabel('Width').fill(v);
		await page.getByLabel('Depth').fill('25');
		await page.getByRole('button', { name: 'Save canvas' }).click();
		await expect(page.getByText('Enter a width between 1 and 1000 yd')).toBeVisible();
	}
	await page.getByRole('button', { name: 'Cancel' }).click();
	await expect(page.getByRole('listitem').filter({ hasText: 'Bad' })).toHaveCount(0);
});
test('edit and delete a canvas', async ({ page }) => {
	await page.goto('/');
	await createCanvas(page, { name: 'Bay A', width: '50', depth: '25', unit: 'Yards' });
	const row = page.getByRole('listitem').filter({ hasText: 'Bay A' });
	await row.getByRole('button', { name: 'Edit' }).click();
	await page.getByLabel('Width').fill('60');
	await page.getByRole('button', { name: 'Save canvas' }).click();
	await expect(row).toContainText('60 × 25 yd');
	await row.getByRole('button', { name: 'Delete' }).click();
	await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
	await expect(row).toHaveCount(0);
});
```

- [ ] **Step 2: Run to verify failure** — `pnpm exec playwright test tests/e2e/canvas-library.spec.ts` → FAIL
- [ ] **Step 3: Implement** `CanvasForm.svelte` (submit label "Save canvas"), the home Canvases section, and the e2e helper.
- [ ] **Step 4: Run to verify pass** → PASS; also `pnpm check`.
- [ ] **Step 5: Commit** — `git commit -m "feat: canvas library on the home page"`

---

### Task 8: New plan flow, plan list, editor shell with bay, grid, pan and zoom

**Files:**

- Create: `src/routes/(app)/plans/new/+page.svelte`, `src/routes/(app)/plans/[id]/+page.svelte`, `src/lib/editor/editor-state.svelte.ts`, `src/lib/editor/components/{EditorCanvas,BayLayer,ScaleBar,Toolbar}.svelte`, `tests/e2e/new-plan.spec.ts`
- Modify: `src/routes/(app)/+page.svelte` (Plans section), `tests/e2e/helpers.ts`

**Interfaces:**

- Consumes: repositories (Task 6), `CanvasForm` (Task 7), viewport and grid functions (Tasks 2–3), `createHistory` (Task 5).
- Produces:
  - `EditorState` (Svelte 5 class, `$state` fields):
    ```ts
    class EditorState {
    	constructor(plan: PlanRecord, deps: { save: (doc: PlanDocument) => Promise<void> });
    	readonly plan: PlanRecord; // dims + unit
    	readonly canvas: CanvasSize;
    	doc: PlanDocument; // preview ?? history.current
    	viewport: Viewport;
    	selection: string[];
    	armedSymbolId: string | null;
    	saveStatus: 'saved' | 'saving' | 'error';
    	commit(next: PlanDocument): void; // history.push + deps.save
    	setPreview(doc: PlanDocument | null): void;
    	fit(screen: Size): void;
    	zoomBy(factor: number, at?: Point): void;
    	panBy(dxPx: number, dyPx: number): void;
    	snapStep(): number | null; // from doc.display.snap
    }
    ```
    In this task `deps.save` is `(doc) => savePlanDocument(getDb(), plan.id, doc)`. Undo/redo UI and save status come in Task 12.
  - New plan page:
    - Radio **Use a saved canvas**, with a select labeled **Canvas**. This is the default when any canvases exist; otherwise the radio is disabled.
    - Radio **New canvas**, which shows `CanvasForm` with `showSaveToLibrary`.
    - The **Create plan** button (the form's `submitLabel` in New canvas mode) navigates to `/plans/<id>`.
  - Home **Plans** section: a **New plan** link to `/plans/new`; rows show `planTitle`, the dimensions, and buttons **Open**, **Duplicate**, **Delete** (with confirm).
  - Editor page: loads the plan; if it's missing, shows "Plan not found" with a link home. Toolbar shows the dimensions (`50 × 25 yd`) and buttons **Zoom in**, **Zoom out**, **Fit**. The canvas renders the bay (`data-testid="bay"`), grid lines at `gridSpacing(snapStep ?? 1, scale)` when `showGrid` is on, a downrange arrow labeled "Downrange" at the top edge, and the scale bar (`data-testid="scale-bar"`) with its label. Wheel zooms at the cursor; dragging empty space pans (mouse, pen, or one finger); a two-finger pinch zooms about the pinch midpoint. The view fits on load and on window resize until the user zooms or pans.

- [ ] **Step 1: Write the failing e2e tests**

```ts
// new-plan.spec.ts
test('plan from a saved canvas opens the editor at the right shape', async ({ page }) => {
	await page.goto('/');
	await createCanvas(page, { name: 'Bay A', width: '50', depth: '25', unit: 'Yards' });
	await page.getByRole('link', { name: 'New plan' }).click();
	await page.getByLabel('Use a saved canvas').check();
	await page.getByRole('combobox', { name: 'Canvas' }).selectOption({ label: 'Bay A' });
	await page.getByRole('button', { name: 'Create plan' }).click();
	await expect(page).toHaveURL(/\/plans\/[0-9a-f-]{36}$/);
	await expect(page.getByText('50 × 25 yd')).toBeVisible();
	const box = (await page.getByTestId('bay').boundingBox())!;
	expect(box.width / box.height).toBeCloseTo(2, 1);
	await expect(page.getByTestId('scale-bar')).toContainText('yd');
});
test('new canvas saved to the library from the new plan flow', async ({ page }) => {
	await page.goto('/plans/new');
	await page.getByLabel('New canvas').check();
	await page.getByLabel('Name').fill('Rifle bay');
	await page.getByLabel('Width').fill('100');
	await page.getByLabel('Depth').fill('300');
	await page.getByLabel('Unit').selectOption({ label: 'Yards' });
	await page.getByLabel('Save to my canvas library').check();
	await page.getByRole('button', { name: 'Create plan' }).click();
	await page.goto('/');
	await expect(page.getByRole('listitem').filter({ hasText: 'Rifle bay' })).toContainText(
		'100 × 300 yd'
	);
});
test('very long bay still fits and draws a sane grid', async ({ page }) => {
	// Review Focus #2
	await page.goto('/plans/new');
	await page.getByLabel('New canvas').check();
	await page.getByLabel('Name').fill('Long');
	await page.getByLabel('Width').fill('50');
	await page.getByLabel('Depth').fill('1000');
	await page.getByLabel('Unit').selectOption({ label: 'Yards' });
	await page.getByRole('button', { name: 'Create plan' }).click();
	const bay = (await page.getByTestId('bay').boundingBox())!;
	const vp = page.viewportSize()!;
	expect(bay.height).toBeLessThanOrEqual(vp.height);
	expect(await page.locator('[data-testid="grid"] line').count()).toBeLessThan(400);
});
test('zoom and fit', async ({ page }) => {
	await page.goto('/');
	await createCanvas(page, { name: 'Bay A', width: '50', depth: '25', unit: 'Yards' });
	await createPlanFromCanvas(page, 'Bay A');
	const w0 = (await page.getByTestId('bay').boundingBox())!.width;
	await page.getByRole('button', { name: 'Zoom in' }).click();
	expect((await page.getByTestId('bay').boundingBox())!.width).toBeGreaterThan(w0);
	await page.getByRole('button', { name: 'Fit' }).click();
	expect((await page.getByTestId('bay').boundingBox())!.width).toBeCloseTo(w0, 0);
});
test('plans list: duplicate and delete', async ({ page }) => {
	await page.goto('/');
	await createCanvas(page, { name: 'Bay A', width: '50', depth: '25', unit: 'Yards' });
	await createPlanFromCanvas(page, 'Bay A');
	await page.goto('/');
	const plans = page.getByRole('region', { name: 'Plans' });
	await plans.getByRole('button', { name: 'Duplicate' }).click();
	await expect(plans.getByText('Untitled stage (copy)')).toBeVisible();
	await plans
		.getByRole('listitem')
		.filter({ hasText: '(copy)' })
		.getByRole('button', { name: 'Delete' })
		.click();
	await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
	await expect(plans.getByRole('listitem')).toHaveCount(1);
});
```

Add to `helpers.ts`: `createPlanFromCanvas(page, canvasName: string): Promise<string>` (returns the plan id from the URL).

- [ ] **Step 2: Run to verify failure** — `pnpm exec playwright test tests/e2e/new-plan.spec.ts` → FAIL
- [ ] **Step 3: Implement** the routes, `EditorState`, and the canvas, bay, grid (`<g data-testid="grid">` of `<line>` elements), scale bar, and toolbar.
- [ ] **Step 4: Run to verify pass** → PASS; `pnpm check`.
- [ ] **Step 5: Commit** — `git commit -m "feat: new plan flow and editor shell with bay, grid, pan and zoom"`

---

### Task 9: Symbol palette, placing objects, rendering objects

**Files:**

- Create: `src/lib/editor/components/{Palette,ObjectView}.svelte`, `tests/e2e/editor-place.spec.ts`
- Modify: `EditorCanvas.svelte`, `editor-state.svelte.ts`, `src/routes/(app)/plans/[id]/+page.svelte`, `tests/e2e/helpers.ts`

**Interfaces:**

- Consumes: `CATALOG`, `CATEGORY_ORDER`, `CATEGORY_LABEL`, `searchCatalog`, `getEntry` (Task 4); `addObject` (Task 5); `screenToWorld`, `worldToScreen` (Task 3); `SYMBOL_PX` (Task 4).
- Produces:
  - `EditorState.placeAt(symbolId: string, screenPt: Point): string` (adds the object and commits it; returns its id); `EditorState.arm(symbolId: string | null): void`.
  - Palette: a search box with placeholder `Search symbols`, groups headed by `CATEGORY_LABEL` in `CATEGORY_ORDER`, items `data-testid="palette-item-<id>"` showing the glyph and name.
    - **Drag** (pointer moves more than 4 px after pointerdown): a ghost follows the pointer; releasing over the editor SVG places the object at the snapped world point (clamped to the bay). Releasing anywhere else cancels.
    - **Tap/click** (no movement): arms the symbol (item shows pressed state, `aria-pressed="true"`). While armed, a tap/click on the canvas places it (instead of panning or selecting) and disarms. `Escape` disarms.
    - A newly placed object becomes the selection (`selection = [id]`).
  - `ObjectView`: `<g data-testid="object" data-object-id data-symbol-id>`.
    - Symbols are drawn at `SYMBOL_PX[doc.display.symbolSize]`, anchored at their base or center.
    - Footprints are drawn in world scale: `solid` = filled rect, `outline` = stroked rect, `line` = thick line.
    - The label renders as `<text data-testid="object-label">` under the object.
    - A count above 1 renders a cluster with a `×N` badge (`data-testid="object-count"`).
    - The outer `<g data-testid="object">` carries the screen `translate(...)`. An inner `<g transform="rotate(θ)">` applies rotation about the anchor, so tests can find `[transform*="rotate(90"]` inside the object.

- [ ] **Step 1: Write the failing e2e tests**

```ts
// editor-place.spec.ts  (beforeEach: canvas "Bay A" 50 × 25 yd, plan created, editor open)
test('drag a popper onto the bay', async ({ page }) => {
	const target = await bayPoint(page, 0.5, 0.5);
	await dragFromPalette(page, 'popper', target);
	const obj = page.getByTestId('object');
	await expect(obj).toHaveCount(1);
	await expect(obj).toHaveAttribute('data-symbol-id', 'popper');
});
test('shooting positions are numbered automatically', async ({ page }) => {
	await dragFromPalette(page, 'shooting-position', await bayPoint(page, 0.3, 0.8));
	await dragFromPalette(page, 'shooting-position', await bayPoint(page, 0.6, 0.8));
	await expect(page.getByTestId('object-label')).toHaveText(['SA-1', 'SA-2']);
});
test('search filters the palette', async ({ page }) => {
	await page.getByPlaceholder('Search symbols').fill('pepper');
	await expect(page.getByTestId('palette-item-popper')).toBeVisible();
	await expect(page.getByTestId('palette-item-wall')).toHaveCount(0);
});
test('dropping outside the stage places nothing', async ({ page }) => {
	const item = (await page.getByTestId('palette-item-barrel').boundingBox())!;
	await dragFromPalette(page, 'barrel', { x: item.x + item.width / 2, y: item.y + 60 });
	await expect(page.getByTestId('object')).toHaveCount(0);
});
test('tap a symbol then tap the bay to place it', async ({ page }) => {
	await page.getByTestId('palette-item-wall').click();
	await expect(page.getByTestId('palette-item-wall')).toHaveAttribute('aria-pressed', 'true');
	const p = await bayPoint(page, 0.5, 0.3);
	await page.mouse.click(p.x, p.y);
	await expect(page.getByTestId('object')).toHaveAttribute('data-symbol-id', 'wall');
});
```

Add to `helpers.ts`: `bayPoint(page, fx: number, fyFromTop: number): Promise<Point>` (a point inside the bay's bounding box) and `dragFromPalette(page, symbolId: string, to: Point): Promise<void>` (mouse down on the item, move in 10 steps, mouse up).

- [ ] **Step 2: Run to verify failure** — `pnpm exec playwright test tests/e2e/editor-place.spec.ts` → FAIL
- [ ] **Step 3: Implement** the palette, placement, and object rendering.
- [ ] **Step 4: Run to verify pass** → PASS
- [ ] **Step 5: Commit** — `git commit -m "feat: symbol palette, drag and tap placement, object rendering"`

---

### Task 10: Selection, moving, properties panel, keyboard shortcuts

**Files:**

- Create: `src/lib/editor/shortcuts.ts`, `shortcuts.test.ts`, `src/lib/editor/components/{SelectionOverlay,PropertiesPanel}.svelte`, `tests/e2e/editor-edit.spec.ts`
- Modify: `EditorCanvas.svelte`, `Toolbar.svelte`, `editor-state.svelte.ts`

**Interfaces:**

- Consumes: `moveObjects`, `setObjectProps`, `deleteObjects`, `duplicateObjects`, `reorder` (Task 5); `snapPoint` (Task 2); `fromFeet`, `toFeet` (Task 2).
- Produces:
  - `shortcuts.ts`: `type EditorCommand = 'undo' | 'redo' | 'delete' | 'duplicate' | 'deselect' | 'nudge-left' | 'nudge-right' | 'nudge-up' | 'nudge-down'`. `commandForKey(e: { key: string; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }, target: { tagName: string; isContentEditable: boolean }): EditorCommand | null`. It returns `null` whenever the target is `INPUT`, `TEXTAREA`, or `SELECT`, or is content-editable. Mapping:
    - Delete/Backspace → `delete`
    - Mod+Z → `undo`
    - Mod+Shift+Z or Mod+Y → `redo`
    - Mod+D → `duplicate`
    - Escape → `deselect`
    - Arrow keys → `nudge-*` (Mod = Ctrl or Meta)
  - `EditorState`:
    - `select(ids: string[], mode: 'replace' | 'toggle')`, `clearSelection()`, `deleteSelected()`, `duplicateSelected()` (offset 1 snap step or 1 ft right and down, then selects the copies)
    - `nudge(dir: 'left' | 'right' | 'up' | 'down')` (by `snapStep() ?? 1` ft; "up" = downrange)
    - `setProps(id, patch)`, `bringToFront(id)`, `sendToBack(id)`
    - `setDisplay(patch: Partial<PlanDisplay>)`
    - `beginMove(id: string, screenPt: Point)`, `updateMove(screenPt: Point)`, `endMove()`. Moves preview while dragging and commit once on release. With snap on, the dragged object's new position is snapped and the same delta applies to the other selected objects.
  - Pointer behavior:
    - Pointerdown on an object selects it (Shift toggles) and starts a move.
    - Pointerdown on empty space clears the selection and pans.
    - All drags use `setPointerCapture`.
  - `SelectionOverlay`: a dashed outline (`data-testid="selection"`) around each selected object.
  - `PropertiesPanel` (`<aside aria-label="Properties">`), for a single selection:
    - Fields: **Label** (text), **Count** (number; targets only), **Rotation (°)**, **X** and **Y** (in the plan's unit), **Width** and **Depth** (footprints only, in the plan's unit).
    - Fields commit on change (blur or Enter).
    - Buttons: **Duplicate**, **Delete**, **Bring to front**, **Send to back**.
    - With nothing selected it shows "Select an object to edit it".
  - Toolbar additions: **Snap** select (`Off`, `1 ft`, `1 yd`, `5 yd`) and **Symbol size** select (`Small`, `Medium`, `Large`).

- [ ] **Step 1: Write the failing tests**

```ts
// shortcuts.test.ts
const key = (
	k: string,
	o: Partial<{ ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }> = {}
) => ({ key: k, ctrlKey: false, metaKey: false, shiftKey: false, ...o });
const body = { tagName: 'BODY', isContentEditable: false };
expect(commandForKey(key('Backspace'), body)).toBe('delete');
expect(commandForKey(key('z', { ctrlKey: true }), body)).toBe('undo');
expect(commandForKey(key('z', { metaKey: true, shiftKey: true }), body)).toBe('redo');
expect(commandForKey(key('y', { ctrlKey: true }), body)).toBe('redo');
expect(commandForKey(key('d', { ctrlKey: true }), body)).toBe('duplicate');
expect(commandForKey(key('ArrowUp'), body)).toBe('nudge-up');
// Review Focus #1
for (const tagName of ['INPUT', 'TEXTAREA', 'SELECT']) {
	expect(commandForKey(key('Backspace'), { tagName, isContentEditable: false })).toBeNull();
	expect(
		commandForKey(key('z', { ctrlKey: true }), { tagName, isContentEditable: false })
	).toBeNull();
}
expect(commandForKey(key('Delete'), { tagName: 'DIV', isContentEditable: true })).toBeNull();
```

```ts
// editor-edit.spec.ts  (beforeEach: plan on "Bay A" 50 × 25 yd, a popper dropped at bay center)
test('select shows properties; count shows a badge', async ({ page }) => {
	await page.getByTestId('object').click();
	const props = page.getByRole('complementary', { name: 'Properties' });
	await expect(props.getByLabel('Count')).toHaveValue('1');
	await props.getByLabel('Count').fill('3');
	await props.getByLabel('Count').press('Enter');
	await expect(page.getByTestId('object-count')).toHaveText('×3');
});
test('moving with 1 yd snap lands on whole yards', async ({ page }) => {
	await page.getByRole('combobox', { name: 'Snap' }).selectOption({ label: '1 yd' });
	const o = (await page.getByTestId('object').boundingBox())!;
	await page.mouse.move(o.x + o.width / 2, o.y + o.height / 2);
	await page.mouse.down();
	await page.mouse.move(o.x + o.width / 2 + 37, o.y + o.height / 2 - 23, { steps: 5 });
	await page.mouse.up();
	const props = page.getByRole('complementary', { name: 'Properties' });
	expect(Number(await props.getByLabel('X').inputValue()) % 1).toBe(0);
	expect(Number(await props.getByLabel('Y').inputValue()) % 1).toBe(0);
});
test('rotation field rotates the object', async ({ page }) => {
	await page.getByTestId('object').click();
	const rot = page.getByRole('complementary', { name: 'Properties' }).getByLabel('Rotation (°)');
	await rot.fill('90');
	await rot.press('Enter');
	await expect(page.getByTestId('object').locator('[transform*="rotate(90"]')).toHaveCount(1);
});
test('Backspace in the Label field edits text, not the stage', async ({ page }) => {
	// Review Focus #1
	await page.getByTestId('object').click();
	const label = page.getByRole('complementary', { name: 'Properties' }).getByLabel('Label');
	await label.fill('T1');
	await label.press('Backspace');
	await expect(page.getByTestId('object')).toHaveCount(1);
	await expect(label).toHaveValue('T');
});
test('Delete key removes, Ctrl+D duplicates', async ({ page }) => {
	await page.getByTestId('object').click();
	await page.keyboard.press('Control+d');
	await expect(page.getByTestId('object')).toHaveCount(2);
	await page.keyboard.press('Delete');
	await expect(page.getByTestId('object')).toHaveCount(1);
});
test('symbol size Large draws a bigger glyph', async ({ page }) => {
	const w0 = (await page.getByTestId('object').boundingBox())!.width;
	await page.getByRole('combobox', { name: 'Symbol size' }).selectOption({ label: 'Large' });
	expect((await page.getByTestId('object').boundingBox())!.width).toBeGreaterThan(w0);
});
test.describe('touch', () => {
	// Review Focus #5
	test.use({ hasTouch: true, viewport: { width: 1180, height: 820 } });
	test('tap selects and a touch drag moves', async ({ page }) => {
		const o = (await page.getByTestId('object').boundingBox())!;
		await page.touchscreen.tap(o.x + o.width / 2, o.y + o.height / 2);
		await expect(page.getByTestId('selection')).toHaveCount(1);
		const x0 = await page
			.getByRole('complementary', { name: 'Properties' })
			.getByLabel('X')
			.inputValue();
		const at = (dx: number) => ({
			pointerType: 'touch',
			isPrimary: true,
			pointerId: 7,
			bubbles: true,
			clientX: o.x + o.width / 2 + dx,
			clientY: o.y + o.height / 2
		});
		await page.getByTestId('object').dispatchEvent('pointerdown', at(0));
		await page.getByTestId('object').dispatchEvent('pointermove', at(40));
		await page.getByTestId('object').dispatchEvent('pointerup', at(40));
		await expect(
			page.getByRole('complementary', { name: 'Properties' }).getByLabel('X')
		).not.toHaveValue(x0);
	});
});
```

The touch drag test dispatches pointer events on the object because Playwright has no multi-step touch drag. The editor must handle `pointermove`/`pointerup` delivered to the captured element. Wrap `setPointerCapture` in `try/catch`: synthetic events carry a pointer id the browser doesn't know, and the call throws.

- [ ] **Step 2: Run to verify failure** — `pnpm vitest run src/lib/editor/shortcuts.test.ts && pnpm exec playwright test tests/e2e/editor-edit.spec.ts` → FAIL
- [ ] **Step 3: Implement** shortcuts (listener on `window`, passing `document.activeElement` as the target), selection, moving, the properties panel, and the toolbar selects.
- [ ] **Step 4: Run to verify pass** → PASS
- [ ] **Step 5: Commit** — `git commit -m "feat: selection, moving, properties panel and shortcuts"`

---

### Task 11: Resize and rotate handles

**Files:**

- Create: `tests/e2e/editor-handles.spec.ts`
- Modify: `SelectionOverlay.svelte`, `editor-state.svelte.ts`

**Interfaces:**

- Consumes: `resizeFromCorner`, `angleFromPointer` (Task 3); `setObjectProps` (Task 5).
- Produces:
  - For a single selected object:
    - A rotate handle (`data-testid="handle-rotate"`), a circle 24 px beyond the object's top in its rotated frame.
    - Footprints also get corner handles `handle-ne`, `handle-nw`, `handle-se`, `handle-sw`.
    - Handles are at least 24 px for touch.
  - `EditorState`: `beginResize(id, corner: Corner)`, `beginRotate(id)`, `updateHandle(screenPt: Point, opts: { shiftKey: boolean })`, `endHandle()`. These preview while dragging and commit once on release.
    - Resize snaps sizes to `snapStep()`.
    - Rotation snaps to 15°; hold Shift for free rotation.

- [ ] **Step 1: Write the failing e2e tests**

```ts
// editor-handles.spec.ts  (beforeEach: plan on "Bay A" 50 × 25 yd, snap "1 ft", a wall dropped at bay center and selected)
test('dragging the ne handle widens the wall', async ({ page }) => {
	const props = page.getByRole('complementary', { name: 'Properties' });
	const w0 = Number(await props.getByLabel('Width').inputValue());
	const h = (await page.getByTestId('handle-ne').boundingBox())!;
	await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
	await page.mouse.down();
	await page.mouse.move(h.x + h.width / 2 + 80, h.y + h.height / 2, { steps: 5 });
	await page.mouse.up();
	const w1 = Number(await props.getByLabel('Width').inputValue());
	expect(w1).toBeGreaterThan(w0);
	expect(w1 % 1).toBe(0);
});
test('dragging the rotate handle to the right rotates to 90°', async ({ page }) => {
	const o = (await page.getByTestId('object').boundingBox())!;
	const h = (await page.getByTestId('handle-rotate').boundingBox())!;
	await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
	await page.mouse.down();
	await page.mouse.move(o.x + o.width / 2 + 150, o.y + o.height / 2, { steps: 8 });
	await page.mouse.up();
	await expect(
		page.getByRole('complementary', { name: 'Properties' }).getByLabel('Rotation (°)')
	).toHaveValue('90');
});
test('symbols have a rotate handle but no corner handles', async ({ page }) => {
	await dragFromPalette(page, 'popper', await bayPoint(page, 0.2, 0.2));
	await page.locator('[data-testid="object"][data-symbol-id="popper"]').click();
	await expect(page.getByTestId('handle-rotate')).toHaveCount(1);
	await expect(page.getByTestId('handle-ne')).toHaveCount(0);
});
```

- [ ] **Step 2: Run to verify failure** — `pnpm exec playwright test tests/e2e/editor-handles.spec.ts` → FAIL
- [ ] **Step 3: Implement** the handles and handle drags.
- [ ] **Step 4: Run to verify pass** → PASS
- [ ] **Step 5: Commit** — `git commit -m "feat: resize and rotate handles"`

---

### Task 12: Undo/redo controls, save status, persistence

**Files:**

- Create: `tests/e2e/editor-history.spec.ts`
- Modify: `editor-state.svelte.ts`, `Toolbar.svelte`, `src/routes/(app)/plans/[id]/+page.svelte`

**Interfaces:**

- Consumes: `History` (Task 5), `savePlanDocument` (Task 6), `commandForKey` (Task 10).
- Produces:
  - `EditorState.undo()`, `EditorState.redo()`, `canUndo`, `canRedo`. Each undo/redo saves the resulting document.
  - Saving: every `commit`/undo/redo starts a save right away. The IndexedDB write must begin synchronously inside the call: no debounce, and no `await` before the `put`. That gives a reload right after an edit the best chance to keep it. Saves run one at a time; if more come in while one runs, only the latest document is written next. `saveStatus` goes `saving` → `saved`. On failure it becomes `error` and retries after 1 s, 2 s, 4 s (capped at 10 s) until it succeeds.
  - Toolbar: **Undo** and **Redo** buttons (disabled when unavailable) and a status `<span data-testid="save-status">` showing `Saving…`, `Saved`, or `Not saved — retrying`.
  - Keyboard: the `undo` and `redo` commands from `commandForKey`.

- [ ] **Step 1: Write the failing e2e tests**

```ts
// editor-history.spec.ts  (beforeEach: plan on "Bay A" 50 × 25 yd, editor open)
test('undo and redo a move', async ({ page }) => {
	await expect(page.getByRole('button', { name: 'Undo' })).toBeDisabled();
	await dragFromPalette(page, 'popper', await bayPoint(page, 0.5, 0.5));
	const obj = page.getByTestId('object');
	const b0 = (await obj.boundingBox())!;
	await page.mouse.move(b0.x + b0.width / 2, b0.y + b0.height / 2);
	await page.mouse.down();
	await page.mouse.move(b0.x + b0.width / 2 + 100, b0.y + b0.height / 2, { steps: 5 });
	await page.mouse.up();
	await page.keyboard.press('Control+z');
	expect((await obj.boundingBox())!.x).toBeCloseTo(b0.x, 0);
	await page.getByRole('button', { name: 'Redo' }).click();
	expect((await obj.boundingBox())!.x).toBeGreaterThan(b0.x + 50);
	await page.getByRole('button', { name: 'Undo' }).click();
	await page.getByRole('button', { name: 'Undo' }).click();
	await expect(obj).toHaveCount(0);
});
test('an edit survives an immediate reload', async ({ page }) => {
	// Review Focus #4
	await dragFromPalette(page, 'barrel', await bayPoint(page, 0.4, 0.6));
	await page.reload();
	await expect(page.getByTestId('object')).toHaveAttribute('data-symbol-id', 'barrel');
});
test('save status settles on Saved', async ({ page }) => {
	await dragFromPalette(page, 'popper', await bayPoint(page, 0.5, 0.5));
	await expect(page.getByTestId('save-status')).toHaveText('Saved');
});
```

- [ ] **Step 2: Run to verify failure** — `pnpm exec playwright test tests/e2e/editor-history.spec.ts` → FAIL
- [ ] **Step 3: Implement** the undo/redo controls, the save queue with status and retry, and keyboard wiring.
- [ ] **Step 4: Run the whole suite** — `pnpm vitest run && pnpm exec playwright test && pnpm check && pnpm lint` → all PASS
- [ ] **Step 5: Commit** — `git commit -m "feat: undo/redo controls, save status and persistence"`
