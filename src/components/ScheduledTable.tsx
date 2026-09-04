import React, { useState, useEffect } from 'react';
import {
  Clock,
  Search,
  RefreshCw,
  Zap,
  XCircle,
  AlertTriangle,
  Mail,
  Calendar,
  Sparkles,
  ChevronRight,
  Filter,
} from 'lucide-react';
import type { EmailItem } from '../types.ts';

interface ScheduledTableProps {
  emails: EmailItem[];
  isLoading: boolean;
  onRefresh: () => void;
  onCancelEmail: (id: string) => Promise<void>;
  onSendNowEmail: (id: string) => Promise<void>;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  onOpenCompose: () => void;
  onSeedDemo: () => void;
}

export const ScheduledTable: React.FC<ScheduledTableProps> = ({
  emails,
  isLoading,
  onRefresh,
  onCancelEmail,
  onSendNowEmail,
  searchQuery,
  setSearchQuery,
  onOpenCompose,
  onSeedDemo,
}) => {
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(Date.now());

  // Keep countdown active every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const getRelativeCountdown = (scheduledTimestamp: number, scheduledAtIso: string) => {
    const targetMs = scheduledTimestamp || new Date(scheduledAtIso).getTime();
    const diffMs = targetMs - currentTime;
    const dateObj = new Date(targetMs);

    if (diffMs <= 0) {
      return {
        formatted: dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        dateFormatted: dateObj.toLocaleDateString([], { month: 'short', day: 'numeric' }),
        countdown: 'Processing now',
        isImminent: true,
      };
    }

    const diffSecs = Math.floor(diffMs / 1000);
    const mins = Math.floor(diffSecs / 60);
    const secs = diffSecs % 60;
    const hours = Math.floor(mins / 60);

    let countdownText = '';
    if (hours > 0) {
      countdownText = `in ${hours}h ${mins % 60}m`;
    } else if (mins > 0) {
      countdownText = `in ${mins}m ${secs}s`;
    } else {
      countdownText = `in ${secs}s`;
    }

    return {
      formatted: dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      dateFormatted: dateObj.toLocaleDateString([], { month: 'short', day: 'numeric' }),
      countdown: countdownText,
      isImminent: diffSecs < 60,
    };
  };

  const handleAction = async (id: string, action: 'cancel' | 'send-now') => {
    setActionLoadingId(id);
    try {
      if (action === 'cancel') {
        await onCancelEmail(id);
      } else {
        await onSendNowEmail(id);
      }
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* Search & Action Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            id="search-scheduled-input"
            type="text"
            placeholder="Search scheduled emails via Elasticsearch index..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
            >
              Clear
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center">
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors disabled:opacity-50"
            title="Refresh queue"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            id="seed-demo-leads-btn"
            onClick={onSeedDemo}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl border border-indigo-200 transition-colors"
            title="Add sample leads"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
            <span>Seed 5 Leads</span>
          </button>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <h2 className="font-bold text-slate-800 text-base tracking-tight">Active Delayed Queue</h2>
            <span className="text-xs bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded-full font-bold">
              {emails.length} Scheduled
            </span>
          </div>
          <span className="text-xs text-slate-400 font-medium">Sorted by BullMQ maturity</span>
        </div>

        {isLoading && emails.length === 0 ? (
          <div className="p-8 space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                <div className="space-y-2 flex-1">
                  <div className="h-4 bg-slate-200 rounded w-1/4" />
                  <div className="h-3 bg-slate-100 rounded w-1/2" />
                </div>
                <div className="h-6 bg-slate-200 rounded w-20" />
              </div>
            ))}
          </div>
        ) : emails.length === 0 ? (
          <div className="py-16 px-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-3 border border-indigo-100">
              <Clock className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-800">No scheduled emails in queue</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {searchQuery
                ? `No scheduled emails match "${searchQuery}".`
                : 'All queued delayed jobs have completed execution or none have been scheduled.'}
            </p>
            <div className="mt-5 flex items-center justify-center gap-3">
              <button
                onClick={onOpenCompose}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-500/20 transition-all"
              >
                Compose New Email
              </button>
              <button
                onClick={onSeedDemo}
                className="px-4 py-2 text-xs font-medium rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors"
              >
                Seed 5 Demo Leads
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50/95 border-b border-slate-100 sticky top-0">
                <tr className="text-[11px] uppercase text-slate-400 font-semibold tracking-wider">
                  <th className="px-6 py-3.5">Recipient</th>
                  <th className="px-6 py-3.5">Subject & Content</th>
                  <th className="px-6 py-3.5">Scheduled Delivery</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {emails.map((email) => {
                  const timeMeta = getRelativeCountdown(email.scheduled_timestamp, email.scheduled_at);
                  const isOperating = actionLoadingId === email.id;

                  return (
                    <tr key={email.id} className="hover:bg-indigo-50/30 transition-colors">
                      <td className="px-6 py-4 font-medium text-slate-900 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-[11px]">
                            {email.recipient_email[0].toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-800 text-xs">{email.recipient_email}</p>
                            <p className="text-[10px] text-slate-400">from {email.sender_email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 max-w-xs">
                        <p className="font-semibold text-slate-800 truncate text-xs">{email.subject}</p>
                        <p className="text-[11px] text-slate-400 truncate mt-0.5">{email.body}</p>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            <span className="font-semibold text-slate-800 text-xs">
                              {timeMeta.dateFormatted}, {timeMeta.formatted}
                            </span>
                          </div>
                          <span
                            className={`text-[11px] font-medium mt-0.5 ${
                              timeMeta.isImminent ? 'text-amber-600 font-bold' : 'text-slate-400'
                            }`}
                          >
                            {timeMeta.countdown}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider">
                          Delayed
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            disabled={isOperating}
                            onClick={() => handleAction(email.id, 'send-now')}
                            title="Prioritize & Send Immediately"
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition-colors disabled:opacity-50"
                          >
                            <Zap className="w-3 h-3 text-indigo-600" />
                            <span>Send Now</span>
                          </button>
                          <button
                            disabled={isOperating}
                            onClick={() => handleAction(email.id, 'cancel')}
                            title="Cancel email and remove from queue"
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors disabled:opacity-50"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
