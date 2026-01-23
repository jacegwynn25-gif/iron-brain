# Test Data Seeding Guide

## Purpose
After running migration 016, seed test data to verify the recovery system works end-to-end.

---

## Prerequisites
- ✅ Migration 016 applied successfully
- ✅ You have a test user ID (get from Supabase Auth dashboard)

---

## Step 1: Get Your Test User ID

Go to Supabase Dashboard → Authentication → Users

Find your test user and copy the UUID (e.g., `a1b2c3d4-e5f6-7890-abcd-ef1234567890`)

**Replace `YOUR_USER_ID` in all SQL below with this UUID**

---

## Step 2: Seed User Demographics

```sql
INSERT INTO user_demographics (
  user_id,
  age,
  sex,
  training_age,
  athletic_background,
  current_injuries,
  chronic_conditions
) VALUES (
  'YOUR_USER_ID',
  28,
  'male',
  3,
  'intermediate',
  ARRAY[]::TEXT[],
  ARRAY[]::TEXT[]
) ON CONFLICT (user_id) DO UPDATE SET
  age = EXCLUDED.age,
  sex = EXCLUDED.sex,
  training_age = EXCLUDED.training_age,
  athletic_background = EXCLUDED.athletic_background;
```

---

## Step 3: Seed Context Data (Last 7 Days)

```sql
-- Generate 7 days of sleep/nutrition data
INSERT INTO user_context_data (user_id, date, sleep_hours, sleep_quality, sleep_interruptions, protein_intake, carb_intake, calorie_balance, hydration_level, meal_timing, work_stress, life_stress, perceived_stress)
VALUES
  ('YOUR_USER_ID', CURRENT_DATE - INTERVAL '0 days', 8.0, 'good', 0, 2.0, 4.0, 'maintenance', 'good', 'good', 3, 3, 3),
  ('YOUR_USER_ID', CURRENT_DATE - INTERVAL '1 days', 7.5, 'good', 1, 1.8, 3.5, 'maintenance', 'fair', 'fair', 4, 3, 4),
  ('YOUR_USER_ID', CURRENT_DATE - INTERVAL '2 days', 7.0, 'fair', 1, 2.2, 4.5, 'surplus', 'good', 'good', 3, 2, 3),
  ('YOUR_USER_ID', CURRENT_DATE - INTERVAL '3 days', 8.5, 'excellent', 0, 2.1, 4.2, 'maintenance', 'excellent', 'good', 2, 2, 2),
  ('YOUR_USER_ID', CURRENT_DATE - INTERVAL '4 days', 6.5, 'poor', 3, 1.5, 3.0, 'deficit', 'poor', 'poor', 6, 5, 6),
  ('YOUR_USER_ID', CURRENT_DATE - INTERVAL '5 days', 7.5, 'good', 1, 1.9, 3.8, 'maintenance', 'good', 'fair', 4, 3, 4),
  ('YOUR_USER_ID', CURRENT_DATE - INTERVAL '6 days', 8.0, 'good', 0, 2.0, 4.0, 'maintenance', 'good', 'good', 3, 3, 3)
ON CONFLICT (user_id, date) DO UPDATE SET
  sleep_hours = EXCLUDED.sleep_hours,
  sleep_quality = EXCLUDED.sleep_quality;
```

---

## Step 4: Seed Workout History (Critical for Recovery Calculations)

### Option A: Use Existing Workout Data

If you already have workout sessions in `workout_sessions` and `set_logs`, create fatigue events from them:

