# Match Sketch — Design

Date: 2026-11-21
Status: Draft for approval

## 1. What this is and why

Match Sketch is a web platform where match directors (MDs) for practical shooting competitions design **stage plans**: the one-or-two-page document handed to shooters and range officers that shows a stage's layout and spells out how it is shot.

Today, the reference MD (DRRC SOF Multigun) builds these in PowerPoint/Google Slides. Each plan is a letter-portrait page with a header table (title, start position, gun ready condition, stage procedure, round count, targets, par time) and a hand-arranged diagram below it. Diagram pieces are a mix of PowerPoint shapes, clip art, and product photos; spare pieces are parked just off the slide edge and dragged in as needed. The result works but is inconsistent (photos next to clip art, stock images with watermarks), not to scale, carries no distances, and every target count in the header is typed by hand.

Match Sketch replaces that with a purpose-built designer: a bay-sized grid in real units, a consistent library of original SVG symbols that read at a glance like road signage, a structured stage brief, and clean print output. As an MVP requirement, an MD can also type a stage description and have a model draft the layout onto their bay, which they then adjust by hand.

The core of the product is the **designer**. Drafting from text is one way into it, required for the MVP, but not the center.

**Users:** match directors (authors). Shooters and ROs consume the printed output. Later, MDs share plans with each other.

**Reference material:** the MD's deck `DRRC SOF 2025.pptx` (local attachment, not committed). Odd slides (1, 3, 5, 7, 8, 10, 12) are the MD's current color plans and are the reference. Even slides are black-and-white scans of 1989 SOF match plans — historical background only. Slide 14 is a printable sheet of sequence cards for a "draw a sequence from the bucket" stage.

## 2. Goals, non-goals, anti-goals

### Goals (MVP)

1. An **invited** MD can accept an invite, sign in, and see their matches, plans, and saved canvases.
2. An MD can define a **canvas** (bay) by name, width, and depth in feet or yards, save it to a personal library, and reuse it for later plans.
3. In the editor, an MD can drag symbols from a library onto the canvas, snap them to a grid, move/rotate/resize/delete/duplicate them, label them, measure distances, and undo/redo.
4. An MD can fill in the stage brief fields; the **Targets** tally is computed from the diagram.
5. An MD can enter a text description and get a **model-drafted layout** of symbols placed on their canvas, which then behaves like any hand-placed layout.
6. An MD can print the plan, fit to one page or tiled across pages, with the procedure moving to its own page when it is too long, and can download it as a PDF.
7. An MD can group stage plans into a **match** (name, date, ordered stages) and print or download the whole match as one document.
8. An MD can create, edit, print, and download plans **while offline** (e.g. at a range with no signal) on a device where they have signed in before; changes sync when the device is back online. Only model drafting and signing in need a connection.

### Non-goals (MVP)

- Sharing plans between users, public galleries, copying a stage onto another user's canvas. (Planned next; see §10.)
- Public sign-up and billing. Accounts are invite-only.
- Real-time multi-user editing, and merging edits made to the same plan on two devices at once (§7.9 keeps both versions instead).
- Terrain: slope, elevation, side views, permanent bay features (berms, structures), backstop/safe-angle checks. Canvases are width × depth only.
- Computing round counts or scoring. Round count stays MD-written text.
- Symbol sets for disciplines beyond what the reference plans use (USPSA/IDPA/PRS-specific sets come later; the catalog must make adding them easy).
- Supplementary printouts such as sequence cards.
- Full editing on phones. (Viewing a plan on a phone should work.)

### Anti-goals (would make it a failure even if it works)

- Symbols that need a legend to understand, or that only work in color. Plans are often printed on black-and-white printers; symbols must differ by **shape**, with color as a bonus.
- Blurry or raster print output.
- A model draft presented as finished. Drafts always land in the editor for the MD to review and correct, and correcting a draft must be as easy as drawing by hand.
- Being slower than PowerPoint for the MD's routine job of laying out a stage and printing it.
- Using stock clip art or photos. All symbols are original SVG.

## 3. Constraints

