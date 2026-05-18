#!/usr/bin/env bash
# 首次部署 .env 生成脚本
# 用法：
#   本机生成本地副本（不上传）：
#     ./scripts/bootstrap-deploy-env.sh
#     ./scripts/bootstrap-deploy-env.sh --output /tmp/hi-agent.env
#     ./scripts/bootstrap-deploy-env.sh --app-base-url https://hi-agent.example.com
#
#   服务器侧（推荐 ssh 上去后直接执行）：
#     curl -fsSL https://raw.githubusercontent.com/jaguarliuu/hi-agent/main/scripts/bootstrap-deploy-env.sh \
#       | bash -s -- --output /opt/hi-agent/.env --app-base-url https://hi-agent.example.com
#
# 行为：
#   - 自动生成 POSTGRES_PASSWORD / OTP_PEPPER（openssl rand -base64 32）
#   - 自动拼接 DATABASE_URL（url-encode PG 密码，避免 +/= 等字符破坏 URI）
#   - 复制 .env.example 其它字段（POSTGRES_DB/USER、SESSION_TTL_DAYS、SECURE_COOKIE、
#     SMTP_PORT/SECURE/FROM、TRUST_PROXY、APP_BASE_URL）
#   - 留空：HI_AGENT_IMAGE / AUTH_SERVER_IMAGE（CNB pipeline 首次 push 后自动 sed 写入）
#   - 留空：SMTP_HOST / SMTP_USER / SMTP_PASS（必须人工填，脚本不可能猜邮件服务商凭据）
#   - 输出文件强制 chmod 600
#
# 安全：
#   - 默认拒绝覆盖已存在的目标文件（避免误删运维已填好的生产 .env）
#   - 想强制覆盖：--force（建议先 cp -a 备份）
#   - 生成的密码只写入目标文件；不打印到 stdout、不写入日志

set -euo pipefail

# ---------- 参数 ----------
OUTPUT="./.env.local"
APP_BASE_URL="https://hi-agent.local"
FORCE=0

usage() {
  sed -n '2,30p' "$0"
  exit 0
}

while [ $# -gt 0 ]; do
  case "$1" in
    -o|--output)        OUTPUT="$2"; shift 2 ;;
    -u|--app-base-url)  APP_BASE_URL="$2"; shift 2 ;;
    -f|--force)         FORCE=1; shift ;;
    -h|--help)          usage ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac
done

# ---------- 前置检查 ----------
command -v openssl >/dev/null 2>&1 \
  || { echo "FAIL: 需要 openssl（用于生成强随机密码）" >&2; exit 1; }

if [ -e "$OUTPUT" ] && [ "$FORCE" -ne 1 ]; then
  echo "FAIL: 目标文件已存在：$OUTPUT" >&2
  echo "      若确认要覆盖，请加 --force（强烈建议先备份：cp -a '$OUTPUT' '$OUTPUT.bak.\$(date +%s)'）" >&2
  exit 1
fi

# 确保父目录存在
OUT_DIR=$(dirname "$OUTPUT")
[ -d "$OUT_DIR" ] || mkdir -p "$OUT_DIR"

# ---------- 生成强随机 ----------
gen_secret() { openssl rand -base64 32 | tr -d '\n'; }

POSTGRES_PASSWORD=$(gen_secret)
OTP_PEPPER=$(gen_secret)

# url-encode：base64 含 +/=，直接拼进 URI 会被 PG 客户端误解析
urlencode() {
  local s="$1" i c out=""
  for (( i=0; i<${#s}; i++ )); do
    c="${s:$i:1}"
    case "$c" in
      [a-zA-Z0-9._~-]) out+="$c" ;;
      *) out+=$(printf '%%%02X' "'$c") ;;
    esac
  done
  printf '%s' "$out"
}

PG_PASS_ENC=$(urlencode "$POSTGRES_PASSWORD")
DATABASE_URL="postgresql://hi_agent:${PG_PASS_ENC}@postgres:5432/hi_agent?schema=public"

# ---------- 写文件（umask 收紧，避免落盘瞬间被旁观）----------
umask 077

cat > "$OUTPUT" <<EOF
# Hi-Agent 部署环境变量
# 由 scripts/bootstrap-deploy-env.sh 于 $(date -u +%Y-%m-%dT%H:%M:%SZ) 生成
# 强随机字段（POSTGRES_PASSWORD / OTP_PEPPER）已自动生成，请勿外泄。
# CI/CD（CNB pipeline）只会写入 HI_AGENT_IMAGE / AUTH_SERVER_IMAGE 两行。

HI_AGENT_IMAGE=
AUTH_SERVER_IMAGE=

POSTGRES_DB=hi_agent
POSTGRES_USER=hi_agent
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}

# 容器内访问：host 必须是 compose 服务名 postgres，密码必须与 POSTGRES_PASSWORD 一致
DATABASE_URL=${DATABASE_URL}

OTP_PEPPER=${OTP_PEPPER}
SESSION_TTL_DAYS=30
# 是否在 Cookie 上设置 Secure 属性
# 生产（外层 HTTPS 反代 → Caddy → auth-server）：true
# docker-compose 单跑（裸 HTTP :8080）：必须设为 false，否则浏览器拒绝写入登录 cookie
SECURE_COOKIE=true

# ↓↓↓ 以下三项必须人工填写：邮件服务商凭据 ↓↓↓
SMTP_HOST=
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=
SMTP_PASS=
SMTP_FROM="Hi-Agent <noreply@example.com>"
# ↑↑↑ TODO：填好 SMTP_HOST / SMTP_USER / SMTP_PASS 才能发 OTP 邮件 ↑↑↑

APP_BASE_URL=${APP_BASE_URL}

# 是否信任反向代理转发的 X-Forwarded-For / X-Real-IP
# docker-compose 默认 true（前面是 Caddy）；裸跑保持 false
# 注意：在 Caddy 后端关掉 TRUST_PROXY 会让所有请求被识别为 Caddy 容器内网 IP，触发全局限流
TRUST_PROXY=true
EOF

chmod 600 "$OUTPUT"

# ---------- 完成提示（不打印密码本身）----------
cat <<EOF
OK: 已生成 ${OUTPUT}（mode 600）
    - POSTGRES_PASSWORD：已生成（base64-32 随机，未打印）
    - OTP_PEPPER：       已生成（base64-32 随机，未打印）
    - DATABASE_URL：     已拼接（PG 密码已 URL-encode）
    - APP_BASE_URL：     ${APP_BASE_URL}
    - 其它默认字段：     已写入

下一步（必填）：
    vim ${OUTPUT}
    # 填好 SMTP_HOST / SMTP_USER / SMTP_PASS（如有需要也可调整 SMTP_FROM / SMTP_PORT）

可选验证（在 docker-compose.yml 同目录跑）：
    docker compose --env-file ${OUTPUT} config | grep -E '(POSTGRES|DATABASE_URL|OTP_|SECURE_COOKIE|APP_BASE_URL)'

之后 git push 触发 CNB，pipeline 会自动 sed in-place 写入 HI_AGENT_IMAGE / AUTH_SERVER_IMAGE 两行。
EOF
