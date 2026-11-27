# Steel Ricochet Danger Zones Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An on-screen editor overlay that draws published ricochet danger zones (splash off steel targets, and the Army batwing fan from shooting positions), switched by four toggles and explained by a legend.

**Architecture:**
- **Data:** the source numbers live as typed data in `src/lib/safety/sources.ts`.
- **Geometry:** pure functions in `src/lib/safety/` compute zones in true feet from the plan document. A clip and depth-map helper turns them into bay-bounded paths.
- **Rendering:** one Svelte layer draws the paths in screen space through the existing `worldToScreen` (which already applies the scale break).
- **Controls:** toggles are editor view state (not saved); a toolbar control flips them, and a legend card explains what is on.

**Tech Stack:** SvelteKit 3, Svelte 5 runes, TypeScript, Vitest, Playwright, Tailwind 4.

**Spec:** `docs/superpowers/specs/2026-11-27-steel-danger-zones-design.md` (approved 2026-11-27). Read it first; §3 holds every number.

## Global Constraints

- **Branch:** `feat/danger-zones`, stacked on `feat/walkthrough`. Commits follow AGENTS.md: atomic, `type(scope): description`, each leaving type check, lint and tests passing. Suggested scopes: `catalog`, `safety`, `editor`, `plans`.
- **Svelte code:** every `.svelte` / `.svelte.ts` edit goes through the Svelte MCP autofixer (or the `svelte:svelte-file-editor` agent) until it reports no issues.
- **Units:** meters to feet is `m / 0.3048` exactly (so 45.72 m = 150 ft). World coordinates are feet, x to the right, y downrange; origin at the bay's uprange-left corner.
- **Numbers come from the sources.** Copy them from spec §3 exactly. The only derived numbers allowed in labels are the "past bay" distances from Task 7, which spec §4.4 defines and which carry that label.
- **Legend copy** is fixed verbatim by spec §4.5. The Pistol NZ quote ends "…within the splatter zone", the end of the source's clause; do not cut it shorter.
- **Display only:** toggles all start off. They are not saved with the plan, not printed, and not shown in shared links.
- **Accessibility:** the layer and legend must read in grayscale. Each layer gets a distinct stroke dash pattern, and color is only a bonus.
- **Commands:** `npm run test:unit -- --run`, `npm run check`, `npm run lint`, `npm run test:e2e -- <spec>`.

## Review Focus

1. **Dragging a steel target or shooting position:** zones follow it live during the drag (`editor.doc` includes the drag preview) and land with it. Covered by an e2e test in Task 6.
2. **A shooting position on top of a steel target** (zero-length gun-target line): that pair is skipped, with no NaN points and no crash. Covered by a unit test in Task 3.
3. **Scale break on:** rays crossing into the squeezed strip bend with it and stay finite; edge tags still sit on the bay edge. Covered by a unit test in Task 4.
4. **Rotated plates (90°, 180°, 270°):** splash rays turn with the plate and still point toward the shooter's side of the face. Covered by a unit test in Task 3.
5. **A fan toggle on with no shooting positions on the plan:** nothing is drawn, and the legend says why instead of looking broken. Covered by an e2e test in Task 6.

---

### Task 1: Mark steel targets in the catalog

**Files:**

- Modify: `src/lib/catalog/types.ts` (`BaseEntry`)
- Modify: `src/lib/catalog/entries.ts` (`TargetExtra`, the 13 entries)
- Test: `src/lib/catalog/catalog.test.ts`

**Interfaces:**

- Produces: `BaseEntry.steel?: boolean`. Documented as "Steel the shooter hits: draws ricochet danger zones (danger-zones spec §4.1)."

- [ ] **Step 1: Write the failing test** `it('marks exactly the steel targets as steel')`. It asserts that `CATALOG.filter((e) => e.steel).map((e) => e.id).sort()` equals:

```ts
[
	'bottle',
	'ducks',
	'plate-kd',
	'plate-rack',
	'plate-stop',
	'popper',
	'popper-auto-reset',
	'popper-static',
	'popper-trigger',
	'spinner',
	'steel-static',
	'texas-star',
	'whirly-gig'
];
```

It also asserts that every entry with `family` `'poppers'` or `'steel'` has `steel === true`.

