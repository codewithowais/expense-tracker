# syntax=docker/dockerfile:1
# Pinned Node version — the container always runs this Node regardless of the
# host's installed Node, so a host upgrade can never break the app.
ARG NODE_VERSION=24-alpine

# ---- deps: install from a clean, reproducible lockfile ----
FROM node:${NODE_VERSION} AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- builder: produce the standalone server bundle ----
FROM node:${NODE_VERSION} AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# NEXT_PUBLIC_* vars are inlined at build time, so they must be passed here
# (not at runtime). Server-only vars (DATABASE_URL, APP_PIN) are read at runtime.
ARG NEXT_PUBLIC_SYNC_TOKEN=""
ENV NEXT_PUBLIC_SYNC_TOKEN=${NEXT_PUBLIC_SYNC_TOKEN}
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---- runner: minimal image that runs .next/standalone ----
FROM node:${NODE_VERSION} AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Run as a non-root user.
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

# standalone bundles its own minimal node_modules + server.js; static assets
# and public/ must be copied alongside it.
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

# server.js is emitted by Next's standalone output.
CMD ["node", "server.js"]
