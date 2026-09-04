import React, { useState } from 'react';
import { Mail, Shield, CheckCircle2, ArrowRight, Sparkles, User as UserIcon } from 'lucide-react';
import type { User } from '../types.ts';

interface AuthScreenProps {
  onLoginSuccess: (user: User) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onLoginSuccess }) => {
  const [customEmail, setCustomEmail] = useState('');
  const [customName, setCustomName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showCustomInput, setShowCustomInput] = useState(false);

  const handleQuickLogin = async (userPreset: { name: string; email: string; avatar: string; role?: string }) => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userPreset),
      });
      const data = await res.json();
      if (data.user) {
        onLoginSuccess(data.user);
      }
    } catch (err) {
      console.error('Login error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCustomLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customEmail) return;

    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: customName || customEmail.split('@')[0],
          email: customEmail.trim(),
          avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(customEmail)}`,
          role: 'Lead Growth Eng',
        }),
      });
      const data = await res.json();
      if (data.user) {
        onLoginSuccess(data.user);
      }
    } catch (err) {
      console.error('Login error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center z-10">
        <div className="inline-flex h-12 w-12 rounded-xl bg-indigo-600 items-center justify-center shadow-lg shadow-indigo-500/20 mb-4 text-white font-bold text-xl italic">
          R
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">
          ReachInbox<span className="text-indigo-600">.ai</span>
        </h2>
        <p className="mt-1 text-xs text-slate-500 font-medium">
          Production Email Job Scheduler &amp; Queue Controller
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md z-10">
        <div className="bg-white py-8 px-6 shadow-sm border border-slate-200 rounded-2xl sm:px-10 space-y-6">
          <div>
            <h3 className="text-base font-bold text-slate-800">Sign in to your account</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Access the email job scheduler, BullMQ worker analytics, and rate-limit settings.
            </p>
          </div>

          {/* Primary Google Sign-in button */}
          <div className="space-y-3">
            <button
              id="google-signin-btn"
              disabled={isLoading}
              onClick={() =>
                handleQuickLogin({
                  name: 'Sahana Salimath',
                  email: 'sahanaksalimathsahana@gmail.com',
                  avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
                  role: 'Growth Lead & Admin',
                })
              }
              className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-slate-200 rounded-xl shadow-xs bg-white hover:bg-slate-50 text-slate-800 font-semibold text-sm transition-all hover:shadow-sm disabled:opacity-60 cursor-pointer"
            >
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>{isLoading ? 'Signing in...' : 'Sign in with Google'}</span>
            </button>

            {/* Quick Profiles Selector */}
            <div className="pt-2">
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Or Select Workspace Profile
              </p>
              <div className="grid grid-cols-1 gap-2">
                <button
                  type="button"
                  onClick={() =>
                    handleQuickLogin({
                      name: 'Sahana Salimath',
                      email: 'sahanaksalimathsahana@gmail.com',
                      avatar:
                        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
                      role: 'Growth Lead & Admin',
                    })
                  }
                  className="flex items-center gap-3 p-2.5 rounded-xl border border-slate-200 hover:border-indigo-400 bg-slate-50/70 hover:bg-indigo-50/40 text-left transition-all group cursor-pointer"
                >
                  <img
                    src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"
                    alt="Sahana"
                    className="w-8 h-8 rounded-full ring-1 ring-slate-300 object-cover bg-white"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">
                      Sahana Salimath
                    </div>
                    <div className="text-[11px] text-slate-500 truncate">sahanaksalimathsahana@gmail.com</div>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                    Primary
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    handleQuickLogin({
                      name: 'Alex Rivera',
                      email: 'alex.rivera@reachinbox.ai',
                      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alex',
                      role: 'Campaign Lead',
                    })
                  }
                  className="flex items-center gap-3 p-2.5 rounded-xl border border-slate-200 hover:border-indigo-400 bg-slate-50/70 hover:bg-indigo-50/40 text-left transition-all group cursor-pointer"
                >
                  <img
                    src="https://api.dicebear.com/7.x/avataaars/svg?seed=Alex"
                    alt="Alex"
                    className="w-8 h-8 rounded-full ring-1 ring-slate-300 object-cover bg-white"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">
                      Alex Rivera
                    </div>
                    <div className="text-[11px] text-slate-500 truncate">alex.rivera@reachinbox.ai</div>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                    Demo
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* Custom sign in toggle */}
          <div className="pt-2 border-t border-slate-100 text-center">
            <button
              onClick={() => setShowCustomInput(!showCustomInput)}
              className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
            >
              {showCustomInput ? 'Hide custom login' : 'Or sign in with another email address'}
            </button>
          </div>

          {showCustomInput && (
            <form onSubmit={handleCustomLogin} className="space-y-3 pt-2">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  placeholder="e.g. Taylor Swift"
                  value={customName}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCustomName(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Work Email</label>
                <input
                  type="email"
                  required
                  placeholder="name@company.com"
                  value={customEmail}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCustomEmail(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs"
              >
                {isLoading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
