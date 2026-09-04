import React, { useState, useRef } from 'react';
import {
  Upload,
  Search,
  Filter,
  ArrowUpRight,
  Clock,
  Send,
  AlertTriangle,
  Zap,
  XCircle,
  CheckCircle2,
  FileText,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import type { EmailItem, QueueTelemetry, User } from '../types.ts';

interface DashboardOverviewProps {
  scheduledEmails: EmailItem[];
  sentEmails: EmailItem[];
  queueStats: QueueTelemetry | null;
  onCancelEmail: (id: string) => void;
  onSendNowEmail: (id: string) => void;
  onOpenCompose: () => void;
  onSeedDemo: () => void;
  onRefresh: () => void;
  user: User | null;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  scheduledEmails,
  sentEmails,
  queueStats,
  onCancelEmail,
  onSendNowEmail,
  onOpenCompose,
  onSeedDemo,
  onRefresh,
  user,
}) => {
  const [searchFilter, setSearchFilter] = useState('');
  const [quickCampaign, setQuickCampaign] = useState('');
  const [quickFrequency, setQuickFrequency] = useState('2');
  const [quickFileName, setQuickFileName] = useState<string | null>(null);
  const [quickLeads, setQuickLeads] = useState<string[]>([]);
  const [isQuickSubmitting, setIsQuickSubmitting] = useState(false);
  const [quickMessage, setQuickMessage] = useState<{ text: string; isError?: boolean } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // File drop/upload parser
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setQuickFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (!content) return;
      const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
      const matches = content.match(emailRegex) || [];
      const unique = Array.from(new Set(matches.map((m) => m.trim().toLowerCase())));
      setQuickLeads(unique);
      if (unique.length > 0) {
        setQuickMessage({ text: `Extracted ${unique.length} leads from ${file.name}` });
      } else {
        setQuickMessage({ text: 'No valid emails found in file', isError: true });
      }
    };
    reader.readAsText(file);
  };

  // Quick Schedule handler directly from Dashboard card
  const handleQuickSchedule = async () => {
    let recipientsToUse = quickLeads;
    if (recipientsToUse.length === 0) {
      // Fallback demo leads if none uploaded
      recipientsToUse = [
        'lead.director@techcorp.io',
        'growth.lead@outreach-scale.com',
        'founder@stealth-ai.co',
      ];
    }

    setIsQuickSubmitting(true);
    setQuickMessage(null);

    const frequencySecs = parseInt(quickFrequency, 10) || 2;
    const campaignSubject = quickCampaign.trim() || 'Accelerate Outreach Deliverability';

    try {
      const res = await fetch('/api/emails/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.id || 'usr_default',
          senderEmail: 'outreach@reachinbox.ai',
          recipients: recipientsToUse,
          subject: campaignSubject,
          body: 'Hi {{name}},\n\nReaching out to explore how ReachInbox automates high-volume cold email campaigns with BullMQ persistence and Redis rate-limiting.\n\nBest regards,\nReachInbox Growth',
          startTime: new Date(Date.now() + 2000).toISOString(),
          delayBetweenEmailsMs: frequencySecs * 1000,
          hourlyLimit: 25,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setQuickMessage({ text: `Successfully queued ${data.scheduledCount} emails!` });
        setQuickCampaign('');
        setQuickFileName(null);
        setQuickLeads([]);
        onRefresh();
      } else {
        setQuickMessage({ text: data.error || 'Failed to schedule', isError: true });
      }
    } catch (err: any) {
      setQuickMessage({ text: err.message || 'Error occurred', isError: true });
    } finally {
      setIsQuickSubmitting(false);
    }
  };

  // Filtered upcoming emails
  const filteredScheduled = scheduledEmails.filter((email) => {
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase();
    return (
      email.recipient_email.toLowerCase().includes(q) ||
      email.subject.toLowerCase().includes(q) ||
      email.status.toLowerCase().includes(q)
    );
  });

  const totalScheduledCount = scheduledEmails.length;
  const successfullySentCount = sentEmails.length;
  const delayedOrFailedCount = (queueStats?.delayed || 0) + (queueStats?.failed || 0);

  // Rate limit calculations
  const maxHourly = queueStats?.maxEmailsPerHour || 20;
  const hourlyUsed = Math.min(maxHourly, sentEmails.length);
  const hourlyPercent = Math.min(100, Math.round((hourlyUsed / maxHourly) * 100));

  const concurrencyMax = queueStats?.concurrency || 5;
  const concurrencyActive = queueStats?.active || 0;
  const concurrencyPercent = Math.min(100, Math.round((concurrencyActive / concurrencyMax) * 100));

  const formatSendTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const month = months[d.getMonth()];
      const day = d.getDate();
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      return `${month} ${day}, ${hours}:${minutes}`;
    } catch {
      return 'Upcoming';
    }
  };

  return (
    <div className="flex-1 flex flex-col gap-6">
      {/* 3 Metric Cards matching Figma */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Total Scheduled */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
          <p className="text-sm text-slate-500 font-medium">Total Scheduled</p>
          <p className="text-3xl font-extrabold mt-1 text-slate-900 tracking-tight">
            {totalScheduledCount.toLocaleString()}
          </p>
          <div className="mt-1 flex items-center gap-1.5">
            <span className="text-xs text-emerald-600 font-bold">+12.5% vs yesterday</span>
            <span className="text-[11px] text-slate-400">• Persistent Redis</span>
          </div>
        </div>

        {/* Card 2: Successfully Sent */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
          <p className="text-sm text-slate-500 font-medium">Successfully Sent</p>
          <p className="text-3xl font-extrabold mt-1 text-indigo-600 tracking-tight">
            {successfullySentCount.toLocaleString()}
          </p>
          <div className="mt-1 flex items-center gap-1.5">
            <span className="text-xs text-slate-500 font-medium">99.8% Success Rate</span>
            <span className="text-[11px] text-slate-400">• Ethereal SMTP</span>
          </div>
        </div>

        {/* Card 3: Failed / Delayed */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
          <p className="text-sm text-slate-500 font-medium">Failed/Delayed</p>
          <p className="text-3xl font-extrabold mt-1 text-rose-500 tracking-tight">
            {delayedOrFailedCount.toLocaleString()}
          </p>
          <div className="mt-1 flex items-center gap-1.5">
            <span className="text-xs text-rose-500 font-bold">
              {delayedOrFailedCount > 0 ? 'Paced in Queue' : 'Zero Errors'}
            </span>
            <span className="text-[11px] text-slate-400">• Provider Safe</span>
          </div>
        </div>
      </div>

      {/* Main Grid: 8 Cols (Table) + 4 Cols (Actions & Limits) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Left Col: Upcoming Email Queue Table (col-span-8) */}
        <div className="xl:col-span-8 flex flex-col gap-6">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col min-h-[460px]">
            {/* Table Header & Toolbar */}
            <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <h2 className="font-bold text-slate-800 text-base tracking-tight">Upcoming Email Queue</h2>
                <span className="bg-indigo-50 text-indigo-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                  {filteredScheduled.length} queued
                </span>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search queue..."
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 w-44"
                  />
                </div>
                <button
                  onClick={onRefresh}
                  title="Refresh Queue"
                  className="p-1.5 text-slate-600 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={onOpenCompose}
                  className="px-3 py-1.5 text-xs font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
                >
                  + New Email
                </button>
              </div>
            </div>

            {/* Table Body */}
            <div className="flex-1 overflow-x-auto overflow-y-auto max-h-[420px]">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-slate-50/95 backdrop-blur-sm z-10 border-b border-slate-100">
                  <tr className="text-[11px] uppercase text-slate-400 font-semibold tracking-wider">
                    <th className="px-6 py-3">Recipient</th>
                    <th className="px-6 py-3">Subject</th>
                    <th className="px-6 py-3">Send Time</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="text-sm divide-y divide-slate-100">
                  {filteredScheduled.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-400">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <Clock className="w-8 h-8 text-slate-300" />
                          <p className="font-medium text-slate-600 text-sm">No emails in queue</p>
                          <p className="text-xs text-slate-400">
                            Schedule a new campaign or seed sample leads.
                          </p>
                          <div className="flex gap-2 mt-2">
                            <button
                              onClick={onSeedDemo}
                              className="px-3 py-1.5 text-xs font-medium bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200"
                            >
                              Seed 5 Demo Leads
                            </button>
                            <button
                              onClick={onOpenCompose}
                              className="px-3 py-1.5 text-xs font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                            >
                              Compose Email
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredScheduled.map((email) => {
                      const isDelayed = email.status === 'scheduled';
                      return (
                        <tr key={email.id} className="hover:bg-indigo-50/30 transition-colors">
                          <td className="px-6 py-4 font-medium text-slate-800 text-xs">
                            {email.recipient_email}
                          </td>
                          <td className="px-6 py-4 text-slate-600 truncate max-w-[200px] text-xs">
                            {email.subject}
                          </td>
                          <td className="px-6 py-4 text-slate-600 text-xs whitespace-nowrap">
                            {formatSendTime(email.scheduled_at)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {isDelayed ? (
                              <span className="bg-amber-100 text-amber-700 px-2.5 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider">
                                Delayed
                              </span>
                            ) : email.status === 'processing' ? (
                              <span className="bg-blue-100 text-blue-700 px-2.5 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider animate-pulse">
                                Queued
                              </span>
                            ) : (
                              <span className="bg-emerald-100 text-emerald-700 px-2.5 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider">
                                {email.status}
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => onSendNowEmail(email.id)}
                                title="Prioritize & Send Now"
                                className="p-1 text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                              >
                                <Zap className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => onCancelEmail(email.id)}
                                title="Cancel Job"
                                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Col: New Email Blast & Rate Limits (col-span-4) */}
        <div className="xl:col-span-4 flex flex-col gap-6">
          {/* New Email Blast Card matching Figma */}
          <div className="bg-indigo-600 rounded-2xl p-6 text-white shadow-xl shadow-indigo-500/20">
            <h3 className="text-lg font-bold mb-4 tracking-tight">New Email Blast</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold opacity-70 uppercase mb-1.5 tracking-wider">
                  Campaign Name
                </label>
                <input
                  type="text"
                  value={quickCampaign}
                  onChange={(e) => setQuickCampaign(e.target.value)}
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-white/40 placeholder-white/50 text-sm text-white"
                  placeholder="Winter Outreach..."
                />
              </div>

              <div>
                <label className="block text-xs font-bold opacity-70 uppercase mb-1.5 tracking-wider">
                  Send Frequency
                </label>
                <select
                  value={quickFrequency}
                  onChange={(e) => setQuickFrequency(e.target.value)}
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 outline-none appearance-none cursor-pointer text-sm text-white focus:ring-2 focus:ring-white/40"
                >
                  <option value="2" className="text-slate-900">Every 2 seconds (Paced)</option>
                  <option value="5" className="text-slate-900">Every 5 seconds</option>
                  <option value="10" className="text-slate-900">Every 10 seconds</option>
                  <option value="60" className="text-slate-900">Every 1 minute</option>
                </select>
              </div>

              {/* CSV Upload Dropzone */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt"
                onChange={handleFileUpload}
                className="hidden"
              />
              <div
                onClick={() => fileInputRef.current?.click()}
                className="bg-white/10 border border-dashed border-white/30 rounded-2xl p-5 text-center cursor-pointer hover:bg-white/20 transition-all select-none"
              >
                <Upload className="w-8 h-8 mx-auto mb-2 opacity-60 text-white" />
                <p className="text-xs font-bold text-white">
                  {quickFileName ? quickFileName : 'Upload CSV Leads'}
                </p>
                <p className="text-[10px] opacity-70 text-indigo-100 mt-0.5">
                  {quickLeads.length > 0
                    ? `${quickLeads.length} leads detected`
                    : 'Drag and drop or browse files'}
                </p>
              </div>

              {quickMessage && (
                <div
                  className={`text-xs p-2.5 rounded-lg font-medium ${
                    quickMessage.isError ? 'bg-rose-500/20 text-rose-100' : 'bg-white/20 text-white'
                  }`}
                >
                  {quickMessage.text}
                </div>
              )}

              <button
                disabled={isQuickSubmitting}
                onClick={handleQuickSchedule}
                className="w-full bg-white text-indigo-700 font-bold py-3 rounded-xl shadow-lg hover:bg-indigo-50 transition-all disabled:opacity-50 cursor-pointer text-sm"
              >
                {isQuickSubmitting ? 'Scheduling with BullMQ...' : 'Schedule Now'}
              </button>
            </div>
          </div>

          {/* Rate Limits Card matching Figma */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-800 text-sm tracking-tight">Rate Limits</h3>
              <span className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                Configurable
              </span>
            </div>

            <div className="space-y-5">
              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="font-semibold text-slate-500">Emails Per Hour</span>
                  <span className="font-bold text-slate-800">{hourlyUsed} / {maxHourly}</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-indigo-500 h-full rounded-full transition-all duration-300"
                    style={{ width: `${hourlyPercent}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="font-semibold text-slate-500">Sender Concurrent Jobs</span>
                  <span className="font-bold text-slate-800">{concurrencyActive} / {concurrencyMax}</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                    style={{ width: `${concurrencyPercent}%` }}
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100">
                <div className="flex items-start gap-3">
                  <div className="bg-rose-50 p-2 rounded-lg text-rose-500 shrink-0">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800">Hourly Limit Protection</p>
                    <p className="text-[11px] text-slate-500 leading-tight mt-0.5">
                      Sender jobs exceeding {maxHourly}/hr automatically roll over to the next hour window via BullMQ delay.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
