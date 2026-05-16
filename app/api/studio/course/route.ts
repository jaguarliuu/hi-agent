/**
 * /api/studio/course
 *
 * POST { slug, title, subtitle, description, status, tag, startChapterSlug, firstChapterTitle }
 *
 * 在工作区中物理创建一门新课程：
 *   - app/courses/<slug>/_meta.js               课程章节顺序（含 index 与首个 chapter）
 *   - app/courses/<slug>/page.mdx               课程简介页
 *   - app/courses/<slug>/<startChapterSlug>/page.mdx
 *   - app/courses/<slug>/<startChapterSlug>/_meta.js
 *   - public/courses/<slug>/<startChapterSlug>/images/.gitkeep
 *
 * 同时把课程对象追加到 app/courses-data.js 的 COURSES 数组（SSOT），
 * 这样侧边栏树、/courses 索引页、所有 SSR 渲染都会自动同步。
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
const STATUSES = new Set(['live', 'draft', 'planned'])
const PROJECT_ROOT = path.resolve(process.cwd())

interface Body {
  slug?: string
  title?: string
  subtitle?: string
  description?: string
  status?: 'live' | 'draft' | 'planned'
  tag?: string
  startChapterSlug?: string
  firstChapterTitle?: string
}

async function exists(p: string) {
  try {
    await stat(p)
    return true
  } catch {
    return false
  }
}

function metaIndexTemplate(startChapterSlug: string, firstChapterTitle: string) {
  return `export default {
  index: '课程简介',
  '---chapters---': {
    type: 'separator',
    title: '课程章节'
  },
  ${JSON.stringify(startChapterSlug)}: ${JSON.stringify(firstChapterTitle)}
};
`
}

function chapterMetaTemplate(firstChapterTitle: string) {
  return `export default {
  index: {
    title: ${JSON.stringify(firstChapterTitle + ' · 概览')},
    display: 'hidden'
  }
}
`
}

function coursePageTemplate(title: string, description: string) {
  return `---
title: 课程简介
description: ${JSON.stringify(description || title + ' 课程简介')}
---

import { Callout, Cards } from 'nextra/components'

## 课程简介

欢迎来到 **${title}**${description ? ' —— ' + description : ''}。

<Callout type="info">
本课程刚刚由 Studio 创建，以下内容只是脚手架，请按需替换。
</Callout>

## 你将学到

- TODO 学习目标 1
- TODO 学习目标 2
- TODO 学习目标 3

## 课程目录

<Cards>
  {/* TODO: 在这里添加 <Cards.Card href="..."> 链接到各章节首页 */}
</Cards>
`
}

function chapterPageTemplate(firstChapterTitle: string) {
  return `---
title: ${JSON.stringify(firstChapterTitle)}
description: TODO 章节简介
---

import { Callout } from 'nextra/components'

# ${firstChapterTitle}

<Callout type="info">
本章节由 Studio 脚手架生成，请补全内容。
</Callout>

## 学习目标

- TODO

## 内容

TODO
`
}

/**
 * 把新课程对象追加到 app/courses-data.js 的 COURSES 数组。
 *
 * 策略：用文本切片找到 `export const COURSES = [` 与匹配的 `]`，
 * 在最后一个对象闭合 `}` 之后插入新对象（前置逗号），保持源文件
 * 既有格式与注释不动。若数组为空，则直接插入第一个对象。
 */
async function appendCourseToData(course: {
  slug: string
  title: string
  subtitle: string
  description: string
  status: 'live' | 'draft' | 'planned'
  tag: string
  startChapterSlug: string
  updatedAt: string
  chapters: string[]
}) {
  const dataAbs = path.join(PROJECT_ROOT, 'app', 'courses-data.js')
  const src = await readFile(dataAbs, 'utf8')

  // 重复检查
  if (
    new RegExp(`slug:\\s*['"\`]${course.slug}['"\`]`).test(src)
  ) {
    throw Object.assign(new Error(`course "${course.slug}" already in courses-data.js`), {
      status: 409
    })
  }

  const arrStart = src.search(/export\s+const\s+COURSES\s*=\s*\[/)
  if (arrStart < 0) throw new Error('COURSES array not found')
  const openBracket = src.indexOf('[', arrStart)
  // 配对的 ]
  let depth = 1
  let i = openBracket + 1
  while (i < src.length && depth > 0) {
    const c = src[i]
    if (c === '[') depth++
    else if (c === ']') depth--
    if (depth === 0) break
    i++
  }
  const closeBracket = i

  const block = formatCourseBlock(course)
  const arrayBody = src.slice(openBracket + 1, closeBracket)
  const trimmed = arrayBody.trimEnd()
  let nextBody: string
  if (trimmed.length === 0) {
    nextBody = `\n  ${block}\n`
  } else {
    const needsComma = !trimmed.endsWith(',')
    nextBody = trimmed + (needsComma ? ',' : '') + `\n  ${block}\n`
  }
  const next = src.slice(0, openBracket + 1) + nextBody + src.slice(closeBracket)
  await writeFile(dataAbs, next, 'utf8')
}

