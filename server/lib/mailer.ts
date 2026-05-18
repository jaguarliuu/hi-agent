import nodemailer from 'nodemailer';

let cached: ReturnType<typeof nodemailer.createTransport> | null = null;

function getTransport() {
  if (cached) return cached;
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host) throw new Error('SMTP_HOST is not set');
  if (!user) throw new Error('SMTP_USER is not set');
  if (!pass) throw new Error('SMTP_PASS is not set');
  cached = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT || '465'),
    secure: process.env.SMTP_SECURE !== 'false',
    auth: { user, pass }
  });
  return cached;
}

export async function sendOtpEmail(to: string, code: string) {
  const from = process.env.SMTP_FROM || 'noreply@example.com';
  const subject = `【Hi-Agent】你的登录验证码：${code}`;
  const text = [
    `你的 Hi-Agent 登录验证码是：${code}`,
    '',
    '验证码 10 分钟内有效，请勿向他人转述。',
    '如非本人操作，请忽略本邮件。',
    '',
    '— Hi-Agent'
  ].join('\n');
  await getTransport().sendMail({ from, to, subject, text });
}
