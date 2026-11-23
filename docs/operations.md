# Operations

How to run Match Sketch locally and how it is deployed.

## Local development

Development and tests use the local Supabase stack in Docker. They never touch the hosted project.

```sh
pnpm db:start        # start the local stack (Postgres, Auth, Mailpit, Studio)
pnpm db:reset        # re-create the local database from supabase/migrations
pnpm dev             # the app on http://localhost:5173
pnpm test:unit       # unit tests (no stack needed)
pnpm test:db         # database tests against the local stack
pnpm test:e2e        # Playwright, against a production build on http://localhost:4173
```

- `scripts/local-env.ts` runs `dev`, `test:db` and `test:e2e` with the stack's URLs and keys, so you don't need a `.env` file. Those values override a `.env` file; only variables already exported in your shell beat them.
- Tests refuse to run unless `SUPABASE_URL` and `DATABASE_URL` point at this machine. The test accounts have known passwords and must never reach the hosted project.
- Invite emails land in Mailpit at http://127.0.0.1:54324. Studio is at http://127.0.0.1:54323.
- `pnpm users:promote <email>` makes a local user an admin.

### Schema changes

The schema lives in `src/lib/server/db/schema.ts`.

1. Run `pnpm db:generate --name <change>`. Drizzle writes the SQL into `supabase/migrations` with Supabase timestamp names.
2. For SQL that Drizzle can't express (functions, triggers, grants), run `pnpm exec drizzle-kit generate --custom --name <change>` and write the SQL there.
3. Run `pnpm db:reset`.
4. Run `supabase db advisors --type security --fail-on warn`.

Don't use the Supabase MCP `apply_migration` tool for schema changes. It records migrations the repository doesn't have.

## Sync and offline

- **The device is the source of truth for the UI.** Pages read and write IndexedDB only. The sync loop (`src/lib/sync/`) pushes changed records to `POST /api/sync/push` and pulls changes from `GET /api/sync/pull?cursor=`.
- **When it syncs:** 2 s after edits settle, every 30 s, on reconnect, and when the tab becomes visible. Only one tab syncs at a time (Web Locks).
- **Conflicts:** if another device changed a record first, the server keeps its version and this device saves its own as "<name> (conflicted copy, <date>)". Nothing is merged.
- **Change sequence:** every write to `canvases`, `matches` and `plans` takes the next value from `sync_change_seq`. Pulls follow that cursor. A per-owner advisory lock keeps an owner's writes in order.
- **Offline:** the service worker (`src/service-worker/index.ts`) precaches the built app and `static/`, plus an app shell.
  - Each deploy gets a new cache (keyed on the build version), so a deploy is picked up on the next full page load.
  - `/api/*`, `/admin`, `/health` and `__data.json` are never cached.
- **Sign-out** clears the device's plans, canvases, matches and sync settings, warning first about unsynced changes. Theme and sounds stay.
- **A plan saved by a newer app** isn't applied on an older one. The older app shows a banner asking for a reload.

## Draft from text

- **What it is:** the editor's "Draft from text" asks Claude Opus 5.5 (through `POST /api/drafts`) to lay out the stage from its description.
- **Feature flag:** it is off unless `FEATURE_DRAFT_FROM_TEXT=true` at build time. While off, the editor has no Draft button, the admin page shows no model spend, and `POST /api/drafts` answers 404. Turning it on or off needs a rebuild (a Coolify redeploy). Locally, `scripts/local-env.ts` turns it on; run `FEATURE_DRAFT_FROM_TEXT=false pnpm dev` to see the app without it.
- **Logging:** every request is a row in `ai_drafts`, holding the tokens, the estimated cost, the status, and the request and response.
- **Limits:**
  - one running draft per user;
  - five drafts running across the site;
  - `DRAFT_DAILY_CAP` drafts per user per UTC day;
  - drafting pauses for everyone once the day's estimated spend reaches `DRAFT_DAILY_SPEND_USD`. A running draft counts at its worst case ($0.80) until it finishes.
- **The admin page** shows today's spend against the ceiling.
- **The eval** (`tools/draft-eval/README.md`) grades drafts of the seven reference stages. It costs money, so run it only on purpose: `RUN_DRAFT_EVAL=1 ANTHROPIC_API_KEY=… pnpm eval:draft`.

## Environment variables

