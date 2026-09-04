import React, { useState, useRef } from 'react';
import {
  X,
  Upload,
  FileText,
  Clock,
  Gauge,
  Send,
  Sparkles,
  Users,
  AlertCircle,
  CheckCircle2,
  Calendar,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import type { User } from '../types.ts';

interface ComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScheduledSuccess: () => void;
  user: User | null;
}

export const ComposeModal: React.FC<ComposeModalProps> = ({
  isOpen,
  onClose,
  onScheduledSuccess,
  user,
}) => {
  const [senderEmail, setSenderEmail] = useState('outreach@reachinbox.ai');
  const [customSender, setCustomSender] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState(
    'Hi {{name}},\n\nI noticed your team has been scaling cold outreach campaigns. ReachInbox automates verified lead generation, intelligent sequence personalization, and provider reputation protection.\n\nWould you have 10 minutes for a brief chat this week?\n\nBest regards,\nReachInbox Growth'
  );

  const [leadEmails, setLeadEmails] = useState<string[]>([]);
  const [manualLeadText, setManualLeadText] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  // Scheduling options
  const [startTimeMode, setStartTimeMode] = useState<'now' | 'custom'>('now');
  const [customStartTime, setCustomStartTime] = useState(() => {
    const d = new Date(Date.now() + 5 * 60 * 1000);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  });
  const [delaySeconds, setDelaySeconds] = useState(2);
  const [hourlyLimit, setHourlyLimit] = useState(20);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const extractEmails = (text: string): string[] => {
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const matches = text.match(emailRegex) || [];
    const unique = Array.from(new Set(matches.map((e) => e.trim().toLowerCase())));
    return unique;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileError(null);
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (!content) {
        setFileError('Empty file uploaded');
        return;
      }
      const parsed = extractEmails(content);
      if (parsed.length === 0) {
        setFileError('No valid email addresses found in uploaded file');
        setLeadEmails([]);
      } else {
        setLeadEmails(parsed);
      }
    };
    reader.onerror = () => {
      setFileError('Failed to read file');
    };
    reader.readAsText(file);
  };

  const handleManualLeadsChange = (val: string) => {
    setManualLeadText(val);
    const parsed = extractEmails(val);
    setLeadEmails(parsed);
  };

  const effectiveSender = customSender.trim() ? customSender.trim() : senderEmail;
  const totalLeads = leadEmails.length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (totalLeads === 0) {
      setSubmitError('Please provide at least one valid lead email address.');
      return;
    }
    if (!subject.trim()) {
      setSubmitError('Email subject is required.');
      return;
    }
    if (!body.trim()) {
      setSubmitError('Email body is required.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    let scheduledIso = new Date().toISOString();
    if (startTimeMode === 'now') {
      scheduledIso = new Date(Date.now() + 1000).toISOString();
    } else {
      scheduledIso = new Date(customStartTime).toISOString();
    }

    try {
      const response = await fetch('/api/emails/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.id || 'usr_reachinbox_default',
          senderEmail: effectiveSender,
          recipients: leadEmails,
          subject,
          body,
          startTime: scheduledIso,
          delayBetweenEmailsMs: delaySeconds * 1000,
          hourlyLimit,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to schedule emails');
      }

      confetti({
        particleCount: 70,
        spread: 60,
        origin: { y: 0.6 },
      });

      onScheduledSuccess();
      onClose();
    } catch (err: any) {
      setSubmitError(err.message || 'Error occurred while scheduling');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
              <Send className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">Compose &amp; Schedule Campaign</h3>
              <p className="text-xs text-slate-400">BullMQ delayed jobs &bull; Paced &amp; Rate-limited</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 flex-1 text-slate-700 text-sm">
          {submitError && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2 font-medium">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{submitError}</span>
            </div>
          )}

          {/* Sender Email Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Sender Email Address
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {[
                'outreach@reachinbox.ai',
                'growth@reachinbox.ai',
                user?.email || 'founders@reachinbox.ai',
              ].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    setSenderEmail(s);
                    setCustomSender('');
                  }}
                  className={`px-3 py-2 text-xs rounded-xl border text-left truncate transition-colors font-medium ${
                    senderEmail === s && !customSender
                      ? 'bg-indigo-50 border-indigo-300 text-indigo-700 font-bold'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Lead Recipients Section: CSV / Text Upload */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Lead Recipients
              </label>
              {totalLeads > 0 && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{totalLeads} lead{totalLeads > 1 ? 's' : ''} detected</span>
                </span>
              )}
            </div>

            {/* Drag & drop upload area */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-2xl p-4 text-center cursor-pointer bg-slate-50 hover:bg-slate-100/60 transition-all group"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt"
                onChange={handleFileUpload}
                className="hidden"
              />
              <div className="flex items-center justify-center gap-3">
                <div className="p-2.5 rounded-xl bg-white text-indigo-600 shadow-sm group-hover:scale-105 transition-transform">
                  <Upload className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <p className="text-xs font-semibold text-slate-800">
                    {fileName ? (
                      <span className="text-indigo-600 font-bold">{fileName}</span>
                    ) : (
                      'Click to upload CSV / text file with lead emails'
                    )}
                  </p>
                  <p className="text-[11px] text-slate-400">Supports .csv, .txt with header auto-detection</p>
                </div>
              </div>
            </div>

            {fileError && <p className="text-xs text-rose-600 font-medium mt-1">{fileError}</p>}

            {/* Manual textarea input */}
            <div className="mt-2">
              <textarea
                rows={2}
                placeholder="Or paste leads directly (e.g. alex@example.com, sarah@company.io)..."
                value={manualLeadText}
                onChange={(e) => handleManualLeadsChange(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>

            {totalLeads > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5 max-h-20 overflow-y-auto p-2 bg-slate-50 rounded-xl border border-slate-200">
                {leadEmails.slice(0, 8).map((email, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center px-2 py-0.5 rounded text-[11px] bg-white text-slate-700 border border-slate-200 font-mono"
                  >
                    {email}
                  </span>
                ))}
                {totalLeads > 8 && (
                  <span className="text-[11px] text-slate-400 self-center px-1">
                    +{totalLeads - 8} more leads
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Email Subject */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Subject</label>
            <input
              type="text"
              required
              placeholder="e.g. Scaling AI outreach workflows for {{name}}"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>

          {/* Email Body */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">Message Body</label>
              <div className="flex items-center gap-2 text-[11px] text-slate-400">
                <span>Variables:</span>
                <span
                  onClick={() => setBody((prev) => prev + ' {{name}}')}
                  className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-indigo-600 cursor-pointer font-mono font-medium"
                >
                  &#123;&#123;name&#125;&#125;
                </span>
                <span
                  onClick={() => setBody((prev) => prev + ' {{email}}')}
                  className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-indigo-600 cursor-pointer font-mono font-medium"
                >
                  &#123;&#123;email&#125;&#125;
                </span>
              </div>
            </div>
            <textarea
              rows={4}
              required
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 leading-relaxed"
            />
          </div>

          {/* Scheduling Configuration Controls */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
            <div className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-indigo-600" />
              <span>Throughput &amp; Rate-Limiting Controls</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Start Time Mode */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Start Execution</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setStartTimeMode('now')}
                    className={`flex-1 py-2 text-xs rounded-xl border font-semibold transition-colors ${
                      startTimeMode === 'now'
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Start Immediately
                  </button>
                  <button
                    type="button"
                    onClick={() => setStartTimeMode('custom')}
                    className={`flex-1 py-2 text-xs rounded-xl border font-semibold transition-colors ${
                      startTimeMode === 'custom'
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Specific Time
                  </button>
                </div>

                {startTimeMode === 'custom' && (
                  <input
                    type="datetime-local"
                    value={customStartTime}
                    onChange={(e) => setCustomStartTime(e.target.value)}
                    className="mt-2 w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-indigo-500"
                  />
                )}
              </div>

              {/* Delay between emails */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-semibold text-slate-600">Pacing Delay</span>
                  <span className="font-mono text-indigo-600 font-bold">{delaySeconds}s / email</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  step="1"
                  value={delaySeconds}
                  onChange={(e) => setDelaySeconds(parseInt(e.target.value))}
                  className="w-full accent-indigo-600 cursor-pointer"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Consecutive delay between recipient sends
                </p>
              </div>
            </div>
          </div>

          {/* Modal Footer Actions */}
          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 rounded-xl hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-500/20 transition-all disabled:opacity-50"
            >
              {isSubmitting ? 'Scheduling Jobs...' : `Schedule ${totalLeads || 0} Emails`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