- [ ] **Step 2: Run it.** Run `npm run test:unit -- --run src/lib/catalog`. Expected: FAIL (empty list).
- [ ] **Step 3: Implement.** Add `steel?: boolean` to `BaseEntry`, add `'steel'` to `TargetExtra`'s picked keys, and pass `{ steel: true }` (merged with any existing extra) for the 13 ids.
- [ ] **Step 4: Run it.** Expected: PASS. Then `npm run check`.
- [ ] **Step 5: Commit** `feat(catalog): mark steel targets`.

---

### Task 2: Source data

**Files:**

- Create: `src/lib/safety/sources.ts`
- Test: `src/lib/safety/sources.test.ts`

**Interfaces:**

- Produces:

```ts
export const FT_PER_M = 1 / 0.3048;
export type SplashSourceId = 'ar385-splash' | 'pnz-splash';
export type FanSourceId = 'fan-9mm' | 'fan-556';
export type LayerId = SplashSourceId | FanSourceId;
export const LAYER_IDS: readonly LayerId[]; // order: ar385-splash, pnz-splash, fan-9mm, fan-556
export type SplashSource = {
	id: SplashSourceId;
	label: string;
	angleDeg: number;
	reachM: number;
	/** 'limit': the reach is an outer bound. 'minimum': it may go further (no stated limit). */
	reachKind: 'limit' | 'minimum';
	/** Lower end of a published range ("25–30 m"), when the source gives one. */
	reachFromM?: number;
	citation: string;
	meaning: string;
};
export type FanSource = {
	id: FanSourceId;
	label: string;
	load: string;
	dispersionDeg: number;
	xM: number;
	yM: number;
	wM: number;
	pDeg: number;
	qDeg: number;
	citation: string;
	meaning: string;
};
export const SPLASH_SOURCES: Record<SplashSourceId, SplashSource>;
export const FAN_SOURCES: Record<FanSourceId, FanSource>;
export const LEGEND_NO_BERMS = 'Berms and baffles are not modeled.';
```

- [ ] **Step 1: Write the failing test.** Pin every number to spec §3:
  - **AR 385-63 splash:** angle `20`, reach `45.72`, kind `'limit'`.
  - **Pistol NZ splash:** angle `20`, reach `30`, from `25`, kind `'minimum'`.
  - **9mm fan:** dispersion `5`, X `1800`, Y `1211`, W `399`, P `61.1`, Q `30.4`.
  - **5.56 fan:** dispersion `5`, X `3100`, Y `1666`, W `323`, P `19.0`, Q `26.9`.
  - `45.72 * FT_PER_M` ≈ `150` to 9 decimal places.
  - Each `meaning` equals the spec §4.5 text:
    - Both fans share the 1-in-1,000,000 line.
    - Pistol NZ's line ends "…within the splatter zone".
  - Each `citation` names its document, paragraph and figure or table:
    - **AR splash:** "AR 385-63/MCO 3570.1D (23 May 2025), ¶2-17a(2), Fig. 2-5".
    - **Pistol NZ:** "Pistol New Zealand, Steel Target Safe Use Guide 2025 V4 (28 May 2025), §8 "What happens when a projectile hits Steel? The Splatter Pattern", p. 6, Fig. 1".
    - **9mm:** "AR 385-63, ¶5-1c, Fig. 5-3, Table 5-4 (steel/concrete)".
    - **5.56:** "AR 385-63, ¶5-1c, Fig. 5-3, Table 5-11 (steel/concrete)".
  - **Loads:** `'Ball M882, M1, subsonic'` and `'M193 Ball'`.
  - **Labels:** "AR 385-63 splash", "Pistol NZ splash", "9mm Luger", "5.56 NATO".
- [ ] **Step 2: Run it.** Expected: FAIL (module missing).
- [ ] **Step 3: Implement** `sources.ts` as plain `const` data.
- [ ] **Step 4: Run it.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(safety): record the published danger zone sources`.

---

### Task 3: Zone geometry in true feet

**Files:**

- Create: `src/lib/safety/zones.ts`
- Test: `src/lib/safety/zones.test.ts`

**Interfaces:**

- Consumes: Task 1 `steel` flag via `getEntry` from `#lib/catalog`; Task 2 sources; `PlanDocument`, `PlanObject` from `#lib/model/plan`; `Point` from `#lib/geometry/types`.
- Produces:

