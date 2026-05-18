import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { UserMenu } from './user-menu'

beforeEach(() => {
  vi.unstubAllGlobals()
})

function mockMe(status: number, body: unknown) {
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

describe('UserMenu', () => {
  it('logged-out: shows 登录 button', async () => {
    mockMe(401, { ok: false, code: 'UNAUTHORIZED' })
    render(<UserMenu />)
    await waitFor(() => screen.getByRole('button', { name: /登录/i }))
  })

  it('clicking 登录 opens LoginDialog', async () => {
    mockMe(401, { ok: false, code: 'UNAUTHORIZED' })
    render(<UserMenu />)
    await waitFor(() => screen.getByRole('button', { name: /登录/i }))
    fireEvent.click(screen.getByRole('button', { name: /登录/i }))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeTruthy())
  })

  it('logged-in: shows displayName + 注销', async () => {
    mockMe(200, {
      ok: true,
      user: {
        id: 'u1',
        email: 'a@b.com',
        profile: { displayName: 'Alice', avatarUrl: null }
      }
    })
    render(<UserMenu />)
    await waitFor(() => screen.getByText('Alice'))
    fireEvent.click(screen.getByText('Alice'))
    expect(screen.getByRole('menuitem', { name: /注销/i })).toBeTruthy()
  })
})
