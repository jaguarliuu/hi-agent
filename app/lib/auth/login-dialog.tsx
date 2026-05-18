'use client'
import React, { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { requestOtp, verifyOtp, AuthError, type VerifyOtpResponse } from './auth-client'
import styles from './login-dialog.module.css'

type Step = 'email' | 'code'

export interface LoginDialogProps {
  open: boolean
  onClose: () => void
  onLoggedIn: (payload: VerifyOtpResponse) => void
}

export function LoginDialog({ open, onClose, onLoggedIn }: LoginDialogProps) {
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const titleId = useId()
  const previouslyFocusedRef = useRef<HTMLElement | null>(null)
  const dialogRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) {
      setStep('email')
      setEmail('')
      setCode('')
      setError(null)
      setBusy(false)
      const prev = previouslyFocusedRef.current
      previouslyFocusedRef.current = null
      if (prev && typeof prev.focus === 'function') {
        prev.focus()
      }
      return
    }
    previouslyFocusedRef.current =
      typeof document !== 'undefined' ? (document.activeElement as HTMLElement | null) : null
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const messageFor = (e: AuthError): string => {
    switch (e.code) {
      case 'RATE_LIMITED': {
        const raw = e.detail.retryAfterSec
        const sec = typeof raw === 'number' && Number.isFinite(raw) ? raw : 60
        return `请求过于频繁，请稍后再试（约 ${sec} 秒后）`
      }
      case 'INVALID_INPUT':
        return '邮箱或验证码格式不正确'
      case 'INVALID_OR_EXPIRED':
        return '验证码无效或已过期，请重新获取'
      case 'ACCOUNT_DISABLED':
        return '账号已被禁用，请联系管理员'
      default:
        return '操作失败，请稍后重试'
    }
  }

  async function onSendCode(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await requestOtp(email)
      setStep('code')
    } catch (err) {
      setError(err instanceof AuthError ? messageFor(err) : '网络异常')
    } finally {
      setBusy(false)
    }
  }

  async function onVerify(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const payload = await verifyOtp(email, code)
      onLoggedIn(payload)
      onClose()
    } catch (err) {
      setError(err instanceof AuthError ? messageFor(err) : '网络异常')
    } finally {
      setBusy(false)
    }
  }

  function onBackdropMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <div className={styles.backdrop} onMouseDown={onBackdropMouseDown}>
      <div
        ref={dialogRef}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <h2 id={titleId} className={styles.title}>
          登录 / 注册
        </h2>
        {step === 'email' ? (
          <form onSubmit={onSendCode}>
            <label className={styles.field}>
              <span>邮箱</span>
              <input
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </label>
            <p className={styles.hint}>未注册的邮箱将自动创建账号</p>
            {error && <p className={styles.error}>{error}</p>}
            <div className={styles.actions}>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnGhost}`}
                onClick={onClose}
              >
                取消
              </button>
              <button type="submit" className={styles.btn} disabled={busy || !email}>
                {busy ? '发送中…' : '发送验证码'}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={onVerify}>
            <p className={styles.hint}>
              已发送 6 位验证码至 <strong>{email}</strong>，10 分钟内有效
            </p>
            <label className={styles.field}>
              <span>验证码</span>
              <input
                inputMode="numeric"
                pattern="\d{6}"
                required
                autoFocus
                value={code}
                maxLength={6}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="6 位数字"
              />
            </label>
            {error && <p className={styles.error}>{error}</p>}
            <div className={styles.actions}>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnGhost}`}
                onClick={() => setStep('email')}
              >
                返回
              </button>
              <button
                type="submit"
                className={styles.btn}
                disabled={busy || code.length !== 6}
              >
                {busy ? '校验中…' : '登录'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
