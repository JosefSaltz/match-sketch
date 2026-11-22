# Plan 2b: Scale Break in the Editor (Variant C) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The MD sets a "Not to scale beyond" depth. From that depth to the end of the bay, the stage draws a shaded strip of fixed depth. Objects in the strip keep their true positions in the data and are tagged with their true distance. Drawing, dragging, snapping, zooming and measuring all stay correct.

**Architecture:** A pure depth map turns true depth into drawn depth and back. The `Viewport` carries that map, so every existing `worldToScreen` and `screenToWorld` call gets it for free, along with `fitViewport` and `zoomAt`. Plan 4's print rendering will reuse the same viewport math. The break is stored as one `scaleBreaks` entry in the plan document, so it is undoable and saved like any other edit. The stage then draws the strip, its torn edge, its label and true-distance ticks, and tags the objects inside it.

**Tech Stack:** SvelteKit 3, Svelte 5, TypeScript, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-21-match-sketch-design.md` §7.4 (variant C, decided 2026-11-22). Reference: the throwaway spike on branch `spike/scale-break` (`src/lib/editor/scale-break-prototype.svelte.ts`). Port its ideas, not its code.

## Global Constraints

- **Data stays in true feet.**
  - The break is `document.scaleBreaks = [{ fromFt, toFt }]`, with `toFt` = the plan's `depthFt`.
  - No break means `[]`.
  - The editor reads only the first entry.
  - No schema change.
- **Drawn depth of the strip:** `min(75, toFt − fromFt)` ft, which is 25 yd.
- **The depth map is the only place drawn depth is computed.** No component scales depth itself.
- Every `.svelte` file passes the Svelte MCP autofixer. Commits are atomic and Angular style.

## Decisions

1. **Where the setting lives:** the Properties tab with nothing selected shows a "Drawing" section. It holds one field, "Not to scale beyond", in the plan's unit; an empty field means off. The top bar is already full at tablet width (see Plan 2, Decision 5).
2. **Valid values:** a depth greater than 0 and less than the bay depth. Anything else puts back the stored value.
3. **Strip look:**
   - The strip is shaded `#eef1f5` with a map-style zigzag "torn" edge at the break line.
   - Its label, "Not to scale beyond 30 yd", sits inside the strip at the right.
   - True-distance ticks run down the strip's left edge, at a round step that gives at least 24 px between ticks.
   - Grid lines aren't drawn inside the strip.
4. **Tags:** an object whose `y > fromFt` gets a true-distance tag in the plan's unit, e.g. "150 yd", beside it.
5. **Scale bar** label gains " · outside the strip" while a break is on.

## Review Focus

1. **Dragging an object across the break edge,** in either direction, lands at the true position under the pointer; its Y field and tag agree. → Task 2 (e2e).
2. **Zoom and pan with a break on** keep the point under the cursor fixed, and Fit fits the drawn depth. → Task 1 (unit) and Task 2 (e2e).
3. **A measure line crossing the break** shows the true distance, not the drawn one. → Task 2 (e2e).
4. **Undo and redo** of setting and clearing the break restore the drawing. → Task 2 (e2e).
5. **A plan saved with a break,** then reopened, draws the strip again. → Task 2 (e2e).

---

### Task 1: Depth map in the viewport

**Files:**

- Create: `src/lib/geometry/depth-map.ts`, `depth-map.test.ts`
- Modify: `src/lib/geometry/viewport.ts`, `viewport.test.ts`, `src/lib/editor/editor-state.svelte.ts`

**Interfaces:**

- Produces:
  - `type DepthMap = { fromFt: number; toFt: number; drawnFt: number }`.
  - `SQUEEZED_DRAWN_FT = 75`.
  - `depthMapFor(breaks: ScaleBreak[], depthFt: number): DepthMap | null` returns `null` when there is no valid first break.
  - `toDrawn(y: number, map: DepthMap | null): number` and `toTrue(d: number, map: DepthMap | null): number` are exact inverses and the identity for `null`.
  - `Viewport` gains `depth?: DepthMap | null`. `worldToScreen` and `screenToWorld` map y through it. `fitViewport(canvas, screen, padding, depth?)` fits the drawn depth. `zoomAt` uses the drawn y.
  - `EditorState.depth` is derived from `doc.scaleBreaks` and `canvas.depthFt`, and `viewport` always carries the current `depth`. A manual zoom or pan keeps its scale and offsets, but takes the current map.
  - `EditorState.setScaleBreak(fromFt: number | null): void` commits `scaleBreaks` (`[]` for `null`).
- [ ] **Step 1: Write the failing tests:**
  - `toDrawn`/`toTrue` round-trip at 0, at `fromFt`, inside the strip and at `toFt`.
  - Points beyond the break compress, and points before it are unchanged.
  - `null` gives the identity.
  - `depthMapFor` ignores an invalid break.
  - `fitViewport` with a map fits 90 + 75 ft for a 900 ft bay broken at 90 ft.
  - `zoomAt` with a map keeps the world point under the cursor (Review Focus #2).
- [ ] **Step 2: Run to verify failure:** `pnpm vitest run src/lib/geometry`. Expected: FAIL.
- [ ] **Step 3: Implement** the map, the viewport changes, and `EditorState.depth` and `setScaleBreak`.
- [ ] **Step 4: Run** the unit tests and the whole e2e suite (no behavior change without a break). Expected: PASS.
- [ ] **Step 5: Commit:** `feat(geometry): map depth through an optional scale break`

---

### Task 2: The strip, its setting, and tags

**Files:**

- Modify: `BayLayer.svelte`, `ObjectView.svelte`, `ScaleBar.svelte`, `PropertiesPanel.svelte`
- Create: `tests/e2e/scale-break.spec.ts`

**Interfaces:**

- Consumes: Task 1.
- Produces:
  - A "Drawing" section in Properties with no selection, holding the field `Not to scale beyond`.
  - The strip: `data-testid="scale-break"` with its label `data-testid="scale-break-label"` and ticks.
  - Object tags: `data-testid="object-distance"`.
- [ ] **Step 1: Write the failing e2e tests.** Each uses a 40 × 300 yd canvas.
  - **The strip draws:** set the field to 30, and the strip appears with the label "Not to scale beyond 30 yd".
  - **An object in the strip:** place a popper and set its Y to 150, and its tag reads "150 yd".
  - **Dragging across the edge (Review Focus #1):** drag the popper from inside the strip into the true-scale zone and back. Each time, the Y field matches where it was dropped: below 30, then above 30, and the tag shows only above 30.
  - **A measure line across the break (Review Focus #3):** draw one from a popper at Y 10 to one at Y 150, and it reads "140 yd".
  - **Zoom (Review Focus #2):** zoom in and out with the strip on, and the bay stays visible. Fit fills the stage with the drawn depth, so the bay's height is about the stage height minus padding.
  - **Undo and redo (Review Focus #4):** clear the field and the strip goes away; Undo brings it back and Redo removes it.
  - **Reload (Review Focus #5):** after a reload, the strip is still drawn.
- [ ] **Step 2: Run to verify failure.** Expected: FAIL.
- [ ] **Step 3: Implement** the setting, the strip, the ticks, the tags, and the scale bar note.
- [ ] **Step 4: Run** the whole suite, `pnpm check`, `pnpm lint` and the autofixer. Expected: PASS.
- [ ] **Step 5: Commit:** `feat(editor): draw the far zone as a not-to-scale strip`

---

## After the last task

- ROADMAP: Plan 2b → Done. Delete the `spike/scale-break` branch, locally only; it was never pushed.
