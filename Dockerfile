# syntax=docker/dockerfile:1
# Match Sketch: SvelteKit (adapter-node) in a Node 26 image. Coolify builds it from
# docker-compose.yml; see docs/operations.md.

FROM node:26-alpine AS base
# Node 26 ships no corepack; take pnpm from its official image (https://pnpm.io/docker).
COPY --from=ghcr.io/pnpm/pnpm:12-alpine /opt/pnpm /opt/pnpm
RUN for b in pnpm pnpx; do ln -s "/opt/pnpm/$b" "/usr/local/bin/$b"; done
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

FROM base AS build
RUN --mount=type=cache,id=pnpm,target=/var/cache/pnpm \
	pnpm install --store-dir /var/cache/pnpm --frozen-lockfile
COPY . .
# The public Supabase URL and publishable key are inlined into the bundle (src/env.ts).
ARG SUPABASE_URL
ARG SUPABASE_PUBLISHABLE_KEY
# SvelteKit's route analysis also checks the private, runtime-only variables. Placeholders pass
# that check and are never inlined; the container reads and checks the real ones when it starts.
RUN SUPABASE_URL="$SUPABASE_URL" SUPABASE_PUBLISHABLE_KEY="$SUPABASE_PUBLISHABLE_KEY" \
	SUPABASE_SECRET_KEY=build-placeholder DATABASE_URL=postgresql://build-placeholder/postgres \
	pnpm build

FROM base AS prod-deps
RUN --mount=type=cache,id=pnpm,target=/var/cache/pnpm \
	pnpm install --store-dir /var/cache/pnpm --prod --frozen-lockfile

FROM node:26-alpine
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
WORKDIR /app
COPY --chown=node:node package.json ./
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/build ./build
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
	CMD wget -qO- http://127.0.0.1:3000/health || exit 1
CMD ["node", "build"]
