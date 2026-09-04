import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { getSetting, setSetting } from './db.ts';

let transporter: Transporter | null = null;
let etherealCredentials: { user: string; pass: string; webUrl?: string } | null = null;

export async function initMailer(): Promise<{ user: string; pass: string; webUrl?: string }> {
  if (transporter && etherealCredentials) {
    return etherealCredentials;
  }

  // 1. Check environment variables
  let user = process.env.ETHEREAL_USER || getSetting('ETHEREAL_USER');
  let pass = process.env.ETHEREAL_PASS || getSetting('ETHEREAL_PASS');

  // 2. If no valid credentials, auto-generate fresh Ethereal test account
  if (!user || !pass) {
    console.log('[Mailer] Creating fresh Ethereal test account...');
    try {
      const testAccount = await nodemailer.createTestAccount();
      user = testAccount.user;
      pass = testAccount.pass;
      const webUrl = `https://ethereal.email/messages`;

      setSetting('ETHEREAL_USER', user);
      setSetting('ETHEREAL_PASS', pass);
      setSetting('ETHEREAL_WEB_URL', webUrl);

      etherealCredentials = { user, pass, webUrl };
      console.log(`[Mailer] Ethereal account created: ${user}`);
    } catch (err) {
      console.error('[Mailer] Failed to create Ethereal account, falling back to mock transport:', err);
      // Fallback
      user = 'test@ethereal.email';
      pass = 'testpassword';
      etherealCredentials = { user, pass };
    }
  } else {
    etherealCredentials = {
      user,
      pass,
      webUrl: getSetting('ETHEREAL_WEB_URL') || `https://ethereal.email/messages`,
    };
  }

  transporter = nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false,
    auth: {
      user,
      pass,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });

  return etherealCredentials;
}

export async function getMailerCredentials() {
  if (!etherealCredentials) {
    await initMailer();
  }
  return etherealCredentials;
}

export async function sendEmailViaEthereal(options: {
  from: string;
  to: string;
  subject: string;
  body: string;
}): Promise<{ messageId: string; previewUrl: string | null }> {
  if (!transporter) {
    await initMailer();
  }

  const fromAddress = options.from.includes('<')
    ? options.from
    : `"${options.from.split('@')[0]}" <${options.from}>`;

  const info = await transporter!.sendMail({
    from: fromAddress,
    to: options.to,
    subject: options.subject,
    text: options.body,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <div style="border-bottom: 2px solid #6366f1; padding-bottom: 12px; margin-bottom: 20px;">
          <h2 style="margin: 0; color: #1e293b; font-size: 20px;">${escapeHtml(options.subject)}</h2>
          <div style="color: #64748b; font-size: 13px; margin-top: 4px;">
            From: <strong>${escapeHtml(options.from)}</strong> &bull; To: <strong>${escapeHtml(options.to)}</strong>
          </div>
        </div>
        <div style="color: #334155; line-height: 1.6; font-size: 15px; white-space: pre-wrap;">
${escapeHtml(options.body)}
        </div>
        <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; display: flex; justify-content: space-between;">
          <span>Sent via <strong>ReachInbox Email Scheduler</strong></span>
          <span>SMTP Engine: Ethereal Mail</span>
        </div>
      </div>
    `,
  });

  const previewUrl = nodemailer.getTestMessageUrl(info) || null;
  console.log(`[Mailer] Sent email to ${options.to}. MessageId: ${info.messageId}`);
  if (previewUrl) {
    console.log(`[Mailer] 🔗 Ethereal preview: ${previewUrl}`);
  }

  return {
    messageId: info.messageId,
    previewUrl,
  };
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
