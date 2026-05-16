'use client'

import { useCallback, useEffect, useState } from 'react'
import { flushSync } from 'react-dom'
import { useTheme } from 'next-themes'

/**
 * Studio 专用的主题切换按钮。
 *
 * 为什么不直接复用 [ThemeTransitionToggle](file:///C:/Users/Administrator/Desktop/Jaguarliu/code/hi-agent/app/lib/motion/theme-transition-toggle.tsx) ？
 *   该组件用 createPortal 挂到 `.nextra-navbar nav` 的一个 slot 中，
 *   而 Studio 的 _meta theme 把 navbar 关掉了（navbar: false）——
 *   slot 永远找不到 ⇒ 按钮永远不渲染。Studio 需要一个普通的、能直接
 *   塞进自己 toolbar / landing header 的常规按钮。
 *
 * 行为：
 *   - 调用 next-themes 的 setTheme(light/dark)；root layout 仍然挂着
 *     nextra-theme-docs 内置的 ThemeProvider，所以 useTheme() 可用。
 *   - 优先使用 View Transitions API 做圆形扩散动画（与主站一致），
 *     不支持时直接 setTheme（globals.css 已经写了 240ms cross-fade）。
 *   - 尊重 prefers-reduced-motion：直接 setTheme 不放动画。
 *   - SSR / hydration 安全：未 mounted 前渲染一个不区分图标的占位，
 *     确保服务端 / 客户端首屏 DOM 一致。
 */
export function StudioThemeToggle({
  className = ''
}: {
  className?: string
}) {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const isDark = mounted && resolvedTheme === 'dark'

  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      const next = isDark ? 'light' : 'dark'

      const reduced =
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches

      const supportsViewTransition =
        typeof document !== 'undefined' &&
        typeof (
          document as Document & {
            startViewTransition?: (cb: () => void) => unknown
          }
        ).startViewTransition === 'function'

      if (!supportsViewTransition || reduced) {
        setTheme(next)
        return
      }

      const button = event.currentTarget
      const rect = button.getBoundingClientRect()
      const isKeyboard = event.detail === 0
      const originX = isKeyboard
        ? rect.left + rect.width / 2
        : event.clientX
      const originY = isKeyboard
        ? rect.top + rect.height / 2
        : event.clientY

      const transition = (
        document as Document & {
          startViewTransition: (cb: () => void) => {
            ready: Promise<void>
            finished: Promise<void>
          }
        }
      ).startViewTransition(() => {
        flushSync(() => setTheme(next))
      })

      void transition.ready
        .then(() => {
          const radius = Math.hypot(
            Math.max(originX, window.innerWidth - originX),
            Math.max(originY, window.innerHeight - originY)
          )
          const expand = [
            `circle(0px at ${originX}px ${originY}px)`,
            `circle(${radius}px at ${originX}px ${originY}px)`
          ]
          const goingDark = next === 'dark'
          const clipPath = goingDark ? expand : [...expand].reverse()
          const pseudoElement = goingDark
            ? '::view-transition-new(root)'
            : '::view-transition-old(root)'

          document.documentElement.animate(
            { clipPath },
            {
              duration: 480,
              easing: 'cubic-bezier(0.2, 0, 0, 1)',
              fill: 'both',
              pseudoElement
            }
          )
        })
        .catch(() => {
          /* 动画被浏览器跳过，主题已通过 flushSync 提交，安全吞掉。 */
        })
    },
    [isDark, setTheme]
  )

  const label = mounted
    ? isDark
      ? '切换到浅色主题'
      : '切换到深色主题'
    : '切换主题'

  return (
    <button
      type="button"
      className={['studio-theme-toggle', className].filter(Boolean).join(' ')}
      data-theme-resolved={mounted ? (isDark ? 'dark' : 'light') : 'unknown'}
      aria-label={label}
      title={label}
      onClick={handleClick}
    >
      <SunIcon />
      <MoonIcon />
    </button>
  )
}

function SunIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="studio-theme-toggle__icon studio-theme-toggle__icon--sun"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="studio-theme-toggle__icon studio-theme-toggle__icon--moon"
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z" />
    </svg>
  )
}
