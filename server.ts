import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { createServer as createViteServer } from 'vite';

import {
  initDb,
  getScheduledEmails,
  getSentEmails,
  getAllEmails,
  getEmailById,
  deleteEmail,
  getSlackConfig,
  saveSlackConfig,
  deleteSlackConfig,
  getSetting,
  setSetting,
} from './server/db.ts';
import { initMailer, getMailerCredentials } from './server/mailer.ts';
import { searchEngine } from './server/search.ts';
import {
  startWorker,
  scheduleEmail,
  scheduleBatchEmails,
  cancelScheduledEmail,
  sendEmailNow,
  reconcilePendingJobsOnRestart,
  getQueueTelemetry,
  updateSchedulerSettings,
  redisClient,
} from './server/queue.ts';
import { setupBullBoard } from './server/bullboard.ts';
import { sendSlackTestMessage } from './server/slack.ts';

// Auto-start redis-server if not running
function ensureRedisRunning() {
  try {
    execSync('redis-cli ping', { stdio: 'ignore' });
    console.log('[Redis] Redis server is active and reachable.');
    return;
  } catch {
    // Redis ping failed, attempt to start
  }

  if (process.platform === 'win32') {
    console.log('[Redis] Note for Windows: If Redis is not running locally, install Memurai or run: docker run -d -p 6379:6379 redis');
    return;
  }

  try {
    console.log('[Redis] Redis not responding. Attempting daemon launch...');
    execSync('redis-server --daemonize yes', { stdio: 'inherit' });
    execSync('redis-cli ping', { stdio: 'ignore' });
    console.log('[Redis] Redis daemon launched successfully.');
  } catch (e: any) {
    try {
      console.log('[Redis] redis-server binary missing. Installing via apt-get...');
      execSync('apt-get update && apt-get install -y redis-server', { stdio: 'ignore' });
      execSync('redis-server --daemonize yes', { stdio: 'inherit' });
      execSync('redis-cli ping', { stdio: 'ignore' });
      console.log('[Redis] Redis installed and daemon launched successfully.');
    } catch (installErr: any) {
      console.warn('[Redis] Warning launching or installing redis:', installErr?.message || e?.message);
    }
  }
}

ensureRedisRunning();

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Initialise DB and Search Index
initDb();
const existingEmails = getAllEmails();
for (const em of existingEmails) {
  searchEngine.indexEmail(em);
}
console.log(`[Search] Indexed ${existingEmails.length} existing emails into search engine.`);

// Initialize Mailer & Queue Worker
initMailer().catch(console.error);
startWorker();
reconcilePendingJobsOnRestart().catch(console.error);

// Mount Bull Board Live UI
try {
  const bullBoardRouter = setupBullBoard();
  app.use('/admin/queues', bullBoardRouter);
  console.log('[BullBoard] Live BullMQ dashboard mounted at /admin/queues');
} catch (err: any) {
  console.warn('[BullBoard] Setup warning:', err.message);
}

// -------------------------------------------------------------
// API Endpoints
// -------------------------------------------------------------

// Health check
app.get('/api/health', async (req, res) => {
  let redisOk = false;
  try {
    const pong = await redisClient.ping();
    redisOk = pong === 'PONG';
  } catch {}

  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    redis: redisOk,
    db: 'sqlite-wal',
    service: 'ReachInbox Email Job Scheduler',
  });
});

// Current user profile
app.get('/api/auth/me', (req, res) => {
  const savedUserJson = getSetting('CURRENT_USER');
  if (savedUserJson && savedUserJson.trim().length > 0) {
    try {
      const parsed = JSON.parse(savedUserJson);
      if (parsed && parsed.email) {
        return res.json({ user: parsed });
      }
    } catch {
      // Invalid json
    }
  }

  // Not logged in: return null so frontend renders AuthScreen/Login Page
  res.json({ user: null });
});

