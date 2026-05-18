# 用户认证系统 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 Hi-Agent 静态站点旁挂一套独立 `server/` 后端工程（Next.js Route Handlers + Prisma + Postgres），实现邮箱 OTP 注册即登录主流程，并预留密码登录 / 微信 / GitHub OAuth 接口；同步移除 GitHub Pages 部署。

**Architecture:** 前端（hi-agent / Caddy 静态托管）保持 `output: 'export'` 不变；新增独立 `auth-server`（Next.js standalone）通过 Caddy 反代 `/api/*` 提供后端能力；Postgres 16-alpine 仅暴露 `127.0.0.1:55432`，三容器走 `hi-agent-net` 内网通信。会话采用服务端 `sessions` 表 + httpOnly Cookie（`hi_sid`，30 天滑动续期）。所有改动按 PR-0 → PR-7 切片串行交付。

**Tech Stack:** Next.js 15（App Router / Route Handlers，`output: 'standalone'`）、Prisma 6、PostgreSQL 16-alpine（含 `citext` 扩展）、Zod 校验、nodemailer SMTP、argon2id（OWASP 2024 基线）、Caddy 2 反代、Docker Compose、CNB Pipeline。

**Spec:** [2026-05-18-auth-system-design.md](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/docs/superpowers/specs/2026-05-18-auth-system-design.md)

---

## 全局执行约定