| Variable                   | Used                   | Where it comes from                                                                          |
| -------------------------- | ---------------------- | -------------------------------------------------------------------------------------------- |
| `SUPABASE_URL`             | build (inlined)        | Supabase dashboard → Project Settings → API (`https://<ref>.supabase.co`)                    |
| `SUPABASE_PUBLISHABLE_KEY` | build (inlined)        | Supabase dashboard → API Keys → publishable key (`sb_publishable_…`)                         |
| `FEATURE_DRAFT_FROM_TEXT`  | build (inlined)        | Feature flag: `true` turns on Draft from text. Default off.                                  |
| `SUPABASE_SECRET_KEY`      | runtime (server only)  | Supabase dashboard → API Keys → secret key (`sb_secret_…`). Bypasses RLS, so keep it secret. |
| `DATABASE_URL`             | runtime (server only)  | Supabase dashboard → Connect → **Session pooler** (port 5432, IPv4), with the DB password    |
| `ORIGIN`                   | runtime (adapter-node) | The app's public URL, e.g. `https://sketch.example.com` (no trailing slash)                  |
| `ANTHROPIC_API_KEY`        | runtime (server only)  | Claude Console → API keys. Optional: without it, Draft from text says it isn't set up.       |
| `DRAFT_DAILY_CAP`          | runtime (optional)     | Drafts per user per UTC day; default 20                                                      |
| `DRAFT_DAILY_SPEND_USD`    | runtime (optional)     | Estimated model spend per UTC day, site-wide, before drafting pauses; default 10             |

The public variables are inlined into the bundle so the app opens offline. Changing them needs a rebuild.

## Coolify

The app deploys as one Docker image built from `Dockerfile`, through `docker-compose.yml`.

1. **New resource:** pick the GitHub repository, then **Build pack: Docker Compose**, with compose file location `/docker-compose.yml`.
2. **Domain:** set the `app` service's domain to the public URL with the container port, e.g. `https://sketch.example.com:3000`. The port tells the proxy where to route; visitors still use 443.
3. **Environment variables:**
   - Set every variable in the table above.
   - Mark `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` and `FEATURE_DRAFT_FROM_TEXT` as **build** variables (they are build args).
   - The rest are runtime variables.
   - Set `ORIGIN` to the same public URL as the domain, without the `:3000`.
4. **Health:** the compose health check calls `GET /health` (`ok`). Coolify takes an unhealthy container out of routing.
5. **Deploy.** Pushing to the connected branch redeploys if auto-deploy is on.

Run `node scripts/local-env.ts docker compose build` to check the image locally.

## Hosted rollout (Supabase project `zmuadxeutafbnnfopqqx`)

These steps change the hosted project, so the operator runs them (or approves each one).

1. **Migrations:**
   - Run `supabase link --project-ref zmuadxeutafbnnfopqqx`, then `supabase db push --remote`. CLI v3 asks before it changes a hosted project; pass `--yes` only when you mean it.
   - Check the result with the Supabase MCP: `list_tables` shows `public.profiles` with RLS on, and `get_advisors` (security) shows nothing new.
2. **Auth settings** (dashboard → Authentication):
   - **Sign-ups off:** Sign In / Providers → "Allow new users to sign up" disabled. Email provider stays enabled.
   - **URL Configuration:** Site URL = the app's public URL. Add `https://<domain>/**` to the redirect URLs.
   - **Passwords:** minimum length 8.
   - **Emails → Invite user:** subject "You're invited to Match Sketch", body from `supabase/templates/invite.html`. The link must stay `{{ .SiteURL }}/set-password?token_hash={{ .TokenHash }}&type=invite`.
   - **Emails → Reset password:** subject "Reset your Match Sketch password", body from `supabase/templates/recovery.html`. The link must stay `{{ .SiteURL }}/set-password?token_hash={{ .TokenHash }}&type=recovery`. MDs reset their own passwords from "Forgot your password?" on the sign-in page; that is also the way back in for an invitee whose link expired.
3. **Custom SMTP** (dashboard → Authentication → Emails → SMTP settings), e.g. Resend or Postmark. Supabase's built-in sender only delivers to members of the Supabase organization's team, so MDs never receive invites without this. It is also rate-limited.
4. **Coolify:** set the variables from the table above and deploy (see [Coolify](#coolify)).
5. **First admin:**
   1. Invite yourself from the dashboard (Authentication → Users → Invite user). Team members get the built-in email even before custom SMTP.
   2. Accept the invite and set a password.
   3. Promote yourself in the SQL editor (or with the MCP `execute_sql`):

   ```sql
   update public.profiles set role = 'admin'
   where id = (select id from auth.users where email = 'you@example.com');
   ```

   Later admins are promoted the same way. There is no role editor in the app yet.

6. **Optional:** turn on leaked-password protection (Authentication → Passwords). The security advisor flags it as off.
