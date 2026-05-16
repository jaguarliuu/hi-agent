/**
 * /api/studio/scaffold
 *
 * POST { mode, course, chapter, title, subSlug?, subTitle? }
 *
 * mode = 'chapter'：在 app/courses/<course>/ 下新建章节目录，含 _meta.js + page.mdx
 *                   + public/courses/<course>/<chapter>/images/.gitkeep
 *                   + 把章节追加到 app/courses-data.js 的 chapters 数组
 *
 * mode = 'subchapter'：在 app/courses/<course>/<chapter>/<subSlug>/ 下新建 page.mdx
 *                       + 把 subSlug 追加到 chapter 的 _meta.js
 *
 * 全部经 path-guard 校验；不会覆盖已存在文件（409）。
 */
import { NextResponse } from 'next/server'
import { mkdir, writeFile, readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import {
  ensureStudioDevMode,
  resolveStudioPath,
  StudioPathError
} from '@/app/lib/studio/path-guard'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/

interface Body {
  mode?: 'chapter' | 'subchapter'
  course?: string
  chapter?: string
  title?: string
  subSlug?: string
  subTitle?: string
}

async function exists(p: string) {
  try {
    await stat(p)
    return true
  } catch {
    return false
  }
}

const PROJECT_ROOT = path.resolve(process.cwd())

function chapterMetaTemplate(title: string) {
  return `export default {
  index: {
    title: ${JSON.stringify(title + ' · 概览')},
    display: 'hidden'
  }
}
`
}

function chapterPageTemplate(title: string) {
  return `---
title: ${title}
description: TODO 章节简介
---

import { Callout } from 'nextra/components'

# ${title}

<Callout type="info">
本章节由 Studio 脚手架生成，请补全内容。
</Callout>

## 学习目标

- TODO

## 本章节内容

TODO
`
}

function subPageTemplate(title: string) {
  return `---
title: ${title}
description: TODO 小节简介
---

import { Callout } from 'nextra/components'

# ${title}

TODO 小节内容
`
}

/**
 * 把 chapter slug 追加到 chapter 的 _meta.js（只在 default export 对象末尾插入新键）。
 * 若已存在则跳过。
 */
async function appendToChapterMeta(
  metaAbs: string,
  subSlug: string,
  subTitle: string
) {
  const src = await readFile(metaAbs, 'utf8')
  if (src.includes(`'${subSlug}'`) || src.includes(`"${subSlug}"`)) {
    return // 已存在
  }
  // 寻找 default export 对象的最后一个 } 并在其前插入新键
  const lastBrace = src.lastIndexOf('}')
  if (lastBrace < 0) throw new Error('cannot parse _meta.js')
  // 检查是否需要追加逗号
  const before = src.slice(0, lastBrace).trimEnd()
  const needsComma = !before.endsWith(',') && !before.endsWith('{')
  const insertion = `${needsComma ? ',\n' : '\n'}  '${subSlug}': ${JSON.stringify(subTitle)}\n`
  const next = before + insertion + src.slice(lastBrace)
  await writeFile(metaAbs, next, 'utf8')
}

/**
 * 把 chapter slug 追加到 app/courses-data.js 的 chapters 数组。若已存在跳过。
 */
async function appendChapterToCoursesData(course: string, chapter: string) {
  const dataAbs = path.join(PROJECT_ROOT, 'app', 'courses-data.js')
  const src = await readFile(dataAbs, 'utf8')

  // 简单状态机：找到 slug: '<course>'，再向下找最近的 chapters: [ ... ]
  const slugRe = new RegExp(`slug:\\s*['"\`]${course}['"\`]`)
  const slugMatch = src.match(slugRe)
  if (!slugMatch || slugMatch.index === undefined) {
    throw new Error(`course ${course} not found in courses-data.js`)
  }
  const after = src.slice(slugMatch.index)
  const chaptersStartRel = after.search(/chapters\s*:\s*\[/)
  if (chaptersStartRel < 0) {
    throw new Error(`chapters array not found for ${course}`)
  }
  const arrayOpenAbs =
    slugMatch.index + chaptersStartRel + after.slice(chaptersStartRel).indexOf('[')
  // 找匹配的 ]
  let depth = 1
  let i = arrayOpenAbs + 1
  while (i < src.length && depth > 0) {
    const c = src[i]
    if (c === '[') depth++
    else if (c === ']') depth--
    if (depth === 0) break
    i++
  }
  const arrayCloseAbs = i
  const arrayBody = src.slice(arrayOpenAbs + 1, arrayCloseAbs)
  if (
    arrayBody.includes(`'${chapter}'`) ||
    arrayBody.includes(`"${chapter}"`)
  ) {
    return // 已存在
  }
  const trimmed = arrayBody.trimEnd()
  const needsComma = trimmed.length > 0 && !trimmed.endsWith(',')
  const insertion =
    (trimmed.length === 0 ? '\n      ' : `${needsComma ? ',' : ''}\n      `) +
    `'${chapter}'`
  const nextBody =
    trimmed.length === 0
      ? `\n      '${chapter}'\n    `
      : trimmed + insertion + '\n    '
  const next = src.slice(0, arrayOpenAbs + 1) + nextBody + src.slice(arrayCloseAbs)
  await writeFile(dataAbs, next, 'utf8')
}

export async function POST(request: Request) {
  const guard = ensureStudioDevMode()
  if (guard) return guard

  try {
    const body = (await request.json()) as Body
    const mode = body.mode
    const course = body.course?.trim()
    const chapter = body.chapter?.trim()
    const title = body.title?.trim()

    if (mode !== 'chapter' && mode !== 'subchapter') {
      return NextResponse.json({ error: 'invalid mode' }, { status: 400 })
    }
    if (!course || !SLUG_RE.test(course)) {
      return NextResponse.json({ error: 'invalid course slug' }, { status: 400 })
    }
    if (!chapter || !SLUG_RE.test(chapter)) {
      return NextResponse.json({ error: 'invalid chapter slug' }, { status: 400 })
    }
    if (!title) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 })
    }

    if (mode === 'chapter') {
      // 1. 章节目录
      const chapterDirRel = `app/courses/${course}/${chapter}`
      const pageRel = `${chapterDirRel}/page.mdx`
      const metaRel = `${chapterDirRel}/_meta.js`
      const imagesRel = `public/courses/${course}/${chapter}/images/.gitkeep`

      const pageAbs = resolveStudioPath(pageRel).absPath
      const metaAbs = resolveStudioPath(metaRel).absPath
      const imagesAbs = resolveStudioPath(imagesRel).absPath

      if (await exists(pageAbs)) {
        return NextResponse.json(
          { error: 'chapter already exists' },
          { status: 409 }
        )
      }

      await mkdir(path.dirname(pageAbs), { recursive: true })
      await mkdir(path.dirname(imagesAbs), { recursive: true })
      await writeFile(metaAbs, chapterMetaTemplate(title), 'utf8')
      await writeFile(pageAbs, chapterPageTemplate(title), 'utf8')
      await writeFile(imagesAbs, '', 'utf8')

      // 2. 写入 courses-data.js
      try {
        await appendChapterToCoursesData(course, chapter)
      } catch (err) {
        console.warn('[studio/scaffold] could not patch courses-data.js:', err)
      }

      return NextResponse.json({
        ok: true,
        created: [pageRel, metaRel, imagesRel],
        openPath: pageRel
      })
    }

    // mode === 'subchapter'
    const subSlug = body.subSlug?.trim()
    const subTitle = (body.subTitle ?? title).trim()
    if (!subSlug || !SLUG_RE.test(subSlug)) {
      return NextResponse.json(
        { error: 'invalid subSlug' },
        { status: 400 }
      )
    }
    const subPageRel = `app/courses/${course}/${chapter}/${subSlug}/page.mdx`
    const chapterMetaRel = `app/courses/${course}/${chapter}/_meta.js`
    const subImagesRel = `public/courses/${course}/${chapter}/images/.gitkeep`

    const subPageAbs = resolveStudioPath(subPageRel).absPath
    const chapterMetaAbs = resolveStudioPath(chapterMetaRel).absPath
    const subImagesAbs = resolveStudioPath(subImagesRel).absPath

    if (await exists(subPageAbs)) {
      return NextResponse.json(
        { error: 'subchapter already exists' },
        { status: 409 }
      )
    }
    if (!(await exists(chapterMetaAbs))) {
      return NextResponse.json(
        { error: 'parent chapter has no _meta.js; create chapter first' },
        { status: 400 }
      )
    }

    await mkdir(path.dirname(subPageAbs), { recursive: true })
    await mkdir(path.dirname(subImagesAbs), { recursive: true })
    await writeFile(subPageAbs, subPageTemplate(subTitle), 'utf8')
    if (!(await exists(subImagesAbs))) {
      await writeFile(subImagesAbs, '', 'utf8')
    }
    await appendToChapterMeta(chapterMetaAbs, subSlug, subTitle)

    return NextResponse.json({
      ok: true,
      created: [subPageRel],
      openPath: subPageRel
    })
  } catch (err) {
    if (err instanceof StudioPathError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[studio/scaffold] failed', err)
    return NextResponse.json(
      { error: (err as Error).message ?? 'scaffold failed' },
      { status: 500 }
    )
  }
}
