import { Queue, Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import {
  insertEmail,
  updateEmailStatus,
  getEmailById,
  getPendingScheduledForRecovery,
  recordSentEmailInDb,
  getSetting,
  setSetting,
} from './db.ts';
import { sendEmailViaEthereal } from './mailer.ts';
import { searchEngine } from './search.ts';
import { sendSlackRateLimitNotification } from './slack.ts';
import type { EmailJobData, EmailRecord, QueueStats } from './types.ts';

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

// Persistent Redis connections
export const redisConnection = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null,
  retryStrategy(times) {
    return Math.min(times * 200, 3000);
  },
  enableOfflineQueue: true,
});

redisConnection.on('error', (err: any) => {
  if (err?.code === 'ECONNREFUSED') {
    // Suppress unhandled crash while Redis connects/reconnects
    return;
  }
  console.warn('[Redis Connection Warning]:', err?.message || err);
});

export const redisClient = new Redis(REDIS_URL, {
  retryStrategy(times) {
    return Math.min(times * 200, 3000);
  },
  enableOfflineQueue: true,
});

redisClient.on('error', (err: any) => {
  if (err?.code === 'ECONNREFUSED') {
    return;
  }
  console.warn('[Redis Client Warning]:', err?.message || err);
});

export const QUEUE_NAME = 'reachinbox-email-queue';

export const emailQueue = new Queue<EmailJobData>(QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: false,
    removeOnFail: false,
  },
});

let emailWorker: Worker<EmailJobData> | null = null;
let currentConcurrency = parseInt(process.env.WORKER_CONCURRENCY || '5', 10);
let minDelayBetweenEmailsMs = parseInt(process.env.MIN_DELAY_BETWEEN_EMAILS_MS || '2000', 10);
let maxEmailsPerHourPerSender = parseInt(process.env.MAX_EMAILS_PER_HOUR_PER_SENDER || '20', 10);

// Helper: generate hour window identifier (e.g. "2026-09-04T15")
export function getHourWindowKey(date = new Date()): string {
  return date.toISOString().slice(0, 13);
}

// Check and record hourly rate limit per sender
export async function checkRateLimit(
  senderEmail: string,
  limit = maxEmailsPerHourPerSender
): Promise<{ allowed: boolean; currentCount: number; nextHourStartMs: number }> {
  const hourKey = getHourWindowKey();
  const redisKey = `ratelimit:${senderEmail}:${hourKey}`;

  // Atomically increment counter
  const count = await redisClient.incr(redisKey);
  if (count === 1) {
    // Set 2 hours expiration (7200 seconds)
    await redisClient.expire(redisKey, 7200);
  }

  // Calculate start of next hour window
  const now = new Date();
  const nextHour = new Date(now);
  nextHour.setMinutes(60, 0, 0);
  const nextHourStartMs = nextHour.getTime();

  if (count > limit) {
    return {
      allowed: false,
      currentCount: count,
      nextHourStartMs,
    };
  }

  // Also log in SQLite DB for durability and analytics
  recordSentEmailInDb(senderEmail, hourKey);

  return {
    allowed: true,
    currentCount: count,
    nextHourStartMs,
  };
}

// Helper: sender-level throttling to enforce delay between sends
async function enforceSenderDelay(senderEmail: string, requiredDelayMs: number) {
  if (requiredDelayMs <= 0) return;

  const key = `pacing:last_sent:${senderEmail}`;
  const lastSentStr = await redisClient.get(key);

  if (lastSentStr) {
    const lastSent = parseInt(lastSentStr, 10);
    const elapsed = Date.now() - lastSent;
    if (elapsed < requiredDelayMs) {
      const waitTime = requiredDelayMs - elapsed;
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }
  }

  await redisClient.set(key, Date.now().toString(), 'EX', 3600);
}

