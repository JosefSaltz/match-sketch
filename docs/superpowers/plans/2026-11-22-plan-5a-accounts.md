# Plan 5a: Accounts — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An invited MD can accept an email invite, set a password, sign in and use the app (offline once signed in), and the operator can invite MDs and see who has accepted, all running from a Docker image that Coolify deploys.

**Architecture:**

- **Supabase Auth, email + password only.** Public sign-up is off; accounts come from Supabase's built-in invite. Development and tests use the local stack (`supabase start`), never the hosted project.
- **The browser holds the session.** `@supabase/ssr`'s browser client stores it in cookies. App routes stay client-rendered and check the stored session without the network, so a signed-in device opens offline. The server reads the same cookies in `hooks.server.ts` and verifies them with `getClaims()`.
- **Authorization lives on the server.** Every server route checks the verified claims, and the admin check reads `profiles.role` through Drizzle (never JWT `user_metadata`). RLS on `profiles` is a backstop: a user can read only their own row and change nothing.
- **Drizzle owns the schema.** `drizzle-kit generate` writes SQL into `supabase/migrations` with Supabase timestamp prefixes, so `supabase db reset` (local) and `supabase db push --remote` (hosted) apply it. SQL that Drizzle can't express (trigger, grants) goes in custom migrations.
- **One image for Coolify.** `@sveltejs/adapter-node` builds a Node server. A multi-stage Dockerfile and a `docker-compose.yml` feed Coolify's Docker Compose build pack, with a `/health` route for its health check.

**Tech Stack:** SvelteKit 3.4, Svelte 5, TypeScript, `@supabase/supabase-js` 2.119, `@supabase/ssr` 0.12, `drizzle-orm` 0.45 + `drizzle-kit` 0.31 (stable, not the v1 RC), `postgres` (postgres-js) 3.x, Supabase CLI 3.2, `@sveltejs/adapter-node` 6, Vitest, Playwright, Mailpit (local email).

**Spec:** `docs/superpowers/specs/2026-11-21-match-sketch-design.md`:

- §6 (sign-in, invites, authorization, hosting on Coolify);
- §7.8 (`profiles`);
- §7.1 screens 1 (sign in / accept invite / set password) and 7 (admin);
- §3 (constraints), goal 1;
- §9 (local data and test database decisions, 2026-11-22).

Roadmap: `docs/superpowers/plans/ROADMAP.md`, Plan 5a.

## Global Constraints

- **SvelteKit 3 env:** variables are declared in `src/env.ts` with `defineEnvVars` from `@sveltejs/kit/env`, imported from `$app/env/public` and `$app/env/private`. Don't use `$env/*` (deprecated in SvelteKit 3).
  - `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`: `public: true, static: true` (inlined at build, so they work offline and need Coolify build args).
  - `SUPABASE_SECRET_KEY` and `DATABASE_URL`: private and read at runtime.
- **SvelteKit 3 APIs:**
  - `Handle` is imported from `@sveltejs/kit/hooks`.
  - `error(status, message: string)`.
  - `fail(status, data)` sets the real HTTP status.
  - Server-only code lives under a `server` path segment (`src/lib/server/…`).
- **Keys:** use the publishable key (`sb_publishable_…`) in the browser and the secret key (`sb_secret_…`) only in `src/lib/server/`. No legacy anon or service_role keys.
- **Sessions on the server:** verify them with `supabase.auth.getClaims()`. Never trust `getSession()` on the server, and never authorize from `user_metadata`.
- **Passwords:** at least 8 characters (`minimum_password_length = 8`).
- **Local ports:** Supabase defaults: API 54321, DB 54322, Mailpit 54324. The app's preview runs on 4173, which is the local `site_url`.
- **Copy** (used verbatim by tests):
  - Wrong credentials: "Wrong email or password."
  - Network down: "Can't reach the server. Check your connection."
  - Bad invite link: "This invite link has expired or was already used. Ask for a new invite."
  - Admin page for non-admins: "Admins only".
  - Duplicate invite: "That email already has an account."
