'use client';

import { useState } from 'react';
import { X, Zap, TrendingUp, Shield, Brain, AlertCircle } from 'lucide-react';
import { useSubscription } from '../lib/auth/subscription';
import { useRouter } from 'next/navigation';
import { useAuth } from '../lib/supabase/auth-context';

interface PaywallProps {
  onClose: () => void;
  feature: string; // e.g., "Pre-Workout Readiness"
}

export default function Paywall({ onClose, feature }: PaywallProps) {
  const { subscription } = useSubscription();
  const { user } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const slotsRemaining = subscription.lifetimeSlotsRemaining ?? 200;
  const slotsFilled = 200 - slotsRemaining;

  const handleUpgrade = () => {
    setError(null);
    if (!user?.id) {
      setError('Please sign in to upgrade');
      return;
    }
    setLoading(true);
    router.push(`/api/checkout?tier=lifetime&user_id=${user.id}`);
  };

  const handleMonthly = () => {
    setError(null);
    if (!user?.id) {
      setError('Please sign in to subscribe');
      return;
    }
    setLoading(true);
    router.push(`/api/checkout?tier=monthly&user_id=${user.id}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
      <div className="max-w-2xl w-full rounded-2xl bg-gradient-to-br from-purple-900/50 to-fuchsia-900/50 border border-purple-500/30 backdrop-blur-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="relative p-6 border-b border-white/10">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 rounded-lg p-2 text-gray-400 hover:bg-white/10 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-3 mb-2">
            <Brain className="h-8 w-8 text-purple-300" />
            <h2 className="text-2xl font-bold text-white">Unlock Iron Pro</h2>
          </div>
          <p className="text-purple-200">
            You&apos;ve discovered <span className="font-semibold text-white">{feature}</span>
          </p>
        </div>

        {/* Value Prop */}
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex items-start gap-3 p-4 rounded-xl bg-white/5 border border-white/10">
              <TrendingUp className="h-6 w-6 text-emerald-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-white mb-1">Maximize Gains</p>
                <p className="text-sm text-gray-300">PhD-level algorithms optimize every set</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 rounded-xl bg-white/5 border border-white/10">
              <Shield className="h-6 w-6 text-blue-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-white mb-1">Prevent Injury</p>
                <p className="text-sm text-gray-300">ACWR predicts overtraining before it happens</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 rounded-xl bg-white/5 border border-white/10">
              <Zap className="h-6 w-6 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-white mb-1">Zero Guessing</p>
                <p className="text-sm text-gray-300">Know exactly what weight to lift, every set</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 rounded-xl bg-white/5 border border-white/10">
              <Brain className="h-6 w-6 text-purple-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-white mb-1">Your Scientist</p>
                <p className="text-sm text-gray-300">Bayesian models learn YOUR optimal training</p>
              </div>
            </div>
          </div>
        </div>

        {/* Pricing */}
        <div className="p-6 bg-black/20 space-y-3">
          {/* Founding Member Option */}
          <div className="relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-bold px-3 py-1 rounded-full">
              LIMITED TIME
            </div>
            <div className="rounded-xl border-2 border-amber-500/50 bg-gradient-to-br from-amber-500/20 to-orange-500/20 p-6">
              <div className="flex items-baseline justify-between mb-4">
                <div>
                  <h3 className="text-xl font-bold text-white mb-1">Founding Member</h3>
                  <p className="text-sm text-amber-200">Lifetime Access - Never Pay Again</p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold text-white">$149</p>
                  <p className="text-xs text-gray-300">one-time</p>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mb-4">
                <div className="flex justify-between text-xs text-amber-200 mb-1">
                  <span>{slotsFilled}/200 Founding Members</span>
                  <span>{slotsRemaining} slots remaining</span>
                </div>
                <div className="h-2 rounded-full bg-black/40">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all"
                    style={{ width: `${(slotsFilled / 200) * 100}%` }}
                  />
                </div>
              </div>

              <button
                onClick={handleUpgrade}
                disabled={loading}
                className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-4 font-bold text-white shadow-lg shadow-amber-500/30 hover:shadow-xl hover:scale-[1.02] transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Redirecting...' : 'Become a Founding Member'}
              </button>
            </div>
          </div>

          {/* Monthly Option (Anchor) */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-6">
            <div className="flex items-baseline justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-white mb-1">Monthly Subscription</h3>
                <p className="text-sm text-gray-400">Cancel anytime</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-white">$12.99</p>
                <p className="text-xs text-gray-400">per month</p>
              </div>
            </div>
            <button
              onClick={handleMonthly}
              disabled={loading}
              className="w-full rounded-xl border border-white/20 bg-white/10 px-6 py-3 font-semibold text-white hover:bg-white/20 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Redirecting...' : 'Subscribe Monthly'}
            </button>
          </div>

          {error && (
            <div className="flex items-center justify-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <p className="text-center text-xs text-gray-400">
            Secure payment powered by Stripe • Cancel anytime
          </p>
        </div>
      </div>
    </div>
  );
}
