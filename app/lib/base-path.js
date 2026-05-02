export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || ''

export function withBase(path) {
  if (!path) return path
  if (/^https?:\/\//.test(path)) return path
  if (!path.startsWith('/')) path = '/' + path
  return BASE_PATH + path
}
