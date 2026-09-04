import React, { useState, useEffect } from 'react';
import {
  Slack,
  Mail,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Send,
  Trash2,
  RefreshCw,
  Copy,
  Check,
} from 'lucide-react';
import type { SlackConfig, EtherealAccount, User } from '../types.ts';

interface SlackSettingsProps {
  user: User | null;
}

export const SlackSettings: React.FC<SlackSettingsProps> = ({ user }) => {
  const [slackConfig, setSlackConfig] = useState<SlackConfig | null>(null);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [channel, setChannel] = useState('#outreach-alerts');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [etherealAccount, setEtherealAccount] = useState<EtherealAccount | null>(null);
  const [copiedPass, setCopiedPass] = useState(false);

  const fetchSlackConfig = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/slack/config?userId=${user?.id || 'usr_reachinbox_default'}`);
      const data = await res.json();
      setSlackConfig(data);
      if (data.webhook_url) {
        setWebhookUrl(data.webhook_url);
        setChannel(data.channel || '#outreach-alerts');
      }
    } catch (err) {
      console.error('Failed to load Slack config:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchEtherealAccount = async () => {
    try {
      const res = await fetch('/api/ethereal/account');
      const data = await res.json();
      setEtherealAccount(data);
    } catch (err) {
      console.error('Failed to load Ethereal account:', err);
    }
  };

  useEffect(() => {
    fetchSlackConfig();
    fetchEtherealAccount();
  }, [user?.id]);

  const handleConnectSlack = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!webhookUrl) return;

    setIsSaving(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/slack/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.id || 'usr_reachinbox_default',
          webhookUrl,
          channel,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        await fetchSlackConfig();
        setTestResult({ success: true, message: 'Slack connected successfully!' });
      } else {
        setTestResult({ success: false, message: data.error || 'Failed to connect Slack' });
      }
    } catch (err: any) {
      setTestResult({ success: false, message: err.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDisconnectSlack = async () => {
    if (!confirm('Are you sure you want to disconnect Slack? Rate-limit notifications will pause.')) {
      return;
    }
    try {
      await fetch('/api/slack/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user?.id || 'usr_reachinbox_default' }),
      });
      setWebhookUrl('');
      setTestResult(null);
      await fetchSlackConfig();
    } catch (err) {
      console.error('Failed to disconnect Slack:', err);
    }
  };

  const handleSendTestMessage = async () => {
    if (!webhookUrl) {
      setTestResult({ success: false, message: 'Please enter a Slack Webhook URL first.' });
      return;
    }
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/slack/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          webhookUrl,
          email: user?.email || 'sahanaksalimathsahana@gmail.com',
        }),
      });
      const data = await res.json();
      setTestResult(data);
    } catch (err: any) {
      setTestResult({ success: false, message: err.message });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Slack Integration Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#4A154B] text-white flex items-center justify-center font-bold">
              <Slack className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-800">Slack Notifications</h3>
                {slackConfig?.connected ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <CheckCircle2 className="w-3 h-3" />
                    Connected
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                    Not Connected
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                Trigger alerts when a sender's rate limit is hit or when delayed jobs are rescheduled
              </p>
            </div>
          </div>

          <button
            onClick={fetchSlackConfig}
            disabled={isLoading}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-50 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <form onSubmit={handleConnectSlack} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Incoming Webhook URL
            </label>
            <input
              type="url"
              placeholder="https://hooks.slack.com/services/T000/B000/XXXX"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-mono"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Create an incoming webhook in your Slack App to receive real-time notifications.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Channel Name
              </label>
              <input
                type="text"
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Alert Email Recipient
              </label>
              <input
                type="email"
                disabled
                value={user?.email || 'sahanaksalimathsahana@gmail.com'}
                className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-xs text-slate-500"
              />
            </div>
          </div>

          {testResult && (
            <div
              className={`p-3.5 rounded-xl text-xs flex items-center gap-2 font-medium ${
                testResult.success
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-rose-50 text-rose-700 border border-rose-200'
              }`}
            >
              {testResult.success ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              <span>{testResult.message}</span>
            </div>
          )}

          <div className="pt-2 flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={isSaving || !webhookUrl}
              className="px-5 py-2.5 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-500/20 transition-all disabled:opacity-50"
            >
              {isSaving ? 'Connecting...' : slackConfig?.connected ? 'Update Webhook' : 'Save & Connect'}
            </button>

            <button
              type="button"
              onClick={handleSendTestMessage}
              disabled={isTesting || !webhookUrl}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isTesting ? 'Dispatching...' : 'Send Test Alert'}</span>
            </button>

            {slackConfig?.connected && (
              <button
                type="button"
                onClick={handleDisconnectSlack}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-colors ml-auto"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Disconnect</span>
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Ethereal Email Credentials Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <Mail className="w-4 h-4 text-indigo-600" />
            <h4 className="text-sm font-bold text-slate-800">Ethereal SMTP Sandbox Environment</h4>
          </div>
          {etherealAccount && (
            <a
              href={etherealAccount.webUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 font-semibold"
            >
              <span>Open Ethereal Web Inbox</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>

        <p className="text-xs text-slate-500 leading-relaxed">
          ReachInbox automatically spins up an ephemeral test account on Ethereal.email. Every scheduled email sent by BullMQ is captured with a real message ID and a shareable web preview link.
        </p>

        {etherealAccount && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs font-mono">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block font-sans">SMTP Host</span>
              <span className="text-slate-800 font-semibold">{etherealAccount.smtpHost}:{etherealAccount.smtpPort}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block font-sans">User Account</span>
              <span className="text-slate-800 font-semibold truncate block">{etherealAccount.user}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block font-sans">TLS Security</span>
              <span className="text-emerald-600 font-semibold flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                STARTTLS Active
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
