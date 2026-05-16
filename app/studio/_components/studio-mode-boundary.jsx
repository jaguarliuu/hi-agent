'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

/**
 * Studio 模式边界。
 *
 * 关键问题：根 layout.jsx 把 children 包在 nextra-theme-docs 的 <Layout> 里，
 * 而 <Layout> 仅当当前路由能在 Nextra pageMap 中查到时才会渲染 children；
 * /studio 不是 mdx 文档，不在 pageMap，所以 children 会被吞掉，导致白屏。
 *
 * 解决：用 React Portal 把 studio 内容直接挂到 <body> 顶层，绕过 Nextra Layout。
 * 同时给 <body> 加 .studio-mode 类，配合 globals.css 隐藏 chrome（banner / nav /
 * sidebar / footer / toc）。layout.jsx 已经在 server 侧做了 NODE_ENV 守卫。
 */
export function StudioModeBoundary({ children }) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    document.body.classList.add('studio-mode')
    document.documentElement.dataset.studio = 'true'
    setMounted(true)
    return () => {
      document.body.classList.remove('studio-mode')
      delete document.documentElement.dataset.studio
    }
  }, [])

  if (!mounted) return null
  return createPortal(
    <div className="studio-root">{children}</div>,
    document.body
  )
}
