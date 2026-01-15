-- Adjust custom_programs.id to support app-generated IDs (e.g. custom_<uuid>)

DO $$
BEGIN
  IF to_regclass('public.custom_programs') IS NULL THEN
    RAISE NOTICE 'custom_programs table not found, skipping';
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'custom_programs'
      AND column_name = 'id'
      AND data_type = 'uuid'
  ) THEN
    ALTER TABLE custom_programs
      ALTER COLUMN id TYPE TEXT
      USING id::text;
    RAISE NOTICE '✅ Updated custom_programs.id to TEXT';
  ELSE
    RAISE NOTICE 'custom_programs.id already TEXT';
  END IF;
END $$;
