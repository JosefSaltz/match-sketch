# Plan 3: Symbol Library Art — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Plan 1 placeholder art with the full first symbol set from spec §7.7, drawn in the chosen style A. That means 19 targets in families, 10 props, 16 structures, and the areas and markers, with aliases, plus to-scale footprint drawings for walls, ports, fences, berms and the rest.

**Architecture:** Symbols stay as standalone SVG files (`viewBox 0 0 100 100`) imported raw into the catalog. Footprints get a pure shape builder, `footprintShapes(style, w, h)`, which returns primitive SVG shapes in the object's local, centered frame. Stroke widths are in screen px, so walls and fences look the same at any zoom. One component draws footprints in the stage, the palette, and later the printout. A `/symbols` sheet shows every entry at the three editor sizes. A Playwright check uses it to prove nothing is clipped, and the sheet doubles as the grayscale review page.

**Tech Stack:** SvelteKit 3, Svelte 5, TypeScript, Vitest, Playwright. Hand-drawn SVG.

**Spec:** `docs/superpowers/specs/2026-11-21-match-sketch-design.md` — §7.7 (style A, catalog entry shape, first set), §7.3 (symbols vs footprints), §2 anti-goals (no legend, shape over color, original art only). Roadmap: Plan 3.

## Global Constraints

- **Style A ("Pictogram"):**
  - Symbol SVGs use `viewBox="0 0 100 100"` and a 5-unit `stroke="currentColor"` with round caps and joins.
  - Fills: paper `#d2ad72`; steel `#8d96a0`; props `#e9ecef`; no-shoot white `#fff` with a red X `#c0392b` 7 units wide.
  - Ink is `currentColor`. Never fill a whole glyph with `currentColor`; style A tints, it doesn't silhouette.
- **Orientation:** targets stand up, front-facing, with a stake or base ending at y ≈ 96 and `anchor: 'base'`. Props are drawn from above, centered, with `anchor: 'center'` (the barrel convention). Footprints are drawn from above, to scale.
- **Black and white:** every symbol must be told apart by **shape** when printed in grayscale. Color is a bonus.
- **Containment:** a symbol's drawn content, including half its stroke, stays inside 0–100 on both axes.
- **Footprint strokes:** fixed in screen px: ink 2 px, details 1.25 px, thin-line minimum 3 px (`LINE_MIN_PX`).
- **Ids:** keep every Plan 1 id: `paper`, `popper`, `popper-static`, `popper-trigger`, `popper-auto-reset`, `steel-static`, `barrel`, `dump-box`, `shooting-position`, `wall`, `shooting-box`, `start-box`, `fault-line`. Saved plans reference them.
- **Original art only.** No clip art, no traced logos.
- Every `.svelte` file passes the Svelte MCP autofixer. Commits are atomic and Angular style, per `AGENTS.md`.

## Decisions

1. **Families:** Paper (paper, small paper, hard cover, no-shoot), Poppers (as in Plan 1), Steel (static steel, KD plate, stop plate, plate rack, ducks in a row, bottle), and Movers (swinger, flasher, spinner, Texas star, whirly-gig).
2. **No-shoots are targets,** so the Targets tally counts them ("2 no-shoots"), as the reference plans do.
3. **Tally casing:** names are lowercased in the tally unless the entry sets `keepCase: true`. That covers "KD plate" and "Texas star".
4. **Dump box** stays a prop and **shooting position** a marker, as in Plan 1.
5. **The `/symbols` sheet is a hidden app route.** No menu links to it. It exists for the clipping check and for review.

## Review Focus

1. **A saved plan with a Plan 1 placeholder id** opens with the new art in the same place and at the same size class. → Task 4 (e2e: reload a plan placed before the redraw).
2. **A footprint resized very thin or very small** (e.g. a fence 0.5 ft deep, a berm 1 × 1 ft) still draws visibly, with no NaN and no negative sizes. → Task 1 (unit).
3. **Grayscale:** the five steel targets and the four poppers can be told apart without color. → Task 5 (user review of the grayscale sheet).
4. **Palette search** finds a symbol by a common alias ("pepper popper", "IPSC", "sticks", "mound"), and no alias is shared by two entries. → Task 2 and Task 3 (unit).
5. **The Targets tally** reads naturally for the new targets ("1 Texas star, 2 KD plates, 3 no-shoots"). → Task 2 (unit).

