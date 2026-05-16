#!/usr/bin/env node
/**
 * strip-studio.mjs
 *
 * Pre-build helper. Moves the dev-only Course Studio surface out of `app/`
 * so that `next build` (which uses `output: 'export'` and therefore has no
 * runtime API support) cannot accidentally compile it into the production
 * bundle. The paired `restore-studio.mjs` puts everything back.
 *
 * Decisions tracked in:
 *   docs/plans/2026-05-12-course-studio-design.md (2026-05-16 Revision Note)
 *
 * Idempotent: if the source paths do not exist (e.g. studio not implemented
 * yet, or strip already ran), the script is a no-op so CI / local builds
 * never fail because of this hook.
 */

import { mkdir, rename, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')
const trashRoot = path.join(projectRoot, '.studio-trash')

const TARGETS = [
  { from: 'app/studio', to: 'app__studio' },
  { from: 'app/api/studio', to: 'app__api__studio' }
]

async function safeStat(p) {
  try {
    return await stat(p)
  } catch {
    return null
  }
}

async function moveOut({ from, to }) {
  const src = path.join(projectRoot, from)
  if (!existsSync(src)) {
    console.log(`[strip-studio] skip (missing): ${from}`)
    return
  }
  await mkdir(trashRoot, { recursive: true })
  const dest = path.join(trashRoot, to)
  if (existsSync(dest)) {
    console.warn(
      `[strip-studio] trash slot already occupied, removing prior: ${dest}`
    )
    const fs = await import('node:fs/promises')
    await fs.rm(dest, { recursive: true, force: true })
  }
  await rename(src, dest)
  console.log(`[strip-studio] moved ${from} -> .studio-trash/${to}`)
}

async function main() {
  const trashStat = await safeStat(trashRoot)
  if (trashStat && trashStat.isDirectory()) {
    console.log('[strip-studio] reusing existing .studio-trash/')
  }
  for (const target of TARGETS) {
    await moveOut(target)
  }
  console.log('[strip-studio] done')
}

main().catch((err) => {
  console.error('[strip-studio] failed:', err)
  process.exit(1)
})