function formatCourseBlock(course: {
  slug: string
  title: string
  subtitle: string
  description: string
  status: string
  tag: string
  startChapterSlug: string
  updatedAt: string
  chapters: string[]
}) {
  const chaptersLines = course.chapters
    .map((c) => `      ${JSON.stringify(c)}`)
    .join(',\n')
  return `{
    slug: ${JSON.stringify(course.slug)},
    title: ${JSON.stringify(course.title)},
    subtitle: ${JSON.stringify(course.subtitle)},
    description: ${JSON.stringify(course.description)},
    status: ${JSON.stringify(course.status)},
    tag: ${JSON.stringify(course.tag)},
    startChapterSlug: ${JSON.stringify(course.startChapterSlug)},
    updatedAt: ${JSON.stringify(course.updatedAt)},
    chapters: [
${chaptersLines}
    ]
  }`
}

export async function POST(request: Request) {
  const guard = ensureStudioDevMode()
  if (guard) return guard

  try {
    const body = (await request.json()) as Body
    const slug = body.slug?.trim()
    const title = body.title?.trim()
    const subtitle = (body.subtitle ?? '').trim()
    const description = (body.description ?? '').trim()
    const status = body.status ?? 'draft'
    const tag = (body.tag ?? 'Foundations').trim() || 'Foundations'
    const startChapterSlug = (body.startChapterSlug ?? 'getting-started').trim()
    const firstChapterTitle =
      (body.firstChapterTitle ?? '开始入门').trim() || '开始入门'

    if (!slug || !SLUG_RE.test(slug)) {
      return NextResponse.json({ error: 'invalid course slug' }, { status: 400 })
    }
    if (!title) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 })
    }
    if (!STATUSES.has(status)) {
      return NextResponse.json({ error: 'invalid status' }, { status: 400 })
    }
    if (!SLUG_RE.test(startChapterSlug)) {
      return NextResponse.json(
        { error: 'invalid startChapterSlug' },
        { status: 400 }
      )
    }

    // 1. 解析目标路径（也起到 path-guard 校验作用）
    const courseDirRel = `app/courses/${slug}`
    const courseMetaRel = `${courseDirRel}/_meta.js`
    const coursePageRel = `${courseDirRel}/page.mdx`
    const chapterPageRel = `${courseDirRel}/${startChapterSlug}/page.mdx`
    const chapterMetaRel = `${courseDirRel}/${startChapterSlug}/_meta.js`
    const imagesRel = `public/courses/${slug}/${startChapterSlug}/images/.gitkeep`

    const courseMetaAbs = resolveStudioPath(courseMetaRel).absPath
    const coursePageAbs = resolveStudioPath(coursePageRel).absPath
    const chapterPageAbs = resolveStudioPath(chapterPageRel).absPath
    const chapterMetaAbs = resolveStudioPath(chapterMetaRel).absPath
    const imagesAbs = resolveStudioPath(imagesRel).absPath

    if (await exists(coursePageAbs)) {
      return NextResponse.json(
        { error: 'course directory already exists' },
        { status: 409 }
      )
    }

    // 2. 物理写盘
    await mkdir(path.dirname(coursePageAbs), { recursive: true })
    await mkdir(path.dirname(chapterPageAbs), { recursive: true })
    await mkdir(path.dirname(imagesAbs), { recursive: true })

    await writeFile(
      courseMetaAbs,
      metaIndexTemplate(startChapterSlug, firstChapterTitle),
      'utf8'
    )
    await writeFile(
      coursePageAbs,
      coursePageTemplate(title, description || subtitle),
      'utf8'
    )
    await writeFile(
      chapterMetaAbs,
      chapterMetaTemplate(firstChapterTitle),
      'utf8'
    )
    await writeFile(
      chapterPageAbs,
      chapterPageTemplate(firstChapterTitle),
      'utf8'
    )
    await writeFile(imagesAbs, '', 'utf8')

    // 3. 注入 courses-data.js
    const today = new Date().toISOString().slice(0, 10)
    await appendCourseToData({
      slug,
      title,
      subtitle: subtitle || title,
      description: description || subtitle || title,
      status,
      tag,
      startChapterSlug,
      updatedAt: today,
      chapters: [startChapterSlug]
    })

    return NextResponse.json({
      ok: true,
      slug,
      created: [
        courseMetaRel,
        coursePageRel,
        chapterMetaRel,
        chapterPageRel,
        imagesRel
      ],
      // 让前端创建后直接打开课程简介页编辑
      openPath: coursePageRel
    })
  } catch (err) {
    if (err instanceof StudioPathError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    const status = (err as { status?: number }).status ?? 500
    console.error('[studio/course] failed', err)
    return NextResponse.json(
      { error: (err as Error).message ?? 'create course failed' },
      { status }
    )
  }
}