---

## File Structure

```
src/lib/catalog/
  types.ts                 + FootprintStyle union, keepCase
  entries.ts               the full set (ids, names, aliases, families, sizes)
  footprint-shapes.ts      footprintShapes(style, w, h): Shape[]
  footprint-shapes.test.ts
  svg/*.svg                one file per symbol entry, style A
src/lib/ui/FootprintShape.svelte   renders footprintShapes in a <g>
src/lib/editor/components/ObjectView.svelte, Palette.svelte   use FootprintShape
src/lib/brief/tally.ts     keepCase
src/routes/(app)/symbols/+page.svelte   the symbol sheet
tests/e2e/symbols.spec.ts
```

---

### Task 1: Footprint shapes

**Files:**

- Create: `src/lib/catalog/footprint-shapes.ts`, `footprint-shapes.test.ts`, `src/lib/ui/FootprintShape.svelte`
- Modify: `src/lib/catalog/types.ts`, `src/lib/editor/components/ObjectView.svelte`, `src/lib/editor/components/Palette.svelte`

**Interfaces:**

- Produces:
  - `type FootprintStyle = 'solid' | 'outline' | 'line' | 'start-box' | 'wall-port' | 'half-wall-port' | 'v-wall' | 'door' | 'car' | 'table' | 'pallet' | 'bench' | 'stairs' | 'platform' | 'wobble' | 'barrier' | 'berm' | 'fence'`; `FootprintEntry.footprint.style: FootprintStyle`.
  - `type Shape = { el: 'rect' | 'line' | 'path' | 'circle'; attrs: Record<string, number | string>; paint: 'fill' | 'tint' | 'hit' | 'ink' | 'detail' }`, where:
    - `fill` is solid ink at 0.75 opacity;
    - `tint` is a light fill `#e9ecef` with an ink outline;
    - `hit` is transparent, but clickable, with an ink outline;
    - `ink` is a 2 px stroke with no fill;
    - `detail` is a 1.25 px stroke with no fill.
  - `footprintShapes(style: FootprintStyle, w: number, h: number): Shape[]`. Here `w` and `h` are the box in **px**, centered on (0, 0), so x runs from −w/2 to w/2 and y from −h/2 to h/2, with y pointing down on screen. The shapes stay inside the box, and `line` thickens to at least 3 px. The drawing for each style:

    | Style | Drawing |
    | --- | --- |
    | `solid` | a filled rect (wall) |
    | `outline` | a hit rect |
    | `line` | a filled bar, thickened to at least 3 px |
    | `start-box` | a hit rect plus a small inked triangle pointing downrange (up) |
    | `wall-port` | two filled rects with a ~30% gap at mid-width, and a detail line across the gap |
    | `half-wall-port` | the same layout as `wall-port`, using `tint` |
    | `v-wall` | two filled bars from the bottom corners meeting at the top center |
    | `door` | a filled leaf along the bottom edge, plus a detail quarter-circle swing |
    | `car` | a tinted rect with rounded corners and two detail windshield lines |
    | `table` | a tinted rect plus four detail leg dots |
    | `pallet` | a hit rect plus three detail slats |
    | `bench` | a tinted rect with rounded ends |
    | `stairs` | a hit rect plus detail step lines every ~1/5 of the depth |
    | `platform` | a tinted rect plus a detail diagonal hatch |
    | `wobble` | a tinted rect plus a detail rocker line and two arcs |
    | `barrier` | a detail rail plus two inked posts |
    | `berm` | a tinted rounded blob plus two detail contour lines |
    | `fence` | an ink line plus detail x-marks every ~12 px |

  - `FootprintShape.svelte` takes `{ style: FootprintStyle; width: number; height: number }` and renders the shapes. Paint classes are styled in the component. `ObjectView` replaces its inline footprint markup with it, and the palette's footprint thumbnails use it with the box fitted into 30 px.

- [ ] **Step 1: Write the failing tests**