// Google login / session set
app.post('/api/auth/login', (req, res) => {
  const { name, email, avatar, id } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  const user = {
    id: id || `usr_${Date.now()}`,
    name: name || email.split('@')[0],
    email: email.trim(),
    avatar: avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(email)}`,
    role: 'Campaign Manager',
  };

  setSetting('CURRENT_USER', JSON.stringify(user));
  res.json({ success: true, user });
});

app.post('/api/auth/logout', (req, res) => {
  setSetting('CURRENT_USER', '');
  res.json({ success: true });
});

// Schedule Email(s)
app.post('/api/emails/schedule', async (req, res) => {
  try {
    const {
      userId = 'usr_reachinbox_default',
      senderEmail = 'outreach@reachinbox.ai',
      recipients, // array of email strings or single string
      subject,
      body,
      startTime = new Date().toISOString(),
      delayBetweenEmailsMs = 2000,
      hourlyLimit = 20,
    } = req.body;

    if (!recipients || (!Array.isArray(recipients) && typeof recipients !== 'string')) {
      return res.status(400).json({ error: 'Recipients list is required' });
    }

    if (!subject || !body) {
      return res.status(400).json({ error: 'Subject and Body are required' });
    }

    const emailList: string[] = (Array.isArray(recipients) ? recipients : [recipients])
      .map((e: string) => e.trim())
      .filter((e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));

    if (emailList.length === 0) {
      return res.status(400).json({ error: 'No valid email addresses provided' });
    }

    const scheduledRecords = await scheduleBatchEmails({
      userId,
      senderEmail,
      recipients: emailList,
      subject,
      body,
      startTime,
      delayBetweenEmailsMs: Number(delayBetweenEmailsMs) || 2000,
      hourlyLimit: Number(hourlyLimit) || 20,
    });

    res.json({
      success: true,
      count: scheduledRecords.length,
      emails: scheduledRecords,
      message: `Successfully scheduled ${scheduledRecords.length} email(s) via BullMQ delayed jobs.`,
    });
  } catch (err: any) {
    console.error('[API] Error scheduling emails:', err);
    res.status(500).json({ error: err.message || 'Failed to schedule emails' });
  }
});

// Get Scheduled Emails
app.get('/api/emails/scheduled', (req, res) => {
  const { q, sender, limit = '100', offset = '0' } = req.query;

  if (q || sender) {
    const searchResults = searchEngine.search({
      q: q ? String(q) : undefined,
      status: 'scheduled',
      sender: sender ? String(sender) : undefined,
      limit: Number(limit),
      offset: Number(offset),
    });
    return res.json({
      total: searchResults.total,
      emails: searchResults.hits.map((h) => h.email),
    });
  }

  const emails = getScheduledEmails(Number(limit), Number(offset));
  res.json({ total: emails.length, emails });
});

// Get Sent Emails
app.get('/api/emails/sent', (req, res) => {
  const { q, sender, limit = '100', offset = '0' } = req.query;

  if (q || sender) {
    const searchResults = searchEngine.search({
      q: q ? String(q) : undefined,
      status: 'sent',
      sender: sender ? String(sender) : undefined,
      limit: Number(limit),
      offset: Number(offset),
    });
    return res.json({
      total: searchResults.total,
      emails: searchResults.hits.map((h) => h.email),
    });
  }

  const emails = getSentEmails(Number(limit), Number(offset));
  res.json({ total: emails.length, emails });
});

// Cancel a scheduled email
app.post('/api/emails/:id/cancel', async (req, res) => {
  const { id } = req.params;
  const success = await cancelScheduledEmail(id);
  if (success) {
    res.json({ success: true, message: 'Scheduled email cancelled.' });
  } else {
    res.status(404).json({ error: 'Email not found or cannot be cancelled' });
  }
});

// Force send now
app.post('/api/emails/:id/send-now', async (req, res) => {
  const { id } = req.params;
  const success = await sendEmailNow(id);
  if (success) {
    res.json({ success: true, message: 'Email queued for immediate sending.' });
  } else {
    res.status(404).json({ error: 'Email not found or not in scheduled state' });
  }
});

// Elasticsearch compatible endpoint
app.get('/api/search', (req, res) => {
  const { q, status, sender, recipient, limit, offset } = req.query;
  const result = searchEngine.search({
    q: q ? String(q) : undefined,
    status: status as any,
    sender: sender ? String(sender) : undefined,
    recipient: recipient ? String(recipient) : undefined,
    limit: limit ? Number(limit) : 50,
    offset: offset ? Number(offset) : 0,
  });
  res.json(result);
});

app.post('/api/es/emails/_search', (req, res) => {
  const body = req.body || {};
  let q: string | undefined = undefined;

  if (body.query?.match) {
    const matchKey = Object.keys(body.query.match)[0];
    q = body.query.match[matchKey];
  } else if (body.query?.query_string?.query) {
    q = body.query.query_string.query;
  }

  const esResponse = searchEngine.toElasticsearchResponse({
    q,
    limit: body.size || 50,
    offset: body.from || 0,
  });

  res.json(esResponse);
});

// Real-time Queue Telemetry
app.get('/api/queue/stats', async (req, res) => {
  try {
    const stats = await getQueueTelemetry();
    res.json(stats);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update Queue Settings (concurrency, delays, limits)
app.post('/api/queue/settings', (req, res) => {
  const { concurrency, minDelayMs, maxEmailsPerHour } = req.body;
  updateSchedulerSettings({
    concurrency: concurrency ? Number(concurrency) : undefined,
    minDelayMs: minDelayMs !== undefined ? Number(minDelayMs) : undefined,
    maxEmailsPerHour: maxEmailsPerHour !== undefined ? Number(maxEmailsPerHour) : undefined,
  });
  res.json({ success: true, message: 'Scheduler settings updated successfully.' });
});

// Seed sample leads for quick demo testing
app.post('/api/queue/seed-demo', async (req, res) => {
  const sampleLeads = [
    'alex.morgan@techcorp.io',
    'sarah.connor@cyberdynesystems.com',
    'david.fincher@outboxstudios.com',
    'elena.rostova@cloudscale.net',
    'marcus.vance@reachinbox.ai',
  ];

  try {
    const scheduled = await scheduleBatchEmails({
      userId: 'usr_reachinbox_default',
      senderEmail: 'outreach@reachinbox.ai',
      recipients: sampleLeads,
      subject: 'Quick chat regarding AI cold outreach for {{name}}?',
      body: 'Hi {{name}},\n\nI noticed your team is scaling SDR workflows. ReachInbox automates high-intent prospecting and sequence deliverability.\n\nWould you be open to a 10-minute coffee chat this Thursday?\n\nBest,\nSahana\nReachInbox Outreach',
      startTime: new Date(Date.now() + 3000).toISOString(),
      delayBetweenEmailsMs: 2500,
      hourlyLimit: 5,
    });

    res.json({ success: true, count: scheduled.length, message: `Seeded ${scheduled.length} test leads!` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Slack config endpoints
app.get('/api/slack/config', (req, res) => {
  const userId = (req.query.userId as string) || 'usr_reachinbox_default';
  const config = getSlackConfig(userId);
  const globalWebhook = process.env.SLACK_WEBHOOK_URL || getSetting('SLACK_WEBHOOK_URL');

  res.json({
    connected: Boolean(config?.webhook_url || globalWebhook),
    webhook_url: config?.webhook_url || globalWebhook || '',
    channel: config?.channel || '#general',
    connected_at: config?.connected_at || null,
  });
});

app.post('/api/slack/connect', (req, res) => {
  const { userId = 'usr_reachinbox_default', webhookUrl, channel = '#general' } = req.body;
  if (!webhookUrl) {
    return res.status(400).json({ error: 'Webhook URL is required' });
  }

  saveSlackConfig(userId, webhookUrl.trim(), channel.trim());
  setSetting('SLACK_WEBHOOK_URL', webhookUrl.trim());

  res.json({ success: true, message: 'Slack integration connected successfully.' });
});

app.post('/api/slack/disconnect', (req, res) => {
  const { userId = 'usr_reachinbox_default' } = req.body;
  deleteSlackConfig(userId);
  setSetting('SLACK_WEBHOOK_URL', '');
  res.json({ success: true, message: 'Slack disconnected.' });
});

app.post('/api/slack/test', async (req, res) => {
  const { webhookUrl, email = 'sahanaksalimathsahana@gmail.com' } = req.body;
  const result = await sendSlackTestMessage(webhookUrl, email);
  res.json(result);
});

// Ethereal SMTP test credentials
app.get('/api/ethereal/account', async (req, res) => {
  try {
    const creds = await getMailerCredentials();
    res.json({
      user: creds?.user,
      webUrl: creds?.webUrl || 'https://ethereal.email/messages',
      smtpHost: 'smtp.ethereal.email',
      smtpPort: 587,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// Vite Middleware / Static Serving
// -------------------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 ReachInbox Email Scheduler server is running:`);
    console.log(`   ➜ Local:   http://localhost:${PORT}`);
    console.log(`   ➜ Network: http://127.0.0.1:${PORT}`);
  });
}

startServer();
