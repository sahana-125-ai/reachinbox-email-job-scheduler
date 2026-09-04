import React from 'react';
import {
  LayoutDashboard,
  Clock,
  Send,
  BarChart3,
  Bell,
  FileCode,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';
import type { QueueTelemetry } from '../types.ts';

interface SidebarProps {
  activeTab: 'dashboard' | 'scheduled' | 'sent' | 'queue' | 'slack' | 'docs';
  setActiveTab: (tab: 'dashboard' | 'scheduled' | 'sent' | 'queue' | 'slack' | 'docs') => void;
  queueStats: QueueTelemetry | null;
  scheduledCount: number;
  sentCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  queueStats,
  scheduledCount,
  sentCount,
}) => {
  const waitingJobs = (queueStats?.waiting || 0) + (queueStats?.delayed || 0) + (queueStats?.active || 0);
  const progressPercent = Math.min(100, Math.max(15, ((queueStats?.completed || 0) / Math.max(1, (queueStats?.completed || 0) + waitingJobs)) * 100));

  const navItems = [
    {
      id: 'dashboard' as const,
      label: 'Dashboard',
      icon: LayoutDashboard,
      badge: null,
    },
    {
      id: 'scheduled' as const,
      label: 'Scheduled',
      icon: Clock,
      badge: scheduledCount > 0 ? scheduledCount : null,
    },
    {
      id: 'sent' as const,
      label: 'Sent Emails',
      icon: Send,
      badge: sentCount > 0 ? sentCount : null,
    },
    {
      id: 'queue' as const,
      label: 'Analytics',
      icon: BarChart3,
      badge: queueStats?.active ? `${queueStats.active} active` : null,
    },
    {
      id: 'slack' as const,
      label: 'Slack Alerts',
      icon: Bell,
      badge: null,
    },
    {
      id: 'docs' as const,
      label: 'Documentation',
      icon: FileCode,
      badge: null,
    },
  ];

  return (
    <aside className="w-64 bg-[#0F172A] text-white flex flex-col shrink-0 select-none border-r border-slate-800">
      {/* Brand Header */}
      <div className="p-6 flex items-center gap-3 border-b border-slate-800/60">
        <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center font-bold text-xl italic text-white shadow-lg shadow-indigo-500/25">
          R
        </div>
        <div className="flex flex-col">
          <span className="font-bold text-lg tracking-tight text-white leading-none">ReachInbox</span>
          <span className="text-[10px] text-slate-400 tracking-wider uppercase font-medium mt-1">Outbox Labs</span>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-4 py-5 space-y-1.5 overflow-y-auto no-scrollbar">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              id={`nav-${item.id}`}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all duration-150 text-left ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/25 font-semibold'
                  : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                    isActive ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-300 border border-slate-700'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Queue Status Widget */}
      <div className="p-5 mt-auto border-t border-slate-800/60">
        <div className="bg-slate-800/50 rounded-2xl p-4 border border-slate-700/80 shadow-inner">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Queue Status</span>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] text-emerald-400 font-medium">Active</span>
            </div>
          </div>
          <div className="flex justify-between items-baseline">
            <span className="text-xl font-bold text-white tracking-tight">
              {waitingJobs.toLocaleString()}
            </span>
            <span className="text-xs text-slate-400">jobs in queue</span>
          </div>
          <div className="w-full bg-slate-700 h-1.5 mt-3 rounded-full overflow-hidden">
            <div
              className="bg-indigo-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <div className="mt-3 pt-2.5 border-t border-slate-700/60 flex items-center justify-between text-[11px] text-slate-400">
            <span>BullMQ Engine</span>
            <a
              href="/admin/queues"
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium"
            >
              <span>Bull-Board</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>
    </aside>
  );
};
