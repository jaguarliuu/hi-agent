FROM docker.cnb.cool/jaguarliu.cool/wenyuan-ai/docker-sync/node:20-alpine_amd64 AS deps
WORKDIR /app
COPY server/package.json server/package-lock.json ./
RUN npm ci --include=dev

FROM docker.cnb.cool/jaguarliu.cool/wenyuan-ai/docker-sync/node:20-alpine_amd64 AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY server/. ./
RUN npx prisma generate
RUN npm run build

FROM docker.cnb.cool/jaguarliu.cool/wenyuan-ai/docker-sync/node:20-alpine_amd64 AS runtime
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000
RUN apk add --no-cache wget tini
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/node_modules ./node_modules
COPY server/scripts/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health >/dev/null || exit 1
ENTRYPOINT ["/sbin/tini","--","/usr/local/bin/entrypoint.sh"]
CMD ["node","server.js"]
