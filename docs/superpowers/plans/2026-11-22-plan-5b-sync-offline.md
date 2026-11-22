# Plan 5b: Sync & offline — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An MD's canvases, matches and plans follow them between devices. The app opens and edits offline on a device that has signed in before, changes sync when it's back online, and a plan edited on two devices at once keeps both versions.

**Architecture:**

- **Local-first document sync (spec §7.9).** The UI keeps reading and writing only IndexedDB. A sync loop pushes dirty records and pulls changes since a cursor. No automatic merging: a stale push comes back as a conflict, and the client saves its version as a conflicted copy.
- **Server endpoints with Drizzle.** `POST /api/sync/push` and `GET /api/sync/pull` check the verified session and scope every query to its owner. One Postgres sequence stamps every write with a `change_seq`. A per-owner advisory lock serializes each owner's pushes, so the pull cursor (`change_seq > cursor`) never skips a row that committed late.
- **Shared Zod wire schemas** (`src/lib/sync/wire.ts`) validate pushes on the server and pulls on the client. Pulled plans with a newer `schemaVersion` aren't applied; the app asks to reload.
- **A service worker** (SvelteKit 3: `src/service-worker/index.ts`) precaches the built app and serves a cached app shell to navigations when offline, so a signed-in device opens the app with no network.
- **Sign-out clears local data**, warning first when changes are unsynced. The first sign-in on a device adopts its local data from before accounts and uploads it, with a notice.

