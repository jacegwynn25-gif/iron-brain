-- UI events for lightweight product analytics
CREATE TABLE IF NOT EXISTS ui_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users ON DELETE CASCADE,
  event_name TEXT NOT NULL,
  event_source TEXT NOT NULL DEFAULT 'programs',
  session_id TEXT,
  path TEXT,
  properties JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ui_events_user_created_at ON ui_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ui_events_name ON ui_events(event_name);

ALTER TABLE ui_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own ui events"
  ON ui_events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own ui events"
  ON ui_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);
