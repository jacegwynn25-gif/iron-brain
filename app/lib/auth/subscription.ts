'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../supabase/auth-context';
import { supabase } from '../supabase/client';

export type SubscriptionTier = 'free' | 'pro_lifetime' | 'pro_monthly';

export interface Subscription {
  isPro: boolean;
  tier: SubscriptionTier;
  expiresAt: string | null;
  lifetimeSlotsRemaining: number | null;
}

export function useSubscription() {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<Subscription>({
    isPro: false,
    tier: 'free',
    expiresAt: null,
    lifetimeSlotsRemaining: null
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) {
      setSubscription({ isPro: false, tier: 'free', expiresAt: null, lifetimeSlotsRemaining: null });
      setLoading(false);
      return;
    }

    const fetchSubscription = async () => {
      // TODO: Update types after running migration 003_subscription_system
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('is_pro, subscription_tier, subscription_expires_at')
        .eq('id', user.id)
        .single();

      const { data: settings } = await supabase
        .from('app_settings' as any)
        .select('lifetime_slots_remaining')
        .eq('id', 'singleton')
        .single();

      setSubscription({
        isPro: (profile as any)?.is_pro ?? false,
        tier: ((profile as any)?.subscription_tier as SubscriptionTier) ?? 'free',
        expiresAt: (profile as any)?.subscription_expires_at ?? null,
        lifetimeSlotsRemaining: (settings as any)?.lifetime_slots_remaining ?? null
      });
      setLoading(false);
    };

    fetchSubscription();
  }, [user]);

  return { subscription, loading };
}

// Feature gating helper
export function checkFeatureAccess(featureName: string, subscription: Subscription): boolean {
  const proFeatures = [
    'pre_workout_readiness',
    'set_recommendations',
    'session_fatigue',
    'muscle_recovery',
    'sfr_analysis',
    'advanced_analytics',
    'acwr_trends'
  ];

  if (!proFeatures.includes(featureName)) return true; // Free feature
  return subscription.isPro;
}
