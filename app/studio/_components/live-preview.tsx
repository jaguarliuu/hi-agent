'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

interface LivePreviewProps {
  /** mdx 文件路径，如 app/courses/hi-agent/chat/page.mdx；为 null 时显示 placeholder */
  filePath: string | null
  /** dirty 状态，仅用于 UI 提示（保存后才刷新 iframe） */
  dirty: boolean
  /** 单调递增的版本号；外部每次保存成功后递增，触发 iframe 重载 */
  reloadToken: number
}

/** "app/courses/hi-agent/chat/01-getting-started/page.mdx" → "/courses/hi-agent/chat/01-getting-started" */
function deriveRouteFromPath(relPath: string): string | null {
  if (!relPath.startsWith('app/courses/')) return null
  if (!relPath.endsWith('.mdx')) return null
  let route = relPath.replace(/^app\//, '/').replace(/\/page\.mdx$/, '')
  route = route.replace(/\.mdx$/, '')
  return route || null
}

/**
 * 实时预览面板。
 *
 * 实现策略（v1）：iframe 直接指向 dev 服务器上对应的课程路由。利用 Next 的
 * dev HMR：当用户保存 mdx 后，Next 会自动重编译并推送给 iframe；如果 HMR
 * 边界丢失，我们也会通过 reloadToken 主动 location.reload() 兜底。
 *
 * 这避免了在 studio 内部重建一整套 nextra 主题 / mdx-components 注册，
 * 同时保证预览是"和上线后一模一样"。
 */
export function LivePreview({ filePath, dirty, reloadToken }: LivePreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const route = useMemo(
    () => (filePath ? deriveRouteFromPath(filePath) : null),
    [filePath]
  )

  // reloadToken 改变 → 主动 reload iframe（保存后兜底）
  useEffect(() => {
    if (!route) return
    if (reloadToken === 0) return
    const ifr = iframeRef.current
    if (!ifr) return
    try {
      // 同源 dev URL 可直接访问 contentWindow
      ifr.contentWindow?.location.reload()
    } catch {
      ifr.src = ifr.src
    }
  }, [reloadToken, route])

  function handleManualRefresh() {
    const ifr = iframeRef.current
    if (!ifr) return
    setLoading(true)
    setError(null)
    try {
      ifr.contentWindow?.location.reload()
    } catch {
      ifr.src = ifr.src
    }
  }

  function handleOpenInTab() {
    if (!route) return
    window.open(route, '_blank', 'noopener')
  }

  if (!route) {
    return (
      <div className="studio-preview studio-preview--empty">
        <p>选择一个 mdx 文件后，这里会显示实时预览。</p>
      </div>
    )
  }

  return (
    <div className="studio-preview">
      <header className="studio-preview__bar">
        <span className="studio-preview__route" title={route}>
          {route}
        </span>
        <div className="studio-preview__actions">
          {dirty && <span className="studio-preview__hint">保存后刷新</span>}
          <button
            type="button"
            className="studio-preview__btn"
            onClick={handleManualRefresh}
            title="重新加载预览"
          >
            ↻
          </button>
          <button
            type="button"
            className="studio-preview__btn"
            onClick={handleOpenInTab}
            title="在新标签打开"
          >
            ↗
          </button>
        </div>
      </header>
      <div className="studio-preview__frame-wrap">
        {loading && <div className="studio-preview__loading">加载中…</div>}
        {error && <div className="studio-preview__error">{error}</div>}
        <iframe
          ref={iframeRef}
          src={route}
          title="Live preview"
          className="studio-preview__frame"
          onLoad={() => setLoading(false)}
          onError={() => {
            setLoading(false)
            setError('预览加载失败')
          }}
        />
      </div>
    </div>
  )
}
