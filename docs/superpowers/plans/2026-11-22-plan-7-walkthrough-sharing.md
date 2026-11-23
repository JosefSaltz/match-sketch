# Plan 7: Walkthrough & sharing by link — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Any user can share a stage or a match by a stable read-only link (printed as a QR code), and anyone with the link can view the stage and page through its walkthrough: the procedure's steps, each highlighting the objects it involves by meaning.

**Architecture:**

- **Schema version 2:** the brief's `procedure` string becomes `steps: Step[]`, one per line, each with its marks (object + meaning) and arrows. The procedure field still edits as one textarea; a line diff keeps each line's step id. One function, `readPlanDocument`, reads either version, and is used everywhere a document comes from outside (IndexedDB upgrade, journal, sync push and pull, the share link).
- **Sharing** lives on the plan and match records (`share: { id, on } | null`), syncs like any other field, and is served without sign-in by `GET /api/shared/[token]`. The viewer is a client page at `/s/[token]`.
- **Highlights** render in one SVG component used by the print diagram (viewer, walkthrough player) and the editor canvas (authoring).

**Tech Stack:** SvelteKit 3.4, Svelte 5, Zod 4, Dexie 4, Drizzle, Supabase local stack, `uqr` (QR matrix), Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-21-match-sketch-design.md`: §1 (users), §7.2 (procedure as steps), §7.8 (share columns), §7.10 (walkthrough), §7.11 (sharing by link), §7.6 (print, for the QR code).

## Global Constraints

- **Meanings, in this order:** `start` (green `#2e7d32`, flag), `move` (blue `#1565c0`, arrow), `shoot` (red-orange `#d84315`, crosshair), `activate` (amber `#f9a825`, lightning bolt), `avoid` (gray `#616161`, slashed circle). Labels: Start, Move, Shoot, Activate, Avoid. One meaning per object per step.
- **Share token:** 16 random bytes, base64url, 22 characters, matching `/^[A-Za-z0-9_-]{22}$/`. Generated on the device. Tokens are unique across plans and matches.
- **Links:** stage `${origin}/s/${token}`; a stage in a shared match `${origin}/s/${token}?stage=${planId}`; viewer print `/s/${token}/print` (same `?stage=`).
- **Copy** (used verbatim by tests):
  - Toolbar and match screen button: "Share". Dialog titles: "Share stage", "Share match".
  - Switch: "Anyone with the link can view". Buttons: "Copy link" (then "Copied"), "Reset link".
  - Reset confirm: "Reset the link? QR codes already printed will stop working."
  - Offline note: "You're offline. Sharing changes take effect when this device syncs."
  - Viewer, bad link: heading "This link isn't shared", text "Ask the person who shared it for a new link."
  - Walkthrough: "Walkthrough" (viewer button), "Present" (editor toolbar), "Step 2 of 5", "Previous", "Next", "Back to stage".
  - Walkthrough tab: tab "Walkthrough"; no steps: "Write the stage procedure in the Brief tab. Each line is a step."; no step picked: "Pick a step, select objects on the bay, then choose what the shooter does with them."; marking buttons are the five labels plus "Clear".
  - Print caption beside the QR code: "Scan for the walkthrough".
- The shared API never returns owner ids, emails, versions, `sourceCanvasId` or deleted records. Responses carry `cache-control: no-store` and `x-robots-tag: noindex`; the viewer page has `<meta name="robots" content="noindex">`.
- Svelte via the svelte-file-editor agent and its autofixer. Atomic Angular commits. `pnpm check`, `pnpm lint`, `pnpm test` pass after every task; e2e and db tests run against the local Supabase stack only.

## Decisions

