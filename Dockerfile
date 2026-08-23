FROM node:24-bookworm AS base
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/backend/package.json ./packages/backend/
COPY packages/web/package.json ./packages/web/
COPY packages/mcp/package.json ./packages/mcp/
RUN npm ci

FROM base AS dev
COPY . .
EXPOSE 3100 5173

FROM base AS builder
COPY . .
RUN npm run build

FROM node:24-bookworm-slim AS backend-runtime
WORKDIR /app
ENV NODE_ENV=production FLOWTRACE_HOST=0.0.0.0 FLOWTRACE_PORT=3100
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/backend/package.json ./packages/backend/
RUN npm ci --omit=dev -w @flowtrace/backend
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/backend/dist ./packages/backend/dist
VOLUME ["/data"]
EXPOSE 3100
CMD ["node", "packages/backend/dist/main.js"]
