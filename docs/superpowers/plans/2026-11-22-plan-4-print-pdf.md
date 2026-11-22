# Plan 4: Print & PDF — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Print or download as a vector PDF any plan, or a whole match, on US Letter in the approved layout B, with fit-to-page or tiled diagrams, the procedure moving to its own page when it doesn't fit, and everything working offline.

**Architecture:**

- **One SVG per page.** Every printed page is a single `816 × 1056` SVG (Letter at 96 px/in; landscape swaps the two). It holds the header, the facts strip, the wrapped procedure, the notes, the footer and the diagram, and is styled only with SVG attributes.
- **Print and PDF share the pages.** The browser prints those SVGs through print CSS. The PDF is made in the browser by drawing the same SVG elements with `jsPDF` + `svg2pdf.js`, so print and PDF match and stay vector.
- **The layout is pure.** A pure layout module turns a plan into positioned page content. Text is measured through an injected function, so the module is fully unit-tested. Svelte components only draw what it returns.
- **The diagram reuses the editor's drawing rules.** It uses the same viewport math (including the scale-break depth map), the catalog SVGs (inlined as `<g>`), and the footprint shapes (painted with attributes).

**Tech Stack:** SvelteKit 3, Svelte 5, TypeScript, `jspdf` 4.x and `svg2pdf.js` 2.x (in-browser vector PDF), Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-21-match-sketch-design.md`:

- §7.6 (pages, overflow page, fit vs. tile, scale bar, downrange arrow, match print);
- §9 (layout B, decided 2026-11-22);
- §6 (Letter portrait/landscape, browser print and in-browser PDF);
- §7.4 (the scale break prints too).

The mockup is in `.superpowers/brainstorm/print-layouts/layout-b.html` (git-ignored; port, don't import). Notes on svg2pdf are in `.superpowers/brainstorm/plan4-pdf-notes.md`.

## Global Constraints

- **Paper:** US Letter, 8.5 × 11 in, portrait (default) or landscape; 96 px per inch in page units; 0.45 in (43 px) margins.
- **Layout B, portrait, from the top:**
  1. **Header row**, 60 px tall: a black block with "STAGE" over the number in white, then the stage name in heavy caps over "match · date".
  2. **Diagram**, filling the space left after the facts strip and the procedure block's minimum height, which is 4 text lines.
  3. **Facts strip:** five boxes in one row (Start position, Gun ready, Round count, Targets, Par time), each a small-caps label over wrapped text.
  4. **Procedure and notes:** the procedure as a numbered list, one item per line of the procedure field, to the left at 62% of the width; notes sections to the right.
  5. **Footer:** "Match name · Stage N" on the left, "Page x of y" on the right.

  Landscape uses the same order with a wider, shorter diagram.
- **Fonts:** Helvetica with an Arial fallback in the browser, the PDF's standard Helvetica and Helvetica-Bold, 10.5 pt body text. Text outside WinAnsi (emoji, arrows) is replaced with `?` in the PDF only.
- **Symbol print sizes:** small 0.35 in (33.6 px), medium 0.45 in (43.2 px), large 0.55 in (52.8 px). Footprints print to scale.
- **Attribute styling only** inside page SVGs: no CSS classes, `var()`, or `currentColor`. Ink is `#1c1c1a`.
- **Vector only:** the PDF has no raster images.
- **Offline:** the print route statically imports what it needs, so printing and downloading work with the network off once the route has loaded.
- Every `.svelte` file passes the Svelte MCP autofixer. Commits are atomic and Angular style.

## Decisions

