# 用户认证系统 设计（Postgres + Next.js Route Handlers + 邮箱 OTP）

* 状态：草案待评审

* 日期：2026-05-18

* 关联现状：[Dockerfile](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/Dockerfile)、[deploy/docker-compose.yml](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/deploy/docker-compose.yml)、[docker/Caddyfile](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/docker/Caddyfile)、[next.config.mjs](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/next.config.mjs)、[.cnb.yml](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/.cnb.yml)、[strip-studio.mjs](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/scripts/strip-studio.mjs)

* 风格参考：[2026-05-17-comments-system-design.md](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/docs/superpowers/specs/2026-05-17-comments-system-design.md)

## 1. 背景与目标

Hi-Agent 课程站点目前是 Next.js + Nextra 的 **静态导出**（[next.config.mjs#L21-L38](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/next.config.mjs#L21-L38) `output: 'export'`），由 [Caddyfile](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/docker/Caddyfile) 直接托管静态产物。评论使用 Giscus（[comments-config.ts](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/lib/comments/comments-config.ts)），不依赖站点自身后端。截至本期，站点没有任何"用户"概念。

**目标**：

1. 在 Docker 编排中接入 PostgreSQL（镜像 `docker.cnb.cool/jaguarliu.cool/wenyuan-ai/docker-sync/postgres:16-alpine_amd64`）
2. 设计**账号身份**与**用户资料**两套表，预留第三方登录（微信 / GitHub）扩展
3. 本期实现 **邮箱验证码登录（OTP）即注册**主流程，并预留密码登录、改密、第三方登录的接口骨架
4. 同步移除 GitHub Pages 部署（站点统一走 CNB 流水线），削减为 GH Pages 维持的兼容分支

**非目标**：

* 不实现"忘记密码"前端入口（建表与限频策略覆盖到位，前端不暴露）

* 不实现微信 / GitHub OAuth 登录（路由占位返回 501）

* 不引入短信验证码登录（`users` 表不留 `phone` 列）

* 本期不做 admin 后台（`users.role` 仅预留枚举）

## 2. 架构与边界

### 2.1 选型（已锁定）

| 维度   | 决策                                                                                                                                         | 理由                                                                                                                                          |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| 后端形态 | **独立 Next.js 工程**置于 `server/`，`output: 'standalone'`                                                                                       | 既不污染前端 [strip-studio.mjs](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/scripts/strip-studio.mjs) 静态导出，又能与前端共享 zod schema / TS 心智 |
| ORM  | **Prisma 6**                                                                                                                               | 用户已选；Prisma migrate deploy 入口便利                                                                                                             |
| 校验   | **Zod**（沿用 [manifest-schema.ts#L27](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/lib/playground/manifest-schema.ts#L27) 风格） | 全栈一致                                                                                                                                        |
| 邮件   | **nodemailer (SMTP)**                                                                                                                      | 通用、可换企业邮 / 阿里云邮件推送                                                                                                                          |
| 密码哈希 | **argon2id**                                                                                                                               | OWASP 2024 推荐基线                                                                                                                             |
| 会话   | **DB sessions 表 + httpOnly Cookie**（非 JWT）                                                                                                 | 服务端可吊销；改密强制下线                                                                                                                               |
| 部署形态 | 单机 docker compose；`hi-agent` 对外、`auth-server` 与 `postgres` 仅内网                                                                             | 攻击面最小                                                                                                                                       |

### 2.2 容器拓扑

```
浏览器
  │ (HTTPS 由上游 LB 终止)
  ▼
┌───────────────────────────────┐
│ hi-agent (Caddy, :80)         │  现有静态站点（不动构建产物）
│  /            → /srv          │
│  /api/*       → reverse_proxy │  ★ 新增 6 行
└──────────┬────────────────────┘
           │ docker network: hi-agent-net
           ▼
┌───────────────────────────────┐
│ auth-server (Node, :3000)     │  ★ 新增：注册/登录/会话/邮件
│  Next.js Route Handlers       │
│  Prisma + nodemailer + zod    │
└──────────┬────────────────────┘
           │
           ▼
┌───────────────────────────────┐
│ postgres (16-alpine, :5432)   │  ★ 新增（用户指定镜像）
│  数据卷 pg-data               │
│  127.0.0.1:55432:5432         │  仅本机环回，便于排障
└───────────────────────────────┘
```

要点：

* 前端构建链路完全不动；GH Pages 移除后基础结构进一步简化（见 §7）

* `server/` 独立 `package.json` / `Dockerfile`，与前端解耦；`server/.dockerignore` 单独维护

* 前端通过相对路径 `/api/auth/...` 调用，无跨域问题

* Caddy 反代规则放在 `try_files` 之前，避免 `/api/*` 被静态兜底吃掉

### 2.3 关键约束

* **不破坏静态导出**：[next.config.mjs#L27](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/next.config.mjs#L27) 的 `output: 'export'` 保持；新增的服务端能力都在 `server/` 工程内

* **不复用** [app/api](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/api)：该目录在 [strip-studio.mjs](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/scripts/strip-studio.mjs) 中会被生产构建移除

* **不破坏 WebContainer**：[Caddyfile#L21-L26](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/docker/Caddyfile#L21-L26) 的 COOP/COEP 规则保留

## 3. 数据库 Schema（5 张表）

### 设计原则

* 关注点拆分：身份（`users`）/ 资料（`user_profiles`）/ 第三方（`oauth_accounts`）/ 凭据（`email_otps`）/ 会话（`sessions`）分表

* 命名：列 `snake_case`，Prisma 模型 `camelCase` + `@map`

* 审计：每张表 `created_at` / `updated_at`；`users` 多一列 `deleted_at` 软删除

* 预留：身份/资料表显式留出业务侧扩展槽位（详见各表）

### 3.1 `users` — 账号身份（与登录方式解耦）

| 列                                          | 类型                                              | 必填     | 说明                              |
| ------------------------------------------ | ----------------------------------------------- | ------ | ------------------------------- |
| `id`                                       | `uuid` PK                                       | ✓      | `gen_random_uuid()`             |
| `email`                                    | `citext` UNIQUE                                 | ✓      | OTP 与未来密码登录的主标识                 |
| `email_verified_at`                        | `timestamptz`                                   | <br /> | OTP 通过后写入                       |
| `password_hash`                            | `text`                                          | <br /> | argon2id；OTP 登录时为 NULL          |
| `password_updated_at`                      | `timestamptz`                                   | <br /> | 改密后强制其它端下线时使用                   |
| `status`                                   | `enum('pending','active','disabled','deleted')` | ✓      | 默认 `active`；`pending` 预留邮箱待验证态  |
| `role`                                     | `enum('user','editor','admin','superadmin')`    | ✓      | 默认 `user`；多预留两级避免日后 ALTER       |
| `plan`                                     | `enum('free','pro','team')`                     | ✓      | 默认 `free`，**预留**付费等级            |
| `plan_expires_at`                          | `timestamptz`                                   | <br /> | **预留**                          |
| `referrer_user_id`                         | `uuid` FK→users.id                              | <br /> | **预留** 邀请人                      |
| `referral_code`                            | `text` UNIQUE NULL                              | <br /> | **预留** 自己的邀请码                   |
| `last_login_at`                            | `timestamptz`                                   | <br /> | <br />                          |
| `last_login_ip`                            | `inet`                                          | <br /> | <br />                          |
| `last_login_ua`                            | `text`                                          | <br /> | <br />                          |
| `login_count`                              | `int4`                                          | ✓      | 默认 0                            |
| `failed_login_count`                       | `int2`                                          | ✓      | 默认 0；密码登录开启后用                   |
| `locked_until`                             | `timestamptz`                                   | <br /> | 暴力破解临时锁                         |
| `flags`                                    | `jsonb` default `'{}'`                          | ✓      | 业务侧开关位（如 `{"newsletter":true}`） |
| `created_at` / `updated_at` / `deleted_at` | `timestamptz`                                   | <br /> | <br />                          |

索引：`UNIQUE(email)`、`UNIQUE(referral_code)`、`INDEX(status)`。

### 3.2 `user_profiles` — 个人资料（1:1）

| 列                           | 类型                                                            | 说明                                     |
| --------------------------- | ------------------------------------------------------------- | -------------------------------------- |
| `user_id`                   | `uuid` PK + FK→users.id ON DELETE CASCADE                     | <br />                                 |
| `display_name`              | `text`                                                        | 评论展示昵称                                 |
| `username`                  | `citext` UNIQUE NULL                                          | **预留** @handle                         |
| `avatar_url`                | `text`                                                        | OAuth 接入时同步                            |
| `bio`                       | `text`                                                        | 个性签名                                   |
| `gender`                    | `enum('unknown','male','female','other')` default `'unknown'` | <br />                                 |
| `birthday`                  | `date`                                                        | <br />                                 |
| `location`                  | `text`                                                        | 城市/地区                                  |
| `occupation`                | `text`                                                        | 职业                                     |
| `learning_goal`             | `text`                                                        | 课程站特有：学习目标                             |
| `website_url`               | `text`                                                        | 个人网站                                   |
| `social_links`              | `jsonb` default `'{}'`                                        | 结构化：`{"twitter":"...","github":"..."}` |
| `locale`                    | `text` default `'zh-CN'`                                      | <br />                                 |
| `timezone`                  | `text` default `'Asia/Shanghai'`                              | <br />                                 |
| `notification_prefs`        | `jsonb` default `'{}'`                                        | 通知偏好                                   |
| `custom_fields`             | `jsonb` default `'{}'`                                        | **用户可写**自定义字段（前端 Profile 表单暴露）         |
| `metadata`                  | `jsonb` default `'{}'`                                        | **仅后端可写**系统字段（埋点/AB/来源等）               |
| `created_at` / `updated_at` | `timestamptz`                                                 | <br />                                 |

`custom_fields` / `metadata` 拆开是为了"读写权限分层"：用户自填内容不会覆盖系统语义。

### 3.3 `oauth_accounts` — 第三方账号绑定（**预留**，本期不实现登录）

| 列                                        | 类型                                   | 必填     | 说明                          |
| ---------------------------------------- | ------------------------------------ | ------ | --------------------------- |
| `id`                                     | `uuid` PK                            | ✓      | <br />                      |
| `user_id`                                | `uuid` FK→users.id ON DELETE CASCADE | ✓      | <br />                      |
| `provider`                               | `enum('wechat','github','google')`   | ✓      | google 一并预留                 |
| `provider_account_id`                    | `text`                               | ✓      | 微信 unionid / GitHub user id |
| `provider_username`                      | `text`                               | <br /> | GitHub login 等              |
| `access_token_enc` / `refresh_token_enc` | `bytea`                              | <br /> | 加密存储，**预留**本期可空             |
| `token_expires_at`                       | `timestamptz`                        | <br /> | <br />                      |
| `scope`                                  | `text`                               | <br /> | <br />                      |
| `raw_profile`                            | `jsonb`                              | <br /> | 第三方原始 profile 快照            |
| `created_at` / `updated_at`              | `timestamptz`                        | <br /> | <br />                      |

索引：`UNIQUE(provider, provider_account_id)`、`INDEX(user_id)`。

### 3.4 `email_otps` — 邮箱验证码（兼任改密 / 找回密码 token）

| 列             | 类型                                            | 必填     | 说明                          |
| ------------- | --------------------------------------------- | ------ | --------------------------- |
| `id`          | `uuid` PK                                     | ✓      | <br />                      |
| `email`       | `citext`                                      | ✓      | 不外键 `users.email`（注册前可能不存在） |
| `code_hash`   | `text`                                        | ✓      | sha256(code + PEPPER)，不存明文  |
| `purpose`     | `enum('login','bind_email','reset_password')` | ✓      | 用 `purpose` 区分意图，避免再开一张表    |
| `expires_at`  | `timestamptz`                                 | ✓      | 默认 10 分钟                    |
| `consumed_at` | `timestamptz`                                 | <br /> | 防重放                         |
| `attempts`    | `int2`                                        | ✓      | 失败计数 ≥ 5 即作废                |
| `request_ip`  | `inet`                                        | <br /> | 限频统计                        |
| `created_at`  | `timestamptz`                                 | ✓      | <br />                      |

索引：`INDEX(email, purpose, created_at DESC)`、`INDEX(expires_at)`（清理用）。

### 3.5 `sessions` — 服务端会话

| 列              | 类型                                   | 必填     | 说明                                     |
| -------------- | ------------------------------------ | ------ | -------------------------------------- |
| `id`           | `text` PK                            | ✓      | Cookie `hi_sid`；32 字节 random base64url |
| `user_id`      | `uuid` FK→users.id ON DELETE CASCADE | ✓      | <br />                                 |
| `expires_at`   | `timestamptz`                        | ✓      | 30 天滑动续期                               |
| `last_seen_at` | `timestamptz`                        | ✓      | 节流：每分钟最多更新 1 次                         |
| `ip`           | `inet`                               | <br /> | 创建时记录                                  |
| `user_agent`   | `text`                               | <br /> | 创建时记录                                  |
| `revoked_at`   | `timestamptz`                        | <br /> | 主动登出 / 改密时批量吊销                         |
| `created_at`   | `timestamptz`                        | ✓      | <br />                                 |

索引：`INDEX(user_id, revoked_at)`、`INDEX(expires_at)`。

### 3.6 数据库扩展

迁移文件首条 SQL：

```sql
CREATE EXTENSION IF NOT EXISTS citext;
-- inet 为 PostgreSQL 内建类型，无需额外扩展
-- gen_random_uuid 在 PG14+ 内建（pgcrypto 已合入 pg_catalog）
```

## 4. API 设计

所有路由前缀 `/api`，落在 `server/app/api/**/route.ts`。前端通过相对路径调用，Caddy 反代到 `auth-server:3000`。

### 4.1 端点清单

| Method  | Path                                        | 用途                                       | 本期       |
| ------- | ------------------------------------------- | ---------------------------------------- | -------- |
| `POST`  | `/api/auth/otp/request`                     | 发送邮箱验证码（注册即登录共用）                         | ✅        |
| `POST`  | `/api/auth/otp/verify`                      | 校验 OTP → 创建/复用账号 → 写 session → 下发 Cookie | ✅        |
| `POST`  | `/api/auth/logout`                          | 销毁当前 session，清除 Cookie                   | ✅        |
| `GET`   | `/api/auth/me`                              | 当前登录用户（带 profile）                        | ✅        |
| `PATCH` | `/api/users/me/profile`                     | 更新当前用户 profile（含 `custom_fields`）        | ✅        |
| `POST`  | `/api/auth/password/set`                    | 首次设置密码（已登录）                              | ✅ 接口骨架   |
| `POST`  | `/api/auth/password/change`                 | 已知旧密码改密                                  | ✅ 接口骨架   |
| `POST`  | `/api/auth/password/reset/request`          | 忘记密码 → 发 OTP（`reset_password`）           | ❌ 本期不实现  |
| `POST`  | `/api/auth/password/reset/verify`           | 凭 OTP 设置新密码                              | ❌ 本期不实现  |
| `GET`   | `/api/auth/oauth/{wechat\|github}/start`    | 第三方登录入口                                  | ❌ 占位 501 |
| `GET`   | `/api/auth/oauth/{wechat\|github}/callback` | 第三方回调                                    | ❌ 占位 501 |
| `GET`   | `/api/health`                               | 健康检查                                     | ✅        |

### 4.2 主流程

#### 流程 A：邮箱 OTP 注册即登录

```
POST /api/auth/otp/request { email }
  ├─ Zod 校验（email 格式、长度 ≤ 254、toLowerCase().trim()）
  ├─ 限频（见 §5.1）
  ├─ 生成 6 位 code（crypto.randomInt 100000..999999）
  ├─ 存 email_otps：code_hash=sha256(code+PEPPER), purpose=login, expires=now+10min
  ├─ 异步发邮件（nodemailer），失败仅记录日志，不影响响应
  └─ 200 { ok: true }                ← 永远 200，避免邮箱枚举

POST /api/auth/otp/verify { email, code }
  ├─ 取最近一条 purpose=login 未消费 OTP
  ├─ attempts++（≥5 直接 410 INVALID_OR_EXPIRED 锁死该 OTP）
  ├─ 比对 sha256(code+PEPPER) === code_hash
  ├─ 标记 consumed_at；事务内：
  │    ├─ users 不存在 → 创建（status=active, email_verified_at=now）
  │    │    + 同步建一行 user_profiles（display_name=email 前缀）
  │    └─ 已存在 → 更新 last_login_*、login_count++、email_verified_at
  ├─ 生成 sid=base64url(random(32))；写 sessions（30 天）
  └─ Set-Cookie: hi_sid=...; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000
     200 { user: { id, email, profile: {...} } }
```

#### 流程 B：鉴权中间件

```
请求带 Cookie hi_sid
  ├─ SELECT * FROM sessions WHERE id=$1 AND revoked_at IS NULL AND expires_at > now()
  ├─ 命中：滑动续期（last_seen_at 节流到 60s）
  ├─ 未命中：401 UNAUTHORIZED
  └─ ctx.user = users JOIN user_profiles
```

#### 流程 C：登出

```
POST /api/auth/logout
  ├─ UPDATE sessions SET revoked_at=now() WHERE id=$1
  └─ Set-Cookie: hi_sid=; Max-Age=0
```

#### 流程 D：设置 / 修改密码（接口骨架）

```
POST /api/auth/password/set     // 首次：password_hash IS NULL 时允许
  Body { newPassword }
  → 强度校验（≥8 位，含字母+数字）
  → users.password_hash = argon2id(newPassword)
  → users.password_updated_at = now()
  → 吊销除当前 session 外所有 sessions

POST /api/auth/password/change  // 二次：要旧密码
  Body { oldPassword, newPassword }
  → 校验旧密码 → 同上写入 + 吊销其它 sessions
```

### 4.3 错误码

统一返回 `{ ok:false, code, message }`：

| code                 | HTTP | 含义                        |
| -------------------- | ---- | ------------------------- |
| `RATE_LIMITED`       | 429  | 触发限频；带 `Retry-After`      |
| `INVALID_INPUT`      | 400  | Zod 校验失败                  |
| `INVALID_OR_EXPIRED` | 410  | OTP 错误或过期（与"邮箱不存在"统一文案）   |
| `UNAUTHORIZED`       | 401  | 未登录                       |
| `FORBIDDEN`          | 403  | 已登录无权限（admin）             |
| `ACCOUNT_DISABLED`   | 423  | `users.status='disabled'` |
| `NOT_IMPLEMENTED`    | 501  | OAuth 占位                  |
| `INTERNAL`           | 500  | 兜底                        |

## 5. 安全策略

### 5.1 限频

| 维度               | 策略                                                        |
| ---------------- | --------------------------------------------------------- |
| 同一 email 发码      | 60s 内 1 次；1h 最多 5 次；24h 最多 10 次                           |
| 同一 IP 发码         | 1h 最多 30 次                                                |
| 同一 OTP 校验        | `attempts ≥ 5` 即作废                                        |
| 同一 email 校验失败    | 1h 内 ≥ 20 次 → 暂封 30min                                    |
| 密码尝试（未来）         | `failed_login_count ≥ 5` → `locked_until = now() + 15min` |
| 全局 `/api/auth/*` | 每 IP 100 req/min                                          |

实现：DB 计数（基于 `email_otps.created_at` 聚合）+ 进程内 LRU；未来流量上来后可换 Redis。

### 5.2 防邮箱枚举

* `/otp/request` 永远 200

* `/otp/verify` 失败统一返回 `INVALID_OR_EXPIRED`，不区分"邮箱不存在"

* 邮件投递失败只记日志，不影响 HTTP 响应

### 5.3 Cookie 策略

```
Set-Cookie: hi_sid=<sid>;
            HttpOnly;          // 防 XSS 窃取
            Secure;            // 仅 HTTPS（dev: SECURE_COOKIE=false）
            SameSite=Lax;      // 防 CSRF
            Path=/;
            Max-Age=2592000;   // 30 天
            // 不设 Domain；默认仅当前主机
```

### 5.4 CSRF

* SameSite=Lax + 同源 + 状态变更端点仅接受 `Content-Type: application/json` → 实质阻断 CSRF

* 不强制 token；未来跨域时再补 double-submit

### 5.5 输入安全

* 全部 body 走 Zod

* email：`z.string().email().max(254).trim().toLowerCase()`

* code：`z.string().regex(/^\d{6}$/)`

* `custom_fields`：单字段 ≤ 1000 字符；键数 ≤ 30；总大小 ≤ 8KB；嵌套层级 ≤ 2；key 黑名单（`password`/`role`/`status`/`plan` 等系统语义）

### 5.6 密码（未来启用）

* argon2id：`memoryCost=19MiB, timeCost=2, parallelism=1`（OWASP 2024 基线）

* 强度：≥ 8 位，含字母 + 数字；不强制特殊字符

* 不做密码历史；改密 → 吊销其它会话

### 5.7 邮件文案（防钓鱼）

* 主题：`【Hi-Agent】你的登录验证码：123456`

* 正文：明示"10 分钟内有效"、"请勿向他人转述"、"如非本人操作请忽略"

* **不放任何"一键登录"链接**，避免被中间人构造钓鱼链接

## 6. Docker / 编排 / 环境变量

### 6.1 [deploy/docker-compose.yml](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/deploy/docker-compose.yml) 最终形态

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
      - "127.0.0.1:55432:5432"   # 仅本机环回；55432 避免与本地实例冲突
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $${POSTGRES_USER} -d $${POSTGRES_DB}"]
      interval: 10s
      timeout: 5s
      retries: 10
      start_period: 20s

  auth-server:
    image: ${AUTH_SERVER_IMAGE:?AUTH_SERVER_IMAGE must be set in .env}
    container_name: hi-agent-auth
    restart: unless-stopped
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}?schema=public
      OTP_PEPPER: ${OTP_PEPPER:?OTP_PEPPER must be set}
      SESSION_COOKIE_NAME: hi_sid
      SESSION_TTL_DAYS: "30"
      SECURE_COOKIE: "true"
      SMTP_HOST: ${SMTP_HOST:?SMTP_HOST must be set}
      SMTP_PORT: ${SMTP_PORT:-465}
      SMTP_SECURE: ${SMTP_SECURE:-true}
      SMTP_USER: ${SMTP_USER:?SMTP_USER must be set}
      SMTP_PASS: ${SMTP_PASS:?SMTP_PASS must be set}
      SMTP_FROM: ${SMTP_FROM:?SMTP_FROM must be set}
      APP_BASE_URL: ${APP_BASE_URL:-https://hi-agent.local}
      LOG_LEVEL: info
      TZ: Asia/Shanghai
    networks: [hi-agent-net]
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://127.0.0.1:3000/api/health"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 20s

  hi-agent:
    image: ${HI_AGENT_IMAGE:?HI_AGENT_IMAGE must be set in .env (deploy pipeline writes it)}
    container_name: hi-agent
    restart: unless-stopped
    depends_on:
      auth-server:
        condition: service_healthy
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

### 6.2 [docker/Caddyfile](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/docker/Caddyfile) 改动（最小侵入）

在 `:80 { ... }` 块内、`try_files` 之前插入：

```caddyfile
    # --- API reverse proxy → auth-server -----------------------------
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

`handle` 命中即短路，不会再走 [Caddyfile#L80](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/docker/Caddyfile#L80) 的 `try_files`。

### 6.3 [server/Dockerfile](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/server/Dockerfile) 草稿

```dockerfile
# syntax=docker/dockerfile:1.7

FROM node:20-alpine AS deps
WORKDIR /app
COPY server/package.json server/package-lock.json ./
RUN npm ci --include=dev

FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY server/. ./
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000
RUN apk add --no-cache wget tini
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma
COPY server/scripts/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health >/dev/null || exit 1
ENTRYPOINT ["/sbin/tini","--","/usr/local/bin/entrypoint.sh"]
CMD ["node","server.js"]
```

`server/scripts/entrypoint.sh`：

```bash
#!/bin/sh
set -e
echo "[entrypoint] running prisma migrate deploy ..."
npx prisma migrate deploy
exec "$@"
```

启动时自动执行 `prisma migrate deploy`（幂等），失败则容器健康检查失败、自动回滚到上一版本。

### 6.4 环境变量清单（落到 `deploy/.env.example`）

| 变量                  | 必填     | 示例 / 默认                   | 说明                 |
| ------------------- | ------ | ------------------------- | ------------------ |
| `HI_AGENT_IMAGE`    | ✓      | CI 写入                     | 沿用现有               |
| `AUTH_SERVER_IMAGE` | ✓      | CI 写入                     | 新增                 |
| `POSTGRES_DB`       | ✓      | `hi_agent`                | <br />             |
| `POSTGRES_USER`     | ✓      | `hi_agent`                | <br />             |
| `POSTGRES_PASSWORD` | ✓      | `openssl rand -base64 32` | <br />             |
| `OTP_PEPPER`        | ✓      | `openssl rand -base64 32` | 改动会让所有未消费 OTP 失效   |
| `SMTP_HOST`         | ✓      | `smtp.qiye.aliyun.com`    | <br />             |
| `SMTP_PORT`         | <br /> | `465`                     | <br />             |
| `SMTP_SECURE`       | <br /> | `true`                    | 465→true，587→false |
| `SMTP_USER`         | ✓      | `noreply@hi-agent.cn`     | <br />             |
| `SMTP_PASS`         | ✓      | —                         | <br />             |
| `SMTP_FROM`         | ✓      | `Hi-Agent <noreply@...>`  | <br />             |
| `APP_BASE_URL`      | <br /> | `https://hi-agent.local`  | <br />             |
| `SECURE_COOKIE`     | <br /> | `true`                    | 本地 dev 可置 false    |
| `SESSION_TTL_DAYS`  | <br /> | `30`                      | <br />             |

### 6.5 机密管理：`.env` vs Docker Secrets

本期沿用 `.env`，需满足：

1. `deploy/.env` 文件 chmod 600，`.gitignore` 已覆盖
2. `deploy/.env.example` 入库，**只放 key 不放值**
3. 强密码统一用 `openssl rand -base64 32`
4. 未来上 swarm / k8s 时再迁 docker secrets / k8s Secret，迁移路径已预留（代码读 `process.env.X` 时可平滑切到 `fs.readFileSync('/run/secrets/X')`）

## 7. 移除 GitHub Pages 部署

### 7.1 现状

* [.github/workflows/deploy.yml](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/.github/workflows/deploy.yml) 仅服务于 GH Pages

* [.github/workflows/sync-cnb.yml](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/.github/workflows/sync-cnb.yml) 是 GitHub→CNB 镜像同步桥梁，**保留**

* [.cnb.yml](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/.cnb.yml) 中的 `update-knowledge-base` 流水线是 CNB 知识库构建，**保留不动**

* [next.config.mjs#L4-L34](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/next.config.mjs#L4-L34) 中的 `repo / isGhPages / basePath / assetPrefix` 仅为 GH Pages 服务

### 7.2 改动清单（PR-0）

1. 删除 [.github/workflows/deploy.yml](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/.github/workflows/deploy.yml)
2. 删除 [public/.nojekyll](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/public/.nojekyll)
3. 简化 [next.config.mjs](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/next.config.mjs)：

   * 移除 `repo`、`isGhPages`、`basePath`、`assetPrefix`

   * `env.NEXT_PUBLIC_BASE_PATH` 固定为 `''`
4. 全仓搜索 `NEXT_PUBLIC_BASE_PATH` / `GITHUB_PAGES` / `/hi-agent/`（仅 basePath 用途）→ 评估清理（如 [comments-config.ts#L73-L75](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/lib/comments/comments-config.ts#L73-L75) 的 basePath 兼容分支）
5. [README.md](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/README.md) 标注"GH Pages 已废弃，统一访问 CNB 部署域名"
6. **手动操作**：在 GitHub 仓库 Settings → Pages 停用站点（用户自行执行）

### 7.3 风险

| 风险                                | 缓解                                                                                                                                          |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| 老外链 / 书签指向 `*.github.io/hi-agent` | 用户手动停用 GH Pages；README 引导新域名                                                                                                                |
| Giscus 评论 pathname 漂移             | 上线前在两个有评论的页面实测；如有问题用 `mapping: 'specific'` 兜底                                                                                               |
| 旧 SW 缓存残留                         | bump SW 版本号；[Caddyfile#L51-L55](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/docker/Caddyfile#L51-L55) 已对 `/sw.js` 强制 `no-store` |
| 误删隐式依赖 GH Pages 的逻辑               | PR-0 单独 PR、独立审查                                                                                                                             |

## 8. 实施路线图（按 PR 切片）

| PR       | 主题                        | 关键交付                                                                                                                                                                                        | 验收                                                                         |
| -------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| **PR-0** | 移除 GitHub Pages           | 删除 deploy.yml / .nojekyll；瘦身 next.config.mjs；清理 basePath 分支                                                                                                                                 | `npm run build` + `npm test` 全绿；CNB 流水线正常                                  |
| **PR-1** | postgres 入网               | compose 加 postgres + pg-data + hi-agent-net；新增 deploy/.env.example                                                                                                                          | 本机 `psql -h 127.0.0.1 -p 55432` 可连；现有站点不退化                                 |
| **PR-2** | server/ 工程脚手架             | server/package.json / next.config.mjs / Prisma schema / 0001\_init 迁移 / Dockerfile / entrypoint.sh / .dockerignore                                                                          | `cd server && npm i && npm run build` 通过；容器起来后 `/api/health` 200；DB 5 张表落地 |
| **PR-3** | OTP + session 核心          | lib/(db, otp, session, mailer, rate-limit, auth-context, errors) + 4 个 auth 路由 + 单测                                                                                                         | 邮箱注册即登录全链路本地通；限频/反枚举验证通过                                                   |
| **PR-4** | Caddy 反代 + 编排接入           | Caddyfile @api 段；compose 加 auth-server；caddyfile.test 增量用例                                                                                                                                  | `docker compose up -d` 三容器全 healthy；`/api/*` 走 auth，其他走静态                  |
| **PR-5** | profile + 密码骨架 + OAuth 占位 | PATCH /users/me/profile（含 custom\_fields）；password/set & change；4 个 OAuth 路由 501                                                                                                            | profile 更新与超限校验生效；首次设置密码后其它 sessions 被吊销                                   |
| **PR-6** | 前端登录 UI                   | app/lib/auth/(auth-client, use-current-user, login-dialog, user-menu) + 顶栏挂载 + 测试                                                                                                           | 站点点登录→收码→登录态；30 天 cookie；登出后 me=401                                        |
| **PR-7** | CNB 流水线 + 文档              | 在 [.cnb.yml#L17-L195](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/.cnb.yml#L17-L195) `build-test-deploy` 同 pipeline 内串行追加 auth-server build & push stage；README + server/README | 一次推送即可同时构建/推送两镜像并部署；远端 `docker compose ps` 三 healthy                       |

### 8.1 CNB 流水线追加 stage 草图

在 [.cnb.yml#L72](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/.cnb.yml#L72) 之后、`install ssh client` 之前插入：

```yaml
        - name: docker build (auth-server)
          script: |
            set -eu
            AUTH_REPO="$IMAGE_REPO-auth"
            docker build \
              --pull \
              -f server/Dockerfile \
              -t "$AUTH_REPO:$CNB_COMMIT" \
              -t "$AUTH_REPO:latest" \
              .
        - name: docker push (auth-server)
          script: |
            set -eu
            AUTH_REPO="$IMAGE_REPO-auth"
            docker push "$AUTH_REPO:$CNB_COMMIT"
            docker push "$AUTH_REPO:latest"
```

deploy stage 中 `write env file` 增量追加 `AUTH_SERVER_IMAGE=...`（解析 RepoDigest 同款逻辑）。

### 8.2 风险与回滚（全局）

| 风险                                              | 缓解                                                                                 |
| ----------------------------------------------- | ---------------------------------------------------------------------------------- |
| Caddy 反代规则放错位置导致 `/api/*` 走 try\_files          | PR-4 加单测 + 上线前 curl 校验                                                             |
| `prisma migrate deploy` 在 entrypoint 失败导致容器反复重启 | 健康检查自然失败；运维通过切回旧 `AUTH_SERVER_IMAGE` 回滚                                            |
| OTP 邮件落垃圾箱                                      | PR-3 默认 dev mock 模式；PR-7 上线前用 mail-tester 校验 SPF/DKIM                              |
| 反代下 cookie 不下发                                  | Caddy `header_up X-Forwarded-Proto {scheme}` + `SECURE_COOKIE=true`；本地 dev 用 false |
| 数据库密码泄露                                         | `.env` 600 + `.gitignore` + 强随机；预留迁 secrets 路径                                     |

## 9. 待办与开放问题

* 域名最终选定（用于 `APP_BASE_URL` 与邮件文案）

* SMTP 凭据来源（用户在上线前提供）

* `GitHub OAuth App` / `微信开放平台` 接入计划（占位 501 落地后另起 spec）

* 评论系统是否要在登录后额外联动（本期不联动；用户登录与 Giscus 登录互相独立）

## 10. 参考

* 现状文件：[Dockerfile](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/Dockerfile)、[deploy/docker-compose.yml](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/deploy/docker-compose.yml)、[docker/Caddyfile](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/docker/Caddyfile)、[next.config.mjs](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/next.config.mjs)、[.cnb.yml](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/.cnb.yml)、[strip-studio.mjs](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/scripts/strip-studio.mjs)、[comments-config.ts](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/app/lib/comments/comments-config.ts)

* Spec 风格参考：[2026-05-17-comments-system-design.md](file:///Users/eumenides/Desktop/jaguarliu/core/hi-agent/docs/superpowers/specs/2026-05-17-comments-system-design.md)

