# WebContainers Runnable Docs V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a desktop-only, docs-embedded runnable Node/TypeScript example experience using WebContainers, with one brand-new isolated lab section wired end-to-end and no edits to existing course chapter content.

**Architecture:** Keep the docs as a reading-first Nextra/Next.js site, but add a single client-side WebContainers runtime per browser tab. Use explicit section manifests plus build-generated snapshots to mount a section workspace on demand, render it inside a right-side Monaco-based drawer, and execute only manifest-approved commands. Preserve static-export search by continuing to build `out/`, then serve it from Docker/Caddy with the required `COOP/COEP` headers.

**Tech Stack:** Next.js 15, Nextra, React 19, TypeScript, WebContainers, Monaco Editor, IndexedDB via `idb-keyval`, Zod, Vitest, React Testing Library, Playwright, Docker, Caddy

---

## Scope

This plan intentionally targets a V1 MVP and one pilot section only:

- infrastructure for runnable sections
- one pilot example workspace at `examples/labs/01-webcontainers-pilot`
- one new pilot docs page at `app/docs/labs/01-webcontainers-pilot/page.mdx`

Out of scope for this plan:

- migrating every chapter
- real terminal input
- long-term workspace persistence
- server-side LLM proxying
- mobile interactive editing

## File Structure Map

### Root Config And Deployment

- Modify: `package.json`
  - add runtime/test/build dependencies and scripts
- Modify: `next.config.mjs`
  - keep static export, add runtime headers in dev/server mode
- Modify: `.gitignore`
  - ignore generated WebContainer snapshot binaries
- Create: `.dockerignore`
  - keep Docker build context small
- Create: `Dockerfile`
  - build static docs and serve `out/`
- Create: `docker/Caddyfile`
  - serve exported docs with `COOP/COEP`

### Runtime And Manifest Modules

- Create: `app/lib/playground/runtime-headers.js`
  - shared header definitions for browser isolation
- Create: `app/lib/playground/manifest-schema.ts`
  - Zod schema for section manifests
- Create: `app/lib/playground/manifest-loader.ts`
  - typed manifest registry for runnable sections
- Create: `app/lib/playground/playground-state.ts`
  - reducer and state model for runtime/drawer status
- Create: `app/lib/playground/workspace-cache.ts`
  - IndexedDB TTL cache for exported section snapshots
- Create: `app/lib/playground/webcontainer-manager.ts`
  - single-tab runtime boot, mount, command execution, export
- Create: `app/lib/playground/anchor-locator.ts`
  - convert manifest anchors into Monaco line/column targets

### Client UI

- Create: `app/lib/playground/playground-provider.tsx`
  - client context that owns runtime orchestration
- Create: `app/lib/playground/playground-drawer.tsx`
  - right-side workspace drawer shell
- Create: `app/lib/playground/playground-file-tree.tsx`
  - simple project tree for current section workspace
- Create: `app/lib/playground/playground-editor.tsx`
  - Monaco editor wrapper with anchor focusing
- Create: `app/lib/playground/playground-output-panel.tsx`
  - read-only terminal-style output log
- Create: `app/lib/playground/playground-section.tsx`
  - section context provider for MDX pages
- Create: `app/lib/command-block.tsx`
  - MDX command block with `Run`
- Create: `app/lib/runnable-code-block.tsx`
  - MDX code block with `Edit`
- Create: `app/lib/open-project-button.tsx`
  - MDX CTA to open full project

### Content And Example Assets

- Modify: `app/docs/_meta.js`
  - add a hidden labs entry without touching chapter bodies
- Create: `app/docs/labs/_meta.js`
  - keep the lab route isolated from course navigation
- Create: `app/docs/labs/01-webcontainers-pilot/page.mdx`
  - pilot lab page, separate from chapter content
- Create: `examples/labs/01-webcontainers-pilot/manifest.json`
  - pilot section runtime mapping
- Create: `examples/labs/01-webcontainers-pilot/workspace/package.json`
  - pilot project dependencies and scripts
- Create: `examples/labs/01-webcontainers-pilot/workspace/tsconfig.json`
  - pilot TypeScript config
- Create: `examples/labs/01-webcontainers-pilot/workspace/.env.example`
  - optional local key file
- Create: `examples/labs/01-webcontainers-pilot/workspace/src/config.ts`
  - env parsing and mock/live mode switch
- Create: `examples/labs/01-webcontainers-pilot/workspace/src/openai-chat-client.ts`
  - one-shot chat client with mock fallback
- Create: `examples/labs/01-webcontainers-pilot/workspace/src/main.ts`
  - pilot runnable entrypoint
- Create: `scripts/build-webcontainer-snapshots.mjs`
  - generate `public/webcontainer-snapshots/*.bin`
- Modify: `mdx-components.js`
  - register custom MDX runtime components
- Modify: `app/layout.jsx`
  - mount the playground provider and drawer once
- Modify: `app/globals.css`
  - add drawer/editor/output styles

### Tests

- Create: `tests/unit/runtime-headers.test.ts`
- Create: `tests/unit/manifest-schema.test.ts`
- Create: `tests/unit/playground-state.test.ts`
- Create: `tests/unit/workspace-cache.test.ts`
- Create: `tests/unit/anchor-locator.test.ts`
- Create: `tests/components/command-block.test.tsx`
- Create: `tests/components/playground-drawer.test.tsx`
- Create: `tests/e2e/webcontainers-pilot-playground.spec.ts`
- Create: `vitest.config.ts`
- Create: `vitest.setup.ts`
- Create: `playwright.config.ts`

## Task 1: Add Tooling And Browser-Isolation Scaffolding

**Files:**
- Create: `app/lib/playground/runtime-headers.js`
- Create: `tests/unit/runtime-headers.test.ts`
- Create: `vitest.config.ts`
- Create: `vitest.setup.ts`
- Create: `playwright.config.ts`
- Modify: `package.json`
- Modify: `next.config.mjs`

- [ ] **Step 1: Write the failing test for runtime headers**

```ts
// tests/unit/runtime-headers.test.ts
import { describe, expect, it } from 'vitest';
import {
  WEBCONTAINER_HEADERS,
  getWebcontainerHeaderEntries
} from '@/app/lib/playground/runtime-headers';

describe('runtime headers', () => {
  it('exposes the required COOP and COEP headers', () => {
    expect(WEBCONTAINER_HEADERS).toEqual([
      { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
      { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' }
    ]);
  });

  it('maps the headers to a Next.js headers() entry', () => {
    expect(getWebcontainerHeaderEntries()).toEqual([
      {
        source: '/:path*',
        headers: WEBCONTAINER_HEADERS
      }
    ]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npx vitest run tests/unit/runtime-headers.test.ts
```

Expected:

- fail with `Cannot find module '@/app/lib/playground/runtime-headers'`
- or fail because `vitest` is not installed yet

- [ ] **Step 3: Add the minimal runtime-header implementation and test tooling**