* **测试框架**：前端复用 vitest（[package.json#L15-L17](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/package.json#L15-L17)）；server/ 工程独立装一份 vitest，所有后端单测落在 `server/tests/**/*.test.ts`。
* **提交粒度**：每个 Task 末尾统一 commit；commit message 前缀按 PR 主题（`chore(gh-pages)`、`feat(db)`、`feat(auth-server)`、`feat(auth)`、`feat(caddy)`、`feat(profile)`、`feat(ui)`、`ci(cnb)`）。
* **分支策略**：用户已确认共享 git 历史 / 单仓库，不拆分 server/ 子仓；PR-0 ~ PR-7 在 main 上顺序合并。
* **环境变量**：所有新增变量同步追加到 `deploy/.env.example`（PR-1 起开始建立此文件），生产值由用户在服务器 `/opt/hi-agent/.env` 维护，CNB 流水线只写入 `HI_AGENT_IMAGE` / `AUTH_SERVER_IMAGE`。
* **本地排障**：Postgres 用 `127.0.0.1:55432:5432` 暴露给宿主机，`psql -h 127.0.0.1 -p 55432 -U hi_agent -d hi_agent` 可直连。
* **OTP_PEPPER**：本地与生产一律 `openssl rand -base64 32` 生成；任何替换都会让所有未消费 OTP 失效，属于预期行为。

---

## File Structure（提前锁定边界）

```
.cnb.yml                       # PR-7 增 auth-server build & push stage
.github/workflows/deploy.yml   # PR-0 删除（GH Pages 专属）
public/.nojekyll               # PR-0 删除
next.config.mjs                # PR-0 简化（移除 basePath / repo / isGhPages / assetPrefix）

deploy/
  docker-compose.yml           # PR-1 加 postgres + 网络/卷；PR-4 加 auth-server
  .env.example                 # PR-1 新增；PR-2/3 增量补字段

docker/Caddyfile               # PR-4 加 @api 段反代

server/                        # ★ PR-2 新建独立 Next.js standalone 工程
  package.json
  next.config.mjs              # output: 'standalone'
  tsconfig.json
  .dockerignore
  Dockerfile
  scripts/entrypoint.sh        # 启动时 prisma migrate deploy
  prisma/
    schema.prisma              # PR-2 五张表
    migrations/0001_init/migration.sql
  app/api/
    health/route.ts            # PR-2
    auth/otp/request/route.ts  # PR-3
    auth/otp/verify/route.ts   # PR-3
    auth/me/route.ts           # PR-3
    auth/logout/route.ts       # PR-3
    auth/password/set/route.ts     # PR-5（接口骨架）
    auth/password/change/route.ts  # PR-5（接口骨架）
    auth/oauth/wechat/start/route.ts     # PR-5（501 占位）
    auth/oauth/wechat/callback/route.ts  # PR-5
    auth/oauth/github/start/route.ts     # PR-5
    auth/oauth/github/callback/route.ts  # PR-5
    users/me/profile/route.ts  # PR-5
  lib/
    db.ts            # PrismaClient 单例
    errors.ts        # 错误码 + jsonError 工具
    rate-limit.ts    # DB 计数 + 进程内 LRU
    otp.ts           # 生成 / 校验 OTP
    session.ts       # 写 / 读 / 吊销 session + cookie 工具
    auth-context.ts  # 从请求抽出 user
    mailer.ts        # nodemailer 单例 + sendOtpEmail
    profile-validators.ts  # custom_fields zod 校验
    password.ts      # argon2id（PR-5）
  tests/
    otp.test.ts
    session.test.ts
    rate-limit.test.ts
    profile-validators.test.ts
    password.test.ts

app/lib/auth/                  # PR-6 前端登录态
  auth-client.ts               # fetch 封装
  use-current-user.ts          # SWR-like hook（无 SWR 依赖，用 useSyncExternalStore）
  login-dialog.tsx             # 邮箱 + OTP 弹窗
  user-menu.tsx                # 顶栏头像 / 登录入口
  index.ts                     # barrel
```

---

## PR-0：移除 GitHub Pages

> 目标：彻底切断 GH Pages 维持的兼容分支，让后续 PR 不再被 `basePath` 干扰。

### Task 0.1：删除 GH Pages workflow 与 .nojekyll

**Files:**
- Delete: [/.github/workflows/deploy.yml](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/.github/workflows/deploy.yml)
- Delete: [/public/.nojekyll](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/public/.nojekyll)

- [ ] **Step 1：删除两个文件**

```bash
git rm .github/workflows/deploy.yml public/.nojekyll
```

- [ ] **Step 2：验证 sync-cnb workflow 与知识库流水线仍在**

```bash
ls .github/workflows/        # 期望：仅剩 sync-cnb.yml
grep -n update-knowledge-base .cnb.yml   # 期望：能匹配到一行
```

- [ ] **Step 3：commit**

```bash
git commit -m "chore(gh-pages): drop deploy.yml and .nojekyll (CNB-only deployment)"
```

### Task 0.2：简化 next.config.mjs（移除 GH Pages 兼容分支）

**Files:**
- Modify: [next.config.mjs](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/next.config.mjs)

- [ ] **Step 1：写最小回归测试（vitest）**

新增 `tests/config/next-config.test.ts`：

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const path = fileURLToPath(new URL('../../next.config.mjs', import.meta.url));
const src = readFileSync(path, 'utf8');

describe('next.config.mjs (post GH-Pages)', () => {
  it('does not reference GITHUB_PAGES anymore', () => {
    expect(src).not.toMatch(/GITHUB_PAGES/);
  });
  it('does not declare a non-empty basePath', () => {
    expect(src).not.toMatch(/basePath:\s*`?\//);
  });
  it('keeps output: export for production builds', () => {
    expect(src).toMatch(/output:\s*'export'/);
  });
});
```

- [ ] **Step 2：跑测试确认失败**

```bash
npx vitest run tests/config/next-config.test.ts
```
Expected: 前两条 FAIL（当前文件含 `GITHUB_PAGES` 与 `${repo}` basePath）。

- [ ] **Step 3：替换为简化版 next.config.mjs**

把整文件替换为：

```js
import nextra from 'nextra';
import runtimeHeaders from './app/lib/playground/runtime-headers.js';

const isDev = process.env.NODE_ENV === 'development';
const {
  getWebcontainerHeaderEntries,
  shouldEnableWebcontainerHeaders
} = runtimeHeaders;

const withNextra = nextra({
  defaultShowCopyCode: true,
  search: {
    codeblocks: false
  }
});

const nextConfig = {
  reactStrictMode: true,
  // dev 与 studio 模式下不启用 export，以便注入 WebContainer COOP/COEP headers
  // 与动态路由；生产构建走 Next.js 静态导出，由 Caddy 直接托管 out/ 目录。
  ...(isDev || process.env.STUDIO_MODE === '1' ? {} : { output: 'export' }),
  images: { unoptimized: true },
  trailingSlash: true,
  env: {
    NEXT_PUBLIC_BASE_PATH: ''
  },
  experimental: {
    optimizePackageImports: ['nextra-theme-docs']
  }
};

if (
  shouldEnableWebcontainerHeaders({
    nodeEnv: process.env.NODE_ENV,
    enableRuntimeHeaders:
      process.env.ENABLE_WEBCONTAINER_RUNTIME_HEADERS === 'true'
  })
) {
  nextConfig.headers = async () => getWebcontainerHeaderEntries();
}

export default withNextra(nextConfig);
```

- [ ] **Step 4：跑测试 + 全量测试**

```bash
npx vitest run tests/config/next-config.test.ts
npm test
```
Expected：全 PASS。

- [ ] **Step 5：commit**

```bash
git add next.config.mjs tests/config/next-config.test.ts
git commit -m "chore(gh-pages): drop basePath/assetPrefix from next.config"
```

### Task 0.3：清理仓库内 NEXT_PUBLIC_BASE_PATH 兼容分支

**Files:**
- Inspect: [app/lib/comments/comments-config.ts#L71-L81](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/lib/comments/comments-config.ts#L71-L81)
- Inspect: [app/lib/pwa/register-sw.tsx](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/lib/pwa/register-sw.tsx)
- Inspect: [app/lib/playground/manifest-loader.ts](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/lib/playground/manifest-loader.ts)
- Inspect: [app/lib/base-path.js](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/lib/base-path.js)
- Inspect: [app/layout.jsx](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/layout.jsx)

- [ ] **Step 1：列出所有 basePath 兼容点**

```bash
grep -RIn "NEXT_PUBLIC_BASE_PATH\|isGhPages\|GITHUB_PAGES\|/hi-agent/" \
  app scripts public docker deploy 2>/dev/null
```

- [ ] **Step 2：判定每一处的处理方案**

由于 `NEXT_PUBLIC_BASE_PATH` 现在固定为 `''`，所有 `process.env.NEXT_PUBLIC_BASE_PATH || ''` 这类读取在运行时会产生空字符串，结果与旧代码等价。结论：**保留兼容写法**（YAGNI，不强行删），仅移除显式分支：

* [comments-config.ts#L73-L75](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/lib/comments/comments-config.ts#L73-L75) 的 `if (base && p.startsWith(base))` 分支：因 `base` 永远为 `''`，整个 if 永远不进；可以保留以备将来重新启用 basePath。**不动**。
* 其他文件中类似读法：**不动**。
* 唯一硬编码 `'/hi-agent/'` 的位置（若有）：替换为 `'/'` 或删除。

执行检查：

```bash
grep -RIn "/hi-agent/" app scripts public docker deploy 2>/dev/null \
  | grep -v node_modules | grep -v out
```

如果**无输出**：直接进入 Step 5（无需改动）。如果有输出：在 Step 3/4 中处理。

- [ ] **Step 3：（仅当 Step 2 有命中时）写测试 + 修复**

为每个被命中文件补一条断言："不再硬编码 `/hi-agent/` 字面量"。逐个 Edit 修正。

- [ ] **Step 4：跑全量测试**

```bash
npm test
```
Expected: PASS。

- [ ] **Step 5：commit（如有改动）**

```bash
git commit -am "chore(gh-pages): drop literal /hi-agent/ basePath references"
```

如 Step 2 直接判定无须改动，跳过本 commit。

### Task 0.4：构建烟测 + README 更新

**Files:**
- Modify: [README.md](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/README.md)

- [ ] **Step 1：本地构建一次确保产物可用**

```bash
NODE_ENV=production npm run build
ls out/index.html
```
Expected: 文件存在；终端没有 `basePath` 相关 warning。

- [ ] **Step 2：在 README 顶部 Deployment 段落追加一句**

定位 README 中描述部署的小节（如 "Deployment" / "部署"），在其下追加：

```markdown
> 自 2026-05 起站点统一通过 CNB 流水线（[.cnb.yml](./.cnb.yml)）构建并部署到自托管 Caddy 容器；GitHub Pages 部署已废弃，旧的 `*.github.io/hi-agent` 路径不再维护。
```

- [ ] **Step 3：commit**

```bash
git add README.md
git commit -m "docs: announce GH Pages deprecation"
```

> **手动操作（不在 plan 内执行）**：用户自行登录 GitHub 仓库 Settings → Pages 关闭站点。

### PR-0 验收清单

- [ ] `ls .github/workflows/deploy.yml` 报错（已删除）
- [ ] `npm test` 全绿
- [ ] `NODE_ENV=production npm run build` 成功，无 basePath warning
- [ ] CNB 流水线在合并后跑通（人工观察 build-test-deploy）

---

## PR-1：PostgreSQL 入网 + 环境变量样例

> 目标：把 Postgres 容器接入 compose，仅暴露本机环回端口；建立 `deploy/.env.example` 作为后续所有环境变量的入库锚点。

### Task 1.1：新增 deploy/.env.example

**Files:**
- Create: [deploy/.env.example](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/deploy/.env.example)

- [ ] **Step 1：创建文件**

写入：

```dotenv
# ---------------------------------------------------------------------------
# Hi-Agent 部署环境变量样例
# 实际值放在同目录 .env（chmod 600，已 .gitignore），由人工或运维写入。
# CI/CD（CNB pipeline）只会写入 HI_AGENT_IMAGE / AUTH_SERVER_IMAGE。
# 强随机：openssl rand -base64 32
# ---------------------------------------------------------------------------

# 镜像地址（CI 写入 RepoDigest，人工调试可用 :latest）
HI_AGENT_IMAGE=
AUTH_SERVER_IMAGE=

# PostgreSQL（仅 hi-agent-net 内部访问；本机环回 127.0.0.1:55432 用于排障）
POSTGRES_DB=hi_agent
POSTGRES_USER=hi_agent
POSTGRES_PASSWORD=

# Auth 服务
OTP_PEPPER=
SESSION_TTL_DAYS=30
SECURE_COOKIE=true

# SMTP（465→SMTP_SECURE=true，587→false）
SMTP_HOST=
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=
SMTP_PASS=
SMTP_FROM="Hi-Agent <noreply@example.com>"

# 站点 URL（写入邮件文案）
APP_BASE_URL=https://hi-agent.local
```

- [ ] **Step 2：确认 .gitignore 已覆盖真实 .env**

```bash
grep -nE '^deploy/\.env$|^deploy/\.env\b' .gitignore || echo 'deploy/.env' >> .gitignore
grep -n 'deploy/\.env' .gitignore
```
Expected: 输出至少一行匹配 `deploy/.env`。

- [ ] **Step 3：commit**

```bash
git add deploy/.env.example .gitignore
git commit -m "chore(deploy): add .env.example for postgres + auth-server"
```

### Task 1.2：在 docker-compose.yml 中加入 postgres 服务

**Files:**
- Modify: [deploy/docker-compose.yml](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/deploy/docker-compose.yml)

- [ ] **Step 1：写一条 compose 静态校验测试**

新增 `tests/deploy/compose.test.ts`：

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const composePath = fileURLToPath(
  new URL('../../deploy/docker-compose.yml', import.meta.url)
);
const yml = readFileSync(composePath, 'utf8');

describe('deploy/docker-compose.yml', () => {
  it('declares postgres service with the pinned CNB image', () => {
    expect(yml).toMatch(
      /image:\s+docker\.cnb\.cool\/jaguarliu\.cool\/wenyuan-ai\/docker-sync\/postgres:16-alpine_amd64/
    );
  });
  it('binds postgres only to 127.0.0.1:55432', () => {
    expect(yml).toMatch(/"127\.0\.0\.1:55432:5432"/);
  });
  it('declares hi-agent-net network and pg-data volume', () => {
    expect(yml).toMatch(/hi-agent-net/);
    expect(yml).toMatch(/pg-data/);
  });
  it('hi-agent service still requires HI_AGENT_IMAGE', () => {
    expect(yml).toMatch(/\$\{HI_AGENT_IMAGE:\?/);
  });
});
```

- [ ] **Step 2：跑测试确认全部 FAIL**

```bash
npx vitest run tests/deploy/compose.test.ts
```

- [ ] **Step 3：替换 deploy/docker-compose.yml 为新版（暂不引入 auth-server，PR-4 再加）**

整个文件替换为：

```yaml
services:
  postgres:
    image: docker.cnb.cool/jaguarliu.cool/wenyuan-ai/docker-sync/postgres:16-alpine_amd64
    container_name: hi-agent-postgres
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${POSTGRES_DB:?POSTGRES_DB must be set}
      POSTGRES_USER: ${POSTGRES_USER:?POSTGRES_USER must be set}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?POSTGRES_PASSWORD must be set}
      TZ: Asia/Shanghai
    volumes:
      - pg-data:/var/lib/postgresql/data
    networks: [hi-agent-net]
    ports:
      # 仅本机环回；55432 避免与本地 PG 实例冲突
      - "127.0.0.1:55432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $${POSTGRES_USER} -d $${POSTGRES_DB}"]
      interval: 10s
      timeout: 5s
      retries: 10
      start_period: 20s

  hi-agent:
    # HI_AGENT_IMAGE 由 CNB 部署流水线写入；缺失则 compose 直接失败，避免静默回退到旧 :latest
    image: ${HI_AGENT_IMAGE:?HI_AGENT_IMAGE must be set in .env (deploy pipeline writes it)}
    container_name: hi-agent
    restart: unless-stopped
    ports:
      - "127.0.0.1:8080:80"
    networks: [hi-agent-net]
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://127.0.0.1/"]
      interval: 30s
      timeout: 5s
      retries: 3

networks:
  hi-agent-net:
    name: hi-agent-net
    driver: bridge

volumes:
  pg-data:
    name: hi-agent-pg-data
```

- [ ] **Step 4：跑测试 + compose 语法验证**

```bash
npx vitest run tests/deploy/compose.test.ts
docker compose -f deploy/docker-compose.yml --env-file deploy/.env.example config >/dev/null
```
Expected: 测试 PASS；compose config 不报错（虽然 image 字段为空会 warning，但 syntax 通过）。

> 如果本地 docker 不可用，跳过 `docker compose config`，仅依赖 vitest 校验。

- [ ] **Step 5：commit**

```bash
git add deploy/docker-compose.yml tests/deploy/compose.test.ts
git commit -m "feat(db): add postgres service to docker-compose"
```

### Task 1.3：本机连通性烟测（可选 / 仅本地）

> 该 task **不修改任何源码**，仅作上线前验证。CI 不执行此步。

- [ ] **Step 1：填一份本地 .env**

```bash
cp deploy/.env.example deploy/.env
# 编辑 deploy/.env，至少填：
#   POSTGRES_PASSWORD=$(openssl rand -base64 32)
#   HI_AGENT_IMAGE=docker.cnb.cool/jaguarliuu/hi-agent:latest  # 任意可拉镜像，仅为通过 compose ${VAR:?} 校验
chmod 600 deploy/.env
```

- [ ] **Step 2：拉起 postgres 单容器**

```bash
docker compose -f deploy/docker-compose.yml --env-file deploy/.env up -d postgres
docker compose -f deploy/docker-compose.yml --env-file deploy/.env ps
```
Expected: postgres 状态 healthy。

- [ ] **Step 3：宿主机直连**

```bash
PGPASSWORD=$(grep ^POSTGRES_PASSWORD deploy/.env | cut -d= -f2-) \
  psql -h 127.0.0.1 -p 55432 -U hi_agent -d hi_agent -c '\dt'
```
Expected: 输出 "Did not find any relations."（库已建好但还没有表，符合预期）。

- [ ] **Step 4：清理**

```bash
docker compose -f deploy/docker-compose.yml --env-file deploy/.env down
```

### PR-1 验收清单

- [ ] `tests/deploy/compose.test.ts` PASS
- [ ] `deploy/.env.example` 入库且 `deploy/.env` 在 .gitignore 内
- [ ] 本地 `docker compose up postgres` 健康；`psql -h 127.0.0.1 -p 55432` 可连
- [ ] 现有 hi-agent 静态站点行为零回归（人工访问 http://127.0.0.1:8080）

---

## PR-2：server/ 工程脚手架 + Prisma 5 张表 + Dockerfile

> 目标：建立独立后端工程，跑通 `/api/health` 与首版迁移，为 PR-3 的业务逻辑铺路。

### Task 2.1：初始化 server/package.json + tsconfig.json

**Files:**
- Create: `server/package.json`
- Create: `server/tsconfig.json`
- Create: `server/.gitignore`

- [ ] **Step 1：写 package.json**

```json
{
  "name": "hi-agent-auth-server",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev -p 3000",
    "build": "prisma generate && next build",
    "start": "node server.js",
    "test": "vitest run",
    "test:watch": "vitest",
    "prisma:generate": "prisma generate",
    "prisma:migrate:dev": "prisma migrate dev",
    "prisma:migrate:deploy": "prisma migrate deploy",
    "lint:types": "tsc --noEmit"
  },
  "dependencies": {
    "@prisma/client": "^6.0.0",
    "argon2": "^0.41.1",
    "next": "^15.1.6",
    "nodemailer": "^6.9.16",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "zod": "^3.24.1"
  },
  "devDependencies": {
    "@types/node": "^22.10.7",
    "@types/nodemailer": "^6.4.16",
    "@types/react": "^19.0.7",
    "prisma": "^6.0.0",
    "typescript": "^5.7.3",
    "vitest": "^3.1.3"
  }
}
```

- [ ] **Step 2：写 tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "preserve",
    "allowJs": false,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "incremental": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./*"]
    },
    "plugins": [{ "name": "next" }]
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules", "tests/**/*"]
}
```

- [ ] **Step 3：写 server/.gitignore**

```gitignore
node_modules
.next
.next-cache
.env
.env.local
*.log
```

- [ ] **Step 4：安装依赖（首次）**

```bash
cd server && npm install --no-audit --no-fund
cd ..
```
Expected: `server/node_modules/.bin/next` 存在；`server/package-lock.json` 落盘。

- [ ] **Step 5：commit**

```bash
git add server/package.json server/package-lock.json server/tsconfig.json server/.gitignore
git commit -m "feat(auth-server): bootstrap package.json + tsconfig"
```

### Task 2.2：写 server/next.config.mjs（output: 'standalone'）

**Files:**
- Create: `server/next.config.mjs`
- Create: `server/next-env.d.ts`

- [ ] **Step 1：写 server/next.config.mjs**

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  reactStrictMode: true,
  experimental: {
    serverActions: { allowedOrigins: ['*'] }
  }
};

export default nextConfig;
```

- [ ] **Step 2：写 server/next-env.d.ts**

```ts
/// <reference types="next" />
/// <reference types="next/image-types/global" />
```

- [ ] **Step 3：commit**

```bash
git add server/next.config.mjs server/next-env.d.ts
git commit -m "feat(auth-server): next.js standalone config"
```

### Task 2.3：写 prisma/schema.prisma（5 张表）

**Files:**
- Create: `server/prisma/schema.prisma`

- [ ] **Step 1：写 schema**

```prisma
generator client {
  provider      = "prisma-client-js"
  binaryTargets = ["native", "linux-musl-openssl-3.0.x"]
}

datasource db {
  provider   = "postgresql"
  url        = env("DATABASE_URL")
  extensions = [citext]
}

enum UserStatus {
  pending
  active
  disabled
  deleted
}

enum UserRole {
  user
  editor
  admin
  superadmin
}

enum UserPlan {
  free
  pro
  team
}

enum Gender {
  unknown
  male
  female
  other
}

enum OAuthProvider {
  wechat
  github
  google
}

enum OtpPurpose {
  login
  bind_email
  reset_password
}

model User {
  id                  String      @id @default(uuid()) @db.Uuid
  email               String      @unique @db.Citext
  emailVerifiedAt     DateTime?   @map("email_verified_at")
  passwordHash        String?     @map("password_hash")
  passwordUpdatedAt   DateTime?   @map("password_updated_at")
  status              UserStatus  @default(active)
  role                UserRole    @default(user)
  plan                UserPlan    @default(free)
  planExpiresAt       DateTime?   @map("plan_expires_at")
  referrerUserId      String?     @map("referrer_user_id") @db.Uuid
  referralCode        String?     @unique @map("referral_code")
  lastLoginAt         DateTime?   @map("last_login_at")
  lastLoginIp         String?     @map("last_login_ip") @db.Inet
  lastLoginUa         String?     @map("last_login_ua")
  loginCount          Int         @default(0) @map("login_count")
  failedLoginCount    Int         @default(0) @db.SmallInt @map("failed_login_count")
  lockedUntil         DateTime?   @map("locked_until")
  flags               Json        @default("{}")
  createdAt           DateTime    @default(now()) @map("created_at")
  updatedAt           DateTime    @updatedAt @map("updated_at")
  deletedAt           DateTime?   @map("deleted_at")

  profile             UserProfile?
  oauthAccounts       OAuthAccount[]
  sessions            Session[]
  referrer            User?       @relation("UserReferrer", fields: [referrerUserId], references: [id])
  referees            User[]      @relation("UserReferrer")

  @@index([status])
  @@map("users")
}

model UserProfile {
  userId             String    @id @map("user_id") @db.Uuid
  displayName        String?   @map("display_name")
  username           String?   @unique @db.Citext
  avatarUrl          String?   @map("avatar_url")
  bio                String?
  gender             Gender    @default(unknown)
  birthday           DateTime? @db.Date
  location           String?
  occupation         String?
  learningGoal       String?   @map("learning_goal")
  websiteUrl         String?   @map("website_url")
  socialLinks        Json      @default("{}") @map("social_links")
  locale             String    @default("zh-CN")
  timezone           String    @default("Asia/Shanghai")
  notificationPrefs  Json      @default("{}") @map("notification_prefs")
  customFields       Json      @default("{}") @map("custom_fields")
  metadata           Json      @default("{}")
  createdAt          DateTime  @default(now()) @map("created_at")
  updatedAt          DateTime  @updatedAt @map("updated_at")

  user               User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("user_profiles")
}

model OAuthAccount {
  id                  String        @id @default(uuid()) @db.Uuid
  userId              String        @map("user_id") @db.Uuid
  provider            OAuthProvider
  providerAccountId   String        @map("provider_account_id")
  providerUsername    String?       @map("provider_username")
  accessTokenEnc      Bytes?        @map("access_token_enc")
  refreshTokenEnc     Bytes?        @map("refresh_token_enc")
  tokenExpiresAt      DateTime?     @map("token_expires_at")
  scope               String?
  rawProfile          Json?         @map("raw_profile")
  createdAt           DateTime      @default(now()) @map("created_at")
  updatedAt           DateTime      @updatedAt @map("updated_at")

  user                User          @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
  @@index([userId])
  @@map("oauth_accounts")
}

model EmailOtp {
  id          String     @id @default(uuid()) @db.Uuid
  email       String     @db.Citext
  codeHash    String     @map("code_hash")
  purpose     OtpPurpose
  expiresAt   DateTime   @map("expires_at")
  consumedAt  DateTime?  @map("consumed_at")
  attempts    Int        @default(0) @db.SmallInt
  requestIp   String?    @map("request_ip") @db.Inet
  createdAt   DateTime   @default(now()) @map("created_at")

  @@index([email, purpose, createdAt(sort: Desc)])
  @@index([expiresAt])
  @@map("email_otps")
}

model Session {
  id          String     @id
  userId      String     @map("user_id") @db.Uuid
  expiresAt   DateTime   @map("expires_at")
  lastSeenAt  DateTime   @map("last_seen_at")
  ip          String?    @db.Inet
  userAgent   String?    @map("user_agent")
  revokedAt   DateTime?  @map("revoked_at")
  createdAt   DateTime   @default(now()) @map("created_at")

  user        User       @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, revokedAt])
  @@index([expiresAt])
  @@map("sessions")
}
```

- [ ] **Step 2：generate 验证语法**

```bash
cd server && npx prisma generate
cd ..
```
Expected: 输出 "✔ Generated Prisma Client"。

- [ ] **Step 3：commit**

```bash
git add server/prisma/schema.prisma
git commit -m "feat(db): prisma schema with 5 tables"
```

### Task 2.4：手写 0001_init 迁移（含 CREATE EXTENSION citext）

**Files:**
- Create: `server/prisma/migrations/0001_init/migration.sql`
- Create: `server/prisma/migrations/migration_lock.toml`

> 用 `prisma migrate diff` 自动生成的 SQL 不会带 `CREATE EXTENSION citext`，所以手写 baseline。

- [ ] **Step 1：在本地起一个临时 Postgres 用于生成 diff**

```bash
docker run -d --rm --name pgmig -e POSTGRES_PASSWORD=tmp -p 5499:5432 \
  docker.cnb.cool/jaguarliu.cool/wenyuan-ai/docker-sync/postgres:16-alpine_amd64
sleep 5
PGPASSWORD=tmp psql -h 127.0.0.1 -p 5499 -U postgres -c 'CREATE EXTENSION citext;'
```

- [ ] **Step 2：让 prisma 自动生成 SQL**

```bash
cd server
DATABASE_URL='postgresql://postgres:tmp@127.0.0.1:5499/postgres?schema=public' \
  npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma \
  --script > /tmp/0001_body.sql
cd ..
```

- [ ] **Step 3：拼装最终 migration.sql（在头部追加 citext 扩展）**

新建 `server/prisma/migrations/0001_init/migration.sql`：

```sql
-- 启用 citext（让邮箱列大小写不敏感）；inet / gen_random_uuid 在 PG14+ 内置
CREATE EXTENSION IF NOT EXISTS citext;
```

把 `/tmp/0001_body.sql` 的内容追加到该文件末尾（保留 Prisma 生成的 CREATE TYPE / CREATE TABLE / CREATE INDEX / 外键，全部不动）。

- [ ] **Step 4：写 migration_lock.toml**

```toml
provider = "postgresql"
```

- [ ] **Step 5：清理临时容器**

```bash
docker stop pgmig
```

- [ ] **Step 6：用临时容器把迁移演练一遍**

```bash
docker run -d --rm --name pgmig -e POSTGRES_PASSWORD=tmp -p 5499:5432 \
  docker.cnb.cool/jaguarliu.cool/wenyuan-ai/docker-sync/postgres:16-alpine_amd64
sleep 5
cd server
DATABASE_URL='postgresql://postgres:tmp@127.0.0.1:5499/postgres?schema=public' \
  npx prisma migrate deploy
DATABASE_URL='postgresql://postgres:tmp@127.0.0.1:5499/postgres?schema=public' \
  npx prisma db pull --print | head -40
cd ..
docker stop pgmig
```
Expected: `migrate deploy` 输出 "1 migration applied"；`db pull` 能列出 5 张表。

- [ ] **Step 7：commit**

```bash
git add server/prisma/migrations
git commit -m "feat(db): initial migration with citext extension"
```

### Task 2.5：写 server/lib/db.ts（PrismaClient 单例）

**Files:**
- Create: `server/lib/db.ts`

- [ ] **Step 1：写代码**

```ts
import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var __prisma__: PrismaClient | undefined;
}

export const prisma =
  globalThis.__prisma__ ??
  new PrismaClient({
    log:
      process.env.LOG_LEVEL === 'debug'
        ? ['query', 'error', 'warn']
        : ['error', 'warn']
  });

if (process.env.NODE_ENV !== 'production') {
  globalThis.__prisma__ = prisma;
}
```

- [ ] **Step 2：commit**

```bash
git add server/lib/db.ts
git commit -m "feat(auth-server): prisma client singleton"
```

### Task 2.6：写 server/app/api/health/route.ts

**Files:**
- Create: `server/app/api/health/route.ts`
- Create: `server/tests/health.test.ts`

- [ ] **Step 1：写测试**

```ts
import { describe, it, expect } from 'vitest';
import { GET } from '@/app/api/health/route';

describe('GET /api/health', () => {
  it('returns ok=true with timestamp', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(typeof body.ts).toBe('number');
  });
});
```

- [ ] **Step 2：写 vitest.config**

新建 `server/vitest.config.ts`：

```ts
import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globals: false,
    pool: 'forks'
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./', import.meta.url))
    }
  }
});
```

- [ ] **Step 3：跑测试确认 FAIL**

```bash
cd server && npx vitest run tests/health.test.ts
```
Expected: FAIL（route 不存在）。

- [ ] **Step 4：写 route handler**

`server/app/api/health/route.ts`：

```ts
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export function GET() {
  return NextResponse.json({ ok: true, ts: Date.now() });
}
```

- [ ] **Step 5：跑测试 PASS + 类型检查**

```bash
cd server && npx vitest run tests/health.test.ts && npm run lint:types && cd ..
```

- [ ] **Step 6：commit**

```bash
git add server/app/api/health/route.ts server/tests/health.test.ts server/vitest.config.ts
git commit -m "feat(auth-server): /api/health endpoint"
```

### Task 2.7：写 Dockerfile + entrypoint.sh + .dockerignore

**Files:**
- Create: `server/Dockerfile`
- Create: `server/scripts/entrypoint.sh`
- Create: `server/.dockerignore`

- [ ] **Step 1：server/.dockerignore**

```
node_modules
.next
.next-cache
.env
.env.*
*.log
tests
**/*.test.ts
```

- [ ] **Step 2：server/scripts/entrypoint.sh**

```sh
#!/bin/sh
set -e
echo "[entrypoint] running prisma migrate deploy ..."
npx prisma migrate deploy
exec "$@"
```

- [ ] **Step 3：server/Dockerfile（多阶段构建）**

```dockerfile
# syntax=docker/dockerfile:1.7

# ----- 1. install deps -----
FROM node:20-alpine AS deps
WORKDIR /app
COPY server/package.json server/package-lock.json ./
RUN npm ci --include=dev

# ----- 2. build standalone -----
FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY server/. ./
RUN npx prisma generate
RUN npm run build

# ----- 3. runtime -----
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000
RUN apk add --no-cache wget tini
# Next.js standalone 产物
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
# Prisma 客户端 + 迁移文件
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma
# entrypoint
COPY server/scripts/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health >/dev/null || exit 1
ENTRYPOINT ["/sbin/tini","--","/usr/local/bin/entrypoint.sh"]
CMD ["node","server.js"]
```

- [ ] **Step 4：本地构建镜像**

```bash
chmod +x server/scripts/entrypoint.sh
docker build -f server/Dockerfile -t hi-agent-auth:dev .
```
Expected: 构建成功，最终镜像 `hi-agent-auth:dev`。

- [ ] **Step 5：用临时 Postgres 跑一次完整 lift**

```bash
docker network create hi-agent-net 2>/dev/null || true
docker run -d --rm --name pgmig --network hi-agent-net \
  -e POSTGRES_DB=hi_agent -e POSTGRES_USER=hi_agent -e POSTGRES_PASSWORD=tmp \
  docker.cnb.cool/jaguarliu.cool/wenyuan-ai/docker-sync/postgres:16-alpine_amd64
sleep 6
docker run --rm --network hi-agent-net -p 3000:3000 \
  -e DATABASE_URL='postgresql://hi_agent:tmp@pgmig:5432/hi_agent?schema=public' \
  -e OTP_PEPPER=devpepper -e SESSION_TTL_DAYS=30 -e SECURE_COOKIE=false \
  -e SMTP_HOST=localhost -e SMTP_PORT=25 -e SMTP_SECURE=false \
  -e SMTP_USER=dev -e SMTP_PASS=dev -e SMTP_FROM='dev <dev@local>' \
  -e APP_BASE_URL=http://localhost:3000 \
  --name auth-test hi-agent-auth:dev &
sleep 8
curl -fsS http://127.0.0.1:3000/api/health
docker stop auth-test pgmig
docker network rm hi-agent-net 2>/dev/null || true
```
Expected: 输出 `{"ok":true,"ts":...}`，且容器日志中可见 "1 migration applied"。

- [ ] **Step 6：commit**

```bash
git add server/Dockerfile server/scripts/entrypoint.sh server/.dockerignore
git commit -m "feat(auth-server): multi-stage Dockerfile + entrypoint with auto-migrate"
```

### PR-2 验收清单

- [ ] `cd server && npm run build` 成功
- [ ] `cd server && npm test` 全绿（含 health.test）
- [ ] `cd server && npm run lint:types` 无错
- [ ] `docker build -f server/Dockerfile -t hi-agent-auth:dev .` 成功
- [ ] `curl /api/health` 返回 `{ok:true}`，且日志显示迁移已执行；目标库出现 5 张表

---

## PR-3：OTP + Session 核心逻辑 + 4 个 auth 路由 + 单测

> 目标：在 PR-2 的脚手架上实现"邮箱 OTP 注册即登录"主流程。

### Task 3.1：写 server/lib/errors.ts（错误码 + jsonError）

**Files:**
- Create: `server/lib/errors.ts`

- [ ] **Step 1：写代码**

```ts
import { NextResponse } from 'next/server';

export const ERROR_CODES = {
  RATE_LIMITED: { http: 429, message: '请求过于频繁，请稍后再试' },
  INVALID_INPUT: { http: 400, message: '入参不合法' },
  INVALID_OR_EXPIRED: { http: 410, message: '验证码错误或已过期' },
  UNAUTHORIZED: { http: 401, message: '未登录或会话已过期' },
  FORBIDDEN: { http: 403, message: '无权限' },
  ACCOUNT_DISABLED: { http: 423, message: '账号已停用' },
  NOT_IMPLEMENTED: { http: 501, message: '功能尚未上线' },
  INTERNAL: { http: 500, message: '服务异常' }
} as const;

export type ErrorCode = keyof typeof ERROR_CODES;

export function jsonError(code: ErrorCode, extra?: Record<string, unknown>) {
  const def = ERROR_CODES[code];
  return NextResponse.json(
    { ok: false, code, message: def.message, ...extra },
    { status: def.http }
  );
}

export function jsonOk<T extends Record<string, unknown>>(data: T) {
  return NextResponse.json({ ok: true, ...data });
}
```

- [ ] **Step 2：commit**

```bash
git add server/lib/errors.ts
git commit -m "feat(auth-server): error code helpers"
```

### Task 3.2：写 server/lib/rate-limit.ts（DB 计数 + 进程内 LRU）

**Files:**
- Create: `server/lib/rate-limit.ts`
- Create: `server/tests/rate-limit.test.ts`

- [ ] **Step 1：写测试**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { LruCounter } from '@/lib/rate-limit';

describe('LruCounter', () => {
  let c: LruCounter;
  beforeEach(() => {
    c = new LruCounter({ max: 3 });
  });

  it('increments and returns count within window', () => {
    expect(c.hit('a', 60_000)).toBe(1);
    expect(c.hit('a', 60_000)).toBe(2);
    expect(c.hit('b', 60_000)).toBe(1);
  });

  it('expires entries after window', () => {
    c.hit('a', 1);
    return new Promise<void>((resolve) =>
      setTimeout(() => {
        expect(c.hit('a', 1)).toBe(1);
        resolve();
      }, 5)
    );
  });

  it('evicts the LRU when over capacity', () => {
    c.hit('a', 60_000);
    c.hit('b', 60_000);
    c.hit('c', 60_000);
    c.hit('d', 60_000); // evicts a
    expect(c.hit('a', 60_000)).toBe(1);
  });
});
```

- [ ] **Step 2：跑测试确认 FAIL**

```bash
cd server && npx vitest run tests/rate-limit.test.ts
```

- [ ] **Step 3：写 lib/rate-limit.ts**

```ts
import { prisma } from '@/lib/db';

interface Entry {
  count: number;
  expiresAt: number;
}

export class LruCounter {
  private map = new Map<string, Entry>();
  constructor(private opts: { max: number }) {}

  hit(key: string, windowMs: number): number {
    const now = Date.now();
    const cur = this.map.get(key);
    if (cur && cur.expiresAt > now) {
      cur.count += 1;
      this.map.delete(key);
      this.map.set(key, cur);
      return cur.count;
    }
    if (this.map.size >= this.opts.max) {
      const oldest = this.map.keys().next().value;
      if (oldest !== undefined) this.map.delete(oldest);
    }
    const entry: Entry = { count: 1, expiresAt: now + windowMs };
    this.map.set(key, entry);
    return 1;
  }
}

const ipCounter = new LruCounter({ max: 4096 });

/** 全局 /api/auth/* 每 IP 100 req/min */
export function ipHit(ip: string): number {
  return ipCounter.hit(`ip:${ip}`, 60_000);
}

