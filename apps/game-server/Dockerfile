# Build from the repo root: docker build -f apps/game-server/Dockerfile .
FROM node:20-alpine AS build
WORKDIR /app
# The server's own lockfile (ws + esbuild) keeps this stage from installing the whole Next.js tree.
COPY apps/game-server/package.json apps/game-server/package-lock.json ./apps/game-server/
RUN npm ci --prefix apps/game-server --no-audit --no-fund
COPY package.json tsconfig.json ./
COPY libs ./libs
COPY apps/game-server/src ./apps/game-server/src
ENV PATH=/app/apps/game-server/node_modules/.bin:$PATH
RUN npm run build:game-server

# The bundle inlines ws and the rules lib, so the runtime image needs no node_modules.
FROM node:20-alpine
WORKDIR /app
COPY --from=build /app/dist/game-server/main.cjs ./main.cjs
USER node
ENV PORT=3001
EXPOSE 3001
CMD ["node", "main.cjs"]
