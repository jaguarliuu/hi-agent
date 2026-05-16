/**
 * /api/studio/preview
 *
 * GET ?path=app/courses/<slug>/<chapter>/<sub?>/page.mdx
 *   → { url: "/courses/<slug>/<chapter>[/<sub>]", route: "..." }
 *
 * v1 策略：不做服务端 mdx 编译，而是把文件路径反推成 dev 服务器的页面路由，
 * 让 iframe 直接加载真实页面。依赖 Next dev HMR 实现"保存即刷新"的实时预览。
 *
 * 这样做的好处：
 *   - 完全还原 nextra 主题 + 所有自定义组件 (HaCallout / HaSequenceFlow / etc.)
 *   - 不需要在 studio 内重建 mdx-components 注册
 *   - 写代码块、动画、playground 都能看到真实最终态
 *
 * 仅 dev 可用；构建期被 strip-studio.mjs 整体剥离。
 */
import { NextResponse } from 'next/server'
import {
  ensureStudioDevMode,
  resolveStudioPath,
  StudioPathError
} from '@/app/lib/studio/path-guard'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** "app/courses/hi-agent/chat/01-getting-started/page.mdx" → "/courses/hi-agent/chat/01-getting-started" */
function deriveRouteFromPath(relPath: string): string | null {
  if (!relPath.startsWith('app/courses/')) return null
  if (!relPath.endsWith('/page.mdx') && !relPath.endsWith('.mdx')) return null
  // 去掉前缀 app/，去掉末尾 /page.mdx
  let route = relPath.replace(/^app\//, '/').replace(/\/page\.mdx$/, '')
  // 处理直接命名 *.mdx（非 page.mdx）的边界场景：截掉扩展名
  route = route.replace(/\.mdx$/, '')
  return route || null
}

export async function GET(request: Request) {
  const guard = ensureStudioDevMode()
  if (guard) return guard
  try {
    const url = new URL(request.url)
    const target = url.searchParams.get('path')
    const resolved = resolveStudioPath(target)
    const route = deriveRouteFromPath(resolved.relPath)
    if (!route) {
      return NextResponse.json(
        { error: `cannot derive route from ${resolved.relPath}` },
        { status: 400 }
      )
    }
    return NextResponse.json({
      relPath: resolved.relPath,
      route,
      url: route // 同一进程下相对 URL 即可被 iframe 加载
    })
  } catch (err) {
    if (err instanceof StudioPathError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    )
  }
}