/** 同一 email 发码限频策略
 *  - 60s 内 1 次
 *  - 1h 最多 5 次
 *  - 24h 最多 10 次
 *  返回值：null 表示可发；string 是用户可见的拒绝原因
 */
export async function checkEmailOtpQuota(email: string): Promise<string | null> {
  const now = new Date();
  const oneMinAgo = new Date(now.getTime() - 60_000);
  const oneHourAgo = new Date(now.getTime() - 3_600_000);
  const oneDayAgo = new Date(now.getTime() - 86_400_000);

  const [last60s, lastHour, lastDay] = await Promise.all([
    prisma.emailOtp.count({
      where: { email, purpose: 'login', createdAt: { gte: oneMinAgo } }
    }),
    prisma.emailOtp.count({
      where: { email, purpose: 'login', createdAt: { gte: oneHourAgo } }
    }),
    prisma.emailOtp.count({
      where: { email, purpose: 'login', createdAt: { gte: oneDayAgo } }
    })
  ]);

  if (last60s >= 1) return '60 秒内只能发送一次';
  if (lastHour >= 5) return '1 小时内已达上限';
  if (lastDay >= 10) return '24 小时内已达上限';
  return null;
}

/** 校验失败暂封：1h 内同 email 失败 ≥20 次 → 暂封 30min */
export async function checkVerifyAbuse(email: string): Promise<boolean> {
  const oneHourAgo = new Date(Date.now() - 3_600_000);
  const failed = await prisma.emailOtp.count({
    where: {
      email,
      purpose: 'login',
      createdAt: { gte: oneHourAgo },
      attempts: { gte: 5 }
    }
  });
  return failed >= 20;
}
```

- [ ] **Step 4：跑测试 PASS**

```bash
cd server && npx vitest run tests/rate-limit.test.ts && cd ..
```

- [ ] **Step 5：commit**

```bash
git add server/lib/rate-limit.ts server/tests/rate-limit.test.ts
git commit -m "feat(auth-server): rate limit helpers"
```

### Task 3.3：写 server/lib/otp.ts（生成 / 校验）

**Files:**
- Create: `server/lib/otp.ts`
- Create: `server/tests/otp.test.ts`

- [ ] **Step 1：写测试**

```ts
import { describe, it, expect } from 'vitest';
import { generateOtpCode, hashOtp } from '@/lib/otp';

describe('otp helpers', () => {
  it('generateOtpCode produces 6 digits', () => {
    for (let i = 0; i < 50; i++) {
      const c = generateOtpCode();
      expect(c).toMatch(/^\d{6}$/);
    }
  });

  it('hashOtp is deterministic for same code+pepper', () => {
    expect(hashOtp('123456', 'pepper')).toBe(hashOtp('123456', 'pepper'));
  });

  it('hashOtp differs when pepper changes', () => {
    expect(hashOtp('123456', 'p1')).not.toBe(hashOtp('123456', 'p2'));
  });
});
```

- [ ] **Step 2：跑测试 FAIL**

```bash
cd server && npx vitest run tests/otp.test.ts
```

- [ ] **Step 3：写 lib/otp.ts**

```ts
import { createHash, randomInt } from 'node:crypto';

export function generateOtpCode(): string {
  // crypto.randomInt 是密码学安全 RNG
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

export function hashOtp(code: string, pepper: string): string {
  return createHash('sha256').update(`${code}|${pepper}`).digest('hex');
}

export function getPepper(): string {
  const p = process.env.OTP_PEPPER;
  if (!p) throw new Error('OTP_PEPPER is not set');
  return p;
}
```

- [ ] **Step 4：跑测试 PASS**

```bash
cd server && npx vitest run tests/otp.test.ts && cd ..
```

- [ ] **Step 5：commit**

```bash
git add server/lib/otp.ts server/tests/otp.test.ts
git commit -m "feat(auth-server): otp generate/hash"
```

### Task 3.4：写 server/lib/session.ts（创建 / 读取 / 吊销 + Cookie 工具）

**Files:**
- Create: `server/lib/session.ts`
- Create: `server/tests/session.test.ts`

- [ ] **Step 1：写测试**

```ts
import { describe, it, expect } from 'vitest';
import { generateSessionId, buildSetCookie, buildClearCookie } from '@/lib/session';

describe('session token helpers', () => {
  it('generateSessionId returns 43-char base64url string (32 bytes)', () => {
    const sid = generateSessionId();
    expect(sid).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it('buildSetCookie carries HttpOnly + Secure + SameSite=Lax + Max-Age', () => {
    const c = buildSetCookie('abc', { secure: true, ttlSeconds: 2592000 });
    expect(c).toContain('hi_sid=abc');
    expect(c).toContain('HttpOnly');
    expect(c).toContain('Secure');
    expect(c).toContain('SameSite=Lax');
    expect(c).toContain('Path=/');
    expect(c).toContain('Max-Age=2592000');
  });

  it('buildSetCookie omits Secure when secure=false (dev)', () => {
    const c = buildSetCookie('abc', { secure: false, ttlSeconds: 60 });
    expect(c).not.toContain('Secure');
  });

  it('buildClearCookie sets Max-Age=0', () => {
    const c = buildClearCookie({ secure: true });
    expect(c).toContain('Max-Age=0');
    expect(c).toContain('hi_sid=;');
  });
});
```

- [ ] **Step 2：跑测试 FAIL**

```bash
cd server && npx vitest run tests/session.test.ts
```

- [ ] **Step 3：写 lib/session.ts**

```ts
import { randomBytes } from 'node:crypto';
import { prisma } from '@/lib/db';

export const COOKIE_NAME = process.env.SESSION_COOKIE_NAME || 'hi_sid';

export function getSessionTtlSeconds(): number {
  const days = Number(process.env.SESSION_TTL_DAYS || '30');
  return days * 24 * 60 * 60;
}

export function isSecureCookie(): boolean {
  return process.env.SECURE_COOKIE !== 'false';
}

export function generateSessionId(): string {
  return randomBytes(32).toString('base64url');
}

export interface CookieOpts {
  secure: boolean;
  ttlSeconds: number;
}

export function buildSetCookie(sid: string, opts: CookieOpts): string {
  const parts = [
    `${COOKIE_NAME}=${sid}`,
    'HttpOnly',
    'Path=/',
    'SameSite=Lax',
    `Max-Age=${opts.ttlSeconds}`
  ];
  if (opts.secure) parts.splice(2, 0, 'Secure');
  return parts.join('; ');
}

export function buildClearCookie(opts: { secure: boolean }): string {
  const parts = [
    `${COOKIE_NAME}=`,
    'HttpOnly',
    'Path=/',
    'SameSite=Lax',
    'Max-Age=0'
  ];
  if (opts.secure) parts.splice(2, 0, 'Secure');
  return parts.join('; ');
}

/** 创建会话并落库 */
export async function createSession(args: {
  userId: string;
  ip?: string | null;
  userAgent?: string | null;
}): Promise<{ id: string; expiresAt: Date }> {
  const id = generateSessionId();
  const ttlMs = getSessionTtlSeconds() * 1000;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlMs);
  await prisma.session.create({
    data: {
      id,
      userId: args.userId,
      expiresAt,
      lastSeenAt: now,
      ip: args.ip ?? null,
      userAgent: args.userAgent ?? null
    }
  });
  return { id, expiresAt };
}

/** 取活跃会话 + 滑动续期（lastSeenAt 节流到 60s） */
export async function touchSession(sid: string) {
  const row = await prisma.session.findUnique({ where: { id: sid } });
  if (!row) return null;
  if (row.revokedAt) return null;
  if (row.expiresAt.getTime() <= Date.now()) return null;
  if (Date.now() - row.lastSeenAt.getTime() > 60_000) {
    await prisma.session.update({
      where: { id: sid },
      data: { lastSeenAt: new Date() }
    });
  }
  return row;
}

export async function revokeSession(sid: string) {
  await prisma.session.updateMany({
    where: { id: sid, revokedAt: null },
    data: { revokedAt: new Date() }
  });
}

export async function revokeOtherSessions(userId: string, keepSid: string) {
  await prisma.session.updateMany({
    where: { userId, id: { not: keepSid }, revokedAt: null },
    data: { revokedAt: new Date() }
  });
}
```

- [ ] **Step 4：跑测试 PASS**

```bash
cd server && npx vitest run tests/session.test.ts && cd ..
```

- [ ] **Step 5：commit**

```bash
git add server/lib/session.ts server/tests/session.test.ts
git commit -m "feat(auth-server): session lifecycle + cookie helpers"
```

### Task 3.5：写 server/lib/auth-context.ts（请求 → user）

**Files:**
- Create: `server/lib/auth-context.ts`

- [ ] **Step 1：写代码**

```ts
import type { NextRequest } from 'next/server';
import { COOKIE_NAME, touchSession } from '@/lib/session';
import { prisma } from '@/lib/db';

export interface AuthedUser {
  id: string;
  email: string;
  status: 'pending' | 'active' | 'disabled' | 'deleted';
  role: 'user' | 'editor' | 'admin' | 'superadmin';
}

export async function getAuthedUser(req: NextRequest): Promise<{
  sid: string;
  user: AuthedUser;
} | null> {
  const sid = req.cookies.get(COOKIE_NAME)?.value;
  if (!sid) return null;
  const session = await touchSession(sid);
  if (!session) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, email: true, status: true, role: true }
  });
  if (!user || user.status === 'deleted') return null;
  return { sid, user };
}

