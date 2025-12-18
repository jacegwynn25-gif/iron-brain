# ✅ Iron Brain Supabase Setup - Almost Done!

## What I've Already Done For You:

✅ **Installed Supabase** - `@supabase/supabase-js` package added
✅ **Created Supabase client** - `app/lib/supabase/client.ts`
✅ **Updated .env.local** - Added Supabase configuration
✅ **Created 3 database migrations** - All SQL ready to run
✅ **Created setup verification script** - To test your connection
✅ **Added npm command** - `npm run verify-supabase`

---

## 🚨 What You Need to Do (5 Minutes):

### 1. Get Your REAL Supabase API Keys

The keys you gave me aren't in the right format. Here's where to find them:

**👉 Go here: https://nwqqasofqwoinzrcjivo.supabase.co/project/nwqqasofqwoinzrcjivo/settings/api**

You'll see:

```
Project API keys
┌──────────────────────────────────────────────┐
│ anon public                                  │
│ eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...      │  ← Copy this!
│                                              │
│ service_role                                 │
│ [Click "Reveal"]                             │
│ eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...      │  ← Copy this too!
└──────────────────────────────────────────────┘
```

### 2. Update Your .env.local File

Open: `/Users/JGwynn/iron-brain/.env.local`

Replace these two lines:

```bash
NEXT_PUBLIC_SUPABASE_ANON_KEY=REPLACE_THIS_WITH_YOUR_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=REPLACE_THIS_WITH_YOUR_SERVICE_ROLE_KEY
```

With your actual keys from step 1.

### 3. Run Database Migrations

**👉 Go here: https://nwqqasofqwoinzrcjivo.supabase.co/project/nwqqasofqwoinzrcjivo/sql/new**

Run these 3 files **in order**:

#### A. Core Schema (Creates all tables)
```bash
# Copy everything from this file:
supabase/migrations/001_initial_schema.sql

# Paste into SQL Editor → Click RUN
# Wait for: "Schema created successfully! 🧠💪"
```

#### B. Security Policies (Protects your data)
```bash
# Copy everything from this file:
supabase/migrations/002_row_level_security.sql

# Paste into SQL Editor → Click RUN
# Wait for: "RLS policies created successfully! 🔒"
```

#### C. Seed Data (Adds exercises, muscle groups, equipment)
```bash
# Copy everything from this file:
supabase/migrations/003_seed_data.sql

# Paste into SQL Editor → Click RUN
# Wait for: "Seed data loaded successfully! 🌱"
```

### 4. Enable Email Authentication

**👉 Go here: https://nwqqasofqwoinzrcjivo.supabase.co/project/nwqqasofqwoinzrcjivo/auth/providers**

1. Find "Email" in the list
2. Toggle it ON
3. Click Save

### 5. Test Your Setup

```bash
npm run verify-supabase
```

You should see:
```
✓ Checking environment variables...
✓ Checking key format...
✓ Testing connection...
✓ Database connection successful!
✓ Found exercises in database: Barbell Back Squat

🎉 Everything looks good! Your Supabase setup is complete.
```

---

## 📁 Files Created:

```
iron-brain/
├── app/
│   └── lib/
│       └── supabase/
│           └── client.ts              ← Supabase client ✅
├── supabase/
│   └── migrations/
│       ├── 001_initial_schema.sql     ← Core database ✅
│       ├── 002_row_level_security.sql ← Security policies ✅
│       └── 003_seed_data.sql          ← Seed data ✅
├── scripts/
│   └── verify-supabase.ts             ← Verification script ✅
├── .env.local                          ← Updated with placeholders ⚠️
├── QUICK_SETUP.md                     ← Quick guide ✅
├── SUPABASE_SETUP_GUIDE.md           ← Detailed guide ✅
└── SETUP_COMPLETE.md                  ← This file ✅
```

---

## 🎯 What Your Database Will Have:

Once you run the migrations:

**Exercise Library:**
- 21 muscle groups (Chest, Quads, Lats, Biceps, etc.)
- 20 equipment types (Barbell, Dumbbell, Cable, etc.)
- 10 system exercises (Squat, Bench, Deadlift, etc.)

**Tables:**
- `user_profiles` - User info
- `user_settings` - Preferences
- `exercises` - Exercise library
- `program_templates` - Workout programs
- `program_weeks/days/sets` - Program structure
- `workout_sessions` - Completed workouts
- `set_logs` - Individual set data
- `personal_records` - PRs per exercise
- `exercise_stats` - Rolling stats

**Security:**
- Row Level Security enabled on all tables
- Users can only access their own data
- System exercises visible to everyone

---

## 🆘 Troubleshooting:

### "Invalid API key"
→ Make sure you copied the FULL JWT token (starts with `eyJ`, very long)

### "Table does not exist"
→ Run the migrations in order (001, 002, 003)

### "Row level security violation"
→ Make sure you ran migration 002

### "No exercises found"
→ Run migration 003 to seed the data

---

## 🚀 Once Setup Is Complete:

You can start integrating Supabase:

```bash
# Test it works
npm run verify-supabase

# Start dev server
npm run dev
```

Then we can:
1. Migrate your localStorage data to Supabase
2. Implement offline-first sync
3. Add real-time features
4. Enable multi-device sync

**Ready? Just update those API keys and run the migrations!** 💪🧠
