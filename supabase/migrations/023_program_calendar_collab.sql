-- Program calendar scheduling + coach/client collaboration (assign-only v1)

-- ============================================================
-- 1) Program schedule events
-- ============================================================
CREATE TABLE IF NOT EXISTS program_schedule_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  program_id TEXT NOT NULL,
  program_name TEXT NOT NULL,
  week_index INTEGER NOT NULL DEFAULT 0 CHECK (week_index >= 0),
  day_index INTEGER NOT NULL DEFAULT 0 CHECK (day_index >= 0),
  session_name TEXT NOT NULL,
  scheduled_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'completed', 'skipped', 'moved')),
  completed_workout_session_id UUID REFERENCES workout_sessions(id) ON DELETE SET NULL,
  completed_at TIMESTAMPTZ,
  moved_from_date DATE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, program_id, week_index, day_index, scheduled_date)
);

CREATE INDEX IF NOT EXISTS idx_program_schedule_events_user_date
  ON program_schedule_events(user_id, scheduled_date DESC);

CREATE INDEX IF NOT EXISTS idx_program_schedule_events_user_status
  ON program_schedule_events(user_id, status, scheduled_date DESC);

DROP TRIGGER IF EXISTS update_program_schedule_events_updated_at ON program_schedule_events;
CREATE TRIGGER update_program_schedule_events_updated_at
  BEFORE UPDATE ON program_schedule_events
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE program_schedule_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own schedule events" ON program_schedule_events;
CREATE POLICY "Users can manage own schedule events"
  ON program_schedule_events FOR ALL
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- ============================================================
-- 2) Coach/client links
-- ============================================================
CREATE TABLE IF NOT EXISTS coach_client_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'rejected', 'revoked')),
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (coach_user_id <> client_user_id),
  UNIQUE (coach_user_id, client_user_id)
);

CREATE INDEX IF NOT EXISTS idx_coach_client_links_coach
  ON coach_client_links(coach_user_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_coach_client_links_client
  ON coach_client_links(client_user_id, status, updated_at DESC);

DROP TRIGGER IF EXISTS update_coach_client_links_updated_at ON coach_client_links;
CREATE TRIGGER update_coach_client_links_updated_at
  BEFORE UPDATE ON coach_client_links
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE coach_client_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Coach or client can view link rows" ON coach_client_links;
CREATE POLICY "Coach or client can view link rows"
  ON coach_client_links FOR SELECT
  USING ((select auth.uid()) = coach_user_id OR (select auth.uid()) = client_user_id);

DROP POLICY IF EXISTS "Coach can create link rows" ON coach_client_links;
CREATE POLICY "Coach can create link rows"
  ON coach_client_links FOR INSERT
  WITH CHECK ((select auth.uid()) = coach_user_id);

DROP POLICY IF EXISTS "Coach or client can update link rows" ON coach_client_links;
CREATE POLICY "Coach or client can update link rows"
  ON coach_client_links FOR UPDATE
  USING ((select auth.uid()) = coach_user_id OR (select auth.uid()) = client_user_id)
  WITH CHECK ((select auth.uid()) = coach_user_id OR (select auth.uid()) = client_user_id);

DROP POLICY IF EXISTS "Coach can delete link rows" ON coach_client_links;
CREATE POLICY "Coach can delete link rows"
  ON coach_client_links FOR DELETE
  USING ((select auth.uid()) = coach_user_id);

-- ============================================================
-- 3) Program assignments (snapshot-based)
-- ============================================================
CREATE TABLE IF NOT EXISTS program_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  link_id UUID REFERENCES coach_client_links(id) ON DELETE SET NULL,
  source_program_id TEXT NOT NULL,
  source_program_name TEXT NOT NULL,
  assigned_program_id TEXT,
  program_snapshot JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'assigned'
    CHECK (status IN ('assigned', 'accepted', 'archived')),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_program_assignments_coach
  ON program_assignments(coach_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_program_assignments_client
  ON program_assignments(client_user_id, created_at DESC);

DROP TRIGGER IF EXISTS update_program_assignments_updated_at ON program_assignments;
CREATE TRIGGER update_program_assignments_updated_at
  BEFORE UPDATE ON program_assignments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE program_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Coach or client can view assignments" ON program_assignments;
CREATE POLICY "Coach or client can view assignments"
  ON program_assignments FOR SELECT
  USING ((select auth.uid()) = coach_user_id OR (select auth.uid()) = client_user_id);

DROP POLICY IF EXISTS "Coach can create assignments" ON program_assignments;
CREATE POLICY "Coach can create assignments"
  ON program_assignments FOR INSERT
  WITH CHECK ((select auth.uid()) = coach_user_id);

DROP POLICY IF EXISTS "Coach or client can update assignments" ON program_assignments;
CREATE POLICY "Coach or client can update assignments"
  ON program_assignments FOR UPDATE
  USING ((select auth.uid()) = coach_user_id OR (select auth.uid()) = client_user_id)
  WITH CHECK ((select auth.uid()) = coach_user_id OR (select auth.uid()) = client_user_id);
