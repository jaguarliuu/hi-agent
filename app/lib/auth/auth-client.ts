export type ErrorCode =
  | 'RATE_LIMITED'
  | 'INVALID_INPUT'
  | 'INVALID_OR_EXPIRED'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'ACCOUNT_DISABLED'
  | 'NOT_IMPLEMENTED'
  | 'INTERNAL'

export class AuthError extends Error {
  code: ErrorCode
  status: number
  detail: Record<string, unknown>
  constructor(code: ErrorCode, status: number, detail: Record<string, unknown> = {}) {
    super(code)
    this.name = 'AuthError'
    this.code = code
    this.status = status
    this.detail = detail
  }
}

export interface MeUser {
  id: string
  email: string
  role?: string
  profile?: MeProfile | null
}

export interface MeProfile {
  displayName: string | null
  avatarUrl: string | null
  bio?: string | null
  locale?: string | null
  timezone?: string | null
  customFields?: Record<string, unknown> | null
}

export interface MeResponse {
  ok: true
  user: MeUser
}

export interface VerifyOtpResponse {
  ok: true
  user: { id: string; email: string }
  isNew?: boolean
}

const BASE = '/api/auth'

const KNOWN_CODES = [
  'RATE_LIMITED',
  'INVALID_INPUT',
  'INVALID_OR_EXPIRED',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'ACCOUNT_DISABLED',
  'NOT_IMPLEMENTED',
  'INTERNAL'
] as const satisfies readonly ErrorCode[]

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json', 'x-requested-with': 'fetch' },
    body: JSON.stringify(body)
  })
  return parse<T>(res)
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'GET',
    credentials: 'include',
    headers: { 'x-requested-with': 'fetch' }
  })
  return parse<T>(res)
}

async function parse<T>(res: Response): Promise<T> {
  let data: Record<string, unknown> | null = null
  try {
    data = (await res.json()) as Record<string, unknown>
  } catch {
    /* ignore */
  }
  if (!res.ok) {
    const raw = data?.code
    const code: ErrorCode =
      typeof raw === 'string' && (KNOWN_CODES as readonly string[]).includes(raw)
        ? (raw as ErrorCode)
        : 'INTERNAL'
    throw new AuthError(code, res.status, data ?? {})
  }
  return data as unknown as T
}

export async function requestOtp(email: string): Promise<{ ok: true }> {
  return postJson<{ ok: true }>('/otp/request', { email })
}

export async function verifyOtp(email: string, code: string): Promise<VerifyOtpResponse> {
  return postJson<VerifyOtpResponse>('/otp/verify', { email, code })
}

export async function fetchMe(): Promise<MeResponse | null> {
  try {
    return await getJson<MeResponse>('/me')
  } catch (e) {
    if (e instanceof AuthError && e.code === 'UNAUTHORIZED') return null
    throw e
  }
}

export async function logout(): Promise<{ ok: true }> {
  return postJson<{ ok: true }>('/logout', {})
}
