ARG BUN_VERSION=1
FROM oven/bun:${BUN_VERSION} AS build

WORKDIR /app
COPY . .

RUN bun install --frozen-lockfile
RUN bun run typecheck:api
RUN bun run build

FROM oven/bun:${BUN_VERSION} AS runtime

WORKDIR /app
ENV NODE_ENV=production

COPY --from=build --chown=bun:bun /app /app

USER bun
WORKDIR /app/apps/api

EXPOSE 3000

CMD ["bun", "src/index.ts"]