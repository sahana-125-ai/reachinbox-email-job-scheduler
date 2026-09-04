export type EmailStatus = 'scheduled' | 'processing' | 'sent' | 'failed' | 'cancelled';

export interface EmailRecord {
  id: string;
  user_id: string;
  recipient_email: string;
  sender_email: string;
  subject: string;
  body: string;
  scheduled_at: string; // ISO string
  scheduled_timestamp: number; // Unix epoch ms
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

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  avatar: string;
  created_at: string;
  slack_webhook_url?: string;
  slack_channel?: string;
  slack_connected_at?: string;
}

export interface EmailJobData {
  emailId: string;
  userId: string;
  recipientEmail: string;
  senderEmail: string;
  subject: string;
  body: string;
  scheduledAt: string;
  delayBetweenEmailsMs: number;
  hourlyLimit: number;
  attempt?: number;
}

export interface QueueStats {
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

export interface SearchQuery {
  q?: string;
  status?: EmailStatus | 'all';
  sender?: string;
  recipient?: string;
  limit?: number;
  offset?: number;
}
