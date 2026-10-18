# syntax=docker/dockerfile:1
# Self-hosted SubFlare: Node.js + SQLite (node:sqlite), no native modules, no node_modules at runtime.

ARG NODE_VERSION=24
# Must match the Alpine release of node:${NODE_VERSION}-alpine${ALPINE_VERSION} (same musl / libstdc++).
ARG ALPINE_VERSION=3.24

FROM node:${NODE_VERSION}-alpine${ALPINE_VERSION} AS node

# The build output is plain JS + static files, so build natively instead of under QEMU for other arches.
FROM --platform=$BUILDPLATFORM node:${NODE_VERSION}-slim AS build
WORKDIR /src
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
ARG BUILD_COMMIT=docker
RUN BUILD_COMMIT=${BUILD_COMMIT} npm run build:node

# Same as the official node:alpine image (Alpine + libstdc++ + node), minus npm / yarn / corepack.
FROM alpine:${ALPINE_VERSION}
RUN apk add --no-cache libstdc++ \
 && addgroup -g 1000 node && adduser -u 1000 -G node -s /bin/sh -D node \
 && mkdir /data && chown node:node /data
COPY --from=node /usr/local/bin/node /usr/local/bin/node
WORKDIR /app
COPY --from=build /src/dist/client ./dist/client
COPY --from=build /src/dist/node/ ./
COPY --from=build /src/migrations/sqlite ./migrations/sqlite
ENV NODE_ENV=production PORT=8787 DATA_DIR=/data
USER node
VOLUME /data
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -q --spider "http://127.0.0.1:${PORT}/api/health" || exit 1
CMD ["node", "--disable-warning=ExperimentalWarning", "server.mjs"]
