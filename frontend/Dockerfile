# syntax=docker/dockerfile:1.6
#
# Multi-stage build for the Gauntlet React/Vite SPA.
#
# Stage 1 (builder): install npm deps and run `vite build` → /app/dist
# Stage 2 (export):  scratch-style minimal image that just owns /dist so a
#                    one-shot compose service can copy it into a shared volume
#                    that nginx serves from.
#
# Build with:  docker build -t gauntlet-frontend ./frontend
# In compose:  the `frontend-build` service runs `cp -r /dist/. /out/` into a
#              named volume that the nginx container mounts read-only.

# ─── builder ────────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

ENV NODE_ENV=production \
    CI=true

# Install deps with a clean, reproducible npm ci using only the lockfile.
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# Copy the rest of the SPA sources.
COPY . .

# Vite reads VITE_* env vars at build time.
ARG VITE_API_URL=/api
ENV VITE_API_URL=${VITE_API_URL}

RUN npm run build

# ─── final ──────────────────────────────────────────────────────────────────
# A tiny image that owns just the built artifacts. The compose `frontend-build`
# one-shot service runs `cp -r /dist/. /out/` to populate the shared volume.
FROM alpine:3.20 AS prod

RUN apk add --no-cache ca-certificates

WORKDIR /dist
COPY --from=builder /app/dist /dist

# Default command: copy artifacts into /out (a mounted volume in compose).
CMD ["sh", "-c", "set -e; rm -rf /out/* /out/.[!.]* 2>/dev/null || true; cp -a /dist/. /out/; echo 'frontend build artifacts published to /out'"]
