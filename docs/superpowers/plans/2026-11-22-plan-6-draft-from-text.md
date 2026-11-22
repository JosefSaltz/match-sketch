# Plan 6: Draft from text — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An MD can describe a stage and have Claude draft a layout of catalog symbols onto their bay. The draft lands in the editor as one undoable step. Every request is logged, capped per user per day, and stopped by a site-wide daily spend ceiling.

**Architecture:**

- **A server-only drafting service** (`src/lib/server/draft/`):
  - It builds the prompt (catalog, canvas, coordinate convention, brief, layout conventions, minimum spacing) and calls Claude through `@anthropic-ai/sdk`.
  - The response is constrained by structured output (`output_config.format` with a Zod schema).
  - Each placement is validated. If any fail, the model gets one repair round; whatever still fails is dropped and reported.
  - The Anthropic client is injected, so tests stub it.
- **`POST /api/drafts`:** authenticated. It enforces the per-user daily cap and the site-wide spend ceiling from `ai_drafts`, and logs every attempt with token usage and estimated cost.
- **The client** turns the returned placements into plan objects and applies them with `EditorState.commit`, a single undo step. The dialog is disabled offline, with the reason shown.
- **An eval** (`tools/draft-eval/`) runs the seven reference stages from the MD's deck against the real model and grades them. It isn't part of CI: it costs money and needs the user's go-ahead.