```js
// app/lib/playground/runtime-headers.js
export const WEBCONTAINER_HEADERS = [
  { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' }
];

export function getWebcontainerHeaderEntries() {
  return [
    {
      source: '/:path*',
      headers: WEBCONTAINER_HEADERS
    }
  ];
}
```

```js
// next.config.mjs
import nextra from 'nextra';
import { getWebcontainerHeaderEntries } from './app/lib/playground/runtime-headers.js';

const repo = 'hi-agent';
const isGhPages = process.env.GITHUB_PAGES === 'true';
const basePath = isGhPages ? `/${repo}` : '';

const withNextra = nextra({
  defaultShowCopyCode: true,
  search: {
    codeblocks: false
  }
});

export default withNextra({
  reactStrictMode: true,
  output: 'export',
  images: { unoptimized: true },
  trailingSlash: true,
  basePath,
  assetPrefix: isGhPages ? `/${repo}/` : '',
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath
  },
  experimental: {
    optimizePackageImports: ['nextra-theme-docs']
  },
  async headers() {
    return getWebcontainerHeaderEntries();
  }
});
```

```json
// package.json (relevant excerpt)
{
  "scripts": {
    "dev": "next dev",
    "build": "next build && pagefind --site out --output-subdir _pagefind",
    "start": "next start",
    "export": "next build && pagefind --site out --output-subdir _pagefind",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test"
  }
}
```

Install the project packages:

```bash
npm install @monaco-editor/react @webcontainer/api idb-keyval zod
npm install -D @playwright/test @testing-library/jest-dom @testing-library/react jsdom vitest
```

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts']
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname)
    }
  }
});
```

```ts
// vitest.setup.ts
import '@testing-library/jest-dom/vitest';
```

```ts
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  use: {
    baseURL: 'http://127.0.0.1:3000',
    trace: 'retain-on-failure'
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://127.0.0.1:3000',
    reuseExistingServer: !process.env.CI
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ]
});
```

- [ ] **Step 4: Run the unit test to verify it passes**

Run:

```bash
npm install
npm run test -- tests/unit/runtime-headers.test.ts
```

Expected:

- `1 passed` suite
- the test output references `runtime headers`

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json next.config.mjs app/lib/playground/runtime-headers.js tests/unit/runtime-headers.test.ts vitest.config.ts vitest.setup.ts playwright.config.ts
git commit -m "chore: add webcontainer test and header scaffolding"
```

## Task 2: Add Manifest Schema, Pilot Workspace Source, And Snapshot Build

**Files:**
- Create: `app/lib/playground/manifest-schema.ts`
- Create: `app/lib/playground/manifest-loader.ts`
- Create: `tests/unit/manifest-schema.test.ts`
- Modify: `app/docs/_meta.js`
- Create: `app/docs/labs/_meta.js`
- Create: `app/docs/labs/01-webcontainers-pilot/page.mdx`
- Create: `examples/labs/01-webcontainers-pilot/manifest.json`
- Create: `examples/labs/01-webcontainers-pilot/workspace/package.json`
- Create: `examples/labs/01-webcontainers-pilot/workspace/tsconfig.json`
- Create: `examples/labs/01-webcontainers-pilot/workspace/.env.example`
- Create: `examples/labs/01-webcontainers-pilot/workspace/src/config.ts`
- Create: `examples/labs/01-webcontainers-pilot/workspace/src/openai-chat-client.ts`
- Create: `examples/labs/01-webcontainers-pilot/workspace/src/main.ts`
- Create: `scripts/build-webcontainer-snapshots.mjs`
- Modify: `package.json`
- Modify: `.gitignore`

- [ ] **Step 1: Write the failing manifest-schema test**

```ts
// tests/unit/manifest-schema.test.ts
import { describe, expect, it } from 'vitest';
import manifest from '@/examples/labs/01-webcontainers-pilot/manifest.json';
import {
  parsePlaygroundManifest,
  playgroundManifestSchema
} from '@/app/lib/playground/manifest-schema';

describe('playground manifest schema', () => {
  it('accepts the pilot section manifest', () => {
    const parsed = parsePlaygroundManifest(manifest);

    expect(parsed.id).toBe('labs-01-webcontainers-pilot');
    expect(parsed.defaultOpenFile).toBe('src/main.ts');
    expect(parsed.blocks.map((block) => block.blockId)).toEqual([
      'install-deps',
      'open-example',
      'main-ts-snippet',
      'config-snippet',
      'run-demo'
    ]);
  });

  it('rejects unknown block types', () => {
    const result = playgroundManifestSchema.safeParse({
      ...manifest,
      blocks: [{ blockId: 'bad', type: 'unknown' }]
    });

    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npm run test -- tests/unit/manifest-schema.test.ts
```

Expected:

- fail because the manifest file and schema module do not exist yet

- [ ] **Step 3: Add the pilot manifest, workspace source, loader, and snapshot build script**

```ts
// app/lib/playground/manifest-schema.ts
import { z } from 'zod';

const commandSpecSchema = z.object({
  cmd: z.string().min(1),
  args: z.array(z.string()).default([])
});

const blockSchema = z.discriminatedUnion('type', [
  z.object({
    blockId: z.string().min(1),
    type: z.literal('command'),
    label: z.string().min(1),
    command: commandSpecSchema
  }),
  z.object({
    blockId: z.string().min(1),
    type: z.literal('file-snippet'),
    path: z.string().min(1),
    anchor: z.string().min(1)
  }),
  z.object({
    blockId: z.string().min(1),
    type: z.literal('project-open')
  })
]);

export const playgroundManifestSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  snapshotId: z.string().min(1),
  snapshotUrl: z.string().min(1),
  defaultOpenFile: z.string().min(1),
  startup: z.object({
    installCommands: z.array(commandSpecSchema).default([]),
    runCommands: z.array(commandSpecSchema).default([]),
    env: z.array(z.string()).default([])
  }),
  blocks: z.array(blockSchema).min(1)
});

export type PlaygroundManifest = z.infer<typeof playgroundManifestSchema>;

export function parsePlaygroundManifest(input: unknown) {
  return playgroundManifestSchema.parse(input);
}
```

```ts
// app/lib/playground/manifest-loader.ts
import manifest from '@/examples/labs/01-webcontainers-pilot/manifest.json';
import {
  parsePlaygroundManifest,
  type PlaygroundManifest
} from '@/app/lib/playground/manifest-schema';

const registry: Record<string, PlaygroundManifest> = {
  'labs-01-webcontainers-pilot': parsePlaygroundManifest(manifest)
};

export function getPlaygroundManifest(sectionId: string) {
  const entry = registry[sectionId];
  if (!entry) {
    throw new Error(`Unknown playground section: ${sectionId}`);
  }
  return entry;
}
```

