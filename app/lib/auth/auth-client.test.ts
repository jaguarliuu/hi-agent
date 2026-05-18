import { describe, it, expect, vi, beforeEach } from 'vitest'
import { requestOtp, verifyOtp, fetchMe, logout, AuthError } from './auth-client'

beforeEach(() => {
  vi.unstubAllGlobals()
})

function mockFetch(status: number, body: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(JSON.stringify(body), {
          status,
          headers: { 'content-type': 'application/json' }
        })
    )
  )
}

describe('auth-client', () => {
  it('requestOtp: returns ok:true on 200', async () => {
    mockFetch(200, { ok: true })
    await expect(requestOtp('a@b.com')).resolves.toEqual({ ok: true })
  })

  it('requestOtp: throws AuthError(RATE_LIMITED) on 429 with retryAfterSec', async () => {
    mockFetch(429, { ok: false, code: 'RATE_LIMITED', message: '请求过于频繁', retryAfterSec: 30 })
    let caught: unknown
    try {
      await requestOtp('a@b.com')
    } catch (e) {
      caught = e
    }
    expect(caught).toBeInstanceOf(AuthError)
    const err = caught as AuthError
    expect(err.code).toBe('RATE_LIMITED')
    expect(err.status).toBe(429)
    expect(err.detail.retryAfterSec).toBe(30)
  })

  it('verifyOtp: throws AuthError(INVALID_OR_EXPIRED) on 410', async () => {
    mockFetch(410, { ok: false, code: 'INVALID_OR_EXPIRED', message: '验证码错误或已过期' })
    await expect(verifyOtp('a@b.com', '000000')).rejects.toThrow('INVALID_OR_EXPIRED')
  })

  it('fetchMe: returns null on 401 (instead of throw)', async () => {
    mockFetch(401, { ok: false, code: 'UNAUTHORIZED' })
    await expect(fetchMe()).resolves.toBeNull()
  })

  it('logout: 200 → ok', async () => {
    mockFetch(200, { ok: true })
    await expect(logout()).resolves.toEqual({ ok: true })
  })
})