```ts
const ALL: FootprintStyle[] = ['solid', 'outline', /* … every style … */ 'fence'];
it('draws every style inside its box', () => {
	for (const style of ALL) {
		const shapes = footprintShapes(style, 120, 40);
		expect(shapes.length).toBeGreaterThan(0);
		for (const s of shapes) expect(withinBox(s, 120, 40, 2)).toBe(true); // helper reads x/y/width/height, x1…y2, cx/cy/r, path numbers
	}
});
it('keeps the inside of an outline clickable', () => {
	expect(footprintShapes('outline', 50, 50)[0].paint).toBe('hit');
});
it('stays drawable when tiny or thin (Review Focus #2)', () => {
	for (const style of ALL) for (const [w, h] of [[2, 2], [60, 0.4], [0.4, 60]])
		for (const s of footprintShapes(style, w, h))
			for (const v of numbersIn(s)) expect(Number.isFinite(v)).toBe(true);
});
it('thickens a line to 3 px', () => { … height of the line bar ≥ 3 … });
```

- [ ] **Step 2: Run to verify failure:** `pnpm vitest run src/lib/catalog`. Expected: FAIL.
- [ ] **Step 3: Implement** the types, `footprintShapes`, `FootprintShape`, and the ObjectView and Palette changes.
- [ ] **Step 4: Run** the unit tests, the whole e2e suite (existing footprints keep working), `pnpm check`, `pnpm lint` and the autofixer. Expected: PASS.
- [ ] **Step 5: Commit:** `feat(catalog): draw footprints with shapes for walls, ports, fences and more`

---

### Task 2: Targets

**Files:**

- Create: `src/lib/catalog/svg/{paper-small,paper-hard-cover,no-shoot,swinger,plate-kd,plate-stop,plate-rack,ducks,bottle,flasher,spinner,texas-star,whirly-gig}.svg`
- Modify: `svg/{paper,popper,popper-static,popper-trigger,popper-auto-reset,steel-static}.svg` (redraw), `entries.ts`, `types.ts`, `catalog.test.ts`, `src/lib/brief/tally.ts`, `tally.test.ts`

**Interfaces:**

- Produces:
  - `FAMILIES`: `paper` "Paper", `poppers` "Poppers", `steel` "Steel", `movers` "Movers".
  - `BaseEntry.keepCase?: boolean`. `targetsTally` lowercases a name only when `keepCase` isn't set.
  - The target entries below. All are `category: 'target'`, `countable: true`, `kind: 'symbol'` and `anchor: 'base'`. Plurals not listed default to the name plus "s".

| id | name | family | aliases | notes |
| --- | --- | --- | --- | --- |
| paper | Paper target | paper | IPSC target, USPSA target, cardboard | |
| paper-small | Small paper target | paper | mini IPSC, small cardboard | |
| paper-hard-cover | Paper with hard cover | paper | hard cover, partial target | plural "Papers with hard cover" |
| no-shoot | No-shoot | paper | NS, no shoot, penalty target | |
| popper … popper-auto-reset | (unchanged names and aliases) | poppers | (unchanged) | |
| steel-static | Static steel | steel | steel plate, plate | plural "Static steel" |
| plate-kd | KD plate | steel | knock-down plate, falling plate | keepCase |
| plate-stop | Stop plate | steel | stop target, last target | |
| plate-rack | Plate rack | steel | row of plates, plate bank | |
| ducks | Ducks in a row | steel | duck targets, ducks | plural "Ducks in a row" |
| bottle | Bottle | steel | steel bottle | |
| swinger | Swinger | movers | swinging target, swinging paper | |
| flasher | Flasher | movers | disappearing target, bobber | |
| spinner | Spinner | movers | spinning target | |
| texas-star | Texas star | movers | star | keepCase |
| whirly-gig | Whirly-gig | movers | whirlygig | |

  - Art (style A). Paper is tan and steel is gray.
    - **Paper family:**
      - Paper target: the IPSC outline from the sample.
      - Small paper target: the same outline at about 70% size, on a taller stake.
      - Paper with hard cover: the outline with its lower half or one side filled black, as the cover.
      - No-shoot: a white outline with the red X.
    - **Poppers:** they keep their distinguishing marks from Plan 1:
      - static: a small foot block;
      - trigger: a cable from the base;
      - auto-reset: a circular arrow.
    - **Steel family:**
      - Static steel: a round plate on a post.
      - KD plate: a round plate tilted back on a hinge, with a small arc showing the fall.
      - Stop plate: a square plate with a heavy border.
      - Plate rack: five small plates on one bar.
      - Ducks in a row: three duck silhouettes on a rail.
      - Bottle: a bottle silhouette.
    - **Movers family:**
      - Swinger: a paper outline hanging from a pivot, with a swing arc.
      - Flasher: a paper outline half behind a cover bar, with a motion arc.
      - Spinner: two plates on a T-bar about a center pivot.
      - Texas star: the sample design.
      - Whirly-gig: three plates on arms about a center, with a rotation arrow.