```json
// app/docs/_meta.js (relevant excerpt)
export default {
  index: '课程简介',
  '---chapters---': {
    type: 'separator',
    title: '课程章节'
  },
  chat: '01 · Chat',
  'agent-loop': '02 · Agent Loop',
  tool: '03 · Tool',
  'context-engineering': '04 · Context Engineering',
  memory: '05 · Memory',
  'multi-agent': '06 · Multi-Agent',
  harness: '07 · Harness',
  labs: {
    title: 'Labs',
    display: 'hidden'
  }
}
```

```js
// app/docs/labs/_meta.js
export default {
  index: {
    title: '实验入口',
    display: 'hidden'
  },
  '01-webcontainers-pilot': 'WebContainers 实验小节'
}
```

```mdx
<!-- app/docs/labs/01-webcontainers-pilot/page.mdx -->
---
title: WebContainers 实验小节
---

import { Callout } from 'nextra/components'
import { PlaygroundSection } from '../../../lib/playground/playground-section'
import { CommandBlock } from '../../../lib/command-block'
import { RunnableCodeBlock } from '../../../lib/runnable-code-block'
import { OpenProjectButton } from '../../../lib/open-project-button'

# WebContainers 实验小节

<PlaygroundSection sectionId="labs-01-webcontainers-pilot">

<Callout type="info">
这是一个独立的实验页，用于开发和验证可运行代码环境，不修改现有课程章节正文。
</Callout>

<OpenProjectButton>打开实验工作区</OpenProjectButton>

<CommandBlock blockId="install-deps" title="安装依赖" language="bash">
{`npm install`}
</CommandBlock>

<RunnableCodeBlock blockId="config-snippet" title="src/config.ts" language="ts">
{`export function loadConfig() {
  const apiKey = process.env.OPENAI_API_KEY?.trim() ?? '';
  return {
    baseUrl: process.env.OPENAI_BASE_URL?.trim() || 'https://api.openai.com/v1',
    apiKey,
    model: process.env.OPENAI_MODEL?.trim() || 'gpt-4.1-mini',
    useMock: apiKey.length === 0
  };
}`}
</RunnableCodeBlock>

<RunnableCodeBlock blockId="main-ts-snippet" title="src/main.ts" language="ts">
{`async function main() {
  const prompt = '请介绍一下 Agent 是什么';
  const config = loadConfig();
  const client = new OpenAiChatClient(config);
  const reply = await client.chat(prompt);
  console.log(\`User: \${prompt}\`);
  console.log(\`Assistant: \${reply}\`);
}`}
</RunnableCodeBlock>

<CommandBlock blockId="run-demo" title="运行 Demo" language="bash">
{`npm run chat`}
</CommandBlock>

</PlaygroundSection>
```

```json
// examples/labs/01-webcontainers-pilot/manifest.json
{
  "id": "labs-01-webcontainers-pilot",
  "title": "WebContainers 实验小节",
  "snapshotId": "labs-01-webcontainers-pilot-v1",
  "snapshotUrl": "/webcontainer-snapshots/labs-01-webcontainers-pilot.bin",
  "defaultOpenFile": "src/main.ts",
  "startup": {
    "installCommands": [
      { "cmd": "npm", "args": ["install"] }
    ],
    "runCommands": [
      { "cmd": "npm", "args": ["run", "chat"] }
    ],
    "env": ["OPENAI_API_KEY", "OPENAI_BASE_URL", "OPENAI_MODEL"]
  },
  "blocks": [
    {
      "blockId": "install-deps",
      "type": "command",
      "label": "安装依赖",
      "command": { "cmd": "npm", "args": ["install"] }
    },
    {
      "blockId": "open-example",
      "type": "project-open"
    },
    {
      "blockId": "main-ts-snippet",
      "type": "file-snippet",
      "path": "src/main.ts",
      "anchor": "@anchor:main-entry"
    },
    {
      "blockId": "config-snippet",
      "type": "file-snippet",
      "path": "src/config.ts",
      "anchor": "@anchor:load-config"
    },
    {
      "blockId": "run-demo",
      "type": "command",
      "label": "运行 Demo",
      "command": { "cmd": "npm", "args": ["run", "chat"] }
    }
  ]
}
```

```json
// examples/labs/01-webcontainers-pilot/workspace/package.json
{
  "name": "hi-agent-labs-webcontainers-pilot",
  "private": true,
  "type": "module",
  "scripts": {
    "chat": "tsx src/main.ts"
  }
}
```

Install the pilot workspace packages inside `examples/labs/01-webcontainers-pilot/workspace`:

```bash
cd examples/labs/01-webcontainers-pilot/workspace
npm install openai dotenv
npm install -D tsx typescript
cd ../../../../
```

```json
// examples/labs/01-webcontainers-pilot/workspace/tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*.ts"]
}
```

```bash
# examples/labs/01-webcontainers-pilot/workspace/.env.example
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4.1-mini
```

```ts
// examples/labs/01-webcontainers-pilot/workspace/src/config.ts
import { config as loadDotenv } from 'dotenv';

loadDotenv();

export interface AppConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  useMock: boolean;
}

// @anchor:load-config
export function loadConfig(): AppConfig {
  const apiKey = process.env.OPENAI_API_KEY?.trim() ?? '';

  return {
    baseUrl: process.env.OPENAI_BASE_URL?.trim() || 'https://api.openai.com/v1',
    apiKey,
    model: process.env.OPENAI_MODEL?.trim() || 'gpt-4.1-mini',
    useMock: apiKey.length === 0
  };
}
```

```ts
// examples/labs/01-webcontainers-pilot/workspace/src/openai-chat-client.ts
import OpenAI from 'openai';
import { type AppConfig } from './config';

export class OpenAiChatClient {
  constructor(private readonly config: AppConfig) {}

  async chat(userPrompt: string) {
    if (this.config.useMock) {
      return `Mock assistant: 已收到你的问题「${userPrompt}」`;
    }

    const client = new OpenAI({
      apiKey: this.config.apiKey,
      baseURL: this.config.baseUrl
    });

    const completion = await client.chat.completions.create({
      model: this.config.model,
      messages: [{ role: 'user', content: userPrompt }]
    });

    return completion.choices[0]?.message?.content ?? 'No assistant content';
  }
}
```

```ts
// examples/labs/01-webcontainers-pilot/workspace/src/main.ts
import { loadConfig } from './config';
import { OpenAiChatClient } from './openai-chat-client';

