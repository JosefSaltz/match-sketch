# Match Sketch — Plan Roadmap

Spec: `docs/superpowers/specs/2026-11-21-match-sketch-design.md` (approved 2026-11-21).

The MVP is built as a sequence of plans. Each produces working, tested software on its own. Write each plan with the `superpowers:writing-plans` skill when its turn comes, against the spec **and the code as it exists then**; don't pre-write later plans, since earlier plans will settle names and interfaces they depend on.

Every plan follows the spec's testing rule: Vitest unit tests for logic, Playwright e2e for user behavior, test-first.

## Status

| #   | Plan                                        | Status                    | File                                |
| --- | ------------------------------------------- | ------------------------- | ----------------------------------- |
| 1   | Local editor                                | Done (2026-11-22)         | `2026-11-21-plan-1-local-editor.md` |
| 1b  | Visual theme (Tailwind, themes, camo tiles) | Done (2026-11-22)         | `2026-11-22-plan-1b-visual-theme.md` |
| —   | Scale break spike (throwaway)               | Done: kept, variant C     | branch `spike/scale-break`          |
| 2b  | Scale break in the editor (variant C)       | Done (2026-11-22)         | `2026-11-22-plan-2b-scale-break.md` |
| 2   | Brief, tally, measure, annotations, matches | Done (2026-11-22)         | `2026-11-22-plan-2-brief-annotations-matches.md` |
| 3   | Symbol library art                          | Done (2026-11-22)         | `2026-11-22-plan-3-symbol-library.md` |
| 4   | Print & PDF                                 | Done (2026-11-22)         | `2026-11-22-plan-4-print-pdf.md` |
| 5a  | Accounts                                    | Done (2026-11-22)         | `2026-11-22-plan-5a-accounts.md`    |
| 5b  | Sync & offline                              | Done (2026-11-22)         | `2026-11-22-plan-5b-sync-offline.md` |
| 6   | Draft from text                             | Not written               | —                                   |
| 7   | Walkthrough presentation                    | Idea recorded             | spec §7.10                          |

Update this table as plans are written and finished.

---

## Plan 1b — Visual theme (after Plan 1, before the spike)

- **Spec:** `docs/superpowers/specs/2026-11-21-theme-design.md`.
- **Builds:** Tailwind 4 migration of every screen; the theme registry, picker and per-user setting; the varsity wordmark, buttons and panel headers; the pattern tool (`tools/patterns/`) and the cleared camo, solid and plaid tiles; the credits dialog.
- **User checkpoints:** each camo tile is approved in a side-by-side preview before it ships. The user cleared every reference to ship (spec §8); UCP was dropped and Flecktarn waits for a reference.

## Scale break spike (after Plan 1)

- **What:** a quick, throwaway prototype of the map-style "not to scale" band (spec §7.4) on top of the Plan 1 editor, to show the user.
- **Why now:** the user wants to try it before committing. Its outcome decides whether Plan 2 (editor) and Plan 4 (print) include it.
- **Shape:** one horizontal band at a chosen depth range; objects beyond it render shifted closer with their true distance labeled; data stays in true feet (`document.scaleBreaks` already exists in the Plan 1 schema).
- **Done when:** the user has seen it and said keep or drop. Record the decision in the spec (§7.4, §9) and here. Spike code is not merged as-is; if kept, it is rebuilt properly in Plan 2 or 4.
- **Outcome (2026-11-22):** kept, variant C (far zone squeezed into a strip, true distances labeled). Plan 2 had shipped by then, so the editor part is Plan 2b (after Plan 3, before Plan 4); Plan 4 prints it.

## Plan 2 — Stage brief, Targets tally, measure lines, annotations, matches

- **Spec:** §7.2 (brief), §6 (computed Targets tally, measure annotation), §7.3 (annotations, measure lines), §7.1 screen 3 (Match), goal 7 (matches; print part is Plan 4).
- **Builds:**
  - Stage brief panel with all fields, including titled notes sections. Match name comes from the match when the plan belongs to one.
  - Targets tally computed from target objects, summing `count`, grouped by type (e.g. "4 static steel, 1 flasher"), with a free-text override (`targetsOverride`).
  - Annotations: text labels, movement arrows, and measure lines. Measure lines attach to two objects or points, show the true distance in the plan's unit, and follow objects as they move. This defines the `annotations` schema that Plan 1 left as an empty array, bumping `schemaVersion` only if needed.
  - Matches:
    - `MatchRecord` with sync fields, stored in IndexedDB.
    - Home page: "My matches" and "Unassigned plans".
    - Match screen: name, date, ordered stages with drag to reorder, add or remove plans.
    - Stage numbers follow the match order unless set by hand.
  - If the scale break was kept, the proper editor implementation (otherwise skip).
