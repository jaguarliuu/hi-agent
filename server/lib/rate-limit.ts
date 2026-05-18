import { prisma } from '@/lib/db';

interface Entry {
  count: number;
  expiresAt: number;
}

export class LruCounter {
  private map = new Map<string, Entry>();
  constructor(private opts: { max: number }) {}
  hit(key: string, windowMs: number): number {
    const now = Date.now();
    const cur = this.map.get(key);
    if (cur && cur.expiresAt > now) {
      cur.count += 1;
      this.map.delete(key);
      this.map.set(key, cur);
      return cur.count;
    }
    if (this.map.size >= this.opts.max) {
      const oldest = this.map.keys().next().value;
      if (oldest !== undefined) this.map.delete(oldest);
    }
    const entry: Entry = { count: 1, expiresAt: now + windowMs };
    this.map.set(key, entry);
    return 1;
  }
}

const ipCounter = new LruCounter({ max: 4096 });

export function ipHit(ip: string): number {
  return ipCounter.hit(`ip:${ip}`, 60_000);
}

export async function checkEmailOtpQuota(email: string): Promise<string | null> {
  const now = new Date();
  const oneMinAgo = new Date(now.getTime() - 60_000);
  const oneHourAgo = new Date(now.getTime() - 3_600_000);
  const oneDayAgo = new Date(now.getTime() - 86_400_000);
  const [last60s, lastHour, lastDay] = await Promise.all([
    prisma.emailOtp.count({
      where: { email, purpose: 'login', createdAt: { gte: oneMinAgo } }
    }),
    prisma.emailOtp.count({
      where: { email, purpose: 'login', createdAt: { gte: oneHourAgo } }
    }),
    prisma.emailOtp.count({
      where: { email, purpose: 'login', createdAt: { gte: oneDayAgo } }
    })
  ]);
  if (last60s >= 1) return '60 秒内只能发送一次';
  if (lastHour >= 5) return '1 小时内已达上限';
  if (lastDay >= 10) return '24 小时内已达上限';
  return null;
}

export async function checkVerifyAbuse(email: string): Promise<boolean> {
  const oneHourAgo = new Date(Date.now() - 3_600_000);
  const failed = await prisma.emailOtp.count({
    where: {
      email,
      purpose: 'login',
      createdAt: { gte: oneHourAgo },
      attempts: { gte: 5 }
    }
  });
  return failed >= 20;
}
