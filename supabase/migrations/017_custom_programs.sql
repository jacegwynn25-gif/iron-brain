-- Custom Programs Cloud Sync
-- Stores user-created and modified programs in the cloud

CREATE TABLE IF NOT EXISTS custom_programs (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  -- Store entire program as JSONB for fast sync
  program_data JSONB NOT NULL,

  -- Metadata for quick queries
  name TEXT NOT NULL,
  is_custom BOOLEAN DEFAULT true,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique constraint: one program ID per user
  UNIQUE(user_id, id)
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_custom_programs_user
  ON custom_programs(user_id, updated_at DESC);

-- RLS policies
ALTER TABLE custom_programs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own custom programs"
  ON custom_programs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own custom programs"
  ON custom_programs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own custom programs"
  ON custom_programs FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own custom programs"
  ON custom_programs FOR DELETE
  USING (auth.uid() = user_id);

-- Update timestamp trigger
CREATE TRIGGER update_custom_programs_updated_at
  BEFORE UPDATE ON custom_programs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Created custom_programs table with RLS';
  RAISE NOTICE '   - Programs stored as JSONB for fast sync';
  RAISE NOTICE '   - Auto-save enabled for cross-device access';
END $$;