- [ ] **Step 1: Write the failing tests**

```ts
// catalog.test.ts
it('has the full target set in families', () => {
	expect(CATALOG.filter((e) => e.category === 'target')).toHaveLength(19);
	for (const e of CATALOG.filter((e) => e.category === 'target')) {
		expect(e.family).toBeDefined();
		expect(e.countable).toBe(true);
		expect(e.kind === 'symbol' && e.anchor).toBe('base');
	}
});
it('no alias is shared, nor equal to another entry’s name (Review Focus #4)', () => { … });
it('finds targets by common aliases', () => {
	expect(searchCatalog('pepper').map((e) => e.id)).toEqual(['popper']);
	expect(searchCatalog('IPSC').map((e) => e.id)).toContain('paper');
});
// update the paletteGroups nesting expectation: Targets → ['family:paper', 'family:poppers', 'family:steel', 'family:movers']
// tally.test.ts (Review Focus #5)
it('keeps the case of proper names and abbreviations', () => {
	expect(targetsTally([obj('texas-star'), obj('plate-kd', { count: 2 }), obj('no-shoot', { count: 3 })])).toBe(
		'3 no-shoots, 2 KD plates, 1 Texas star'
	);
});
```

- [ ] **Step 2: Run to verify failure:** `pnpm vitest run src/lib/catalog src/lib/brief`. Expected: FAIL.
- [ ] **Step 3: Draw** the SVGs, then add the entries, families, `keepCase` and the tally change.
- [ ] **Step 4: Run** the unit tests, the whole e2e suite, `pnpm check` and `pnpm lint`. Expected: PASS.
- [ ] **Step 5: Commit:** `feat(catalog): draw the full target set in families`

---

### Task 3: Props and structures

**Files:**

- Create: `svg/{barrels-stacked,tire,chair,ammo-can,bucket,crate,tree,target-stand,sawhorse}.svg`
- Modify: `svg/barrel.svg` (redraw), `entries.ts`, `catalog.test.ts`

**Interfaces:**

- Produces:
  - **Props:** `category: 'prop'`, `kind: 'symbol'`, `anchor: 'center'`, `countable: false`, drawn from above with the light prop fill.

| id | name | aliases |
| --- | --- | --- |
| barrel | Barrel | drum, 55 gallon drum |
| barrels-stacked | Stacked barrels | barrel stack |
| tire | Tire | tyre, wheel |
| chair | Chair | seat |
| ammo-can | Ammo can | ammo box |
| bucket | Bucket | pail |
| crate | Crate | box, wooden box |
| tree | Tree | bush |
| target-stand | Target stand | target frame, stand |
| sawhorse | Sawhorse | saw horse |

  - **Structures:** `category: 'structure'`, `kind: 'footprint'`, `countable: false`. Default sizes are width × depth in ft.

| id | name | style | size | aliases |
| --- | --- | --- | --- | --- |
| wall | Wall | solid | 8 × 0.5 | partition, panel |
| wall-port | Wall with port | wall-port | 8 × 0.5 | port wall, window wall, wall with window |
| half-wall-port | Half wall with port | half-wall-port | 8 × 0.5 | low wall, half wall |
| v-wall | V-tac wall | v-wall | 6 × 3 | V wall, VTAC |
| door | Door | door | 3 × 3 | doorway |
| car | Car | car | 6 × 15 | vehicle, truck |
| table | Table | table | 6 × 3 | desk |
| pallet | Pallet | pallet | 4 × 4 | skid |
| chopper-seat | Chopper seat | bench | 5 × 2 | helicopter seat, bench seat |
| plank | Plank | bench | 8 × 1 | board, balance beam |
| stairs | Staircase | stairs | 4 × 6 | stairs, steps |
| platform | Platform | platform | 8 × 8 | rooftop, raised platform |
| wobble | Wobble platform | wobble | 4 × 4 | wobble board, unstable platform |
| barrier | Low barrier | barrier | 6 × 0.5 | sticks, low port |
| berm | Berm | berm | 20 × 6 | mound, dirt pile |
| fence | Fence | fence | 10 × 0.3 | mesh, snow fence |