```sql
-- Generate fatigue events from last 30 days of workouts
INSERT INTO fatigue_events (
  user_id,
  timestamp,
  exercise_name,
  sets,
  reps,
  weight,
  rpe,
  volume,
  effective_volume,
  initial_fatigue,
  set_duration,
  rest_interval,
  is_eccentric,
  is_ballistic
)
SELECT
  sl.user_id,
  ws.started_at + (sl.set_number * INTERVAL '3 minutes') AS timestamp,
  e.name AS exercise_name,
  1 AS sets, -- Each set_log is one set
  sl.reps,
  sl.weight,
  sl.rpe,
  sl.weight * sl.reps AS volume,
  (sl.weight * sl.reps * CASE
    WHEN sl.rpe >= 9 THEN 1.0
    WHEN sl.rpe >= 7 THEN 0.7
    ELSE 0.3
  END) AS effective_volume,
  CASE
    WHEN sl.rpe >= 9 THEN 80
    WHEN sl.rpe >= 7 THEN 50
    ELSE 30
  END AS initial_fatigue,
  NULL AS set_duration,
  NULL AS rest_interval,
  false AS is_eccentric,
  false AS is_ballistic
FROM set_logs sl
JOIN workout_sessions ws ON sl.workout_session_id = ws.id
JOIN exercises e ON sl.exercise_id = e.id
WHERE sl.user_id = 'YOUR_USER_ID'
  AND ws.started_at >= CURRENT_DATE - INTERVAL '30 days'
  AND ws.completed_at IS NOT NULL
ORDER BY ws.started_at, sl.set_number;
```

### Option B: Manual Test Data (If No Workout History)

```sql
-- Insert sample workout events from last 7 days
INSERT INTO fatigue_events (
  user_id, timestamp, exercise_name, sets, reps, weight, rpe, volume, effective_volume, initial_fatigue
) VALUES
  -- Day 1: Chest/Triceps (Yesterday)
  ('YOUR_USER_ID', NOW() - INTERVAL '1 day', 'Barbell Bench Press', 4, 8, 225, 8, 1800, 1260, 60),
  ('YOUR_USER_ID', NOW() - INTERVAL '1 day', 'Incline Dumbbell Press', 3, 10, 70, 7, 2100, 1470, 50),
  ('YOUR_USER_ID', NOW() - INTERVAL '1 day', 'Cable Flyes', 3, 12, 30, 6, 1080, 324, 30),
  ('YOUR_USER_ID', NOW() - INTERVAL '1 day', 'Tricep Pushdowns', 3, 12, 60, 7, 2160, 1512, 45),

  -- Day 3: Legs (3 days ago)
  ('YOUR_USER_ID', NOW() - INTERVAL '3 days', 'Barbell Back Squat', 5, 6, 315, 9, 9450, 9450, 90),
  ('YOUR_USER_ID', NOW() - INTERVAL '3 days', 'Romanian Deadlift', 4, 8, 225, 8, 7200, 5040, 70),
  ('YOUR_USER_ID', NOW() - INTERVAL '3 days', 'Leg Press', 3, 12, 400, 7, 14400, 10080, 55),
  ('YOUR_USER_ID', NOW() - INTERVAL '3 days', 'Hamstring Curls', 3, 12, 90, 6, 3240, 972, 35),

  -- Day 5: Back/Biceps (5 days ago)
  ('YOUR_USER_ID', NOW() - INTERVAL '5 days', 'Conventional Deadlift', 4, 5, 405, 9, 8100, 8100, 85),
  ('YOUR_USER_ID', NOW() - INTERVAL '5 days', 'Barbell Rows', 4, 8, 185, 8, 5920, 4144, 65),
  ('YOUR_USER_ID', NOW() - INTERVAL '5 days', 'Pull-Ups', 4, 10, 0, 7, 0, 0, 50),
  ('YOUR_USER_ID', NOW() - INTERVAL '5 days', 'Barbell Curls', 3, 10, 80, 6, 2400, 720, 35),

  -- Day 7: Shoulders (7 days ago)
  ('YOUR_USER_ID', NOW() - INTERVAL '7 days', 'Barbell Overhead Press', 4, 6, 135, 8, 3240, 2268, 70),
  ('YOUR_USER_ID', NOW() - INTERVAL '7 days', 'Dumbbell Lateral Raises', 3, 12, 25, 6, 900, 270, 30),
  ('YOUR_USER_ID', NOW() - INTERVAL '7 days', 'Face Pulls', 3, 15, 50, 5, 2250, 450, 25);
```

