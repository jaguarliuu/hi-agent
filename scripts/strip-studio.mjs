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

import { mkdir, rename, stat, readFile, writeFile } from 'node:fs/promises'
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

/**
 * 在 strip 阶段，把 app/_meta.js 备份为 .studio-trash/app__meta.js.bak，
 * 并写回一个剔除了 `studio` page entry 的版本，避免 Nextra 在 build 期
 * 报 "_meta refers to a page that cannot be found"。restore 阶段会还原。
 */
async function rewriteRootMeta() {
  const metaPath = path.join(projectRoot, 'app', '_meta.js')
  if (!existsSync(metaPath)) {
    console.log('[strip-studio] skip _meta.js (missing)')
    return
  }
  const original = await readFile(metaPath, 'utf8')
  if (!/\bstudio\s*:/.test(original)) {
    console.log('[strip-studio] _meta.js has no studio entry, skip rewrite')
    return
  }
  await mkdir(trashRoot, { recursive: true })
  const backupPath = path.join(trashRoot, 'app__meta.js.bak')
  await writeFile(backupPath, original, 'utf8')
  // 删除 studio: { ... } 块（含可选的尾随逗号与换行）。
  // 该块的 `{` ... `}` 可能多行嵌套，所以用括号配对扫描。
  const next = removeMetaKey(original, 'studio')
  await writeFile(metaPath, next, 'utf8')
  console.log('[strip-studio] rewrote app/_meta.js (removed studio entry)')
}

function removeMetaKey(src, key) {
  const re = new RegExp(`(^|\\n)([ \\t]*)${key}\\s*:\\s*`, 'm')
  const m = src.match(re)
  if (!m) return src
  const startOfLine = m.index + m[1].length
  const valueStart = m.index + m[0].length
  let i = valueStart
  // 可能是 string 'xxx' 或 object {...}
  if (src[i] === '{') {
    let depth = 1
    i++
    while (i < src.length && depth > 0) {
      const c = src[i]
      if (c === '{') depth++
      else if (c === '}') depth--
      i++
      if (depth === 0) break
    }
  } else if (src[i] === "'" || src[i] === '"' || src[i] === '`') {
    const q = src[i]
    i++
    while (i < src.length && src[i] !== q) {
      if (src[i] === '\\') i++
      i++
    }
    i++ // closing quote
  } else {
    // 标识符 / 数字 / 直到逗号或换行
    while (i < src.length && !/[,\n}]/.test(src[i])) i++
  }
  // 吞掉尾随逗号
  if (src[i] === ',') i++
  // 吞掉行尾的 \r?\n
  if (src[i] === '\r') i++
  if (src[i] === '\n') i++
  return src.slice(0, startOfLine) + src.slice(i)
}

async function main() {
  const trashStat = await safeStat(trashRoot)
  if (trashStat && trashStat.isDirectory()) {
    console.log('[strip-studio] reusing existing .studio-trash/')
  }
  for (const target of TARGETS) {
    await moveOut(target)
  }
  await rewriteRootMeta()
  console.log('[strip-studio] done')
}

main().catch((err) => {
  console.error('[strip-studio] failed:', err)
  process.exit(1)
})