- TypeScript throughout.
- **SvelteKit 3** (3.1.x as of this writing). Note: SvelteKit 3 config lives in `vite.config.js` (no `svelte.config.js`); remote functions are still experimental.
- **Supabase** for Postgres and authentication. **Drizzle** for database access and migrations. **Zod** for validation. No Effect.
- **Claude API** via the official `@anthropic-ai/sdk`, called only from the server. API key never reaches the browser.
- Deployed to the web.
- **Offline-capable:** the app must load and the editor, print, and PDF must work with no connection, after the user has signed in once on that device.
- **Invite-only** accounts; the operator (the user) pays for model usage.
- **Testing:** Vitest unit tests and Playwright end-to-end tests are used for development and verification. Logic (geometry, units, document schema, editor operations, storage, sync, layout validation) is covered by Vitest unit tests; user-facing behavior (editor interactions, persistence, printing, offline) by Playwright e2e tests. Features are developed test-first.

## 4. Approaches considered

| Decision                                  | Options considered                                                                                                                                                                                 | Chosen                                              | Why                                                                                                                                                                                                                                                                                                                                          |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework                                 | SvelteKit 3; SolidStart on Solid 2                                                                                                                                                                 | **SvelteKit 3**                                     | Released and stable. Solid 2 is a release candidate (its README calls it "experimental beta") with SolidStart support lagging. Solid's fine-grained reactivity edge doesn't matter at our scale (dozens of objects per stage). User preference.                                                                                              |
| Rendering the stage                       | Plain SVG in the DOM; canvas libraries (Konva, Pixi); whiteboard kits (tldraw, Excalidraw)                                                                                                         | **Plain SVG**                                       | Symbols are SVG already; print/PDF stays vector; each placed object is an ordinary Svelte component. Canvas libraries only win at thousands of objects and make print raster. Whiteboard kits are React-only.                                                                                                                                |
| Backend                                   | SvelteKit-only (Postgres + Drizzle + Better Auth); SvelteKit + Supabase                                                                                                                            | **SvelteKit + Supabase (Postgres, Auth) + Drizzle** | User's choice; user has shipped Supabase + Drizzle many times.                                                                                                                                                                                                                                                                               |
| Server-side effect system                 | Effect 4; plain TypeScript + Zod                                                                                                                                                                   | **Plain TypeScript + Zod**                          | The server is thin (plan/canvas CRUD, sync, and one AI route). Effect's strengths would pay off mainly in the AI route; not worth the learning curve for the MVP. Revisit if the server grows.                                                                                                                                               |
| Offline sync (designer's call — see §7.9) | Hand-rolled document sync (IndexedDB + outbox + versioned records); a sync engine with Supabase support (e.g. PowerSync: SQLite in the browser, replicated tables); CRDT documents (Yjs/Automerge) | **Hand-rolled document sync**                       | Data is document-shaped (one JSON document per plan, plus a few canvases and matches) and single-author. A sync engine replicates relational rows we don't need and adds a service to run or pay for. CRDTs merge concurrent edits, which only matters for co-editing — a non-goal. Revisit CRDTs if real-time collaboration is ever wanted. |

## 5. Decisions made with the user

- Canvas dimensions are arbitrary: anything from a small pistol bay to a long rifle range. The user defines width and depth before entering the editor. Nothing else about the bay is recorded for now.
- Canvases are saved to a **personal library** and reused across plans.
- Symbols are **original SVG**, minimal, sign-like, and understood by MDs and shooters without a legend.
- The document should **improve on** the reference design, not copy it.
- Large or deep bays: the editor zooms; printing offers **fit to page** or **tile across multiple pages**. When the written instructions get long, they go on a **separate page**, as the reference MD already does.
- A **scale break** (map-style "not to scale" band so distant targets can sit near the top of the page) is worth trying. Treat it as an early prototype, not a settled feature (§7.4).
- The MVP includes model drafting from text, on top of manual drag-and-drop.
- Platform with authenticated users; sharing comes after the MVP.
- Accounts are **invite-only** for the MVP.
- Stage plans can be grouped into a **match**, and a whole match prints as one document.
- **Full offline editing** is required.
- The symbol library is a **left sidebar**: a scrollable list of thumbnails with names, grouped by category and, inside a category, by **family**, so variants of one target type sit together (e.g. Poppers: knock-down, static, trigger, auto-reset). Decided 2026-11-21, during Plan 1.

## 6. Calls made by the designer (not discussed in depth; correctable)

- **Canvas reuse copies, not links.** A plan stores its own copy of the canvas dimensions plus a reference to the library canvas it came from. Editing a library canvas never reshapes existing plans. (Revisit when canvases gain permanent features.)
- **Two kinds of objects** (§7.3): _footprint_ objects drawn to scale; _symbol_ objects placed at a true position but drawn at a fixed, readable print size.
- **Targets tally is computed** from placed target symbols, grouped by type ("4 static steel, 1 flasher"). The MD can override it with free text.
- **Units:** positions are stored in feet (decimal). The MD chooses feet or yards for display and entry per canvas. Grid snap options: off, 1 ft, 1 yd, 5 yd (builder may add more).
- **Coordinates:** origin at the uprange-left corner. `x` = feet from the left edge; `y` = feet downrange from the uprange edge. Downrange is drawn toward the top of the page, as in the reference plans.
- **Model:** Claude Opus 5.5 (`claude-opus-5-5`) with structured output. Server-side refusal fallback enabled. Effort level chosen by the builder from a small eval (§7.5).
- **Sign-in:** Supabase Auth with email + password (works offline once a session exists; magic links don't help offline). Public sign-up is disabled in Supabase; the operator invites MDs with Supabase's built-in invite email from a minimal admin page (`profiles.role = 'admin'`).
- **Authorization:** enforced in SvelteKit server code (every query scoped to the signed-in user). Supabase row-level security is also enabled on user tables as a backstop.
- **Cost ceiling:** besides the per-user daily draft cap, a site-wide daily spend ceiling on model calls (computed from logged token usage) disables drafting for the day when hit.
- **Crowded targets:** target symbols carry a `count` (e.g. one "KD ×4" object instead of four), drawn as a compact cluster with a count badge; the Targets tally sums counts. Positions are exactly where the MD puts them — nothing auto-moves at print time. A per-plan **symbol size** setting (small / medium / large) helps dense stages. The model is told the minimum spacing that keeps symbols from overlapping at fit-to-page scale.
- **Distances:** a **measure** annotation: the MD draws a line between two objects or points and it shows the true distance in the plan's units, updates as objects move, and prints. No automatic "which SA engages which target" links in the MVP.
- **Offline architecture:** local-first document sync (§7.9). The editor and print routes render in the browser from local data.
- **Hosting:** Vercel with the SvelteKit Vercel adapter. (Any Node host works; nothing depends on Vercel.)
- **Printing:** browser print of a dedicated print route (vector output). **Download PDF** is generated in the browser from the same SVG pages.
- **Paper:** US Letter, portrait and landscape. A4 is a later addition.
- **AI usage limit:** a per-user daily cap on drafts (configurable; start around 20/day) to bound cost.
- **Devices:** editor targets desktop and tablet (pointer events, touch-friendly hit targets). Phone: view and print only.

## 7. How it works

### 7.1 Screens

1. **Sign in / accept invite / set password.** (Needs a connection.)
2. **Home:** _My matches_ (name, date, stage count), _Unassigned plans_ (plans not in a match), and _My canvases_ (name, dimensions). Actions: new match, new plan, new canvas, open, duplicate, delete. A sync status indicator (synced / offline / changes pending / conflict) is always visible.
3. **Match:** name, date, ordered list of its stage plans (drag to reorder; stage numbers follow the order unless set by hand). Actions: add new or existing plan, remove, print/PDF the whole match.
4. **New plan:** pick a canvas from the library or define a new one (name, width, depth, unit) with an option to save it to the library; optionally pick a match. Then the editor opens.
5. **Editor:**
   - Center: the canvas (bay outline, grid, scale bar, downrange arrow), with pan and zoom.
   - Left: symbol library as a scrollable list of thumbnails with names, grouped by category and then by family (variants of one target type, e.g. Poppers: knock-down, static, trigger, auto-reset), with search. Groups collapse; search opens every group with a match.
   - Right: properties of the selected object (label, rotation, size for footprint objects, position in ft/yd), and the **Stage brief** panel.
   - Top bar: undo/redo, snap setting, units, symbol size, measure tool, **Draft from text** (disabled offline, with a reason), print/preview, PDF, sync state.
6. **Print preview:** paged view of the document exactly as it will print, with fit-to-page vs. tile choice and orientation. Works offline.
7. **Admin (operator only):** invite an MD by email; see invited users and today's model spend against the ceiling.

### 7.2 Stage brief

Fields, taken from the reference plans:

- Match name (taken from the match when the plan belongs to one; free text otherwise), stage number, stage name (optional)
- Start position
- Gun ready condition
- Stage procedure (long text; the main free-text field)
- Round count (free text; often per gun/caliber, e.g. "21 rds battle rifle / 37 rds intermediate")
- Targets (computed tally, overridable)
- Par time
- Additional notes boxes: zero or more titled free-text sections (e.g. the reference plan's "Bonuses per target neutralized" list)

Rich text is not needed for the MVP beyond line breaks; bold field labels come from the template.

### 7.3 Objects on the canvas

Every placed object references a catalog symbol and has an id, position (ft), rotation (degrees), optional label, and z-order.

- **Footprint objects** have a real size in feet and are drawn to scale: walls (with optional windows/ports), barricades, shooting boxes and areas, start box, fault lines, berms/mounds, vehicles, platforms, tables, fences. They can be resized.
- **Symbol objects** are drawn at a fixed print size regardless of zoom or bay size: targets (paper, no-shoot, poppers, plates, static steel, flashers, spinners, Texas star, whirly-gig, plate rack, etc.) and small props (barrel, tire, bucket, ammo can, chair). Their position is true; their size is for legibility. Targets are drawn as upright, front-facing glyphs, as the shooter sees them — the convention in the reference plans.
- Target symbols have a **count** (default 1). A count above 1 draws a compact cluster with a "×N" badge, so a row of 14 KDs can be one or a few objects instead of a smear of 14 glyphs. The per-plan **symbol size** setting scales all fixed-size symbols together.
- **Annotations:** text labels, movement arrows (e.g. SA-1 → SA-2 path), and **measure lines** (attached to two objects or points; show the true distance in ft or yd; follow the objects when they move). Drawn at fixed size.

Labels like SA-1…SA-n and dump box A/B are first-class: the editor offers auto-numbering (next SA number, next letter) so labels in the diagram match references in the procedure text.

### 7.4 Scale break (prototype early)

Problem: in multigun, shooting areas sit within ~30 yd while rifle targets can be 100–300+ yd away. At true scale, most of the page is empty ground.

Idea: the MD can add a horizontal **break band** at a chosen depth range (e.g. 40 yd → 150 yd). The band is drawn compressed with a map-style break symbol and its true distance labeled. Objects beyond the band keep their true `y` in data but render shifted closer, and each shows its true distance.

Status: build a quick prototype early in implementation, show it to the user, and decide whether it ships in the MVP. The data model stores breaks as an optional list on the plan, so adding or dropping the feature doesn't change saved plans.

### 7.5 Draft from text

1. The MD opens **Draft from text**, enters or confirms the description. The stage brief fields are pre-filled into the request; the procedure is required. Counts in the Targets/round count fields help the model place the right number of targets.
2. Server route (authenticated, rate-limited) sends Claude:
   - canvas width and depth (ft) and the coordinate convention;
   - the symbol catalog: id, name, aliases, category, footprint vs. symbol, default size;
   - the stage brief;
   - layout conventions: shooting areas uprange, targets downrange of the areas that engage them, labels matching the procedure (SA-n, dump box letters), start position near the uprange edge;
   - the minimum spacing in feet between fixed-size symbols, computed from the canvas size and the plan's symbol size at fit-to-page scale, and the instruction to use `count` for rows of identical targets.
3. Claude returns structured output: a list of placements (`symbolId`, `x`, `y`, `rotation`, optional `label`, optional `count` for targets, optional `width`/`depth` for footprint objects) plus a short list of anything in the text it could not represent with the catalog.
4. The server validates with Zod and checks each placement: known symbol id, inside the canvas, sane sizes, unique labels. If checks fail, it sends the errors back to Claude once to repair; if they still fail, it drops the invalid items and reports them.
5. The client shows the draft. If the canvas already has objects, the MD confirms replacement first. Applying the draft is a single undoable step. Unrepresentable items are shown so the MD can add them by hand.
6. Every draft request is logged (user, plan, model, token usage, success/failure) for cost tracking, the per-user daily cap, and the site-wide spend ceiling.
7. Drafting needs a connection. Offline, the button is disabled with a short explanation. A draft is applied to the local plan like any other edit and syncs normally.

The procedure text in real plans usually says _what_ and _in what order_ but rarely _where_ ("proceed to SA-1 and engage the static steel through a port in the half wall"). The model is expected to invent a reasonable schematic layout, as the MD does by eye; the MD corrects it.

**Eval:** before tuning the prompt or effort level, build a small set of real briefs (the seven reference stages are a starting point) and judge drafts on: right symbols present, right counts, labels match the procedure, shooting areas and targets sensibly ordered, nothing off-canvas, no overlapping symbols. The reference deck doesn't record bay sizes, so use plausible guesses (and ask the user for real DRRC bay sizes when convenient).

### 7.6 Printing and PDF

- The printed document is a sequence of pages generated from the plan:
  - **Page 1:** header (title, brief fields, targets tally, par time, round count) and the diagram.
  - If the procedure or notes don't fit alongside the diagram, they move to a **following page** and page 1 keeps a short "see page 2" pointer.
  - **Diagram sizing:** _fit to page_ scales the whole canvas into the diagram area; _tile_ splits the canvas across pages at a chosen scale, with overlap margins, page labels ("2 of 4") and a scale bar on each.
- Symbols keep their fixed print size in every mode.
- Every page shows a scale bar (or "not to scale" where a scale break is used) and a downrange arrow.
- Print uses a dedicated print route with print CSS; output is vector. The PDF download renders the same pages to PDF in the browser. Both work offline.
- **Match print:** prints every stage of a match in order as one document (one PDF), each stage starting on a new page. Page footers read "Match name · Stage N · page x of y". A cover page listing the stages is optional (builder's call).
- The visual design of the page (typography, header layout, how the brief is arranged) should improve on the reference. Work it out with the user through mockups before building the print layout.

### 7.7 Symbol library

- **Style:** one consistent line style; shapes distinguishable in black and white; limited accent colors (e.g. tan for paper, steel gray, red for no-shoot hits) that degrade to fills/patterns when printed in grayscale; legible at roughly 0.35–0.5 in printed.
- **Catalog entry:** id, display name, aliases (e.g. "pepper popper", "popper"), category, optional family (groups variants of one target type in the palette, e.g. Poppers), kind (footprint/symbol), default size, the SVG, and optional label anchor point. The catalog is a TypeScript module plus SVG files in the repo, versioned with the app; adding a discipline set is adding catalog entries.
- **First set (from the reference plans):**
  - _Targets:_ paper (large), paper (small), paper with hard cover, no-shoot, swinger (swinging paper), poppers (knock-down, static, trigger, auto-reset), KD (knock-down plate), static steel, flasher, spinner, Texas star, whirly-gig, ducks in a row, plate rack, bottle, stop plate.
  - _Props and structures:_ wall, wall with window/port, half wall with port, V-tac wall, door, barrel, stacked barrels, tire, pallet, car, chopper seat/bench, table, chair, sawhorse, staircase, rooftop/platform, wobble platform, plank/bench, low barrier ("sticks"), ammo can, bucket, crate/box, tree, berm/mound, fence/mesh, target frame/stand.
  - _Areas and markers:_ start box, shooting box/area, fault line, dump box, SA label, movement arrow, text note.

### 7.8 Data

Tables (Postgres via Drizzle; `owner_id` references the Supabase auth user):

- `profiles`: id (= auth user id), display name, role (`md` | `admin`), created_at.
- `canvases`: id, owner_id, name, width_ft, depth_ft, display_unit (`ft` | `yd`), sync columns.
- `matches`: id, owner_id, name, date, sync columns.
- `plans`: id, owner_id, match_id (nullable), stage_order (within the match), source_canvas_id (nullable), title fields (match name for unassigned plans, stage number, stage name), width_ft, depth_ft, display_unit, `document` (jsonb), schema_version, sync columns.
- `ai_drafts`: id, owner_id, plan_id, model, input tokens, output tokens, estimated cost, status, error, created_at. (Optionally the request and response bodies, for debugging and the eval.) Server-only; not synced.

**Sync columns** on every user-editable record: `version` (integer, incremented by the server on each accepted write), `updated_at`, `deleted_at` (soft delete, so deletions sync), and a server-assigned change sequence used as the pull cursor. Record ids are UUIDs generated on the client so records can be created offline.

The plan `document` jsonb holds the brief, the objects list, labels, measure lines, scale breaks, symbol size, grid/snap preferences, and print preferences. It is defined by a Zod schema shared by client and server, with a `schema_version` so later changes can migrate old plans. Every write is validated against it on the server.

### 7.9 Offline and sync

- **Local store:** the browser keeps the user's canvases, matches, and plans in IndexedDB. The UI reads and writes only the local store; it never waits on the network to edit.
- **App shell offline:** a SvelteKit service worker precaches the built app, the symbol SVGs, and fonts. App routes (home, match, editor, print) render in the browser from local data (`ssr = false` for these routes). The sign-in and invite routes need the network.
- **Auth offline:** the Supabase session is persisted on the device. Offline, the app trusts the stored session to open local data; it refreshes the token when back online. A device must have signed in online once.
- **Outbox:** each local change marks the record dirty. Edits are saved locally within a second or two; a sync loop pushes dirty records whenever the device is online (on reconnect, on an interval, and after edits settle).
- **Push:** the client sends the whole record with the `version` it was based on. The server accepts it only if that version is still current, then bumps the version.
- **Conflicts:** if the server's version has moved on (the same plan was edited on another device), the server keeps its version and the client saves its local edits as a new plan named "<title> (conflicted copy, <device/date>)", shows the conflict on the sync indicator, and leaves the MD to keep or delete either. No automatic merging. Canvases and matches use the same rule (for a match, the conflicted copy keeps its plan assignments).
- **Pull:** the client asks for all records changed since its last cursor and applies them, unless the local copy is dirty (then the push/conflict rule decides).
- **Schema changes:** a client that receives a record with a newer `schema_version` than it understands asks the user to reload to update the app; it doesn't overwrite the record.
- **Sign-out** clears the local store after warning if there are unsynced changes.

## 8. Left to the builder

- Project structure, component breakdown, state management inside the editor (Svelte runes).
- Choice of pan/zoom and drag implementation (hand-rolled pointer events or a small library), as long as output stays SVG.
- Exact snapping behavior (e.g. snapping object center vs. edges, rotation snapping).
- Whether to use SvelteKit remote functions (experimental) or form actions / `+server` endpoints.
- PDF library for the in-browser PDF.
- Exact rate limits, spend ceiling value, canvas min/max dimensions, local save and sync intervals.
- IndexedDB wrapper (e.g. Dexie or idb), service worker caching details, and the sync endpoint shapes, within the rules in §7.9.
- Prompt wording and effort level for the draft model, guided by the eval.
- Drawing the SVG symbols to the style rules above. Show early symbol sketches to the user before drawing the full set.

## 9. Open with the user (to settle during implementation, not blocking the plan)

- Page visual design: to be worked out with mockups (§7.6).
- Scale break: keep or drop after the prototype (§7.4).
- Symbol style: review early symbol sketches before the full set is drawn (§7.7).
- Real DRRC bay sizes for the eval set (§7.5).

## 10. After the MVP

- Sharing: share a plan by link (read-only), publish to a public library, copy a published stage onto your own canvas and let the model re-fit it.
- Open sign-up with verification, terms/privacy pages, and possibly paid plans.
- Linking shooting areas to the targets they engage, so distances from each SA can be labeled automatically.
- Canvas features: permanent structures, berms, backstop direction, slope; safety checks (targets in front of the backstop).
- Aerial photo underlay: upload top-down aerial photography of the range, scaled and aligned to the bay, shown under the stage drawing in the editor. Until then the bay stays plain white.
- Discipline symbol sets (USPSA, IDPA, PRS, Steel Challenge).
- Supplementary printouts (sequence cards, RO score sheets).
- A4 paper.
- "Refine with text": ask the model to adjust an existing layout rather than replace it.
