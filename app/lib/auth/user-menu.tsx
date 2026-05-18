'use client'
import React, { useState } from 'react'
import { useCurrentUser } from './use-current-user'
import { logout } from './auth-client'
import { LoginDialog } from './login-dialog'
import styles from './user-menu.module.css'

export function UserMenu() {
  const { user, profile, loading, refresh } = useCurrentUser()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

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
    } finally {
      void refresh()
    }
  }

  return (
    <span className={styles.wrap}>
      <button className={styles.btn} onClick={() => setMenuOpen((v) => !v)}>
        {label}
      </button>
      {menuOpen && (
        <div className={styles.menu} role="menu">
          <div className={styles.email}>{user.email}</div>
          <button className={styles.item} onClick={onLogout} role="menuitem">
            注销
          </button>
        </div>
      )}
    </span>
  )
}
