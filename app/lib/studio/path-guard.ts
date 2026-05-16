/**
 * Studio 路径守卫：约束所有文件操作只能在课程内容根目录中进行。
 *
 * 白名单：
 *   - app/courses/<slug>/<chapter>/**       课程 mdx
 *   - public/courses/<slug>/<chapter>/**    图片 / 静态资源
 *
 * 任何包含 .. 段、绝对路径、以 / 开头但落到白名单外的路径都会被拒绝。
 *
 * 这是 Studio 安全边界的核心：dev 模式下 API 路由会接受 path 参数，
 * 必须确保不会被滑出工作区（path traversal）。
 */
import path from 'node:path'

const PROJECT_ROOT = path.resolve(process.cwd())

const ALLOWED_ROOTS = [
  path.join(PROJECT_ROOT, 'app', 'courses'),
  path.join(PROJECT_ROOT, 'public', 'courses')
] as const

export type StudioPathKind = 'mdx' | 'image' | 'meta' | 'other'

export interface ResolvedStudioPath {
  /** 工作区相对路径，统一使用 POSIX 分隔符 */
  relPath: string
  /** 操作系统绝对路径 */
  absPath: string
  /** 命中的根目录绝对路径 */
  rootAbs: string
  kind: StudioPathKind
}

export class StudioPathError extends Error {
  status: number
  constructor(message: string, status = 400) {
    super(message)
    this.name = 'StudioPathError'
    this.status = status
  }
}

function classify(relPosix: string): StudioPathKind {
  if (relPosix.endsWith('/page.mdx') || relPosix.endsWith('.mdx')) return 'mdx'
  if (relPosix.endsWith('/_meta.js')) return 'meta'
  if (
    /\.(png|jpe?g|gif|webp|svg|avif)$/i.test(relPosix) &&
    relPosix.startsWith('public/')
  )
    return 'image'
  return 'other'
}

/**
 * 解析并校验来自 API 入参的相对路径。返回包含规范化绝对路径的结构。
 *
 * @param input 来自客户端的相对路径，应使用 POSIX 风格（"app/courses/...")。
 *              也接受以 `/` 开头的形式，会去掉前导斜杠。
 */
export function resolveStudioPath(
  input: string | null | undefined
): ResolvedStudioPath {
  if (!input || typeof input !== 'string') {
    throw new StudioPathError('path is required', 400)
  }
  const trimmed = input.trim().replace(/^\/+/, '')
  if (!trimmed) throw new StudioPathError('path is empty', 400)
  if (trimmed.includes('\0')) throw new StudioPathError('invalid path', 400)

  // 拒绝绝对路径与盘符
  if (path.isAbsolute(trimmed) || /^[a-zA-Z]:/.test(trimmed)) {
    throw new StudioPathError('absolute paths are not allowed', 400)
  }

  const absPath = path.resolve(PROJECT_ROOT, trimmed)
  const rootAbs = ALLOWED_ROOTS.find(
    (root) => absPath === root || absPath.startsWith(root + path.sep)
  )
  if (!rootAbs) {
    throw new StudioPathError(
      `path outside studio whitelist: ${trimmed}`,
      403
    )
  }

  const relFromRoot = path.relative(PROJECT_ROOT, absPath)
  const relPosix = relFromRoot.split(path.sep).join('/')
  return {
    relPath: relPosix,
    absPath,
    rootAbs,
    kind: classify(relPosix)
  }
}

export const STUDIO_ALLOWED_ROOTS = ALLOWED_ROOTS

/**
 * Dev-only 守卫工具。所有 /api/studio/* 路由首行调用此函数；非 dev 环境
 * 直接返回一个 404 Response，调用方早退。
 */
export function ensureStudioDevMode(): Response | null {
  if (process.env.NODE_ENV !== 'development') {
    return new Response('Not Found', { status: 404 })
  }
  return null
}
