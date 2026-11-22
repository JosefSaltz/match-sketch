# Plan 2: Stage Brief, Targets Tally, Annotations, Matches — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The MD can fill in the whole stage brief beside the diagram (with a computed Targets tally), annotate the stage with text labels, movement arrows and measure lines that follow their objects, and group plans into matches with ordered, numbered stages.

**Architecture:** The brief and the annotations live in the plan's `PlanDocument`, so they ride the existing immutable-document flow (commit → history → journal → IndexedDB) and get undo/redo for free. Annotations attach to objects by id and resolve their positions at render time. Matches are a third IndexedDB record type (Dexie v3) with the same sync fields as plans and canvases. A plan joins a match through its existing `matchId` and `stageOrder` fields, and stage numbers are derived from the match order unless typed by hand.

**Tech Stack:** SvelteKit 3, Svelte 5 runes, TypeScript, Tailwind 4, Zod 4, Dexie 4, Vitest (+ fake-indexeddb), Playwright.

**Spec:** `docs/superpowers/specs/2026-11-21-match-sketch-design.md` — §6 (computed tally, measure annotation, coordinates), §7.1 screens 2–5, §7.2 (brief), §7.3 (annotations, auto labels), §7.8 (matches table), §7.10 (keep structured steps possible). Roadmap entry: `docs/superpowers/plans/ROADMAP.md` (Plan 2).

## Global Constraints

- Positions are stored in feet, origin at the uprange-left corner, `y` downrange (drawn upward). Lengths are shown in the plan's unit (`ft` | `yd`) through `formatLength`/`fromFeet` in `src/lib/geometry/units.ts`.
- Annotations are drawn at a fixed screen size (stroke widths and text in px), like symbols.
- Every record keeps the sync fields from `SyncMeta` (`id`, `version`, `updatedAt`, `deletedAt`, `dirty`). Deletes are soft (`deletedAt`), and every write sets `dirty: 1` and `updatedAt: now()`.
- Deleting a match never deletes its plans: they become unassigned (`matchId: null`, `stageOrder: null`).
- The Targets tally counts only `category: 'target'` objects, summing `count` (default 1).
- `schemaVersion` stays `1`: the Plan 1 schema allowed only an empty `annotations` array, so every stored plan is valid under the new schema.
- Controls are at least 44 px tall (`min-h-11`), use the shared `Button`, `Field`, `PanelHeader` and `controlClass`, and every `.svelte`/`.svelte.ts` file passes the Svelte MCP `svelte-autofixer` with no issues.
- Existing e2e specs keep passing. Where this plan renames a landmark, the task updates those specs in the same commit.
- Commits are atomic, Angular style (`type(scope): description`), per `AGENTS.md`.

## Decisions (made in this plan; correctable)

1. **Procedure stays one text field.** Plan 7 can split it into steps by line, or migrate it with a `schemaVersion` bump. Storing steps now would need a step-aware editor that nothing in Plans 2–6 uses. (Roadmap note for Plan 7.)
2. **Deleting an object detaches the lines attached to it.** The arrow or measure end becomes a point at the object's last position, as PowerPoint does with connectors. The MD's line survives, and undo restores both the object and the attachment.
3. **Brief text saves as you type.** All keystrokes in one field, from focus until blur, make a single undo step. Typed text therefore survives a reload, and undo doesn't step back one letter at a time.
4. **Right column = two tabs, "Properties" and "Brief".** Selecting an object never switches tabs. Placing a text label switches to Properties, so the label can be typed.
5. **Annotation tools live at the top of the left palette** ("Text label", "Movement arrow", "Measure"). They are armed like symbols. Spec §7.1 lists the measure tool in the top bar, but that bar already wraps at tablet width, and arm-then-tap is the gesture the palette already teaches.
6. **Stage number:** a number typed in the brief wins. If the field is empty, a plan in a match takes its 1-based position in the match order. Titles use this number everywhere.
7. **Match name:** a plan in a match shows the match's name read-only, with a link to the match. Unassigned plans keep the free-text field.
8. **Duplicating a plan that is in a match** appends the copy as the match's last stage.
9. **Scale break:** not in this plan. It waits for the user's keep/drop decision on the spike (`spike/scale-break`).

## Review Focus

1. **Typing in a brief field, then reloading without leaving it**, keeps the typed text. → Task 1 (e2e).
2. **Backspace, Delete or arrow keys typed into a brief field** edit the text and never delete or nudge the selected object. → Task 1 (e2e).
3. **Deleting a plan that belongs to a match** closes the gap: the remaining stages renumber 1…n, and the home page's stage count drops. → Task 6 (unit).
4. **An annotation attached to an object that isn't in the document** (old or synced data) is skipped when drawn, and the editor doesn't crash. → Task 3 (unit), Task 5 (component path covered by `resolveAnchor` returning `null`).
5. **Delete an object that has a measure line attached, then undo:** the line is attached to the object again and follows it when moved. → Task 5 (e2e).

