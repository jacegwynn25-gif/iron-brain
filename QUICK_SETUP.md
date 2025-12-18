# 🚀 Iron Brain Supabase - Quick Setup

## ⚠️ IMPORTANT: Get Your Real API Keys First!

The keys you provided aren't the right format. Here's how to get them:

### Step 1: Open Your Supabase Dashboard
Click this link: **https://nwqqasofqwoinzrcjivo.supabase.co/project/nwqqasofqwoinzrcjivo/settings/api**

### Step 2: Copy Your Keys

You'll see two keys:

1. **Project API keys** section:
   - Copy the **`anon` `public`** key (starts with `eyJhbG...` - VERY long)

2. Scroll down to **Service role secret**:
   - Click "Reveal" button
   - Copy the **service_role** key (also starts with `eyJ...`)

### Step 3: Update .env.local

Open `/Users/JGwynn/iron-brain/.env.local` and replace:

```bash
NEXT_PUBLIC_SUPABASE_ANON_KEY=REPLACE_THIS_WITH_YOUR_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=REPLACE_THIS_WITH_YOUR_SERVICE_ROLE_KEY
```

With your actual keys from the dashboard.

---

## ✅ Once You Have the Correct Keys, Run This:

### 1. Run Database Migrations

Go to: **https://nwqqasofqwoinzrcjivo.supabase.co/project/nwqqasofqwoinzrcjivo/sql/new**

Run these 3 SQL files **IN ORDER**:

#### Migration 1: Core Schema
📁 Copy all contents from `supabase/migrations/001_initial_schema.sql`
- Paste into SQL Editor
- Click **RUN**
- Wait for "Schema created successfully! 🧠💪"

#### Migration 2: Security Policies
📁 Copy all contents from `supabase/migrations/002_row_level_security.sql`
- Paste into SQL Editor
- Click **RUN**
- Wait for "RLS policies created successfully! 🔒"

#### Migration 3: Seed Data
📁 Copy all contents from `supabase/migrations/003_seed_data.sql`
- Paste into SQL Editor
- Click **RUN**
- Wait for "Seed data loaded successfully! 🌱"

### 2. Enable Email Authentication

Go to: **https://nwqqasofqwoinzrcjivo.supabase.co/project/nwqqasofqwoinzrcjivo/auth/providers**

1. Find **Email** in the list
2. Toggle it **ON**
3. Click **Save**

### 3. Test It!

```bash
npm run dev
```

Open http://localhost:3000 and check the browser console for errors.

---

## 🎉 You're Done!

Your database now has:
- ✅ 21 muscle groups (Chest, Quads, Lats, etc.)
- ✅ 20 equipment types (Barbell, Dumbbell, etc.)
- ✅ 10 system exercises (Squat, Bench Press, Deadlift, etc.)
- ✅ Full program/workout/analytics tables
- ✅ Row-level security protecting all data

---

## 🆘 If You Get Stuck

The keys should look like this:

```bash
# ✅ CORRECT - JWT token format
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im53cXFhc29mcXdvaW56cmNqaXZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE2OTk...

# ❌ WRONG - These are Stripe keys, not Supabase!
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_rICHQjAbBFkhiffNlYuzaA_DZPSfSZI
```

Need help? Just tell me what error you're seeing! 💪