// @anchor:main-entry
async function main() {
  const prompt = '请介绍一下 Agent 是什么';
  const config = loadConfig();
  const client = new OpenAiChatClient(config);
  const reply = await client.chat(prompt);

  console.log(`User: ${prompt}`);
  console.log(`Assistant: ${reply}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
```

```js
// scripts/build-webcontainer-snapshots.mjs
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { snapshot } from '@webcontainer/snapshot';

const targets = [
  {
    sectionId: 'labs-01-webcontainers-pilot',
    sourceDir: resolve('examples/labs/01-webcontainers-pilot/workspace'),
    outFile: resolve('public/webcontainer-snapshots/labs-01-webcontainers-pilot.bin')
  }
];

for (const target of targets) {
  const data = await snapshot(target.sourceDir);
  await mkdir(dirname(target.outFile), { recursive: true });
  await writeFile(target.outFile, Buffer.from(data));
  console.log(`Generated snapshot for ${target.sectionId}`);
}
```

```json
// package.json (relevant excerpt)
{
  "scripts": {
    "build:snapshots": "node scripts/build-webcontainer-snapshots.mjs",
    "build": "npm run build:snapshots && next build && pagefind --site out --output-subdir _pagefind",
    "export": "npm run build"
  }
}
```

Install the snapshot builder:

```bash
npm install -D @webcontainer/snapshot
```

```gitignore
# .gitignore
public/webcontainer-snapshots
```

- [ ] **Step 4: Run the manifest and snapshot build checks**

Run:

```bash
npm run test -- tests/unit/manifest-schema.test.ts
npm run build:snapshots
```

Expected:

- manifest test passes
- console shows `Generated snapshot for labs-01-webcontainers-pilot`
- file `public/webcontainer-snapshots/labs-01-webcontainers-pilot.bin` exists locally

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json .gitignore app/docs/_meta.js app/docs/labs app/lib/playground/manifest-schema.ts app/lib/playground/manifest-loader.ts tests/unit/manifest-schema.test.ts examples/labs/01-webcontainers-pilot scripts/build-webcontainer-snapshots.mjs
git commit -m "feat: add pilot manifest and webcontainer snapshot build"
```

## Task 3: Add Runtime State, Cache, Anchor Lookup, And WebContainer Manager

**Files:**
- Create: `app/lib/playground/playground-state.ts`
- Create: `app/lib/playground/workspace-cache.ts`
- Create: `app/lib/playground/anchor-locator.ts`
- Create: `app/lib/playground/webcontainer-manager.ts`
- Create: `tests/unit/playground-state.test.ts`
- Create: `tests/unit/workspace-cache.test.ts`
- Create: `tests/unit/anchor-locator.test.ts`

- [ ] **Step 1: Write the failing reducer, cache, and anchor tests**

```ts
// tests/unit/playground-state.test.ts
import { describe, expect, it } from 'vitest';
import { initialPlaygroundState, playgroundReducer } from '@/app/lib/playground/playground-state';

describe('playgroundReducer', () => {
  it('moves from idle to ready after boot and mount', () => {
    const booting = playgroundReducer(initialPlaygroundState, {
      type: 'BOOT_STARTED',
      sectionId: 'labs-01-webcontainers-pilot'
    });
    const ready = playgroundReducer(booting, {
      type: 'WORKSPACE_READY',
      sectionId: 'labs-01-webcontainers-pilot',
      activeFile: 'src/main.ts'
    });

    expect(ready.status).toBe('ready');
    expect(ready.sectionId).toBe('labs-01-webcontainers-pilot');
    expect(ready.activeFile).toBe('src/main.ts');
  });
});
```

```ts
// tests/unit/workspace-cache.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearCachedWorkspace,
  loadCachedWorkspace,
  saveCachedWorkspace
} from '@/app/lib/playground/workspace-cache';

describe('workspace cache', () => {
  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-08T12:00:00Z'));
    await clearCachedWorkspace('labs-01-webcontainers-pilot');
  });

  it('returns null after the TTL expires', async () => {
    await saveCachedWorkspace('labs-01-webcontainers-pilot', new Uint8Array([1, 2, 3]).buffer, 1000);
    vi.advanceTimersByTime(1001);

    await expect(loadCachedWorkspace('labs-01-webcontainers-pilot')).resolves.toBeNull();
  });
});
```

```ts
// tests/unit/anchor-locator.test.ts
import { describe, expect, it } from 'vitest';
import { findAnchorPosition } from '@/app/lib/playground/anchor-locator';