1. **Steps keep their ids through text edits.** `stepsFromText(prev, text)` splits on `\n`, keeps every line (blank ones too, so the textarea round-trips), and matches new lines to old steps by longest common subsequence of exact text. Within each changed run, old and new lines pair up in order (an edited line keeps its id); leftover new lines get new ids, leftover old lines are dropped. `procedureText(steps)` joins with `\n`.
2. **Walkthrough and print use `displaySteps(steps)`:** non-blank steps, text trimmed and any typed leading number ("1.", "2)") removed, the rule print uses today (`src/lib/print/layout.ts:122`, which moves here).
3. **Upgrading v1:** `procedure` splits into steps by line (an empty procedure gives `[]`), each with a new uuid, no marks, no arrows. Upgrades happen on read and don't mark records dirty. Ids differ between devices that upgraded the same v1 plan separately; that is harmless because no marks exist before v2.
4. **Server:** pushes may carry schema version 1 or 2 (a stale tab); the server stores version 2. Rows still at version 1 are upgraded when read (pull, conflict, share link). There is no SQL data migration.
5. **Share writes in the editor go through the plan saver**, serialized with document saves on one promise chain, so a share toggle never races a save into a conflicted copy. Outside the editor (match screen), store functions write directly.
6. **A copy never takes the share:** duplicates, conflicted copies (plans and matches) and drafts start with `share: null`.
7. **Pushes without `share`** (an older app) leave the server's share columns alone. A push whose token belongs to another record is rejected (`invalid`).
8. **Marks are pruned** when their object or arrow goes: `deleteItems`, `applyDraft`. Duplicated objects get no marks.
9. **Shared match:** the link shows the match's non-deleted stages in stage order, with stage numbers from `effectiveStageNumber`. Each stage opens at `?stage=<planId>`; a stage id that isn't in the match shows the bad-link screen.
10. **QR on print:** only on a plan's first (stage) page, in the header's right end: a square the header's height (60 px), ECC `M`, 2-module quiet zone, drawn as one SVG path (attributes only, for svg2pdf), with the two-line caption right-aligned to its left. The title area narrows to fit. Stage link if the plan is shared; else, on a match print, the match link at that stage; else no code.

## Review Focus

1. **A copy never carries the original's link.** Duplicating a shared plan, a conflicted copy, or uploading local data made before accounts must not produce a second record with the same token, or the push fails for good. → Task 3 (unit), Task 2 (db).
2. **Old data opens intact as v2:** an IndexedDB plan from before the upgrade, a journal entry written by the old app, a v1 push from a stale tab, and a v1 row read by pull or by the share link. → Tasks 2, 3.
3. **Editing the procedure keeps marks on their step:** typing in a line, inserting a line above, deleting a line, and pasting the whole text again. Deleting an object or applying a draft removes its marks; undo brings them back. → Tasks 1, 6.
4. **A link that is off, reset, deleted, malformed or unknown** gets the same 404 (no hint whether it existed). A deleted stage in a shared match isn't listed or reachable. → Task 4 (db + e2e).
5. **Toggling sharing while a document save is in flight** loses neither change and makes no conflicted copy. → Task 5 (unit).

---

## File Structure

```
src/lib/model/plan.ts                    StepSchema, MarkSchema, MEANINGS, StageBrief.steps, PLAN_SCHEMA_VERSION = 2
src/lib/model/procedure.ts               stepsFromText, procedureText, displaySteps (pure)
src/lib/model/upgrade.ts                 PlanDocumentV1Schema, readPlanDocument (pure)
src/lib/model/share.ts                   ShareSchema, Share, newShareId, shareUrl (pure)
src/lib/store/records.ts, plans.ts, matches.ts, db.ts (v4 upgrade), journal.ts, share.ts
src/lib/sync/wire.ts, engine.ts          v2 + share on the wire; copies drop share
src/lib/server/db/schema.ts + migration  share_id (unique), share_on on plans and matches
src/lib/server/sync.ts                   v1 pushes upgraded, share kept when absent, token checks
src/lib/server/shared.ts                 getSharedView (public read)
src/routes/api/shared/[token]/+server.ts
src/lib/editor/walkthrough.ts            markObjects, setStepArrows, pruneMarks (pure)
src/lib/walkthrough/meanings.ts          MEANING_STYLES (label, color, badge path)
src/lib/walkthrough/StepHighlights.svelte    rings + badges (svg, attributes only)
src/lib/walkthrough/WalkthroughPlayer.svelte  step paging over a PrintDiagram
src/lib/editor/components/WalkthroughPanel.svelte, SidePanel.svelte, Toolbar.svelte, EditorCanvas.svelte, BriefPanel.svelte
src/lib/components/ShareDialog.svelte
src/lib/print/qr.ts, layout.ts, input.ts, PrintPage.svelte, PrintDiagram.svelte, PlanPrintView.svelte (extracted)
src/routes/s/[token]/+page.ts, +page.svelte, print/+page.ts, print/+page.svelte
tests/e2e/walkthrough.spec.ts, share.spec.ts, viewer.spec.ts
```

