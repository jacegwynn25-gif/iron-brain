'use client';

import { Shield } from 'lucide-react';
import { RecoveryProfile } from '../lib/fatigue/cross-session';

interface RecoveryOverviewProps {
  profiles: RecoveryProfile[];
  loading?: boolean;
}

type Tone = 'emerald' | 'amber' | 'rose' | 'zinc';
type ScaleItem = {
  tone: Tone;
  range: string;
  label: string;
};

const toneTextClass: Record<Tone, string> = {
  emerald: 'text-emerald-300',
  amber: 'text-amber-300',
  rose: 'text-rose-300',
  zinc: 'text-zinc-400',
};

const toneBgClass: Record<Tone, string> = {
  emerald: 'bg-emerald-400',
  amber: 'bg-amber-400',
  rose: 'bg-rose-400',
  zinc: 'bg-zinc-500',
};

const READINESS_SCALE: ScaleItem[] = [
  { tone: 'emerald', range: '8-10', label: 'Optimal' },
  { tone: 'amber', range: '6-7', label: 'Manage' },
  { tone: 'amber', range: '4-5', label: 'Reduced' },
  { tone: 'rose', range: '<4', label: 'Rest' },
];

function getRecoveryTone(score: number): Tone {
  if (score >= 8) return 'emerald';
  if (score >= 6) return 'amber';
  return 'rose';
}

function getRecoveryStatus(score: number): string {
  if (score >= 8) return 'Ready';
  if (score >= 6) return 'Manage Load';
  if (score >= 4) return 'Reduced';
  return 'Rest';
}

function formatTimeAgo(days: number): string {
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return `${days}d ago`;
}

export default function RecoveryOverview({ profiles, loading }: RecoveryOverviewProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-black italic tracking-tight text-white">MUSCLE RECOVERY</h2>
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Loading</span>
        </div>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="animate-pulse rounded-[1.25rem] border border-zinc-900 bg-zinc-950/60 p-4">
            <div className="mb-3 h-5 w-1/3 rounded bg-zinc-800" />
            <div className="h-3 w-full rounded bg-zinc-800" />
          </div>
        ))}
      </div>
    );
  }

  if (profiles.length === 0) {
    return (
      <div className="rounded-[1.25rem] border border-zinc-900 bg-zinc-950/60 p-8 text-center">
        <div className="mb-2 text-xl font-black italic tracking-tight text-zinc-100">NO RECOVERY DATA</div>
        <div className="text-sm text-zinc-500">Complete a workout to start tracking muscle recovery.</div>
      </div>
    );
  }

  const sortedProfiles = [...profiles].sort((a, b) => a.readinessScore - b.readinessScore);

  return (
    <div className="space-y-4">
      <div className="mb-4 flex items-end justify-between gap-4">
        <h2 className="text-xl font-black italic tracking-tight text-white">MUSCLE RECOVERY</h2>
        <div className="text-right">
          <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-zinc-500">Tracked</p>
          <p className="text-sm font-black italic text-zinc-300">
            {profiles.length} muscle{profiles.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {sortedProfiles.map((profile) => {
          const tone = getRecoveryTone(profile.readinessScore);
          const status = getRecoveryStatus(profile.readinessScore);
          const needsLoadManagement = profile.readinessScore < 6;

          return (
            <div
              key={profile.muscleGroup}
              className="rounded-[1.25rem] border border-zinc-900 bg-zinc-950/60 p-4 transition-colors hover:border-zinc-800"
            >
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-zinc-500">Muscle Group</p>
                  <h3 className="mt-1 text-lg font-black italic tracking-tight text-zinc-100 capitalize">
                    {profile.muscleGroup}
                  </h3>
                </div>
                <div className="text-right">
                  <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-zinc-500">Status</p>
                  <p className={`mt-1 text-sm font-black italic uppercase tracking-tight ${toneTextClass[tone]}`}>
                    {status}
                  </p>
                </div>
              </div>

              <div className="mb-4 grid grid-cols-[1fr_auto] items-end gap-4">
                <div>
                  <div className="mb-2 flex items-center justify-between text-xs text-zinc-500">
                    <span>Recovery</span>
                    <span>{Math.round(profile.recoveryPercentage)}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-sm bg-zinc-800">
                    <div
                      className={`h-full ${toneBgClass[tone]} transition-all duration-500`}
                      style={{ width: `${profile.recoveryPercentage}%` }}
                    />
                  </div>
                </div>
                <div className={`text-3xl font-black italic ${toneTextClass[tone]}`}>
                  {profile.readinessScore.toFixed(1)}
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-zinc-500">
                <span>{formatTimeAgo(profile.daysSinceLastTraining)}</span>
                {profile.recoveryPercentage < 95 && (
                  <span>
                    Full: {new Date(profile.estimatedFullRecoveryDate).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                )}
              </div>

              {needsLoadManagement && (
                <div className="mt-3 border-t border-zinc-900 pt-3">
                  <div className="flex items-center gap-2 text-xs text-amber-200">
                    <Shield className="h-4 w-4" />
                    <span>Use a lighter variant or train another area.</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-6 rounded-[1.25rem] border border-zinc-900 bg-zinc-950/60 p-4">
        <div className="mb-3 text-sm font-black italic tracking-tight text-zinc-100">READINESS SCALE</div>
        <div className="grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
          {READINESS_SCALE.map(({ tone, range, label }) => (
            <div key={`${range}-${label}`} className="flex items-center gap-2">
              <div className={`h-3 w-1.5 rounded-sm ${toneBgClass[tone]}`} />
              <span className="text-zinc-400">{range}: {label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
