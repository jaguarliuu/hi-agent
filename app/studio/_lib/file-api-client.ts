/**
 * Studio 客户端的 fetch 封装。所有 /api/studio/* 调用走这里，统一错误处理与
 * 类型签名。
 */

export interface StudioFile {
  relPath: string
  content: string
  mtime: number
  size: number
  kind: 'mdx' | 'image' | 'meta' | 'other'
}

export interface FileNode {
  path: string
  label: string
  mtime: number
  size: number
}

export interface ChapterNode {
  slug: string
  files: FileNode[]
}

export interface CourseNode {
  slug: string
  title: string
  status: string
  chapters: ChapterNode[]
}

async function asJson<T>(res: Response): Promise<T> {
  const text = await res.text()
  let body: unknown
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    throw new Error(`Invalid JSON response (${res.status}): ${text.slice(0, 120)}`)
  }
  if (!res.ok) {
    const message =
      (body as { error?: string })?.error ?? res.statusText ?? 'request failed'
    const err = new Error(message) as Error & { status?: number; body?: unknown }
    err.status = res.status
    err.body = body
    throw err
  }
  return body as T
}

export async function fetchTree(): Promise<{ courses: CourseNode[] }> {
  const res = await fetch('/api/studio/tree', { cache: 'no-store' })
  return asJson(res)
}

export async function fetchFile(p: string): Promise<StudioFile> {
  const url = `/api/studio/file?path=${encodeURIComponent(p)}`
  const res = await fetch(url, { cache: 'no-store' })
  return asJson(res)
}

export async function saveFile(input: {
  path: string
  content: string
  baseMtime: number
}): Promise<{ ok: true; mtime: number; size: number }> {
  const res = await fetch('/api/studio/file', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input)
  })
  return asJson(res)
}

export async function fetchPreview(p: string): Promise<{
  relPath: string
  route: string
  url: string
}> {
  const url = `/api/studio/preview?path=${encodeURIComponent(p)}`
  const res = await fetch(url, { cache: 'no-store' })
  return asJson(res)
}

export interface UploadResult {
  ok: true
  filename: string
  path: string
  url: string
  size: number
}

export async function uploadImage(input: {
  course: string
  chapter: string
  file: File
}): Promise<UploadResult> {
  const fd = new FormData()
  fd.set('course', input.course)
  fd.set('chapter', input.chapter)
  fd.set('file', input.file)
  const res = await fetch('/api/studio/upload', {
    method: 'POST',
    body: fd
  })
  return asJson(res)
}

export interface ScaffoldInput {
  mode: 'chapter' | 'subchapter'
  course: string
  chapter: string
  title: string
  subSlug?: string
  subTitle?: string
}

export interface ScaffoldResult {
  ok: true
  created: string[]
  openPath: string
}

export async function scaffold(input: ScaffoldInput): Promise<ScaffoldResult> {
  const res = await fetch('/api/studio/scaffold', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input)
  })
  return asJson(res)
}

export interface CreateCourseInput {
  slug: string
  title: string
  subtitle: string
  description: string
  status: 'live' | 'draft' | 'planned'
  tag: string
  startChapterSlug: string
  firstChapterTitle: string
}

export interface CreateCourseResult {
  ok: true
  slug: string
  created: string[]
  openPath: string
}

export async function createCourse(
  input: CreateCourseInput
): Promise<CreateCourseResult> {
  const res = await fetch('/api/studio/course', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input)
  })
  return asJson(res)
}
