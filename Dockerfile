FROM node:24-bookworm AS workspace
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/backend/package.json ./packages/backend/
COPY packages/web/package.json ./packages/web/
COPY packages/mcp/package.json ./packages/mcp/

FROM workspace AS base
RUN npm ci

FROM base AS dev
COPY . .
EXPOSE 3100 5173

FROM workspace AS build-dependencies
RUN npm ci --ignore-scripts

FROM build-dependencies AS builder
COPY . .
RUN npm run build

FROM workspace AS production-dependencies
RUN npm ci --omit=dev -w @flowtrace/backend -w @flowtrace/mcp

FROM node:24-bookworm-slim AS app-runtime
WORKDIR /app
ENV NODE_ENV=production FLOWTRACE_HOST=0.0.0.0 FLOWTRACE_PORT=3100 FLOWTRACE_SEED_DEMO=false FLOWTRACE_WEB_ROOT=/app/packages/web/dist
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/backend/package.json ./packages/backend/
COPY packages/mcp/package.json ./packages/mcp/
COPY --from=production-dependencies /app/node_modules ./node_modules
COPY --from=production-dependencies /app/packages/backend/node_modules ./packages/backend/node_modules
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/mcp/dist ./packages/mcp/dist
COPY --from=builder /app/packages/backend/dist ./packages/backend/dist
COPY --from=builder /app/packages/web/dist ./packages/web/dist
EXPOSE 3100
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 CMD ["node", "-e", "fetch('http://127.0.0.1:3100/api/health').then((response) => { if (!response.ok) process.exit(1); }).catch(() => process.exit(1));"]
CMD ["node", "packages/backend/dist/main.js"]
