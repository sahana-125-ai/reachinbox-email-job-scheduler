import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';
import type { EmailRecord, EmailStatus } from './types.ts';

const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'reachinbox.sqlite');
const db = new DatabaseSync(dbPath);

// Enable WAL mode for high concurrency
try {
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA synchronous = NORMAL;');
} catch (err) {
  console.warn('[DB] WAL mode notice:', err);
}

export function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS emails (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      recipient_email TEXT NOT NULL,
      sender_email TEXT NOT NULL,
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      scheduled_at TEXT NOT NULL,
      scheduled_timestamp INTEGER NOT NULL,
      delay_between_emails_ms INTEGER DEFAULT 2000,
      hourly_limit INTEGER DEFAULT 20,
      sent_at TEXT,
      status TEXT NOT NULL,
      ethereal_message_id TEXT,
      ethereal_preview_url TEXT,
      error_message TEXT,
      job_id TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_emails_status ON emails(status);
    CREATE INDEX IF NOT EXISTS idx_emails_timestamp ON emails(scheduled_timestamp);
    CREATE INDEX IF NOT EXISTS idx_emails_sender ON emails(sender_email);
    CREATE INDEX IF NOT EXISTS idx_emails_user ON emails(user_id);

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS hourly_rate_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sender_email TEXT NOT NULL,
      hour_window TEXT NOT NULL,
      sent_count INTEGER DEFAULT 0,
      last_updated TEXT NOT NULL,
      UNIQUE(sender_email, hour_window)
    );

    CREATE TABLE IF NOT EXISTS slack_config (
      user_id TEXT PRIMARY KEY,
      webhook_url TEXT NOT NULL,
      channel TEXT,
      connected_at TEXT NOT NULL
    );
  `);

  console.log('[DB] Relational SQLite database initialized at:', dbPath);
}

export function insertEmail(email: EmailRecord): void {
  const stmt = db.prepare(`
    INSERT INTO emails (
      id, user_id, recipient_email, sender_email, subject, body,
      scheduled_at, scheduled_timestamp, delay_between_emails_ms, hourly_limit,
      sent_at, status, ethereal_message_id, ethereal_preview_url, error_message, job_id, created_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?, ?
    )
  `);

  stmt.run(
    email.id,
    email.user_id,
    email.recipient_email,
    email.sender_email,
    email.subject,
    email.body,
    email.scheduled_at,
    email.scheduled_timestamp,
    email.delay_between_emails_ms,
    email.hourly_limit,
    email.sent_at,
    email.status,
    email.ethereal_message_id,
    email.ethereal_preview_url,
    email.error_message,
    email.job_id,
    email.created_at
  );
}

export function updateEmailStatus(
  id: string,
  status: EmailStatus,
  updates: {
    sent_at?: string;
    ethereal_message_id?: string;
    ethereal_preview_url?: string;
    error_message?: string;
    job_id?: string;
    scheduled_at?: string;
    scheduled_timestamp?: number;
  } = {}
): void {
  const current = getEmailById(id);
  if (!current) return;

  const sentAt = updates.sent_at !== undefined ? updates.sent_at : current.sent_at;
  const etherealMsgId = updates.ethereal_message_id !== undefined ? updates.ethereal_message_id : current.ethereal_message_id;
  const etherealPreviewUrl = updates.ethereal_preview_url !== undefined ? updates.ethereal_preview_url : current.ethereal_preview_url;
  const errorMsg = updates.error_message !== undefined ? updates.error_message : current.error_message;
  const jobId = updates.job_id !== undefined ? updates.job_id : current.job_id;
  const scheduledAt = updates.scheduled_at !== undefined ? updates.scheduled_at : current.scheduled_at;
  const scheduledTimestamp = updates.scheduled_timestamp !== undefined ? updates.scheduled_timestamp : current.scheduled_timestamp;

  const stmt = db.prepare(`
    UPDATE emails SET
      status = ?,
      sent_at = ?,
      ethereal_message_id = ?,
      ethereal_preview_url = ?,
      error_message = ?,
      job_id = ?,
      scheduled_at = ?,
      scheduled_timestamp = ?
    WHERE id = ?
  `);

  stmt.run(
    status,
    sentAt,
    etherealMsgId,
    etherealPreviewUrl,
    errorMsg,
    jobId,
    scheduledAt,
    scheduledTimestamp,
    id
  );
}

export function getEmailById(id: string): EmailRecord | null {
  const stmt = db.prepare(`SELECT * FROM emails WHERE id = ?`);
  const row = stmt.get(id) as unknown as EmailRecord | undefined;
  return row || null;
}

export function getScheduledEmails(limit = 100, offset = 0): EmailRecord[] {
  const stmt = db.prepare(`
    SELECT * FROM emails 
    WHERE status IN ('scheduled', 'processing')
    ORDER BY scheduled_timestamp ASC 
    LIMIT ? OFFSET ?
  `);
  return stmt.all(limit, offset) as unknown as EmailRecord[];
}

export function getSentEmails(limit = 100, offset = 0): EmailRecord[] {
  const stmt = db.prepare(`
    SELECT * FROM emails 
    WHERE status IN ('sent', 'failed')
    ORDER BY COALESCE(sent_at, created_at) DESC 
    LIMIT ? OFFSET ?
  `);
  return stmt.all(limit, offset) as unknown as EmailRecord[];
}

export function getAllEmails(): EmailRecord[] {
  const stmt = db.prepare(`SELECT * FROM emails ORDER BY created_at DESC`);
  return stmt.all() as unknown as EmailRecord[];
}

export function deleteEmail(id: string): boolean {
  const stmt = db.prepare(`DELETE FROM emails WHERE id = ?`);
  const result = stmt.run(id);
  return result.changes > 0;
}

export function getPendingScheduledForRecovery(): EmailRecord[] {
  const stmt = db.prepare(`
    SELECT * FROM emails 
    WHERE status = 'scheduled'
    ORDER BY scheduled_timestamp ASC
  `);
  return stmt.all() as unknown as EmailRecord[];
}

export function getSetting(key: string): string | null {
  const stmt = db.prepare(`SELECT value FROM settings WHERE key = ?`);
  const row = stmt.get(key) as unknown as { value: string } | undefined;
  return row ? row.value : null;
}

export function setSetting(key: string, value: string): void {
  const stmt = db.prepare(`
    INSERT INTO settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `);
  stmt.run(key, value);
}

export function getSlackConfig(userId: string): { webhook_url: string; channel?: string; connected_at: string } | null {
  const stmt = db.prepare(`SELECT * FROM slack_config WHERE user_id = ?`);
  const row = stmt.get(userId) as unknown as { webhook_url: string; channel?: string; connected_at: string } | undefined;
  return row || null;
}

export function saveSlackConfig(userId: string, webhookUrl: string, channel = '#general'): void {
  const stmt = db.prepare(`
    INSERT INTO slack_config (user_id, webhook_url, channel, connected_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      webhook_url = excluded.webhook_url,
      channel = excluded.channel,
      connected_at = excluded.connected_at
  `);
  stmt.run(userId, webhookUrl, channel, new Date().toISOString());
}

export function deleteSlackConfig(userId: string): void {
  const stmt = db.prepare(`DELETE FROM slack_config WHERE user_id = ?`);
  stmt.run(userId);
}

export function recordSentEmailInDb(senderEmail: string, hourWindow: string): number {
  const now = new Date().toISOString();
  db.exec(`
    INSERT INTO hourly_rate_logs (sender_email, hour_window, sent_count, last_updated)
    VALUES ('${senderEmail}', '${hourWindow}', 1, '${now}')
    ON CONFLICT(sender_email, hour_window) DO UPDATE SET
      sent_count = sent_count + 1,
      last_updated = '${now}'
  `);

  const stmt = db.prepare(`SELECT sent_count FROM hourly_rate_logs WHERE sender_email = ? AND hour_window = ?`);
  const row = stmt.get(senderEmail, hourWindow) as { sent_count: number } | undefined;
  return row?.sent_count || 1;
}

export function getHourlyCountFromDb(senderEmail: string, hourWindow: string): number {
  const stmt = db.prepare(`SELECT sent_count FROM hourly_rate_logs WHERE sender_email = ? AND hour_window = ?`);
  const row = stmt.get(senderEmail, hourWindow) as { sent_count: number } | undefined;
  return row?.sent_count || 0;
}
