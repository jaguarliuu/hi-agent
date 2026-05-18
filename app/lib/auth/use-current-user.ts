'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
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
  const mountedRef = useRef(true)
  const reqIdRef = useRef(0)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const refresh = useCallback(async () => {
    const myId = ++reqIdRef.current
    if (mountedRef.current) {
      setLoading(true)
      setError(null)
    }
    try {
      const me = await fetchMe()
      if (!mountedRef.current || myId !== reqIdRef.current) return
      setUser(me?.user ?? null)
      setProfile(me?.user?.profile ?? null)
    } catch (e) {
      if (!mountedRef.current || myId !== reqIdRef.current) return
      setError(e as Error)
      setUser(null)
      setProfile(null)
    } finally {
      if (mountedRef.current && myId === reqIdRef.current) {
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { user, profile, loading, error, refresh }
}