export function getClientIp(req: NextRequest): string | null {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0]!.trim();
  return req.headers.get('x-real-ip');
}
```

- [ ] **Step 2：commit**

```bash
git add server/lib/auth-context.ts
git commit -m "feat(auth-server): request → user resolver"
```

### Task 3.6：写 server/lib/mailer.ts（nodemailer + sendOtpEmail）

**Files:**
- Create: `server/lib/mailer.ts`

- [ ] **Step 1：写代码**

```ts
import nodemailer from 'nodemailer';

let cached: nodemailer.Transporter | null = null;

function getTransport() {
  if (cached) return cached;
  cached = nodemailer.createTransport({
    host: process.env.SMTP_HOST!,
    port: Number(process.env.SMTP_PORT || '465'),
    secure: process.env.SMTP_SECURE !== 'false',
    auth: {
      user: process.env.SMTP_USER!,
      pass: process.env.SMTP_PASS!
    }
  });
  return cached;
}

export async function sendOtpEmail(to: string, code: string) {
  const from = process.env.SMTP_FROM || 'noreply@example.com';
  const subject = `【Hi-Agent】你的登录验证码：${code}`;
  const text = [
    `你的 Hi-Agent 登录验证码是：${code}`,
    '',
    '验证码 10 分钟内有效，请勿向他人转述。',
    '如非本人操作，请忽略本邮件。',
    '',
    '— Hi-Agent'
  ].join('\n');
  await getTransport().sendMail({ from, to, subject, text });
}
```

- [ ] **Step 2：commit**

```bash
git add server/lib/mailer.ts
git commit -m "feat(auth-server): nodemailer transport + otp mail template"
```

### Task 3.7：实现 POST /api/auth/otp/request

**Files:**
- Create: `server/app/api/auth/otp/request/route.ts`

- [ ] **Step 1：写 route**

```ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { jsonError, jsonOk } from '@/lib/errors';
import { generateOtpCode, hashOtp, getPepper } from '@/lib/otp';
import { checkEmailOtpQuota, ipHit } from '@/lib/rate-limit';
import { sendOtpEmail } from '@/lib/mailer';
import { getClientIp } from '@/lib/auth-context';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z.object({
  email: z.string().email().max(254).trim().toLowerCase()
});

export async function POST(req: NextRequest) {
  const ip = getClientIp(req) ?? 'unknown';
  if (ipHit(ip) > 100) {
    return jsonError('RATE_LIMITED', { retryAfterSec: 60 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError('INVALID_INPUT');
  }
  const parsed = Body.safeParse(body);
  if (!parsed.success) return jsonError('INVALID_INPUT');

  const email = parsed.data.email;
  const reason = await checkEmailOtpQuota(email);
  if (reason) {
    // 即便触发限频，也不暴露 email 是否注册——返回 RATE_LIMITED 即可
    return jsonError('RATE_LIMITED', { retryAfterSec: 60 });
  }

  const code = generateOtpCode();
  const codeHash = hashOtp(code, getPepper());
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  await prisma.emailOtp.create({
    data: {
      email,
      codeHash,
      purpose: 'login',
      expiresAt,
      requestIp: ip === 'unknown' ? null : ip
    }
  });

  // 异步发邮件；失败仅记录，不影响响应（防邮箱枚举 + 用户体验）
  sendOtpEmail(email, code).catch((err) => {
    console.error('[mailer] send failed', { email, err: String(err) });
  });

  return jsonOk({});
}
```

- [ ] **Step 2：commit**

```bash
git add server/app/api/auth/otp/request/route.ts
git commit -m "feat(auth): POST /api/auth/otp/request"
```

### Task 3.8：实现 POST /api/auth/otp/verify

**Files:**
- Create: `server/app/api/auth/otp/verify/route.ts`

- [ ] **Step 1：写 route**

```ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { jsonError } from '@/lib/errors';
import { hashOtp, getPepper } from '@/lib/otp';
import { checkVerifyAbuse, ipHit } from '@/lib/rate-limit';
import { createSession, buildSetCookie, isSecureCookie, getSessionTtlSeconds } from '@/lib/session';
import { getClientIp } from '@/lib/auth-context';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z.object({
  email: z.string().email().max(254).trim().toLowerCase(),
  code: z.string().regex(/^\d{6}$/)
});

export async function POST(req: NextRequest) {
  const ip = getClientIp(req) ?? 'unknown';
  if (ipHit(ip) > 100) return jsonError('RATE_LIMITED', { retryAfterSec: 60 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError('INVALID_INPUT');
  }
  const parsed = Body.safeParse(body);
  if (!parsed.success) return jsonError('INVALID_INPUT');
  const { email, code } = parsed.data;

  if (await checkVerifyAbuse(email)) {
    return jsonError('RATE_LIMITED', { retryAfterSec: 1800 });
  }

  // 取最近一条 login 用未消费 OTP
  const otp = await prisma.emailOtp.findFirst({
    where: {
      email,
      purpose: 'login',
      consumedAt: null,
      expiresAt: { gt: new Date() }
    },
    orderBy: { createdAt: 'desc' }
  });
  if (!otp) return jsonError('INVALID_OR_EXPIRED');
  if (otp.attempts >= 5) return jsonError('INVALID_OR_EXPIRED');

  const expectedHash = hashOtp(code, getPepper());
  if (expectedHash !== otp.codeHash) {
    await prisma.emailOtp.update({
      where: { id: otp.id },
      data: { attempts: { increment: 1 } }
    });
    return jsonError('INVALID_OR_EXPIRED');
  }

  // 标记 consumed + 创建/更新 user + 写 session（事务）
  const userAgent = req.headers.get('user-agent');

  const user = await prisma.$transaction(async (tx) => {
    await tx.emailOtp.update({
      where: { id: otp.id },
      data: { consumedAt: new Date() }
    });
    const existing = await tx.user.findUnique({ where: { email } });
    if (existing) {
      if (existing.status === 'disabled') {
        throw Object.assign(new Error('disabled'), { code: 'ACCOUNT_DISABLED' });
      }
      return tx.user.update({
        where: { id: existing.id },
        data: {
          emailVerifiedAt: existing.emailVerifiedAt ?? new Date(),
          lastLoginAt: new Date(),
          lastLoginIp: ip === 'unknown' ? null : ip,
          lastLoginUa: userAgent ?? null,
          loginCount: { increment: 1 },
          failedLoginCount: 0
        }
      });
    }
    const created = await tx.user.create({
      data: {
        email,
        status: 'active',
        emailVerifiedAt: new Date(),
        lastLoginAt: new Date(),
        lastLoginIp: ip === 'unknown' ? null : ip,
        lastLoginUa: userAgent ?? null,
        loginCount: 1
      }
    });
    await tx.userProfile.create({
      data: {
        userId: created.id,
        displayName: email.split('@')[0]!.slice(0, 32)
      }
    });
    return created;
  }).catch((err: { code?: string }) => {
    if (err?.code === 'ACCOUNT_DISABLED') return null;
    throw err;
  });

  if (!user) return jsonError('ACCOUNT_DISABLED');

  const { id: sid } = await createSession({
    userId: user.id,
    ip: ip === 'unknown' ? null : ip,
    userAgent
  });

  const cookie = buildSetCookie(sid, {
    secure: isSecureCookie(),
    ttlSeconds: getSessionTtlSeconds()
  });

  return new NextResponse(
    JSON.stringify({
      ok: true,
      user: { id: user.id, email: user.email }
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': cookie
      }
    }
  );
}
```

- [ ] **Step 2：commit**

```bash
git add server/app/api/auth/otp/verify/route.ts
git commit -m "feat(auth): POST /api/auth/otp/verify (register-or-login)"
```

### Task 3.9：实现 GET /api/auth/me + POST /api/auth/logout

**Files:**
- Create: `server/app/api/auth/me/route.ts`
- Create: `server/app/api/auth/logout/route.ts`

- [ ] **Step 1：写 me route**

```ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { jsonError } from '@/lib/errors';
import { getAuthedUser } from '@/lib/auth-context';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const ctx = await getAuthedUser(req);
  if (!ctx) return jsonError('UNAUTHORIZED');
  if (ctx.user.status === 'disabled') return jsonError('ACCOUNT_DISABLED');

  const profile = await prisma.userProfile.findUnique({
    where: { userId: ctx.user.id }
  });

  return NextResponse.json({
    ok: true,
    user: {
      id: ctx.user.id,
      email: ctx.user.email,
      role: ctx.user.role,
      profile: profile
        ? {
            displayName: profile.displayName,
            avatarUrl: profile.avatarUrl,
            bio: profile.bio,
            locale: profile.locale,
            timezone: profile.timezone,
            customFields: profile.customFields
          }
        : null
    }
  });
}
```

- [ ] **Step 2：写 logout route**

```ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { COOKIE_NAME, revokeSession, buildClearCookie, isSecureCookie } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const sid = req.cookies.get(COOKIE_NAME)?.value;
  if (sid) await revokeSession(sid);
  return new NextResponse(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': buildClearCookie({ secure: isSecureCookie() })
    }
  });
}
```

- [ ] **Step 3：commit**

```bash
git add server/app/api/auth/me/route.ts server/app/api/auth/logout/route.ts
git commit -m "feat(auth): GET /api/auth/me + POST /api/auth/logout"
```

### Task 3.10：端到端冒烟（本地起 server + 临时 PG）

> 该 task 不修改源码，只验证 PR-3 的整体行为。

- [ ] **Step 1：起 PG + 跑迁移**

```bash
docker run -d --rm --name pgsmoke \
  -e POSTGRES_DB=hi_agent -e POSTGRES_USER=hi_agent -e POSTGRES_PASSWORD=tmp \
  -p 5499:5432 \
  docker.cnb.cool/jaguarliu.cool/wenyuan-ai/docker-sync/postgres:16-alpine_amd64
sleep 5
cd server
DATABASE_URL='postgresql://hi_agent:tmp@127.0.0.1:5499/hi_agent?schema=public' \
  npx prisma migrate deploy
```

- [ ] **Step 2：起 dev server，伪 SMTP（mailer 失败仅打 warn，不影响主流程）**

```bash
DATABASE_URL='postgresql://hi_agent:tmp@127.0.0.1:5499/hi_agent?schema=public' \
OTP_PEPPER=devpepper SECURE_COOKIE=false SESSION_TTL_DAYS=30 \
SMTP_HOST=127.0.0.1 SMTP_PORT=2525 SMTP_SECURE=false \
SMTP_USER=dev SMTP_PASS=dev SMTP_FROM='dev <dev@local>' \
APP_BASE_URL=http://localhost:3000 \
LOG_LEVEL=debug \
npm run dev &
sleep 5
```

- [ ] **Step 3：发码 + 拿到 code（直接查 DB）**

```bash
curl -fsS -XPOST http://127.0.0.1:3000/api/auth/otp/request \
  -H 'Content-Type: application/json' -d '{"email":"foo@example.com"}'
# 期望：{"ok":true}
PGPASSWORD=tmp psql -h 127.0.0.1 -p 5499 -U hi_agent -d hi_agent -c \
  "select email, code_hash, expires_at from email_otps order by created_at desc limit 1;"
# 由于不知道明文 code，下一步直接用一个故意错的 code 验证 INVALID_OR_EXPIRED 路径
```

- [ ] **Step 4：错码触发 INVALID_OR_EXPIRED**

```bash
curl -i -XPOST http://127.0.0.1:3000/api/auth/otp/verify \
  -H 'Content-Type: application/json' \
  -d '{"email":"foo@example.com","code":"000000"}'
