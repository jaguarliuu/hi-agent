#!/usr/bin/env bash
set -euo pipefail
F=README.md

for kw in "首次部署" "POSTGRES_PASSWORD" "OTP_PEPPER" "SMTP_HOST" "AUTH_SERVER_IMAGE"; do
  grep -nF "$kw" "$F" >/dev/null \
    || { echo "FAIL: README 缺少关键字 '$kw'"; exit 1; }
done
echo "OK"
