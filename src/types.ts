export type EmailStatus = 'scheduled' | 'processing' | 'sent' | 'failed' | 'cancelled';

export interface EmailItem {
  id: string;
  user_id: string;
  recipient_email: string;
  sender_email: string;
  subject: string;
  body: string;
  scheduled_at: string;
  scheduled_timestamp: number;
  delay_between_emails_ms: number;
  hourly_limit: number;
  sent_at: string | null;
  status: EmailStatus;
  ethereal_message_id: string | null;
  ethereal_preview_url: string | null;
  error_message: string | null;
  job_id: string | null;
  created_at: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  avatar: string;
  role?: string;
}

export interface QueueTelemetry {
  waiting: number;
  active: number;
  delayed: number;
  completed: number;
  failed: number;
  paused: boolean;
  concurrency: number;
  minDelayMs: number;
  maxEmailsPerHour: number;
  workerActive: boolean;
}

export interface SlackConfig {
  connected: boolean;
  webhook_url: string;
  channel: string;
  connected_at: string | null;
}

export interface EtherealAccount {
  user: string;
  webUrl: string;
  smtpHost: string;
  smtpPort: number;
}