# 期望：HTTP/1.1 410 + body code=INVALID_OR_EXPIRED
```

- [ ] **Step 5：在 dev 模式下打开"日志打印 code"开关复跑（可选）**

> 如需端到端真发邮件，自行配置真实 SMTP；本步骤可跳过。

- [ ] **Step 6：清理**

```bash
kill %1 2>/dev/null || true
docker stop pgsmoke
cd ..
```

### PR-3 验收清单

- [ ] `cd server && npm test` 全绿（health / otp / session / rate-limit）
- [ ] `cd server && npm run lint:types` 无错
- [ ] 错码触发 410 INVALID_OR_EXPIRED；正确码全链路 200 + Set-Cookie
- [ ] 限频：同 email 在 60s 内第二次发码返回 429 RATE_LIMITED
- [ ] `/api/auth/me` 在未登录时 401，登录后返回 user + profile
- [ ] `/api/auth/logout` 后再次 `/me` 返回 401，DB 中 `sessions.revoked_at` 不为空

---

## PR-4：Caddy 反代 `/api/*` + auth-server 接入 compose

> 目标：让前端可以同源访问 `/api/auth/*`，并把 `auth-server` 加入 docker-compose 与 `hi-agent-net` 内网。完成后 `curl http://127.0.0.1:8080/api/health` 应返回 200。

### Task 4.1：新增 Caddyfile 反代段（@api → auth-server:3000）

**Files:**
- Modify: [docker/Caddyfile](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/docker/Caddyfile#L73-L80)
- Test: [docker/Caddyfile.test.sh](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/docker/Caddyfile.test.sh)

- [ ] **Step 1：写失败测试（caddy validate + 反代段存在性）**

将下面内容写入新文件 [docker/Caddyfile.test.sh](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/docker/Caddyfile.test.sh)：

```bash
#!/usr/bin/env bash
# Caddyfile 单测：
#   1. 必须包含 @api 反代段并指向 auth-server:3000
#   2. @api 段必须出现在 try_files 之前（否则静态回退会先吃掉 /api/*）
#   3. caddy validate 通过
set -euo pipefail
CADDYFILE="${1:-docker/Caddyfile}"

grep -nE '^[[:space:]]*@api[[:space:]]+path[[:space:]]+/api/\*' "$CADDYFILE" >/dev/null \
  || { echo "FAIL: missing @api matcher"; exit 1; }

grep -nE 'reverse_proxy[[:space:]]+auth-server:3000' "$CADDYFILE" >/dev/null \
  || { echo "FAIL: missing reverse_proxy auth-server:3000"; exit 1; }

API_LINE=$(grep -nE '^[[:space:]]*@api[[:space:]]+path[[:space:]]+/api/\*' "$CADDYFILE" | head -n1 | cut -d: -f1)
TRY_LINE=$(grep -nE '^[[:space:]]*try_files[[:space:]]' "$CADDYFILE" | head -n1 | cut -d: -f1)
if [ "$API_LINE" -ge "$TRY_LINE" ]; then
  echo "FAIL: @api ($API_LINE) must appear before try_files ($TRY_LINE)"
  exit 1
fi

docker run --rm -v "$PWD/docker/Caddyfile:/etc/caddy/Caddyfile:ro" caddy:2-alpine \
  caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile

echo "OK"
```

```bash
chmod +x docker/Caddyfile.test.sh
```

- [ ] **Step 2：运行测试，确认失败**

```bash
./docker/Caddyfile.test.sh
# 期望：FAIL: missing @api matcher
```

- [ ] **Step 3：实现——在 Caddyfile try_files 之前插入 @api 段**

修改 [docker/Caddyfile](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/docker/Caddyfile#L73-L80)，在 `# --- Static export routing ---` 注释块**之前**插入下列段，使 `/api/*` 在 `try_files` 之前被反代到 `auth-server:3000`：

```caddyfile
	# --- API reverse proxy ------------------------------------------
	# /api/* 走 auth-server (Next.js standalone, 监听 :3000)。
	# 必须放在 try_files 之前，否则静态回退会把 /api/foo 当作不存在的
	# 静态资源直接 rewrite 到 /404.html。
	@api path /api/*
	handle @api {
		reverse_proxy auth-server:3000 {
			header_up Host {host}
			header_up X-Real-IP {remote_host}
			header_up X-Forwarded-For {remote_host}
			header_up X-Forwarded-Proto {scheme}
		}
	}
```

> 注意：放在现有 `try_files {path} {path}/index.html ...` 那行**之上**即可。`@api` 用 `handle` 包住，避免后续 try_files/file_server 块再次处理。

- [ ] **Step 4：运行测试，确认通过**

```bash
./docker/Caddyfile.test.sh
# 期望：OK
```

- [ ] **Step 5：commit**

```bash
git add docker/Caddyfile docker/Caddyfile.test.sh
git commit -m "feat(caddy): reverse-proxy /api/* to auth-server"
```

---

### Task 4.2：docker-compose 加入 auth-server 服务（依赖 postgres）

**Files:**
- Modify: [deploy/docker-compose.yml](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/deploy/docker-compose.yml)
- Modify: [deploy/.env.example](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/deploy/.env.example)

- [ ] **Step 1：写失败测试（compose config 解析 + 服务存在性）**

新增 [deploy/docker-compose.test.sh](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/deploy/docker-compose.test.sh)：

```bash
#!/usr/bin/env bash
# docker-compose 静态校验：
#   1. compose config 不报错（YAML + 引用变量解析通过）
#   2. 必须存在 postgres / hi-agent / auth-server 三服务
#   3. auth-server depends_on postgres 且 condition: service_healthy
#   4. hi-agent 仅暴露 127.0.0.1:8080:80；auth-server 不对外暴露端口
set -euo pipefail
ENV_FILE=deploy/.env.example
COMPOSE=deploy/docker-compose.yml

docker compose -f "$COMPOSE" --env-file "$ENV_FILE" config >/tmp/compose.json

python3 - <<'PY'
import json, sys
with open('/tmp/compose.json') as f:
    cfg = f.read()
# compose config 默认输出 yaml；用 yaml 解析，python 自带 yaml 不一定有，回退到 json 形式
import subprocess
out = subprocess.check_output([
    'docker','compose','-f','deploy/docker-compose.yml',
    '--env-file','deploy/.env.example','config','--format','json'
])
data = json.loads(out)
svcs = data['services']
for need in ('postgres','hi-agent','auth-server'):
    assert need in svcs, f'missing service: {need}'

dep = svcs['auth-server'].get('depends_on', {})
assert 'postgres' in dep, 'auth-server must depend_on postgres'
cond = dep['postgres'].get('condition') if isinstance(dep['postgres'], dict) else None
assert cond == 'service_healthy', f'auth-server.depends_on.postgres.condition={cond}'

hi_ports = svcs['hi-agent'].get('ports', [])
assert any('127.0.0.1' in str(p) and ':80' in str(p) for p in hi_ports), \
    f'hi-agent must publish 127.0.0.1:8080:80, got {hi_ports}'

assert not svcs['auth-server'].get('ports'), 'auth-server must not publish ports'

print('OK')
PY
```

```bash
chmod +x deploy/docker-compose.test.sh
```

- [ ] **Step 2：运行测试，确认失败**

```bash
./deploy/docker-compose.test.sh
# 期望：assert 'auth-server' in svcs 失败
```

- [ ] **Step 3：实现——更新 compose 与 .env.example**

将 [deploy/docker-compose.yml](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/deploy/docker-compose.yml) 整体替换为下列内容（在 PR-1 已加入的 postgres 基础上增补 hi-agent 网络与 auth-server）：

```yaml
services:
  postgres:
    image: docker.cnb.cool/jaguarliu.cool/wenyuan-ai/docker-sync/postgres:16-alpine_amd64
    container_name: hi-agent-postgres
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${POSTGRES_DB:?missing}
      POSTGRES_USER: ${POSTGRES_USER:?missing}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?missing}
    ports:
      - "127.0.0.1:55432:5432"
    volumes:
      - hi-agent-pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $${POSTGRES_USER} -d $${POSTGRES_DB}"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - hi-agent-net

  hi-agent:
    image: ${HI_AGENT_IMAGE:?HI_AGENT_IMAGE must be set in .env (deploy pipeline writes it)}
    container_name: hi-agent
    restart: unless-stopped
    depends_on:
      auth-server:
        condition: service_started
    ports:
      - "127.0.0.1:8080:80"
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://127.0.0.1/"]
      interval: 30s
      timeout: 5s
      retries: 3
    networks:
      - hi-agent-net

  auth-server:
    image: ${AUTH_SERVER_IMAGE:?AUTH_SERVER_IMAGE must be set in .env (deploy pipeline writes it)}
    container_name: hi-agent-auth-server
    restart: unless-stopped
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      NODE_ENV: production
      DATABASE_URL: ${DATABASE_URL:?missing}
      SESSION_COOKIE_SECURE: ${SESSION_COOKIE_SECURE:-true}
      SESSION_TTL_SECONDS: ${SESSION_TTL_SECONDS:-2592000}
      OTP_PEPPER: ${OTP_PEPPER:?missing}
      SMTP_HOST: ${SMTP_HOST:?missing}
      SMTP_PORT: ${SMTP_PORT:?missing}
      SMTP_USER: ${SMTP_USER:?missing}
      SMTP_PASS: ${SMTP_PASS:?missing}
      SMTP_FROM: ${SMTP_FROM:?missing}
      OTP_DEV_LOG_CODE: ${OTP_DEV_LOG_CODE:-false}
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://127.0.0.1:3000/api/health"]
      interval: 30s
      timeout: 5s
      retries: 5
    networks:
      - hi-agent-net

networks:
  hi-agent-net:
    name: hi-agent-net
    driver: bridge

volumes:
  hi-agent-pgdata:
    name: hi-agent-pgdata
```

随后确认 [deploy/.env.example](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/deploy/.env.example) 已包含下列键（PR-1 已建文件，这里**只校验，不重复添加**）：

```bash
grep -E '^(POSTGRES_DB|POSTGRES_USER|POSTGRES_PASSWORD|DATABASE_URL|SESSION_COOKIE_SECURE|SESSION_TTL_SECONDS|OTP_PEPPER|SMTP_HOST|SMTP_PORT|SMTP_USER|SMTP_PASS|SMTP_FROM|OTP_DEV_LOG_CODE|HI_AGENT_IMAGE|AUTH_SERVER_IMAGE)=' deploy/.env.example | wc -l
# 期望：>= 15
```

若缺失，按下列追加（**仅追加缺失项，不要重复**）：

```env
SESSION_COOKIE_SECURE=true
SESSION_TTL_SECONDS=2592000
OTP_PEPPER=replace-me-with-32-bytes-base64
SMTP_HOST=smtp.example.com
SMTP_PORT=465
SMTP_USER=
SMTP_PASS=
SMTP_FROM="Hi-Agent <no-reply@example.com>"
OTP_DEV_LOG_CODE=false
AUTH_SERVER_IMAGE=
```

- [ ] **Step 4：运行测试，确认通过**

```bash
./deploy/docker-compose.test.sh
# 期望：OK
```

- [ ] **Step 5：commit**

```bash
git add deploy/docker-compose.yml deploy/.env.example deploy/docker-compose.test.sh
git commit -m "feat(deploy): add auth-server service + hi-agent-net network"
```

---

### Task 4.3：本机端到端冒烟（前端 → Caddy → auth-server → postgres）

**Files:**
- 临时使用：本地构建 hi-agent / auth-server 镜像

- [ ] **Step 1：本地构建两个镜像**

```bash
docker build -t hi-agent:dev .
docker build -t hi-agent-auth-server:dev ./server
```

- [ ] **Step 2：写 deploy/.env（含 dev 占位）**

```bash
cp deploy/.env.example deploy/.env
sed -i.bak 's|^HI_AGENT_IMAGE=.*|HI_AGENT_IMAGE=hi-agent:dev|' deploy/.env
sed -i.bak 's|^AUTH_SERVER_IMAGE=.*|AUTH_SERVER_IMAGE=hi-agent-auth-server:dev|' deploy/.env
sed -i.bak 's|^OTP_DEV_LOG_CODE=.*|OTP_DEV_LOG_CODE=true|' deploy/.env
sed -i.bak 's|^SESSION_COOKIE_SECURE=.*|SESSION_COOKIE_SECURE=false|' deploy/.env
rm deploy/.env.bak
chmod 600 deploy/.env
```

> 注意：DATABASE_URL 中的 host 必须是 `postgres`（compose 服务名），不是 `127.0.0.1`：
> `DATABASE_URL=postgresql://hi_agent:<password>@postgres:5432/hi_agent?schema=public`

- [ ] **Step 3：起栈**

```bash
docker compose -f deploy/docker-compose.yml --env-file deploy/.env up -d
docker compose -f deploy/docker-compose.yml --env-file deploy/.env ps
# 期望：postgres healthy / auth-server healthy / hi-agent healthy
```

- [ ] **Step 4：通过 Caddy 访问 /api/health**

```bash
curl -fsS http://127.0.0.1:8080/api/health
# 期望：{"ok":true,"db":"up"}
```

- [ ] **Step 5：通过 Caddy 走完整 OTP 流程**

```bash
# 1) 申请验证码（dev 模式下日志会打印明文 code）
curl -i -XPOST http://127.0.0.1:8080/api/auth/otp/request \
  -H 'Content-Type: application/json' -d '{"email":"smoke@example.com"}'

# 2) 从 auth-server 日志拿 code
docker logs hi-agent-auth-server 2>&1 | grep -E '\[OTP DEV\]' | tail -n1
# 形如： [OTP DEV] email=smoke@example.com code=123456

# 3) 验证 + 拿 cookie
curl -i -XPOST http://127.0.0.1:8080/api/auth/otp/verify \
  -H 'Content-Type: application/json' \
  -d '{"email":"smoke@example.com","code":"<上一步 code>"}' \
  -c /tmp/cookies.txt

# 4) 携带 cookie 访问 /me
curl -fsS http://127.0.0.1:8080/api/auth/me -b /tmp/cookies.txt
# 期望：{"user":{...},"profile":{...}}
```

- [ ] **Step 6：清理**

```bash
docker compose -f deploy/docker-compose.yml --env-file deploy/.env down
```

- [ ] **Step 7：commit（仅文档/脚本侧无变更则跳过）**

> 本 task 不产生代码改动；如脚本/Caddyfile 在调试中有修订请合并到 4.1/4.2 commit；否则无 commit。

### PR-4 验收清单

- [ ] `docker/Caddyfile.test.sh` 通过
- [ ] `deploy/docker-compose.test.sh` 通过
- [ ] `curl http://127.0.0.1:8080/api/health` → 200 `{"ok":true,"db":"up"}`
- [ ] 经 Caddy 完成完整 OTP request/verify/me 链路
- [ ] auth-server 容器**未对宿主机暴露端口**（仅通过 Caddy 反代访问）

---

## PR-5：profile 更新 + password 骨架 + OAuth 占位

> 目标：完成"已登录用户更新资料"主链路；为后续密码登录、第三方登录预留**骨架接口**（行为：401 未登录 / 501 NOT_IMPLEMENTED），保证 spec 中所列端点全部可发现、契约稳定。

### Task 5.1：lib/profile.ts —— custom_fields zod schema + 合并写入

**Files:**
- Create: [server/lib/profile.ts](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/server/lib/profile.ts)
- Test: [server/test/profile.test.ts](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/server/test/profile.test.ts)

- [ ] **Step 1：写失败测试**

```ts
// server/test/profile.test.ts
import { describe, it, expect } from 'vitest'
import { profilePatchSchema, mergeCustomFields } from '../lib/profile'

describe('profilePatchSchema', () => {
  it('accepts valid partial payload', () => {
    const out = profilePatchSchema.parse({
      display_name: 'Alice',
      gender: 'FEMALE',
      bio: 'hi',
      custom_fields: { city: 'SH' },
    })
    expect(out.display_name).toBe('Alice')
  })

  it('rejects bio > 500 chars', () => {
    expect(() =>
      profilePatchSchema.parse({ bio: 'x'.repeat(501) })
    ).toThrow()
  })

  it('rejects non-object custom_fields', () => {
    expect(() =>
      profilePatchSchema.parse({ custom_fields: ['a'] as unknown })
    ).toThrow()
  })

  it('rejects custom_fields exceeding 8KB serialized', () => {
    const big = { k: 'x'.repeat(9000) }
    expect(() => profilePatchSchema.parse({ custom_fields: big })).toThrow()
  })
})

describe('mergeCustomFields', () => {
  it('shallow-merges existing with patch', () => {
    expect(mergeCustomFields({ a: 1, b: 2 }, { b: 3, c: 4 })).toEqual({
      a: 1, b: 3, c: 4,
    })
  })

  it('null patch removes a key', () => {
    expect(mergeCustomFields({ a: 1, b: 2 }, { b: null })).toEqual({ a: 1 })
  })

  it('returns existing untouched when patch is undefined', () => {
    expect(mergeCustomFields({ a: 1 }, undefined)).toEqual({ a: 1 })
  })
})
```

- [ ] **Step 2：运行测试，确认失败**

```bash
cd server && npx vitest run test/profile.test.ts
# 期望：Cannot find module '../lib/profile'
```

- [ ] **Step 3：实现**

```ts
// server/lib/profile.ts
import { z } from 'zod'

export const profilePatchSchema = z.object({
  display_name: z.string().trim().min(1).max(64).optional(),
  avatar_url: z.string().url().max(512).optional(),
  gender: z.enum(['UNKNOWN', 'MALE', 'FEMALE', 'OTHER']).optional(),
  birthday: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  bio: z.string().max(500).optional(),
  locale: z.string().max(16).optional(),
  timezone: z.string().max(64).optional(),
  custom_fields: z
    .record(z.string(), z.unknown())
    .refine(
      (v) => JSON.stringify(v).length <= 8 * 1024,
      { message: 'custom_fields exceeds 8KB' },
    )
    .optional(),
})

export type ProfilePatch = z.infer<typeof profilePatchSchema>

/**
 * 浅合并 custom_fields：
 * - patch 中 value=null 表示删除该 key
 * - patch=undefined 表示不更新（直接返回 existing）
 */
export function mergeCustomFields(
  existing: Record<string, unknown> | null | undefined,
  patch: Record<string, unknown> | undefined,
): Record<string, unknown> {
  if (patch === undefined) return existing ?? {}
  const out: Record<string, unknown> = { ...(existing ?? {}) }
  for (const [k, v] of Object.entries(patch)) {
    if (v === null) delete out[k]
    else out[k] = v
  }
  return out
}
```

- [ ] **Step 4：运行测试，确认通过**

```bash
cd server && npx vitest run test/profile.test.ts
# 期望：4 passed (mergeCustomFields) + 4 passed (profilePatchSchema)
```

- [ ] **Step 5：commit**

```bash
git add server/lib/profile.ts server/test/profile.test.ts
git commit -m "feat(profile): zod schema + custom_fields shallow merge"
```

---

### Task 5.2：PATCH /api/auth/users/me/profile

**Files:**
- Create: [server/app/api/auth/users/me/profile/route.ts](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/server/app/api/auth/users/me/profile/route.ts)
- Test: [server/test/profile-route.test.ts](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/server/test/profile-route.test.ts)

- [ ] **Step 1：写失败测试（401 未登录 / 200 成功更新 / 400 字段超长）**

```ts
// server/test/profile-route.test.ts
import { describe, it, expect, beforeAll } from 'vitest'
import { PATCH } from '../app/api/auth/users/me/profile/route'