```ts
export type DangerToggles = Record<LayerId, boolean>;
export const NO_DANGER_ZONES: DangerToggles; // all false
export const FIRING_POINT_IDS: readonly string[]; // ['shooting-position', 'shooting-box']

export type SplashSide = {
	/** Closed polygon: the origin, then an arc from the face line to the 20° ray at reach. */
	wedge: Point[];
	/** End of the 20° ray at the published reach. */
	rayEnd: Point;
	/** 'minimum' sources only: the same ray carried on far past any bay (FAR_FT), drawn dashed. */
	beyond?: Point;
};
export type SplashZone = {
	key: string;
	sourceId: SplashSourceId;
	objectId: string;
	origin: Point;
	left: SplashSide;
	right: SplashSide;
};
export type FanSide = {
	/** Open outline F → A → B → C (spec §3.2). */
	outline: [Point, Point, Point, Point];
};
export type FanZone = {
	key: string;
	sourceId: FanSourceId;
	firingPointId: string;
	targetId: string;
	origin: Point;
	/** Ends of the two dispersion edges at Distance X. */
	dispersion: [Point, Point];
	left: FanSide;
	right: FanSide;
};
export type ZoneSet = { splash: SplashZone[]; fans: FanZone[] };

export const FAR_FT = 20_000;
export function faceNormal(rotationDeg: number): Point;
export function splashZone(
	target: Pick<PlanObject, 'id' | 'x' | 'y' | 'rotation'>,
	src: SplashSource
): SplashZone;
export function fanZone(
	firing: Pick<PlanObject, 'id' | 'x' | 'y'>,
	target: Pick<PlanObject, 'id' | 'x' | 'y'>,
	src: FanSource
): FanZone | null; // null when the two points coincide
export function dangerZones(
	doc: PlanDocument,
	toggles: DangerToggles,
	selection: readonly string[]
): ZoneSet;
export function isSteel(obj: PlanObject): boolean;
export function isFiringPoint(obj: PlanObject): boolean;
```

Orientation (spec §4.2), which the tests pin:
- **Face normal:** `faceNormal(r) = (−sin r, −cos r)`, pointing to the shooter. At 0° it is (0, −1). At 90° the plate turns clockwise on screen, so the normal is (−1, 0).
- **Face line direction:** `u = (cos r, −sin r)`.
- **Splash rays:** `cos20·(±u) + sin20·n`. The right side uses +u.
- **Batwing (spec §3.2):**
  - `g` is the unit vector from F to the target.
  - Each dispersion edge is `g` turned 5° (left = counter-clockwise in world coordinates, toward −x when g = +y).
  - `out` is that edge's outward unit normal.
  - Points: `A = F + e·(W/tan P) + out·W`, `B = F + e·(Y − W/tan Q) + out·W`, `C = F + e·Y`, and the dispersion end is `F + e·X`.
  - All distances are in feet.