---

## File Structure

```
src/lib/
  model/plan.ts                     + AnchorSchema, AnnotationSchema (annotations array)
  catalog/types.ts, entries.ts      + optional `plural` on entries (steel-static: "Static steel")
  brief/tally.ts                    targetsTally(), targetsText()
  editor/
    history.ts                      + replace()
    annotations.ts                  anchors, positions, annotation ops (pure)
    ops.ts                          deleteObjects → deleteItems, moveObjects → moveItems
    editor-state.svelte.ts          brief editing, panel tab, tools, text placement, link drags, match context
    components/
      SidePanel.svelte              right column: tabs "Properties" | "Brief"
      BriefPanel.svelte             brief fields, Targets tally/override, notes sections
      PropertiesPanel.svelte        + annotation properties; becomes a tab panel
      AnnotationLayer.svelte        text labels, arrows, measure lines, their selection + handles
      Palette.svelte                + "Annotate" tools group
      EditorCanvas.svelte           tool gestures, annotation hits, endpoint handles
  store/
    db.ts                           version 3 adds `matches`
    records.ts                      + MatchRecord, MatchInputSchema, effectiveStageNumber(), planTitle(plan, n?)
    matches.ts                      match repository
    plans.ts                        createPlan(… matchId), duplicatePlan appends in its match
  matches/
    reorder.ts                      reorderIndex(), moveItem()
    MatchForm.svelte                name + date form (new match dialog)
routes/(app)/
  +page.svelte                      "My matches", "Unassigned plans", "New match"
  matches/[id]/+page.ts, +page.svelte   match screen
  plans/new/+page.svelte            optional match (?match=<id>)
  plans/[id]/+page.ts               loads the match context
tests/e2e/
  brief.spec.ts, annotations.spec.ts, matches.spec.ts
```

---

### Task 1: Stage brief panel

**Files:**

- Create: `src/lib/editor/components/SidePanel.svelte`, `src/lib/editor/components/BriefPanel.svelte`, `tests/e2e/brief.spec.ts`
- Modify: `src/lib/editor/history.ts`, `history.test.ts`, `src/lib/editor/editor-state.svelte.ts`, `src/lib/editor/components/PropertiesPanel.svelte`, `EditorView.svelte`; e2e specs that use `getByRole('complementary', { name: 'Properties' })` (`editor-edit`, `editor-handles`, `theme-editor`)

**Interfaces:**

- Produces:
  - `History<T>.replace(next: T): void`: makes `next` current without adding an undo step, and clears redo.
  - `EditorState`:
    - `panel = $state<'properties' | 'brief'>('properties')`.
    - `setBrief(patch: Partial<StageBrief>, typing?: string): void`. If `typing` is set and equals the previous `setBrief` call's key, with no other commit, undo or redo in between, the change replaces the last history step. Otherwise it is a new step. It saves like every commit.
    - `endTyping(): void` ends the current typing run (call on blur).
    - Notes sections: `addNoteSection(): void` appends `{ id: crypto.randomUUID(), title: '', body: '' }`. `updateNoteSection(id, patch: { title?: string; body?: string }, typing?: string): void`. `removeNoteSection(id): void`.
  - `SidePanel.svelte` (`{ editor }`): `<aside aria-label="Inspector">` with a `tablist` holding the tabs "Properties" and "Brief" (`aria-selected`, arrow keys move between tabs). Panels have `role="tabpanel"` and are labelled by their tab, so the accessible names are "Properties" and "Brief".
  - `BriefPanel.svelte` (`{ editor }`), with fields labelled exactly: "Match name", "Stage number", "Stage name", "Start position", "Gun ready condition", "Stage procedure" (textarea, 8 rows), "Round count", "Par time". The "Targets" row is a placeholder until Task 2. A "Notes" group has buttons "Add notes section" and, for each section, "Title" (input), "Text" (textarea), and "Remove section".
  - Layout: `EditorView` columns become `grid-cols-[16rem_1fr_20rem]`, and the right column renders `SidePanel`.

- [ ] **Step 1: Write the failing tests**

