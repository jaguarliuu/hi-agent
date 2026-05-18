import { NextResponse } from 'next/server';

export const ERROR_CODES = {
  RATE_LIMITED: { http: 429, message: '请求过于频繁，请稍后再试' },
  INVALID_INPUT: { http: 400, message: '入参不合法' },
  INVALID_OR_EXPIRED: { http: 410, message: '验证码错误或已过期' },
  UNAUTHORIZED: { http: 401, message: '未登录或会话已过期' },
  FORBIDDEN: { http: 403, message: '无权限' },
  ACCOUNT_DISABLED: { http: 423, message: '账号已停用' },
  NOT_IMPLEMENTED: { http: 501, message: '功能尚未上线' },
  INTERNAL: { http: 500, message: '服务异常' }
} as const;

export type ErrorCode = keyof typeof ERROR_CODES;

export function jsonError(code: ErrorCode, extra?: Record<string, unknown>) {
  const def = ERROR_CODES[code];
  return NextResponse.json(
    { ok: false, code, message: def.message, ...extra },
    { status: def.http }
  );
}

export function jsonOk<T extends Record<string, unknown>>(data: T) {
  return NextResponse.json({ ok: true, ...data });
}