---

### Task 1: Procedure steps (pure)

**Files:** Create `src/lib/model/procedure.ts`, `procedure.test.ts`. Modify `src/lib/model/plan.ts` (add `MEANINGS`, `Meaning`, `MarkSchema`, `StepSchema`, `Step`; nothing uses them yet).

**Interfaces — Produces:**

- `MEANINGS = ['start', 'move', 'shoot', 'activate', 'avoid'] as const`, `type Meaning`.
- `MarkSchema = z.object({ objectId: z.uuid(), meaning: z.enum(MEANINGS) })`.
- `StepSchema = z.object({ id: z.uuid(), text: z.string().max(2000), marks: z.array(MarkSchema).max(200), arrows: z.array(z.uuid()).max(200) })`, `type Step`.
- `stepsFromText(prev: Step[], text: string): Step[]`, `procedureText(steps: Step[]): string`, `displaySteps(steps: Step[]): Step[]` (Decisions 1–2).

- [ ] **Steps:**
  1. Write the failing tests: `procedureText(stepsFromText([], t)) === t` for `''`, `'a'`, `'a\n\nb'`, `'a\n'`; `stepsFromText([], '')` is `[]`; with steps A, B, C (C marked): editing B's text keeps B's id; inserting a line above C keeps C's id and marks; deleting B keeps A and C; splitting B by a newline keeps B's id on the first part; pasting the identical text keeps every id; `displaySteps` drops blank lines and strips "1. " and "2) ".
  2. Run `pnpm vitest run src/lib/model/procedure.test.ts` (FAIL), implement, run again (PASS).
  3. Commit: `feat(plans): keep procedure lines as steps with stable ids`

### Task 2: Schema version 2

**Files:** `src/lib/model/plan.ts` (`StageBrief.steps` replaces `procedure`; `PLAN_SCHEMA_VERSION = 2`), create `src/lib/model/upgrade.ts` + test; modify `records.ts` (`schemaVersion: 2`), `plans.ts`, `db.ts`, `journal.ts`, `sync/wire.ts`, `sync/engine.ts`, `server/sync.ts`, `print/layout.ts` (uses `displaySteps`), `editor-state.svelte.ts` (`setProcedure`), `BriefPanel.svelte`, `DraftDialog.svelte`, `draft/client.ts` (the request still sends procedure text). Their tests.

**Interfaces:**

