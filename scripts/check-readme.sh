#!/usr/bin/env bash
# 校验 README.md：
#   1. 必须含「首次部署」「AUTH_SERVER_IMAGE」两个核心标记
#   2. README 中提到的所有「XXX=」字段，必须能在 deploy/.env.example 中找到
#      —— 防止 README 与 .env.example 字段名漂移（例如旧 plan 残留的
#      SESSION_COOKIE_SECURE 与实际的 SECURE_COOKIE 不一致）
#   3. .env.example 中的关键必填字段（POSTGRES_PASSWORD/OTP_PEPPER/SMTP_HOST），
#      README 必须有提及
set -euo pipefail
F=README.md
ENV_EX=deploy/.env.example

[ -f "$F" ]      || { echo "FAIL: $F 不存在" >&2; exit 1; }
[ -f "$ENV_EX" ] || { echo "FAIL: $ENV_EX 不存在" >&2; exit 1; }

# 1. 核心结构标记
for kw in "首次部署" "AUTH_SERVER_IMAGE"; do
  grep -nF "$kw" "$F" >/dev/null \
    || { echo "FAIL: README 缺少标记 '$kw'" >&2; exit 1; }
done

# 2. .env.example 关键必填字段必须在 README 出现
for kw in "POSTGRES_PASSWORD" "OTP_PEPPER" "SMTP_HOST"; do
  grep -nF "$kw" "$F" >/dev/null \
    || { echo "FAIL: README 缺少 .env 必填字段 '$kw'" >&2; exit 1; }
done

# 3. 反向校验：从 README 的反引号片段中抽出"看起来像 env 字段名"的 token
#    （全大写下划线、长度 >= 4），它们必须能在 .env.example 找到。
#    这是为了堵住 SECURE_COOKIE vs SESSION_COOKIE_SECURE 类的字段漂移。
#    匹配模式覆盖三种常见写法：
#      `XXX`          形如 `OTP_PEPPER`
#      `XXX=...`      形如 `SECURE_COOKIE=true`
#      `XXX=`         形如 `HI_AGENT_IMAGE=`
ENV_KEYS=$(grep -E '^[A-Z][A-Z0-9_]*=' "$ENV_EX" | cut -d= -f1 | sort -u)
README_TOKENS=$(grep -oE '`[A-Z][A-Z0-9_]{3,}' "$F" | tr -d '`' | sort -u)

MISSING=""
for tok in $README_TOKENS; do
  # 白名单：CI 注入字段（不在 .env.example）+ HTTP header / 常用大写非 env token
  case "$tok" in
    HI_AGENT_IMAGE|AUTH_SERVER_IMAGE) continue ;;     # CI 注入
    COOP|COEP|CORP|HTTPS|HTTP|TODO|FAIL|README) continue ;;  # 文档常用大写词
  esac
  if ! echo "$ENV_KEYS" | grep -qx "$tok"; then
    MISSING="$MISSING $tok"
  fi
done

if [ -n "$MISSING" ]; then
  echo "FAIL: README 提到以下 token 但 deploy/.env.example 不存在同名字段:$MISSING" >&2
  echo "      （可能是字段名漂移；请把 README 改为 .env.example 实际使用的字段名）" >&2
  exit 1
fi

echo "OK"
