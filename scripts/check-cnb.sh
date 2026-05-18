#!/usr/bin/env bash
# 校验 .cnb.yml：
#   1. 必须存在 "docker build (auth-server)" 与 "docker push (auth-server)" stage
#   2. auth-server build/push 必须在 hi-agent 的 docker push 之后、install ssh client 之前
#   3. write env file 阶段必须同时写入 HI_AGENT_IMAGE 与 AUTH_SERVER_IMAGE
set -euo pipefail
F=.cnb.yml

grep -nE 'name:\s*"?docker build \(auth-server\)"?' "$F" >/dev/null \
  || { echo "FAIL: missing 'docker build (auth-server)' stage"; exit 1; }
grep -nE 'name:\s*"?docker push \(auth-server\)"?' "$F" >/dev/null \
  || { echo "FAIL: missing 'docker push (auth-server)' stage"; exit 1; }

HI_PUSH=$(grep -nE 'docker push "\$IMAGE_REPO:\$CNB_COMMIT"' "$F" | head -n1 | cut -d: -f1)
AUTH_BUILD=$(grep -nE 'name:\s*"?docker build \(auth-server\)"?' "$F" | head -n1 | cut -d: -f1)
AUTH_PUSH=$(grep -nE 'name:\s*"?docker push \(auth-server\)"?' "$F" | head -n1 | cut -d: -f1)
SSH_INSTALL=$(grep -nE 'name:\s*"?install ssh client"?' "$F" | head -n1 | cut -d: -f1)

if [ "$AUTH_BUILD" -le "$HI_PUSH" ]; then
  echo "FAIL: auth-server build($AUTH_BUILD) must come AFTER hi-agent push($HI_PUSH)"; exit 1
fi
if [ "$AUTH_PUSH" -le "$AUTH_BUILD" ]; then
  echo "FAIL: auth-server push($AUTH_PUSH) must come AFTER auth-server build($AUTH_BUILD)"; exit 1
fi
if [ "$SSH_INSTALL" -le "$AUTH_PUSH" ]; then
  echo "FAIL: install ssh client($SSH_INSTALL) must come AFTER auth-server push($AUTH_PUSH)"; exit 1
fi

# write env file 必须同时写两个 IMAGE 变量
WRITE_ENV_LINE=$(grep -nE 'name:\s*"?write env file"?' "$F" | head -n1 | cut -d: -f1)
[ -n "$WRITE_ENV_LINE" ] || { echo "FAIL: missing 'write env file' stage"; exit 1; }
# 取该 stage 后 12 行作为 body
BODY=$(awk -v s="$WRITE_ENV_LINE" 'NR>=s && NR<=s+15' "$F")
echo "$BODY" | grep -q 'HI_AGENT_IMAGE='     || { echo "FAIL: write env file must write HI_AGENT_IMAGE"; exit 1; }
echo "$BODY" | grep -q 'AUTH_SERVER_IMAGE=' || { echo "FAIL: write env file must write AUTH_SERVER_IMAGE"; exit 1; }

echo "OK"