**Tech Stack:** SvelteKit 3.4, Svelte 5, Dexie 4 (`fake-indexeddb` in unit tests), Drizzle 0.45 + postgres-js, Supabase local stack, Zod 4, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-21-match-sketch-design.md`:

- §7.8 (tables, sync columns), §7.9 (offline and sync);
- §7.1 screen 2 (the sync status indicator) and screen 5 (the editor's sync state);
- goal 8;
- §9 (upload local data on first sign-in; local test database).

Roadmap: `docs/superpowers/plans/ROADMAP.md`, Plan 5b. It builds on Plan 5a: `getSupabase`, `readSession`, `signOutDevice`, `clearStoredSession`, `requireUser`, `serverDb`, and the e2e helpers.

## Global Constraints

- Plan 5a's constraints still hold: SvelteKit 3 env via `src/env.ts`, `getClaims()` on the server, Svelte MCP autofixer, atomic Angular commits.
- **Every synced table:**
  - RLS enabled with a select-own policy;
  - `revoke all … from anon, authenticated` (the app uses the endpoints, never the Data API);
  - `owner_id references auth.users on delete cascade`;
  - `supabase db advisors --type security --fail-on warn` stays clean.
- **Wire field names** are camelCase, mirroring the local records (`src/lib/store/records.ts`), without `dirty`. The server owns `version` and `ownerId` and ignores any the client sends.
- **Limits:**
  - a push carries at most 50 records;
  - a pull page returns at most 200 records;
  - a push body stays under adapter-node's 512 kB default (one plan document is a few kB).
- **Timing:**
  - sync 2 s after local edits settle;
  - sync every 30 s while online;
  - sync on `online` and on `visibilitychange` to visible.
  - Only one tab syncs at a time (`navigator.locks`, lock name `match-sketch-sync`).
- **Copy** (used verbatim by tests):
  - Status: "Synced", "Syncing…", "Changes pending", "Offline", "Conflict", "Sync failed".
  - Conflicted copy name: `<name> (conflicted copy, <Mon D h:mm AM>)`.
  - Reload banner: "A newer version of Match Sketch saved some of your plans. Reload to update." with "Reload".
  - First sign-in: "Added <n> plans, <n> canvases and <n> matches from this device to your account." (list only the non-zero kinds, singular for 1).
  - Sign-out warning: "<n> changes on this device haven't synced. Signing out deletes them." with "Sign out anyway".
- **Device preferences** (theme, sounds) survive sign-out. The synced records, sync settings and unsaved-edit journal entries do not.

## Decisions

1. **The pull cursor is a per-owner position in a global sequence.**
   - `sync_change_seq` is a `pgSequence`. Each table's `change_seq` defaults to `nextval(...)`, and a `BEFORE UPDATE` trigger sets a new value.
   - A push runs in one transaction that first takes `pg_advisory_xact_lock(hashtextextended(owner_id::text, 0))`.
   - A pull merges the three tables by `change_seq`, takes the first 200, and returns the last value as the next cursor.
2. **Push outcome per record:**
   - **unknown id** → insert, version 1;
   - **known id of the same owner, and `baseVersion` equals the current version** → update, version + 1;
   - **known id of the same owner, but a different version** → `conflict`, with the server's record;
   - **known id of another owner** → `rejected`, reason `not-found`. This reveals nothing.

   Deletions are updates that set `deletedAt`.
3. **The client applies push results:**
   - **accepted** → set `version`. Clear `dirty` only if the local `updatedAt` still equals the pushed one; an edit made meanwhile stays dirty for the next push.
   - **conflict** →
     1. Write the local version as a new record: new id, version 0, dirty, and the conflicted-copy name. For a plan, the name goes in `brief.stageName`.
     2. Replace the local record with the server's.
     3. Add the copy to the `sync-conflicts` setting.

     A conflicted match copy carries the local name and date. Its stages stay with the original match: stage assignment is a plan field and syncs by the plan rule.
4. **Pull applies a server record** unless the local copy is dirty (the push and conflict rule decides those). A plan with `schemaVersion` > 1 is skipped and sets `needsReload`. The cursor advances only past records that were applied or deliberately skipped.
5. **Device owner:**
   - Setting `sync-owner`. On the first sign-in on a device (unset), it becomes the account id. Local records with version 0 are counted for the notice; they are already dirty, so they upload.
   - If the owner is set to a different account, sync pauses and the status reads "Another account's data is on this device. Sign out to clear it."
6. **The conflict indicator** stays until the MD opens it. "Conflict" opens a dialog that lists the copies (links to open them) and has a "Dismiss" button, which clears `sync-conflicts`.
7. **Sign-out:**
   1. Count the dirty records. If any, show the warning dialog.
   2. Clear the `canvases`, `matches` and `plans` tables, the `sync-*` settings and the `match-sketch:unsaved:*` localStorage keys.
   3. `signOutDevice` (Plan 5a).
   4. `location.assign('/sign-in')`, a full reload that also ends any in-flight token refresh.
8. **Service worker:**
   - It precaches `immutable` + `assets` (from `$app/manifest`) and the shell HTML fetched from `/sign-in` at install, keyed on `version` (`$app/env`).
   - **Navigations:** network first, falling back to the cached shell. Every page is client-rendered, so the shell is route-agnostic.
   - **Same-origin GETs of precached files:** cache first.
   - **Never cached:** `/api/*`, `/admin`, `/health`, `__data.json`, cross-origin requests.
9. **E2E isolation:** a fixture gives each test its own MD account, signed in through the UI and deleted after the test, so synced data never leaks between tests. Specs that test signing in keep importing from `@playwright/test`.

## Review Focus

1. **The same plan edited on two devices offline:** both versions survive, one as the original (the server's) and one as the conflicted copy, and the indicator says "Conflict". → Task 8 (e2e), Task 5 (unit).
2. **An edit made while its push is in flight** isn't lost: the record stays dirty and goes up on the next push. → Task 5 (unit).
3. **Pull cursor and concurrency:** two pushes for one owner racing, and a pull while a push is in flight, never skip a row. → Task 4 (db test).
4. **A push naming another user's record id** neither changes it nor reveals it. → Task 4 (db test).
5. **Opening the app with no network on a signed-in device** shows the home page and existing plans, allows edits, and syncs them once online. → Task 10 (e2e).

---

## File Structure

```
src/lib/server/db/schema.ts          + canvases, matches, plans, sync_change_seq, length_unit
supabase/migrations/*                generated + custom (update trigger, grants)
src/lib/sync/wire.ts                 Zod wire schemas (shared), toWire/fromWire
src/lib/server/sync.ts               pushRecords, pullChanges
src/routes/api/sync/push/+server.ts, pull/+server.ts
src/lib/server/auth.ts               + requireApiUser (401 JSON)
src/lib/sync/engine.ts               syncOnce(db, transport, …) (push, conflicts, pull)
src/lib/sync/device.ts               adoptDevice, unsyncedCount, clearLocalData
src/lib/sync/status.ts               syncLabel() (pure)
src/lib/sync/loop.svelte.ts          the sync loop and the reactive status
src/lib/sync/transport.ts            fetch-based Transport
src/lib/sync/SyncStatus.svelte, ConflictDialog.svelte, ReloadBanner.svelte
src/routes/(app)/+layout.svelte      starts the loop; banner; first-sign-in notice
src/service-worker/index.ts, tsconfig.json
tests/e2e/fixtures.ts                per-test account
tests/e2e/sync.spec.ts, conflict.spec.ts, sign-out.spec.ts, offline-app.spec.ts
```

---

### Task 1: One account per e2e test

**Files:**

- Create: `tests/e2e/fixtures.ts`, `tests/e2e/isolation.spec.ts`
- Modify:
  - every spec that runs signed in (import `test`/`expect` from `./fixtures`);
  - `playwright.config.ts` (drop the `setup` project and `MD_STATE`);
  - `tests/e2e/admin.spec.ts`;
  - `tests/e2e/support/accounts.ts`.
- Delete: `tests/e2e/auth.setup.ts`

**Interfaces:**

- **Produces:**
  - `fixtures.ts` exports `test` and `expect`, plus the fixture `account: Account`.
    - `account` is created with `ensureUser({ email: uniqueEmail('e2e'), password: 'test-password-1', role: 'md' })`, then deleted via the admin API after the test.
    - The fixture overrides `page`: it signs in as `account` before the test body runs, starting signed out.
  - `MD` and `ADMIN` stay for the auth and admin specs.
- [ ] **Step 1: Write the failing test.** `isolation.spec.ts`: two tests each create a plan named after their own account, and each test's home lists exactly one plan. Run it in parallel with `test.describe.configure({ mode: 'parallel' })`.
- [ ] **Step 2: Run to verify failure.** Expected: FAIL (no `./fixtures`).
- [ ] **Step 3: Implement,** and switch the specs over.
- [ ] **Step 4: Run** the whole e2e suite. Expected: PASS.
- [ ] **Step 5: Commit:** `test(e2e): give each test its own account`

---

### Task 2: Synced tables and the change sequence

**Files:**

- Modify: `src/lib/server/db/schema.ts`
- Create:
  - `supabase/migrations/<ts>_synced_records.sql` (generated) and `<ts>_sync_change_seq.sql` (custom)
  - `src/lib/server/sync-tables.db.test.ts`

**Interfaces:**

- **Produces** (Drizzle):
  - `syncChangeSeq = pgSequence('sync_change_seq')`;
  - `lengthUnit = pgEnum('length_unit', ['ft', 'yd'])`.
  - Shared columns: `id uuid pk`, `ownerId uuid not null → authUsers.id cascade`, `version integer not null`, `updatedAt timestamptz not null`, `deletedAt timestamptz`, `changeSeq bigint (mode number) not null default nextval('sync_change_seq')`.
  - Each table has the policy `<table>_select_own` (`(select auth.uid()) = owner_id`) and an index on `(owner_id, change_seq)`.
  - `canvases { …sync, name text, widthFt double, depthFt double, unit lengthUnit }`.
  - `matches { …sync, name text, date text }`. `date` is `''` or `YYYY-MM-DD`, as locally.
  - `plans { …sync, matchId uuid null, stageOrder integer null, sourceCanvasId uuid null, widthFt, depthFt, unit, schemaVersion integer not null, document jsonb not null }`.
  - There are no foreign keys between synced records, because records arrive in any order from offline devices.
  - The custom migration adds a `private.bump_change_seq()` `BEFORE UPDATE` trigger on each table, plus `revoke all on <table> from anon, authenticated`.
- [ ] **Step 1: Write the failing db tests:**
  - `it('stamps a rising change_seq on insert and on update')`;
  - `it('deletes a user's records with the user')`;
  - `it('keeps the tables out of the Data API')`: a signed-in user's `from('plans').select()` errors (permission denied), and so does the anon client.
- [ ] **Step 2: Run to verify failure.** Expected: FAIL.
- [ ] **Step 3: Implement** with `pnpm db:generate --name synced_records` and the custom migration, then run `pnpm db:reset`.
- [ ] **Step 4: Run** `pnpm test:db` and the advisors. Expected: PASS, no findings.
- [ ] **Step 5: Commit:** `feat(sync): add the synced tables with a change sequence`

---

### Task 3: Wire schemas

**Files:** Create `src/lib/sync/wire.ts`, `wire.test.ts`.

**Interfaces:**

- **Produces:**
  - `type SyncTable = 'canvases' | 'matches' | 'plans'`.
  - `WireRecordSchema`, a discriminated union on `table`.
    - `canvases` fields come from `CanvasInputSchema`.
    - `matches` fields come from `MatchInputSchema`.
    - `plans` fields: `matchId`, `stageOrder`, `sourceCanvasId`, `widthFt`, `depthFt`, `unit`, `schemaVersion: z.literal(1)`, `document: PlanDocumentSchema`.
    - Every kind has `id: z.uuid()`, `updatedAt: z.iso.datetime()` and `deletedAt: z.iso.datetime().nullable()`.
  - `ServerRecordSchema`: the same plus `version: z.int().min(1)`. Its plan variant is lenient: `schemaVersion: z.int().min(1)` and `document: z.unknown()`, so newer plans can be recognised and skipped.
  - `PushRequestSchema = z.object({ records: z.array(z.object({ record: WireRecordSchema, baseVersion: z.int().min(0) })).max(50) })`.
  - `PushResultSchema`, one of:
    - `{ status: 'accepted'; table; id; version }`;
    - `{ status: 'conflict'; table; id; server: ServerRecord }`;
    - `{ status: 'rejected'; table; id; reason: 'not-found' | 'invalid' }`.
  - `PullResponseSchema = { records: ServerRecord[], cursor: number, more: boolean }`.
  - `toWire(table, record): WireRecord` (drops `dirty` and `version`).
  - `fromServer(record: ServerRecord): CanvasRecord | MatchRecord | PlanRecord`, with `dirty: 0`. It throws for a plan whose `schemaVersion` isn't 1.
- [ ] **Step 1: Write the failing unit tests:**
  - round trip local → wire → server → local for each kind;
  - an invalid document is rejected;
  - 51 records are rejected;
  - a server plan with `schemaVersion: 2` parses as a `ServerRecord` but `fromServer` throws `'newer-schema'`.
- [ ] **Step 2–4:** Run (FAIL), implement, run (PASS).
- [ ] **Step 5: Commit:** `feat(sync): define the sync wire format`

---

### Task 4: Push and pull on the server

**Files:**

- Create:
  - `src/lib/server/sync.ts`, `sync.db.test.ts`
  - `src/routes/api/sync/push/+server.ts`, `src/routes/api/sync/pull/+server.ts`
  - `tests/e2e/sync-api.spec.ts`
- Modify: `src/lib/server/auth.ts`

**Interfaces:**

- **Consumes:** Task 2's tables and Task 3's schemas.
- **Produces:**
  - `requireApiUser(event): Promise<SignedInUser>`. It throws `error(401, 'Sign in first')` instead of redirecting.
  - `pushRecords(db, ownerId: string, items: PushRequest['records']): Promise<PushResult[]>`, following Decisions 1–2, in one transaction.
  - `pullChanges(db, ownerId: string, cursor: number, limit = 200): Promise<PullResponse>`. Deleted rows are included.
  - `POST /api/sync/push` validates the body with `PushRequestSchema`; a bad body gets 400 with the Zod issues. It returns `{ results }`.
  - `GET /api/sync/pull?cursor=<int>` (default 0) returns a `PullResponse`. Both routes send `cache-control: no-store`.
- [ ] **Step 1: Write the failing db tests:**
  - **Insert:** a new record comes back accepted, version 1.
  - **Update:** with the matching base version → version 2.
  - **Stale base:** → conflict carrying the server record.
  - **Another owner's id** (Review Focus #4) → rejected `not-found`. The row is unchanged.
  - **Order:** a pull returns the owner's records in `change_seq` order, deleted ones included, and never another owner's.
  - **Paging:** 250 records come back in two pages, and the second continues from the first's cursor.
  - **Racing pushes** (Review Focus #3): 20 concurrent single-record pushes for one owner, interleaved with pulls that each continue from their predecessor's cursor, together return all 20 records exactly once.
- [ ] **Step 2: Write the failing e2e** (`sync-api.spec.ts`): signed out, push and pull answer 401; a malformed push answers 400.
- [ ] **Step 3: Run to verify failure.** Expected: FAIL.
- [ ] **Step 4: Implement.**
- [ ] **Step 5: Run** the db tests, the e2e test, `pnpm check` and `pnpm lint`. Expected: PASS.
- [ ] **Step 6: Commit:** `feat(sync): accept pushes and serve pulls by change sequence`

---

### Task 5: The client sync engine

**Files:**

- Create:
  - `src/lib/sync/engine.ts`, `engine.test.ts`
  - `src/lib/sync/device.ts`, `device.test.ts`
- Modify: `src/lib/store/settings.ts` (the sync setting keys)

**Interfaces:**

- **Consumes:** Task 3's `toWire`/`fromServer` and the push/pull schemas.
- **Produces:**
  - `type Transport = { push(records: PushRequest['records']): Promise<PushResult[]>; pull(cursor: number): Promise<PullResponse> }`.
  - `type ConflictCopy = { table: SyncTable; id: string; name: string }`.
  - `syncOnce(db, transport, now = () => new Date()): Promise<{ pushed: number; pulled: number; conflicts: ConflictCopy[]; needsReload: boolean }>`:
    1. It pushes all dirty records in batches of 50 and applies results by Decision 3.
    2. Then it pulls until `more` is false and applies records by Decision 4.
    3. It stores the cursor in the `sync-cursor` setting and adds conflict copies to `sync-conflicts`.
  - `conflictName(name: string, at: Date): string` produces `"<name> (conflicted copy, Nov 22 3:04 PM)"` (en-US).
  - `device.ts`:
    - `adoptDevice(db, accountId): Promise<{ state: 'adopted' | 'same' | 'other-account'; added: { plans: number; canvases: number; matches: number } }>`;
    - `unsyncedCount(db): Promise<number>`;
    - `clearLocalData(db, storage: StorageLike): Promise<void>`;
    - `addedNotice(added): string | null` (the first-sign-in copy).
- [ ] **Step 1: Write the failing unit tests** (fake-indexeddb, with an in-memory transport that mimics the server):
  - a new plan is pushed and comes back clean with version 1;
  - **Review Focus #2:** a plan edited while its push is in flight stays dirty with the new version, and the next sync pushes the edit;
  - **conflict:** the server version replaces the local one, and a copy holds the local content with the conflicted name;
  - a conflicted canvas copy and a conflicted match copy are named likewise;
  - pull applies server records, skips dirty ones, and keeps a deleted record deleted;
  - a pulled `schemaVersion: 2` plan isn't written, sets `needsReload`, and the cursor still advances;
  - `adoptDevice` on a fresh device with 2 plans and 1 canvas returns `added` `{ plans: 2, canvases: 1, matches: 0 }`, and the notice reads "Added 2 plans and 1 canvas from this device to your account.";
  - `adoptDevice` with a different owner returns `'other-account'`;
  - `clearLocalData` empties the three tables, the `sync-*` settings and the journal keys, but keeps `theme` and `sounds`.
- [ ] **Step 2–4:** Run (FAIL), implement, run (PASS).
- [ ] **Step 5: Commit:** `feat(sync): push, pull and keep conflicted copies on the client`

---

### Task 6: The sync loop and its status

**Files:**

- Create:
  - `src/lib/sync/status.ts`, `status.test.ts`
  - `src/lib/sync/transport.ts`
  - `src/lib/sync/loop.svelte.ts`, `loop.test.ts`

**Interfaces:**

- **Produces:**
  - `syncLabel(s: { online: boolean; syncing: boolean; pending: number; conflicts: number; failed: boolean }): 'Synced' | 'Syncing…' | 'Changes pending' | 'Offline' | 'Conflict' | 'Sync failed'`. Precedence: Conflict > Offline > Syncing… > Sync failed > Changes pending > Synced.
  - `fetchTransport(fetchFn = fetch): Transport`. It calls the two endpoints and parses with the Task 3 schemas. A 401 throws `'signed-out'`.
  - `syncState`, a module `$state`: `{ online, syncing, pending, conflicts: ConflictCopy[], failed, needsReload, otherAccount, notice: string | null }`.
  - `startSync({ db, accountId, transport }): () => void`. It:
    1. runs `adoptDevice` first;
    2. sets the `notice` for an adoption;
    3. triggers by the Global Constraints timing;
    4. listens for local changes with Dexie table hooks, ignoring writes with `dirty: 0`;
    5. uses `navigator.locks` when present;
    6. counts `pending` after each local change and each sync;
    7. stops everything when the returned function is called.
  - `syncNow(): Promise<void>`.
- [ ] **Step 1: Write the failing unit tests:**
  - every precedence case of `syncLabel`;
  - the loop, with fake timers and a fake transport: a local plan edit triggers a sync after 2 s; two edits within 2 s cause one sync; an `online` event triggers a sync; a failed sync sets `failed` and the next interval retries; stopping cancels timers and hooks.
- [ ] **Step 2–4:** Run (FAIL), implement, run (PASS).
- [ ] **Step 5: Commit:** `feat(sync): run the sync loop on edits, a timer and reconnects`

---

### Task 7: Sync status, notices and syncing between devices

**Files:**

- Create:
  - `src/lib/sync/SyncStatus.svelte`, `ConflictDialog.svelte`, `ReloadBanner.svelte`
  - `src/routes/(app)/+layout.svelte`
  - `tests/e2e/sync.spec.ts`
- Modify:
  - `src/routes/(app)/+page.svelte` (status in the header, the first-sign-in notice)
  - `src/lib/editor/components/Toolbar.svelte` (status)
  - the home, match and editor pages, so they re-read when a pull changes the store

**Interfaces:**

- **Consumes:** `startSync`, `syncState`, `syncLabel` (Task 6), and `data.account` (layout).
- **Produces:**
  - `SyncStatus.svelte`: a compact pill with `data-testid="sync-status"` whose text is `syncLabel(...)`. In the "Conflict" state it is a button that opens `ConflictDialog`.
  - `ConflictDialog.svelte`: it lists the copies as links (plans → editor; matches → match page; canvases → home) and has "Dismiss".
  - `ReloadBanner.svelte`: it shows when `needsReload`; "Reload" calls `location.reload()`.
  - `(app)/+layout.svelte` starts the loop when `data.account.id` is set and stops it on destroy. It renders `ReloadBanner`, and the other-account message when `otherAccount` is set.
  - Pages refresh their lists through Dexie `liveQuery`, or by re-reading after `syncState` reports a pull.
- [ ] **Step 1: Write the failing e2e tests** (`sync.spec.ts`, using the fixture account):
  - **New plan:** the status shows "Changes pending" or "Syncing…", then "Synced".
  - **Second device:** a second context signed in as the same account shows the plan, with its stage name, on home.
  - **Editor:** an edit in the editor reaches the second context.
  - **Delete:** deleting the plan on one device removes it from the other.
  - **First sign-in:** seed IndexedDB on `/sign-in` (signed out) with one plan through `page.evaluate` (version 0, dirty 1), then sign in. Home shows "Added 1 plan from this device to your account.", and a second device sees the plan.
  - **Reload banner:** insert a plan row with `schema_version = 2` for the account directly in Postgres. Home shows the banner, and the row's plan isn't listed.
- [ ] **Step 2–4:** Run (FAIL), implement (Svelte files through the svelte-file-editor agent), and run the whole suite (PASS).
- [ ] **Step 5: Commit:** `feat(sync): show sync status and keep devices in step`

---

### Task 8: Conflicted copies end to end

**Files:** Create `tests/e2e/conflict.spec.ts`. Modify Task 7's components if the test finds gaps.

- [ ] **Step 1: Write the failing e2e test** (Review Focus #1):
  1. Devices A and B (same account) both have plan "Bay drill".
  2. A goes offline and renames it "Bay drill A".
  3. B renames it "Bay drill B" and syncs.
  4. A comes back online.

  Expected:
  - A's home lists "Bay drill B" and "Bay drill A (conflicted copy, …)".
  - The status reads "Conflict". Clicking it lists the copy, and "Dismiss" returns the status to "Synced".
  - B then receives the copy too.
- [ ] **Step 2–4:** Run (FAIL or PASS; if it passes without changes, check that it fails with the conflict branch of `syncOnce` disabled, then restore), fix gaps, and run the suite (PASS).
- [ ] **Step 5: Commit:** `test(sync): cover a plan edited on two devices`

---

### Task 9: Sign-out clears the device

**Files:**

- Create: `tests/e2e/sign-out.spec.ts`
- Modify: `src/routes/(app)/+page.svelte` (the sign-out flow), `src/lib/sync/loop.svelte.ts` (stop before clearing)

**Interfaces:**

- **Consumes:** `unsyncedCount`, `clearLocalData` (Task 5), `signOutDevice`, `clearStoredSession` (5a).
- [ ] **Step 1: Write the failing e2e tests:**
  - **Synced:** after creating a plan and waiting for "Synced", sign out. Then sign in as another fresh account on the same context: home lists no plans. Sign back in as the first account: the plan is back (pulled).
  - **Unsynced:** offline, create a plan, then sign out. The warning shows "1 change on this device hasn't synced. Signing out deletes them." Cancel keeps you signed in; "Sign out anyway" signs out.
  - The theme chosen before sign-out is still applied on the sign-in page.
- [ ] **Step 2–4:** Run (FAIL), implement Decision 7, and run the suite (PASS).
- [ ] **Step 5: Commit:** `feat(sync): clear the device on sign-out, warning about unsynced changes`

---

### Task 10: Service worker: the app opens offline

**Files:**

- Create: `src/service-worker/index.ts`, `src/service-worker/tsconfig.json`, `tests/e2e/offline-app.spec.ts`
- Modify: `tsconfig.json` (exclude `src/service-worker`)

**Interfaces:**

- **Produces:** a service worker following Decision 8. Cache name `match-sketch-<version>`. It deletes older caches on activate and calls `skipWaiting()` and `clients.claim()`.
- [ ] **Step 1: Write the failing e2e test** (Review Focus #5):
  1. Sign in (fixture), create a plan, and wait for "Synced" and for `navigator.serviceWorker.ready`.
  2. `context.setOffline(true)` and reload.

  Expected:
  - Home renders with the plan, and the status reads "Offline".
  - Open the plan, add a symbol, and go back: the status reads "Offline" with the change pending.
  - `context.setOffline(false)`: the status becomes "Synced", and a second device sees the new symbol (`[data-object]` count).
  - Assert the offline reload's navigation response came from the service worker (`response.fromServiceWorker()`).
- [ ] **Step 2–4:** Run (FAIL), implement, and run the whole suite (PASS). Check that the print route still works offline (the existing print/pdf specs).
- [ ] **Step 5: Commit:** `feat(sync): open the app offline with a service worker`

---

### Task 11: Docs and roadmap

**Files:** Modify `docs/operations.md` (sync and offline notes, cache versioning), `docs/superpowers/plans/ROADMAP.md`, spec §9 (record Decision 3's match-copy ruling).

- [ ] **Step 1:** Write it up: how sync works, the never-cached routes, and that a deploy bumps the service worker cache.
- [ ] **Step 2:** Mark Plan 5b done.
- [ ] **Step 3: Commit:** `docs(plans): mark Plan 5b done`