```ts
// history.test.ts
it('replace swaps the current value without adding an undo step', () => {
	const h = createHistory(1);
	h.push(2);
	h.replace(3);
	expect(h.current).toBe(3);
	expect(h.undo()).toBe(1);
});
// brief.spec.ts — beforeEach: canvas "Bay A" 50 × 25 yd, plan from it (helpers)
const brief = (page) => page.getByRole('tabpanel', { name: 'Brief' });
test('brief fields save and come back after reload', …
	// open the Brief tab, fill "Stage name" = "El Presidente", "Par time" = "10 s",
	// "Stage procedure" = "Start in the box.\nEngage T1–T4." ; reload; open Brief;
	// expect each value; toolbar title shows "El Presidente"
test('typed text survives a reload without leaving the field (Review Focus #1)', …
	// type "Hands on X" into "Start position", reload immediately (field still focused) → value kept
test('one undo step per field visit', …
	// type "abc" into "Round count", blur, click toolbar Undo → field empty (not "ab")
test('keys typed in the brief never edit the stage (Review Focus #2)', …
	// place a popper, select it, open Brief, type into "Stage name" then press Backspace,
	// ArrowLeft and Delete → still 1 object at the same X/Y (Properties tab)
test('notes sections can be added, filled and removed', …
	// "Add notes section", Title "Bonuses", Text "-1 s per popper" → reload → kept; "Remove section" → gone
```

