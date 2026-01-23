# Database Migration Guide

## Phase A.5: Running Migration 016 (Recovery System)

You have two options to run the migration:

---

## Option 1: Supabase Dashboard (Recommended for First Time)

1. **Open Supabase Dashboard**
   - Go to https://supabase.com/dashboard
   - Navigate to your project: `nwqqasofqwoinzrcjivo`
   - Click "SQL Editor" in the left sidebar

2. **Copy Migration SQL**
   - Open: `supabase/migrations/016_recovery_system.sql`
   - Copy the entire contents (400+ lines)

3. **Run Migration**
   - Paste into SQL Editor
   - Click "Run" button
   - Wait for success confirmation (should take 2-3 seconds)

4. **Verify Tables Created**
   - Go to "Table Editor" in left sidebar
   - You should see 7 new tables:
     - `fatigue_events`
     - `user_recovery_parameters`
     - `user_context_data`
     - `user_demographics`
     - `menstrual_cycle_data`
     - `fitness_tracker_connections`
     - `recovery_snapshots`

5. **Verify Functions Created**
   - Go to "Database" → "Functions"
   - You should see:
     - `get_latest_context_data()`
     - `get_workout_history_for_recovery()`
     - `calculate_acwr()`

---

## Option 2: Supabase CLI (Automated)

### Install Supabase CLI:
```bash
npm install -g supabase
```

### Link to Project:
```bash
supabase link --project-ref nwqqasofqwoinzrcjivo
```

### Run Pending Migrations:
```bash
supabase db push
```

This will automatically apply `016_recovery_system.sql` and any other pending migrations.

---

## After Migration: Regenerate TypeScript Types

Once the migration is successful, regenerate database types:

```bash
npx supabase gen types typescript --project-id nwqqasofqwoinzrcjivo > app/lib/supabase/types.ts
```

**Important**: After regenerating types, you need to:
1. Remove all `(supabase as any)` type assertions
2. Update imports in `recovery-integration-service.ts`

---

## Testing the Migration

### 1. Verify RLS Policies
All new tables should have Row Level Security enabled:
```sql
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE tablename IN (
  'fatigue_events',
  'user_recovery_parameters',
  'user_context_data',
  'user_demographics',
  'menstrual_cycle_data',
  'fitness_tracker_connections',
  'recovery_snapshots'
);
```
Expected: All should show `rowsecurity = true`

### 2. Test Helper Functions
```sql
-- Test ACWR calculation (should return NULL or 1.0 for user with no data)
SELECT calculate_acwr('YOUR_USER_ID_HERE');

-- Test workout history fetch (should return empty array)
SELECT * FROM get_workout_history_for_recovery('YOUR_USER_ID_HERE', 90);
```

### 3. Insert Test Context Data
```sql
-- Insert sample sleep data
INSERT INTO user_context_data (user_id, date, sleep_hours, sleep_quality, protein_intake, carb_intake)
VALUES (
  'YOUR_USER_ID_HERE',
  CURRENT_DATE,
  8.0,
  'good',
  2.0,
  4.0
);

-- Verify insert
SELECT * FROM user_context_data WHERE user_id = 'YOUR_USER_ID_HERE';
```

---

## Rollback (If Needed)

If something goes wrong, you can rollback the migration:

```sql
-- Drop all new tables
DROP TABLE IF EXISTS recovery_snapshots CASCADE;
DROP TABLE IF EXISTS fitness_tracker_connections CASCADE;
DROP TABLE IF EXISTS menstrual_cycle_data CASCADE;
DROP TABLE IF EXISTS user_demographics CASCADE;
DROP TABLE IF EXISTS user_context_data CASCADE;
DROP TABLE IF EXISTS user_recovery_parameters CASCADE;
DROP TABLE IF EXISTS fatigue_events CASCADE;

-- Drop helper functions
DROP FUNCTION IF EXISTS calculate_acwr(UUID);
DROP FUNCTION IF EXISTS get_workout_history_for_recovery(UUID, INTEGER);
DROP FUNCTION IF EXISTS get_latest_context_data(UUID);

-- Drop app_settings table
DROP TABLE IF EXISTS app_settings CASCADE;

-- Drop decrement function
DROP FUNCTION IF EXISTS decrement_lifetime_slots();
```

---

## Common Issues

### Issue 1: "relation already exists"
**Cause**: Table already created from previous attempt
**Fix**: Drop the existing table first or modify migration to use `CREATE TABLE IF NOT EXISTS`

### Issue 2: "permission denied"
**Cause**: Not using service role or proper permissions
**Fix**: Make sure you're running as service role in SQL Editor

### Issue 3: "syntax error near..."
**Cause**: Copy/paste issue or incomplete SQL
**Fix**: Re-copy the entire migration file, ensure no truncation

---

## Next Steps After Migration

1. ✅ Migration applied successfully
2. ⏳ Regenerate types: `npx supabase gen types typescript...`
3. ⏳ Remove type assertions from `recovery-integration-service.ts`
4. ⏳ Seed test data (see `TEST-DATA-SEEDING.md`)
5. ⏳ Test recovery assessment end-to-end
6. ⏳ Verify UI displays real data

---

## Migration File Location

`supabase/migrations/016_recovery_system.sql`

This migration creates the complete database schema for the biological recovery simulator integration.