- **UI** reuses `Button`, `Field`, `PanelHeader` and the theme. Every `.svelte` file passes the Svelte MCP autofixer.
- **Commits** are atomic and Angular style. Dependency changes are committed on their own.

## Decisions

1. **Invite acceptance runs in the browser.** The invite email links to `{{ .SiteURL }}/accept-invite?token_hash={{ .TokenHash }}&type=invite`. The page verifies only when the user clicks "Accept invite", so a mail scanner's prefetch can't use up the one-time link. Then it shows the set-password form. Invites can't use PKCE (the inviter's and invitee's browsers differ), so there is no `/auth/confirm` code exchange.
2. **Offline gate rule:** the app routes allow entry if `getSession()` returns a session, **or** if it fails with a retryable fetch error. The second case is a stored session the client couldn't refresh offline, and the spec trusts it. Anything else sends the user to `/sign-in?next=<path>`.
3. **The whole app is client-rendered:** `ssr = false` in the root `+layout.ts`, where the theme loading moves to. Server code is limited to `hooks.server.ts`, `/health`, and the admin page's `+page.server.ts`.
4. **The admin link** shows in the home header when the signed-in user's own profile says `admin`. The client reads it through the Data API, which RLS limits to the user's own row. Offline the link is hidden.
5. **First admin:** run `pnpm users:promote <email>` locally. On hosted, run one SQL statement (in `docs/operations.md`). There is no UI to change roles in 5a.
6. **Sign-out** (`signOut({ scope: 'local' })`) signs out this device only and keeps local data. Plan 5b adds clearing.
7. **Coolify:** `docker-compose.yml` has one `app` service. The service:
   - builds the Dockerfile, with `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` as build args;
   - declares `SERVICE_FQDN_APP_3000` so the proxy routes to port 3000;
   - requires `ORIGIN`, `SUPABASE_SECRET_KEY` and `DATABASE_URL` at runtime (`${VAR:?}`);
   - checks health with `wget` against `/health`.

   `DATABASE_URL` on hosted is the session pooler (port 5432, IPv4).

## Review Focus

1. **Open redirect through `?next=`:**
   - `//evil.example`, `https://evil.example`, `/\evil.example` and `/sign-in` all land on `/`.
   - Only same-origin paths survive.
   - → Task 3 (unit).
2. **Offline with an expired access token:** the gate must not bounce a signed-in user to sign-in when the refresh fails with a network error. → Task 3 (unit, `AuthRetryableFetchError`).
3. **A non-admin posting the invite action directly** (`POST /admin?/invite`) gets 403 and no email is sent. → Task 5 (e2e via `request.post` + Mailpit).
4. **A user rewriting their own role** through the Data API (`update profiles set role = 'admin'`) changes nothing. → Task 2 (db test).
5. **An invite link opened a second time or after expiry** shows the bad-link copy instead of a blank page or a half-signed-in state. → Task 4 (e2e).

---

## File Structure

