FROM node:26-alpine AS build
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run check && npm run build && npm prune --omit=dev

FROM node:26-alpine AS runtime
RUN apk add --no-cache ca-certificates git openssh-client \
    && addgroup -g 10001 gittransit \
    && adduser -D -H -u 10001 -G gittransit gittransit \
    && install -d -o 10001 -g 10001 -m 0700 /data/db /data/work /data/backups /data/secrets
WORKDIR /app
COPY --from=build --chown=10001:10001 /app/build ./build
COPY --from=build --chown=10001:10001 /app/worker-build ./worker-build
COPY --from=build --chown=10001:10001 /app/node_modules ./node_modules
COPY --from=build --chown=10001:10001 /app/package.json ./package.json
COPY --from=build --chown=10001:10001 /app/migrations ./migrations
ENV NODE_ENV=production \
    GITTRANSIT_DATA_DIR=/data \
    GITTRANSIT_DATABASE_URL=/data/db/gittransit.sqlite \
    GITTRANSIT_ENCRYPTION_KEY_FILE=/data/secrets/credential.key \
    HOST=0.0.0.0 \
    PORT=3000
USER 10001:10001
EXPOSE 3000
VOLUME ["/data/db", "/data/work", "/data/backups", "/data/secrets"]
CMD ["node", "build"]
