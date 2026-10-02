# Build from the repo root: docker build -f apps/game-server/Dockerfile .
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps
COPY tsconfig.json ./
COPY libs ./libs
COPY apps/game-server ./apps/game-server
RUN npm run build:game-server

# The bundle inlines ws and the rules lib, so the runtime image needs no node_modules.
FROM node:20-alpine
WORKDIR /app
COPY --from=build /app/dist/game-server/main.cjs ./main.cjs
USER node
ENV PORT=3001
EXPOSE 3001
CMD ["node", "main.cjs"]
