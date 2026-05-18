'use client'
import { useCallback, useEffect, useState } from 'react'
import { fetchMe, type MeProfile, type MeUser } from './auth-client'

export interface UseCurrentUserResult {
  user: MeUser | null
  profile: MeProfile | null
  loading: boolean
  error: Error | null
  refresh: () => Promise<void>
}

export function useCurrentUser(): UseCurrentUserResult {
  const [user, setUser] = useState<MeUser | null>(null)
  const [profile, setProfile] = useState<MeProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const me = await fetchMe()
      setUser(me?.user ?? null)
      setProfile(me?.user?.profile ?? null)
    } catch (e) {
      setError(e as Error)
      setUser(null)
      setProfile(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { user, profile, loading, error, refresh }
}
