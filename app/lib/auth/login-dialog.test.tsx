import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { LoginDialog } from './login-dialog'

beforeEach(() => {
  vi.unstubAllGlobals()
})

function stubSequence(responses: Array<{ status: number; body: unknown }>) {
  const fn = vi.fn()
  for (const r of responses) {
    fn.mockResolvedValueOnce(
      new Response(JSON.stringify(r.body), {
        status: r.status,
        headers: { 'content-type': 'application/json' }
      })
    )
  }
  vi.stubGlobal('fetch', fn)
  return fn
}

describe('LoginDialog', () => {
  it('email step → request otp → code step', async () => {
    stubSequence([{ status: 200, body: { ok: true } }])
    render(<LoginDialog open onClose={() => {}} onLoggedIn={() => {}} />)

    fireEvent.change(screen.getByLabelText(/邮箱/i), { target: { value: 'a@b.com' } })
    fireEvent.click(screen.getByRole('button', { name: /发送验证码/i }))

    await waitFor(() => {
      expect(screen.getByLabelText(/验证码/i)).toBeTruthy()
    })
  })

  it('code step → verify success → onLoggedIn called', async () => {
    stubSequence([
      { status: 200, body: { ok: true } },
      { status: 200, body: { ok: true, user: { id: 'u1', email: 'a@b.com' }, isNew: false } }
    ])
    const onLoggedIn = vi.fn()
    render(<LoginDialog open onClose={() => {}} onLoggedIn={onLoggedIn} />)

    fireEvent.change(screen.getByLabelText(/邮箱/i), { target: { value: 'a@b.com' } })
    fireEvent.click(screen.getByRole('button', { name: /发送验证码/i }))
    await waitFor(() => screen.getByLabelText(/验证码/i))

    fireEvent.change(screen.getByLabelText(/验证码/i), { target: { value: '123456' } })
    fireEvent.click(screen.getByRole('button', { name: /^登录$/i }))

    await waitFor(() => expect(onLoggedIn).toHaveBeenCalledTimes(1))
  })

  it('shows RATE_LIMITED error on 429 (retryAfterSec camelCase)', async () => {
    stubSequence([
      {
        status: 429,
        body: {
          ok: false,
          code: 'RATE_LIMITED',
          message: '请求过于频繁，请稍后再试',
          retryAfterSec: 30
        }
      }
    ])
    render(<LoginDialog open onClose={() => {}} onLoggedIn={() => {}} />)

    fireEvent.change(screen.getByLabelText(/邮箱/i), { target: { value: 'a@b.com' } })
    fireEvent.click(screen.getByRole('button', { name: /发送验证码/i }))

    await waitFor(() => {
      expect(screen.getByText(/请稍后再试/)).toBeTruthy()
    })
  })
})
