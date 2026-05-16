#!/usr/bin/env node
/**
 * run-studio.mjs
 *
 * Convenience launcher for `npm run studio`. Spawns `next dev` and then,
 * once the dev server is reachable, opens the system browser at /studio.
 *
 * Cross-platform: works on Windows / macOS / Linux without `cross-env`.
 * Exits with the same code as the spawned `next dev` process.
 */

import { spawn } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')

const PORT = process.env.PORT ?? '3000'
const STUDIO_URL = `http://localhost:${PORT}/studio`

function openBrowser(url) {
  const platform = process.platform
  try {
    if (platform === 'win32') {
      // start 是 cmd 内建命令，必须经 shell；空 "" 是 start 的窗口标题占位
      spawn(`start "" "${url}"`, {
        stdio: 'ignore',
        detached: true,
        shell: true
      }).unref()
    } else {
      const cmd = platform === 'darwin' ? 'open' : 'xdg-open'
      spawn(cmd, [url], { stdio: 'ignore', detached: true }).unref()
    }
  } catch (err) {
    console.warn('[run-studio] failed to open browser:', err.message)
  }
}

async function waitForServer(url, timeoutMs = 30_000) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const res = await fetch(url, { method: 'HEAD' })
      if (res.ok || res.status === 404 || res.status === 405) return true
    } catch {
      /* still booting */
    }
    await delay(500)
  }
  return false
}

// Windows 下 .cmd shim（npx.cmd / next.cmd）必须经 shell；Node 20+ 在
// 没有 shell:true 时会直接抛 EINVAL（CVE-2024-27980 修复后的硬性约束）。
// 因此这里统一走 shell:true，命令以字符串形式拼接，并用 JSON.stringify
// 给 PORT 加引号防注入。
const command = `npx next dev -p ${JSON.stringify(String(PORT))}`
const next = spawn(command, {
  cwd: projectRoot,
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, STUDIO_MODE: '1' }
})

next.on('error', (err) => {
  console.error('[run-studio] failed to start next dev:', err.message)
  process.exit(1)
})

next.on('exit', (code) => {
  process.exit(code ?? 0)
})

;(async () => {
  console.log(`[run-studio] waiting for dev server at ${STUDIO_URL} ...`)
  const ready = await waitForServer(STUDIO_URL)
  if (ready) {
    console.log(`[run-studio] opening ${STUDIO_URL}`)
    openBrowser(STUDIO_URL)
  } else {
    console.warn(
      `[run-studio] dev server not ready in 30s; open ${STUDIO_URL} manually.`
    )
  }
})()

const cleanup = () => {
  if (!next.killed) next.kill('SIGINT')
}
process.on('SIGINT', cleanup)
process.on('SIGTERM', cleanup)
