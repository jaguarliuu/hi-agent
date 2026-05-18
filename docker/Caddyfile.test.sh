#!/usr/bin/env bash
# Caddyfile 自检：确保 /api/* 反代到 auth-server:3000，且必须放在 try_files 之前。
set -euo pipefail

CADDYFILE="docker/Caddyfile"

if [[ ! -f "$CADDYFILE" ]]; then
  echo "FAIL: $CADDYFILE not found"
  exit 1
fi

# 1) 必须存在 @api matcher
grep -qE '^\s*@api\s+path\s+/api/\*' "$CADDYFILE" \
  || { echo "FAIL: missing '@api path /api/*' matcher"; exit 1; }

# 2) 必须 reverse_proxy auth-server:3000
grep -qE 'reverse_proxy\s+auth-server:3000' "$CADDYFILE" \
  || { echo "FAIL: missing 'reverse_proxy auth-server:3000'"; exit 1; }

# 3) 必须有标准 X-Forwarded-* 头透传
for h in 'X-Real-IP' 'X-Forwarded-For' 'X-Forwarded-Proto'; do
  grep -qE "header_up\s+${h}" "$CADDYFILE" \
    || { echo "FAIL: missing header_up ${h}"; exit 1; }
done

# 4) @api 段必须出现在 try_files 之前
api_line=$(grep -nE '^\s*@api\s+path\s+/api/\*' "$CADDYFILE" | head -n1 | cut -d: -f1)
try_line=$(grep -nE '^\s*try_files\s+' "$CADDYFILE" | head -n1 | cut -d: -f1)
if [[ -z "$api_line" || -z "$try_line" ]]; then
  echo "FAIL: cannot locate @api or try_files line"
  exit 1
fi
if (( api_line >= try_line )); then
  echo "FAIL: @api block (line $api_line) must be before try_files (line $try_line)"
  exit 1
fi

# 5) 尝试 caddy validate（可选）
if command -v docker >/dev/null 2>&1; then
  if docker image inspect caddy:2-alpine >/dev/null 2>&1 \
     || docker pull caddy:2-alpine >/dev/null 2>&1; then
    if docker run --rm -v "$(pwd)/docker/Caddyfile:/etc/caddy/Caddyfile:ro" \
         caddy:2-alpine caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile \
         >/tmp/caddy-validate.out 2>&1; then
      echo "caddy validate: OK"
    else
      echo "FAIL: caddy validate reported errors:"
      cat /tmp/caddy-validate.out
      exit 1
    fi
  else
    echo "SKIP: caddy image unavailable"
  fi
else
  echo "SKIP: docker not available, only grep-mode checks ran"
fi

echo "OK"
