'use client'

import { useEffect } from 'react'

/**
 * Removes Nextra's stock `<button title="Change theme">` listboxes from
 * both the navbar and the sidebar footer. Our own
 * `<ThemeTransitionToggle>` (mounted via portal into a navbar slot)
 * replaces them so we can drive the View Transitions–based circular
 * sweep when toggling themes.
 *
 * We intentionally drop the three-state listbox (light/dark/system).
 * `next-themes` still resolves the initial theme from the OS via its
 * default; the visible toggle is light↔dark.
 *
 * 注意：sidebar footer 还承载着折叠/展开侧边栏的按钮
 * (`title="Collapse sidebar"|"Expand sidebar"`)，必须保留。仅移除主题
 * 切换按钮本身，不要因为"footer 看上去只剩一个孩子"就把整个 footer 删除，
 * 否则折叠按钮会一并消失，导致用户无法折叠侧边栏。
 */
export function ThemeSwitchRelocator() {
  useEffect(() => {
    let cancelled = false
    let scheduled = false
    let observer = null

    const run = () => {
      if (cancelled) return

      observer?.disconnect()

      const buttons = Array.from(
        document.querySelectorAll('button[title="Change theme"]')
      )

      for (const btn of buttons) {
        btn.remove()
      }

      observer?.observe(document.body, { childList: true, subtree: true })
    }

    const schedule = () => {
      if (scheduled || cancelled) return
      scheduled = true
      requestAnimationFrame(() => {
        scheduled = false
        run()
      })
    }

    observer = new MutationObserver(schedule)
    observer.observe(document.body, { childList: true, subtree: true })
    schedule()

    return () => {
      cancelled = true
      observer?.disconnect()
    }
  }, [])

  return null
}