```
supabase/config.toml                  local stack: invite-only auth, Mailpit, site_url
supabase/templates/invite.html        invite email → /accept-invite?token_hash…
supabase/migrations/*.sql             drizzle-kit output + custom SQL (trigger, grants)
drizzle.config.ts
.env.example                          the four variables, documented
src/env.ts                            defineEnvVars
src/hooks.server.ts                   per-request Supabase server client → locals.supabase
src/app.d.ts                          App.Locals
src/lib/auth/client.ts                browser Supabase client (singleton)
src/lib/auth/session.ts               sessionState(), safeNext() (pure)
src/lib/auth/password.ts              checkNewPassword() (pure)
src/lib/server/db/schema.ts           profiles (+ RLS policy)
src/lib/server/db/client.ts           createDatabase(url)
src/lib/server/db/index.ts            serverDb() from env
src/lib/server/profiles.ts            getProfile, listProfiles, setRole
src/lib/server/supabase-admin.ts      adminClient() (secret key)
src/lib/server/auth.ts                requireUser, requireAdmin
src/lib/server/users.ts               listUsers, inviteUser, inviteErrorMessage
src/routes/+layout.ts                 ssr = false; theme + sounds (moved)
src/routes/(app)/+layout.ts           session gate
src/routes/sign-in/+page.svelte
src/routes/accept-invite/+page.svelte
src/routes/admin/+page.server.ts, +page.svelte
src/routes/health/+server.ts
scripts/users.ts                      ensureUser / promote (dev + tests)
tests/e2e/global-setup.ts, auth.setup.ts, support/mailpit.ts
tests/e2e/auth.spec.ts, invite.spec.ts, admin.spec.ts, health.spec.ts
Dockerfile, .dockerignore, docker-compose.yml
docs/operations.md                    env vars, Coolify setup, hosted rollout
```

---

### Task 1: Local Supabase stack, env and dependencies

**Files:**

- Create:
  - `supabase/config.toml` (via `supabase init`), `supabase/templates/invite.html`
  - `src/env.ts`, `.env.example`
  - `src/lib/server/auth-config.db.test.ts`
- Modify: `package.json`, `vite.config.ts` (a `db` Vitest project), `.gitignore`

**Interfaces:**

- **Produces:**
  - `src/env.ts` exports `variables` with these four entries:
    - `SUPABASE_URL` (public, static, `z.url()`);
    - `SUPABASE_PUBLISHABLE_KEY` (public, static, `z.string().min(1)`);
    - `SUPABASE_SECRET_KEY` (private, `z.string().min(1)`);
    - `DATABASE_URL` (private, `z.url()`).
  - Scripts:
    - `db:start` (`supabase start`) and `db:stop`;
    - `db:reset` (`supabase db reset`);
    - `db:env`, which writes `.env` from `supabase status -o env`, renaming with `--override-name` to the four names above plus `MAILPIT_URL`;
    - `test:db` (`vitest --run --project db`).
  - Vitest project `db`: it includes `src/**/*.db.test.ts`, which the `server` project excludes, and loads `.env` into `process.env` with Vite's `loadEnv(mode, cwd, '')`.
- [ ] **Step 1: Add dependencies** on their own:
  - `pnpm add @supabase/supabase-js @supabase/ssr drizzle-orm postgres`;
  - `pnpm add -D drizzle-kit`.

  Commit: `build(deps): add supabase-js, @supabase/ssr, drizzle and postgres`.
- [ ] **Step 2: `supabase init`, then set `config.toml`:**
  - `[auth]`:
    - `site_url = "http://localhost:4173"`;
    - `additional_redirect_urls = ["http://localhost:4173/**", "http://localhost:5173/**"]`;
    - `enable_signup = false`;
    - `minimum_password_length = 8`.
  - `[auth.email] enable_confirmations = false`. Don't touch `[auth.email] enabled`; `false` would block password sign-in.
  - `[auth.email.template.invite]`:
    - `subject = "You're invited to Match Sketch"`;
    - `content_path = "./supabase/templates/invite.html"`.

    The template holds one link, `{{ .SiteURL }}/accept-invite?token_hash={{ .TokenHash }}&type=invite`, with the text "Accept invite".
  - `[local_smtp]` stays at its defaults.

  Then run `pnpm db:start` and `pnpm db:env`. Use the field keys that `supabase status --help` lists for `--override-name`. `.env` is already git-ignored. `.env.example` lists the variables with comments and local example values.
- [ ] **Step 3: Write the failing db tests** in `auth-config.db.test.ts`:
  - `it('refuses public sign-up')`: `createClient(url, publishable).auth.signUp({ email: unique(), password: 'longenough1' })` returns an error.
  - `it('still lets the server create users')`: `adminClient.auth.admin.createUser({ email, password, email_confirm: true })` succeeds. Delete the user afterwards.
