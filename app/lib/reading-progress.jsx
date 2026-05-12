'use client'

import React from 'react'
import { usePathname } from 'next/navigation'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'

const useClientLayoutEffect =
  typeof window === 'undefined' ? useEffect : useLayoutEffect

function shouldShowReadingProgress(pathname) {
  if (typeof pathname !== 'string' || !pathname.startsWith('/docs/')) {
    return false
  }

  const segments = pathname.split('/').filter(Boolean)
  return segments.length >= 3
}

function measureReadingProgress() {
  const scrollRange =
    document.documentElement.scrollHeight - window.innerHeight

  if (scrollRange <= 0) {
    return 0
  }

  return Math.min(Math.max(window.scrollY / scrollRange, 0), 1)
}

export function ReadingProgress() {
  const pathname = usePathname()
  const visible = shouldShowReadingProgress(pathname)
  const frameRef = useRef(0)
  const [progress, setProgress] = useState(0)

  useClientLayoutEffect(() => {
    if (!visible || typeof document === 'undefined') {
      setProgress(0)
      return
    }

    const syncProgress = () => {
      if (document.hidden) {
        return
      }

      setProgress(measureReadingProgress())
    }

    const updateProgress = () => {
      frameRef.current = 0
      syncProgress()
    }

    const queueMeasurement = () => {
      if (document.hidden || frameRef.current !== 0) {
        return
      }

      frameRef.current = window.requestAnimationFrame(updateProgress)
    }

    const handleVisibilityChange = () => {
      if (document.hidden && frameRef.current !== 0) {
        window.cancelAnimationFrame(frameRef.current)
        frameRef.current = 0
        return
      }

      syncProgress()
    }

    syncProgress()
    window.addEventListener('scroll', queueMeasurement, { passive: true })
    window.addEventListener('resize', queueMeasurement)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('scroll', queueMeasurement)
      window.removeEventListener('resize', queueMeasurement)
      document.removeEventListener('visibilitychange', handleVisibilityChange)

      if (frameRef.current !== 0) {
        window.cancelAnimationFrame(frameRef.current)
        frameRef.current = 0
      }
    }
  }, [visible, pathname])

  if (!visible) {
    return null
  }

  return (
    <div
      aria-hidden="true"
      className="ha-reading-progress"
      data-testid="reading-progress"
      data-visible="true"
      style={{ transform: `scaleX(${progress})` }}
    />
  )
}
