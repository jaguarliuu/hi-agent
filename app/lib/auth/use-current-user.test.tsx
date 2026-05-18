import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useCurrentUser } from './use-current-user'

beforeEach(() => {
  vi.unstubAllGlobals()
})

function mockMe(payload: unknown, status = 200) {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(JSON.stringify(payload), {
          status,
          headers: { 'content-type': 'application/json' }
        })
    )
  )
}

describe('useCurrentUser', () => {
  it('initial loading → user (profile nested in user, camelCase)', async () => {
    mockMe({
      ok: true,
      user: {
        id: 'u1',
        email: 'a@b.com',
        profile: { displayName: 'A', avatarUrl: null }
      }
    })
    const { result } = renderHook(() => useCurrentUser())
    expect(result.current.loading).toBe(true)
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.user?.id).toBe('u1')
    expect(result.current.user?.email).toBe('a@b.com')
    expect(result.current.profile?.displayName).toBe('A')
  })

  it('401 → user=null without throw', async () => {
    mockMe({ ok: false, code: 'UNAUTHORIZED' }, 401)
    const { result } = renderHook(() => useCurrentUser())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.user).toBeNull()
    expect(result.current.profile).toBeNull()
    expect(result.current.error).toBeNull()
  })

  it('refresh() refetches', async () => {
    mockMe({ ok: true, user: { id: 'u1', email: 'a@b.com', profile: null } })
    const { result } = renderHook(() => useCurrentUser())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.user?.id).toBe('u1')
    mockMe({ ok: true, user: { id: 'u2', email: 'c@d.com', profile: null } })
    await act(async () => {
      await result.current.refresh()
    })
    expect(result.current.user?.id).toBe('u2')
  })
})