- [ ] **Step 2: Run to verify failure:** `pnpm vitest run src/lib/editor/history.test.ts` and `pnpm playwright test tests/e2e/brief.spec.ts`. Expected: FAIL (`replace` and the Brief tab don't exist yet).
- [ ] **Step 3: Implement** `replace`, the `EditorState` brief methods, `SidePanel` and `BriefPanel`. Turn `PropertiesPanel`'s outer element into the Properties tab panel's content, without `PanelHeader`, since the tabs replace it. Inputs commit on `input` with `typing` set to the field name, and call `endTyping` on `blur`. Update the three e2e specs to `getByRole('tabpanel', { name: 'Properties' })`.
- [ ] **Step 4: Run** the unit tests, the whole e2e suite, `pnpm check` and `pnpm lint`. Expected: PASS.
- [ ] **Step 5: Commit:** `feat(editor): add the stage brief panel beside the properties`

---

### Task 2: Targets tally

**Files:**

- Create: `src/lib/brief/tally.ts`, `src/lib/brief/tally.test.ts`
- Modify: `src/lib/catalog/types.ts`, `src/lib/catalog/entries.ts`, `BriefPanel.svelte`, `tests/e2e/brief.spec.ts`

**Interfaces:**

- Consumes: `getEntry`, `CATALOG` (catalog order); `EditorState.setBrief` (Task 1).
- Produces:
  - `BaseEntry.plural?: string` (display plural; default `name + 's'`). Set `plural: 'Static steel'` on `steel-static`.
  - `targetsTally(objects: PlanObject[]): string`. Entries appear in catalog order, as `"<n> <name or plural, lowercased>"` joined with `", "`; `''` when there are no targets. Unknown symbol ids are skipped.
  - `targetsText(doc: PlanDocument): string` returns `doc.brief.targetsOverride ?? targetsTally(doc.objects)`.
  - In `BriefPanel`, the "Targets" row shows `targetsTally` (`data-testid="targets-tally"`, "No targets yet" when empty) with an "Override" button. That button sets `targetsOverride` to the current tally and shows a textarea labelled "Targets". A "Use computed tally" button sets it back to `null`. An override that trims to empty is stored as `null`.

- [ ] **Step 1: Write the failing tests**

```ts
// tally.test.ts — objects built with a small helper obj(symbolId, extra?)
it('sums counts per target type in catalog order', () => {
	expect(
		targetsTally([obj('steel-static'), obj('paper', { count: 4 }), obj('steel-static', { count: 2 })])
	).toBe('4 paper targets, 3 static steel');
});
it('uses the singular for one', () => {
	expect(targetsTally([obj('popper')])).toBe('1 knock-down popper');
});
it('ignores props, areas, markers and unknown symbols', () => {
	expect(targetsTally([obj('barrel'), obj('shooting-box'), obj('nope')])).toBe('');
});
it('an override wins over the tally', () => {
	expect(targetsText({ ...doc([obj('paper')]), brief: { ...brief, targetsOverride: '6 paper' } })).toBe('6 paper');
});
// brief.spec.ts
test('targets tally follows the diagram and can be overridden', …
	// place 2 paper + 1 popper; Count of one paper = 3 → tally "4 paper targets, 1 knock-down popper";
	// Override → "Targets" textarea → "4 paper, 1 popper (activator)" → reload → kept;
	// "Use computed tally" → back to the computed text
```

- [ ] **Step 2: Run to verify failure:** `pnpm vitest run src/lib/brief`. Expected: FAIL (module missing).
- [ ] **Step 3: Implement** `plural`, `tally.ts`, and the Targets row.
- [ ] **Step 4: Run** the unit tests, `tests/e2e/brief.spec.ts`, `pnpm check` and `pnpm lint`. Expected: PASS.
- [ ] **Step 5: Commit:** `feat(editor): compute the targets tally with a manual override`

---

### Task 3: Annotation model and operations

**Files:**

- Create: `src/lib/editor/annotations.ts`, `src/lib/editor/annotations.test.ts`
- Modify: `src/lib/model/plan.ts`, `plan.test.ts`, `src/lib/editor/ops.ts`, `ops.test.ts`, `src/lib/editor/editor-state.svelte.ts` (callers of the renamed ops)

**Interfaces:**

- Produces (`plan.ts`):

```ts
export const AnchorSchema = z.discriminatedUnion('kind', [
	z.object({ kind: z.literal('object'), objectId: z.uuid() }),
	z.object({ kind: z.literal('point'), x: finite, y: finite })
]);
const link = { id: z.uuid(), from: AnchorSchema, to: AnchorSchema };
export const AnnotationSchema = z.discriminatedUnion('type', [
	z.object({ id: z.uuid(), type: z.literal('text'), x: finite, y: finite, text: z.string().min(1).max(200) }),
	z.object({ type: z.literal('arrow'), ...link }),
	z.object({ type: z.literal('measure'), ...link })
]);
// PlanDocumentSchema.annotations: z.array(AnnotationSchema)
```

  Types: `Anchor`, `Annotation`, `TextAnnotation`, and `LinkAnnotation` (arrow | measure).

- Produces (`annotations.ts`, all pure):
  - `resolveAnchor(doc, anchor): Point | null`: the object's `x, y`, or the point; `null` when the object isn't in `doc`.
  - `measureFt(doc, a: LinkAnnotation): number | null`: the straight-line length in feet between the resolved ends.
  - `itemPosition(doc, id): Point | null`: an object, a text annotation, or a link's resolved `from`.
  - `anchorAt(doc, hitObjectId: string | null, world: Point, canvas: CanvasSize, step: number | null): Anchor`. It returns an object anchor when the hit object exists. Otherwise it returns a point snapped with `snapPoint` and clamped inside the bay.
  - `addAnnotation(doc, a: Annotation): PlanDocument`.
  - `setText(doc, id, text: string): PlanDocument`: trims and cuts to 200 characters, and leaves `doc` unchanged when the result is empty.
  - `setAnchor(doc, id, end: 'from' | 'to', anchor: Anchor): PlanDocument`.
- Produces (`ops.ts`, replacing `deleteObjects` and `moveObjects` and their tests):
  - `deleteItems(doc, ids): PlanDocument` removes objects and annotations with those ids. Every anchor that points at a removed object becomes a point anchor at that object's position (Decision 2).
  - `moveItems(doc, ids, delta, canvas): PlanDocument` moves objects, text annotations, and the **point** anchors of selected links by one shared delta. Object anchors don't move. The delta is clamped so every moving point stays in the bay, as `moveObjects` did.

- [ ] **Step 1: Write the failing tests**

```ts
// plan.test.ts
it('accepts the three annotation types and rejects others', () => {
	expect(PlanDocumentSchema.safeParse({ ...doc, annotations: [text, arrow, measure] }).success).toBe(true);
	expect(PlanDocumentSchema.safeParse({ ...doc, annotations: [{ ...text, type: 'circle' }] }).success).toBe(false);
});
// annotations.test.ts
it('an anchor to a missing object resolves to null (Review Focus #4)', () => {
	expect(resolveAnchor(doc, { kind: 'object', objectId: crypto.randomUUID() })).toBeNull();
});
it('measures between an object and a point', () => {
	// object at (0,0), point (3,4) → 5
	expect(measureFt(d, m)).toBe(5);
});
it('anchorAt snaps and clamps free points', () => {
	expect(anchorAt(d, null, { x: 7.4, y: -2 }, { widthFt: 30, depthFt: 30 }, 1)).toEqual({ kind: 'point', x: 7, y: 0 });
});
it('setText ignores empty text', () => {
	expect(setText(d, textId, '   ')).toBe(d);
});
// ops.test.ts
it('deleting an object detaches lines attached to it', () => {
	const next = deleteItems(d, [objectId]);
	expect(next.annotations[0]).toMatchObject({ from: { kind: 'point', x: 10, y: 5 } });
});
it('moves text and free line ends with the selection; attached ends stay attached', () => { … });
it('clamps the shared delta at the bay edge for annotations too', () => { … });
```

- [ ] **Step 2: Run to verify failure:** `pnpm vitest run src/lib/model src/lib/editor`. Expected: FAIL.
- [ ] **Step 3: Implement** the schema, `annotations.ts`, `deleteItems` and `moveItems`. Point `EditorState.deleteSelected`, `nudge` and `updateMove` at the new ops. `#show` keeps a selection id if it names an object **or** an annotation. Add `selectedAnnotations = $derived(…)` next to `selectedObjects`.
- [ ] **Step 4: Run** the unit tests, the whole e2e suite (no behavior change), `pnpm check` and `pnpm lint`. Expected: PASS.
- [ ] **Step 5: Commit:** `feat(editor): add the annotation model with object anchors`

---

### Task 4: Text labels and the Annotate tools

**Files:**

- Create: `src/lib/editor/components/AnnotationLayer.svelte`, `tests/e2e/annotations.spec.ts`
- Modify: `editor-state.svelte.ts`, `EditorCanvas.svelte`, `Palette.svelte`, `PropertiesPanel.svelte`

**Interfaces:**

- Consumes: Task 3 (`addAnnotation`, `setText`, `itemPosition`, `moveItems`, `deleteItems`).
- Produces:
  - `type AnnotationTool = 'text' | 'arrow' | 'measure'`; `EditorState.tool = $state<AnnotationTool | null>(null)`; `armTool(tool: AnnotationTool | null): void`. Arming a tool disarms the armed symbol, and `arm(symbolId)` clears `tool`.
  - `EditorState.placeText(screenPt: Point): string`: adds a text annotation with text "Text" at the snapped point (clamped to the bay), selects it, sets `panel = 'properties'`, disarms the tool, and returns its id.
  - `EditorState.setText(id, text): void` commits `setText`.
  - `beginMove` and `updateMove` accept an annotation id as the grabbed item. The snapping anchor is `itemPosition(base, id)`.
  - `AnnotationLayer.svelte` (`{ editor }`) draws below `SelectionOverlay` and above objects. Each annotation is a `<g data-testid="annotation" data-annotation-id data-annotation-type>`. Text uses 13 px semibold with a 3 px white halo (`data-testid="annotation-text"`). A selected annotation gets the selection color.
  - In `Palette`, an "Annotate" group above the symbol categories holds three toggles (`aria-pressed`): "Text label" (`data-testid="tool-text"`), "Movement arrow" (`tool-arrow`), "Measure" (`tool-measure`). Escape disarms a tool as it disarms a symbol. The arrow and measure toggles arm their tool, but the gesture comes in Task 5.
  - `PropertiesPanel` for one text annotation: the heading "Text label", a "Text" input (maxlength 200, commits on change), and Delete. For a mixed or multiple selection: "N items selected" with Delete; Duplicate shows only when objects are selected.
  - `EditorCanvas`: with the text tool armed, a tap (no slop exceeded) calls `placeText`. A press on `[data-annotation-id]` selects (Shift toggles) and starts a move, as with objects.

- [ ] **Step 1: Write the failing e2e tests** (`annotations.spec.ts`; beforeEach: canvas 50 × 25 yd and a plan)

```ts
test('place, edit, move and delete a text label', …
	// click "Text label", tap the bay → 1 annotation[type=text] with text "Text", Properties shows "Text label";
	// fill "Text" = "Hard cover" + Enter → label shows "Hard cover";
	// drag the label 40 px right → its x changes (read via the annotation's transform);
	// press Delete → 0 annotations; Undo → 1
test('the label tool disarms after one placement and with Escape', …
test('text labels survive a reload', …
```

- [ ] **Step 2: Run to verify failure:** `pnpm playwright test tests/e2e/annotations.spec.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the tool state, `placeText`, `AnnotationLayer` (text only; links in Task 5), the palette group, the canvas gestures and the properties.
- [ ] **Step 4: Run** the whole e2e suite, `pnpm check`, `pnpm lint` and the autofixer. Expected: PASS.
- [ ] **Step 5: Commit:** `feat(editor): add text labels and the annotate tools`

---

### Task 5: Movement arrows and measure lines

**Files:**

- Modify: `editor-state.svelte.ts`, `AnnotationLayer.svelte`, `EditorCanvas.svelte`, `PropertiesPanel.svelte`, `tests/e2e/annotations.spec.ts`

**Interfaces:**

- Consumes: Task 3 (`anchorAt`, `setAnchor`, `resolveAnchor`, `measureFt`), Task 4 (tools, layer).
- Produces:
  - `EditorState.beginLink(screenPt: Point, hitObjectId: string | null): void`, with the arrow or measure tool armed. The press's anchor becomes the fixed `from`, and the drag moves `to`.
  - `EditorState.beginEndpoint(id: string, end: 'from' | 'to'): void` drags an existing link's end. The other end stays fixed.
  - `EditorState.updateLink(screenPt: Point, hitObjectId: string | null): void` previews the link, with the moving end at `anchorAt(…)`.
  - `EditorState.endLink(): void` commits once. A new link is selected and the tool disarmed. When both ends resolve to the same point or the same object, nothing is committed.
  - `EditorState.cancelLink(): void`.
  - `EditorCanvas` finds `hitObjectId` with `document.elementFromPoint(clientX, clientY)?.closest('[data-object-id]')`. With pointer capture on, that is the only way to see what's under the finger.
  - Drawing, all at fixed size:
    - An arrow is a 2 px dashed line (`6 4`) with a filled arrowhead at `to`.
    - A measure is a 1.5 px solid line with 8 px end ticks, plus a white-backed label at its midpoint (`data-testid="measure-label"`) showing `formatLength(measureFt, unit)`.
    - Each link has a 14 px transparent hit stroke.
    - A single selected link shows end handles `data-annotation-handle="from" | "to"` (r = 13, the same as resize handles).
    - A link whose end doesn't resolve isn't drawn.
  - Properties for one link: the heading "Movement arrow" or "Measure line". A measure also shows "Distance" with the formatted length (`data-testid="measure-distance"`). Both have Delete.

- [ ] **Step 1: Write the failing e2e tests**

```ts
test('measure between two objects shows the true distance and follows a move', …
	// Snap 1 yd; place poppers at two bay points; X/Y fields set to (10,5) and (10,15) yd;
	// "Measure" tool, drag from object 1 to object 2 → measure-label "10 yd";
	// set object 2 Y = 20 → label "15 yd"
test('an arrow drawn from empty ground to an object stays attached', …
	// arrow tool, drag from a free point onto a popper → move the popper → the arrow's end follows
	// (its `to` handle position ≈ the popper's screen position)
test('undo and redo restore lines; deleting an object detaches, undo reattaches (Review Focus #5)', …
	// measure between A and B; delete B → measure still there with the same label;
	// Undo → B back; move B → label changes (attached again); Redo after Undo → state matches
test('dragging an end handle re-anchors the line', …
test('a tap with the measure tool makes no line', …
```

- [ ] **Step 2: Run to verify failure:** `pnpm playwright test tests/e2e/annotations.spec.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the link drags, the drawing, the handles and the properties.
- [ ] **Step 4: Run** the whole e2e suite, `pnpm check`, `pnpm lint` and the autofixer. Expected: PASS.
- [ ] **Step 5: Commit:** `feat(editor): add movement arrows and measure lines`

---

### Task 6: Match records and stage numbering

**Files:**

- Create: `src/lib/store/matches.ts`, `src/lib/store/matches.test.ts`
- Modify: `src/lib/store/db.ts`, `src/lib/store/records.ts`, `src/lib/store/plans.ts`, `plans.test.ts`

**Interfaces:**

- Produces:
  - `records.ts`:
    - `type MatchRecord = SyncMeta & { name: string; date: string }`, where `date` is `''` or `YYYY-MM-DD`.
    - `MatchInputSchema = z.object({ name: z.string().trim().min(1).max(80), date: z.union([z.literal(''), z.iso.date()]) })`; `MatchInput`.
    - `effectiveStageNumber(plan: Pick<PlanRecord, 'id' | 'document'>, matchOrder: string[] | null): string`. It returns the trimmed typed number when there is one, else `String(index + 1)` when the plan is in `matchOrder`, else `''`.
    - `planTitle(plan, stageNumber = plan.document.brief.stageNumber): string`, with the same rules as today, using `stageNumber`.
  - `db.ts`: `version(3)` keeps the v2 stores and adds `matches: 'id, updatedAt, dirty'`; `declare matches: Table<MatchRecord, string>`.
  - `matches.ts`:
    - `listMatches(db): Promise<MatchRecord[]>`: not deleted, sorted by date (newest first; undated last), then by name.
    - `createMatch(db, input: MatchInput): Promise<MatchRecord>`.
    - `getMatch(db, id): Promise<MatchRecord | undefined>`: not deleted.
    - `updateMatch(db, id, input: MatchInput): Promise<MatchRecord>`.
    - `deleteMatch(db, id): Promise<void>`: in one transaction, soft-deletes the match and unassigns its plans.
    - `listMatchPlans(db, matchId): Promise<PlanRecord[]>`: not deleted, ascending `stageOrder`.
    - `assignPlan(db, planId, matchId: string | null): Promise<void>`. Assigning appends with `stageOrder = max + 1`, and `null` unassigns.
    - `reorderMatchPlans(db, matchId, orderedPlanIds: string[]): Promise<void>` sets `stageOrder` to each plan's index.
  - `plans.ts`:
    - `createPlan(db, { canvas, sourceCanvasId, matchId?: string | null })` appends the plan to the match when `matchId` is given.
    - `duplicatePlan` appends the copy to the source's match (Decision 8).

- [ ] **Step 1: Write the failing tests** (fake-indexeddb, as in `plans.test.ts`)

```ts
it('stage numbers follow the match order unless typed', () => {
	expect(effectiveStageNumber(planB, [a, b, c])).toBe('2');
	expect(effectiveStageNumber(withNumber(planB, '7'), [a, b, c])).toBe('7');
	expect(effectiveStageNumber(planB, null)).toBe('');
});
it('assigning appends; reordering renumbers', async () => { … listMatchPlans order … });
it('deleting a plan closes the gap in the match (Review Focus #3)', async () => {
	// three plans in a match, delete the middle one → order ids [a, c] → stage numbers 1 and 2
});
it('deleting a match unassigns its plans and keeps them', async () => {
	await deleteMatch(db, m.id);
	expect(await getPlan(db, p.id)).toMatchObject({ matchId: null, stageOrder: null });
	expect(await listMatches(db)).toEqual([]);
});
it('duplicating a plan in a match appends the copy', async () => { … });
it('rejects a blank match name and accepts a blank date', () => { … MatchInputSchema … });
it('lists matches newest first with undated last', async () => { … });
```

- [ ] **Step 2: Run to verify failure:** `pnpm vitest run src/lib/store`. Expected: FAIL.
- [ ] **Step 3: Implement** the records, the Dexie v3 store and the repositories.
- [ ] **Step 4: Run** the unit tests, `pnpm check` and `pnpm lint`. Expected: PASS.
- [ ] **Step 5: Commit:** `feat(store): add matches with ordered stages`

---

### Task 7: Matches on the home page

**Files:**

- Create: `src/lib/matches/MatchForm.svelte`, `tests/e2e/matches.spec.ts`
- Modify: `src/routes/(app)/+page.svelte`, `tests/e2e/new-plan.spec.ts`, `tests/e2e/theme-home.spec.ts`

**Interfaces:**

- Consumes: Task 6 repositories.
- Produces:
  - `MatchForm.svelte` (`{ submitLabel: string; initial?: MatchInput; onsubmit: (input: MatchInput) => void; oncancel?: () => void }`), with fields "Name" (required; error "Enter a name") and "Date" (`type="date"`, optional).
  - Home:
    - The header gets a "New match" button. It opens a dialog titled "New match", saves with "Create match", then goes to `/matches/<id>`.
    - A section "My matches" (`aria-labelledby` heading, so the region's name is "My matches") lists cards with the match name, the date (`toLocaleDateString`, or "No date"), "N stages" ("1 stage"), Open (a link), and Delete. Delete confirms with: `Delete match "<name>"? Its <N> stages stay as unassigned plans.`
    - The empty state reads "No matches yet. Group stages into a match with “New match”."
    - The "Plans" section becomes "Unassigned plans" and lists only plans with `matchId === null`. Its empty text is "No unassigned plans."
    - Stage counts come from the plans already loaded, grouped by `matchId`.
  - Update `new-plan.spec.ts` and `theme-home.spec.ts` to the region name "Unassigned plans".

- [ ] **Step 1: Write the failing e2e tests**

```ts
test('create a match from the home page', …
	// "New match" → Name "DRRC November", Date 2026-11-29 → URL /matches/<uuid> → back home →
	// region "My matches" lists "DRRC November", "0 stages"
test('a new match needs a name', …
	// "Create match" with an empty Name → "Enter a name", still on the home page
test('plans list under "Unassigned plans"', …
```

  The test that deleting a match keeps its plans goes in Task 8, because assigning plans needs the match screen.

- [ ] **Step 2: Run to verify failure:** `pnpm playwright test tests/e2e/matches.spec.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `MatchForm` and the home sections. Update the two specs.
- [ ] **Step 4: Run** the whole e2e suite, `pnpm check`, `pnpm lint` and the autofixer. Expected: PASS.
- [ ] **Step 5: Commit:** `feat(matches): list and create matches on the home page`

---

### Task 8: Match screen

**Files:**

- Create: `src/lib/matches/reorder.ts`, `reorder.test.ts`, `src/routes/(app)/matches/[id]/+page.ts`, `+page.svelte`
- Modify: `tests/e2e/matches.spec.ts`

**Interfaces:**

- Consumes: Task 6 repositories and `effectiveStageNumber`/`planTitle`; Task 7 `MatchForm`.
- Produces:
  - `reorder.ts`:
    - `reorderIndex(midpoints: number[], pointerY: number): number` returns the number of midpoints above `pointerY` (strictly less than), so dropping above the first row gives 0.
    - `moveItem<T>(list: readonly T[], from: number, to: number): T[]`.
  - `load` returns `{ match: MatchRecord | null, plans: PlanRecord[] }`.
  - The page:
    - The header bar matches the new-plan page (wordmark link home, Theme).
    - An `h1` shows the match name, and "Name" and "Date" fields save on change.
    - Section "Stages" is an `<ol>` of rows. Each row has:
      - a drag handle button `aria-label="Reorder stage N"`, using pointer events: while dragging, rows reorder live with `reorderIndex` over the rows' midpoints, and `reorderMatchPlans` runs on release
      - "Stage N" (from `effectiveStageNumber`) and the plan title (`planTitle` with that number)
      - the dimensions
      - Open (a link to the editor)
      - icon buttons "Move stage N up" / "Move stage N down"
      - "Remove", which unassigns the plan and shows no dialog, because the plan is kept
    - Actions:
      - "New stage" links to `/plans/new?match=<id>` (wired in Task 9).
      - "Add existing plan" opens a dialog listing unassigned plans, each with an "Add" button. When there are none, it says "No unassigned plans."
    - An unknown id shows "Match not found" and a link home, as the editor does.

- [ ] **Step 1: Write the failing tests**

```ts
// reorder.test.ts
it('counts the midpoints above the pointer', () => {
	expect(reorderIndex([10, 30, 50], 5)).toBe(0);
	expect(reorderIndex([10, 30, 50], 31)).toBe(2);
	expect(reorderIndex([10, 30, 50], 99)).toBe(3);
});
it('moves an item', () => expect(moveItem(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a']));
// matches.spec.ts — helper: three unassigned plans named via the brief (Task 1) "Alpha", "Bravo", "Charlie"
test('add existing plans; stage numbers follow the order', …
	// match screen → "Add existing plan" ×3 → rows "Stage 1 — Alpha", "Stage 2 — Bravo", "Stage 3 — Charlie";
	// home: "Unassigned plans" no longer lists them; "My matches" says "3 stages"
test('reorder by buttons and by dragging the handle', …
	// "Move stage 1 down" → Bravo is Stage 1; drag Charlie's handle above Bravo → Charlie is Stage 1; reload → kept
test('remove a stage keeps the plan as unassigned', …
test('deleting a match keeps its plans as unassigned', …
test('rename and date the match', …
```

- [ ] **Step 2: Run to verify failure:** `pnpm vitest run src/lib/matches` and `pnpm playwright test tests/e2e/matches.spec.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `reorder.ts`, the route `load`, and the page.
- [ ] **Step 4: Run** the unit tests, the whole e2e suite, `pnpm check`, `pnpm lint` and the autofixer. Expected: PASS.
- [ ] **Step 5: Commit:** `feat(matches): add the match screen with ordered stages`

---

### Task 9: Plans that belong to a match

**Files:**

- Modify: `src/routes/(app)/plans/new/+page.svelte`, `src/routes/(app)/plans/[id]/+page.ts`, `+page.svelte`, `EditorView.svelte`, `editor-state.svelte.ts`, `Toolbar.svelte`, `BriefPanel.svelte`, `src/routes/(app)/+page.svelte` (card titles), `tests/e2e/matches.spec.ts`

**Interfaces:**

- Consumes: Task 6 (`createPlan` with `matchId`, `listMatchPlans`, `getMatch`, `effectiveStageNumber`, `planTitle`).
- Produces:
  - `type MatchContext = { id: string; name: string; order: string[] }`.
  - `plans/[id]/+page.ts` returns `{ plan, match: MatchContext | null }`, where `order` holds the ids from `listMatchPlans`.
  - `EditorState` takes a constructor argument `match: MatchContext | null = null` and adds:
    - `readonly match`
    - `stageNumber = $derived(effectiveStageNumber({ id: plan.id, document: doc }, match?.order ?? null))`
    - `title = $derived(planTitle({ document: doc }, stageNumber))`
  - `Toolbar` shows `editor.title`.
  - `BriefPanel`, when `editor.match` is set:
    - "Match name" becomes read-only text with a link to `/matches/<id>`.
    - "Stage number" shows the placeholder `"<n> (match order)"` while empty.
  - New-plan page: a "Match" select ("No match", then each match from `listMatches`), preselected from `?match=<id>`, passed to `createPlan`. After creating a plan from a match's "New stage", the editor opens; the match screen lists the new plan last.
  - Match-screen rows and editor titles agree, because both use `effectiveStageNumber`.

- [ ] **Step 1: Write the failing e2e tests**

```ts
test('new stage from a match joins it and is numbered by order', …
	// match with 1 stage → "New stage" → create from a saved canvas (Match select preselected) →
	// editor title "Stage 2"; Brief shows match name as a link; back on the match screen → 2 rows
test('a typed stage number wins over the match order', …
	// in the editor Brief, Stage number "5" → match screen row shows "Stage 5"
test('the new-plan page can put a plan into a match', …
```

- [ ] **Step 2: Run to verify failure:** `pnpm playwright test tests/e2e/matches.spec.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the load, the editor context, the brief variants and the new-plan select.
- [ ] **Step 4: Run** the whole suite (`pnpm test`), `pnpm check`, `pnpm lint` and the autofixer. Expected: PASS.
- [ ] **Step 5: Commit:** `feat(matches): number and name stages from their match`

---

## After the last task

- ROADMAP: Plan 2 → Done (date). Scale break row: "Spike built; waiting for the user" until they decide.
- Spec §7.10: note Decision 1 (the procedure stays one field; Plan 7 splits by line or migrates).
