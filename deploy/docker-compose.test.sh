#!/usr/bin/env bash
# docker-compose 自检：服务存在、依赖关系、端口暴露策略。
set -euo pipefail

COMPOSE=deploy/docker-compose.yml

# 用一个临时的 .env 给所有必填变量提供占位值，绕过 ${VAR:?...} 校验。
# 仅用于解析 compose 结构，不会真的起容器。fixture 内容抽到 deploy/test/fixture.env。
TMP_ENV=$(mktemp)
trap 'rm -f "$TMP_ENV" /tmp/compose.out' EXIT
cp deploy/test/fixture.env "$TMP_ENV"

# 1) compose config 不报错
docker compose -f "$COMPOSE" --env-file "$TMP_ENV" config >/tmp/compose.out

# 2) 服务存在
for svc in postgres hi-agent auth-server; do
  grep -qE "^[[:space:]]+${svc}:" /tmp/compose.out \
    || { echo "FAIL: missing service $svc"; exit 1; }
done

# 3) auth-server depends_on postgres healthy
python3 - <<'PY'
import re, sys
text = open('/tmp/compose.out').read()
m = re.search(r'^\s+auth-server:\n((?:^\s+.*\n)+?)(?=^\s+\w[\w-]*:\n(?:\s{4}\w)|^networks:|^volumes:|\Z)', text, re.MULTILINE)
if not m:
    # fallback：找到 auth-server: 开始，到下一个同缩进服务名为止
    lines = text.splitlines()
    start = None
    indent = None
    for i, ln in enumerate(lines):
        if re.match(r'^(\s+)auth-server:\s*$', ln):
            start = i
            indent = len(re.match(r'^(\s+)', ln).group(1))
            break
    assert start is not None, 'auth-server section not found'
    block_lines = [lines[start]]
    for ln in lines[start+1:]:
        if re.match(rf'^\s{{0,{indent}}}\S', ln) and not ln.startswith(' ' * (indent+1)):
            break
        block_lines.append(ln)
    block = '\n'.join(block_lines)
else:
    block = m.group(0)

assert 'postgres:' in block, f'auth-server.depends_on must contain postgres, block:\n{block}'
assert 'condition: service_healthy' in block, \
    f'auth-server.depends_on.postgres.condition must be service_healthy, block:\n{block}'
print('depends_on check: OK')
PY

# 4) hi-agent ports 包含 127.0.0.1:8080:80
grep -qE 'published.*"?8080"?' /tmp/compose.out \
  || grep -qE '127\.0\.0\.1:8080' /tmp/compose.out \
  || { echo "FAIL: hi-agent ports not 127.0.0.1:8080:80"; exit 1; }

# 5) auth-server 不 publish 端口（block 内无 ports:）
python3 - <<'PY'
import re
text = open('/tmp/compose.out').read()
lines = text.splitlines()
start = None
indent = None
for i, ln in enumerate(lines):
    if re.match(r'^(\s+)auth-server:\s*$', ln):
        start = i
        indent = len(re.match(r'^(\s+)', ln).group(1))
        break
assert start is not None
block = []
for ln in lines[start+1:]:
    if ln.strip() == '':
        block.append(ln)
        continue
    cur_indent = len(ln) - len(ln.lstrip(' '))
    if cur_indent <= indent:
        break
    block.append(ln)
btxt = '\n'.join(block)
# 严格匹配 'ports:' 在 auth-server 子级（缩进 == indent+2）
assert not re.search(rf'^\s{{{indent+2}}}ports:\s*$', btxt, re.MULTILINE), \
    f'auth-server must not publish ports, block:\n{btxt}'
print('no-publish check: OK')
PY

# 6) hi-agent 不应依赖 auth-server（静态站需独立可服务，auth 故障时仅 /api/* 502）
python3 - <<'PY'
import re
text = open('/tmp/compose.out').read()
lines = text.splitlines()
start = None
indent = None
for i, ln in enumerate(lines):
    if re.match(r'^(\s+)hi-agent:\s*$', ln):
        start = i
        indent = len(re.match(r'^(\s+)', ln).group(1))
        break
assert start is not None, 'hi-agent section not found'
block = []
for ln in lines[start+1:]:
    if ln.strip() == '':
        block.append(ln)
        continue
    cur_indent = len(ln) - len(ln.lstrip(' '))
    if cur_indent <= indent:
        break
    block.append(ln)
btxt = '\n'.join(block)
m2 = re.search(r'depends_on:\s*\n((?:\s+.*\n)+?)(?=\s{0,' + str(indent+2) + r'}\S|\Z)', btxt)
if m2:
    assert 'auth-server' not in m2.group(1), \
        f'hi-agent must NOT depend_on auth-server (Caddy reverse_proxy is lazy):\n{m2.group(1)}'
print('hi-agent independence check: OK')
PY

echo "OK"
