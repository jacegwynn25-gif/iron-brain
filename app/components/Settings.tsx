'use client';

import { Settings as SettingsIcon, LogOut, Trash2, Clock, Shield, Cloud, Bug } from 'lucide-react';
import { CloudSyncButton } from './CloudSyncButton';
import { SyncDebugPanel } from './SyncDebugPanel';

interface SettingsProps {
  name: string;
  email: string;
  onLogout: () => void;
  onClearData: () => void;
  onExtendSession: () => void;
}

export default function Settings({ name, email, onLogout, onClearData, onExtendSession }: SettingsProps) {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-white/5 backdrop-blur-xl p-4 sm:p-5 border border-white/10">
        <div className="flex items-center gap-3 mb-4">
          <div className="rounded-xl bg-white/10 p-3">
            <SettingsIcon className="h-6 w-6 text-purple-300" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Signed in as</p>
            <h2 className="text-xl sm:text-2xl font-bold text-white">{name}</h2>
            <p className="text-sm text-gray-400">{email}</p>
          </div>
        </div>
        <p className="text-sm text-gray-400">
          Manage your session, data, and preferences. Your data is stored locally per user.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl bg-white/5 backdrop-blur-xl p-4 sm:p-5 border border-white/10">
          <div className="mb-3 flex items-center gap-2 text-gray-300">
            <Cloud className="h-5 w-5" />
            <p className="text-xs font-semibold uppercase tracking-wider">Cloud Sync</p>
          </div>
          <p className="text-sm text-gray-400 mb-4">
            Back up your data to the cloud and sync across devices.
          </p>
          <CloudSyncButton />
        </div>

        <div className="rounded-2xl bg-white/5 backdrop-blur-xl p-4 sm:p-5 border border-white/10">
          <div className="mb-3 flex items-center gap-2 text-gray-300">
            <Clock className="h-5 w-5" />
            <p className="text-xs font-semibold uppercase tracking-wider">Session</p>
          </div>
          <p className="text-sm text-gray-400 mb-4">
            Stay signed in for another 30 days on this device.
          </p>
          <button
            onClick={onExtendSession}
            className="w-full rounded-xl btn-primary px-4 py-3 font-semibold text-white shadow-lg shadow-purple-500/20 transition-all active:scale-[0.98]"
          >
            Extend Session
          </button>
        </div>

        <div className="rounded-2xl bg-white/5 backdrop-blur-xl p-4 sm:p-5 border border-white/10">
          <div className="mb-3 flex items-center gap-2 text-gray-300">
            <Trash2 className="h-5 w-5" />
            <p className="text-xs font-semibold uppercase tracking-wider">Data</p>
          </div>
          <p className="text-sm text-gray-400 mb-4">
            Clear all workout history and programs for this user.
          </p>
          <button
            onClick={onClearData}
            className="w-full rounded-xl bg-red-500/20 px-4 py-3 font-semibold text-red-200 border border-red-500/30 transition-all active:scale-[0.98]"
          >
            Clear My Data
          </button>
        </div>

        <div className="rounded-2xl bg-white/5 backdrop-blur-xl p-4 sm:p-5 border border-white/10">
          <div className="mb-3 flex items-center gap-2 text-gray-300">
            <Shield className="h-5 w-5" />
            <p className="text-xs font-semibold uppercase tracking-wider">Account</p>
          </div>
          <p className="text-sm text-gray-400 mb-4">
            Sign out and switch to a different account.
          </p>
          <button
            onClick={onLogout}
            className="w-full rounded-xl bg-white/10 px-4 py-3 font-semibold text-white border border-white/10 transition-all active:scale-[0.98]"
          >
            <span className="inline-flex items-center gap-2 justify-center">
              <LogOut className="h-5 w-5" />
              Sign Out
            </span>
          </button>
        </div>
      </div>

      {/* Debug Panel */}
      <div className="rounded-2xl bg-white/5 backdrop-blur-xl p-4 sm:p-5 border border-white/10">
        <div className="flex items-center gap-3 mb-4">
          <div className="rounded-lg bg-amber-500/20 p-2">
            <Bug className="h-5 w-5 text-amber-300" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">
              Sync Debugger
            </h3>
            <p className="text-sm text-gray-400">
              Diagnose and fix sync issues
            </p>
          </div>
        </div>
        <SyncDebugPanel />
      </div>
    </div>
  );
}
