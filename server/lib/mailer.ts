import nodemailer from 'nodemailer';

let cached: ReturnType<typeof nodemailer.createTransport> | null = null;

function getTransport() {
  if (cached) return cached;
  cached = nodemailer.createTransport({
    host: process.env.SMTP_HOST!,
    port: Number(process.env.SMTP_PORT || '465'),
    secure: process.env.SMTP_SECURE !== 'false',
    auth: { user: process.env.SMTP_USER!, pass: process.env.SMTP_PASS! }
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
