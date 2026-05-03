'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export function ZoomableImage({
  src,
  alt = '',
  width,
  height,
  title,
  className,
  style,
  ...rest
}) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef(null)

  const handleOpen = useCallback((event) => {
    if (event) event.preventDefault()
    setOpen(true)
  }, [])

  const handleClose = useCallback(() => {
    setOpen(false)
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') handleClose()
    }
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKey)
    }
  }, [open, handleClose])

  return (
    <>
      <img
        ref={triggerRef}
        src={src}
        alt={alt}
        title={title || alt}
        width={width}
        height={height}
        loading="lazy"
        decoding="async"
        onClick={handleOpen}
        className={['ha-zoom-img', className].filter(Boolean).join(' ')}
        style={style}
        {...rest}
      />
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={alt || '图片预览'}
          className="ha-zoom-overlay"
          onClick={handleClose}
        >
          <button
            type="button"
            aria-label="关闭"
            className="ha-zoom-close"
            onClick={handleClose}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M18 6L6 18" />
              <path d="M6 6l12 12" />
            </svg>
          </button>
          <img
            src={src}
            alt={alt}
            className="ha-zoom-opened"
            onClick={(e) => e.stopPropagation()}
          />
          {alt ? <div className="ha-zoom-caption">{alt}</div> : null}
        </div>
      )}
    </>
  )
}