// Worker job processor
async function processEmailJob(job: Job<EmailJobData>): Promise<{ success: boolean; previewUrl?: string }> {
  const {
    emailId,
    userId,
    recipientEmail,
    senderEmail,
    subject,
    body,
    delayBetweenEmailsMs = minDelayBetweenEmailsMs,
    hourlyLimit = maxEmailsPerHourPerSender,
  } = job.data;

  console.log(`[Worker] Processing email job ${job.id} for ${recipientEmail} (ID: ${emailId})`);

  // 1. Check current status in DB to ensure idempotency
  const emailRecord = getEmailById(emailId);
  if (!emailRecord) {
    console.warn(`[Worker] Email record ${emailId} not found in DB. Skipping.`);
    return { success: false };
  }

  if (emailRecord.status === 'sent') {
    console.log(`[Worker] Email ${emailId} was already sent. Skipping duplicate execution.`);
    return { success: true, previewUrl: emailRecord.ethereal_preview_url || undefined };
  }

  if (emailRecord.status === 'cancelled') {
    console.log(`[Worker] Email ${emailId} was cancelled by user. Skipping.`);
    return { success: false };
  }

  // Update status to processing
  updateEmailStatus(emailId, 'processing', { job_id: job.id });

  // 2. Check Hourly Rate Limit
  const rlCheck = await checkRateLimit(senderEmail, hourlyLimit);

  if (!rlCheck.allowed) {
    console.warn(
      `[Worker] ⚠️ Hourly rate limit reached for sender ${senderEmail} (${rlCheck.currentCount}/${hourlyLimit}). Rescheduling job to next hour window.`
    );

    const now = Date.now();
    const delayUntilNextHour = Math.max(2000, rlCheck.nextHourStartMs - now + Math.floor(Math.random() * 2000));
    const rescheduledDate = new Date(now + delayUntilNextHour).toISOString();

    // Update DB record with rescheduled time
    updateEmailStatus(emailId, 'scheduled', {
      scheduled_at: rescheduledDate,
      scheduled_timestamp: now + delayUntilNextHour,
      error_message: `Hourly rate limit of ${hourlyLimit} reached. Rescheduled to next hour window.`,
    });

    const updatedRecord = getEmailById(emailId);
    if (updatedRecord) {
      searchEngine.indexEmail(updatedRecord);
    }

    // Schedule delayed job for the next hour window in BullMQ
    await emailQueue.add(
      'send-email',
      {
        ...job.data,
        attempt: (job.data.attempt || 1) + 1,
      },
      {
        delay: delayUntilNextHour,
        jobId: `${emailId}-retry-${rlCheck.nextHourStartMs}`,
      }
    );

    // Send real-time Slack notification!
    await sendSlackRateLimitNotification(userId, {
      senderEmail,
      recipientEmail,
      hourlyLimit,
      currentCount: rlCheck.currentCount,
      rescheduledTo: rescheduledDate,
      emailId,
      subject,
    });

    return { success: false };
  }

  // 3. Enforce minimum delay between sends (provider throttling simulation)
  await enforceSenderDelay(senderEmail, delayBetweenEmailsMs);

  // 4. Send Email via Ethereal SMTP
  try {
    const sendResult = await sendEmailViaEthereal({
      from: senderEmail,
      to: recipientEmail,
      subject,
      body,
    });

    const sentAt = new Date().toISOString();

    // 5. Update DB status and search index
    updateEmailStatus(emailId, 'sent', {
      sent_at: sentAt,
      ethereal_message_id: sendResult.messageId,
      ethereal_preview_url: sendResult.previewUrl || undefined,
      error_message: undefined,
    });

    const updatedRecord = getEmailById(emailId);
    if (updatedRecord) {
      searchEngine.indexEmail(updatedRecord);
    }

    console.log(`[Worker] ✅ Successfully delivered email ${emailId} to ${recipientEmail}`);
    return { success: true, previewUrl: sendResult.previewUrl || undefined };
  } catch (sendErr: any) {
    console.error(`[Worker] ❌ Failed to deliver email ${emailId}:`, sendErr.message);

    updateEmailStatus(emailId, 'failed', {
      error_message: sendErr.message,
    });

    const updatedRecord = getEmailById(emailId);
    if (updatedRecord) {
      searchEngine.indexEmail(updatedRecord);
    }

    throw sendErr;
  }
}

// Initialize worker with configurable concurrency
export function startWorker(concurrency = currentConcurrency): Worker<EmailJobData> {
  if (emailWorker) {
    emailWorker.close();
  }

  currentConcurrency = concurrency;
  console.log(`[Worker] Starting BullMQ Worker with concurrency = ${concurrency}`);

  emailWorker = new Worker<EmailJobData>(QUEUE_NAME, processEmailJob, {
    connection: redisConnection,
    concurrency,
  });

  emailWorker.on('completed', (job) => {
    console.log(`[Worker Event] Job ${job.id} completed.`);
  });

  emailWorker.on('failed', (job, err) => {
    console.error(`[Worker Event] Job ${job?.id} failed:`, err.message);
  });

  emailWorker.on('error', (err: any) => {
    if (err?.code === 'ECONNREFUSED' || (typeof err?.message === 'string' && err.message.includes('ECONNREFUSED'))) {
      // Redis is still starting or reconnecting; suppress loud stack traces
      return;
    }
    console.error(`[Worker Event] Worker runtime error:`, err?.message || err);
  });

  return emailWorker;
}