describe('findAnchorPosition', () => {
  it('returns the line index for an anchor comment', () => {
    const result = findAnchorPosition(
      ['line one', '// @anchor:main-entry', 'line three'].join('\n'),
      '@anchor:main-entry'
    );

    expect(result).toEqual({ lineNumber: 2, column: 1 });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```bash
npm run test -- tests/unit/playground-state.test.ts tests/unit/workspace-cache.test.ts tests/unit/anchor-locator.test.ts
```

Expected:

- fail because the runtime modules do not exist yet

- [ ] **Step 3: Add the runtime primitives**

```ts
// app/lib/playground/playground-state.ts
export type PlaygroundStatus =
  | 'idle'
  | 'booting'
  | 'loading'
  | 'ready'
  | 'running'
  | 'error'
  | 'unsupported';

export interface PlaygroundState {
  status: PlaygroundStatus;
  sectionId: string | null;
  activeFile: string | null;
  output: string[];
  error: string | null;
}

export const initialPlaygroundState: PlaygroundState = {
  status: 'idle',
  sectionId: null,
  activeFile: null,
  output: [],
  error: null
};

export type PlaygroundEvent =
  | { type: 'BOOT_STARTED'; sectionId: string }
  | { type: 'WORKSPACE_LOADING'; sectionId: string }
  | { type: 'WORKSPACE_READY'; sectionId: string; activeFile: string }
  | { type: 'COMMAND_STARTED'; sectionId: string }
  | { type: 'COMMAND_OUTPUT'; chunk: string }
  | { type: 'COMMAND_FINISHED' }
  | { type: 'FAILED'; message: string }
  | { type: 'UNSUPPORTED' };

export function playgroundReducer(
  state: PlaygroundState,
  event: PlaygroundEvent
): PlaygroundState {
  switch (event.type) {
    case 'BOOT_STARTED':
      return { ...state, status: 'booting', sectionId: event.sectionId, error: null };
    case 'WORKSPACE_LOADING':
      return { ...state, status: 'loading', sectionId: event.sectionId, output: [], error: null };
    case 'WORKSPACE_READY':
      return {
        ...state,
        status: 'ready',
        sectionId: event.sectionId,
        activeFile: event.activeFile,
        error: null
      };
    case 'COMMAND_STARTED':
      return { ...state, status: 'running', sectionId: event.sectionId, output: [] };
    case 'COMMAND_OUTPUT':
      return { ...state, output: [...state.output, event.chunk] };
    case 'COMMAND_FINISHED':
      return { ...state, status: 'ready' };
    case 'FAILED':
      return { ...state, status: 'error', error: event.message };
    case 'UNSUPPORTED':
      return { ...state, status: 'unsupported', error: 'WebContainers require a compatible desktop browser.' };
    default:
      return state;
  }
}
```

```ts
// app/lib/playground/workspace-cache.ts
import { del, get, set } from 'idb-keyval';

interface CachedWorkspaceRecord {
  snapshot: ArrayBuffer;
  expiresAt: number;
}

function key(sectionId: string) {
  return `playground:${sectionId}`;
}

export async function saveCachedWorkspace(
  sectionId: string,
  snapshot: ArrayBuffer,
  ttlMs: number
) {
  await set(key(sectionId), {
    snapshot,
    expiresAt: Date.now() + ttlMs
  } satisfies CachedWorkspaceRecord);
}

export async function loadCachedWorkspace(sectionId: string) {
  const record = await get<CachedWorkspaceRecord>(key(sectionId));
  if (!record) return null;
  if (record.expiresAt <= Date.now()) {
    await del(key(sectionId));
    return null;
  }
  return record.snapshot;
}

export async function clearCachedWorkspace(sectionId: string) {
  await del(key(sectionId));
}
```

```ts
// app/lib/playground/anchor-locator.ts
export function findAnchorPosition(content: string, anchor: string) {
  const lines = content.split('\n');
  const index = lines.findIndex((line) => line.includes(anchor));

  return {
    lineNumber: index >= 0 ? index + 1 : 1,
    column: 1
  };
}
```

```ts
// app/lib/playground/webcontainer-manager.ts
import { WebContainer } from '@webcontainer/api';
import { loadCachedWorkspace, saveCachedWorkspace } from './workspace-cache';
import type { PlaygroundManifest } from './manifest-schema';

const CACHE_TTL_MS = 30 * 60 * 1000;
let bootPromise: Promise<WebContainer> | null = null;
const preparedSections = new Set<string>();

async function fetchSnapshot(url: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch snapshot: ${url}`);
  }
  return response.arrayBuffer();
}

export async function getWebcontainer() {
  if (!bootPromise) {
    bootPromise = WebContainer.boot();
  }
  return bootPromise;
}

export async function mountSectionWorkspace(manifest: PlaygroundManifest) {
  const webcontainer = await getWebcontainer();
  const restored = await loadCachedWorkspace(manifest.id);
  const snapshot = restored ?? (await fetchSnapshot(manifest.snapshotUrl));
  await webcontainer.mount(snapshot);
  return webcontainer;
}

export async function prepareSectionWorkspace(manifest: PlaygroundManifest) {
  const webcontainer = await mountSectionWorkspace(manifest);

  if (!preparedSections.has(manifest.id)) {
    for (const command of manifest.startup.installCommands) {
      const process = await webcontainer.spawn(command.cmd, command.args, {
        output: true
      });
      const exitCode = await process.exit;
      if (exitCode !== 0) {
        throw new Error(`Install command failed: ${command.cmd} ${command.args.join(' ')}`);
      }
    }
    preparedSections.add(manifest.id);
  }

  return webcontainer;
}

export async function listWorkspaceFiles() {
  const webcontainer = await getWebcontainer();
  const entries = await webcontainer.fs.readdir('src', { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => `src/${entry.name}`);
}

export async function readWorkspaceFile(path: string) {
  const webcontainer = await getWebcontainer();
  return webcontainer.fs.readFile(path, 'utf-8');
}

export async function writeWorkspaceFile(path: string, content: string) {
  const webcontainer = await getWebcontainer();
  await webcontainer.fs.writeFile(path, content);
}

export async function persistSectionWorkspace(manifest: PlaygroundManifest) {
  const webcontainer = await getWebcontainer();
  const snapshot = await webcontainer.export('/', {
    format: 'binary',
    excludes: ['node_modules/**']
  });

  if (snapshot instanceof Uint8Array) {
    await saveCachedWorkspace(manifest.id, snapshot.buffer, CACHE_TTL_MS);
  }
}

export async function runManifestCommand(
  manifest: PlaygroundManifest,
  blockId: string,
  onOutput: (chunk: string) => void
) {
  const webcontainer = await prepareSectionWorkspace(manifest);
  const block = manifest.blocks.find((entry) => entry.blockId === blockId && entry.type === 'command');
  if (!block || block.type !== 'command') {
    throw new Error(`Unknown command block: ${blockId}`);
  }

  const process = await webcontainer.spawn(block.command.cmd, block.command.args, {
    output: true
  });

  process.output.pipeTo(
    new WritableStream({
      write(chunk) {
        onOutput(chunk);
      }
    })
  );

  const exitCode = await process.exit;
  await persistSectionWorkspace(manifest);
  return exitCode;
}
```

- [ ] **Step 4: Run the unit tests to verify they pass**

Run:

```bash
npm run test -- tests/unit/playground-state.test.ts tests/unit/workspace-cache.test.ts tests/unit/anchor-locator.test.ts
```

Expected:

- all three unit suites pass
- no unhandled `IndexedDB` or import errors

- [ ] **Step 5: Commit**

```bash
git add app/lib/playground/playground-state.ts app/lib/playground/workspace-cache.ts app/lib/playground/anchor-locator.ts app/lib/playground/webcontainer-manager.ts tests/unit/playground-state.test.ts tests/unit/workspace-cache.test.ts tests/unit/anchor-locator.test.ts
git commit -m "feat: add webcontainer runtime state and cache"
```

## Task 4: Add The Playground Provider And Drawer UI

**Files:**
- Create: `app/lib/playground/playground-provider.tsx`
- Create: `app/lib/playground/playground-drawer.tsx`
- Create: `app/lib/playground/playground-file-tree.tsx`
- Create: `app/lib/playground/playground-editor.tsx`
- Create: `app/lib/playground/playground-output-panel.tsx`
- Create: `tests/components/playground-drawer.test.tsx`
- Modify: `app/layout.jsx`
- Modify: `app/globals.css`

- [ ] **Step 1: Write the failing drawer test**

```tsx
// tests/components/playground-drawer.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PlaygroundDrawer } from '@/app/lib/playground/playground-drawer';

describe('PlaygroundDrawer', () => {
  it('renders status, file tree, and output regions when open', () => {
    render(
      <PlaygroundDrawer
        isOpen
        title="WebContainers 实验小节"
        status="ready"
        files={['src/main.ts', 'src/config.ts']}
        activeFile="src/main.ts"
        editorValue="console.log('hello')"
        editorAnchor="@anchor:main-entry"
        onChangeEditorValue={() => {}}
        output={['Assistant: hello']}
        onClose={() => {}}
        onSelectFile={() => {}}
      />
    );

    expect(screen.getByText('WebContainers 实验小节')).toBeInTheDocument();
    expect(screen.getByText('src/main.ts')).toBeInTheDocument();
    expect(screen.getByText('Assistant: hello')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npm run test -- tests/components/playground-drawer.test.tsx
```

Expected:

- fail because the drawer component does not exist yet

- [ ] **Step 3: Add the provider, drawer, and basic styling**

```tsx
// app/lib/playground/playground-provider.tsx
'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  useState
} from 'react';
import { getPlaygroundManifest } from './manifest-loader';
import {
  initialPlaygroundState,
  playgroundReducer
} from './playground-state';
import {
  getWebcontainer,
  listWorkspaceFiles,
  prepareSectionWorkspace,
  readWorkspaceFile,
  writeWorkspaceFile,
  runManifestCommand
} from './webcontainer-manager';
import { PlaygroundDrawer } from './playground-drawer';

const PlaygroundContext = createContext(null);

export function PlaygroundProvider({ children }) {
  const [state, dispatch] = useReducer(playgroundReducer, initialPlaygroundState);
  const [isOpen, setIsOpen] = useState(false);
  const [files, setFiles] = useState<string[]>([]);
  const [editorValue, setEditorValue] = useState('');
  const [editorAnchor, setEditorAnchor] = useState<string | null>(null);

  const openSection = useCallback(async (sectionId, mode, blockId) => {
    if (!window.crossOriginIsolated) {
      dispatch({ type: 'UNSUPPORTED' });
      setIsOpen(true);
      return;
    }

    dispatch({ type: 'BOOT_STARTED', sectionId });
    await getWebcontainer();
    dispatch({ type: 'WORKSPACE_LOADING', sectionId });

    const manifest = getPlaygroundManifest(sectionId);
    await prepareSectionWorkspace(manifest);
    setFiles(await listWorkspaceFiles());

    if (mode === 'command') {
      dispatch({ type: 'COMMAND_STARTED', sectionId });
      const exitCode = await runManifestCommand(manifest, blockId, (chunk) =>
        dispatch({ type: 'COMMAND_OUTPUT', chunk })
      );
      if (exitCode !== 0) {
        dispatch({ type: 'FAILED', message: `Command failed with exit code ${exitCode}` });
      } else {
        dispatch({ type: 'COMMAND_FINISHED' });
      }
    } else {
      const fileBlock =
        mode === 'file'
          ? manifest.blocks.find((block) => block.blockId === blockId && block.type === 'file-snippet')
          : null;
      const targetPath =
        fileBlock && fileBlock.type === 'file-snippet'
          ? fileBlock.path
          : manifest.defaultOpenFile;
      setEditorValue(await readWorkspaceFile(targetPath));
      setEditorAnchor(fileBlock && fileBlock.type === 'file-snippet' ? fileBlock.anchor : null);
      dispatch({
        type: 'WORKSPACE_READY',
        sectionId,
        activeFile: targetPath
      });
    }

    setIsOpen(true);
  }, []);

  const updateEditor = useCallback(
    async (next: string) => {
      if (!state.activeFile) return;
      setEditorValue(next);
      await writeWorkspaceFile(state.activeFile, next);
    },
    [state.activeFile]
  );

  const selectFile = useCallback(
    async (path: string) => {
      setEditorValue(await readWorkspaceFile(path));
      setEditorAnchor(null);
      dispatch({
        type: 'WORKSPACE_READY',
        sectionId: state.sectionId ?? 'labs-01-webcontainers-pilot',
        activeFile: path
      });
    },
    [state.sectionId]
  );

  const value = useMemo(
    () => ({
      state,
      isOpen,
      files,
      editorValue,
      editorAnchor,
      openProject: (sectionId) => openSection(sectionId, 'project'),
      runCommand: (sectionId, blockId) => openSection(sectionId, 'command', blockId),
      openFile: (sectionId, blockId) => openSection(sectionId, 'file', blockId),
      setEditorValue: updateEditor,
      closeDrawer: () => setIsOpen(false)
    }),
    [state, isOpen, files, editorValue, editorAnchor, openSection, updateEditor]
  );

  return (
    <PlaygroundContext.Provider value={value}>
      {children}
      <PlaygroundDrawer
        isOpen={isOpen}
        title={state.sectionId ? getPlaygroundManifest(state.sectionId).title : 'Runnable Example'}
        status={state.status}
        files={files}
        activeFile={state.activeFile}
        editorValue={editorValue}
        editorAnchor={editorAnchor}
        onChangeEditorValue={updateEditor}
        output={state.output}
        onClose={() => setIsOpen(false)}
        onSelectFile={selectFile}
      />
    </PlaygroundContext.Provider>
  );
}

export function usePlayground() {
  const context = useContext(PlaygroundContext);
  if (!context) {
    throw new Error('usePlayground must be used within PlaygroundProvider');
  }
  return context;
}
```

```tsx
// app/lib/playground/playground-drawer.tsx
'use client';

import { PlaygroundFileTree } from './playground-file-tree';
import { PlaygroundEditor } from './playground-editor';
import { PlaygroundOutputPanel } from './playground-output-panel';

export function PlaygroundDrawer({
  isOpen,
  title,
  status,
  files,
  activeFile,
  editorValue,
  editorAnchor,
  onChangeEditorValue,
  output,
  onClose,
  onSelectFile
}) {
  return (
    <aside className={`ha-playground ${isOpen ? 'is-open' : ''}`} aria-hidden={!isOpen}>
      <header className="ha-playground-header">
        <div>
          <strong>{title}</strong>
          <span className={`ha-playground-status status-${status}`}>{status}</span>
        </div>
        <button type="button" onClick={onClose}>
          关闭
        </button>
      </header>

      <div className="ha-playground-body">
        <PlaygroundFileTree files={files} activeFile={activeFile} onSelectFile={onSelectFile} />
        <div className="ha-playground-main">
          <div className="ha-playground-editor-shell" data-active-file={activeFile}>
            <PlaygroundEditor
              path={activeFile}
              value={editorValue}
              anchor={editorAnchor}
              onChange={onChangeEditorValue}
            />
          </div>
          <PlaygroundOutputPanel output={output} />
        </div>
      </div>
    </aside>
  );
}
```

```tsx
// app/lib/playground/playground-file-tree.tsx
'use client';

export function PlaygroundFileTree({ files, activeFile, onSelectFile }) {
  return (
    <nav className="ha-playground-tree">
      {files.map((file) => (
        <button
          key={file}
          type="button"
          className={file === activeFile ? 'is-active' : ''}
          onClick={() => onSelectFile(file)}
        >
          {file}
        </button>
      ))}
    </nav>
  );
}
```

```tsx
// app/lib/playground/playground-output-panel.tsx
'use client';

export function PlaygroundOutputPanel({ output }) {
  return (
    <pre className="ha-playground-output">
      {output.length > 0 ? output.join('') : '等待命令输出…'}
    </pre>
  );
}
```

```tsx
// app/lib/playground/playground-editor.tsx
'use client';

import Editor from '@monaco-editor/react';
import { findAnchorPosition } from './anchor-locator';

export function PlaygroundEditor({ value, path, anchor, onChange }) {
  return (
    <Editor
      height="100%"
      path={path}
      language={path.endsWith('.ts') ? 'typescript' : 'plaintext'}
      value={value}
      onChange={(next) => onChange(next ?? '')}
      onMount={(editor) => {
        const position = findAnchorPosition(value, anchor ?? '');
        editor.setPosition(position);
        editor.revealLineInCenter(position.lineNumber);
      }}
      options={{
        minimap: { enabled: false },
        fontSize: 13
      }}
    />
  );
}
```

```jsx
// app/layout.jsx (relevant excerpt)
import { PlaygroundProvider } from './lib/playground/playground-provider';

export default async function RootLayout({ children }) {
  return (
    <html lang="zh-CN" dir="ltr" suppressHydrationWarning>
      <body>
        <PlaygroundProvider>
          <ThemeSwitchRelocator />
          <Layout /* existing props */>
            {children}
          </Layout>
        </PlaygroundProvider>
      </body>
    </html>
  );
}
```

```css
/* app/globals.css (relevant excerpt) */
.ha-playground {
  position: fixed;
  top: 0;
  right: 0;
  width: min(720px, 52vw);
  height: 100vh;
  transform: translateX(100%);
  transition: transform 0.28s ease;
  background: var(--ha-bg);
  border-left: 1px solid var(--ha-border);
  z-index: 60;
  display: flex;
  flex-direction: column;
}

.ha-playground.is-open {
  transform: translateX(0);
}

.ha-playground-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 18px;
  border-bottom: 1px solid var(--ha-border);
}

.ha-playground-body {
  display: grid;
  grid-template-columns: 220px 1fr;
  min-height: 0;
  flex: 1;
}

.ha-playground-tree {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px;
  border-right: 1px solid var(--ha-border);
}

.ha-playground-main {
  display: grid;
  grid-template-rows: 1fr 180px;
  min-height: 0;
}

.ha-playground-editor-shell {
  min-height: 0;
}

.ha-playground-output {
  margin: 0;
  padding: 14px;
  background: #0e1116;
  color: #d8e1ea;
  overflow: auto;
  font-size: 12px;
  line-height: 1.5;
}
```

- [ ] **Step 4: Run the component test to verify it passes**

Run:

```bash
npm run test -- tests/components/playground-drawer.test.tsx
```

Expected:

- component test passes
- the rendered tree contains the title, file entry, and output text

- [ ] **Step 5: Commit**

```bash
git add app/lib/playground/playground-provider.tsx app/lib/playground/playground-drawer.tsx app/lib/playground/playground-file-tree.tsx app/lib/playground/playground-editor.tsx app/lib/playground/playground-output-panel.tsx app/layout.jsx app/globals.css tests/components/playground-drawer.test.tsx
git commit -m "feat: add playground drawer shell"
```

## Task 5: Add MDX Section Context And Interactive Blocks

**Files:**
- Create: `app/lib/playground/playground-section.tsx`
- Create: `app/lib/command-block.tsx`
- Create: `app/lib/runnable-code-block.tsx`
- Create: `app/lib/open-project-button.tsx`
- Create: `tests/components/command-block.test.tsx`
- Modify: `mdx-components.js`

- [ ] **Step 1: Write the failing command-block test**

```tsx
// tests/components/command-block.test.tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CommandBlock } from '@/app/lib/command-block';
import { PlaygroundSection } from '@/app/lib/playground/playground-section';

const runCommand = vi.fn();

vi.mock('@/app/lib/playground/playground-provider', () => ({
  usePlayground: () => ({
    runCommand,
    openFile: vi.fn(),
    openProject: vi.fn()
  })
}));

describe('CommandBlock', () => {
  it('dispatches the sectionId and blockId to the playground runtime', () => {
    render(
      <PlaygroundSection sectionId="labs-01-webcontainers-pilot">
        <CommandBlock blockId="run-demo" language="bash">
          npm run chat
        </CommandBlock>
      </PlaygroundSection>
    );

    fireEvent.click(screen.getByRole('button', { name: '运行' }));
    expect(runCommand).toHaveBeenCalledWith('labs-01-webcontainers-pilot', 'run-demo');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npm run test -- tests/components/command-block.test.tsx
```

Expected:

- fail because the section context and block components do not exist yet

- [ ] **Step 3: Add the MDX-aware section wrapper and blocks**

```tsx
// app/lib/playground/playground-section.tsx
'use client';

import { createContext, useContext } from 'react';

const SectionContext = createContext<string | null>(null);

export function PlaygroundSection({ sectionId, children }) {
  return (
    <SectionContext.Provider value={sectionId}>
      {children}
    </SectionContext.Provider>
  );
}

export function usePlaygroundSectionId() {
  const sectionId = useContext(SectionContext);
  if (!sectionId) {
    throw new Error('Interactive playground blocks must be wrapped in <PlaygroundSection>.');
  }
  return sectionId;
}
```

```tsx
// app/lib/command-block.tsx
'use client';

import { CodeBlock } from './code-block';
import { usePlayground } from './playground/playground-provider';
import { usePlaygroundSectionId } from './playground/playground-section';

export function CommandBlock({ blockId, language = 'bash', children, title }) {
  const sectionId = usePlaygroundSectionId();
  const { runCommand } = usePlayground();

  return (
    <div className="ha-interactive-block">
      <CodeBlock title={title} defaultOpen>
        <pre><code className={`language-${language}`}>{children}</code></pre>
      </CodeBlock>
      <div className="ha-interactive-block-actions">
        <button type="button" onClick={() => runCommand(sectionId, blockId)}>运行</button>
      </div>
    </div>
  );
}
```

```tsx
// app/lib/runnable-code-block.tsx
'use client';

import { CodeBlock } from './code-block';
import { usePlayground } from './playground/playground-provider';
import { usePlaygroundSectionId } from './playground/playground-section';

export function RunnableCodeBlock({ blockId, language = 'ts', children, title }) {
  const sectionId = usePlaygroundSectionId();
  const { openFile } = usePlayground();

  return (
    <div className="ha-interactive-block">
      <CodeBlock title={title} defaultOpen>
        <pre><code className={`language-${language}`}>{children}</code></pre>
      </CodeBlock>
      <div className="ha-interactive-block-actions">
        <button type="button" onClick={() => openFile(sectionId, blockId)}>编辑</button>
      </div>
    </div>
  );
}
```

```tsx
// app/lib/open-project-button.tsx
'use client';

import { usePlayground } from './playground/playground-provider';
import { usePlaygroundSectionId } from './playground/playground-section';

export function OpenProjectButton({ children = '打开完整示例' }) {
  const sectionId = usePlaygroundSectionId();
  const { openProject } = usePlayground();

  return (
    <button className="ha-btn ha-btn-primary" type="button" onClick={() => openProject(sectionId)}>
      {children}
    </button>
  );
}
```

```js
// mdx-components.js
import { useMDXComponents as getThemeComponents } from 'nextra-theme-docs';
import { ZoomableImage } from './app/lib/zoomable-image';
import { withBase } from './app/lib/base-path';
import { CommandBlock } from './app/lib/command-block';
import { RunnableCodeBlock } from './app/lib/runnable-code-block';
import { OpenProjectButton } from './app/lib/open-project-button';
import { PlaygroundSection } from './app/lib/playground/playground-section';

const themeComponents = getThemeComponents();

function prefixIfInternal(src) {
  if (!src || typeof src !== 'string') return src;
  if (/^https?:\/\//.test(src) || src.startsWith('data:') || src.startsWith('blob:')) {
    return src;
  }
  return withBase(src);
}

function ZoomImg(props) {
  return <ZoomableImage {...props} src={prefixIfInternal(props.src)} />;
}

export function useMDXComponents(components) {
  return {
    ...themeComponents,
    ...components,
    img: ZoomImg,
    CommandBlock,
    RunnableCodeBlock,
    OpenProjectButton,
    PlaygroundSection
  };
}
```

- [ ] **Step 4: Run the component test to verify it passes**

Run:

```bash
npm run test -- tests/components/command-block.test.tsx
```

Expected:

- the test passes
- the `runCommand` mock is called with `labs-01-webcontainers-pilot` and `run-demo`

- [ ] **Step 5: Commit**

```bash
git add app/lib/playground/playground-section.tsx app/lib/command-block.tsx app/lib/runnable-code-block.tsx app/lib/open-project-button.tsx mdx-components.js tests/components/command-block.test.tsx
git commit -m "feat: wire interactive mdx playground blocks"
```

## Task 6: Add The Pilot Lab Page, Docker Deployment, And Verify End To End

**Files:**
- Create: `app/docs/labs/01-webcontainers-pilot/page.mdx`
- Create: `tests/e2e/webcontainers-pilot-playground.spec.ts`
- Create: `.dockerignore`
- Create: `Dockerfile`
- Create: `docker/Caddyfile`

- [ ] **Step 1: Write the failing end-to-end test**

```ts
// tests/e2e/webcontainers-pilot-playground.spec.ts
import { expect, test } from '@playwright/test';

test('webcontainers pilot lab opens the playground drawer and runs the demo', async ({ page }) => {
  await page.goto('/docs/labs/01-webcontainers-pilot');

  await page.getByRole('button', { name: '运行' }).last().click();

  await expect(page.getByText('WebContainers 实验小节')).toBeVisible();
  await expect(page.getByText('src/main.ts')).toBeVisible();
  await expect(page.getByText(/Assistant:/)).toBeVisible({ timeout: 30_000 });
});
```

- [ ] **Step 2: Run the end-to-end test to verify it fails**

Run:

```bash
npm run test:e2e -- tests/e2e/webcontainers-pilot-playground.spec.ts
```

Expected:

- fail because the lab page does not yet expose the pilot interactive controls

- [ ] **Step 3: Add the isolated pilot lab page and Docker/Caddy deployment**

```mdx
<!-- app/docs/labs/01-webcontainers-pilot/page.mdx (relevant excerpt) -->
---
title: WebContainers 实验小节
---

import { Callout } from 'nextra/components'
import { PlaygroundSection } from '../../../lib/playground/playground-section'
import { CommandBlock } from '../../../lib/command-block'
import { RunnableCodeBlock } from '../../../lib/runnable-code-block'
import { OpenProjectButton } from '../../../lib/open-project-button'

# WebContainers 实验小节

<PlaygroundSection sectionId="labs-01-webcontainers-pilot">

<Callout type="info">
这是一个独立的实验页，用于开发和验证可运行代码环境，不修改现有课程章节正文。
</Callout>

<OpenProjectButton>打开实验工作区</OpenProjectButton>

<CommandBlock blockId="install-deps" title="安装依赖" language="bash">
{`npm install`}
</CommandBlock>

<RunnableCodeBlock blockId="config-snippet" title="src/config.ts" language="ts">
{`export function loadConfig() {
  const apiKey = process.env.OPENAI_API_KEY?.trim() ?? '';
  return {
    baseUrl: process.env.OPENAI_BASE_URL?.trim() || 'https://api.openai.com/v1',
    apiKey,
    model: process.env.OPENAI_MODEL?.trim() || 'gpt-4.1-mini',
    useMock: apiKey.length === 0
  };
}`}
</RunnableCodeBlock>

<RunnableCodeBlock blockId="main-ts-snippet" title="src/main.ts" language="ts">
{`async function main() {
  const prompt = '请介绍一下 Agent 是什么';
  const config = loadConfig();
  const client = new OpenAiChatClient(config);
  const reply = await client.chat(prompt);
  console.log(\`User: \${prompt}\`);
  console.log(\`Assistant: \${reply}\`);
}`}
</RunnableCodeBlock>

<CommandBlock blockId="run-demo" title="运行 Demo" language="bash">
{`npm run chat`}
</CommandBlock>

</PlaygroundSection>
```

```dockerignore
# .dockerignore
node_modules
.next
out
dist
build
.git
.playwright
playwright-report
test-results
```

```dockerfile
# Dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM caddy:2-alpine
COPY docker/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/out /srv
```

```text
# docker/Caddyfile
:80 {
  root * /srv
  file_server

  header {
    Cross-Origin-Embedder-Policy "require-corp"
    Cross-Origin-Opener-Policy "same-origin"
    Cross-Origin-Resource-Policy "cross-origin"
  }

  try_files {path} {path}/ {path}.html /404.html
}
```

- [ ] **Step 4: Run the full verification commands**

Run:

```bash
npm run test
npm run test:e2e -- tests/e2e/webcontainers-pilot-playground.spec.ts
npm run build
docker build -t hi-agent-docs:webcontainers .
```

Expected:

- all Vitest suites pass
- the Playwright pilot test passes in Chromium
- `npm run build` generates the pilot WebContainer snapshot and `out/_pagefind`
- `docker build` completes successfully and produces `hi-agent-docs:webcontainers`

- [ ] **Step 5: Commit**

```bash
git add app/docs/labs/01-webcontainers-pilot/page.mdx .dockerignore Dockerfile docker/Caddyfile tests/e2e/webcontainers-pilot-playground.spec.ts
git commit -m "feat: add pilot webcontainer docs lab"
```

## Self-Review Notes

Spec coverage checked against:

- `WebContainers` runtime choice: Tasks 1, 3, 4, 6
- per-section manifest + snapshots: Tasks 2 and 6
- right-side drawer with editor + output: Tasks 4 and 5
- explicit MDX block binding: Task 5
- isolated pilot lab route instead of existing chapter rewrites: Tasks 2 and 6
- Docker deployment + `COOP/COEP`: Tasks 1 and 6
- short-lived local restore: Task 3
- no raw terminal input in V1: Tasks 3, 4, and 5 only expose manifest-approved commands

Placeholder scan:

- no `TBD`, `TODO`, or deferred implementation markers remain
- every task has exact files, commands, and commit messages

Type consistency:

- manifest IDs use `labs-01-webcontainers-pilot`
- block IDs are consistent across manifest, MDX, and tests
- command execution uses structured `{ cmd, args }` objects throughout

## Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-08-webcontainers-runnable-docs-v1.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
