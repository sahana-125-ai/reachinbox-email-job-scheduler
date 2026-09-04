import React, { useState, useEffect, useCallback } from 'react';
import { Sidebar } from './components/Sidebar.tsx';
import { Header } from './components/Header.tsx';
import { DashboardOverview } from './components/DashboardOverview.tsx';
import { AuthScreen } from './components/AuthScreen.tsx';
import { ComposeModal } from './components/ComposeModal.tsx';
import { ScheduledTable } from './components/ScheduledTable.tsx';
import { SentTable } from './components/SentTable.tsx';
import { QueueMonitor } from './components/QueueMonitor.tsx';
import { SlackSettings } from './components/SlackSettings.tsx';
import { ArchitectureDocs } from './components/ArchitectureDocs.tsx';
import type { User, EmailItem, QueueTelemetry } from './types.ts';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'scheduled' | 'sent' | 'queue' | 'slack' | 'docs'>('dashboard');
  const [isComposeOpen, setIsComposeOpen] = useState(false);

  // Email lists & Search state
  const [scheduledEmails, setScheduledEmails] = useState<EmailItem[]>([]);
  const [sentEmails, setSentEmails] = useState<EmailItem[]>([]);
  const [scheduledLoading, setScheduledLoading] = useState(false);
  const [sentLoading, setSentLoading] = useState(false);
  const [scheduledSearch, setScheduledSearch] = useState('');
  const [sentSearch, setSentSearch] = useState('');

  // Queue stats
  const [queueStats, setQueueStats] = useState<QueueTelemetry | null>(null);
  const [queueLoading, setQueueLoading] = useState(false);

  // Toast feedback
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Check initial user authentication
  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (data.user) {
          setUser(data.user);
        }
      })
      .catch((err) => console.error('Auth check error:', err))
      .finally(() => setAuthLoading(false));
  }, []);

  // Fetch Queue Telemetry
  const fetchQueueStats = useCallback(async () => {
    try {
      const res = await fetch('/api/queue/stats');
      const data = await res.json();
      setQueueStats(data);
    } catch (err) {
      console.error('Failed to fetch queue stats:', err);
    }
  }, []);

  // Fetch Scheduled Emails
  const fetchScheduledEmails = useCallback(async () => {
    setScheduledLoading(true);
    try {
      let url = '/api/emails/scheduled';
      if (scheduledSearch.trim()) {
        url = `/api/search?q=${encodeURIComponent(scheduledSearch.trim())}&status=scheduled`;
      }
      const res = await fetch(url);
      const data = await res.json();
      if (data.emails) {
        setScheduledEmails(data.emails);
      }
    } catch (err) {
      console.error('Failed to fetch scheduled emails:', err);
    } finally {
      setScheduledLoading(false);
    }
  }, [scheduledSearch]);

  // Fetch Sent Emails
  const fetchSentEmails = useCallback(async () => {
    setSentLoading(true);
    try {
      let url = '/api/emails/sent';
      if (sentSearch.trim()) {
        url = `/api/search?q=${encodeURIComponent(sentSearch.trim())}&status=sent`;
      }
      const res = await fetch(url);
      const data = await res.json();
      if (data.emails) {
        setSentEmails(data.emails);
      }
    } catch (err) {
      console.error('Failed to fetch sent emails:', err);
    } finally {
      setSentLoading(false);
    }
  }, [sentSearch]);

  // Initial and dependent fetches
  useEffect(() => {
    if (!user) return;
    fetchScheduledEmails();
    fetchSentEmails();
    fetchQueueStats();

    // Auto-refresh telemetry & lists periodically (live BullMQ view)
    const interval = setInterval(() => {
      fetchQueueStats();
      if (activeTab === 'dashboard' || activeTab === 'scheduled') {
        fetchScheduledEmails();
      }
      if (activeTab === 'dashboard' || activeTab === 'sent') {
        fetchSentEmails();
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [user, activeTab, fetchScheduledEmails, fetchSentEmails, fetchQueueStats]);

  // Handle Cancel Email
  const handleCancelEmail = async (id: string) => {
    try {
      const res = await fetch(`/api/emails/${id}/cancel`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        showToast('Email cancelled from BullMQ queue', 'info');
        fetchScheduledEmails();
        fetchQueueStats();
      } else {
        showToast(data.error || 'Failed to cancel', 'error');
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // Handle Force Send Now
  const handleSendNowEmail = async (id: string) => {
    try {
      const res = await fetch(`/api/emails/${id}/send-now`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        showToast('Email prioritized to the front of BullMQ queue', 'success');
        fetchScheduledEmails();
        fetchQueueStats();
      } else {
        showToast(data.error || 'Failed to prioritize', 'error');
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // Handle Update Scheduler Settings
  const handleUpdateSettings = async (newSettings: {
    concurrency?: number;
    minDelayMs?: number;
    maxEmailsPerHour?: number;
  }) => {
    try {
      const res = await fetch('/api/scheduler/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings),
      });
      if (res.ok) {
        showToast('Scheduler & Worker settings saved', 'success');
        fetchQueueStats();
      }
    } catch (err) {
      console.error('Failed to update settings:', err);
    }
  };

  // Quick Demo Seeder (5 sample leads with delays)
  const handleSeedDemo = async () => {
    try {
      const sampleLeads = [
        'lead.sarah@acme-enterprises.com',
        'alex.chen@innovatetech.io',
        'jordan.smith@apexsolutions.co',
        'elena.rostova@cloudscale.net',
        'marcus.vance@outreachleaders.org',
      ];

      const res = await fetch('/api/emails/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.id || 'usr_reachinbox_default',
          senderEmail: 'outreach@reachinbox.ai',
          recipients: sampleLeads,
          subject: 'Transforming cold email workflows with AI & BullMQ',
          body: 'Hi {{name}},\n\nI was reviewing your growth operations at {{email}} and wanted to show you how ReachInbox automates high-deliverability cold email sequences.\n\nBest,\nReachInbox Growth',
          startTime: new Date(Date.now() + 2000).toISOString(),
          delayBetweenEmailsMs: 2000,
          hourlyLimit: 25,
        }),
      });

      if (res.ok) {
        showToast('5 Demo leads scheduled with 2s pacing!', 'success');
        fetchScheduledEmails();
        fetchQueueStats();
      }
    } catch (err: any) {
      showToast('Failed to seed demo leads: ' + err.message, 'error');
    }
  };

  // Logout handler
  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setUser(null);
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#F3F4F6] flex items-center justify-center text-slate-500 text-sm">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin" />
          <span>Starting ReachInbox Email Scheduler...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthScreen onLoginSuccess={(loggedInUser) => setUser(loggedInUser)} />;
  }

  return (
    <div className="h-screen w-full flex bg-[#F3F4F6] text-slate-800 font-sans overflow-hidden select-none">
      {/* Toast notification banner */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 animate-bounce">
          <div
            className={`px-4 py-2.5 rounded-xl shadow-xl border text-xs font-semibold flex items-center gap-2 ${
              toast.type === 'error'
                ? 'bg-rose-50 border-rose-200 text-rose-700'
                : 'bg-indigo-600 text-white border-indigo-600 shadow-indigo-500/20'
            }`}
          >
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {/* Left Sidebar matching Figma */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        queueStats={queueStats}
        scheduledCount={scheduledEmails.length}
        sentCount={sentEmails.length}
      />

      {/* Main View Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-[#F3F4F6]">
        {/* Top Header matching Figma */}
        <Header
          user={user}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onOpenCompose={() => setIsComposeOpen(true)}
          onLogout={handleLogout}
          onSeedDemo={handleSeedDemo}
          queueStats={queueStats}
        />

        {/* Dynamic Tab Body */}
        <main className="flex-1 overflow-y-auto p-6 sm:p-8 no-scrollbar">
          {activeTab === 'dashboard' && (
            <DashboardOverview
              scheduledEmails={scheduledEmails}
              sentEmails={sentEmails}
              queueStats={queueStats}
              onCancelEmail={handleCancelEmail}
              onSendNowEmail={handleSendNowEmail}
              onOpenCompose={() => setIsComposeOpen(true)}
              onSeedDemo={handleSeedDemo}
              onRefresh={() => {
                fetchScheduledEmails();
                fetchSentEmails();
                fetchQueueStats();
              }}
              user={user}
            />
          )}

          {activeTab === 'scheduled' && (
            <ScheduledTable
              emails={scheduledEmails}
              isLoading={scheduledLoading}
              onRefresh={fetchScheduledEmails}
              onCancelEmail={handleCancelEmail}
              onSendNowEmail={handleSendNowEmail}
              searchQuery={scheduledSearch}
              setSearchQuery={setScheduledSearch}
              onOpenCompose={() => setIsComposeOpen(true)}
              onSeedDemo={handleSeedDemo}
            />
          )}

          {activeTab === 'sent' && (
            <SentTable
              emails={sentEmails}
              isLoading={sentLoading}
              onRefresh={fetchSentEmails}
              searchQuery={sentSearch}
              setSearchQuery={setSentSearch}
              onOpenCompose={() => setIsComposeOpen(true)}
            />
          )}

          {activeTab === 'queue' && (
            <QueueMonitor
              stats={queueStats}
              isLoading={queueLoading}
              onRefresh={fetchQueueStats}
              onUpdateSettings={handleUpdateSettings}
              onSeedDemo={handleSeedDemo}
            />
          )}

          {activeTab === 'slack' && <SlackSettings user={user} />}

          {activeTab === 'docs' && <ArchitectureDocs />}
        </main>
      </div>

      {/* Compose Email Modal */}
      <ComposeModal
        isOpen={isComposeOpen}
        onClose={() => setIsComposeOpen(false)}
        onScheduledSuccess={() => {
          showToast('Campaign successfully scheduled via BullMQ!', 'success');
          fetchScheduledEmails();
          fetchQueueStats();
        }}
        user={user}
      />
    </div>
  );
}
