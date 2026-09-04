import React, { useState, useEffect } from 'react';
import {
  Bell,
  CheckCircle2,
  AlertCircle,
  Plus,
  LogOut,
  ChevronDown,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import type { User, QueueTelemetry } from '../types.ts';

interface HeaderProps {
  user: User;
  activeTab: 'dashboard' | 'scheduled' | 'sent' | 'queue' | 'slack' | 'docs';
  setActiveTab: (tab: 'dashboard' | 'scheduled' | 'sent' | 'queue' | 'slack' | 'docs') => void;
  onOpenCompose: () => void;
  onLogout: () => void;
  onSeedDemo: () => void;
  queueStats: QueueTelemetry | null;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  activeTab,
  setActiveTab,
  onOpenCompose,
  onLogout,
  onSeedDemo,
  queueStats,
}) => {
  const [slackConnected, setSlackConnected] = useState(true);
  const [showUserMenu, setShowUserMenu] = useState(false);

  useEffect(() => {
    fetch('/api/slack/config')
      .then((res) => res.json())
      .then((data) => {
        if (data.connected !== undefined) {
          setSlackConnected(data.connected);
        }
      })
      .catch(() => {});
  }, []);

  const getTabTitle = () => {
    switch (activeTab) {
      case 'dashboard':
        return 'Scheduler Dashboard';
      case 'scheduled':
        return 'Scheduled Emails Queue';
      case 'sent':
        return 'Sent Deliveries & Previews';
      case 'queue':
        return 'BullMQ Queue & Analytics';
      case 'slack':
        return 'Slack Alert Configurations';
      case 'docs':
        return 'Technical Architecture & Spec';
      default:
        return 'Scheduler Dashboard';
    }
  };

  const displayName = user.name || 'Alex Rivera';
  const displayRole = user.role || 'Lead Growth Eng';
  const avatarUrl = user.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(displayName)}`;

  return (
    <header className="h-20 bg-white border-b border-slate-200 px-6 sm:px-8 flex items-center justify-between shrink-0 select-none">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">{getTabTitle()}</h1>
        <p className="text-xs text-slate-400 hidden sm:block">
          Outbox Labs • Persistent Redis BullMQ Worker
        </p>
      </div>

      {/* Right side actions & profile */}
      <div className="flex items-center gap-4 sm:gap-6">
        {/* Quick Demo Seeder button */}
        <button
          onClick={onSeedDemo}
          title="Seed 5 demo leads into queue"
          className="hidden md:flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors border border-slate-200/80"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          <span>Seed 5 Leads</span>
        </button>

        {/* Compose Button */}
        <button
          onClick={onOpenCompose}
          className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all shadow-md shadow-indigo-500/20"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Schedule Email</span>
        </button>

        {/* Slack Connection Pill matching Figma */}
        <button
          onClick={() => setActiveTab('slack')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${
            slackConnected
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
              : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
          }`}
        >
          <Bell className="w-3.5 h-3.5 fill-current" />
          <span className="hidden sm:inline">
            {slackConnected ? 'Slack Connected' : 'Connect Slack'}
          </span>
        </button>

        {/* User Profile matching Figma */}
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-3 border-l border-slate-200 pl-4 sm:pl-6 focus:outline-none"
          >
            <div className="text-right hidden sm:block">
              <p className="text-sm font-bold leading-none text-slate-800">{displayName}</p>
              <p className="text-[11px] text-slate-500 mt-1 uppercase tracking-wider font-semibold">
                {displayRole}
              </p>
            </div>
            <img
              src={avatarUrl}
              alt={displayName}
              className="w-10 h-10 rounded-full border-2 border-white ring-2 ring-indigo-500/20 object-cover bg-slate-100"
            />
          </button>

          {/* User dropdown */}
          {showUserMenu && (
            <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-2xl shadow-xl py-2 z-50">
              <div className="px-4 py-2 border-b border-slate-100">
                <p className="text-xs font-bold text-slate-800">{displayName}</p>
                <p className="text-[11px] text-slate-500 truncate">{user.email}</p>
              </div>
              <a
                href="/admin/queues"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-between px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 font-medium"
              >
                <span>Bull-Board Admin</span>
                <ExternalLink className="w-3 h-3 text-slate-400" />
              </a>
              <button
                onClick={() => {
                  setShowUserMenu(false);
                  onLogout();
                }}
                className="w-full flex items-center gap-2 px-4 py-2 text-xs text-rose-600 hover:bg-rose-50 font-medium"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
