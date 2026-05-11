'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

import { useMotion } from './motion-context'

export function RouteMotionShell({ children }) {
  const { reduced } = useMotion()
  const pathname = usePathname()
  const [activeTocSlug, setActiveTocSlug] = useState('')
  const [supportsViewTransitions, setSupportsViewTransitions] = useState(false)

  useEffect(() => {
    setSupportsViewTransitions(
      typeof document !== 'undefined' &&
        typeof document.startViewTransition === 'function'
    )
  }, [])

  useEffect(() => {
    if (typeof document === 'undefined') {
      return
    }

    const syncFromHash = () => {
      setActiveTocSlug(decodeURI(window.location.hash.replace(/^#/, '')))
    }

    syncFromHash()
    window.addEventListener('hashchange', syncFromHash)

    return () => {
      window.removeEventListener('hashchange', syncFromHash)
    }
  }, [pathname])

  useEffect(() => {
    if (
      typeof document === 'undefined' ||
      typeof window.IntersectionObserver !== 'function'
    ) {
      return
    }

    const headingAnchors = Array.from(
      document.querySelectorAll('.subheading-anchor[href^="#"]')
    )

    if (headingAnchors.length === 0) {
      return
    }

    const observer = new window.IntersectionObserver(
      (entries) => {
        const entry = entries.find((candidate) => candidate.isIntersecting)

        if (!(entry?.target instanceof HTMLAnchorElement)) {
          return
        }

        setActiveTocSlug(decodeURI(entry.target.hash.slice(1)))
      },
      {
        rootMargin: `-${
          getComputedStyle(document.body).getPropertyValue('--nextra-navbar-height') ||
          '0%'
        } 0% -80%`,
      }
    )

    headingAnchors.forEach((anchor) => {
      observer.observe(anchor)
    })

    return () => {
      headingAnchors.forEach((anchor) => {
        observer.unobserve(anchor)
      })
      observer.disconnect()
    }
  }, [pathname])

  useEffect(() => {
    if (typeof document === 'undefined') {
      return
    }

    const syncActiveTocLink = () => {
      const tocLinks = document.querySelectorAll(
        '.x\\:sticky .nextra-scrollbar a[href^="#"]'
      )

      tocLinks.forEach((link) => {
        const slug = decodeURI(link.getAttribute('href')?.slice(1) ?? '')

        if (activeTocSlug && slug === activeTocSlug) {
          link.setAttribute('data-ha-toc-active', 'true')
        } else {
          link.removeAttribute('data-ha-toc-active')
        }
      })
    }

    syncActiveTocLink()

    const observer = new MutationObserver(syncActiveTocLink)
    observer.observe(document.body, {
      subtree: true,
      childList: true,
    })

    return () => {
      observer.disconnect()
    }
  }, [activeTocSlug, pathname])

  return (
    <div
      className="ha-route-shell"
      data-ha-route-shell="true"
      data-ha-view-transitions={supportsViewTransitions ? 'supported' : 'unsupported'}
      data-ha-reduced-motion={reduced ? 'true' : 'false'}
    >
      <div
        key={pathname}
        className="ha-route-shell__stage"
        data-ha-route-stage={pathname || '/'}
      >
        {children}
      </div>
    </div>
  )
}
