import { jsonError } from '@/lib/errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return jsonError('NOT_IMPLEMENTED', { provider: 'wechat', stage: 'start' });
}
