/**
 * /api/studio/file
 *
 * GET  ?path=app/courses/hi-agent/chat/page.mdx
 *   → { content, mtime, kind, relPath }
 *
 * PUT  body: { path, content, baseMtime }
 *   → 200 { mtime } | 409 { conflict, currentMtime }
 *
 * Dev-only. 受 path-guard.ts 白名单约束。
 */
import { NextResponse } from 'next/server'
import { stat, readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import {
  ensureStudioDevMode,
  resolveStudioPath,
  StudioPathError
} from '@/app/lib/studio/path-guard'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function errorResponse(err: unknown) {
  if (err instanceof StudioPathError) {
    return NextResponse.json({ error: err.message }, { status: err.status })
  }
  console.error('[studio/file] unexpected error', err)
  return NextResponse.json(
    { error: (err as Error)?.message ?? 'internal error' },
    { status: 500 }
  )
}

export async function GET(request: Request) {
  const guard = ensureStudioDevMode()
  if (guard) return guard
  try {
    const url = new URL(request.url)
    const target = url.searchParams.get('path')
    const resolved = resolveStudioPath(target)
    const stats = await stat(resolved.absPath)
    if (!stats.isFile()) {
      return NextResponse.json(
        { error: 'path is not a file' },
        { status: 400 }
      )
    }
    const content = await readFile(resolved.absPath, 'utf8')
    return NextResponse.json({
      relPath: resolved.relPath,
      kind: resolved.kind,
      content,
      mtime: stats.mtimeMs,
      size: stats.size
    })
  } catch (err) {
    return errorResponse(err)
  }
}

interface PutBody {
  path?: string
  content?: string
  baseMtime?: number
}

export async function PUT(request: Request) {
  const guard = ensureStudioDevMode()
  if (guard) return guard
  try {
    const body = (await request.json()) as PutBody
    const resolved = resolveStudioPath(body.path)
    if (typeof body.content !== 'string') {
      return NextResponse.json(
        { error: 'content must be a string' },
        { status: 400 }
      )
    }

    // 仅允许写 mdx / _meta.js（图片走 upload route）
    if (resolved.kind !== 'mdx' && resolved.kind !== 'meta') {
      return NextResponse.json(
        { error: `kind ${resolved.kind} not writable here` },
        { status: 400 }
      )
    }

    let currentMtime: number | null = null
    try {
      const stats = await stat(resolved.absPath)
      currentMtime = stats.mtimeMs
    } catch {
      currentMtime = null
    }

    if (
      currentMtime !== null &&
      typeof body.baseMtime === 'number' &&
      body.baseMtime > 0 &&
      Math.abs(currentMtime - body.baseMtime) > 1
    ) {
      return NextResponse.json(
        {
          error: 'mtime mismatch',
          conflict: true,
          currentMtime
        },
        { status: 409 }
      )
    }

    await mkdir(path.dirname(resolved.absPath), { recursive: true })
    await writeFile(resolved.absPath, body.content, 'utf8')
    const stats = await stat(resolved.absPath)
    return NextResponse.json({
      ok: true,
      mtime: stats.mtimeMs,
      size: stats.size
    })
  } catch (err) {
    return errorResponse(err)
  }
}
