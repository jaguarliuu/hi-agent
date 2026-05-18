'use client'
import React, { useEffect, useId, useRef, useState } from 'react'
import { useCurrentUser } from './use-current-user'
import { logout } from './auth-client'
import { LoginDialog } from './login-dialog'
import { useToast } from '../motion/toast-context'
import styles from './user-menu.module.css'

export function UserMenu() {
  const { user, profile, loading, refresh } = useCurrentUser()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const wrapRef = useRef<HTMLSpanElement | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const menuId = useId()
  const { showToast } = useToast()

  useEffect(() => {
    if (!menuOpen) return
    const onPointer = (e: MouseEvent) => {
      const root = wrapRef.current
      if (!root) return
      if (!root.contains(e.target as Node)) setMenuOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  if (loading) return null

  if (!user) {
    return (
      <span className={styles.wrap}>
        <button className={styles.btn} onClick={() => setDialogOpen(true)}>
          登录
        </button>
        <LoginDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          onLoggedIn={() => {
            setDialogOpen(false)
            void refresh()
          }}
        />
      </span>
    )
  }

  const label = profile?.displayName || user.email

  async function onLogout() {
    setMenuOpen(false)
    try {
      await logout()
    } catch (e) {
      showToast('注销请求失败，已清理本地登录态', { tone: 'error' })
      if (typeof console !== 'undefined') console.warn('logout failed', e)
    } finally {
      void refresh()
    }
  }

  return (
    <span ref={wrapRef} className={styles.wrap}>
      <button
        ref={triggerRef}
        className={styles.btn}
        onClick={() => setMenuOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-controls={menuId}
      >
        {label}
      </button>
      {menuOpen && (
        <div id={menuId} className={styles.menu} role="menu">
          <div className={styles.email} role="presentation">
            {user.email}
          </div>
          <button className={styles.item} onClick={onLogout} role="menuitem">
            注销
          </button>
        </div>
      )}
    </span>
  )
}
