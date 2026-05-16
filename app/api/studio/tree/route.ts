/**
 * /api/studio/tree
 *
 * 返回完整的课程文件树，结构：
 *   {
 *     courses: [{
 *       slug, title, status, chapters: [{
 *         slug, files: [{ path, label, mtime, size }]
 *       }]
 *     }]
 *   }
 *
 * Dev-only. 文件枚举仅扫描 app/courses/<slug>/<chapter>/**.mdx。
 */
import { NextResponse } from 'next/server'
import { readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import { ensureStudioDevMode } from '@/app/lib/studio/path-guard'
import { COURSES } from '@/app/courses-data.js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface FileNode {
  path: string
  label: string
  mtime: number
  size: number
}

interface ChapterNode {
  slug: string
  files: FileNode[]
}

interface CourseNode {
  slug: string
  title: string
  status: string
  chapters: ChapterNode[]
}

const PROJECT_ROOT = path.resolve(process.cwd())

async function listMdxRecursive(
  dirAbs: string,
  rootRel: string
): Promise<FileNode[]> {
  let entries
  try {
    entries = await readdir(dirAbs, { withFileTypes: true })
  } catch {
    return []
  }
  const out: FileNode[] = []
  for (const entry of entries) {
    const childAbs = path.join(dirAbs, entry.name)
    const childRel = path.posix.join(rootRel, entry.name)
    if (entry.isDirectory()) {
      out.push(...(await listMdxRecursive(childAbs, childRel)))
    } else if (entry.isFile() && entry.name.endsWith('.mdx')) {
      const stats = await stat(childAbs)
      // label 显示成相对 chapter 的路径
      const label = childRel.includes('/')
        ? childRel.split('/').slice(-2).join('/')
        : childRel
      out.push({
        path: `app/courses/${rootRel}/${entry.name}`
          .replace(/\/+/g, '/'),
        label,
        mtime: stats.mtimeMs,
        size: stats.size
      })
    }
  }
  // 排序：index.mdx 优先，其余按 slug
  return out.sort((a, b) => {
    const aIdx = a.path.endsWith('/index.mdx')
    const bIdx = b.path.endsWith('/index.mdx')
    if (aIdx !== bIdx) return aIdx ? -1 : 1
    return a.path.localeCompare(b.path)
  })
}

export async function GET() {
  const guard = ensureStudioDevMode()
  if (guard) return guard

  const courses: CourseNode[] = []
  for (const course of COURSES) {
    const courseDirAbs = path.join(
      PROJECT_ROOT,
      'app',
      'courses',
      course.slug
    )
    const chapters: ChapterNode[] = []
    for (const chapterSlug of course.chapters ?? []) {
      const chapterDirAbs = path.join(courseDirAbs, chapterSlug)
      const files = await listMdxRecursive(
        chapterDirAbs,
        `${course.slug}/${chapterSlug}`
      )
      chapters.push({ slug: chapterSlug, files })
    }
    courses.push({
      slug: course.slug,
      title: course.title,
      status: course.status,
      chapters
    })
  }

  return NextResponse.json({ courses })
}
