/**
 * /api/studio/upload
 *
 * POST multipart/form-data:
 *   - course   string (slug)
 *   - chapter  string (slug)
 *   - file     File
 *
 * → { ok, path, url, filename }
 *
 * 落盘到 public/courses/<course>/<chapter>/images/<base>-<ts>.<ext>。
 * 路径经 path-guard 二次校验，确保不会因为 course/chapter 注入逃出白名单。
 */
import { NextResponse } from 'next/server'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import {
  ensureStudioDevMode,
  resolveStudioPath,
  StudioPathError
} from '@/app/lib/studio/path-guard'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_BYTES = 8 * 1024 * 1024
const ALLOWED_EXT = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'avif'])

const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/

function safeBaseName(name: string) {
  // 去扩展名 + 仅保留 a-zA-Z0-9-_
  const base = name.replace(/\.[^./\\]+$/, '')
  return (
    base
      .normalize('NFKD')
      .replace(/[^a-zA-Z0-9-_]/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'image'
  )
}

export async function POST(request: Request) {
  const guard = ensureStudioDevMode()
  if (guard) return guard

  try {
    const form = await request.formData()
    const course = String(form.get('course') ?? '').trim()
    const chapter = String(form.get('chapter') ?? '').trim()
    const file = form.get('file')

    if (!SLUG_RE.test(course)) {
      return NextResponse.json({ error: 'invalid course slug' }, { status: 400 })
    }
    if (!SLUG_RE.test(chapter)) {
      return NextResponse.json({ error: 'invalid chapter slug' }, { status: 400 })
    }
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'file is required' }, { status: 400 })
    }
    if (file.size <= 0) {
      return NextResponse.json({ error: 'empty file' }, { status: 400 })
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: `file too large (max ${MAX_BYTES} bytes)` },
        { status: 400 }
      )
    }

    const origName = (file as File).name || 'image'
    const ext = (origName.split('.').pop() ?? '').toLowerCase()
    if (!ALLOWED_EXT.has(ext)) {
      return NextResponse.json(
        { error: `extension .${ext} not allowed` },
        { status: 400 }
      )
    }

    const ts = Date.now()
    const finalName = `${safeBaseName(origName)}-${ts}.${ext}`

    // 通过 path-guard 校验目标
    const targetRel = `public/courses/${course}/${chapter}/images/${finalName}`
    const resolved = resolveStudioPath(targetRel)
    if (!resolved.relPath.startsWith('public/courses/')) {
      return NextResponse.json({ error: 'path outside whitelist' }, { status: 403 })
    }

    await mkdir(path.dirname(resolved.absPath), { recursive: true })
    const buf = Buffer.from(await file.arrayBuffer())
    await writeFile(resolved.absPath, buf)

    // 公网可访问 URL（去掉 public/ 前缀）
    const publicUrl = `/courses/${course}/${chapter}/images/${finalName}`

    return NextResponse.json({
      ok: true,
      filename: finalName,
      path: resolved.relPath,
      url: publicUrl,
      size: file.size
    })
  } catch (err) {
    if (err instanceof StudioPathError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[studio/upload] failed', err)
    return NextResponse.json(
      { error: (err as Error).message ?? 'upload failed' },
      { status: 500 }
    )
  }
}
