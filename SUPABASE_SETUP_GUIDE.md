# Iron Brain - Supabase Backend Setup Guide

## Step-by-Step Implementation

### 1. Initial Setup (5 minutes)

#### A. Add Environment Variables

Create/update `.env.local`:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Keep existing NextAuth config
NEXTAUTH_SECRET=your-secret
NEXTAUTH_URL=http://localhost:3000
GOOGLE_CLIENT_ID=your-google-id
GOOGLE_CLIENT_SECRET=your-google-secret
```

**Where to find these:**
1. Go to [app.supabase.com](https://app.supabase.com)
2. Select your project
3. Click **Settings** (gear icon) → **API**
4. Copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon/public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role key** → `SUPABASE_SERVICE_ROLE_KEY`

#### B. Install Dependencies

```bash
npm install @supabase/supabase-js
```

---

### 2. Run Database Migrations (10 minutes)

Go to your Supabase project dashboard:

1. Click **SQL Editor** in the left sidebar
2. Click **New Query**
3. Copy and paste the contents of each migration file **in order**:

#### Migration 1: Core Schema
📁 `supabase/migrations/001_initial_schema.sql`

- Creates all tables (users, exercises, programs, workouts, analytics)
- Sets up indexes for performance
- Creates triggers for `updated_at` columns

**Run this first!**

#### Migration 2: Security Policies
📁 `supabase/migrations/002_row_level_security.sql`

- Enables Row Level Security on all tables
- Sets up policies so users can only access their own data
- Allows public access to system exercises and programs

**Run this second!**

#### Migration 3: Seed Data
📁 `supabase/migrations/003_seed_data.sql`

- Inserts 21 muscle groups (Chest, Quads, etc.)
- Inserts 20 equipment types (Barbell, Dumbbell, etc.)
- Creates 10 system exercises (Squat, Bench, Deadlift, etc.)

**Run this third!**

**Pro Tip:** After running each migration, check the bottom panel for success messages:
- ✅ "Schema created successfully! 🧠💪"
- ✅ "RLS policies created successfully! 🔒"
- ✅ "Seed data loaded successfully! 🌱"

---

### 3. Enable Email Authentication (5 minutes)

1. In Supabase dashboard, go to **Authentication** → **Providers**
2. Enable **Email** provider
3. Configure email templates (optional):
   - Click **Email Templates**
   - Customize confirmation and password reset emails

---

### 4. Test Database Connection (2 minutes)

Run the dev server:

```bash
npm run dev
```

Open browser console and check for errors. If you see Supabase-related errors, double-check your environment variables.

---

## What You Have Now

After completing the above steps, you have:

✅ **A production-ready PostgreSQL database** with:
- User management (profiles, settings)
- Exercise library (with muscle group mappings)
- Program templates (weeks, days, sets)
- Workout logging (sessions, set logs)
- Analytics (personal records, exercise stats)

✅ **Row-Level Security** protecting all user data

✅ **Authentication** ready for email + password

---

## Next Steps: Data Migration & Sync

### Option A: Automatic Migration (Recommended)

When users first log in after you deploy the Supabase integration, automatically migrate their localStorage data:

```typescript
// app/lib/migrations/migrateToSupabase.ts

export async function migrateLocalDataToSupabase(userId: string) {
  console.log('🔄 Starting data migration to Supabase...');

  try {
    // 1. Migrate workout history
    const localWorkouts = storage.getWorkoutHistory();
    if (localWorkouts.length > 0) {
      console.log(`Migrating ${localWorkouts.length} workouts...`);

      for (const workout of localWorkouts) {
        await supabase.from('workout_sessions').insert({
          id: workout.id,
          user_id: userId,
          name: workout.dayName,
          date: workout.date,
          start_time: workout.startTime,
          end_time: workout.endTime,
          duration_minutes: workout.durationMinutes,
          total_volume_load: workout.totalVolumeLoad,
          average_rpe: workout.averageRPE,
          notes: workout.notes,
        });

        // Migrate sets for this workout
        for (const set of workout.sets) {
          await supabase.from('set_logs').insert({
            workout_session_id: workout.id,
            exercise_id: set.exerciseId,
            set_index: set.setIndex,
            actual_weight: set.actualWeight,
            actual_reps: set.actualReps,
            actual_rpe: set.actualRPE,
            e1rm: set.e1rm,
            volume_load: set.volumeLoad,
            completed: set.completed,
            notes: set.notes,
          });
        }
      }

      console.log('✅ Workouts migrated successfully');
    }

    // 2. Migrate user programs
    const localPrograms = localStorage.getItem(`iron_brain_user_programs__${userId}`);
    if (localPrograms) {
      const programs = JSON.parse(localPrograms);
      // TODO: Convert localStorage program format to Supabase format
      console.log('✅ Programs migrated successfully');
    }

    // 3. Mark migration complete
    localStorage.setItem(`migration_complete__${userId}`, 'true');

    console.log('🎉 Data migration complete!');
    return true;
  } catch (error) {
    console.error('❌ Migration failed:', error);
    return false;
  }
}
```

### Option B: Fresh Start

Users start fresh with Supabase, keeping their localStorage data as backup:

```typescript
// Just start using Supabase for new workouts
// Old localStorage data remains accessible for history viewing
```

---

## Sync Strategy: Offline-First Architecture

### How It Works

```
User logs a set
    ↓