**Tech Stack:** SvelteKit 3.4, Svelte 5, `@anthropic-ai/sdk` 1.x, Zod 4, Drizzle, Supabase local stack, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-21-match-sketch-design.md`:

- §7.5 (the whole flow, prompt contents, structured output, validation and repair, logging, offline, eval);
- §6 (model, refusal fallback, effort from the eval, per-user cap, spend ceiling);
- §7.1 screens 5 (the toolbar button) and 7 (today's spend on the admin page);
- goal 5; anti-goal "a model draft presented as finished".

## Global Constraints

- **Model:** `claude-opus-5-5`, with adaptive thinking (the default) and `output_config.effort` from the eval (start at `medium`).
  - Refusal fallback: server-side `fallbacks: "default"` with beta `server-side-fallback-2026-07-01`.
  - Check `stop_reason === 'refusal'` before reading output.
  - `max_tokens` is 16000, non-streaming.
- **Structured output:** `output_config: { format: zodOutputFormat(DraftOutputSchema) }`. No assistant prefill, and no forced `tool_choice` (both 400 on this model).
- **The API key never reaches the browser:**
  - `ANTHROPIC_API_KEY` is a private runtime variable.
  - If it's unset, the route answers 503 "Drafting isn't set up on this server".
  - Tests never call the real API.
- **Limits:**
  - **Per-user daily cap:** `DRAFT_DAILY_CAP` (default 20) drafts per UTC day.
  - **Site-wide ceiling:** `DRAFT_DAILY_SPEND_USD` (default 10) of estimated spend per UTC day, after which drafting is paused for everyone.
  - **One draft at a time per user:** a second request while one is running gets 429.
- **Estimated cost** comes from response usage times a price table: Opus 5.5 at $4 / $20 per M input / output tokens, with cache reads at $0.20/M. A model missing from the table is priced at the highest rate in it.
- **Copy** (used verbatim by tests):
  - Button: "Draft from text".
  - Offline reason: "Drafting needs a connection."
  - Procedure missing: "Write the stage procedure first; the draft follows it."
  - Cap reached: "You've used today's <n> drafts. Drafting resets at midnight UTC."
  - Ceiling reached: "Drafting is paused for today."
  - Not set up: "Drafting isn't set up on this server."
  - Confirm replacing: "Replace the <n> objects on this bay with the draft?"
- **Draft results list** what the model couldn't represent ("Not drawn: …") and what failed validation ("Dropped: …").
- Svelte via the svelte-file-editor agent and its autofixer. Atomic Angular commits. Svelte e2e specs that mock routes use `serviceWorkers: 'block'`.

## Decisions

1. **The draft replaces the bay's objects.** Annotations anchored to a replaced object are removed. Text labels and point-anchored annotations stay. The brief, scale break and display settings stay too.
2. **The minimum spacing** between fixed-size symbols is the symbol's print size at fit-to-page scale. It is computed from `layoutPlan`'s portrait diagram area and the plan's symbol size, then rounded up to 0.5 ft.
3. **What the model receives** (in this order, for prompt caching):
   1. a stable system prompt: role, coordinate convention, layout conventions, output rules;
   2. the catalog as compact JSON lines (`id`, `name`, `aliases`, `category`, `kind`, `family`, default size);
   3. last, the per-request content: canvas, spacing, brief and description.
4. **Validation rules:**
   - the symbol id must exist;
   - the position must lie within `[0, widthFt] × [0, depthFt]`;
   - rotation is normalised into `[0, 360)`;
   - `count` is accepted only on target symbols and clamped to 1–99;
   - footprint `widthFt`/`depthFt` default to the catalog size and must be 0.5–200 ft;
   - labels are at most 24 characters and unique; a duplicate is the problem, not the item;
   - at most 200 placements.
5. **Logging:** one `ai_drafts` row per request.
   - Status is one of `ok`, `repaired`, `partial` (some dropped), `failed`, `refused`, `capped`, `paused`.
   - The row also holds the request (brief and canvas) and the response (placements) as JSONB, for debugging and the eval. A capped request is logged with zero tokens.
6. **The admin page** shows "Model spend today: $x.xx of $y.yy".

## Review Focus

1. **A model reply naming symbols that don't exist, positions off the bay, or duplicate labels** is repaired once, then trimmed; the MD sees what was dropped. → Task 2 (unit), Task 3 (unit, stubbed model).
2. **The cap and the ceiling under concurrent requests:** two simultaneous drafts by one user don't both slip past the cap (the per-user lock). → Task 4 (db test).
3. **A refusal, a network failure or a timeout from the API** leaves no change to the plan, gives a clear message, and is logged. → Task 3 (unit), Task 5 (e2e).
4. **Applying a draft over existing objects** asks first, and undo restores the previous objects and their measure lines. → Task 5 (e2e).
5. **Offline**, the button is disabled with the reason, and nothing is sent. → Task 5 (e2e).

---

## File Structure

```
src/lib/server/db/schema.ts             + aiDrafts, draftStatus
supabase/migrations/*                   generated + grants
src/lib/draft/contract.ts               DraftOutputSchema, DraftRequestSchema, DraftResult (shared)
src/lib/draft/validate.ts               validatePlacements (pure; shared by server, client tests)
src/lib/draft/spacing.ts                minSpacingFt (pure)
src/lib/draft/apply.ts                  applyDraft(doc, placements) → PlanDocument (pure)
src/lib/server/draft/prompt.ts          buildDraftPrompt (system, catalog, request)
src/lib/server/draft/service.ts         draftLayout({ client, request, … }) → outcome + usage
src/lib/server/draft/cost.ts            estimateCostUsd(model, usage)
src/lib/server/draft/limits.ts          checkLimits, logDraft, todaySpend
src/routes/api/drafts/+server.ts
src/lib/editor/components/DraftDialog.svelte (+ Toolbar button)
src/routes/admin/+page.server.ts, +page.svelte   (spend line)
tools/draft-eval/cases.ts, grade.ts, run.ts      (not in CI)
tests/e2e/draft.spec.ts
```

---

### Task 1: `ai_drafts` and the limit queries

**Files:** `src/lib/server/db/schema.ts`, migrations, `src/lib/server/draft/limits.ts`, `limits.db.test.ts`.

**Interfaces:**

- **Produces:**
  - `aiDrafts` with these columns:
    - `id` (uuid, default `gen_random_uuid()`), `ownerId` (cascade), `planId` (uuid, no FK);
    - `model`, `status`, `inputTokens`, `outputTokens`, `cacheReadTokens`, `costUsd` (`numeric(10,6)`), `error`;
    - `request` and `response` (JSONB), `createdAt`.

    RLS is on with no policies, `revoke all` from `anon` and `authenticated`, and an index on `(owner_id, created_at)`.
  - `draftsToday(db, ownerId): Promise<number>`, which counts rows with a status other than `capped` or `paused` since 00:00 UTC.
  - `spendToday(db): Promise<number>`, the sum of `cost_usd` since 00:00 UTC.
  - `logDraft(db, row): Promise<void>`.
  - `withDraftLock(db, ownerId, fn)`: `pg_try_advisory_lock` on the owner, so a second concurrent call gets `null` without running `fn`.
- [ ] **Steps:**
  1. Write the failing db tests: counts, spend sum, the UTC day boundary, and the lock refusing a concurrent second call.
  2. Run them (FAIL), implement plus the migration and `db:reset`, then run them (PASS) and the advisors (clean).
  3. Commit: `feat(draft): log drafts and count them against the daily limits`

### Task 2: The draft contract, spacing and validation

**Files:** `src/lib/draft/contract.ts`, `validate.ts`, `spacing.ts`, `apply.ts`, and their tests.

**Interfaces:**

- **Produces:**
  - `DraftOutputSchema = z.object({ placements: z.array(z.object({ symbolId: z.string(), x: z.number(), y: z.number(), rotation: z.number(), label: z.string().nullable(), count: z.int().nullable(), widthFt: z.number().nullable(), depthFt: z.number().nullable() })), unrepresentable: z.array(z.string()) })`. It is kept simple for structured output; the rules are in `validatePlacements`.
  - `DraftRequestSchema = { planId: uuid, description: string(1..4000), brief: StageBriefSchema, canvas: { widthFt, depthFt, unit }, symbolSize }`.
  - `DraftResult = { objects: Placement[]; unrepresentable: string[]; dropped: { what: string; reason: string }[]; status }`.
  - `validatePlacements(placements, canvas): { valid: Placement[]; problems: { index: number; reason: string }[] }`, following Decision 4.
  - `minSpacingFt(canvas, symbolSize): number`, following Decision 2.
  - `applyDraft(doc: PlanDocument, placements: Placement[]): PlanDocument`, following Decision 1. It assigns new uuids and z order.
- [ ] **Steps:**
  1. Write the failing unit tests:
     - an unknown id, off-bay, a duplicate label, and a count on a prop are each reported with a reason;
     - rotation `-90` becomes `270`;
     - a footprint with a null size gets the catalog size;
     - a 40 × 300 yd bay at medium size gives the expected spacing;
     - `applyDraft` replaces objects, drops a measure line anchored to an old object, and keeps a text label.
  2. Implement, then run (PASS).
  3. Commit: `feat(draft): define and check the draft format`

### Task 3: The drafting service (stubbed model)

**Files:** `src/lib/server/draft/prompt.ts`, `service.ts`, `cost.ts`, and their tests. Dependency: `pnpm add @anthropic-ai/sdk`, in its own commit.

**Interfaces:**

- **Consumes:** Task 2.
- **Produces:**
  - `buildDraftPrompt(request): { system: TextBlockParam[]; messages: MessageParam[] }`. The system prompt plus catalog block carries `cache_control: { type: 'ephemeral' }`.
  - `estimateCostUsd(model: string, usage): number`.
  - `draftLayout({ client: Pick<Anthropic, 'beta'>, request, effort }): Promise<{ result: DraftResult; usage; model; status }>`.
    - It calls `client.beta.messages.parse({ model: 'claude-opus-5-5', max_tokens: 16000, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default', output_config: { effort, format: zodOutputFormat(DraftOutputSchema) }, system, messages })`.
    - On problems, one repair turn: append the assistant output and a user message listing each problem, then parse again.
    - It sums the usage of both calls.
    - Status: refusal → `refused`; no parsed output → `failed`; problems after repair → `partial`; repaired → `repaired`.
- [ ] **Steps:**
  1. Write the failing unit tests with a stub client:
     - **Valid reply:** gives `ok`.
     - **Repair works:** a reply with one bad item, then a corrected reply, gives `repaired` and sends the problems in the second call.
     - **Still bad:** after repair the item is dropped and listed (`partial`).
     - **Refusal:** `stop_reason: 'refusal'` gives `refused` with no objects.
     - **Thrown error:** an `APIConnectionError` gives `failed`.
     - **Prompt contents:** the catalog lists every symbol id once, and the prompt contains the spacing and the procedure.
     - **Cost:** the price table works, and an unknown model is priced at the highest rate.
  2. Implement, then run (PASS).
  3. Commit: `feat(draft): draft a layout with Claude, repairing bad placements once`

### Task 4: `POST /api/drafts`

**Files:** `src/routes/api/drafts/+server.ts`, `src/env.ts` (the optional `ANTHROPIC_API_KEY`, `DRAFT_DAILY_CAP`, `DRAFT_DAILY_SPEND_USD`), `src/lib/server/draft/handle.ts`, `handle.db.test.ts`, `tests/e2e/draft-api.spec.ts`.

**Interfaces:**

- **Produces:** `handleDraft({ db, ownerId, body, client | null, cap, ceilingUsd }): Promise<{ status: number; body }>`. The route only adds auth and env. In order:
  1. A body failing Zod → 400.
  2. No client → 503.
  3. Lock busy → 429.
  4. Cap reached → 429 `{ code: 'capped', cap }`, logged.
  5. Ceiling reached → 503 `{ code: 'paused' }`, logged.
  6. Otherwise `draftLayout`, then log, then 200 with `DraftResult`.
- [ ] **Steps:**
  1. Write the failing tests:
     - db tests with a stub client: logs every outcome; the cap is counted per user; the ceiling is site-wide; two concurrent requests by one user give one 200 and one 429 (Review Focus #2).
     - e2e: signed out → 401; signed in without `ANTHROPIC_API_KEY` (as in tests) → 503 with the not-set-up copy.
  2. Implement, then run (PASS).
  3. Commit: `feat(draft): serve drafts with a daily cap and a spend ceiling`

### Task 5: Draft from text in the editor

**Files:** `src/lib/editor/components/DraftDialog.svelte`, `Toolbar.svelte`, `src/lib/draft/client.ts` (the fetch wrapper with a 120 s timeout), `tests/e2e/draft.spec.ts`.

**Interfaces:**

- **Consumes:** `applyDraft`, `syncState.online`, `EditorState.commit`.
- **Produces:**
  - **The toolbar button** "Draft from text". Offline it is disabled, with `title` and visible text "Drafting needs a connection."
  - **The dialog:**
    - "Description", prefilled from the procedure;
    - a summary of the brief fields that will be sent;
    - a "Draft layout" button, then a progress state;
    - on success, the result: object count, "Not drawn: …", "Dropped: …", and "Apply draft", which confirms first when objects exist;
    - errors are shown with the Global Constraints copy.
  - Applying is `editor.commit(applyDraft(editor.doc, result.objects))`.
- [ ] **Steps:**
  1. Write the failing e2e tests, mocking `/api/drafts` with `page.route` to fixed responses, with `serviceWorkers: 'block'`:
     - **Basic draft:** 3 objects on an empty bay, so Apply needs no confirmation, then Undo restores the empty bay.
     - **Replacing (Review Focus #4):** a bay with 2 objects and a measure line shows the confirm copy; applying replaces them; Undo brings back both objects and the measure line.
     - **Offline (Review Focus #5):** offline (`context.setOffline`), the button is disabled with the reason and no request is made.
     - **Cap:** a 429 `capped` response shows the cap copy, and a 503 `paused` shows the paused copy.
     - **Refused or failed:** a `refused`/`failed` result shows a message and leaves the plan unchanged (Review Focus #3).
     - **No procedure:** an empty procedure shows the procedure-missing copy and disables "Draft layout".
  2. Implement, then run the whole suite (PASS).
  3. Commit: `feat(draft): draft a stage from its description in the editor`

### Task 6: Today's spend on the admin page

**Files:** `src/routes/admin/+page.server.ts`, `+page.svelte`, `tests/e2e/admin.spec.ts`.

- [ ] **Steps:**
  1. Write the failing e2e test: the admin page shows "Model spend today: $0.00 of $10.00".
  2. Implement (`spendToday`), then run (PASS).
  3. Commit: `feat(admin): show today's model spend against the ceiling`

### Task 7: Eval harness (user checkpoint for the real run)

**Files:** `tools/draft-eval/cases.ts`, `grade.ts`, `grade.test.ts`, `run.ts`, `README.md`.

**Interfaces:**

- **`cases.ts`:** the seven reference stages from the deck (spec §1; slides 1, 3, 5, 7, 8, 10, 12), each holding:
  - the brief fields as written;
  - a guessed bay (pistol 30 × 20 yd, rifle 50 × 100 yd);
  - the expected target tally (from the TARGETS line) and the SA labels the procedure names.
- **`grade.ts`:** `gradeDraft(case, result): { score: number; checks: Record<string, boolean | number> }` covers six checks:
  1. the right symbol families are present;
  2. target counts match the tally (within ±1 per type);
  3. the procedure's labels are present;
  4. targets lie downrange of the SAs that engage them (SA y < target y);
  5. nothing is off the bay;
  6. no two fixed-size symbols are closer than the minimum spacing.
- **`run.ts`** runs every case through `draftLayout` with the real client at the given effort. It prints a table of scores, token usage and cost, and writes `tools/draft-eval/out/<timestamp>.json` (git-ignored).
- [ ] **Steps:**
  1. Write the failing unit tests for `gradeDraft` on hand-made results: a perfect one, a missing target, an off-bay item, and overlapping symbols.
  2. Implement, then run (PASS).
  3. Commit: `test(draft): add the draft eval for the reference stages`
  4. **User checkpoint:**
     - Ask the user for an Anthropic API key, through a secret card, with the estimated cost of a run (7 cases × about 2 calls at `medium` and `high`).
     - Run only with their approval, and record the scores in the README.
     - Set the effort in `service.ts` from the result. If there's no key or no approval, leave `medium` and document how to run the eval.

### Task 8: Docs and roadmap

- [ ] **Steps:**
  1. Update `docs/operations.md` with `ANTHROPIC_API_KEY` (a Coolify runtime secret), the two limit variables, and the eval command.
  2. Mark Plan 6 done in the roadmap.
  3. Commit: `docs(plans): mark Plan 6 done`
