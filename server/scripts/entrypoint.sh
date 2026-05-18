#!/bin/sh
set -eu

if [ -z "${DATABASE_URL:-}" ]; then
  echo "[entrypoint] FATAL: DATABASE_URL is empty" >&2
  exit 1
fi

start=$(date +%s)
echo "[entrypoint] running prisma migrate deploy ..."
if ! ./node_modules/.bin/prisma migrate deploy; then
  echo "[entrypoint] FATAL: prisma migrate deploy failed after $(( $(date +%s) - start ))s" >&2
  exit 1
fi
echo "[entrypoint] prisma migrate finished in $(( $(date +%s) - start ))s"

exec "$@"
