'use client';

import { supabase } from './client';
import { storage } from '../storage';

/**
 * Hybrid storage layer that syncs between localStorage and Supabase
 * - If user is logged in: save to both
 * - If user is not logged in: localStorage only
 * - On load: merge Supabase data with localStorage
 */

export class SyncStorage {
  private userId: string | null = null;

  constructor() {
    // Listen for auth changes
    if (typeof window !== 'undefined') {
      supabase.auth.onAuthStateChange((event, session) => {
        this.userId = session?.user?.id || null;
      });

      // Get initial session
      supabase.auth.getSession().then(({ data: { session } }) => {
        this.userId = session?.user?.id || null;
      });
    }
  }

  async isLoggedIn(): Promise<boolean> {
    if (this.userId) return true;
    const { data } = await supabase.auth.getSession();
    this.userId = data.session?.user?.id || null;
    return !!this.userId;
  }

  /**
   * Save workout session to both localStorage and Supabase (if logged in)
   */
  async saveWorkoutSession(session: any) {
    // Always save to localStorage first
    const localSessions = storage.getWorkoutHistory();
    const updatedSessions = [...localSessions, session];
    storage.setWorkoutHistory(updatedSessions);

    // Sync to Supabase if logged in
    if (await this.isLoggedIn()) {
      try {
        await (supabase.from('workout_sessions') as any).insert({
          user_id: this.userId,
          name: session.name,
          date: session.date,
          start_time: session.startTime,
          end_time: session.endTime,
          duration_minutes: session.durationMinutes,
          bodyweight: session.bodyweight,
          notes: session.notes,
          status: session.status || 'completed',
          // Store local ID for reference
          // We'll use JSONB to store the full session for now
        });
      } catch (error) {
        console.error('Failed to sync to Supabase:', error);
        // Don't throw - localStorage save succeeded
      }
    }
  }

  /**
   * Get workout sessions - merge from both sources
   */
  async getWorkoutSessions(): Promise<any[]> {
    const localSessions = storage.getWorkoutHistory();

    if (!(await this.isLoggedIn())) {
      return localSessions;
    }

    try {
      const { data: supabaseSessions } = await supabase
        .from('workout_sessions')
        .select('*')
        .eq('user_id', this.userId!);

      // Merge logic: prefer Supabase for synced items, keep local-only items
      // For now, just return local (we can enhance merging later)
      return localSessions;
    } catch (error) {
      console.error('Failed to fetch from Supabase:', error);
      return localSessions;
    }
  }
}

export const syncStorage = new SyncStorage();
