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
        const footer = btn.closest('.nextra-sidebar-footer')
        if (footer && footer.children.length === 1) {
          footer.remove()
        } else {
          btn.remove()
        }
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