- **Produces:**
  - `PlanDocumentV1Schema` (today's schema, `brief.procedure: string`).
  - `readPlanDocument(document: unknown): PlanDocument`: parses as v2, else as v1 and upgrades (Decision 3); throws a `ZodError` if neither.
  - `EditorState.setProcedure(text: string): void`: `stepsFromText` on the current steps, as a typing edit keyed `'procedure'` (one undo step per field visit).
  - `SUPPORTED_SCHEMA_VERSION = 2`. Wire plans accept `schemaVersion: z.literal([1, 2])` with `document: z.union([PlanDocumentSchema, PlanDocumentV1Schema])`. The server stores `schemaVersion: 2, document: readPlanDocument(document)` and `planRecord(row)` upgrades version-1 rows. `fromServer` throws `newer-schema` only above 2, and reads versions 1–2 with `readPlanDocument`.
  - Dexie `version(4)`, same stores, with an upgrade that rewrites every plan to `schemaVersion: 2` via `readPlanDocument` (dirty flag unchanged).
  - The journal accepts either document version (`readPlanDocument`).
- [ ] **Steps:**
  1. Write the failing tests:
     - `readPlanDocument` on a v1 document with a three-line procedure gives three steps with the same text and no marks; an empty procedure gives `[]`; a v2 document passes through unchanged; garbage throws.
     - Store: a Dexie database created at version 3 with a v1 plan opens at version 4 with a v2 document, and `dirty` is unchanged.
     - Journal: an entry holding a v1 document recovers as v2 (Review Focus #2).
     - Wire/engine: `fromServer` on a v1 server plan gives v2; on version 3 it throws `newer-schema`.
     - Server db test (`sync.db.test.ts`): a v1 push is stored as version 2 with steps; a v1 row inserted by SQL comes back from `pullChanges` as v2 (Review Focus #2).
     - Print layout: a procedure of steps `['1. Start', '', 'Engage T1']` prints two numbered lines.
  2. Run (FAIL), implement, update the existing tests and fixtures that build documents (`emptyPlanDocument` covers most), run `pnpm check && pnpm test` and the db tests (PASS).
  3. Run the e2e specs that type a procedure (`brief`, `print`, `draft`, `pdf`, `matches`) unchanged: the textarea still reads "Stage procedure" (PASS).
  4. Commit: `feat(plans)!: store the procedure as steps in schema version 2` with a `BREAKING CHANGE:` footer saying apps older than this ask to reload when they meet a v2 plan.

### Task 3: Share fields on records, the wire and the server

**Files:** create `src/lib/model/share.ts` + test; modify `records.ts` (`share: Share | null` on `PlanRecord` and `MatchRecord`), `plans.ts`, `matches.ts`, `db.ts` (the v4 upgrade also sets `share: null` on plans and matches), `sync/wire.ts`, `sync/engine.ts` (conflicted copies get `share: null`), `server/db/schema.ts` + generated migration, `server/sync.ts`. Their tests.

**Interfaces — Produces:**

- `ShareSchema = z.object({ id: z.string().regex(/^[A-Za-z0-9_-]{22}$/), on: z.boolean() })`, `type Share`.
- `newShareId(): string` (`crypto.getRandomValues`, base64url).
- `shareUrl(origin: string, token: string, stageId?: string): string`.
- Columns `share_id text unique` (nullable) and `share_on boolean not null default false` on `plans` and `matches`.
- Wire `share: ShareSchema.nullable().optional()` on matches and plans; server records always carry `share` (null when `share_id` is null).
- [ ] **Steps:**
  1. Write the failing tests:
     - `newShareId` matches the token regex and two calls differ; `shareUrl` for both forms.
     - `duplicatePlan` of a shared plan gives `share: null` (Review Focus #1); `createPlan` and `createMatch` start at `null`.
     - Engine: a conflicted copy of a shared plan or match has `share: null` (Review Focus #1).
     - Server db: a pushed share round-trips through pull; a push without `share` keeps the stored share (Decision 7); a push reusing another record's token, in either table, is `rejected` with reason `invalid`, and the rest of the batch still applies.
  2. Run (FAIL). Implement, generate the migration (`pnpm db:generate`), `db:reset`, run the advisors (clean), and run all tests (PASS).
  3. Commit: `feat(sync): sync a share link on plans and matches`

### Task 4: The public shared view

**Files:** create `src/lib/server/shared.ts`, `shared.db.test.ts`, `src/routes/api/shared/[token]/+server.ts`, `tests/e2e/share-api.spec.ts`.

**Interfaces — Produces:**

- `type SharedPlan = { id: string; widthFt: number; depthFt: number; unit: LengthUnit; stageNumber: string; document: PlanDocument }`.
- `type SharedView = { kind: 'plan'; plan: SharedPlan; matchName: string } | { kind: 'match'; match: { name: string; date: string }; plans: SharedPlan[] }`, plus `SharedViewSchema` (Zod, for the client).
- `getSharedView(db: Database, token: string): Promise<SharedView | null>`: the token must match the regex, `share_on` must be true and `deleted_at` null. A plan's `matchName` comes from its match if it has a live one, else from the brief. A match lists its owner's live plans with that `match_id`, ordered by `stage_order`. Documents go through `readPlanDocument`.
- `GET /api/shared/[token]`: no auth; 200 `SharedView` or 404 `{ error: 'not-found' }`, with the Global Constraints headers.
- [ ] **Steps:**
  1. Write the failing db tests: a shared plan, a shared match with three stages (one deleted, one belonging to another owner but carrying the same `match_id`) gives two stages in order; off, reset (old token), deleted and unknown tokens give `null`; the result has no owner id, version or `sourceCanvasId` keys (Review Focus #4).
  2. Write the failing e2e API test: an unauthenticated request gets 404 for a malformed token and for an unknown one, with identical bodies, and `x-robots-tag: noindex`.
  3. Implement, then run (PASS).
  4. Commit: `feat(share): serve shared stages and matches without sign-in`

### Task 5: Turning sharing on and off

**Files:** create `src/lib/store/share.ts` + test, `src/lib/components/ShareDialog.svelte`; modify `src/lib/editor/plan-saver.ts` + test, `editor-state.svelte.ts`, `EditorView.svelte`, `Toolbar.svelte`, `src/routes/(app)/matches/[id]/+page.svelte`; create `tests/e2e/share.spec.ts`.

**Interfaces:**

- **Consumes:** `newShareId`, `shareUrl`, `syncState.online`, `ConfirmDialog`.
- **Produces:**
  - `nextShare(current: Share | null, action: 'on' | 'off' | 'reset'): Share` (pure): `on` keeps the id or makes one; `off` keeps the id; `reset` makes a new id and keeps `on`.
  - `savePlanShare(db, id, share, at, expectedUpdatedAt?): Promise<PlanRecord>`, with the same staleness rule as `savePlanDocument`. `saveMatchShare(db, id, share): Promise<MatchRecord>`. Both set `dirty: 1` and `updatedAt`.
  - `PlanSaver.setShare(share: Share): Promise<void>`. Saves and share writes run on one chain in call order (Decision 5).
  - `EditorState.share` (`$state`, from the plan) and `EditorState.changeShare(action)`; `EditorDeps.setShare(share)`.
  - `ShareDialog` props: `{ title: string; share: Share | null; link: string | null; onaction: (a: 'on' | 'off' | 'reset') => void; onclose }`, with the copy from Global Constraints.
- [ ] **Steps:**
  1. Write the failing unit tests:
     - `nextShare` cases.
     - Saver: `save(doc)` immediately followed by `setShare(s)` without awaiting leaves the stored plan with both, and no conflicted copy (Review Focus #5).
  2. Write the failing e2e tests (`share.spec.ts`):
     - Turning sharing on in the editor shows a link matching `/s/<token>`.
     - Off then on shows the same link; Reset asks with the confirm copy and then shows a different link.
     - Offline, the note shows.
     - On the match screen, Share works the same way.
  3. Implement, then run (PASS).
  4. Commit: `feat(share): share a stage or match by link`

### Task 6: Marking objects in steps (pure)

**Files:** create `src/lib/editor/walkthrough.ts` + test; modify `ops.ts` (`deleteItems` prunes), `draft/apply.ts` (prunes), `editor-state.svelte.ts`.

**Interfaces — Produces:**

- `markObjects(doc, stepId, objectIds: string[], meaning: Meaning | null): PlanDocument`: sets or replaces each object's mark in that step; `null` removes it.
- `setStepArrows(doc, stepId, arrowIds: string[], include: boolean): PlanDocument`.
- `pruneMarks(doc): PlanDocument`: drops marks and arrows whose ids no longer exist.
- `EditorState.activeStepId` (`$state<string | null>`), `markSelected(meaning: Meaning | null)` (selected objects), `setSelectedArrowsInStep(include: boolean)` (selected arrows). Each is one commit (one undo step).
- [ ] **Steps:**
  1. Write the failing tests: marking replaces an earlier meaning (one per object per step); marking one step leaves the others alone; `null` clears; `deleteItems` of a marked object and of an included arrow removes them from every step, and undo in `EditorState` brings them back; `applyDraft` drops marks of replaced objects (Review Focus #3).
  2. Run (FAIL), implement, run (PASS).
  3. Commit: `feat(walkthrough): mark objects and arrows in procedure steps`

### Task 7: Highlights, the Walkthrough tab and Present

**Files:** create `src/lib/walkthrough/meanings.ts` + test, `StepHighlights.svelte`, `WalkthroughPlayer.svelte`, `src/lib/editor/components/WalkthroughPanel.svelte`; modify `PrintDiagram.svelte` (optional `step?: Step | null`: draws `StepHighlights` over the objects and drops unmarked objects and arrows outside the step to `opacity="0.25"`), `EditorCanvas.svelte` (highlights for the active step while the Walkthrough tab shows), `SidePanel.svelte` (third tab), `Toolbar.svelte` ("Present"); create `tests/e2e/walkthrough.spec.ts`.

**Interfaces:**

- **Produces:**
  - `MEANING_STYLES: Record<Meaning, { label: string; color: string; badge: string /* SVG path in a 0–24 box */ }>`.
  - `StepHighlights` props: `{ doc, step: Step, viewport: Viewport, symbolPx: number }`.
    - Each mark draws a ring in its color, 3 px wide, around the object: a circle of radius `symbolPx * 0.7` for symbols, or the object's rotated box outset by 4 px for footprints (from `object-geometry`).
    - Each mark also draws a 16 px badge circle at the ring's upper right with the white glyph.
    - Included arrows are redrawn on top in ink at 3 px.
    - SVG attributes only.
  - `WalkthroughPlayer` props: `{ doc, canvas, unit, depth, title, onclose? }`. It pages through `displaySteps` and shows:
    - the diagram via `PrintDiagram` with `step`, sized to its container;
    - "Step n of N", the step text, and a legend of only the meanings used in the step (badge + label);
    - "Previous" and "Next" buttons (disabled at the ends) and ←/→ keys;
    - "Back to stage", which calls `onclose`.
  - **The Walkthrough tab:**
    - It lists `displaySteps` as numbered buttons; clicking one sets `activeStepId`.
    - With a step picked, it shows the five meaning buttons plus "Clear" (enabled when objects are selected), "Show selected arrows in this step" (a checkbox, when arrows are selected), and the step's marks as "label or symbol name — meaning" rows.
    - Empty states use the Global Constraints copy.
  - "Present" opens the `WalkthroughPlayer` in a full-screen `Dialog` over the editor; it is disabled when there are no steps.
- [ ] **Steps:**
  1. Write the failing unit test: `MEANING_STYLES` has the Global Constraints colors and labels in `MEANINGS` order, and the five badge paths are distinct.
  2. Write the failing e2e tests:
     - Type a three-line procedure, place a popper and a shooting box, mark the box Move in step 1 and the popper Shoot in step 2: the canvas shows the step's highlights (`data-meaning` attributes on the rings).
     - Inserting a line above step 2 in the Brief tab keeps the popper's mark on that step (Review Focus #3).
     - Present shows "Step 1 of 3", the legend lists only Move; Next shows step 2 with Shoot; Next on the last step is disabled; Back to stage closes.
  3. Implement, then run (PASS). Check the highlights in a grayscale screenshot: the badge shapes alone tell the meanings apart.
  4. Commit: `feat(walkthrough): author step highlights and present the walkthrough`

### Task 8: The viewer at `/s/[token]`

**Files:** create `src/routes/s/[token]/+page.ts`, `+page.svelte`, `src/lib/share/client.ts` (`fetchSharedView(token): Promise<SharedView | null>`, validated with `SharedViewSchema`), `tests/e2e/viewer.spec.ts`.

**Interfaces:**

- **Consumes:** `SharedView`, `WalkthroughPlayer`, `PrintDiagram`, `Thumbnail` (given a `PlanRecord`-shaped object), `displaySteps`.
- **Produces:**
  - **A plan link:** a header with the wordmark, the stage title and match name. Below it:
    - the diagram, fit to width;
    - the brief facts (start position, gun ready, round count, targets, par time), the numbered procedure, and the notes;
    - a "Walkthrough" button (when there are steps) that switches the page to the player, and a "Print" link to `print`.
  - **A match link:** the match name and date, and the stages as rows (thumbnail, stage title) linking to `?stage=<id>`. With `?stage=`, the stage page adds "Stage n of N" with links to the previous and next stages and back to the match.
  - **Not found:** the not-found copy. Phone width (390 px) has no horizontal scroll.
- [ ] **Steps:**
  1. Write the failing e2e tests. Sign in, build a plan with steps and marks, share it, and wait until `pushed(page)`; then, in a fresh context with no session:
     - the link shows the stage title, the diagram and the procedure;
     - Walkthrough pages through the steps;
     - after the owner turns sharing off and syncs, the same link shows the not-found copy;
     - a shared match lists its stages in order and opens one;
     - a 390 × 844 viewport has `scrollWidth <= innerWidth`.
  2. Implement, then run (PASS).
  3. Commit: `feat(share): view a shared stage or match without signing in`

### Task 9: QR code on print, and printing from the viewer

**Files:** `pnpm add uqr`; create `src/lib/print/qr.ts` + test, `src/lib/print/PlanPrintView.svelte` (the body of `(app)/plans/[id]/print/+page.svelte`, extracted); modify `print/layout.ts` (+test), `print/input.ts` (+test), `PrintPage.svelte`, both app print routes; create `src/routes/s/[token]/print/+page.ts`, `+page.svelte`; extend `print.spec.ts`, `viewer.spec.ts`.

**Interfaces:**

- **Produces:**
  - `qrModules(text: string): boolean[][]` (ECC M, border 2).
  - `PlanPrintInput.link: string | null`; `PageHeader.qr: { rect: Rect; caption: TextBlock } | null` (Decision 10).
  - `printInput(plan, match, opts, link)`.
  - `stageLink(origin: string, plan: Pick<PlanRecord, 'id' | 'share'>, match: Pick<MatchRecord, 'share'> | null): string | null` in `input.ts`.
  - `PlanPrintView` props: `{ plan: PlanRecord; match: PrintMatch | null; link: string | null; backHref: string; backLabel: string }`. The shared print route builds a `PlanRecord`-shaped value from `SharedPlan`.
- [ ] **Steps:**
  1. Write the failing unit tests:
     - `qrModules` returns a square matrix whose three finder patterns sit at the corners inside the 2-module border.
     - `layoutPlan` with a link gives `header.qr` the header's height at its right end, and a narrower title area.
     - Without a link, `qr` is null; continuation and tile pages never get one.
     - `stageLink`: plan shared → its link; plan not shared but match shared → the match link with `?stage=`; neither → null; shares that are off count as not shared.
  2. Write the failing e2e tests:
     - The print preview of a shared plan has `[data-testid="share-qr"]` and the caption; it is gone once sharing is off.
     - The PDF still downloads with the same page count.
     - The viewer's Print link renders the stage's pages.
  3. Implement, then run (PASS).
  4. Commit: `feat(print): print a QR code to the shared link`

### Task 10: Docs and roadmap

- [ ] **Steps:**
  1. `docs/operations.md`: the new migration in the rollout steps, and a note that apps older than schema version 2 ask to reload.
  2. Roadmap: mark Plan 7 done, add this file, and note that sharing by link moved into the MVP.
  3. Commit: `docs(plans): mark Plan 7 done`
