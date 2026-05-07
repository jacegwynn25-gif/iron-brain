-- ============================================================
-- Add missing RLS policies for analytics tables
-- Fixes bug where Recovery and Efficiency tabs show no data
-- ============================================================

-- ============================================================
-- ENABLE RLS ON ANALYTICS TABLES
-- ============================================================

ALTER TABLE fatigue_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE recovery_estimates ENABLE ROW LEVEL SECURITY;
ALTER TABLE sfr_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_sfr_summaries ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- FATIGUE HISTORY POLICIES
-- ============================================================

CREATE POLICY "Users can view own fatigue history"
  ON fatigue_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own fatigue history"
  ON fatigue_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own fatigue history"
  ON fatigue_history FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own fatigue history"
  ON fatigue_history FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- RECOVERY ESTIMATES POLICIES
-- ============================================================

CREATE POLICY "Users can view own recovery estimates"
  ON recovery_estimates FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own recovery estimates"
  ON recovery_estimates FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own recovery estimates"
  ON recovery_estimates FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own recovery estimates"
  ON recovery_estimates FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- SFR ANALYSES POLICIES
-- ============================================================

CREATE POLICY "Users can view own SFR analyses"
  ON sfr_analyses FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own SFR analyses"
  ON sfr_analyses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own SFR analyses"
  ON sfr_analyses FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own SFR analyses"
  ON sfr_analyses FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- WORKOUT SFR SUMMARIES POLICIES
-- ============================================================

CREATE POLICY "Users can view own workout SFR summaries"
  ON workout_sfr_summaries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own workout SFR summaries"
  ON workout_sfr_summaries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own workout SFR summaries"
  ON workout_sfr_summaries FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own workout SFR summaries"
  ON workout_sfr_summaries FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- VERIFY SETUP
-- ============================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Analytics RLS policies created successfully';
  RAISE NOTICE '   - fatigue_history: 4 policies';
  RAISE NOTICE '   - recovery_estimates: 4 policies';
  RAISE NOTICE '   - sfr_analyses: 4 policies';
  RAISE NOTICE '   - workout_sfr_summaries: 4 policies';
  RAISE NOTICE '';
  RAISE NOTICE '🔒 Users can now save and view their analytics data';
END $$;