---

## Step 5: Verify Data Inserted

### Check Context Data:
```sql
SELECT date, sleep_hours, sleep_quality, protein_intake, carb_intake
FROM user_context_data
WHERE user_id = 'YOUR_USER_ID'
ORDER BY date DESC;
```

Should return 7 rows.

### Check Demographics:
```sql
SELECT age, sex, training_age, athletic_background
FROM user_demographics
WHERE user_id = 'YOUR_USER_ID';
```

Should return 1 row.

### Check Fatigue Events:
```sql
SELECT
  timestamp::DATE as workout_date,
  exercise_name,
  sets,
  reps,
  weight,
  rpe,
  effective_volume
FROM fatigue_events
WHERE user_id = 'YOUR_USER_ID'
ORDER BY timestamp DESC
LIMIT 20;
```

Should return 15+ rows (or more if using Option A).

---

## Step 6: Test Recovery Calculation

### Test ACWR Function:
```sql
SELECT calculate_acwr('YOUR_USER_ID') as acwr;
```

Expected: Number between 0.5 and 2.0 (or NULL if < 7 days data)

### Test Workout History Function:
```sql
SELECT
  timestamp,
  exercise_name,
  sets,
  reps,
  weight,
  volume,
  effective_volume
FROM get_workout_history_for_recovery('YOUR_USER_ID', 30)
ORDER BY timestamp DESC
LIMIT 10;
```

Expected: Returns recent workout events with calculated volumes.

### Test Context Data Function:
```sql
SELECT * FROM get_latest_context_data('YOUR_USER_ID');
```

Expected: Returns most recent context row with sleep/nutrition data.

---

## Step 7: Test Recovery Assessment (via App)

Now that data is seeded, test the integration:

1. **Start Dev Server**:
   ```bash
   npm run dev
   ```

2. **Open App**: http://localhost:3000

3. **Navigate to Workout**:
   - Click "Start Workout" or "Programs" → Select a workout
   - Should trigger PreWorkoutReadiness component

4. **Expected Behavior**:
   - Loading spinner appears briefly
   - Traffic light displays (green/yellow/red based on recovery)
   - Muscle statuses show (Chest, Legs, Back, etc.)
   - Action items display ("Add 5-10 lbs" or "Reduce weight 15%")

5. **Check Browser Console**:
   ```javascript
   // Should see logs from integration service
   // If errors appear, check network tab for failed API calls
   ```

---

## Troubleshooting

### Error: "No data found"
**Cause**: User ID mismatch or data not inserted
**Fix**:
```sql
SELECT id, email FROM auth.users LIMIT 5;
-- Use the correct UUID
```

### Error: "Function does not exist"
**Cause**: Migration 016 not fully applied
**Fix**: Re-run migration SQL

### Error: "Permission denied"
**Cause**: RLS policies blocking read
**Fix**: Check if logged-in user matches seeded user ID

### Recovery shows "0%" or null values
**Cause**: Insufficient workout history (need 7+ days for meaningful ACWR)
**Fix**:
- Add more historical fatigue events (Option A above)
- Or use Option B with extended date range (14-30 days)

---

## Cleanup Test Data

When done testing, remove test data:

```sql
DELETE FROM fatigue_events WHERE user_id = 'YOUR_USER_ID';
DELETE FROM user_context_data WHERE user_id = 'YOUR_USER_ID';
DELETE FROM user_demographics WHERE user_id = 'YOUR_USER_ID';
DELETE FROM recovery_snapshots WHERE user_id = 'YOUR_USER_ID';
```

---

## Next Steps After Successful Test

1. ✅ Data seeded and verified
2. ✅ Recovery calculation working
3. ✅ UI displays real data
4. ⏳ Build onboarding flow (Phase B.1)
5. ⏳ Build daily check-in (Phase B.2)
6. ⏳ Wire workout logger set recommendations (Phase B.4)