- [ ] **Step 4: Run** `pnpm test:db`. Expected: the sign-up test passes only after `enable_signup = false` is applied (`supabase stop && supabase start` reloads config). Fix the config until both pass.
- [ ] **Step 5: Run** `pnpm test:unit --run`, `pnpm check` and `pnpm lint`. Expected: PASS. `src/env.ts` loads, and nothing imports it yet.
- [ ] **Step 6: Commit:** `feat(auth): run a local Supabase with invite-only email sign-in`

---

### Task 2: Profiles: schema, new-user trigger, RLS

**Files:**

- Create:
  - `drizzle.config.ts`
  - `src/lib/server/db/schema.ts`, `client.ts`, `index.ts`
  - `src/lib/server/profiles.ts`
  - `supabase/migrations/<ts>_profiles.sql` (generated), `<ts>_profile_for_new_users.sql` (custom)
  - `scripts/users.ts`
  - `src/lib/server/profiles.db.test.ts`
- Modify: `package.json` (`db:generate`, `users:promote`)

**Interfaces:**

- **Consumes:** Task 1's env and stack.
- **Produces:**
  - `schema.ts`:
    - `profileRole = pgEnum('profile_role', ['md', 'admin'])`;
    - `profiles = pgTable('profiles', { id: uuid().primaryKey().references(() => authUsers.id, { onDelete: 'cascade' }), displayName: text('display_name').notNull().default(''), role: profileRole().notNull().default('md'), createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow() }, (t) => [pgPolicy('profiles_select_own', { for: 'select', to: authenticatedRole, using: sql\`(select auth.uid()) = ${t.id}\` })])`;
    - `type Profile = typeof profiles.$inferSelect`.
  - `client.ts`: `createDatabase(url: string) → { db: PostgresJsDatabase<typeof schema>; close(): Promise<void> }`. It uses postgres-js with `{ max: 10 }`.
  - `index.ts`: `serverDb()`, a lazy singleton from `DATABASE_URL` (`$app/env/private`).
  - `profiles.ts`:
    - `getProfile(db, id: string): Promise<Profile | null>`;
    - `listProfiles(db): Promise<Profile[]>`;
    - `setRole(db, id: string, role: 'md' | 'admin'): Promise<void>`.
  - `scripts/users.ts`, run with Node's type stripping, reading `process.env`:
    - `ensureUser({ email, password, role, displayName? }): Promise<string>` creates or updates the user through the admin API and sets the role. It returns the id.
    - CLI: `node --env-file=.env scripts/users.ts promote <email>`.
  - `drizzle.config.ts`: `{ dialect: 'postgresql', schema: './src/lib/server/db/schema.ts', out: './supabase/migrations', migrations: { prefix: 'supabase' }, dbCredentials: { url: process.env.DATABASE_URL }, schemaFilter: ['public'] }`.
- [ ] **Step 1: Write the failing db tests** in `profiles.db.test.ts`:
  - `it('gives a new user an md profile named from the invite')`: `createUser` with `user_metadata: { display_name: 'Pat' }` → `getProfile` → `{ role: 'md', displayName: 'Pat' }`.
  - `it('names the profile from the email when no name is given')`: `range.officer@x.test` → `'range.officer'`.
  - `it('deletes the profile with the user')`.
  - `it('lets a signed-in user read only their own profile')`: users A and B. A's publishable client after `signInWithPassword`, then `from('profiles').select('id')` returns exactly A's id. The anon client gets `[]`.
  - `it('ignores a user rewriting their own role (Review Focus #4)')`: A's client runs `from('profiles').update({ role: 'admin' }).eq('id', A)`. `getProfile` still says `'md'`.
