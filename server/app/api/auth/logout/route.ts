import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import {
  COOKIE_NAME,
  revokeSession,
  buildClearCookie,
  isSecureCookie
} from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const sid = req.cookies.get(COOKIE_NAME)?.value;
  if (sid) await revokeSession(sid);
  return new NextResponse(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': buildClearCookie({ secure: isSecureCookie() })
    }
  });
}