function req(body: unknown, cookie?: string) {
  return new Request('http://x/api/auth/users/me/profile', {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
  })
}

describe('PATCH /users/me/profile', () => {
  it('401 when not logged in', async () => {
    const res = await PATCH(req({ display_name: 'A' }))
    expect(res.status).toBe(401)
  })

  it('400 on invalid input', async () => {
    // 注入一个测试 fixture 登录态（详见 step 3 实现里的 dev backdoor）
    const res = await PATCH(req({ bio: 'x'.repeat(600) }, 'hi_sid=__test_user_1__'))
    expect(res.status).toBe(400)
  })

  it('200 + persisted', async () => {
    const res = await PATCH(req(
      { display_name: 'Alice', custom_fields: { city: 'SH' } },
      'hi_sid=__test_user_1__',
    ))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.profile.display_name).toBe('Alice')
    expect(body.profile.custom_fields.city).toBe('SH')
  })
})
```

> 测试夹具：`__test_user_1__` 由 [server/test/setup.ts](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/server/test/setup.ts) 在 `beforeAll` 阶段插入一条 user + 对应 session（PR-3 已建立 setup.ts；如未建立，先在此 task 第一步补一个最小 setup）。

- [ ] **Step 2：运行测试，确认失败**

```bash
cd server && npx vitest run test/profile-route.test.ts
# 期望：Cannot find module '../app/api/auth/users/me/profile/route'
```

- [ ] **Step 3：实现**

```ts
// server/app/api/auth/users/me/profile/route.ts
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthedUser } from '@/lib/auth-context'
import { profilePatchSchema, mergeCustomFields } from '@/lib/profile'
import { jsonError, jsonOk, ERR } from '@/lib/errors'
import { z } from 'zod'

export async function PATCH(req: Request) {
  const auth = await getAuthedUser(req)
  if (!auth) return jsonError(ERR.UNAUTHORIZED, 401)

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return jsonError(ERR.INVALID_INPUT, 400, { reason: 'invalid_json' })
  }

  const parsed = profilePatchSchema.safeParse(body)
  if (!parsed.success) {
    return jsonError(ERR.INVALID_INPUT, 400, { issues: parsed.error.issues })
  }
  const patch = parsed.data

  const existing = await prisma.userProfile.findUnique({
    where: { user_id: auth.user.id },
  })
  const nextCustom = mergeCustomFields(
    (existing?.custom_fields as Record<string, unknown> | null) ?? null,
    patch.custom_fields,
  )

  const profile = await prisma.userProfile.upsert({
    where: { user_id: auth.user.id },
    update: {
      display_name: patch.display_name ?? undefined,
      avatar_url: patch.avatar_url ?? undefined,
      gender: patch.gender ?? undefined,
      birthday: patch.birthday ? new Date(patch.birthday) : undefined,
      bio: patch.bio ?? undefined,
      locale: patch.locale ?? undefined,
      timezone: patch.timezone ?? undefined,
      custom_fields: nextCustom as object,
    },
    create: {
      user_id: auth.user.id,
      display_name: patch.display_name,
      avatar_url: patch.avatar_url,
      gender: patch.gender ?? 'UNKNOWN',
      birthday: patch.birthday ? new Date(patch.birthday) : null,
      bio: patch.bio,
      locale: patch.locale,
      timezone: patch.timezone,
      custom_fields: nextCustom as object,
    },
  })

  return jsonOk({ profile })
}
```

- [ ] **Step 4：运行测试，确认通过**

```bash
cd server && npx vitest run test/profile-route.test.ts
# 期望：3 passed
```

- [ ] **Step 5：commit**

```bash
git add server/app/api/auth/users/me/profile/route.ts server/test/profile-route.test.ts
git commit -m "feat(profile): PATCH /api/auth/users/me/profile"
```

---

### Task 5.3：password 骨架（set / change，未启用）

**Files:**
- Create: [server/lib/password.ts](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/server/lib/password.ts)
- Create: [server/app/api/auth/password/set/route.ts](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/server/app/api/auth/password/set/route.ts)
- Create: [server/app/api/auth/password/change/route.ts](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/server/app/api/auth/password/change/route.ts)
- Test: [server/test/password.test.ts](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/server/test/password.test.ts)

- [ ] **Step 1：写失败测试**

```ts
// server/test/password.test.ts
import { describe, it, expect } from 'vitest'
import { hashPassword, verifyPassword, passwordSchema } from '../lib/password'
import { POST as POST_SET } from '../app/api/auth/password/set/route'
import { POST as POST_CHANGE } from '../app/api/auth/password/change/route'

describe('password lib', () => {
  it('hashes and verifies argon2id', async () => {
    const h = await hashPassword('correct horse battery 42')
    expect(h).toMatch(/^\$argon2id\$/)
    expect(await verifyPassword('correct horse battery 42', h)).toBe(true)
    expect(await verifyPassword('wrong', h)).toBe(false)
  })

  it('rejects short / weak passwords', () => {
    expect(() => passwordSchema.parse('abc')).toThrow()
    expect(() => passwordSchema.parse('abcdefgh')).toThrow() // 仅小写
    expect(passwordSchema.parse('Aa1aaaaa')).toBe('Aa1aaaaa')
  })
})

describe('password routes (skeleton)', () => {
  function req(path: string, cookie?: string) {
    return new Request(`http://x${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(cookie ? { cookie } : {}),
      },
      body: JSON.stringify({ password: 'Aa1aaaaa', new_password: 'Aa1aaaaa' }),
    })
  }
  it('set: 401 when not logged in', async () => {
    const res = await POST_SET(req('/api/auth/password/set'))
    expect(res.status).toBe(401)
  })
  it('change: 401 when not logged in', async () => {
    const res = await POST_CHANGE(req('/api/auth/password/change'))
    expect(res.status).toBe(401)
  })
  it('set: 200 success when logged in', async () => {
    const res = await POST_SET(req('/api/auth/password/set', 'hi_sid=__test_user_1__'))
    expect(res.status).toBe(200)
  })
  it('change: 401 wrong current password', async () => {
    const r = new Request('http://x/api/auth/password/change', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: 'hi_sid=__test_user_1__' },
      body: JSON.stringify({ current_password: 'WRONGwrong1', new_password: 'Aa1aaaaa' }),
    })
    const res = await POST_CHANGE(r)
    expect([401, 400]).toContain(res.status)
  })
})
```

- [ ] **Step 2：运行测试，确认失败**

```bash
cd server && npx vitest run test/password.test.ts
# 期望：Cannot find module '../lib/password'
```

- [ ] **Step 3：实现**

```ts
// server/lib/password.ts
import argon2 from 'argon2'
import { z } from 'zod'

// OWASP 2024 推荐参数（argon2id）
const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19 * 1024, // 19 MiB
  timeCost: 2,
  parallelism: 1,
} as const

export const passwordSchema = z
  .string()
  .min(8)
  .max(128)
  .refine((v) => /[a-z]/.test(v) && /[A-Z]/.test(v) && /\d/.test(v), {
    message: 'password must contain lower / upper / digit',
  })

export async function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, ARGON2_OPTIONS)
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plain)
  } catch {
    return false
  }
}
```

```ts
// server/app/api/auth/password/set/route.ts
import { prisma } from '@/lib/db'
import { getAuthedUser } from '@/lib/auth-context'
import { jsonError, jsonOk, ERR } from '@/lib/errors'
import { hashPassword, passwordSchema } from '@/lib/password'
import { z } from 'zod'

const bodySchema = z.object({ password: passwordSchema })

export async function POST(req: Request) {
  const auth = await getAuthedUser(req)
  if (!auth) return jsonError(ERR.UNAUTHORIZED, 401)

  let body: unknown
  try { body = await req.json() } catch {
    return jsonError(ERR.INVALID_INPUT, 400, { reason: 'invalid_json' })
  }
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) return jsonError(ERR.INVALID_INPUT, 400, { issues: parsed.error.issues })

  // 仅允许"首次设置"：已存在 password_hash 时改走 /change（防止越权改密）
  if (auth.user.password_hash) {
    return jsonError(ERR.FORBIDDEN, 403, { reason: 'password_already_set' })
  }
  const hash = await hashPassword(parsed.data.password)
  await prisma.user.update({
    where: { id: auth.user.id },
    data: { password_hash: hash, password_set_at: new Date() },
  })
  return jsonOk({ ok: true })
}
```

```ts
// server/app/api/auth/password/change/route.ts
import { prisma } from '@/lib/db'
import { getAuthedUser } from '@/lib/auth-context'
import { jsonError, jsonOk, ERR } from '@/lib/errors'
import { hashPassword, verifyPassword, passwordSchema } from '@/lib/password'
import { revokeOtherSessions } from '@/lib/session'
import { z } from 'zod'

const bodySchema = z.object({
  current_password: z.string().min(1).max(128),
  new_password: passwordSchema,
})

export async function POST(req: Request) {
  const auth = await getAuthedUser(req)
  if (!auth) return jsonError(ERR.UNAUTHORIZED, 401)

  let body: unknown
  try { body = await req.json() } catch {
    return jsonError(ERR.INVALID_INPUT, 400, { reason: 'invalid_json' })
  }
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) return jsonError(ERR.INVALID_INPUT, 400, { issues: parsed.error.issues })

  if (!auth.user.password_hash) {
    return jsonError(ERR.FORBIDDEN, 403, { reason: 'password_not_set' })
  }
  const ok = await verifyPassword(parsed.data.current_password, auth.user.password_hash)
  if (!ok) return jsonError(ERR.UNAUTHORIZED, 401, { reason: 'wrong_current_password' })

  const newHash = await hashPassword(parsed.data.new_password)
  await prisma.user.update({
    where: { id: auth.user.id },
    data: { password_hash: newHash, password_set_at: new Date() },
  })
  // 改密后吊销其他会话，仅保留当前
  await revokeOtherSessions(auth.user.id, auth.session.id)
  return jsonOk({ ok: true })
}
```

- [ ] **Step 4：运行测试，确认通过**

```bash
cd server && npx vitest run test/password.test.ts
# 期望：2 (lib) + 4 (routes) = 6 passed
```

- [ ] **Step 5：commit**

```bash
git add server/lib/password.ts server/app/api/auth/password server/test/password.test.ts
git commit -m "feat(auth): password set/change skeleton (argon2id, OWASP 2024)"
```

---

### Task 5.4：OAuth 占位四端点（GitHub / WeChat × start/callback）

**Files:**
- Create: [server/app/api/auth/oauth/github/start/route.ts](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/server/app/api/auth/oauth/github/start/route.ts)
- Create: [server/app/api/auth/oauth/github/callback/route.ts](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/server/app/api/auth/oauth/github/callback/route.ts)
- Create: [server/app/api/auth/oauth/wechat/start/route.ts](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/server/app/api/auth/oauth/wechat/start/route.ts)
- Create: [server/app/api/auth/oauth/wechat/callback/route.ts](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/server/app/api/auth/oauth/wechat/callback/route.ts)
- Test: [server/test/oauth-stub.test.ts](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/server/test/oauth-stub.test.ts)

- [ ] **Step 1：写失败测试**

```ts
// server/test/oauth-stub.test.ts
import { describe, it, expect } from 'vitest'
import { GET as GH_START } from '../app/api/auth/oauth/github/start/route'
import { GET as GH_CB }    from '../app/api/auth/oauth/github/callback/route'
import { GET as WX_START } from '../app/api/auth/oauth/wechat/start/route'
import { GET as WX_CB }    from '../app/api/auth/oauth/wechat/callback/route'

const cases = [
  { name: 'github/start', fn: GH_START },
  { name: 'github/callback', fn: GH_CB },
  { name: 'wechat/start', fn: WX_START },
  { name: 'wechat/callback', fn: WX_CB },
]

describe('oauth stubs', () => {
  for (const c of cases) {
    it(`${c.name} returns 501 NOT_IMPLEMENTED`, async () => {
      const res = await c.fn(new Request(`http://x/api/auth/oauth/${c.name}`))
      expect(res.status).toBe(501)
      const body = await res.json()
      expect(body.error).toBe('NOT_IMPLEMENTED')
    })
  }
})
```

- [ ] **Step 2：运行测试，确认失败**

```bash
cd server && npx vitest run test/oauth-stub.test.ts
# 期望：Cannot find module
```

- [ ] **Step 3：实现（4 个文件内容相同，仅 provider 标签不同）**

```ts
// server/app/api/auth/oauth/github/start/route.ts
import { jsonError, ERR } from '@/lib/errors'
export async function GET(_req: Request) {
  return jsonError(ERR.NOT_IMPLEMENTED, 501, { provider: 'github', stage: 'start' })
}
```

```ts
// server/app/api/auth/oauth/github/callback/route.ts
import { jsonError, ERR } from '@/lib/errors'
export async function GET(_req: Request) {
  return jsonError(ERR.NOT_IMPLEMENTED, 501, { provider: 'github', stage: 'callback' })
}
```

```ts
// server/app/api/auth/oauth/wechat/start/route.ts
import { jsonError, ERR } from '@/lib/errors'
export async function GET(_req: Request) {
  return jsonError(ERR.NOT_IMPLEMENTED, 501, { provider: 'wechat', stage: 'start' })
}
```

```ts
// server/app/api/auth/oauth/wechat/callback/route.ts
import { jsonError, ERR } from '@/lib/errors'
export async function GET(_req: Request) {
  return jsonError(ERR.NOT_IMPLEMENTED, 501, { provider: 'wechat', stage: 'callback' })
}
```

- [ ] **Step 4：运行测试，确认通过**

```bash
cd server && npx vitest run test/oauth-stub.test.ts
# 期望：4 passed
```

- [ ] **Step 5：commit**

```bash
git add server/app/api/auth/oauth server/test/oauth-stub.test.ts
git commit -m "feat(auth): oauth provider stubs (github/wechat × start/callback) → 501"
```

### PR-5 验收清单

- [ ] `cd server && npm test` 全绿（含 profile / password / oauth-stub）
- [ ] `PATCH /api/auth/users/me/profile`：200 写入 + 400 字段超长 + 401 未登录三态可达
- [ ] `POST /api/auth/password/set`：未设置密码用户首次 200；已设置 → 403
- [ ] `POST /api/auth/password/change`：current 错误 → 401，成功后其他 session 全部 revoked
- [ ] 4 个 OAuth 端点统一返回 501 `{"error":"NOT_IMPLEMENTED",...}`

---

## PR-6：前端登录 UI（Nextra 顶栏挂载）

> 目标：在不破坏 Nextra 默认顶栏的前提下，挂载 `<UserMenu />`：未登录显示「登录/注册」按钮 → 弹出 `<LoginDialog />`（邮箱 + 验证码两步）；已登录显示头像 + 下拉菜单（注销）。所有请求走同源 `/api/auth/*`。

### Task 6.1：auth-client（fetch 封装 + 错误码归一）

**Files:**
- Create: [app/lib/auth/auth-client.ts](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/lib/auth/auth-client.ts)
- Test: [app/lib/auth/auth-client.test.ts](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/lib/auth/auth-client.test.ts)

- [ ] **Step 1：写失败测试（vitest，使用 fetch mock）**

```ts
// app/lib/auth/auth-client.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { requestOtp, verifyOtp, fetchMe, logout, AuthError } from './auth-client'

beforeEach(() => {
  vi.unstubAllGlobals()
})

function mockFetch(status: number, body: unknown) {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })))
}

describe('auth-client', () => {
  it('requestOtp: returns ok:true on 200', async () => {
    mockFetch(200, { ok: true })
    await expect(requestOtp('a@b.com')).resolves.toEqual({ ok: true })
  })

  it('requestOtp: throws AuthError(RATE_LIMITED) on 429', async () => {
    mockFetch(429, { error: 'RATE_LIMITED', retry_after_seconds: 30 })
    await expect(requestOtp('a@b.com')).rejects.toBeInstanceOf(AuthError)
  })

  it('verifyOtp: throws AuthError(INVALID_OR_EXPIRED) on 410', async () => {
    mockFetch(410, { error: 'INVALID_OR_EXPIRED' })
    await expect(verifyOtp('a@b.com', '000000')).rejects.toThrow('INVALID_OR_EXPIRED')
  })

  it('fetchMe: returns null on 401 (instead of throw)', async () => {
    mockFetch(401, { error: 'UNAUTHORIZED' })
    await expect(fetchMe()).resolves.toBeNull()
  })

  it('logout: 200 → ok', async () => {
    mockFetch(200, { ok: true })
    await expect(logout()).resolves.toEqual({ ok: true })
  })
})
```

- [ ] **Step 2：运行测试，确认失败**

```bash
npx vitest run app/lib/auth/auth-client.test.ts
# 期望：Cannot find module './auth-client'
```

- [ ] **Step 3：实现**

```ts
// app/lib/auth/auth-client.ts
export type ErrorCode =
  | 'RATE_LIMITED'
  | 'INVALID_INPUT'
  | 'INVALID_OR_EXPIRED'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'ACCOUNT_DISABLED'
  | 'NOT_IMPLEMENTED'
  | 'INTERNAL'

export class AuthError extends Error {
  code: ErrorCode
  status: number
  detail: Record<string, unknown>
  constructor(code: ErrorCode, status: number, detail: Record<string, unknown> = {}) {
    super(code)
    this.name = 'AuthError'
    this.code = code
    this.status = status
    this.detail = detail
  }
}

const BASE = '/api/auth'

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  return parse<T>(res)
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'GET',
    credentials: 'same-origin',
  })
  return parse<T>(res)
}

async function parse<T>(res: Response): Promise<T> {
  let data: any = null
  try { data = await res.json() } catch { /* ignore */ }
  if (!res.ok) {
    const code = (data?.error as ErrorCode) ?? 'INTERNAL'
    throw new AuthError(code, res.status, data ?? {})
  }
  return data as T
}

