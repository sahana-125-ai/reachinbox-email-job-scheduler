import { getSlackConfig, saveSlackConfig, deleteSlackConfig, getSetting } from './db.ts';

export interface SlackRateLimitPayload {
  senderEmail: string;
  recipientEmail: string;
  hourlyLimit: number;
  currentCount: number;
  rescheduledTo: string;
  emailId: string;
  subject: string;
}

export async function sendSlackRateLimitNotification(
  userId: string,
  data: SlackRateLimitPayload
): Promise<{ sent: boolean; reason?: string }> {
  // 1. Get Slack configuration for this user or global fallback
  const userConfig = getSlackConfig(userId);
  const globalWebhook = process.env.SLACK_WEBHOOK_URL || getSetting('SLACK_WEBHOOK_URL');

  const webhookUrl = userConfig?.webhook_url || globalWebhook;

  if (!webhookUrl || !webhookUrl.trim()) {
    console.log(`[Slack] No Slack webhook configured for user ${userId}. Skipping notification safely.`);
    return { sent: false, reason: 'No Slack webhook configured' };
  }

  const payload = {
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '🚨 ReachInbox Rate Limit Reached',
          emoji: true,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Sender:*\n\`${data.senderEmail}\``,
          },
          {
            type: 'mrkdwn',
            text: `*Hourly Limit:*\n*${data.hourlyLimit} emails/hour*`,
          },
          {
            type: 'mrkdwn',
            text: `*Status:*\n*Rescheduled to next window*`,
          },
          {
            type: 'mrkdwn',
            text: `*Rescheduled Window:*\n${new Date(data.rescheduledTo).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
          },
        ],
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `Email to *${data.recipientEmail}* (*"${data.subject}"*) was held to preserve sender domain reputation and prevent ESP throttling. The job has been safely queued in BullMQ.`,
        },
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `ReachInbox Scheduler &bull; Job ID: \`${data.emailId}\` &bull; Timestamp: ${new Date().toISOString()}`,
          },
        ],
      },
    ],
  };

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Slack] Notification error (${response.status}):`, errorText);
      return { sent: false, reason: `Slack API responded with status ${response.status}` };
    }

    console.log(`[Slack] Successfully delivered rate limit alert to Slack for sender ${data.senderEmail}`);
    return { sent: true };
  } catch (err: any) {
    console.error('[Slack] Failed to send webhook:', err.message);
    return { sent: false, reason: err.message };
  }
}

export async function sendSlackTestMessage(webhookUrl: string, userEmail: string): Promise<{ success: boolean; message: string }> {
  if (!webhookUrl || !webhookUrl.startsWith('https://hooks.slack.com/')) {
    // Allow custom webhook endpoints too if user has one
    if (!webhookUrl.startsWith('http')) {
      return { success: false, message: 'Invalid URL. Slack webhooks must begin with https://' };
    }
  }

  const payload = {
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '✅ ReachInbox Slack Connection Verified',
          emoji: true,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `Your Slack webhook is successfully connected to **ReachInbox Email Job Scheduler** for account *${userEmail}*.\n\nYou will receive real-time notifications whenever a sender exceeds their configured hourly rate limit.`,
        },
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `Tested at ${new Date().toLocaleString()} &bull; ReachInbox Outbox Labs`,
          },
        ],
      },
    ],
  };

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await response.text();
      return { success: false, message: `Slack returned error HTTP ${response.status}: ${text}` };
    }

    return { success: true, message: 'Test message sent to Slack successfully!' };
  } catch (err: any) {
    return { success: false, message: `Connection error: ${err.message}` };
  }
}

export { getSlackConfig, saveSlackConfig, deleteSlackConfig };