1. **Overflow:** if the procedure and notes don't fit their block on page 1, page 1 shows "Stage procedure and notes on page 2". Page 2 then carries the full facts and the whole procedure and notes, continuing to more pages by whole lines if needed. The facts stay on page 1 as well.
2. **Tile mode:**
   - Page 1 is the normal layout B page, with the fit diagram as an overview and the tile grid drawn on it ("1", "2", …).
   - Each tile page that follows has a slim header ("Stage N · Name · Tile k of n"), the tile at the chosen scale with a 0.25 in overlap, a scale bar and the downrange arrow.
   - The scale is chosen from a list (1 in = 5, 10, 20 or 50 of the plan's unit); the default is the largest that still needs tiles.
3. **No cover page** for match prints.
4. **Thumbnails** on the home page draw the plan's fit diagram in a 120 × 90 box (Unassigned plans cards and match stage rows).
5. **Entry points:** a "Print" link in the editor's top bar, and "Print match" on the match screen. Both open the print preview route, which has Orientation, Diagram (Fit / Tile) and Tile scale controls, plus "Print" and "Download PDF" buttons.

## Review Focus

1. **A procedure too long for page 1** moves with the notes to page 2, and page 1 says so. A procedure longer than a whole page continues onto page 3. → Task 1 (unit), Task 3 (e2e).
2. **Tiling math:** a 40 × 300 yd bay at 1 in = 10 yd tiles into the expected count, with overlap, and every object appears on at least one tile. → Task 1 (unit).
3. **The PDF matches the print:** same page count, vector (no `/Image` XObjects), and downloadable with the network off. → Task 4 (e2e).
4. **A match print** has each stage starting on a new page, in match order, with "Page x of y" counting the whole document. → Task 5 (e2e).
5. **A plan with a scale break** prints the strip, its label and the distance tags. → Task 3 (e2e).

---

## File Structure

```
src/lib/print/
  page.ts             Letter sizes, margins, symbol print px, orientation
  layout.ts           layoutPlan(...) → PrintPage[] (pure; measure injected), tile grid
  layout.test.ts
  wrap.ts             wrapText(text, width, measure) (pure)
  measure.ts          canvas-based measure for the browser
  pdf.ts              downloadPdf(pages: SVGSVGElement[], filename) (jspdf + svg2pdf)
  PrintDiagram.svelte the diagram as attribute-styled SVG
  PrintPage.svelte    one page SVG from a laid-out page
  Thumbnail.svelte    small fit diagram for lists
src/lib/catalog/footprint-shapes.ts   + PAINT_ATTRS (attribute styling per paint)
src/routes/(app)/plans/[id]/print/+page.ts, +page.svelte
src/routes/(app)/matches/[id]/print/+page.ts, +page.svelte
tests/e2e/print.spec.ts, tests/e2e/pdf.spec.ts
```

---

### Task 1: Page layout and pagination (pure)

**Files:** Create `src/lib/print/page.ts`, `wrap.ts`, `layout.ts`, `layout.test.ts`.

**Interfaces:**

- **Produces, in `page.ts`:**
  - `type Orientation = 'portrait' | 'landscape'`.
  - `pageSize(o): { width: number; height: number }`, which is 816 × 1056 or 1056 × 816.
  - `MARGIN_PX = 43`.
  - `PRINT_SYMBOL_PX: Record<SymbolSize, number> = { small: 33.6, medium: 43.2, large: 52.8 }`.
- **Produces, in `wrap.ts`:**
  - `type Measure = (text: string, fontPx: number, bold: boolean) => number`.
  - `wrapText(text: string, maxWidth: number, fontPx: number, measure: Measure, bold?: boolean): string[]`. It splits on words, hard-breaks words longer than the line, and keeps empty lines from `\n\n`.
- **Produces, in `layout.ts`:**
  - `type Rect = { x: number; y: number; width: number; height: number }`.
  - `type TextBlock = { x: number; y: number; width: number; lines: string[]; fontPx: number; bold?: boolean }`.
  - `type PrintPage`, a union with three kinds:
    - `{ kind: 'stage'; header; diagram: Rect; facts: { label: string; block: TextBlock; box: Rect }[]; procedure: TextBlock[]; notes: TextBlock[]; pointer: string | null; footer }`;
    - `{ kind: 'continued'; header; procedure: TextBlock[]; notes: TextBlock[]; footer }`;
    - `{ kind: 'tile'; header; diagram: Rect; tile: Rect /* in drawn feet */; index: number; count: number; footer }`.

    Here `header` and `footer` are the strings and positions needed to draw them.
  - `type PlanPrintInput = { title: string; stageNumber: string; matchName: string; date: string; brief: StageBrief; targets: string; canvas: CanvasSize; depth: DepthMap | null; orientation: Orientation; mode: 'fit' | { tileScaleFtPerIn: number } }`.
  - `layoutPlan(input: PlanPrintInput, measure: Measure): PrintPage[]`. Footers read "Page x of y" within the plan; match printing renumbers them.
  - `tileGrid(canvas: CanvasSize, depth: DepthMap | null, areaPx: { width: number; height: number }, ftPerIn: number, overlapPx = 24): Rect[]`. It returns tiles in drawn feet, row by row from the shooter's end, which is the bottom of the page.
  - `defaultTileScale(canvas, depth, areaPx, unit): number`. It picks the largest of 5, 10, 20, 50 (in the plan's unit) that needs more than one tile, or else 50.
- [ ] **Step 1: Write the failing tests:**

```ts
const measure: Measure = (t, px) => t.length * px * 0.5; // fixed-width stand-in
it('wraps text by words and hard-breaks long words', …);
it('fits a short stage on one page in layout B order', () => {
	const [p] = layoutPlan(shortInput, measure);
	expect(p.kind).toBe('stage');
	// header above diagram above facts above procedure; all inside the margins
});
it('moves a long procedure and the notes to page 2 with a pointer (Review Focus #1)', () => {
	const pages = layoutPlan(withProcedure(40 lines), measure);
	expect(pages.map((p) => p.kind)).toEqual(['stage', 'continued']);
	expect(pages[0].pointer).toBe('Stage procedure and notes on page 2');
});
it('continues a procedure longer than a page onto page 3', …);
it('tiles a 40 × 300 yd bay at 1 in = 10 yd with overlap (Review Focus #2)', () => {
	const tiles = tileGrid({ widthFt: 120, depthFt: 900 }, null, area, 30);
	expect(tiles).toHaveLength(expectedCount);
	// union of tiles covers [0,120] × [0,900]; neighbours overlap by 24 px of paper
});
it('lays out landscape pages wider than tall', …);
it('numbers footers page x of y', …);
```

- [ ] **Step 2: Run to verify failure:** `pnpm vitest run src/lib/print`. Expected: FAIL.
- [ ] **Step 3: Implement** `page.ts`, `wrap.ts` and `layout.ts`.
- [ ] **Step 4: Run** the unit tests, `pnpm check` and `pnpm lint`. Expected: PASS.
- [ ] **Step 5: Commit:** `feat(print): lay out Letter pages in layout B with overflow and tiles`

---

### Task 2: Print diagram (attribute-styled SVG)

**Files:**

- Create: `src/lib/print/PrintDiagram.svelte`, `src/lib/print/symbol-markup.ts`, `symbol-markup.test.ts`
- Modify: `src/lib/catalog/footprint-shapes.ts` (export `PAINT_ATTRS`), `FootprintShape.svelte` (use it)

**Interfaces:**

- **Produces:**
  - `PAINT_ATTRS: Record<Paint, Record<string, string | number>>`, the fill, stroke and stroke-width for each paint. `FootprintShape` takes its attributes from this table, so the stage and the print can't drift apart.
  - `symbolMarkup(svg: string, ink = '#1c1c1a'): { inner: string; rootAttrs: Record<string, string> }`. It strips the outer `<svg>` and keeps its presentation attributes. `currentColor` becomes `ink`.
  - `PrintDiagram.svelte` props: `{ doc: PlanDocument; canvas: CanvasSize; unit: LengthUnit; area: Rect; view: Rect /* drawn feet shown in the area */; symbolPx: number; depth: DepthMap | null; showTiles?: Rect[] }`. Contents:
    - the bay outline and the downrange arrow;
    - a scale bar labelled as in the editor;
    - objects (symbols at `symbolPx`; footprints to scale through the shape builder plus `PAINT_ATTRS`), labels and count badges;
    - text labels, arrows and measure lines with true distances;
    - the scale-break strip, label, ticks and distance tags;
    - optional numbered tile outlines.

    It is clipped to `area`.
- [ ] **Step 1: Write the failing tests:** `symbolMarkup` turns the paper target's `<svg …>` into an inner string without `<svg`, maps `currentColor`, and keeps `stroke-width="5"`; `PAINT_ATTRS.hit.fill` is `'transparent'`.
- [ ] **Step 2: Run to verify failure.** Expected: FAIL.
- [ ] **Step 3: Implement.** The e2e coverage for the diagram comes with Task 3's page.
- [ ] **Step 4: Run** the unit tests, the whole e2e suite (the stage is unchanged), `pnpm check` and `pnpm lint`. Expected: PASS.
- [ ] **Step 5: Commit:** `feat(print): draw the stage diagram for print with SVG attributes`

---

### Task 3: Print pages and the plan print preview

**Files:**

- Create: `src/lib/print/PrintPage.svelte`, `src/lib/print/measure.ts`, `src/routes/(app)/plans/[id]/print/+page.ts`, `+page.svelte`, `tests/e2e/print.spec.ts`
- Modify: `src/lib/editor/components/Toolbar.svelte` (a "Print" link)

**Interfaces:**

- **Produces:**
  - `PrintPage.svelte` takes `{ page: PrintPage; plan: … }` and renders one `<svg data-testid="print-page" width="8.5in" height="11in" viewBox="0 0 816 1056">` (swapped for landscape).
  - The route `/plans/<id>/print` is a preview with controls labelled "Orientation" (Portrait / Landscape), "Diagram" (Fit to page / Tile) and "Tile scale", plus "Print" (`window.print()`) and "Download PDF".
  - Print CSS: `@page { size: letter; margin: 0 }`; the controls are hidden and each page SVG breaks onto its own page.
  - `measure.ts` measures text on a canvas 2D context in `Helvetica, Arial, sans-serif`.
- [ ] **Step 1: Write the failing e2e tests:**
  - **A short plan:** it shows one page with the stage number, name, the five facts, the procedure lines and the diagram's objects (`[data-print-object]` count equals the plan's objects).
  - **A long procedure (Review Focus #1):** with a 40-line procedure there are 2 pages, page 1 shows "Stage procedure and notes on page 2", and page 2 has the procedure.
  - **Tile at 1 in = 10 yd:** on a 40 × 300 yd bay, `1 + tileCount` pages, each tile page labelled "Tile k of n".
  - **Landscape:** the page SVGs are wider than they are tall.
  - **A plan with a scale break (Review Focus #5):** it prints the strip label and the distance tags.
  - **The editor's "Print" link** opens the preview.
- [ ] **Step 2: Run to verify failure.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the whole suite, the autofixer, `pnpm check` and `pnpm lint`. Expected: PASS.
- [ ] **Step 5: Commit:** `feat(print): add the print preview with fit and tiled pages`

---

### Task 4: Download PDF (vector, offline)

**Files:**

- Create: `src/lib/print/pdf.ts`, `tests/e2e/pdf.spec.ts`
- Modify: `package.json` (`jspdf`, `svg2pdf.js`), the plan print page

**Interfaces:**

- **Produces:** `downloadPdf(pages: SVGSVGElement[], orientation: Orientation, filename: string): Promise<void>`. It creates `new jsPDF({ unit: 'pt', format: 'letter', orientation })`. For each page it calls `addPage` (after the first) and then `await doc.svg(el, { x: 0, y: 0, width: 612, height: 792 })` (swapped for landscape), and finally `doc.save(filename)`. The filename is `"<title>.pdf"`, sanitized.
- [ ] **Step 1: Write the failing e2e tests:**
  - **Matching page count (Review Focus #3):** the download fires, and the PDF's page count (`/Type /Page\b` occurrences) equals the number of preview pages, for both 1 and 2 pages.
  - **Vector only:** the PDF contains no `/Subtype /Image`.
  - **Offline:** with `context.setOffline(true)` after the preview has loaded, the PDF still downloads.
- [ ] **Step 2: Run to verify failure.** Expected: FAIL.
- [ ] **Step 3: Implement.** Add the dependencies with `pnpm add jspdf svg2pdf.js` and import them statically in the print route. Map text outside WinAnsi to `?` before drawing it into the PDF.
- [ ] **Step 4: Run** the whole suite, `pnpm check` and `pnpm lint`. Expected: PASS.
- [ ] **Step 5: Commit:** `build(deps): add jspdf and svg2pdf.js`, then `feat(print): download the pages as a vector PDF`

---

### Task 5: Match print

**Files:**

- Create: `src/routes/(app)/matches/[id]/print/+page.ts`, `+page.svelte`
- Modify: `src/routes/(app)/matches/[id]/+page.svelte` (a "Print match" link), `tests/e2e/print.spec.ts`, `pdf.spec.ts`

**Interfaces:**

- **Produces:**
  - The route `/matches/<id>/print` lays out every stage in match order with `layoutPlan`, using each stage's own options (portrait, fit).
  - Its footers read "Match name · Stage N" and "Page x of y" across the whole document.
  - It has the same Print and Download PDF actions; the PDF is named after the match.
- [ ] **Step 1: Write the failing e2e tests (Review Focus #4):**
  - **Two stages:** a match with two stages (one with a long procedure) prints `1 + 2 = 3` pages.
  - **Page 1:** it is stage 1, and its footer reads "Page 1 of 3".
  - **Page 2:** it is stage 2's first page, and its footer reads "Page 2 of 3".
  - **The PDF:** it has 3 pages.
- [ ] **Step 2: Run to verify failure.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the whole suite. Expected: PASS.
- [ ] **Step 5: Commit:** `feat(print): print a whole match as one document`

---

### Task 6: Plan thumbnails

**Files:**

- Create: `src/lib/print/Thumbnail.svelte`
- Modify: `src/routes/(app)/+page.svelte` (plan cards), `src/routes/(app)/matches/[id]/+page.svelte` (stage rows)

**Interfaces:**

- **Produces:** `Thumbnail.svelte` takes `{ plan: PlanRecord }` and renders a `120 × 90` `<svg data-testid="plan-thumbnail" role="img" aria-label="Diagram of <title>">`. It draws `PrintDiagram` in fit mode at symbol size 10 px, with the plan's scale break.
- [ ] **Step 1: Write the failing e2e test:** after placing two objects, the home page card's thumbnail has 2 `[data-print-object]`; a match stage row shows a thumbnail too.
- [ ] **Step 2: Run to verify failure.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the whole suite and the autofixer. Expected: PASS.
- [ ] **Step 5: Commit:** `feat(print): show diagram thumbnails for plans`

---

## After the last task

- ROADMAP: Plan 4 → Done. Stop before Plan 5 (the user's instruction for this thread).
