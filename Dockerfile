# Single long-running process: Fastify + Socket.io serving the built client
# (plan §1 Phase 6 — Railway; serverless is not viable for Socket.io).
FROM node:22-slim AS build
WORKDIR /app
RUN corepack enable
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages ./packages
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @spicy-dicey/client build

FROM node:22-slim
WORKDIR /app
RUN corepack enable
ENV NODE_ENV=production
COPY --from=build /app ./
EXPOSE 3000
CMD ["pnpm", "--filter", "@spicy-dicey/server", "exec", "tsx", "src/main.ts"]
