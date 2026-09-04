import React from 'react';
import {
  Layers,
  Cpu,
  Clock,
  Gauge,
  Slack,
  Search,
  Database,
  ShieldCheck,
  Zap,
  CheckCircle2,
  Terminal,
} from 'lucide-react';

export const ArchitectureDocs: React.FC = () => {
  return (
    <div className="space-y-6 max-w-5xl mx-auto text-slate-700 text-xs leading-relaxed">
      {/* Overview Banner */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2.5 rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-500/20">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              ReachInbox Hiring Assignment — Technical Architecture &amp; Specification
            </h2>
            <p className="text-xs text-indigo-600 font-semibold">
              Full-Stack Email Job Scheduler with BullMQ, Redis, Ethereal SMTP &amp; Elasticsearch Indexing
            </p>
          </div>
        </div>
        <p className="text-slate-600">
          This system replicates the mission-critical cold email delivery infrastructure at ReachInbox.
          It ensures strict scheduling idempotency, zero cron jobs, resilient worker concurrency, sender-level rate limiting,
          and zero job loss across server restarts.
        </p>
      </div>

      {/* 4 Pillars Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Pillar 1: Core Scheduling & No Cron */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center gap-2 text-indigo-600 font-bold text-sm">
            <Clock className="w-4 h-4" />
            <h3>1. Core Scheduler Behavior (Strictly No Cron)</h3>
          </div>
          <ul className="space-y-2 text-slate-600 list-disc pl-4">
            <li>
              <strong>BullMQ Delayed Jobs:</strong> Emails are queued with delay ={' '}
              <code className="text-indigo-700 bg-indigo-50 px-1 py-0.5 rounded font-mono">
                Math.max(0, scheduledAt - now)
              </code>
              . BullMQ stores delayed jobs in Redis sorted sets indexed by timestamp.
            </li>
            <li>
              <strong>Zero Cron Libraries:</strong> No <code className="text-slate-800 font-medium">node-cron</code>,{' '}
              <code className="text-slate-800 font-medium">agenda</code>, or OS crontabs. Jobs promote organically when their timestamp matures.
            </li>
            <li>
              <strong>Immediate Persistence:</strong> The request schedules the email, commits it to durable storage and Redis, and returns an immediate 202/200 response without blocking HTTP threads.
            </li>
          </ul>
        </div>

        {/* Pillar 2: Concurrency & Throttling */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center gap-2 text-indigo-600 font-bold text-sm">
            <Cpu className="w-4 h-4" />
            <h3>2. Worker Concurrency &amp; Throttling</h3>
          </div>
          <ul className="space-y-2 text-slate-600 list-disc pl-4">
            <li>
              <strong>Worker Pool:</strong> The BullMQ worker operates with configurable concurrency (default 5 concurrent jobs) to maximize throughput without overloading the runtime.
            </li>
            <li>
              <strong>Send Pacing:</strong> Built-in configurable delays between consecutive sends from the same sender prevent email spam-filter triggers.
            </li>
            <li>
              <strong>Graceful Recovery:</strong> If the worker process restarts mid-flight, active jobs are reclaimed automatically by BullMQ without duplication.
            </li>
          </ul>
        </div>

        {/* Pillar 3: Rate Limiting & Rolling Window */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center gap-2 text-indigo-600 font-bold text-sm">
            <Gauge className="w-4 h-4" />
            <h3>3. Rate Limiting &amp; Hourly Caps</h3>
          </div>
          <ul className="space-y-2 text-slate-600 list-disc pl-4">
            <li>
              <strong>Hourly Rolling Window:</strong> Redis atomic counter keys track sender counts per hour window (<code className="text-slate-800 font-medium">ratelimit:sender:YYYY-MM-DD-HH</code>).
            </li>
            <li>
              <strong>Automatic Postponement:</strong> When the cap is reached, the worker reschedules the remaining jobs to the next hour window rather than dropping them.
            </li>
            <li>
              <strong>Zero Drop Guarantee:</strong> Jobs are never silently discarded; their execution is simply deferred to respect provider quotas.
            </li>
          </ul>
        </div>

        {/* Pillar 4: Slack Alerts & Ethereal SMTP */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center gap-2 text-indigo-600 font-bold text-sm">
            <Slack className="w-4 h-4" />
            <h3>4. Slack Webhooks &amp; Delivery Verification</h3>
          </div>
          <ul className="space-y-2 text-slate-600 list-disc pl-4">
            <li>
              <strong>Slack Webhook Alerts:</strong> When rate limits are triggered or jobs are delayed, a formatted webhook is dispatched to Slack.
            </li>
            <li>
              <strong>Real SMTP Transport:</strong> Uses Ethereal test accounts to generate live SMTP handshakes and authentic preview URLs.
            </li>
            <li>
              <strong>Bull-Board GUI:</strong> Real-time queue inspection mounted at <code className="text-slate-800 font-medium font-mono">/admin/queues</code>.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};
