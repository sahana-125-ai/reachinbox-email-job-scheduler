import React from 'react';
import {
  Send,
  Search,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Mail,
  Calendar,
  Sparkles,
  Eye,
} from 'lucide-react';
import type { EmailItem } from '../types.ts';

interface SentTableProps {
  emails: EmailItem[];
  isLoading: boolean;
  onRefresh: () => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  onOpenCompose: () => void;
}

export const SentTable: React.FC<SentTableProps> = ({
  emails,
  isLoading,
  onRefresh,
  searchQuery,
  setSearchQuery,
  onOpenCompose,
}) => {
  const formatSentTime = (isoString: string | null) => {
    if (!isoString) return { formatted: 'N/A', relative: '' };
    const d = new Date(isoString);
    const diffSecs = Math.floor((Date.now() - d.getTime()) / 1000);

    let relative = '';
    if (diffSecs < 10) {
      relative = 'Just now';
    } else if (diffSecs < 60) {
      relative = `${diffSecs}s ago`;
    } else if (diffSecs < 3600) {
      relative = `${Math.floor(diffSecs / 60)}m ago`;
    } else {
      relative = `${Math.floor(diffSecs / 3600)}h ago`;
    }

    return {
      formatted: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      dateFormatted: d.toLocaleDateString([], { month: 'short', day: 'numeric' }),
      relative,
    };
  };

  return (
    <div className="space-y-5">
      {/* Search & Action Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            id="search-sent-input"
            type="text"
            placeholder="Search sent emails via Elasticsearch index..."
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
            title="Refresh list"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <h2 className="font-bold text-slate-800 text-base tracking-tight">Delivery History & Previews</h2>
            <span className="text-xs bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded-full font-bold">
              {emails.length} Sent
            </span>
          </div>
          <span className="text-xs text-slate-400 font-medium">Real Ethereal SMTP Transport</span>
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
              <Send className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-800">No sent emails recorded</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {searchQuery
                ? `No sent emails match "${searchQuery}".`
                : 'Emails processed by the BullMQ worker via Ethereal SMTP will appear here.'}
            </p>
            <div className="mt-5">
              <button
                onClick={onOpenCompose}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-500/20 transition-all"
              >
                Schedule Emails Now
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50/95 border-b border-slate-100 sticky top-0">
                <tr className="text-[11px] uppercase text-slate-400 font-semibold tracking-wider">
                  <th className="px-6 py-3.5">Recipient Lead</th>
                  <th className="px-6 py-3.5">Subject</th>
                  <th className="px-6 py-3.5">Sender</th>
                  <th className="px-6 py-3.5">Sent At</th>
                  <th className="px-6 py-3.5">Delivery Status</th>
                  <th className="px-6 py-3.5 text-right">Ethereal Preview</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {emails.map((email) => {
                  const sentMeta = formatSentTime(email.sent_at);
                  return (
                    <tr key={email.id} className="hover:bg-indigo-50/30 transition-colors">
                      <td className="px-6 py-4 font-medium text-slate-900 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-[11px]">
                            {email.recipient_email[0].toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-800 text-xs">{email.recipient_email}</p>
                            <p className="text-[10px] text-slate-400">ID: {email.id.slice(0, 14)}...</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 max-w-xs">
                        <p className="font-semibold text-slate-800 truncate text-xs">{email.subject}</p>
                        <p className="text-[11px] text-slate-400 truncate mt-0.5">{email.body}</p>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-slate-600 font-mono text-[11px]">
                        {email.sender_email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-800 text-xs">
                            {sentMeta.dateFormatted}, {sentMeta.formatted}
                          </span>
                          <span className="text-[10px] text-slate-400">{sentMeta.relative}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Sent</span>
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        {email.ethereal_preview_url ? (
                          <a
                            href={email.ethereal_preview_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition-colors shadow-xs"
                          >
                            <Eye className="w-3.5 h-3.5 text-indigo-600" />
                            <span>View in Ethereal</span>
                            <ExternalLink className="w-3 h-3 opacity-60" />
                          </a>
                        ) : (
                          <span className="text-slate-400 text-xs italic">Simulated transport</span>
                        )}
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
