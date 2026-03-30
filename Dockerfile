FROM oven/bun:1.2

WORKDIR /app

# Copy workspace manifests first (cache-friendly)
COPY package.json bun.lock ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/
COPY apps/frontend/package.json ./apps/frontend/

RUN bun install --frozen-lockfile

# Copy source
COPY packages ./packages
COPY apps/api ./apps/api
COPY apps/frontend ./apps/frontend

# Build frontend
RUN cd apps/frontend && bun run build

EXPOSE 3001

CMD ["bun", "apps/api/src/index.ts"]
