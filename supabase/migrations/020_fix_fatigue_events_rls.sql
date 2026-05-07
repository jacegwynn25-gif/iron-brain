-- Fix RLS policies for fatigue_events table
-- Migration 017: Add missing RLS policies

-- Drop existing policies if any (just to be safe)
DROP POLICY IF EXISTS "Users can view own fatigue events" ON fatigue_events;
DROP POLICY IF EXISTS "Users can insert own fatigue events" ON fatigue_events;

-- Create policies for fatigue_events
CREATE POLICY "Users can view own fatigue events"
  ON fatigue_events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own fatigue events"
  ON fatigue_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Also ensure users can UPDATE their own fatigue events (for corrections)
CREATE POLICY "Users can update own fatigue events"
  ON fatigue_events FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Allow users to delete their own fatigue events (for cleanup)
CREATE POLICY "Users can delete own fatigue events"
  ON fatigue_events FOR DELETE
  USING (auth.uid() = user_id);
