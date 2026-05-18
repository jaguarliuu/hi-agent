FROM --platform=$BUILDPLATFORM docker.cnb.cool/jaguarliu.cool/wenyuan-ai/docker-sync/node:20-alpine_amd64 AS deps
WORKDIR /app
COPY server/package.json server/package-lock.json ./
RUN npm ci --include=dev

FROM --platform=$BUILDPLATFORM docker.cnb.cool/jaguarliu.cool/wenyuan-ai/docker-sync/node:20-alpine_amd64 AS prod-deps
WORKDIR /app
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts \
 && find node_modules -maxdepth 2 -type d -empty -delete

FROM --platform=$BUILDPLATFORM docker.cnb.cool/jaguarliu.cool/wenyuan-ai/docker-sync/node:20-alpine_amd64 AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY server/. ./
RUN npx prisma generate
RUN npm run build

FROM --platform=$TARGETPLATFORM docker.cnb.cool/jaguarliu.cool/wenyuan-ai/docker-sync/node:20-alpine_amd64 AS runtime
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000
RUN apk add --no-cache wget tini
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/prisma ./prisma
# prod-only node_modules（@prisma/client + 运行时依赖）
COPY --from=prod-deps /app/node_modules ./node_modules
# prisma CLI（迁移用，dev-only 包，单独从 build 复制）
COPY --from=build /app/node_modules/prisma ./node_modules/prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/.bin/prisma ./node_modules/.bin/prisma
COPY server/scripts/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh
RUN chown -R node:node /app
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health >/dev/null || exit 1
ENTRYPOINT ["/sbin/tini","--","/usr/local/bin/entrypoint.sh"]
CMD ["node","server.js"]
