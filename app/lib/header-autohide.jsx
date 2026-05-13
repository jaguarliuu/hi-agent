'use client'

import { useEffect } from 'react'

const HOVER_REVEAL_PX = 64
const SCROLL_DELTA_PX = 8
const MIN_SCROLL_Y_BEFORE_HIDE = 48

function setHeaderState(collapsed) {
  const html = document.documentElement
  if (collapsed) {
    html.dataset.haHeader = 'collapsed'
  } else {
    html.dataset.haHeader = 'visible'
  }
}

export function HeaderAutohide() {
  useEffect(() => {
    if (typeof document === 'undefined') {
      return
    }

    const html = document.documentElement
    let lastScrollY = window.scrollY
    let pointerNearTop = false
    let keyboardFocusInHeader = false
    let frame = 0

    setHeaderState(false)

    const isPlaygroundOpen = () => html.dataset.haPlayground === 'open'

    const applyState = () => {
      frame = 0
      if (pointerNearTop || keyboardFocusInHeader) {
        setHeaderState(false)
        return
      }

      if (isPlaygroundOpen()) {
        setHeaderState(true)
        return
      }

      if (window.scrollY <= MIN_SCROLL_Y_BEFORE_HIDE) {
        setHeaderState(false)
        return
      }

      if (html.dataset.haHeader === 'collapsed') {
        return
      }

      setHeaderState(true)
    }

    const queue = () => {
      if (frame !== 0) {
        return
      }
      frame = window.requestAnimationFrame(applyState)
    }

    const onScroll = () => {
      const currentY = window.scrollY
      const delta = currentY - lastScrollY

      if (Math.abs(delta) < SCROLL_DELTA_PX) {
        return
      }

      if (pointerNearTop || keyboardFocusInHeader) {
        lastScrollY = currentY
        return
      }

      if (isPlaygroundOpen()) {
        lastScrollY = currentY
        setHeaderState(true)
        return
      }

      if (delta > 0 && currentY > MIN_SCROLL_Y_BEFORE_HIDE) {
        setHeaderState(true)
      } else if (delta < 0) {
        setHeaderState(false)
      }

      lastScrollY = currentY
    }

    const onPointerMove = (event) => {
      const near = event.clientY <= HOVER_REVEAL_PX
      if (near === pointerNearTop) {
        return
      }
      pointerNearTop = near
      queue()
    }

    const onFocusIn = (event) => {
      const target = event.target
      if (!(target instanceof Element)) {
        return
      }
      if (target.closest('.nextra-navbar')) {
        keyboardFocusInHeader = true
        queue()
      }
    }

    const onFocusOut = (event) => {
      const nextTarget = event.relatedTarget
      if (nextTarget instanceof Element && nextTarget.closest('.nextra-navbar')) {
        return
      }
      if (!keyboardFocusInHeader) {
        return
      }
      keyboardFocusInHeader = false
      queue()
    }

    const playgroundObserver = new MutationObserver(() => {
      queue()
    })
    playgroundObserver.observe(html, {
      attributes: true,
      attributeFilter: ['data-ha-playground']
    })

    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('pointermove', onPointerMove, { passive: true })
    window.addEventListener('focusin', onFocusIn)
    window.addEventListener('focusout', onFocusOut)

    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('focusin', onFocusIn)
      window.removeEventListener('focusout', onFocusOut)
      playgroundObserver.disconnect()
      if (frame !== 0) {
        window.cancelAnimationFrame(frame)
      }
      delete html.dataset.haHeader
    }
  }, [])

  return null
}
