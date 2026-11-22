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

- `scripts/local-env.ts` runs `dev`, `test:db` and `test:e2e` with the stack's URLs and keys. You don't need a `.env` file. If you make one (see `.env.example`), its values win.
- Invite emails land in Mailpit at http://127.0.0.1:54324. Studio is at http://127.0.0.1:54323.
- `pnpm users:promote <email>` makes a local user an admin.

### Schema changes

The schema lives in `src/lib/server/db/schema.ts`.

1. Run `pnpm db:generate --name <change>`. Drizzle writes the SQL into `supabase/migrations` with Supabase timestamp names.
2. For SQL that Drizzle can't express (functions, triggers, grants), run `pnpm exec drizzle-kit generate --custom --name <change>` and write the SQL there.
3. Run `pnpm db:reset`.
4. Run `supabase db advisors --type security --fail-on warn`.

Don't use the Supabase MCP `apply_migration` tool for schema changes. It records migrations the repository doesn't have.

## Environment variables

| Variable                   | Used                   | Where it comes from                                                                          |
| -------------------------- | ---------------------- | -------------------------------------------------------------------------------------------- |
| `SUPABASE_URL`             | build (inlined)        | Supabase dashboard → Project Settings → API (`https://<ref>.supabase.co`)                    |
| `SUPABASE_PUBLISHABLE_KEY` | build (inlined)        | Supabase dashboard → API Keys → publishable key (`sb_publishable_…`)                         |
| `SUPABASE_SECRET_KEY`      | runtime (server only)  | Supabase dashboard → API Keys → secret key (`sb_secret_…`). Bypasses RLS, so keep it secret. |
| `DATABASE_URL`             | runtime (server only)  | Supabase dashboard → Connect → **Session pooler** (port 5432, IPv4), with the DB password    |
| `ORIGIN`                   | runtime (adapter-node) | The app's public URL, e.g. `https://sketch.example.com` (no trailing slash)                  |

The public variables are inlined into the bundle so the app opens offline. Changing them needs a rebuild.

## Coolify

The app deploys as one Docker image built from `Dockerfile`, through `docker-compose.yml`.

1. **New resource:** pick the GitHub repository, then **Build pack: Docker Compose**, with compose file location `/docker-compose.yml`.
2. **Domain:** set the `app` service's domain to the public URL with the container port, e.g. `https://sketch.example.com:3000`. The port tells the proxy where to route; visitors still use 443.
3. **Environment variables:**
   - Set every variable in the table above.
   - Mark `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` as **build** variables (they are build args).
   - The other three are runtime variables.
   - Set `ORIGIN` to the same public URL as the domain, without the `:3000`.
4. **Health:** the compose health check calls `GET /health` (`ok`). Coolify takes an unhealthy container out of routing.
5. **Deploy.** Pushing to the connected branch redeploys if auto-deploy is on.

Run `node scripts/local-env.ts docker compose build` to check the image locally.