// Schedule an email (Delayed Job, NO CRON)
export async function scheduleEmail(data: {
  userId: string;
  recipientEmail: string;
  senderEmail: string;
  subject: string;
  body: string;
  scheduledAt: string; // ISO string
  delayBetweenEmailsMs?: number;
  hourlyLimit?: number;
}): Promise<EmailRecord> {
  const scheduledTimestamp = new Date(data.scheduledAt).getTime();
  const now = Date.now();
  const delayMs = Math.max(0, scheduledTimestamp - now);
  const emailId = `eml_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  const emailRecord: EmailRecord = {
    id: emailId,
    user_id: data.userId,
    recipient_email: data.recipientEmail.trim(),
    sender_email: data.senderEmail.trim(),
    subject: data.subject.trim(),
    body: data.body,
    scheduled_at: data.scheduledAt,
    scheduled_timestamp: scheduledTimestamp,
    delay_between_emails_ms: data.delayBetweenEmailsMs || minDelayBetweenEmailsMs,
    hourly_limit: data.hourlyLimit || maxEmailsPerHourPerSender,
    sent_at: null,
    status: 'scheduled',
    ethereal_message_id: null,
    ethereal_preview_url: null,
    error_message: null,
    job_id: emailId,
    created_at: new Date().toISOString(),
  };

  // 1. Insert into relational DB first (ACID)
  insertEmail(emailRecord);

  // 2. Index in Elasticsearch search engine
  searchEngine.indexEmail(emailRecord);

  // 3. Add to BullMQ delayed jobs with strict idempotency (jobId = emailId)
  const job = await emailQueue.add(
    'send-email',
    {
      emailId,
      userId: data.userId,
      recipientEmail: emailRecord.recipient_email,
      senderEmail: emailRecord.sender_email,
      subject: emailRecord.subject,
      body: emailRecord.body,
      scheduledAt: emailRecord.scheduled_at,
      delayBetweenEmailsMs: emailRecord.delay_between_emails_ms,
      hourlyLimit: emailRecord.hourly_limit,
    },
    {
      delay: delayMs,
      jobId: emailId,
    }
  );

  console.log(`[Queue] Added delayed job ${job.id} for email ${emailId} with delay: ${delayMs}ms (${Math.round(delayMs / 1000)}s)`);

  return emailRecord;
}

// Batch schedule multiple emails (from CSV / Leads upload)
export async function scheduleBatchEmails(params: {
  userId: string;
  senderEmail: string;
  recipients: string[];
  subject: string;
  body: string;
  startTime: string; // ISO string
  delayBetweenEmailsMs: number;
  hourlyLimit: number;
}): Promise<EmailRecord[]> {
  const results: EmailRecord[] = [];
  const baseTimestamp = new Date(params.startTime).getTime();
  const stepDelay = Math.max(500, params.delayBetweenEmailsMs);

  for (let i = 0; i < params.recipients.length; i++) {
    const recipient = params.recipients[i].trim();
    if (!recipient) continue;

    // Stagger each email by delayBetweenEmailsMs
    const emailScheduledTime = new Date(baseTimestamp + i * stepDelay).toISOString();

    // Replace {{email}} placeholder in body/subject if present
    const personalizedBody = params.body
      .replace(/{{email}}/gi, recipient)
      .replace(/{{name}}/gi, recipient.split('@')[0]);

    const personalizedSubject = params.subject
      .replace(/{{email}}/gi, recipient)
      .replace(/{{name}}/gi, recipient.split('@')[0]);

    const scheduled = await scheduleEmail({
      userId: params.userId,
      recipientEmail: recipient,
      senderEmail: params.senderEmail,
      subject: personalizedSubject,
      body: personalizedBody,
      scheduledAt: emailScheduledTime,
      delayBetweenEmailsMs: params.delayBetweenEmailsMs,
      hourlyLimit: params.hourlyLimit,
    });

    results.push(scheduled);
  }

  return results;
}

// Cancel a scheduled email
export async function cancelScheduledEmail(emailId: string): Promise<boolean> {
  const email = getEmailById(emailId);
  if (!email || email.status !== 'scheduled') {
    return false;
  }

  // Remove job from BullMQ if present
  try {
    const job = await emailQueue.getJob(emailId);
    if (job) {
      await job.remove();
    }
  } catch (err) {
    console.warn(`[Queue] Could not remove BullMQ job ${emailId}:`, err);
  }

  updateEmailStatus(emailId, 'cancelled');
  const updated = getEmailById(emailId);
  if (updated) {
    searchEngine.indexEmail(updated);
  }
  return true;
}

// Force send now
export async function sendEmailNow(emailId: string): Promise<boolean> {
  const email = getEmailById(emailId);
  if (!email || email.status !== 'scheduled') {
    return false;
  }

  // Remove existing delayed job
  try {
    const job = await emailQueue.getJob(emailId);
    if (job) {
      await job.remove();
    }
  } catch {}

  // Add immediate job
  await emailQueue.add(
    'send-email',
    {
      emailId: email.id,
      userId: email.user_id,
      recipientEmail: email.recipient_email,
      senderEmail: email.sender_email,
      subject: email.subject,
      body: email.body,
      scheduledAt: new Date().toISOString(),
      delayBetweenEmailsMs: 0,
      hourlyLimit: email.hourly_limit,
    },
    {
      delay: 0,
      jobId: `${emailId}-now-${Date.now()}`,
    }
  );

  return true;
}

// Persistence on restart: Reconcile pending scheduled emails from DB into Redis
export async function reconcilePendingJobsOnRestart(): Promise<{ restored: number; existing: number }> {
  console.log('[Recovery] Checking for scheduled emails in DB to restore into BullMQ...');
  const pendingEmails = getPendingScheduledForRecovery();
  let restored = 0;
  let existing = 0;

  for (const email of pendingEmails) {
    try {
      const existingJob = await emailQueue.getJob(email.id);
      if (!existingJob) {
        const remainingDelay = Math.max(0, email.scheduled_timestamp - Date.now());
        await emailQueue.add(
          'send-email',
          {
            emailId: email.id,
            userId: email.user_id,
            recipientEmail: email.recipient_email,
            senderEmail: email.sender_email,
            subject: email.subject,
            body: email.body,
            scheduledAt: email.scheduled_at,
            delayBetweenEmailsMs: email.delay_between_emails_ms,
            hourlyLimit: email.hourly_limit,
          },
          {
            delay: remainingDelay,
            jobId: email.id,
          }
        );
        restored++;
      } else {
        existing++;
      }
    } catch (err: any) {
      console.warn(`[Recovery] Error verifying job ${email.id}:`, err.message);
    }
  }

  console.log(`[Recovery] Reconciliation complete: ${restored} jobs restored, ${existing} jobs persisted in Redis.`);
  return { restored, existing };
}

// Real-time Queue Telemetry Stats
export async function getQueueTelemetry(): Promise<QueueStats> {
  const [waiting, active, delayed, completed, failed, isPaused] = await Promise.all([
    emailQueue.getWaitingCount(),
    emailQueue.getActiveCount(),
    emailQueue.getDelayedCount(),
    emailQueue.getCompletedCount(),
    emailQueue.getFailedCount(),
    emailQueue.isPaused(),
  ]);

  return {
    waiting,
    active,
    delayed,
    completed,
    failed,
    paused: isPaused,
    concurrency: currentConcurrency,
    minDelayMs: minDelayBetweenEmailsMs,
    maxEmailsPerHour: maxEmailsPerHourPerSender,
    workerActive: emailWorker !== null && !emailWorker.isPaused(),
  };
}

export function updateSchedulerSettings(settings: {
  concurrency?: number;
  minDelayMs?: number;
  maxEmailsPerHour?: number;
}): void {
  if (settings.concurrency && settings.concurrency !== currentConcurrency) {
    currentConcurrency = settings.concurrency;
    setSetting('WORKER_CONCURRENCY', currentConcurrency.toString());
    startWorker(currentConcurrency);
  }

  if (settings.minDelayMs !== undefined) {
    minDelayBetweenEmailsMs = settings.minDelayMs;
    setSetting('MIN_DELAY_BETWEEN_EMAILS_MS', minDelayBetweenEmailsMs.toString());
  }

  if (settings.maxEmailsPerHour !== undefined) {
    maxEmailsPerHourPerSender = settings.maxEmailsPerHour;
    setSetting('MAX_EMAILS_PER_HOUR_PER_SENDER', maxEmailsPerHourPerSender.toString());
  }
}
