'use client';

import { Settings as SettingsIcon, LogOut, Trash2, Clock, Shield, Cloud } from 'lucide-react';
import { CloudSyncButton } from './CloudSyncButton';

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
      <div className="rounded-3xl bg-gradient-to-br from-purple-600 via-purple-700 to-indigo-700 p-8 shadow-2xl text-white animate-slideUp">
        <div className="flex items-center gap-3 mb-4">
          <div className="rounded-xl bg-white/20 p-3 backdrop-blur-sm">
            <SettingsIcon className="h-7 w-7" />
          </div>
          <div>
            <p className="text-sm font-semibold opacity-80">Signed in as</p>
            <h2 className="text-3xl font-black">{name}</h2>
            <p className="text-sm font-medium opacity-80">{email}</p>
          </div>
        </div>
        <p className="text-sm font-medium opacity-80">
          Manage your session, data, and preferences. Your data is stored locally per user.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl bg-white p-6 shadow-lg border-2 border-blue-100 dark:bg-zinc-900 dark:border-blue-900/40">
          <div className="mb-3 flex items-center gap-2 text-blue-700 dark:text-blue-200">
            <Cloud className="h-5 w-5" />
            <p className="text-sm font-bold uppercase tracking-wide">Cloud Sync</p>
          </div>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
            Back up your data to the cloud and sync across devices.
          </p>
          <CloudSyncButton />
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-lg border-2 border-purple-100 dark:bg-zinc-900 dark:border-purple-900/40">
          <div className="mb-3 flex items-center gap-2 text-purple-700 dark:text-purple-200">
            <Clock className="h-5 w-5" />
            <p className="text-sm font-bold uppercase tracking-wide">Session</p>
          </div>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
            Stay signed in for another 30 days on this device.
          </p>
          <button
            onClick={onExtendSession}
            className="w-full rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 px-4 py-3 font-bold text-white shadow-lg transition-all hover:shadow-xl hover:scale-[1.01]"
          >
            Extend Session
          </button>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-lg border-2 border-red-100 dark:bg-zinc-900 dark:border-red-900/40">
          <div className="mb-3 flex items-center gap-2 text-red-700 dark:text-red-200">
            <Trash2 className="h-5 w-5" />
            <p className="text-sm font-bold uppercase tracking-wide">Data</p>
          </div>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
            Clear all workout history and programs for this user.
          </p>
          <button
            onClick={onClearData}
            className="w-full rounded-xl bg-red-600 px-4 py-3 font-bold text-white shadow-lg transition-all hover:shadow-xl hover:scale-[1.01]"
          >
            Clear My Data
          </button>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-lg border-2 border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800">
          <div className="mb-3 flex items-center gap-2 text-zinc-800 dark:text-zinc-200">
            <Shield className="h-5 w-5" />
            <p className="text-sm font-bold uppercase tracking-wide">Account</p>
          </div>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
            Sign out and switch to a different account.
          </p>
          <button
            onClick={onLogout}
            className="w-full rounded-xl bg-zinc-900 px-4 py-3 font-bold text-white shadow-lg transition-all hover:shadow-xl hover:scale-[1.01] dark:bg-zinc-100 dark:text-zinc-900"
          >
            <span className="inline-flex items-center gap-2 justify-center">
              <LogOut className="h-5 w-5" />
              Sign Out
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