export async function requestOtp(email: string): Promise<{ ok: true }> {
  return postJson('/otp/request', { email })
}

export async function verifyOtp(email: string, code: string): Promise<{ user: any; profile: any }> {
  return postJson('/otp/verify', { email, code })
}

export async function fetchMe(): Promise<{ user: any; profile: any } | null> {
  try {
    return await getJson('/me')
  } catch (e) {
    if (e instanceof AuthError && e.code === 'UNAUTHORIZED') return null
    throw e
  }
}

export async function logout(): Promise<{ ok: true }> {
  return postJson('/logout', {})
}
```

- [ ] **Step 4：运行测试，确认通过**

```bash
npx vitest run app/lib/auth/auth-client.test.ts
# 期望：5 passed
```

- [ ] **Step 5：commit**

```bash
git add app/lib/auth/auth-client.ts app/lib/auth/auth-client.test.ts
git commit -m "feat(ui): auth-client (otp/me/logout fetch helpers)"
```

---

### Task 6.2：useCurrentUser hook（轻量 client-only store）

**Files:**
- Create: [app/lib/auth/use-current-user.ts](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/lib/auth/use-current-user.ts)
- Test: [app/lib/auth/use-current-user.test.tsx](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/lib/auth/use-current-user.test.tsx)

- [ ] **Step 1：写失败测试**

```tsx
// app/lib/auth/use-current-user.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useCurrentUser } from './use-current-user'

beforeEach(() => {
  vi.unstubAllGlobals()
})

function mockMe(payload: any, status = 200) {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(payload), {
    status, headers: { 'content-type': 'application/json' },
  })))
}

describe('useCurrentUser', () => {
  it('initial loading → user', async () => {
    mockMe({ user: { id: 'u1', email: 'a@b.com' }, profile: { display_name: 'A' } })
    const { result } = renderHook(() => useCurrentUser())
    expect(result.current.loading).toBe(true)
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.user?.id).toBe('u1')
  })

  it('401 → user=null without throw', async () => {
    mockMe({ error: 'UNAUTHORIZED' }, 401)
    const { result } = renderHook(() => useCurrentUser())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.user).toBeNull()
  })

  it('refresh() refetches', async () => {
    mockMe({ user: { id: 'u1' }, profile: {} })
    const { result } = renderHook(() => useCurrentUser())
    await waitFor(() => expect(result.current.loading).toBe(false))
    mockMe({ user: { id: 'u2' }, profile: {} })
    await act(async () => { await result.current.refresh() })
    expect(result.current.user?.id).toBe('u2')
  })
})
```

> 依赖：[`@testing-library/react`](https://testing-library.com/docs/react-testing-library/intro/)。如尚未安装，本 task 先在根 `package.json` 增加 devDeps：

```bash
npm i -D @testing-library/react @testing-library/dom jsdom
# 注意 vitest.config.ts 里 environment 必须是 'jsdom'（前端测试）
```

- [ ] **Step 2：运行测试，确认失败**

```bash
npx vitest run app/lib/auth/use-current-user.test.tsx
# 期望：Cannot find module './use-current-user'
```

- [ ] **Step 3：实现**

```ts
// app/lib/auth/use-current-user.ts
'use client'
import { useCallback, useEffect, useState } from 'react'
import { fetchMe } from './auth-client'

export interface CurrentUser {
  id: string
  email: string
  status: string
  role: string
  plan: string
}

export interface CurrentProfile {
  display_name: string | null
  avatar_url: string | null
  custom_fields: Record<string, unknown>
}

export interface UseCurrentUserResult {
  user: CurrentUser | null
  profile: CurrentProfile | null
  loading: boolean
  error: Error | null
  refresh: () => Promise<void>
}

