#!/usr/bin/env node
/**
 * restore-studio.mjs
 *
 * Post-build helper. Reverses `strip-studio.mjs` so the editor remains
 * usable after a `npm run build`. Always exits 0 even if nothing to
 * restore — this script is a defensive safety net, not a hard requirement.
 */

import { rename, rm, readdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')
const trashRoot = path.join(projectRoot, '.studio-trash')

const TARGETS = [
  { to: 'app/studio', from: 'app__studio' },
  { to: 'app/api/studio', from: 'app__api__studio' }
]

async function moveBack({ from, to }) {
  const src = path.join(trashRoot, from)
  if (!existsSync(src)) {
    console.log(`[restore-studio] nothing to restore for ${to}`)
    return
  }
  const dest = path.join(projectRoot, to)
  if (existsSync(dest)) {
    console.warn(
      `[restore-studio] target already exists, refusing overwrite: ${to}`
    )
    return
  }
  await rename(src, dest)
  console.log(`[restore-studio] restored .studio-trash/${from} -> ${to}`)
}

async function restoreRootMeta() {
  const backupPath = path.join(trashRoot, 'app__meta.js.bak')
  if (!existsSync(backupPath)) return
  const metaPath = path.join(projectRoot, 'app', '_meta.js')
  const backup = await readFile(backupPath, 'utf8')
  await writeFile(metaPath, backup, 'utf8')
  await rm(backupPath, { force: true })
  console.log('[restore-studio] restored app/_meta.js')
}

async function main() {
  if (!existsSync(trashRoot)) {
    console.log('[restore-studio] no .studio-trash, nothing to do')
    return
  }
  for (const target of TARGETS) {
    await moveBack(target)
  }
  await restoreRootMeta()
  // 清空 trash（如果空）
  try {
    const remaining = await readdir(trashRoot)
    if (remaining.length === 0) {
      await rm(trashRoot, { recursive: true, force: true })
    }
  } catch {
    /* ignore */
  }
  console.log('[restore-studio] done')
}

main().catch((err) => {
  console.error('[restore-studio] failed:', err)
  // 不让构建失败
  process.exit(0)
})
