-- Add app_metadata column to program_templates for hybrid app/database sync
ALTER TABLE program_templates ADD COLUMN IF NOT EXISTS app_metadata JSONB DEFAULT '{}'::jsonb;

-- Create index for faster lookups by app_program_id
CREATE INDEX IF NOT EXISTS idx_program_templates_app_metadata ON program_templates USING gin(app_metadata);

-- Verify
DO $$
BEGIN
  RAISE NOTICE 'Added app_metadata column to program_templates';
END $$;