- **Depends on:** Plan 1 (`EditorState`, ops, store, schema).
- **Watch for:** the tally must count only target-category symbols; deleting a match must not delete its plans (they become unassigned); measure lines must survive undo/redo and object deletion (delete the line or detach it — decide in the plan).

- **Note for Plan 7:** consider storing the stage procedure as an ordered list of steps (still shown as one text block), so walkthrough steps can link to them later.

## Plan 2b — Scale break in the editor (variant C)

- **Spec:** §7.4 (variant C).
- **Builds:** a "Not to scale beyond" depth setting per plan (stored as one `scaleBreaks` entry, `toFt` = bay depth; clearing it removes the entry); the depth mapping (true ↔ drawn) used by drawing, hit-testing, dragging, snapping and fitting; the shaded strip with its torn edge, label and true-distance ticks; true-distance tags on objects inside the strip; measure lines and arrows that cross the break still show true distances.
- **Reference:** the spike on `spike/scale-break` (`src/lib/editor/scale-break-prototype.svelte.ts`) — port, don't merge.
- **Watch for:** the mapping must be the only place drawn depth is computed (print in Plan 4 reuses it); grid lines inside the strip; zoom and pan with a break on; an object dragged across the break edge.

## Plan 3 — Symbol library art

- **Spec:** §7.7 (style rules, catalog entry shape, first symbol set), anti-goals in §2 (no legend needed, black-and-white legible, original art only).
- **User checkpoint first:** draw a sample of about 8 symbols in 2–3 style directions (targets drawn standing up; footprints from above) and get the user's pick **before** drawing the full set. Use the visual companion or an HTML preview for side-by-side comparison. **Done 2026-11-22: direction A (spec §7.7).**
- **Builds:**
  - The full first symbol set from §7.7: about 16 targets, about 26 props and structures, and about 7 areas and markers. It replaces the Plan 1 placeholders and **keeps their ids** (`paper`, `popper`, `popper-static`, `popper-trigger`, `popper-auto-reset`, `steel-static`, `barrel`, `dump-box`, `shooting-position`, `wall`, `shooting-box`, `start-box`, `fault-line`).
  - Families for every target type with variants (paper, poppers, plates, movers…), so the palette groups them (spec §7.1, §7.7). Plan 1 adds the `family` field and the Poppers family.
  - Aliases for search and for the model in Plan 6.
  - Footprint styles beyond solid/outline/line as needed: walls with windows or ports, fences, berms.
- **Tests:** catalog invariants (unique ids, every symbol has an SVG, footprints have sizes, aliases unique within the catalog); a Playwright visual check that every symbol renders at all three sizes without clipping; a grayscale screenshot review with the user.
- **Reference:** the MD's deck (local attachment, not committed) shows what each object is; don't copy its art.

## Plan 4 — Print & PDF

- **Spec:** §7.6 (pages, overflow page, fit vs. tile, scale bar, downrange arrow, match print), §6 (Letter portrait/landscape, browser print + in-browser PDF), goal 6 and the print half of goal 7.
- **User checkpoint first:** page design mockups (header layout, typography, how the brief sits beside or above the diagram) reviewed with the user before building. The goal is to improve on the MD's PowerPoint layout, not copy it. **Done 2026-11-22: layout B (spec §9).**
- **Builds:**
  - Print route(s) rendering pages as SVG/HTML at Letter size with print CSS.
  - Fit to page: the canvas scaled into the diagram area.
  - Tile: the canvas split across pages at a chosen scale, with overlap, "2 of 4" labels, and a scale bar on each page.
  - Symbols keep their fixed print size: small 0.35 in, medium 0.45 in, large 0.55 in. Confirm these sizes with the user in the mockups.
  - Procedure and notes move to a following page when they don't fit, leaving a "see page 2" pointer.
  - Match print: every stage in order, each starting on a new page, with footers "Match name · Stage N · page x of y". A cover page is optional.
  - PDF download generated in the browser from the same pages; it works offline.
  - Plan thumbnails on the home page.
  - The scale break in print, if it was kept.
- **Tests:** page-count logic (overflow, tiling math) unit-tested; Playwright checks that the print route renders the expected pages, that the PDF downloads and has the right page count, and that both work with the network disabled.

## Plan 5 — Accounts & sync (split into 5a and 5b, 2026-11-22)

The user split Plan 5 into two stacked plans. Both develop and test against the **local Supabase stack** (`supabase start` in Docker); tests never touch the hosted project. Each plan adds only the tables its own code uses.

### Plan 5a — Accounts

