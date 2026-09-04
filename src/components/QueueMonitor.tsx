import React, { useState } from 'react';
import {
  Activity,
  Layers,
  Clock,
  CheckCircle2,
  AlertOctagon,
  Cpu,
  Gauge,
  Sliders,
  ExternalLink,
  Sparkles,
  Zap,
  ShieldCheck,
  RefreshCw,
  Play,
} from 'lucide-react';
import type { QueueTelemetry } from '../types.ts';

interface QueueMonitorProps {
  stats: QueueTelemetry | null;
  isLoading: boolean;
  onRefresh: () => void;
  onUpdateSettings: (newSettings: {
    concurrency?: number;
    minDelayMs?: number;
    maxEmailsPerHour?: number;
  }) => Promise<void>;
  onSeedDemo: () => void;
}

export const QueueMonitor: React.FC<QueueMonitorProps> = ({
  stats,
  isLoading,
  onRefresh,
  onUpdateSettings,
  onSeedDemo,
}) => {
  const [concurrency, setConcurrency] = useState(stats?.concurrency || 5);
  const [minDelaySec, setMinDelaySec] = useState((stats?.minDelayMs || 2000) / 1000);
  const [maxHourly, setMaxHourly] = useState(stats?.maxEmailsPerHour || 20);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  React.useEffect(() => {
    if (stats) {
      setConcurrency(stats.concurrency);
      setMinDelaySec(stats.minDelayMs / 1000);
      setMaxHourly(stats.maxEmailsPerHour);
    }
  }, [stats?.concurrency, stats?.minDelayMs, stats?.maxEmailsPerHour]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      await onUpdateSettings({
        concurrency,
        minDelayMs: minDelaySec * 1000,
        maxEmailsPerHour: maxHourly,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top 5 Metrics Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* Active Jobs */}
        <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Active Worker</span>
            <Activity className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 font-mono">
              {stats?.active || 0}
            </span>
            <span className="text-[11px] text-slate-400">processing</span>
          </div>
          <div className="mt-2 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-all duration-500"
              style={{ width: `${Math.min(100, ((stats?.active || 0) / (stats?.concurrency || 5)) * 100)}%` }}
            />
          </div>
        </div>

        {/* Delayed Jobs */}
        <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Delayed (BullMQ)</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 font-mono">
              {stats?.delayed || 0}
            </span>
            <span className="text-[11px] text-slate-400">scheduled</span>
          </div>
          <div className="mt-2 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-amber-500 w-full" />
          </div>
        </div>

        {/* Waiting Jobs */}
        <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Waiting Queue</span>
            <Layers className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 font-mono">
              {stats?.waiting || 0}
            </span>
            <span className="text-[11px] text-slate-400">ready</span>
          </div>
          <div className="mt-2 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-indigo-500 w-full" />
          </div>
        </div>

        {/* Completed Jobs */}
        <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Completed (Sent)</span>
            <CheckCircle2 className="w-4 h-4 text-purple-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 font-mono">
              {stats?.completed || 0}
            </span>
            <span className="text-[11px] text-slate-400">delivered</span>
          </div>
          <div className="mt-2 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-purple-500 w-full" />
          </div>
        </div>

        {/* Failed Jobs */}
        <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Failed Jobs</span>
            <AlertOctagon className="w-4 h-4 text-rose-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 font-mono">
              {stats?.failed || 0}
            </span>
            <span className="text-[11px] text-slate-400">errors</span>
          </div>
          <div className="mt-2 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-rose-500 w-full" />
          </div>
        </div>
      </div>

      {/* Configuration & Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Worker Tuning Form */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
                <Sliders className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">
                  Worker Concurrency &amp; Throttling Configuration
                </h3>
                <p className="text-xs text-slate-400">
                  Dynamically adjust concurrency, send delays, and rate limits without server restarts
                </p>
              </div>
            </div>

            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors"
              title="Refresh telemetry"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <form onSubmit={handleSaveSettings} className="space-y-5">
            {/* Worker Concurrency */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <label className="font-semibold text-slate-700 flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Worker Concurrency</span>
                </label>
                <span className="font-mono text-indigo-700 font-bold bg-indigo-50 px-2.5 py-0.5 rounded-md border border-indigo-100">
                  {concurrency} worker{concurrency > 1 ? 's' : ''} parallel
                </span>
              </div>
              <input
                type="range"
                min="1"
                max="20"
                step="1"
                value={concurrency}
                onChange={(e) => setConcurrency(parseInt(e.target.value))}
                className="w-full accent-indigo-600 cursor-pointer"
              />
              <p className="text-[11px] text-slate-400">
                Determines how many BullMQ email jobs can be processed simultaneously across the worker pool.
              </p>
            </div>

            {/* Delay Between Sends */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <label className="font-semibold text-slate-700 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                  <span>Minimum Delay Between Sends (Provider Pacing)</span>
                </label>
                <span className="font-mono text-amber-700 font-bold bg-amber-50 px-2.5 py-0.5 rounded-md border border-amber-100">
                  {minDelaySec} seconds
                </span>
              </div>
              <input
                type="range"
                min="0.5"
                max="10"
                step="0.5"
                value={minDelaySec}
                onChange={(e) => setMinDelaySec(parseFloat(e.target.value))}
                className="w-full accent-amber-500 cursor-pointer"
              />
              <p className="text-[11px] text-slate-400">
                Pacing delay between consecutive sends from each sender to prevent ESP rate violations.
              </p>
            </div>

            {/* Max Emails Per Hour */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <label className="font-semibold text-slate-700 flex items-center gap-1.5">
                  <Gauge className="w-3.5 h-3.5 text-purple-600" />
                  <span>Max Emails Per Hour (Sender Rate Limit)</span>
                </label>
                <span className="font-mono text-purple-700 font-bold bg-purple-50 px-2.5 py-0.5 rounded-md border border-purple-100">
                  {maxHourly} emails/hr
                </span>
              </div>
              <input
                type="range"
                min="5"
                max="200"
                step="5"
                value={maxHourly}
                onChange={(e) => setMaxHourly(parseInt(e.target.value))}
                className="w-full accent-purple-600 cursor-pointer"
              />
              <p className="text-[11px] text-slate-400">
                Enforced by Redis atomic counters. Overflow jobs automatically delay to the next hour window.
              </p>
            </div>

            <div className="pt-2 flex items-center gap-3">
              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2.5 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-500/20 transition-all disabled:opacity-50"
              >
                {isSaving ? 'Updating Worker Cluster...' : 'Save Configuration'}
              </button>

              {saveSuccess && (
                <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Settings applied immediately!</span>
                </span>
              )}
            </div>
          </form>
        </div>

        {/* Side Panel: Bull-Board & Quick Links */}
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
            <h4 className="text-sm font-bold text-slate-800 tracking-tight">Bull-Board Administration</h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              Official BullMQ monitoring dashboard mounted at <code className="bg-slate-100 px-1.5 py-0.5 rounded text-indigo-600 font-mono text-[11px]">/admin/queues</code>.
            </p>
            <a
              href="/admin/queues"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-sm transition-all"
            >
              <span>Open Bull-Board in New Tab</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          <div className="bg-indigo-50/70 border border-indigo-100 rounded-2xl p-6 space-y-3">
            <h4 className="text-xs font-bold text-indigo-900 uppercase tracking-wider">Zero-Cron Mechanics</h4>
            <p className="text-xs text-indigo-950/80 leading-relaxed">
              Jobs are added to BullMQ using dynamically calculated delay timestamps:
              <br />
              <code className="block mt-2 p-2 bg-white rounded-lg border border-indigo-200 font-mono text-[11px] text-indigo-700">
                delay = Math.max(0, scheduledTimestamp - Date.now());
              </code>
            </p>
            <div className="pt-2">
              <button
                onClick={onSeedDemo}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-700 hover:text-indigo-900"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Trigger 5 Demo Delayed Jobs</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