- [ ] **Step 1: Write the failing tests:** counts (10 props, 16 structures); each new id exists with its style and size; search finds them by alias ("sticks" → barrier, "mound" → berm, "VTAC" → v-wall).
- [ ] **Step 2: Run to verify failure.** Expected: FAIL.
- [ ] **Step 3: Draw** the prop SVGs and add the entries.
- [ ] **Step 4: Run** the unit tests, the whole e2e suite, `pnpm check` and `pnpm lint`. Expected: PASS.
- [ ] **Step 5: Commit:** `feat(catalog): add the props and structures`

---

### Task 4: Areas and markers, and old plans

**Files:**

- Modify: `svg/{shooting-position,dump-box}.svg` (redraw in style A), `entries.ts` (start box uses `start-box`), `tests/e2e/editor-place.spec.ts`

**Interfaces:**

- Produces:
  - Shooting position: a circle with crosshair ticks in ink.
  - Dump box: a top view of an open box with a tinted inside.
  - Start box: the `start-box` footprint style.
  - Shooting box and fault line are unchanged in style.
- [ ] **Step 1: Write the failing test** `an old plan keeps its objects after the redraw` (Review Focus #1). Place a popper, a barrel, a wall and a start box, then reload. Expect the four objects with the same `data-symbol-id`s and screen positions. Also expect the start box to draw its downrange triangle (`[data-symbol-id="start-box"] path`).
- [ ] **Step 2: Run to verify failure.** Expected: FAIL (no triangle).
- [ ] **Step 3: Draw and wire** the entries.
- [ ] **Step 4: Run** the whole suite. Expected: PASS.
- [ ] **Step 5: Commit:** `feat(catalog): redraw the areas and markers`

---

### Task 5: Symbol sheet, clipping check, grayscale review

**Files:**

- Create: `src/routes/(app)/symbols/+page.svelte`, `tests/e2e/symbols.spec.ts`

**Interfaces:**

- Produces: `/symbols`, a heading "Symbols", then one section per category.
  - Each entry row shows its name and id.
  - Symbols appear at 24, 32 and 44 px: `SYMBOL_PX` small, medium and large, each `<svg data-symbol={id} data-size={px}>`.
  - Footprints appear through `FootprintShape` at their default size, fitted into 120 × 60 px.
  - A "Grayscale" toggle applies `filter: grayscale(1)` to the page.
- [ ] **Step 1: Write the failing e2e tests**

```ts
test('every symbol fits inside its box at all three sizes', async ({ page }) => {
	await page.goto('/symbols');
	const problems = await page.evaluate(() =>
		[...document.querySelectorAll<SVGSVGElement>('svg[data-symbol]')].flatMap((svg) => {
			// union of child getBBox in viewBox units, grown by half the 5-unit stroke
			… return out-of-bounds ids with their size …
		})
	);
	expect(problems).toEqual([]);
	expect(await page.locator('svg[data-symbol]').count()).toBe(3 * SYMBOL_COUNT);
});
test('every footprint style draws on the sheet', …);
```

- [ ] **Step 2: Run to verify failure.** Expected: FAIL (no route).
- [ ] **Step 3: Implement** the sheet.
- [ ] **Step 4: Run** the whole suite. Expected: PASS.
- [ ] **Step 5: Commit:** `test(catalog): check every symbol fits its box at all sizes`
- [ ] **Step 6: User review:** take a grayscale screenshot of `/symbols` and show it to the user (Review Focus #3). Redraws the user asks for go in follow-up commits on this branch.

---

## After the last task

- ROADMAP: Plan 3 → Done.