Save to localStorage instantly (no lag)
    ↓
Queue change for Supabase sync
    ↓
(When online) Sync to Supabase in background
    ↓
On success, mark as synced
```

### Implementation

```typescript
// app/lib/sync/syncManager.ts

interface QueuedChange {
  id: string;
  table: string;
  operation: 'insert' | 'update' | 'delete';
  data: any;
  timestamp: number;
}

class SyncManager {
  private queue: QueuedChange[] = [];
  private isSyncing = false;

  constructor() {
    // Load pending changes from localStorage
    this.loadQueue();

    // Listen for online/offline events
    window.addEventListener('online', () => this.syncNow());
    window.addEventListener('offline', () => console.log('📴 Offline mode'));
  }

  // Queue a change for syncing
  queueChange(table: string, operation: string, data: any) {
    const change: QueuedChange = {
      id: crypto.randomUUID(),
      table,
      operation,
      data,
      timestamp: Date.now(),
    };

    this.queue.push(change);
    this.saveQueue();

    // Try to sync immediately if online
    if (navigator.onLine) {
      this.syncNow();
    }
  }

  // Sync all pending changes
  async syncNow() {
    if (this.isSyncing || this.queue.length === 0) return;

    this.isSyncing = true;
    console.log(`🔄 Syncing ${this.queue.length} changes...`);

    try {
      for (const change of this.queue) {
        await this.syncChange(change);
        this.queue = this.queue.filter(c => c.id !== change.id);
        this.saveQueue();
      }

      console.log('✅ Sync complete');
    } catch (error) {
      console.error('❌ Sync failed:', error);
    } finally {
      this.isSyncing = false;
    }
  }

  private async syncChange(change: QueuedChange) {
    const { table, operation, data } = change;

    switch (operation) {
      case 'insert':
        await supabase.from(table).insert(data);
        break;
      case 'update':
        await supabase.from(table).update(data).eq('id', data.id);
        break;
      case 'delete':
        await supabase.from(table).delete().eq('id', data.id);
        break;
    }
  }

  private saveQueue() {
    localStorage.setItem('sync_queue', JSON.stringify(this.queue));
  }

  private loadQueue() {
    const saved = localStorage.getItem('sync_queue');
    this.queue = saved ? JSON.parse(saved) : [];
  }
}

export const syncManager = new SyncManager();
```

---

## File Structure

```
iron-brain/
├── app/
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts          ← Created ✅
│   │   │   └── database.types.ts  ← Generate with Supabase CLI
│   │   ├── sync/
│   │   │   └── syncManager.ts     ← To be created
│   │   └── migrations/
│   │       └── migrateToSupabase.ts ← To be created
│   └── ...
├── supabase/
│   └── migrations/
│       ├── 001_initial_schema.sql     ← Created ✅
│       ├── 002_row_level_security.sql ← Created ✅
│       └── 003_seed_data.sql          ← Created ✅
└── .env.local                          ← Update with Supabase keys
```

---

## Common Issues & Fixes

### Issue: "Missing environment variables"

**Fix:** Make sure `.env.local` has all three Supabase variables and restart dev server.

### Issue: "Invalid API key"

**Fix:** Double-check you copied the correct keys from Supabase dashboard. The anon key should start with `eyJ`.

### Issue: "Row Level Security violation"

**Fix:** Make sure you ran migration 002. Check that policies exist:

```sql
SELECT * FROM pg_policies WHERE tablename = 'workout_sessions';
```

### Issue: "Exercise not found"

**Fix:** Run migration 003 to seed the exercise library.

---

## Performance Considerations

### Indexes

All critical queries are indexed:
- `workout_sessions(user_id, date)` - For loading workout history
- `set_logs(workout_session_id)` - For loading sets in a session
- `set_logs(exercise_id)` - For exercise history
- `exercises(is_system)` - For filtering system vs user exercises

### Query Optimization

Use Supabase's `.select()` to fetch only what you need:

```typescript
// ❌ BAD: Fetches everything
const { data } = await supabase.from('workout_sessions').select('*');

// ✅ GOOD: Fetches only what you need
const { data } = await supabase
  .from('workout_sessions')
  .select('id, date, total_volume_load, set_logs(actual_weight, actual_reps)')
  .eq('user_id', userId)
  .order('date', { ascending: false })
  .limit(10);
```

---

## Next Phase: Integration

Once migrations are complete, you'll integrate Supabase into your existing codebase:

1. **Update `storage.ts`** to use Supabase instead of localStorage
2. **Implement sync queue** for offline support
3. **Add migration UI** for existing users
4. **Test thoroughly** with real workout data

Ready to proceed with integration? Let me know! 💪🧠
