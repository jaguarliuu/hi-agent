'use client'

import { useEffect } from 'react'

export function ThemeSwitchRelocator() {
  useEffect(() => {
    let cancelled = false
    let scheduled = false
    let observer = null

    const run = () => {
      if (cancelled) return

      observer?.disconnect()

      const navbar = document.querySelector('.nextra-navbar nav')
      const buttons = Array.from(
        document.querySelectorAll('button[title="Change theme"]')
      )

      if (navbar && buttons.length > 0) {
        const inNavbar = buttons.find((b) => b.closest('.ha-theme-slot'))

        if (!inNavbar) {
          const btn = buttons[0]
          const slot = document.createElement('div')
          slot.className = 'ha-theme-slot'
          btn.parentElement?.removeChild(btn)
          slot.appendChild(btn)

          const hamburger = navbar.querySelector('.nextra-hamburger')
          if (hamburger) {
            navbar.insertBefore(slot, hamburger)
          } else {
            navbar.appendChild(slot)
          }
        }

        for (const btn of buttons) {
          if (btn.closest('.ha-theme-slot')) continue
          const footer = btn.closest('.nextra-sidebar-footer')
          if (footer && footer.children.length === 1) {
            footer.remove()
          } else {
            btn.remove()
          }
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