- [ ] **Step 1: Write the failing tests.**
  - `faceNormal`: at 0, 90, 180 and 270 it gives (0,−1), (−1,0), (0,1) and (1,0), to 1e-9.
  - `splashZone(target at (0,0), rotation 0, AR)`:
    - `right.rayEnd` ≈ (150·cos20°, −150·sin20°) = (140.954, −51.303) and `left.rayEnd` ≈ (−140.954, −51.303), to 1e-3;
    - every wedge point is within 150 ft of the origin, and no point has y > 1e-9 (all on the shooter's side);
    - `beyond` is undefined.
  - **Rotated plate (Review Focus 4):** at rotation 90 both ray ends have x < 0.
  - `splashZone(..., Pistol NZ)`:
    - `rayEnd` is at 30 m (98.425 ft) from the origin;
    - `beyond` lies on the same ray at `FAR_FT`.
  - `fanZone(F=(0,0), target=(0,30), 9mm)`:
    - the angle of F→A from +y is 66.1°, to 1e-6;
    - A is at a perpendicular distance of 399 m (in ft) from the left dispersion edge line;
    - along the edge, A is at 399/tan61.1° m and B is at 1211 − 399/tan30.4° m;
    - C is at 1211 m along the edge;
    - the dispersion ends are 1800 m from F at ±5°;
    - the left side lies at x < 0 and the right side at x > 0.
  - The same checks for 5.56, using its own numbers.
  - **Coincident points (Review Focus 2):** `fanZone` with F equal to the target returns `null`.
  - `dangerZones`, on a doc with:
    - steel targets `s1` (steel-static) and `s2` (popper, `count: 4`);
    - paper target `p1`;
    - shooting position `f1`;
    - shooting box `f2`;
    - and a shooting position `f3` placed exactly on `s1`.
  - Its results:
    - **All toggles off:** both lists are empty.
    - **Only `ar385-splash` on:** 2 splash zones (s1 and s2; the count doesn't multiply), and none for p1.
    - **Only `fan-9mm` on:** fans for f1×s1, f1×s2, f2×s1, f2×s2 and f3×s2. f3×s1 is skipped, giving 5 in total.
    - **All toggles on, selection `[s1]`:** splash only for s1 (both sources); fans only with target s1.
    - **All toggles on, selection `[f1]`:** fans only from f1; splash for s1 and s2.
    - **All toggles on, selection `[s1, f1]`:** the union of the two.
    - **All toggles on, selection `[p1]`** (nothing relevant): everything is drawn.
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement `zones.ts`.**
  - Arc steps: 1° per point, so each wedge has 22 points.
  - Keys: `${sourceId}:${objectId}` and `${sourceId}:${firingId}:${targetId}`.
  - Selection rule: spec §4.3.
- [ ] **Step 4: Run them.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(safety): compute splash and batwing zones from a plan`.

---

### Task 4: Clipping, depth-mapped paths and edge tags

**Files:**

- Create: `src/lib/safety/paths.ts`
- Test: `src/lib/safety/paths.test.ts`

**Interfaces:**

- Consumes: `CanvasSize`, `Point`; `Viewport` and `worldToScreen` from `#lib/geometry/viewport`; `LengthUnit` and `fromFeet` from `#lib/geometry/units`; Task 2 and 3 types.
- Produces:

```ts
export type Rect = { minX: number; minY: number; maxX: number; maxY: number };
export function bayRect(c: CanvasSize): Rect; // 0..width, 0..depth
export function clipPolygon(poly: Point[], r: Rect): Point[]; // Sutherland–Hodgman; [] if outside
export function clipPolyline(line: Point[], r: Rect): Point[][]; // inside pieces, in order
/** First point where the polyline goes from inside the rect to outside; null if it never does. */
export function exitPoint(line: Point[], r: Rect): Point | null;
/** Adds points so no segment is longer than maxStepFt (straight world lines bend through a break). */
export function densify(line: Point[], maxStepFt: number, closed?: boolean): Point[];
/** World points → SVG path data in screen px through worldToScreen. */
export function toPathData(points: Point[], vp: Viewport, closed: boolean): string;
/** "50 yd (45.72 m)", "1,969 yd (1,800 m)": plan unit rounded to whole, source meters as published. */
export function formatPublished(m: number, unit: LengthUnit): string;
/** "≥ 27–33 yd (25–30 m)". */
export function formatPublishedRange(fromM: number, toM: number, unit: LengthUnit): string;
export type EdgeTag = { key: string; at: Point; text: string };
export function zoneTags(zones: ZoneSet, r: Rect, unit: LengthUnit): EdgeTag[];
```

Tag rules (spec §4.4):
- A splash ray (origin → `rayEnd`, or → `beyond` for 'minimum' sources) that exits the bay is tagged with its reach: `formatPublished(reachM)` for 'limit' sources, or `formatPublishedRange(reachFromM, reachM)` for 'minimum' ones.
- Each dispersion edge that exits is tagged with `X ${formatPublished(xM)}`.
- Each ricochet side is tagged once, at `exitPoint(outline)`, with `W ${formatPublished(wM)} · Y ${formatPublished(yM)}`.
- The F→A edge gets no tag of its own; its exit is only used as the ricochet side's single tag point when it is the first exit.

- [ ] **Step 1: Write the failing tests.**
  - `clipPolygon`:
    - a triangle half outside a 10×10 rect stays within it, keeps its inside vertices, and adds the crossing points;
    - a polygon fully outside returns `[]`.
  - `clipPolyline`: a line crossing the rect twice returns one piece with ends on the edges.
  - `exitPoint`:
    - from (5,5) to (5,50) on the 10×10 rect it returns (5,10);
    - a line starting outside and never entering returns `null`.
  - `densify`: a 100 ft segment with step 10 gives 11 points, collinear.
  - **Scale break (Review Focus 3):** take a world line (10,0)→(10,300) in a viewport with `depth = { fromFt: 90, toFt: 300, drawnFt: 75 }`. After `toPathData(densify(...))`:
    - every coordinate is finite;
    - the screen y of the last point equals `worldToScreen({x:10,y:300}, vp).y`.
  - `formatPublished`:
    - `(45.72, 'yd')` gives `'50 yd (45.72 m)'`;
    - `(45.72, 'ft')` gives `'150 ft (45.72 m)'`;
    - `(1800, 'yd')` gives `'1,969 yd (1,800 m)'`.
  - `formatPublishedRange(25, 30, 'yd')` gives `'≥ 27–33 yd (25–30 m)'`.
  - `zoneTags` with unit `'yd'`, on a 60×30 ft bay with a 9mm fan from (30,2) to (30,25):
    - exactly two ricochet tags, each with text `'W 436 yd (399 m) · Y 1,324 yd (1,211 m)'`;
    - two dispersion tags with text `'X 1,969 yd (1,800 m)'`;
    - every tag point lies on the bay boundary.
  - `zoneTags` with an AR splash at the bay center of a 400×400 ft bay: no tags, because the 150 ft rays stay inside.
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement `paths.ts`.** Use `Intl.NumberFormat('en-US', { maximumFractionDigits: 2 })` for meters, and round the plan-unit value to a whole number with the same formatter.
- [ ] **Step 4: Run them.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(safety): clip zones to the bay and tag their published lengths`.

---

### Task 5: Draw the zones in the editor

**Files:**

- Modify: `src/lib/editor/editor-state.svelte.ts` (add view state)
- Create: `src/lib/editor/components/DangerZoneLayer.svelte`
- Modify: `src/lib/editor/components/EditorCanvas.svelte` (mount the layer after `<BayLayer>`, before `<AnnotationLayer layer="below">`)

**Interfaces:**

- Consumes: Tasks 3 and 4.
- Produces:
  - `EditorState.dangerZones = $state<DangerToggles>({ ...NO_DANGER_ZONES })`. This is view state only and is never committed or saved.
  - `EditorState.zones: ZoneSet = $derived(dangerZones(this.doc, this.dangerZones, this.selection))`.
  - DOM hooks for tests:
    - `<g data-testid="danger-zones">` wraps the layer, with `pointer-events: none`;
    - each splash zone is `<g data-testid="danger-splash" data-source={sourceId} data-object-id-ref={objectId}>`;
    - each fan is `<g data-testid="danger-fan" data-source={sourceId}>`;
    - each tag is `<text data-testid="danger-tag">`.

Rendering rules:
- Every world shape goes `densify(clip…(shape, bayRect), 2)` → `toPathData(…, editor.viewport, closed)`.
- Splash wedges are filled at low opacity, with the 20° ray stroked on top. The `beyond` part of a 'minimum' source is clipped to the bay and dashed.
- Fans: the dispersion area is a light outline; the ricochet outlines are stroked.
- Dash patterns: AR splash solid; Pistol NZ `6 4`; 9mm `14 6`; 5.56 `10 4 2 4`. Stroke is `var(--color-danger)`.
- Tags are small text with a white halo (paint-order stroke), like the existing measure labels.

- [ ] **Step 1: Add the state and the derived `zones`** to `EditorState`.
- [ ] **Step 2: Write `DangerZoneLayer.svelte`** with props `{ editor }`, and run the Svelte autofixer until it is clean.
- [ ] **Step 3: Mount it in `EditorCanvas.svelte`** in the order given above, and run the autofixer.
- [ ] **Step 4: Check.** Run `npm run check` and `npm run test:unit -- --run`. Expected: clean, all pass.
- [ ] **Step 5: Commit** `feat(editor): draw steel danger zones under the stage objects`.

(The layer's visible behavior is tested end to end in Task 6, once the toggles can turn it on.)

---

### Task 6: Toolbar toggles, legend, end-to-end tests

**Files:**

- Create: `src/lib/editor/components/DangerZoneLegend.svelte`
- Modify: `src/lib/editor/components/Toolbar.svelte` (the "Danger zones" control)
- Modify: `src/lib/editor/components/EditorCanvas.svelte` (mount the legend in the `.stage` div, as HTML over the SVG)
- Create: `tests/e2e/danger-zones.spec.ts`
- Modify: `docs/superpowers/plans/ROADMAP.md` (add the row for this plan)

**Interfaces:**

- Consumes: `editor.dangerZones`, `editor.zones`, Task 2 sources.
- Produces, as the UI contract the tests use:
  - **Toolbar:** a `Button` named "Danger zones" with `aria-expanded`. It opens a panel `role="group"` `aria-label="Danger zones"` containing four `Toggle` checkboxes labeled with the source `label`s ("AR 385-63 splash", "Pistol NZ splash", "9mm Luger", "5.56 NATO"), bound to `editor.dangerZones[id]`. Escape or a click outside closes it.
  - **Legend:** `data-testid="danger-legend"`, shown when any toggle is on. It has one entry per active layer (stroke sample, label, citation, meaning).
    - For a fan, the label is followed by its load, e.g. "5.56 NATO (M193 Ball)".
    - A trailing `LEGEND_NO_BERMS` line.
    - If a fan toggle is on and the plan has no firing points, the line "Add a shooting position or shooting box to see the ricochet fan."

- [ ] **Step 1: Write the failing e2e spec.** Use the `tests/e2e/scale-break.spec.ts` setup pattern (`createCanvas` 40×50 yd, `createPlanFromCanvas`, `dragFromPalette`, setting X/Y through the Properties tab). Tests:
  - `'no zones until a toggle is on'`: with a `steel-static` placed, `danger-splash` count is 0 and the legend is hidden.
  - `'AR splash draws on every steel target and not on paper'`:
    - place a `steel-static`, a `popper` and a `paper`, then turn on "AR 385-63 splash";
    - `danger-splash` count is 2;
    - the legend contains "¶2-17a(2)" and "Berms and baffles are not modeled.";
    - turning it off removes both.
  - `'9mm fan needs a shooting position' (Review Focus 5)`:
    - with only a steel target, turn on "9mm Luger";
    - `danger-fan` count is 0, and the legend shows the add-a-shooting-position line;
    - place a `shooting-position`: `danger-fan` count is 1, `danger-tag` count is at least 2, and the legend contains "1 in 1,000,000" and "Table 5-4".
  - `'selecting a target shows only its zones'`:
    - two steel targets and one shooting position, AR splash and 9mm on;
    - select one target: `danger-splash` 1, `danger-fan` 1;
    - press Escape: back to 2 and 2.
  - `'zones follow a dragged target' (Review Focus 1)`:
    - AR splash on; record the first `danger-splash` path's `d`;
    - mouse-drag the target (as in the scale-break drag test) and, before releasing, assert the `d` has changed;
    - after release, assert it differs from the original.
  - `'toggles are not saved with the plan'`: turn one on, reload, and the `danger-zones` group has no children.
- [ ] **Step 2: Run it.** Run `npm run test:e2e -- tests/e2e/danger-zones.spec.ts`. Expected: FAIL (no "Danger zones" button).
- [ ] **Step 3: Implement the toolbar control and `DangerZoneLegend.svelte`**, and mount the legend. Run the Svelte autofixer on each file until clean.
- [ ] **Step 4: Run the e2e spec, then the whole suite.** Run `npm run test:e2e -- tests/e2e/danger-zones.spec.ts`, then `npm run check && npm run lint && npm run test:unit -- --run`. Expected: all pass.
- [ ] **Step 5: Look at it.** Run the app, place two steel targets and a shooting position, turn on all four toggles, and check:
  - the drawing reads in grayscale (devtools rendering → emulate achromatopsia);
  - the legend doesn't cover the bay at the fit zoom.

  Fix anything that doesn't, then rerun step 4.
- [ ] **Step 6: Update the roadmap.** Add a row to `ROADMAP.md`: `| 8 | Steel ricochet danger zones | Done (date) | 2026-11-27-plan-8-steel-danger-zones.md |`, plus a short section pointing at the spec and noting that NRA Range Source Book data is a pending later toggle.
- [ ] **Step 7: Commit** in two commits: `feat(editor): toggle danger zones and explain them in a legend` (code and e2e), then `docs(plans): mark Plan 8 done` (roadmap).

---

### Task 7: Past-the-bay distances and exit arrowheads (user request, 2026-11-27)

Spec §4.4 was amended: where a line leaves the bay, it ends in an outward arrowhead, and its tag adds how far it continues past the edge.

**Files:**

- Modify: `src/lib/safety/paths.ts` (`zoneTags`, plus a new `EdgeTag` field)
- Modify: `src/lib/safety/paths.test.ts`
- Modify: `src/lib/editor/components/DangerZoneLayer.svelte` (arrowheads)
- Modify: `tests/e2e/danger-zones.spec.ts`

**Interfaces:**

- Consumes: Task 3 zones, Task 4 helpers.
- Produces:
  - `EdgeTag` gains `dir: Point`: the unit direction of the line where it crosses the bay edge, pointing outward, used to draw the arrowhead.
  - `export function distanceOutside(p: Point, r: Rect): number`: 0 inside the rect, otherwise the Euclidean distance to it.
  - `export function formatPast(ft: number, unit: LengthUnit): string`: `"46 yd past bay"`, a whole number with en-US separators.
- Tag texts (spec §4.4):
  - **Splash, 'limit':** `` `${formatPublished(reachM)} · ${formatPast(reachFt − |exit − origin|)}` ``.
  - **Splash, 'minimum':** `` `${formatPublishedRange(...)} · no stated limit` ``.
  - **Dispersion edge:** `` `X ${formatPublished(xM)} · ${formatPast(xFt − |exit − F|)}` ``.
  - **Ricochet side:** `` `W … · Y … · reaches ${formatPast(max distanceOutside(A|B|C))}` ``, which reads "reaches 1,314 yd past bay".

- [ ] **Step 1: Update the failing tests in `paths.test.ts`.**
  - `distanceOutside`: (5,5) in a 10×10 rect gives 0; (13,14) gives 5.
  - `formatPast(139.358, 'yd')` gives `'46 yd past bay'`.
  - The existing 9mm `zoneTags` case (unit `'yd'`, a 60×30 ft bay, fan from (30,2) to (30,25)):
    - the dispersion tags read `'X 1,969 yd (1,800 m) · 1,959 yd past bay'`;
    - the ricochet tags read `'W 436 yd (399 m) · Y 1,324 yd (1,211 m) · reaches 1,314 yd past bay'`;
    - every tag's `dir` is a unit vector pointing out of the bay (its dot product with the outward normal of the edge it sits on is > 0).
  - A new AR splash case: a plate at (10,25), rotation 0, in a 60×30 ft bay, unit `'yd'`. It gives exactly two splash tags: `'50 yd (45.72 m) · 46 yd past bay'` (left, at x = 0) and `'50 yd (45.72 m) · 32 yd past bay'` (right, at x = 60).
  - A Pistol NZ splash in the same position: both tags end with `' · no stated limit'`.
- [ ] **Step 2: Run them.** Run `npm run test:unit -- --run src/lib/safety`. Expected: FAIL on the new texts and the missing `dir`.
- [ ] **Step 3: Implement** `distanceOutside`, `formatPast`, `dir`, and the new tag texts in `paths.ts`.
- [ ] **Step 4: Run them.** Expected: PASS.
- [ ] **Step 5: Draw the arrowheads.** In `DangerZoneLayer.svelte`, draw an outward arrowhead at each tag's `at`, pointing along `dir` in screen space. Screen y is flipped, so map the direction through `worldToScreen`, or take it from two points. Size it about 8 px, filled with `var(--color-danger)`, with `data-testid="danger-exit"`. Run the Svelte autofixer until clean.
- [ ] **Step 6: Extend the e2e spec.** In the 9mm test, after the shooting position is placed: `danger-exit` count is at least 2, and at least one `danger-tag` contains `'past bay'`.
- [ ] **Step 7: Check.** Run `npm run check && npm run lint && npm run test:unit -- --run`, then `npx playwright test --list tests/e2e/danger-zones.spec.ts`. Expected: clean, all pass, and the spec parses.
- [ ] **Step 8: Commit** `feat(safety): show how far danger zone lines run past the bay`.