- [ ] **Step 2: Run** `pnpm test:db`. Expected: FAIL (no table).
- [ ] **Step 3: Implement** the schema and run `pnpm db:generate --name profiles`. Then write the custom migration: `pnpm drizzle-kit generate --custom --name profile_for_new_users`.
  - It creates schema `private` and `private.handle_new_user()`:
    - `security definer set search_path = ''`;
    - inserts `public.profiles (id, display_name)` with `coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(new.email, '@', 1))`.
  - It creates `trigger on_auth_user_created after insert on auth.users`.
  - It runs `revoke execute on function private.handle_new_user() from public, anon, authenticated`.
  - It sets the grants: `revoke all on public.profiles from anon, authenticated; grant select on public.profiles to authenticated`.

  Run `pnpm db:reset`.
- [ ] **Step 4: Run** `pnpm test:db`. Expected: PASS. Then run `supabase db advisors --type security --fail-on warn`. Expected: no findings for `profiles` or `handle_new_user`.
- [ ] **Step 5: Run** `pnpm test:unit --run`, `pnpm check` and `pnpm lint`. Expected: PASS.
- [ ] **Step 6: Commit:** `feat(auth): give every new user a profile with a role`

---

### Task 3: Sign-in, the session gate and sign-out

**Files:**

- Create:
  - `src/hooks.server.ts`
  - `src/lib/auth/client.ts`, `session.ts`, `session.test.ts`
  - `src/routes/+layout.ts`
  - `src/routes/sign-in/+page.svelte`
  - `tests/e2e/global-setup.ts`, `tests/e2e/auth.setup.ts`, `tests/e2e/auth.spec.ts`
