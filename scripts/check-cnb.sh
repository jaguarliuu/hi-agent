#!/usr/bin/env bash
# 校验 .cnb.yml：
#   1. 必须存在 "docker build (auth-server)" 与 "docker push (auth-server)" stage
#   2. auth-server build/push 必须在 hi-agent 的 docker push 之后、install ssh client 之前
#   3. write env file 阶段必须同时写入 HI_AGENT_IMAGE 与 AUTH_SERVER_IMAGE
#   4. write env file 不得用 `>` 覆盖整 .env（必须 sed in-place upsert，
#      否则会洗掉运维手填的 POSTGRES_PASSWORD / OTP_PEPPER / SMTP_* 等）
set -euo pipefail
F=.cnb.yml

grep -nE 'name:\s*"?docker build \(auth-server\)"?' "$F" >/dev/null \
  || { echo "FAIL: missing 'docker build (auth-server)' stage" >&2; exit 1; }
grep -nE 'name:\s*"?docker push \(auth-server\)"?' "$F" >/dev/null \
  || { echo "FAIL: missing 'docker push (auth-server)' stage" >&2; exit 1; }

HI_PUSH=$(grep -nE 'docker push "\$IMAGE_REPO:\$CNB_COMMIT"' "$F" | head -n1 | cut -d: -f1)
AUTH_BUILD=$(grep -nE 'name:\s*"?docker build \(auth-server\)"?' "$F" | head -n1 | cut -d: -f1)
AUTH_PUSH=$(grep -nE 'name:\s*"?docker push \(auth-server\)"?' "$F" | head -n1 | cut -d: -f1)
SSH_INSTALL=$(grep -nE 'name:\s*"?install ssh client"?' "$F" | head -n1 | cut -d: -f1)

if [ "$AUTH_BUILD" -le "$HI_PUSH" ]; then
  echo "FAIL: auth-server build($AUTH_BUILD) must come AFTER hi-agent push($HI_PUSH)" >&2; exit 1
fi
if [ "$AUTH_PUSH" -le "$AUTH_BUILD" ]; then
  echo "FAIL: auth-server push($AUTH_PUSH) must come AFTER auth-server build($AUTH_BUILD)" >&2; exit 1
fi
if [ "$SSH_INSTALL" -le "$AUTH_PUSH" ]; then
  echo "FAIL: install ssh client($SSH_INSTALL) must come AFTER auth-server push($AUTH_PUSH)" >&2; exit 1
fi

# write env file 必须同时写两个 IMAGE 变量；用 stage 真实边界切片，
# 避免硬编码行数（s+15）在后续插注释/换行时漂移。
# 边界规则：从 "name: write env file" 起，到下一个 "- name:" 或文件末尾止。
WRITE_ENV_LINE=$(grep -nE 'name:\s*"?write env file"?' "$F" | head -n1 | cut -d: -f1)
[ -n "$WRITE_ENV_LINE" ] || { echo "FAIL: missing 'write env file' stage" >&2; exit 1; }
BODY=$(awk -v s="$WRITE_ENV_LINE" '
  NR==s { flag=1; print; next }
  flag && /^[[:space:]]*-[[:space:]]+name:/ { exit }
  flag { print }
' "$F")
echo "$BODY" | grep -q 'HI_AGENT_IMAGE='     || { echo "FAIL: write env file must write HI_AGENT_IMAGE" >&2; exit 1; }
echo "$BODY" | grep -q 'AUTH_SERVER_IMAGE=' || { echo "FAIL: write env file must write AUTH_SERVER_IMAGE" >&2; exit 1; }

# 4. 安全闸：write env file 必须不是 `> $DEPLOY_PATH/.env` 整文件覆盖
#    用负向边界：`>` 前一字符不是 `>`（避开 `>>` 追加），也不在注释 `#` 之后。
#    简单实现：剥掉 `#...` 注释行后再扫单 `>` 覆盖。
SCRIPT_BODY=$(echo "$BODY" | sed -E 's/#.*$//')
if echo "$SCRIPT_BODY" | grep -qE '(^|[^>])> *\$DEPLOY_PATH/\.env'; then
  echo "FAIL: write env file 用 \`>\` 整文件覆盖 \$DEPLOY_PATH/.env，会洗掉运维手填字段" >&2
  echo "      请改为 sed 删行 + 追加（in-place upsert）" >&2
  exit 1
fi
# 必须包含 sed 删行 IMAGE 行（保留其它字段）
echo "$SCRIPT_BODY" | grep -qE "sed.*HI_AGENT_IMAGE\|AUTH_SERVER_IMAGE" \
  || { echo "FAIL: write env file 必须用 sed 删除既有 HI_AGENT_IMAGE/AUTH_SERVER_IMAGE 行（保留其它字段）" >&2; exit 1; }

# 5. auth-server build context 必须是仓库根（`.`），不能是 `./server`
#    server/Dockerfile 里所有 COPY 都写的是 `COPY server/xxx ...`（相对仓库根）；
#    若把 context 缩到 ./server，docker 会去 ./server/server/... 找文件而失败。
AUTH_BUILD_BODY=$(awk -v s="$AUTH_BUILD" '
  NR==s { flag=1; print; next }
  flag && /^[[:space:]]*-[[:space:]]+name:/ { exit }
  flag { print }
' "$F")
if echo "$AUTH_BUILD_BODY" | sed -E 's/#.*$//' | grep -qE '^\s*\./server\s*$'; then
  echo "FAIL: 'docker build (auth-server)' 的 build context 是 ./server，必须改为 ." >&2
  echo "      原因：server/Dockerfile 里 COPY 都是 'COPY server/xxx' 相对仓库根的形式" >&2
  exit 1
fi

echo "OK"