- **Spec:** §6 (sign-in, invites, authorization, hosting), §7.8 (`profiles`), §7.1 screens 1 and 7, goal 1, constraints in §3.
- **Builds:**
  - **Local Supabase project:** `supabase/config.toml` with email + password only, public sign-up disabled, and the invite email template.
  - **Drizzle schema and migrations** (generated into `supabase/migrations`): `profiles` and the trigger that creates one for each new auth user. RLS is enabled as a backstop.
  - **Sign-in, invite acceptance (set password), and sign-out.** App routes need a stored session, and the check works offline.
  - **Admin page:** invite an MD by email with Supabase's built-in invite, and list users.
  - **Hosting:** `@sveltejs/adapter-node`, a Dockerfile and a `docker-compose.yml` for Coolify's Docker Compose build pack, and a health check route.
  - **Rollout checklist** for the hosted project: migrations, auth settings, custom SMTP for invites, and Coolify env vars. These steps need the user.
- **Watch for:** server-side checks of the session and admin role on every server route (never trust `user_metadata`); open redirects through `?next=`; existing e2e specs must sign in first.
- **Known gap closed by 5b:** sign-out keeps local data, so another account signing in on the same device sees it.

### Plan 5b — Sync & offline

- **Spec:** §7.8 (tables, sync columns), §7.9 (offline and sync), §7.1 screen 2 (sync status), goal 8.
- **Builds:**
  - **Tables:** `canvases`, `matches` and `plans`, with sync columns and a server change sequence.
  - **Sync endpoints:**
    - Push validates with the shared Zod schemas and checks the base version.
    - Pull returns changes since the client's cursor.
  - **Client sync loop:** outbox of dirty records, pull/apply, and conflicted copies (§7.9). A sync status indicator shows synced / offline / changes pending / conflict.
  - **Service worker:** precaches the app shell, symbols, and fonts.
  - **Schema-version guard:** a client that sees a newer schema asks the user to reload.
  - **First sign-in on a device with local data from before accounts:** upload it to the account, with a notice of how many records were added (decided 2026-11-22).
  - **Sign-out:** clears local data, warning first if anything is unsynced.
- **Watch for:** server-side ownership checks on every query; the conflict path (same plan edited on two devices offline); pull cursors must not skip rows that commit out of sequence order; e2e tests need one account per test once data syncs.
- **Tests:** unit tests for the sync merge rules and endpoint validation (against the local database); Playwright e2e for editing offline (`context.setOffline(true)`) then syncing, and a two-context conflict producing a conflicted copy.

`ai_drafts` is created by Plan 6, which uses it.

## Plan 6 — Draft from text

- **Spec:** §7.5 (flow, prompt contents, structured output, validation and repair, logging, offline behavior, eval), §6 (model, caps, spend ceiling), goal 5.
- **Builds:**
  - **Server route:** authenticated and rate-limited. It calls Claude through the official `@anthropic-ai/sdk` with structured output. Model `claude-opus-5-5`, server-side refusal fallback enabled, effort chosen from the eval.
  - **Input:** the catalog (ids, names, aliases, kinds, sizes), the canvas size, the brief, layout conventions, and the minimum symbol spacing.
  - **Output handling:**
    - Zod validation plus placement checks: known symbol, on the canvas, sane size, unique labels.
    - One repair round on failure; then drop the invalid items and report them.
  - **Cost controls:** `ai_drafts` logging, the per-user daily cap, and the site-wide spend ceiling.
  - **UI:**
    - "Draft from text" dialog.
    - The draft replaces existing objects after a confirmation, as one undoable step.
    - Items the model couldn't represent are listed.
    - The button is disabled offline with a reason.
- **Eval first:** before tuning, build an eval set from the MD's seven reference stages (bay sizes guessed until the user supplies real DRRC sizes). Judge on: right symbols, right counts, labels matching the procedure, sensible order of shooting areas and targets, nothing off-canvas, no overlapping symbols. Use the `claude-api` skill's eval guidance.
- **Tests:** unit tests for placement validation and repair handling, with the model call stubbed; Playwright e2e with the route mocked to a fixed response (draft applied, undo restores, offline disables the button, cap reached shows a message). Real-model runs are part of the eval, not CI.

## Plan 7 — Walkthrough presentation

- **Spec:** §7.10 (user idea, 2026-11-21).
- **What:** authors tie the course-of-fire steps to color-coded highlights on props and targets (e.g. shoot vs move); viewers page through the steps.
- **Depends on:** Plan 2 only (stage brief/procedure, annotations such as movement arrows). Placed after Plan 6 by default; it can move up to right after Plan 2 if the user wants it sooner. Printing it as sequence cards builds on Plan 4; a viewer link for shooters needs sharing (after the MVP today).
- **Brainstorm first:** settle the open questions in spec §7.10 with the user before writing the plan.

## After the MVP (spec §10)

Sharing (read-only links, public library, copy onto your canvas and re-fit), open sign-up and terms/billing, canvas features (structures, backstop, slope, safety checks), discipline symbol sets (USPSA, IDPA, PRS, Steel Challenge), sequence cards and RO sheets, A4, "refine with text", linking shooting areas to the targets they engage.