export function useCurrentUser(): UseCurrentUserResult {
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [profile, setProfile] = useState<CurrentProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const me = await fetchMe()
      setUser(me?.user ?? null)
      setProfile(me?.profile ?? null)
    } catch (e) {
      setError(e as Error)
      setUser(null)
      setProfile(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  return { user, profile, loading, error, refresh }
}
```

- [ ] **Step 4：运行测试，确认通过**

```bash
npx vitest run app/lib/auth/use-current-user.test.tsx
# 期望：3 passed
```

- [ ] **Step 5：commit**

```bash
git add app/lib/auth/use-current-user.ts app/lib/auth/use-current-user.test.tsx package.json package-lock.json
git commit -m "feat(ui): useCurrentUser hook"
```

---

### Task 6.3：LoginDialog 组件（两步：邮箱 → 验证码）

**Files:**
- Create: [app/lib/auth/login-dialog.tsx](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/lib/auth/login-dialog.tsx)
- Create: [app/lib/auth/login-dialog.module.css](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/lib/auth/login-dialog.module.css)
- Test: [app/lib/auth/login-dialog.test.tsx](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/lib/auth/login-dialog.test.tsx)

- [ ] **Step 1：写失败测试（行为断言）**

```tsx
// app/lib/auth/login-dialog.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { LoginDialog } from './login-dialog'

beforeEach(() => { vi.unstubAllGlobals() })

function stubSequence(responses: Array<{ status: number; body: unknown }>) {
  const fn = vi.fn()
  for (const r of responses) {
    fn.mockResolvedValueOnce(new Response(JSON.stringify(r.body), {
      status: r.status,
      headers: { 'content-type': 'application/json' },
    }))
  }
  vi.stubGlobal('fetch', fn)
  return fn
}

describe('LoginDialog', () => {
  it('email step → request otp → code step', async () => {
    stubSequence([{ status: 200, body: { ok: true } }])
    render(<LoginDialog open onClose={() => {}} onLoggedIn={() => {}} />)

    fireEvent.change(screen.getByLabelText(/邮箱/i), { target: { value: 'a@b.com' } })
    fireEvent.click(screen.getByRole('button', { name: /发送验证码/i }))

    await waitFor(() => {
      expect(screen.getByLabelText(/验证码/i)).toBeTruthy()
    })
  })

  it('code step → verify success → onLoggedIn called', async () => {
    stubSequence([
      { status: 200, body: { ok: true } },
      { status: 200, body: { user: { id: 'u1' }, profile: {} } },
    ])
    const onLoggedIn = vi.fn()
    render(<LoginDialog open onClose={() => {}} onLoggedIn={onLoggedIn} />)

    fireEvent.change(screen.getByLabelText(/邮箱/i), { target: { value: 'a@b.com' } })
    fireEvent.click(screen.getByRole('button', { name: /发送验证码/i }))
    await waitFor(() => screen.getByLabelText(/验证码/i))

    fireEvent.change(screen.getByLabelText(/验证码/i), { target: { value: '123456' } })
    fireEvent.click(screen.getByRole('button', { name: /登录/i }))

    await waitFor(() => expect(onLoggedIn).toHaveBeenCalledTimes(1))
  })

  it('shows RATE_LIMITED error on 429', async () => {
    stubSequence([{ status: 429, body: { error: 'RATE_LIMITED', retry_after_seconds: 30 } }])
    render(<LoginDialog open onClose={() => {}} onLoggedIn={() => {}} />)

    fireEvent.change(screen.getByLabelText(/邮箱/i), { target: { value: 'a@b.com' } })
    fireEvent.click(screen.getByRole('button', { name: /发送验证码/i }))

    await waitFor(() => {
      expect(screen.getByText(/请稍后再试/)).toBeTruthy()
    })
  })
})
```

- [ ] **Step 2：运行测试，确认失败**

```bash
npx vitest run app/lib/auth/login-dialog.test.tsx
# 期望：Cannot find module './login-dialog'
```

- [ ] **Step 3：实现**

```css
/* app/lib/auth/login-dialog.module.css */
.backdrop {
  position: fixed; inset: 0; z-index: 60;
  background: rgba(0,0,0,.45);
  display: grid; place-items: center;
}
.dialog {
  width: min(420px, 92vw);
  background: var(--nextra-bg, #fff);
  color: var(--nextra-fg, #111);
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 20px 50px rgba(0,0,0,.25);
}
.title { font-size: 18px; font-weight: 600; margin: 0 0 12px; }
.field { display: block; margin: 12px 0; }
.field input {
  width: 100%; padding: 10px 12px; border-radius: 8px;
  border: 1px solid #d1d5db; font-size: 14px;
}
.actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 16px; }
.btn {
  padding: 8px 14px; border-radius: 8px; border: 0; cursor: pointer;
  background: #111; color: #fff; font-size: 14px;
}
.btn[disabled] { opacity: .5; cursor: not-allowed; }
.btnGhost { background: transparent; color: inherit; }
.error { color: #b91c1c; font-size: 13px; margin-top: 8px; }
.hint  { color: #6b7280; font-size: 12px; margin-top: 6px; }
```

```tsx
// app/lib/auth/login-dialog.tsx
'use client'
import { useState } from 'react'
import { requestOtp, verifyOtp, AuthError } from './auth-client'
import styles from './login-dialog.module.css'

type Step = 'email' | 'code'

export interface LoginDialogProps {
  open: boolean
  onClose: () => void
  onLoggedIn: (payload: { user: any; profile: any }) => void
}

export function LoginDialog({ open, onClose, onLoggedIn }: LoginDialogProps) {
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!open) return null

  const messageFor = (e: AuthError): string => {
    switch (e.code) {
      case 'RATE_LIMITED': {
        const sec = (e.detail.retry_after_seconds as number | undefined) ?? 60
        return `请求过于频繁，请稍后再试（约 ${sec} 秒后）`
      }
      case 'INVALID_INPUT': return '邮箱或验证码格式不正确'
      case 'INVALID_OR_EXPIRED': return '验证码无效或已过期，请重新获取'
      case 'ACCOUNT_DISABLED': return '账号已被禁用，请联系管理员'
      default: return '操作失败，请稍后重试'
    }
  }

  async function onSendCode(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setError(null)
    try {
      await requestOtp(email)
      setStep('code')
    } catch (err) {
      setError(err instanceof AuthError ? messageFor(err) : '网络异常')
    } finally { setBusy(false) }
  }

  async function onVerify(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setError(null)
    try {
      const payload = await verifyOtp(email, code)
      onLoggedIn(payload)
      onClose()
    } catch (err) {
      setError(err instanceof AuthError ? messageFor(err) : '网络异常')
    } finally { setBusy(false) }
  }

  return (
    <div className={styles.backdrop} role="dialog" aria-modal>
      <div className={styles.dialog}>
        <h2 className={styles.title}>登录 / 注册</h2>
        {step === 'email' ? (
          <form onSubmit={onSendCode}>
            <label className={styles.field}>
              <span>邮箱</span>
              <input
                type="email" required autoFocus value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </label>
            <p className={styles.hint}>未注册的邮箱将自动创建账号</p>
            {error && <p className={styles.error}>{error}</p>}
            <div className={styles.actions}>
              <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={onClose}>取消</button>
              <button type="submit" className={styles.btn} disabled={busy || !email}>
                {busy ? '发送中…' : '发送验证码'}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={onVerify}>
            <p className={styles.hint}>已发送 6 位验证码至 <strong>{email}</strong>，10 分钟内有效</p>
            <label className={styles.field}>
              <span>验证码</span>
              <input
                inputMode="numeric" pattern="\d{6}" required autoFocus
                value={code} maxLength={6}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="6 位数字"
              />
            </label>
            {error && <p className={styles.error}>{error}</p>}
            <div className={styles.actions}>
              <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={() => setStep('email')}>返回</button>
              <button type="submit" className={styles.btn} disabled={busy || code.length !== 6}>
                {busy ? '校验中…' : '登录'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4：运行测试，确认通过**

```bash
npx vitest run app/lib/auth/login-dialog.test.tsx
# 期望：3 passed
```

- [ ] **Step 5：commit**

```bash
git add app/lib/auth/login-dialog.tsx app/lib/auth/login-dialog.module.css app/lib/auth/login-dialog.test.tsx
git commit -m "feat(ui): LoginDialog (email → otp two-step)"
```

---

### Task 6.4：UserMenu + 顶栏挂载

**Files:**
- Create: [app/lib/auth/user-menu.tsx](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/lib/auth/user-menu.tsx)
- Create: [app/lib/auth/user-menu.module.css](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/lib/auth/user-menu.module.css)
- Modify: [app/layout.tsx](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/layout.tsx)（在 Nextra `<Navbar>` 的 `extraContent` 槽位挂载）
- Test: [app/lib/auth/user-menu.test.tsx](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/lib/auth/user-menu.test.tsx)

- [ ] **Step 1：写失败测试**

```tsx
// app/lib/auth/user-menu.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { UserMenu } from './user-menu'

beforeEach(() => { vi.unstubAllGlobals() })

function mockMe(status: number, body: unknown) {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(body), {
    status, headers: { 'content-type': 'application/json' },
  })))
}

describe('UserMenu', () => {
  it('logged-out: shows 登录 button', async () => {
    mockMe(401, { error: 'UNAUTHORIZED' })
    render(<UserMenu />)
    await waitFor(() => screen.getByRole('button', { name: /登录/i }))
  })

  it('clicking 登录 opens LoginDialog', async () => {
    mockMe(401, { error: 'UNAUTHORIZED' })
    render(<UserMenu />)
    await waitFor(() => screen.getByRole('button', { name: /登录/i }))
    fireEvent.click(screen.getByRole('button', { name: /登录/i }))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeTruthy())
  })

  it('logged-in: shows display_name + 注销', async () => {
    mockMe(200, { user: { id: 'u1', email: 'a@b.com' }, profile: { display_name: 'Alice' } })
    render(<UserMenu />)
    await waitFor(() => screen.getByText('Alice'))
    fireEvent.click(screen.getByText('Alice'))
    expect(screen.getByRole('button', { name: /注销/i })).toBeTruthy()
  })
})
```

- [ ] **Step 2：运行测试，确认失败**

```bash
npx vitest run app/lib/auth/user-menu.test.tsx
# 期望：Cannot find module
```

- [ ] **Step 3：实现**

```css
/* app/lib/auth/user-menu.module.css */
.wrap { position: relative; display: inline-flex; align-items: center; }
.btn {
  border: 0; cursor: pointer; padding: 6px 12px; border-radius: 8px;
  background: transparent; color: inherit; font-size: 14px;
}
.btn:hover { background: rgba(0,0,0,.06); }
.menu {
  position: absolute; right: 0; top: calc(100% + 6px);
  min-width: 160px; background: var(--nextra-bg, #fff);
  border: 1px solid rgba(0,0,0,.1); border-radius: 10px; padding: 6px;
  box-shadow: 0 10px 30px rgba(0,0,0,.12); z-index: 50;
}
.item { display: block; width: 100%; text-align: left; padding: 8px 10px;
  border-radius: 6px; background: transparent; border: 0; cursor: pointer; font-size: 14px; }
.item:hover { background: rgba(0,0,0,.06); }
.email { color: #6b7280; font-size: 12px; padding: 6px 10px; }
```

```tsx
// app/lib/auth/user-menu.tsx
'use client'
import { useState } from 'react'
import { useCurrentUser } from './use-current-user'
import { logout } from './auth-client'
import { LoginDialog } from './login-dialog'
import styles from './user-menu.module.css'

export function UserMenu() {
  const { user, profile, loading, refresh } = useCurrentUser()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  if (loading) return null

  if (!user) {
    return (
      <span className={styles.wrap}>
        <button className={styles.btn} onClick={() => setDialogOpen(true)}>
          登录
        </button>
        <LoginDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          onLoggedIn={() => { setDialogOpen(false); void refresh() }}
        />
      </span>
    )
  }

  const label = profile?.display_name || user.email

  async function onLogout() {
    try { await logout() } finally {
      setMenuOpen(false)
      void refresh()
    }
  }

  return (
    <span className={styles.wrap}>
      <button className={styles.btn} onClick={() => setMenuOpen((v) => !v)}>
        {label}
      </button>
      {menuOpen && (
        <div className={styles.menu} role="menu">
          <div className={styles.email}>{user.email}</div>
          <button className={styles.item} onClick={onLogout} role="menuitem">注销</button>
        </div>
      )}
    </span>
  )
}
```

修改 [app/layout.tsx](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/layout.tsx)，在传递给 Nextra `<Layout>` 的 `navbar` prop 中追加 `<UserMenu />`（具体语法依现有 Layout 写法；若已使用 `Navbar` 组件，则在其 `extraContent` 槽位插入）：

```tsx
import { UserMenu } from './lib/auth/user-menu'
// ...
<Navbar
  // ...existing props
  extraContent={<UserMenu />}
/>
```

> 注意：若 `app/layout.tsx` 是 RSC（服务端组件），`<UserMenu />` 因带 `'use client'` 可直接挂载，无需做额外 wrapper。

- [ ] **Step 4：运行测试，确认通过**

```bash
npx vitest run app/lib/auth/user-menu.test.tsx
# 期望：3 passed
```

也通过 `next build` 校验静态导出仍可成功（`UserMenu` 是 client component，不阻塞 export）：

```bash
NODE_ENV=production npm run build
# 期望：build 成功，out/ 目录产物完整
```

- [ ] **Step 5：commit**

```bash
git add app/lib/auth/user-menu.tsx app/lib/auth/user-menu.module.css app/lib/auth/user-menu.test.tsx app/layout.tsx
git commit -m "feat(ui): UserMenu mounted on Nextra navbar"
```

### PR-6 验收清单

- [ ] `npm test` 全绿（auth-client / use-current-user / login-dialog / user-menu）
- [ ] `NODE_ENV=production npm run build` 静态导出成功，`out/` 不含服务端 bundle
- [ ] 顶栏在未登录态显示「登录」按钮，点击弹窗 → 输入邮箱 → 输入验证码 → 登录成功后顶栏变为 display_name
- [ ] 已登录态点击 display_name 显示菜单 → 注销 → 顶栏回退为「登录」
- [ ] 验证码错误展示 INVALID_OR_EXPIRED 文案；429 展示「请稍后再试」

---

## PR-7：CNB 流水线追加 auth-server build/push + 部署写入 AUTH_SERVER_IMAGE

> 目标：将 `auth-server` 镜像构建/推送/部署纳入现有单 pipeline；保持"先构建推送，再部署"的串行约束；deploy 阶段写 .env 时同时写入 `HI_AGENT_IMAGE` 与 `AUTH_SERVER_IMAGE` 两个变量。

### Task 7.1：在 .cnb.yml 中追加 auth-server build/push stages

**Files:**
- Modify: [.cnb.yml](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/.cnb.yml#L60-L82)

- [ ] **Step 1：写失败测试（YAML 静态校验脚本）**

新增 [scripts/check-cnb.sh](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/scripts/check-cnb.sh)：

```bash
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
```

```bash
chmod +x scripts/check-cnb.sh
```

- [ ] **Step 2：运行测试，确认失败**

```bash
./scripts/check-cnb.sh
# 期望：FAIL: missing 'docker build (auth-server)' stage
```

- [ ] **Step 3：实现——修改 .cnb.yml**

修改 [.cnb.yml](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/.cnb.yml#L68-L72)，在原 hi-agent `docker push` stage **之后**、`install ssh client` stage **之前**插入：

```yaml
        - name: docker build (auth-server)
          script: |
            set -eu
            # 镜像名规则：在原 hi-agent 镜像名上拼 -auth 后缀，方便人工排查。
            AUTH_REPO="$IMAGE_REPO-auth"
            echo "AUTH_REPO=$AUTH_REPO" >> /tmp/auth_image.env
            docker build \
              --pull \
              -f server/Dockerfile \
              -t "$AUTH_REPO:$CNB_COMMIT" \
              -t "$AUTH_REPO:latest" \
              ./server
        - name: docker push (auth-server)
          script: |
            set -eu
            . /tmp/auth_image.env
            docker push "$AUTH_REPO:$CNB_COMMIT"
            docker push "$AUTH_REPO:latest"
```

然后修改原有 `choose image tag` stage：在 hi-agent `RESOLVED_IMAGE` 解析完成之后，**追加**对 auth-server 的同样解析逻辑。即在 [.cnb.yml `choose image tag`](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/.cnb.yml#L131-L172) stage 末尾，紧跟 `printf 'export RESOLVED_IMAGE=%s\n' ...` 之后追加：

```yaml
            # ---- auth-server 镜像同样的拉取 + digest 解析 ----
            . /tmp/auth_image.env
            CHOSEN_AUTH=""
            for TAG in "$CNB_COMMIT" latest; do
              for i in 1 2 3 4 5; do
                echo "[try #$i] ssh remote pull $AUTH_REPO:$TAG"
                if ssh -o StrictHostKeyChecking=no -i ~/.ssh/id_ed25519 \
                     "$CLEAN_USER@$CLEAN_HOST" \
                     "docker pull $AUTH_REPO:$TAG"
                then
                  CHOSEN_AUTH="$TAG"
                  break 2
                fi
                sleep $((i * 3))
              done
            done
            if [ -z "$CHOSEN_AUTH" ]; then
              echo "ERROR: could not pull any auth tag" >&2; exit 1
            fi
            AUTH_DIGEST="$(ssh -o StrictHostKeyChecking=no -i ~/.ssh/id_ed25519 \
              "$CLEAN_USER@$CLEAN_HOST" \
              "docker image inspect --format '{{index .RepoDigests 0}}' $AUTH_REPO:$CHOSEN_AUTH" \
              2>/dev/null || true)"
            if [ -n "$AUTH_DIGEST" ]; then
              printf 'export RESOLVED_AUTH_IMAGE=%s\n' "$AUTH_DIGEST" >> /tmp/deploy_env.sh
            else
              printf 'export RESOLVED_AUTH_IMAGE=%s\n' "$AUTH_REPO:$CHOSEN_AUTH" >> /tmp/deploy_env.sh
            fi
```

最后修改 `write env file` stage，把单变量写入扩展为两变量：

```yaml
        - name: write env file
          script: |
            set -eu
            . /tmp/deploy_env.sh
            ssh -o StrictHostKeyChecking=no -i ~/.ssh/id_ed25519 \
              "$CLEAN_USER@$CLEAN_HOST" \
              "printf 'HI_AGENT_IMAGE=%s\nAUTH_SERVER_IMAGE=%s\n' '$RESOLVED_IMAGE' '$RESOLVED_AUTH_IMAGE' > $DEPLOY_PATH/.env && cat $DEPLOY_PATH/.env"
```

> 重点：保留原有 `choose image tag` 的 hi-agent 拉取逻辑不动；新逻辑**仅追加**到该 stage 末尾。`write env file` 整段需要替换为上面新版本，确保两个 IMAGE 变量都被写入。

- [ ] **Step 4：运行测试，确认通过**

```bash
./scripts/check-cnb.sh
# 期望：OK
```

- [ ] **Step 5：commit**

```bash
git add .cnb.yml scripts/check-cnb.sh
git commit -m "ci(cnb): build/push auth-server image + write AUTH_SERVER_IMAGE to .env"
```

---

### Task 7.2：deploy/.env 服务器侧文档化（手动一次性配置）

**Files:**
- Modify: [README.md](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/README.md)（在「部署」章节追加一节"首次部署：auth-server 与 postgres"）

- [ ] **Step 1：写失败测试（README 关键段落存在性）**

新增 [scripts/check-readme.sh](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/scripts/check-readme.sh)：

```bash
#!/usr/bin/env bash
set -euo pipefail
F=README.md

for kw in "首次部署" "POSTGRES_PASSWORD" "OTP_PEPPER" "SMTP_HOST" "AUTH_SERVER_IMAGE"; do
  grep -nF "$kw" "$F" >/dev/null \
    || { echo "FAIL: README 缺少关键字 '$kw'"; exit 1; }
done
echo "OK"
```

```bash
chmod +x scripts/check-readme.sh
./scripts/check-readme.sh
# 期望：FAIL: README 缺少关键字 '首次部署'
```

- [ ] **Step 2：实现——在 README.md 部署章节追加内容**

在 [README.md](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/README.md) 现有部署章节下追加：

```markdown
### 首次部署：auth-server 与 postgres

1. 在服务器准备目录与持久化卷（按你部署机器实际路径）：

   ```bash
   sudo mkdir -p /opt/hi-agent
   ```

2. 拷贝并填写环境变量：

   ```bash
   scp deploy/.env.example user@server:/opt/hi-agent/.env
   ssh user@server "chmod 600 /opt/hi-agent/.env && vim /opt/hi-agent/.env"
   ```

   必填项：
   - `POSTGRES_PASSWORD`：随机 32+ 字节强密码
   - `OTP_PEPPER`：`openssl rand -base64 32`
   - `DATABASE_URL`：`postgresql://hi_agent:<上面密码>@postgres:5432/hi_agent?schema=public`
   - `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM`：你的发信账号
   - `SESSION_COOKIE_SECURE=true`（生产环境必开）

   `HI_AGENT_IMAGE` 与 `AUTH_SERVER_IMAGE` 由 CNB 流水线在每次部署时写入，**手工不要填**。

3. 触发 CNB 流水线（push 到 main），构建结束后流水线会：
   - 在服务器上写入 `/opt/hi-agent/.env`（追加 IMAGE 变量）
   - `docker compose pull && up -d --force-recreate`

4. 烟测：

   ```bash
   curl -fsS https://你的域名/api/health
   ```
```

- [ ] **Step 3：运行测试，确认通过**

```bash
./scripts/check-readme.sh
# 期望：OK
```

- [ ] **Step 4：commit**

```bash
git add README.md scripts/check-readme.sh
git commit -m "docs(deploy): document first-time auth-server + postgres setup"
```

### PR-7 验收清单

- [ ] `./scripts/check-cnb.sh` 通过
- [ ] `./scripts/check-readme.sh` 通过
- [ ] CNB 流水线一次完整运行：hi-agent push → auth-server push → ssh deploy → write env (含两 IMAGE) → compose up
- [ ] 服务器 `/opt/hi-agent/.env` 内同时存在 `HI_AGENT_IMAGE=` 与 `AUTH_SERVER_IMAGE=` 行，且都为 RepoDigest 形式
- [ ] 上线后 `curl https://<域名>/api/health` 返回 `{"ok":true,"db":"up"}`

---

## Self-Review

> 完成 PR-0~PR-7 全部 task 编写后，运行下面的清单做一次 fresh-eyes 复查。本节是 plan 内的强制审查项，**实际实现时可省略**；写 plan 阶段需确认全部通过。

### 1) Spec 覆盖

对照 [auth-system-design.md](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/docs/superpowers/specs/2026-05-18-auth-system-design.md) 逐条勾选：

- [x] §3 5 张表 schema → PR-2 Task 2.3 / 2.4
- [x] §4 错误码常量 → PR-3 Task 3.1
- [x] §5 OTP 哈希 + 限频 + 防枚举 → PR-3 Task 3.2 / 3.3 / 3.7 / 3.8
- [x] §6 session + Cookie + 滑动续期 → PR-3 Task 3.4
- [x] §7 主链路四端点 → PR-3 Task 3.7~3.9
- [x] §8 profile / password / oauth 骨架 → PR-5 全部 task
- [x] §9 docker compose + Caddy 反代 → PR-1 / PR-4
- [x] §10 CNB 流水线 → PR-7
- [x] 移除 GH Pages → PR-0
- [x] 前端 UI 挂载 → PR-6

### 2) Placeholder 扫描

- [ ] 全文搜索 `TODO|TBD|implement later|fill in details|"similar to Task"` 应当**0 命中**：

```bash
grep -nE 'TODO|TBD|implement later|fill in details|similar to Task' \
  docs/superpowers/plans/2026-05-18-auth-system-implementation.md || echo "OK: no placeholders"
```

### 3) 类型 / 函数命名一致性

- [ ] `revokeOtherSessions(userId, sessionId)`：PR-3 Task 3.4 定义、PR-5 Task 5.3 调用 → 签名一致 ✅
- [ ] `getAuthedUser(req)`：PR-3 Task 3.5 定义、PR-5 三个 route 调用 → 一致 ✅
- [ ] `mergeCustomFields(existing, patch)`：PR-5 Task 5.1 定义、5.2 调用 → 一致 ✅
- [ ] 错误码字面量 `RATE_LIMITED / INVALID_INPUT / INVALID_OR_EXPIRED / UNAUTHORIZED / FORBIDDEN / ACCOUNT_DISABLED / NOT_IMPLEMENTED / INTERNAL`：后端 [errors.ts](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/server/lib/errors.ts) 与前端 [auth-client.ts](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/lib/auth/auth-client.ts) `ErrorCode` 联合类型完全对齐 ✅
- [ ] Cookie 名 `hi_sid`：PR-3 Task 3.4 + PR-5/PR-6 测试夹具一致 ✅

### 4) 命令可执行性

- [ ] 所有 `cd server && ...` 类命令都先于 PR-2 Task 2.1 创建了 `server/` 目录与 `package.json` ✅
- [ ] 所有 `docker compose -f deploy/docker-compose.yml --env-file deploy/.env ...` 都先于 PR-1 Task 1.3 与 PR-4 Task 4.2 完成相关文件落盘 ✅
- [ ] 所有 `./scripts/*.sh` 在使用前都已 `chmod +x` ✅

---

## Execution Handoff

Plan 已完整落盘。现在请二选一开始实施：

**1. Subagent-Driven（推荐）** — 主会话每次只 dispatch 一个 fresh subagent 完成一个 task，subagent 返回后由主会话做 two-stage review，再进入下一个 task。
   - 触发：使用 superpowers:subagent-driven-development skill
   - 优势：每个 task 上下文干净；评审节点细；适合对代码质量敏感的关键链路（OTP / session / 反代）
   - 节奏：约 35 个 task → 35 轮 dispatch + review

**2. Inline Execution** — 当前会话内连续执行 task，按 PR 边界做批次 checkpoint。
   - 触发：使用 superpowers:executing-plans skill
   - 优势：上下文连续；可跨 task 复用调研结果（如 prisma migration 已起的 PG 容器）
   - 节奏：以 PR 为单位 review；PR-3 / PR-6 是两个最大的 checkpoint

请告知选择哪种方式，我即按所选 skill 启动实施。