- Modify:
  - `src/app.d.ts` (`Locals { supabase: SupabaseClient }`)
  - `src/routes/(app)/+layout.ts` (theme loading moves out; the gate goes in)
  - `src/routes/(app)/+page.svelte` (header: the account's email and "Sign out")
  - `playwright.config.ts`, `.gitignore` (`tests/e2e/.auth/`)

**Interfaces:**

- **Consumes:** Task 1's env, and Task 2's `ensureUser` (global setup).
- **Produces:**
  - `getSupabase(): SupabaseClient`, a browser singleton from `createBrowserClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)`.
  - `sessionState(result: { session: Session | null; error: AuthError | null }): 'signed-in' | 'signed-out'`, following Decision 2. It uses `isAuthRetryableFetchError`.
  - `safeNext(next: string | null | undefined): string` returns a same-origin path, else `'/'`. `/sign-in…` maps to `'/'`.
  - `hooks.server.ts` sets `event.locals.supabase` with `createServerClient`:
    - its `setAll` sets cookies with `path: '/'` and applies the `headers` argument through `event.setHeaders`;
    - `filterSerializedResponseHeaders` lets through `content-range` and `x-supabase-api-version`.
  - `(app)/+layout.ts` load returns `{ account: { email: string | null } }`, or redirects (307) to `/sign-in?next=<path+search>`.
  - Playwright:
    - `globalSetup` checks `${SUPABASE_URL}/auth/v1/health` and fails with "Start the local stack: pnpm db:start && pnpm db:env" if it's down.
    - It creates `md@match-sketch.test` and `admin@match-sketch.test` (password `test-password-1`, roles md and admin).
    - A `setup` project signs in as the MD through the UI and saves `tests/e2e/.auth/md.json`. Every existing project uses it as `storageState`.
- [ ] **Step 1: Write the failing unit tests** in `session.test.ts`:
  - `sessionState`: a session → signed-in; `{ session: null, error: null }` → signed-out; `{ session: null, error: new AuthRetryableFetchError('offline', 0) }` → signed-in (Review Focus #2); an `AuthApiError` (refresh token revoked) → signed-out.
  - `safeNext`: `'/plans/abc?x=1'` stays; `null`, `''`, `'//evil.example'`, `'https://evil.example'`, `'/\\evil.example'`, `'javascript:alert(1)'`, `'/sign-in?next=/'` → `'/'` (Review Focus #1).
- [ ] **Step 2: Write the failing e2e tests** in `auth.spec.ts`. These run without stored state: `test.use({ storageState: { cookies: [], origins: [] } })`.
  - Visiting `/plans/new` signed out lands on `/sign-in?next=%2Fplans%2Fnew`.
  - A wrong password shows "Wrong email or password.".
  - The right password returns to `/plans/new`.
  - "Sign out" on home returns to `/sign-in`, and `/` then redirects there again.
  - `/sign-in?next=//evil.example` signs in to `/`.
- [ ] **Step 3: Run to verify failure:** `pnpm vitest run src/lib/auth` and `pnpm exec playwright test auth`. Expected: FAIL.
- [ ] **Step 4: Implement.** Steps:
  1. Move the theme and sounds loading, and `ssr = false`, to `src/routes/+layout.ts`.
  2. Add the gate to `(app)/+layout.ts`.
  3. Build the sign-in page: Email, Password, a "Sign in" button and the error line. Map `invalid_credentials` to the wrong-credentials copy and fetch errors to the network copy.
  4. Wire "Sign out" to `signOut({ scope: 'local' })`, then `goto('/sign-in')`.
  5. Update the Playwright config: `globalSetup`, the `setup` project, and `dependencies: ['setup']` with `storageState` on the main project.
- [ ] **Step 5: Run** the unit tests, the **whole** e2e suite (every existing spec now runs signed in), the autofixer, `pnpm check` and `pnpm lint`. Expected: PASS.
- [ ] **Step 6: Commit:** `feat(auth): require sign-in for the app and add sign-out`

---

### Task 4: Accept an invite and set a password

**Files:**

- Create:
  - `src/routes/accept-invite/+page.svelte`
  - `src/lib/auth/password.ts`, `password.test.ts`
  - `tests/e2e/support/mailpit.ts`, `tests/e2e/invite.spec.ts`

**Interfaces:**

- **Consumes:** `getSupabase()` (Task 3), and the Task 1 template's link shape.
- **Produces:**
  - `checkNewPassword(password: string, confirm: string): string | null`. It returns "Use at least 8 characters." or "The passwords don't match.", else `null`.
  - `mailpit.ts`: `inviteLinkFor(address: string, timeoutMs = 10_000): Promise<string>`. It polls `${MAILPIT_URL}/api/v1/search?query=to:"<address>"`, reads the newest message's HTML through `/api/v1/message/<ID>`, and returns the `/accept-invite…` href.
  - The `/accept-invite` page:
    - **Step "accept":** the heading "Accept your invite" and an "Accept invite" button that calls `verifyOtp({ token_hash, type: 'invite' })`. A missing `token_hash` or a verify error shows the bad-link copy and a "Sign in" link.
    - **Step "password":** "New password", "Confirm password" and "Set password", which calls `updateUser({ password })`, then `goto('/')`.
- [ ] **Step 1: Write the failing tests:**
  - **Unit:** `checkNewPassword` for short, mismatched and good input.
  - **e2e, invite to home:** a test-side admin client invites `invitee-<uuid>@match-sketch.test`. `inviteLinkFor` returns the link. The user opens it, clicks "Accept invite", sets `long-password-1` twice and lands on home (`heading Match Sketch`). They sign out, sign in with the new password, and are home again.
  - **e2e, bad link (Review Focus #5):** opening the same link again in a fresh context and clicking "Accept invite" shows the bad-link copy, as does `/accept-invite?token_hash=nope&type=invite`.
  - **e2e, short password:** shows "Use at least 8 characters." and stays on the page.
- [ ] **Step 2: Run to verify failure.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the unit tests, the e2e suite, the autofixer, `pnpm check` and `pnpm lint`. Expected: PASS.
- [ ] **Step 5: Commit:** `feat(auth): accept an invite and set a password`

---

### Task 5: Admin page: invite MDs, list users

**Files:**

- Create:
  - `src/lib/server/supabase-admin.ts`, `src/lib/server/auth.ts`
  - `src/lib/server/users.ts`, `users.test.ts`, `users.db.test.ts`
  - `src/routes/admin/+page.server.ts`, `+page.svelte`
  - `tests/e2e/admin.spec.ts`
- Modify: `src/routes/(app)/+page.svelte` (an "Admin" link for admins)

**Interfaces:**

- **Consumes:** `serverDb()` and `getProfile`/`listProfiles` (Task 2), `locals.supabase` (Task 3), `getSupabase()` (home link).
- **Produces:**
  - `adminClient()`: a lazy server-only client from the secret key, with `auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }`.
  - `requireUser(event): Promise<{ id: string; email: string }>`. It reads `getClaims()`. With no valid claims it calls `redirect(303, '/sign-in?next=' + path)`.
  - `requireAdmin(event): Promise<{ id: string; email: string }>`. It calls `requireUser`, then `getProfile`, and a role other than `admin` gives `error(403, 'Admins only')`.
  - `InviteInputSchema = z.object({ email: z.email().max(254), displayName: z.string().trim().max(80) })`.
  - `type UserRow = { id; email; displayName; role: 'md' | 'admin'; status: 'invited' | 'active'; invitedAt: string | null; lastSignInAt: string | null }`.
  - `listUsers(admin, db): Promise<UserRow[]>` merges `auth.admin.listUsers({ perPage: 1000 })` with profiles. Status is `active` when `last_sign_in_at` is set. It sorts by email.
  - `inviteErrorMessage(error: { code?: string; message: string }): string`. `email_exists` maps to the duplicate-invite copy. `over_email_send_rate_limit` maps to "Too many invite emails were sent. Try again in an hour." Anything else maps to "Couldn't send the invite: <message>".
  - `/admin`:
    - The load returns `{ users: UserRow[] }`.
    - Action `invite` validates the form, calls `inviteUserByEmail(email, { data: { display_name } })` and returns `{ invited: email }`. A failure returns `fail(400, { email, error })`.
    - The page has a "Invite an MD" panel (Email, Name (optional), "Send invite") with a success line "Invite sent to <email>." and a "Users" table (Email, Name, Role, Status). Status reads "Invited <date>" or "Active".
  - Home: an "Admin" link when `getSupabase().from('profiles').select('role').eq('id', <uid>).maybeSingle()` returns `admin`.
- [ ] **Step 1: Write the failing tests:**
  - **Unit:** `inviteErrorMessage` for the three cases, and `InviteInputSchema` rejecting `not-an-email`.
  - **db:** `listUsers` marks a created-but-never-signed-in user `invited` and a signed-in one `active`, and carries the role.
  - **e2e:**
    - The admin signs in (UI) → home shows "Admin" → `/admin` → invites `new-<uuid>@match-sketch.test` → "Invite sent to …" → the table shows them as Invited, and Mailpit has the email.
    - Inviting `md@match-sketch.test` shows "That email already has an account.".
    - The MD's home has no "Admin" link, and their `/admin` shows "Admins only".
    - Review Focus #3: the MD's `request.post('/admin?/invite', { form: { email: 'sneaky-<uuid>@…', displayName: '' } })` returns 403, and Mailpit has nothing for that address after 2 s.
    - Signed out, `/admin` lands on `/sign-in?next=%2Fadmin`.
- [ ] **Step 2: Run to verify failure.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the unit, db and e2e tests, the autofixer, `pnpm check` and `pnpm lint`. Expected: PASS.
- [ ] **Step 5: Commit:** `feat(admin): invite MDs and list users`

---

### Task 6: Docker image for Coolify, with a health check

**Files:**

- Create:
  - `src/routes/health/+server.ts`, `tests/e2e/health.spec.ts`
  - `Dockerfile`, `.dockerignore`, `docker-compose.yml`
  - `docs/operations.md`
- Modify: `vite.config.ts` (adapter), `package.json`

**Interfaces:**

- **Produces:**
  - `GET /health` returns `200 text/plain "ok"` with no session needed.
  - The image:
    - is built from `node:26-alpine`, with pnpm copied from `ghcr.io/pnpm/pnpm:12-alpine` (`/opt/pnpm`; Node 26 ships no corepack);
    - installs with `pnpm install --frozen-lockfile` (`pnpm-workspace.yaml` copied first);
    - takes `ARG SUPABASE_URL` and `ARG SUPABASE_PUBLISHABLE_KEY` for `pnpm build`;
    - in the final stage runs `node build` on port 3000 as the `node` user, with prod `node_modules` only.
  - `docker-compose.yml` follows Decision 7. The healthcheck runs `wget -qO- http://127.0.0.1:3000/health` every 30 s, with a 5 s timeout and 3 retries. No `ports:`.
  - `docs/operations.md` covers:
    - the env var table (name, build or runtime, where it comes from);
    - Coolify setup (Compose build pack, compose location `/docker-compose.yml`, domain with `:3000`, `ORIGIN` = the public URL);
    - the hosted rollout checklist (Task 7);
    - promoting the first admin.
- [ ] **Step 1: Write the failing e2e test:** `health.spec.ts` (signed out): `request.get('/health')` returns 200 with the body `ok`.
- [ ] **Step 2: Run to verify failure.** Expected: FAIL (404 behind the gate, or no route).
- [ ] **Step 3: Implement.**
  1. Swap `adapter-auto` for `@sveltejs/adapter-node`. Its own commit: `build(deps): switch to the Node adapter`.
  2. Add the route, the Dockerfile, `.dockerignore` (`node_modules`, `.git`, `build`, `.svelte-kit`, `test-results`, `tools/patterns/.venv`, `.env`), the compose file and the doc.
- [ ] **Step 4: Verify the image:**
  1. `docker compose build` (args from `.env`).
  2. `docker compose run -d --name ms-smoke -e ORIGIN=http://localhost:3000 app`, then `docker exec ms-smoke wget -qO- http://127.0.0.1:3000/health`. Expected: `ok`.
  3. `docker inspect --format '{{.State.Health.Status}}' ms-smoke` becomes `healthy`.
  4. Remove the container.
- [ ] **Step 5: Run** the whole suite, `pnpm check` and `pnpm lint`. Expected: PASS.
- [ ] **Step 6: Commit:** `feat(deploy): build a Docker image for Coolify with a health check`

---

### Task 7: Hosted rollout checklist and roadmap

**Files:** Modify `docs/operations.md`, `docs/superpowers/plans/ROADMAP.md`.

This task writes down the steps; it does not run them. Running them changes the hosted project and needs the user's secrets and dashboard, so it is a user checkpoint.

- [ ] **Step 1: Write the rollout checklist** in `docs/operations.md`:
  1. `supabase link --project-ref zmuadxeutafbnnfopqqx`, then `supabase db push --remote` (it asks for confirmation; pass `--yes` only when you mean it). Check with the MCP `list_tables` and `get_advisors`.
  2. Auth settings in the dashboard:
     - Sign-ups off.
     - Site URL = the Coolify domain, also added to the redirect URLs.
     - Minimum password length 8.
     - The invite template from `supabase/templates/invite.html`.
  3. **Custom SMTP** (e.g. Resend). The built-in sender only delivers to the Supabase organization's team members, so MDs never receive invites without it.
  4. Coolify env vars:
     - `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` (build and runtime);
     - `SUPABASE_SECRET_KEY` and `DATABASE_URL` (the session pooler, port 5432; runtime);
     - `ORIGIN`.
  5. The first admin: invite yourself from the dashboard (team members get the built-in email), accept, then run `update public.profiles set role = 'admin' where id = (select id from auth.users where email = '<you>');`.
  6. Optional: leaked-password protection (the security advisor flags it as off).
- [ ] **Step 2: Mark Plan 5a done** in the roadmap table.
- [ ] **Step 3: Commit:** `docs(plans): mark Plan 5a done and add the hosted rollout`
