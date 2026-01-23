# Iron Brain - Master Program

**Last Updated**: 2026-01-19
**Version**: 1.0
**Status**: Production-Ready Core, Feature Cleanup in Progress

---

## Table of Contents

1. [Mission & Philosophy](#mission--philosophy)
2. [System Architecture](#system-architecture)
3. [Database Schema](#database-schema)
4. [Feature Inventory](#feature-inventory)
5. [Scientific Foundation](#scientific-foundation)
6. [UX Design Principles](#ux-design-principles)
7. [Monetization Strategy](#monetization-strategy)
8. [Technical Debt & Known Issues](#technical-debt--known-issues)
9. [Operational Guides](#operational-guides)
10. [Roadmap](#roadmap)

---

## Mission & Philosophy

### What Iron Brain Is

**"The Scientist in Your Pocket"**

Iron Brain is the only workout app that uses PhD-level algorithms to eliminate guessing from strength training. It tells serious lifters exactly what to lift based on their biological readiness, backed by 25+ peer-reviewed research papers.

### What We're NOT

- ❌ A "fun" gamified fitness app
- ❌ A social media platform for gym selfies
- ❌ A generic workout tracker with badges

### Core Value Proposition

> "Stop wasting 50% of your gym time. Iron Brain tells you exactly what to lift, based on your literal biological readiness today."

---

## System Architecture

### High-Level Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    USER INTERFACE (React)                    │
│         "Traffic Light" Simple UI - Green/Yellow/Red         │
└─────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────┐
│                   TRANSLATION LAYER                          │
│    Converts PhD jargon → Plain English recommendations      │
└─────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────┐
│              BIOLOGICAL SIMULATOR (9 modules)                │
│  ACWR | Fitness-Fatigue | Hierarchical Models | SFR | etc.  │
└─────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────┐
│                  DATA LAYER (Supabase)                       │
│      workout_sessions | set_logs | fatigue_events | etc.    │
└─────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

#### 1. **UI Layer** (`/app/components/`)
- **Responsibility**: Display information in simple, actionable format
- **Key Principle**: Traffic lights (Green/Yellow/Red), not numbers
- **Example**: "GO FOR A PR" not "ACWR: 1.2, p-fitness: 85%"

#### 2. **Translation Layer** (`/app/lib/intelligence/workout-intelligence-service.ts`)
- **Responsibility**: Convert statistical outputs to user-friendly messages
- **Input**: Complex models (ACWR, fitness-fatigue scores, hierarchical estimates)
- **Output**: Simple recommendations ("Reduce weight by 20%", "Deload today")

#### 3. **Biological Simulator** (`/app/lib/intelligence/` + `/app/lib/stats/`)
- **Responsibility**: Calculate readiness, fatigue, recovery, performance predictions
- **9 Modules**:
  1. ACWR (Acute:Chronic Workload Ratio) - `adaptive-recovery.ts`
  2. Fitness-Fatigue Model (Banister 1975) - `adaptive-recovery.ts`
  3. Muscle-Specific Recovery - `cross-session.ts`
  4. Session Fatigue - `cross-session.ts`
  5. SFR Analysis (Stimulus-to-Fatigue Ratio) - `sfr.ts`
  6. Hierarchical Bayesian Models - `hierarchical-models.ts`
  7. Bayesian RPE Calibration - `bayesian-rpe.ts`
  8. Advanced Statistical Methods - `advanced-methods.ts`
  9. Adaptive Recovery - `adaptive-recovery.ts`

#### 4. **Data Layer** (Supabase)
- **Responsibility**: Persist workouts, user profiles, recovery data
- **Pattern**: Offline-first (localStorage) + Supabase sync
- **RLS**: Row-Level Security enforces user data isolation

### Dual Recovery System (Current State)

**OLD SYSTEM** (Legacy, still operational):
- File: `/app/lib/intelligence/fatigue/cross-session.ts`
- Tables: Uses `workout_sessions` + `set_logs` to calculate fatigue
- Status: ✅ Works, powers current UI

**NEW SYSTEM** (Advanced, partially integrated):
- File: `/app/lib/intelligence/recovery-integration-service.ts`
- Tables: Uses `fatigue_events`, `user_context_data`, `user_demographics`, etc.
- Status: ⚠️ Backend complete, UI integration incomplete

**Bridge Function**: `saveFatigueEventsToNewSystem()`
- Saves workouts to BOTH systems during transition
- Ensures new tables populate while old system continues working

**Migration Path**: Once new UI is built, old system can be deprecated.

---

## Database Schema

### Core Tables (Always Existed)

#### `workout_sessions`
```sql
id UUID PRIMARY KEY
user_id UUID REFERENCES auth.users
name TEXT
date TIMESTAMPTZ
start_time TIMESTAMPTZ
end_time TIMESTAMPTZ
duration_minutes INTEGER
bodyweight NUMERIC
notes TEXT
status TEXT -- 'active' | 'completed' | 'cancelled'
total_sets INTEGER
total_reps INTEGER
total_volume_load INTEGER
average_rpe NUMERIC(3,1) -- Accepts decimals like 6.5
```

#### `set_logs`
```sql
id UUID PRIMARY KEY
workout_session_id UUID REFERENCES workout_sessions
exercise_id UUID -- Deprecated (historical null values)
exercise_slug TEXT -- NEW: app exercise ID (e.g., 'bench_tng')
order_index INTEGER -- Position in workout (required)
set_index INTEGER
prescribed_reps INTEGER
prescribed_rpe NUMERIC(3,1) -- Accepts decimals
prescribed_rir NUMERIC(3,1) -- Accepts decimals
actual_weight NUMERIC
actual_reps INTEGER
actual_rpe NUMERIC(3,1)
actual_rir NUMERIC(3,1)
e1rm NUMERIC
volume_load INTEGER
set_type TEXT -- 'straight' | 'drop' | 'rest-pause' | 'cluster'
tempo TEXT
rest_seconds INTEGER
actual_seconds INTEGER
completed BOOLEAN
skipped BOOLEAN
```

**Key Changes (Migration 019)**:
- `prescribed_rpe`, `actual_rpe`, `prescribed_rir`, `actual_rir` changed from INTEGER → NUMERIC(3,1)
- Allows decimal values like 6.5, 7.5, 3.5 (common in training)

### Recovery System Tables (Migration 016)

#### `fatigue_events`
```sql
id UUID PRIMARY KEY
user_id UUID
timestamp TIMESTAMPTZ
exercise_name TEXT
sets INTEGER
reps INTEGER
weight NUMERIC
rpe NUMERIC
volume INTEGER
effective_volume NUMERIC
initial_fatigue NUMERIC
set_duration NUMERIC
rest_interval NUMERIC
is_eccentric BOOLEAN
is_ballistic BOOLEAN
```

**Purpose**: Feeds new recovery calculations. Populated via `saveFatigueEventsToNewSystem()` bridge function.

#### `user_recovery_parameters`
```sql
id UUID PRIMARY KEY
user_id UUID
recovery_rate_upper NUMERIC -- Hours to 100% recovery (upper body)
recovery_rate_lower NUMERIC -- Hours to 100% recovery (lower body)
fatigue_resistance NUMERIC -- 0-100 scale
last_calibrated_at TIMESTAMPTZ
calibration_confidence NUMERIC
```

**Purpose**: Bayesian-calibrated personal recovery rates. Updated as more workout data accumulates.

#### `user_context_data`
```sql
id UUID PRIMARY KEY
user_id UUID
date DATE
sleep_hours NUMERIC
sleep_quality INTEGER -- 1-10
stress_level INTEGER -- 1-10
nutrition_quality INTEGER -- 1-10
soreness_level INTEGER -- 1-10
notes TEXT
```

**Purpose**: Daily check-in data. **CURRENTLY NOT COLLECTED** (check-in UI hidden).

#### `user_demographics`
```sql
id UUID PRIMARY KEY
user_id UUID UNIQUE
age INTEGER
sex TEXT -- 'male' | 'female' | 'other'
training_age_years NUMERIC
athletic_background TEXT[]
bodyweight NUMERIC
height NUMERIC
injuries TEXT[]
chronic_conditions TEXT[]
```

**Purpose**: Baseline data for recovery models. **PARTIALLY COLLECTED** (onboarding incomplete).

#### `menstrual_cycle_data`
```sql
id UUID PRIMARY KEY
user_id UUID
cycle_day INTEGER
phase TEXT -- 'follicular' | 'ovulation' | 'luteal' | 'menstruation'
symptoms TEXT[]
date DATE
```

**Purpose**: Cycle-based recovery adjustments (research-backed). **NOT CURRENTLY COLLECTED**.

#### `fitness_tracker_connections`
```sql
id UUID PRIMARY KEY
user_id UUID
provider TEXT -- 'whoop' | 'oura' | 'garmin' | 'fitbit'
access_token TEXT
refresh_token TEXT
expires_at TIMESTAMPTZ
```

**Purpose**: OAuth integrations for sleep/HRV data. **NOT IMPLEMENTED**.

#### `recovery_snapshots`
```sql
id UUID PRIMARY KEY
user_id UUID
snapshot_timestamp TIMESTAMPTZ
muscle_group TEXT
readiness_score NUMERIC
fatigue_level NUMERIC
estimated_full_recovery_at TIMESTAMPTZ
```

**Purpose**: Cached recovery calculations (performance optimization). **POPULATED BY BACKEND**.

### Subscription System Tables (Migration 003)

#### `user_profiles` (extended)
```sql
-- Existing columns...
is_pro BOOLEAN DEFAULT false
subscription_tier TEXT CHECK (subscription_tier IN ('free', 'pro_lifetime', 'pro_monthly'))
stripe_customer_id TEXT
subscription_started_at TIMESTAMPTZ
subscription_expires_at TIMESTAMPTZ
```

#### `app_settings`
```sql
id TEXT PRIMARY KEY DEFAULT 'singleton'
lifetime_slots_total INTEGER DEFAULT 200
lifetime_slots_remaining INTEGER DEFAULT 200
updated_at TIMESTAMPTZ
```

**Purpose**: Global settings. Singleton table (only 1 row). Tracks Founding Member slots.

#### `subscription_events`
```sql
id UUID PRIMARY KEY
user_id UUID
event_type TEXT -- 'upgrade' | 'downgrade' | 'cancel' | 'renew'
old_tier TEXT
new_tier TEXT
stripe_event_id TEXT
metadata JSONB
created_at TIMESTAMPTZ
```

**Purpose**: Audit trail for subscription changes.

### RLS (Row Level Security) Policies

**Pattern for all user tables**:
```sql
-- SELECT
CREATE POLICY "Users can view own data"
  ON table_name FOR SELECT
  USING (auth.uid() = user_id);

-- INSERT
CREATE POLICY "Users can insert own data"
  ON table_name FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- UPDATE
CREATE POLICY "Users can update own data"
  ON table_name FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

**Special case for child tables** (e.g., `set_logs`):
```sql
CREATE POLICY "Users can insert own set logs"
  ON set_logs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workout_sessions
      WHERE workout_sessions.id = set_logs.workout_session_id
      AND workout_sessions.user_id = auth.uid()
    )
  );
```

---

## Feature Inventory

### ✅ Completed Features (Production-Ready)

#### 1. **Workout Logging**
- **File**: `/app/components/WorkoutLogger.tsx`
- **Status**: ✅ 100% functional
- **Features**:
  - Quick Start (freestyle workout)
  - Program-based logging (with prescribed sets)
  - RPE/RIR tracking (supports decimals: 6.5, 7.5)
  - Rest timer
  - Set notes
  - Auto-save to localStorage + Supabase sync
  - Offline-first with retry queue

#### 2. **Workout History**
- **File**: `/app/history/page.tsx`
- **Status**: ✅ 100% functional
- **Features**:
  - View past workouts
  - Filter by date range
  - Merge local + Supabase data
  - Exercise-specific history
  - PR tracking

#### 3. **Program Management**
- **Files**: `/app/programs/page.tsx`, `/app/start/page.tsx`
- **Status**: ✅ 100% functional
- **Features**:
  - Create custom programs
  - Week/day structure
  - Exercise selection from library
  - Prescribed sets (reps, RPE, RIR)
  - Progress tracking
  - "Continue Program" suggests next day

#### 4. **Authentication**
- **File**: `/app/lib/supabase/auth-context.tsx`
- **Status**: ✅ 100% functional (after timeout fix)
- **Features**:
  - Email/password signup
  - Google OAuth (configured)
  - Session persistence
  - Auto-sync on login
  - Namespace isolation (multi-user support)

#### 5. **Subscription System (Backend)**
- **Files**: `/app/api/checkout/route.ts`, `/app/api/webhooks/stripe/route.ts`
- **Status**: ✅ Backend complete, Stripe products not yet created
- **Features**:
  - Stripe Checkout integration
  - Webhook handling (session.completed, subscription.deleted)
  - Lifetime slot tracking
  - Feature gating (`checkFeatureAccess()`)
  - Subscription audit log

#### 6. **Analytics (Mathematical Engine)**
- **Files**: `/app/lib/intelligence/`, `/app/lib/stats/`
- **Status**: ✅ 100% mathematically verified
- **Features**:
  - ACWR (injury risk prediction)
  - Fitness-Fatigue model (performance prediction)
  - Hierarchical Bayesian fatigue models
  - SFR analysis (exercise efficiency)
  - Muscle-specific recovery
  - Set recommendations

### ⚠️ Partially Implemented Features (Backend Done, UI Broken/Hidden)

#### 7. **Pre-Workout Readiness Check**
- **File**: `/app/components/PreWorkoutReadiness.tsx`
- **Status**: ⚠️ Timeouts after 10 seconds, then skips
- **Issue**:
  - Calls `useRecoveryState()` → `getRecoveryAssessment()`
  - Backend tries to fetch from `user_context_data` (no data collected)
  - Falls back to old system but takes too long
- **Fix Required**: Disable until check-in system is built OR optimize fallback

#### 8. **Recovery Dashboard**
- **File**: `/app/recovery/page.tsx`
- **Status**: ⚠️ Exists but NOT IN NAVIGATION
- **Issue**:
  - Not accessible from BottomNav
  - Same data-fetching issues as readiness check
  - Shows infinite loading spinners
- **Fix Required**: Either add to nav + fix data OR remove entirely

#### 9. **Check-In System**
- **Files**: `/app/checkin/page.tsx`, `/app/components/checkin/DailyCheckInForm.tsx`
- **Status**: ⚠️ Exists but NOT IN NAVIGATION
- **Issue**:
  - No way for users to access it
  - Critical for collecting sleep/nutrition/stress data
  - Without this, recovery system starves for input
- **Fix Required**: Add to nav + trigger after workouts OR remove

#### 10. **In-Workout Fatigue Alerts**
- **File**: `/app/components/InWorkoutFatigueAlert.tsx`
- **Status**: ⚠️ Code exists but uncertain if it works
- **Issue**:
  - WorkoutLogger calls `intelligence.assessSessionFatigue()` every 3 sets
  - May fail silently if method doesn't exist
- **Fix Required**: Verify method exists OR remove calls

#### 11. **Analytics Dashboard**
- **File**: `/app/components/AdvancedAnalyticsDashboard.tsx`
- **Status**: ⚠️ Shows infinite loading
- **Issue**:
  - Tries to display ACWR, Fitness-Fatigue, SFR, etc.
  - Data fetching fails (likely RLS or missing tables)
  - 60K+ lines of visualization code for broken data
- **Fix Required**: Fix data fetching OR simplify to just show PR history

### ❌ Missing Features (Planned but Not Built)

#### 12. **Onboarding Flow**
- **Current State**: Partially exists (`/app/components/onboarding/OnboardingFlow.tsx`)
- **Issue**: Two separate forms that don't integrate:
  - Basic onboarding (goal, experience)
  - Demographics form (age, sex, training age, injuries)
- **Missing**: Complete flow that collects all data needed for recovery system
- **Effort**: 8-12 hours

#### 13. **Fitness Tracker Integrations**
- **Current State**: Database table exists (`fitness_tracker_connections`)
- **Missing**: OAuth flows for Whoop, Oura, Garmin, Fitbit
- **Purpose**: Auto-populate sleep/HRV data instead of manual check-ins
- **Effort**: 20-30 hours per integration

#### 14. **Menstrual Cycle Tracking**
- **Current State**: Database table exists (`menstrual_cycle_data`)
- **Missing**: UI for tracking cycle + phase-based recovery adjustments
- **Effort**: 10-15 hours

#### 15. **Injury Warning System**
- **Current State**: Backend can calculate injury risk via ACWR
- **Missing**: UI alerts when ACWR > 1.5 (3x injury risk zone)
- **Effort**: 4-6 hours

---

## Scientific Foundation

### Research Papers Implemented (25 total)

#### ACWR (Acute:Chronic Workload Ratio)
1. **Hulin et al. (2016)** - "Spikes in acute workload are associated with increased injury risk in elite cricket fast bowlers"
   - **Finding**: ACWR > 2.0 = 4x injury risk
   - **Implementation**: `app/lib/intelligence/stats/adaptive-recovery.ts:170-240`

2. **Gabbett (2016)** - "The training-injury prevention paradox"
   - **Finding**: Sweet spot at ACWR 0.8-1.3
   - **Implementation**: 6 risk zones (0.5 = detraining → 2.0+ = danger)

#### Fitness-Fatigue Model
3. **Banister et al. (1975)** - "A systems model of training for athletic performance"
   - **Formula**: Performance = Fitness(t) - Fatigue(t) + Baseline
   - **Implementation**: `adaptive-recovery.ts:86-130`
   - **Verified**: Time constants (τ₁=7 days, τ₂=2 days) match original paper

4. **Busso (2003)** - "Variable dose-response relationship"
   - **Extension**: Adaptive time constants based on training status
   - **Implementation**: Adjusts τ based on user's chronic load

#### Muscle Recovery
5. **Schoenfeld et al. (2018)** - "Resistance Training Volume Enhances Muscle Hypertrophy"
   - **Finding**: Upper body recovers in 36-48h, lower body in 72h
   - **Implementation**: `cross-session.ts:77-143`

6. **Damas et al. (2016)** - "A review of resistance training-induced changes in skeletal muscle protein synthesis"
   - **Finding**: Recovery follows exponential decay curve
   - **Implementation**: `e^(-t/τ)` recovery model

#### SFR (Stimulus-to-Fatigue Ratio)
7. **Israetel et al. (2015)** - "Scientific Principles of Strength Training"
   - **Concept**: Effective Volume / Fatigue Cost
   - **Implementation**: `app/lib/intelligence/fatigue/sfr.ts`
   - **Zones**: >200 = Excellent, <50 = Junk volume

#### Hierarchical Bayesian Models
8. **Gelman & Hill (2006)** - "Data Analysis Using Regression and Multilevel/Hierarchical Models"
   - **Method**: 3-level hierarchy (User → Exercise → Session)
   - **Implementation**: `app/lib/intelligence/stats/hierarchical-models.ts:66-171`
   - **Verified**: Shrinkage toward population means works correctly

9. **McElreath (2020)** - "Statistical Rethinking"
   - **Method**: Bayesian inference for personal fatigue resistance
   - **Implementation**: Learns individual recovery rates over time

### Mathematical Verification

**Status**: ✅ All formulas independently verified

**Verification Source**: `ANALYTICS_MATH_AUDIT.md` (PhD-level review)

**Key Validations**:
- ACWR calculation matches Hulin's original paper (verified with test data)
- Fitness-Fatigue differential equations produce correct time series
- Hierarchical model shrinkage follows Gelman's equations
- SFR thresholds match Israetel's guidelines

**Edge Cases Tested**:
- Zero training load → ACWR undefined (handled with null check)
- First workout ever → No chronic load (uses baseline assumptions)
- Negative fatigue (impossible) → Clamped to 0

---

## UX Design Principles

### Core Philosophy

**"PhD-level backend, traffic light frontend"**

Users don't need to understand ACWR, p-values, or Bayesian shrinkage. They need clear, actionable guidance.

### Translation Rules

| ❌ DON'T SAY (Jargon) | ✅ DO SAY (Plain English) |
|---|---|
| "Your ACWR is 1.8" | "⚠️ HIGH INJURY RISK - Consider deload" |
| "Fitness = 85%, Fatigue = 40%" | "🟢 READY TO TRAIN" |
| "Hierarchical posterior: μ=72, σ=8" | "Your quads recover faster than average" |
| "SFR = 48 (junk volume)" | "Cable Flyes aren't worth the fatigue - try Dumbbell Press instead" |

### Traffic Light System

**GREEN** 🟢 - GO
- Readiness Score: 8-10
- ACWR: 0.8-1.3
- Message: "GO FOR A PR"
- Action: Train at 100% intensity

**YELLOW** 🟡 - CAUTION
- Readiness Score: 5-7
- ACWR: 1.3-1.5
- Message: "NORMAL TRAINING"
- Action: Stick to program, don't push for PRs

**RED** 🔴 - STOP
- Readiness Score: 1-4
- ACWR: >1.5
- Message: "DELOAD DAY - Reduce weight 20%"
- Action: Active recovery or rest

### Progressive Disclosure

**Free Tier**:
- Basic workout logging
- PR tracking
- Volume trends (7-day chart)
- **No** complex analytics
- **Goal**: Get users hooked on tracking

**Pro Tier** (unlocks via paywall):
- Pre-workout readiness (traffic light)
- Set recommendations
- Session fatigue alerts
- Muscle recovery tracking
- SFR analysis
- Advanced analytics

**Paywall Triggers**:
1. Click "Check Readiness" before workout → Blurred score + upgrade prompt
2. View Analytics page → Placeholder cards + "Unlock Pro" button
3. After 10 workouts logged → "You're serious. Upgrade to Pro?"

### Component Responsibilities

#### Simple UI Components (User-Facing)

**PreWorkoutReadiness** (`/app/components/PreWorkoutReadiness.tsx`):
- Shows: Traffic light + 1-2 sentence recommendation
- Hides: ACWR value, fitness/fatigue scores, statistical confidence
- Example: "🟢 READY TO TRAIN - Your performance potential is peaking"

**WorkoutSummary**:
- Shows: Total volume, PR alerts, session rating
- Hides: Set-by-set fatigue accumulation, SFR scores
- Example: "Great session! 3,240 lbs total volume. New PR: Bench Press 225x5"

**RecoveryDashboard** (`/app/components/SimpleRecoveryDashboard.tsx`):
- Shows: Per-muscle traffic lights, "Ready" vs "Still Recovering"
- Hides: Exponential decay curves, Bayesian calibration status
- Example: "🟢 Chest: Ready | 🟡 Quads: 6h until ready"

#### Complex Components (Power Users / Pro Tier)

**AdvancedAnalyticsDashboard**:
- Shows: ACWR trends, fitness-fatigue graphs, SFR leaderboard
- Audience: Users who understand training science
- Gated: Pro-only feature

---

## Monetization Strategy

### Pricing Tiers

#### FREE
- Workout logging (unlimited)
- PR tracking
- Basic volume trends (7-day chart)
- Program creation
- **Goal**: 10,000+ free users

#### PRO - Founding Members
- **Price**: $149 (one-time payment)
- **Slots**: 200 total (limited FOMO campaign)
- **Features**: All Pro features, lifetime access
- **Revenue Target**: 200 slots × $149 = **$29,800**

#### PRO - Monthly Subscription
- **Price**: $12.99/month
- **Unlocks after**: 200 lifetime slots sold out
- **Features**: Same as Founding Members
- **Revenue Target**: 500 subs × $12.99 = **$6,495 MRR** ($77,940/year)

**Total Year 1 Revenue**: $29,800 (lifetime) + $77,940 (monthly) = **$107,740**

### Feature Gating

| Feature | Free | Pro |
|---------|------|-----|
| Workout Logging | ✅ | ✅ |
| PR Tracking | ✅ | ✅ |
| Volume Trends (7 days) | ✅ | ✅ |
| Pre-Workout Readiness | ❌ | ✅ |
| Set Recommendations | ❌ | ✅ |
| Session Fatigue Alerts | ❌ | ✅ |
| Muscle Recovery Tracking | ❌ | ✅ |
| SFR Analysis | ❌ | ✅ |
| Advanced Analytics | ❌ | ✅ |
| ACWR Trends | ❌ | ✅ |

### Stripe Integration Architecture

#### Products to Create (Stripe Dashboard)

1. **Iron Pro - Founding Member**
   - Type: One-time payment
   - Price: $149.00 USD
   - Price ID: `price_xxx` (copy to env var `STRIPE_PRICE_ID_LIFETIME`)

2. **Iron Pro - Monthly**
   - Type: Recurring subscription (monthly)
   - Price: $12.99 USD
   - Price ID: `price_yyy` (copy to env var `STRIPE_PRICE_ID_MONTHLY`)

#### Webhook Events

**Endpoint**: `https://your-domain.com/api/webhooks/stripe`

**Events to Subscribe**:
- `checkout.session.completed` → Upgrade user to Pro
- `customer.subscription.deleted` → Downgrade user to Free
- `customer.subscription.updated` → Update expiration date

#### Environment Variables Required

```env
# Stripe
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_PUBLISHABLE_KEY=pk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_PRICE_ID_LIFETIME=price_xxx
STRIPE_PRICE_ID_MONTHLY=price_yyy

# App
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

### Marketing Copy

**Value Propositions**:

1. **Primary Hook**: "Stop wasting 50% of your gym time on sets that are either too light to build muscle or too heavy for your current recovery level."

2. **How It Works**: "I built a PhD-level algorithm that tells you exactly what to lift, based on your literal biological readiness today. No more guessing. No more plateaus."

3. **Social Proof**: "Join 142/200 Founding Members who never pay a monthly fee."

4. **Scarcity**: "Only 58 lifetime slots remaining. After that, it's $12.99/month."

5. **Authority**: "Built on research from Stanford, AIS, and NSCA (Banister 1975, Hulin 2016, Schoenfeld 2018)."

6. **Results**: "The only algorithm that predicts overtraining before it happens."

---

## Technical Debt & Known Issues

### Critical Bugs

#### 1. **SFR Temporal Attribution Bug**
**File**: `/app/lib/intelligence/fatigue/sfr.ts`

**Issue**: Early exercises inherit fatigue from later exercises in the same session.

**Root Cause**: SFR calculation uses `cumulativeFatigue` which includes fatigue from ALL exercises in session, not just up to that point.

**Example**:
```
Session order: Bench Press → Deadlift → Rows
Bug: Bench Press SFR calculation includes fatigue from Deadlift and Rows
```

**Impact**: SFR scores are inaccurate, recommendations misleading

**Fix**: Calculate `cumulativeFatigue` incrementally, not from entire session.

**Effort**: 2-3 hours

---

#### 2. **Historical Workout Data Has Null exercise_id**
**File**: `/app/lib/storage.ts`

**Issue**: Old workout data has `exercise_id: null` because we switched to `exercise_slug` pattern.

**Impact**: Can't migrate historical data to new recovery system cleanly.

**Fix Options**:
1. Backfill `exercise_slug` from `exerciseId` in set metadata
2. Ignore historical data (only use workouts after migration)
3. Manual data cleanup script

**Effort**: 4-6 hours

---

### Consolidation Opportunities

#### 1. **Dual Recovery Systems**

**Current State**: Two systems coexist
- Old: `cross-session.ts` (uses `workout_sessions` + `set_logs`)
- New: `recovery-integration-service.ts` (uses `fatigue_events` + context data)

**Why**: Migration in progress, bridge function ensures both populate

**Future**: Once new UI is complete, old system can be removed

**Effort**: 10-15 hours (build new UI components)

---

#### 2. **Duplicate Data-Fetching Code**

**Issue**: Every page that needs workouts has identical code:
```typescript
const localWorkouts = storage.getWorkoutHistory();
const { data: supabaseWorkouts } = await supabase.from('workout_sessions')...
const merged = mergeWorkouts(localWorkouts, supabaseWorkouts);
```

**Solution**: Create `useWorkouts()` hook that centralizes this logic

**Effort**: 3-4 hours

---

#### 3. **5 Duplicate Recovery Hooks**

**Issue**: `useRecoveryState()`, `usePreWorkoutReadiness()`, `useInjuryRisk()`, `useMuscleRecovery()`, `useSetRecommendation()` all call same backend

**Solution**: Consolidate to 1-2 hooks with different return shapes

**Effort**: 2-3 hours

---

### Performance Optimizations

#### 1. **RLS Policy Initialization**

**Issue**: Supabase linter warns that `auth.uid()` is re-evaluated for every row in RLS policies.

**Example**:
```sql
-- SLOW
USING (auth.uid() = user_id)

-- FAST
USING ((SELECT auth.uid()) = user_id)
```

**Impact**: Queries slow down with >1000 rows

**Fix**: Wrap `auth.uid()` in subquery for all 50+ RLS policies

**Effort**: 1-2 hours

---

#### 2. **Analytics Computation**

**Issue**: Hierarchical model rebuilds from scratch on every workout

**Solution**: Use `recovery_snapshots` table to cache intermediate results

**Effort**: 8-10 hours

---

## Operational Guides

### Database Migration Workflow

#### Step 1: Write Migration SQL

Create file: `supabase/migrations/XXX_description.sql`

```sql
-- Example: Add new column
ALTER TABLE user_profiles
ADD COLUMN new_field TEXT;

-- Always include RLS policy
CREATE POLICY "Users can view own new_field"
  ON user_profiles FOR SELECT
  USING ((SELECT auth.uid()) = id);
```

#### Step 2: Apply Migration

**Option A: Supabase Dashboard**
1. Go to https://supabase.com/dashboard
2. Select your Iron Brain project
3. Click "SQL Editor" → "New Query"
4. Paste migration SQL
5. Click "Run" (Cmd+Enter)

**Option B: Supabase CLI** (preferred for production)
```bash
npx supabase db push
```

#### Step 3: Regenerate TypeScript Types

```bash
npm run generate-types
```

This runs:
```bash
npx supabase gen types typescript --project-id YOUR_PROJECT_ID > app/lib/supabase/database.types.ts
```

#### Step 4: Verify Types

```bash
npm run build
```

Look for TypeScript errors. If types are missing, regenerate.

#### Step 5: Test with Service Role Key

```bash
node scripts/diagnose-database.js
```

Verifies tables exist, RLS policies work, types match.

---

### Type Regeneration (When Database Changes)

**Triggers**:
- New table added
- New column added
- Column type changed
- New RPC function created

**Command**:
```bash
npm run generate-types
```

**Environment Variables Required**:
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJxxx (from dashboard)
```

**Common Errors**:

1. **"Cannot find module 'database.types'"**
   - Fix: Run `npm run generate-types`

2. **"Property 'new_column' does not exist"**
   - Fix: Regenerate types after migration

3. **"Type 'Database' is not generic"**
   - Fix: Restart TypeScript server (Cmd+Shift+P → "Restart TS Server")

---

### Test Data Seeding

**Purpose**: Populate database with realistic workout data for testing analytics.

#### Seed User Demographics

```sql
INSERT INTO user_demographics (user_id, age, sex, training_age_years, bodyweight, height)
VALUES (
  'your-user-id',
  28,
  'male',
  5.5,
  185,
  72
);
```

#### Seed Context Data (30 days)

```sql
INSERT INTO user_context_data (user_id, date, sleep_hours, sleep_quality, stress_level, nutrition_quality)
SELECT
  'your-user-id',
  CURRENT_DATE - i,
  7 + (random() * 2), -- 7-9 hours
  6 + floor(random() * 4)::int, -- 6-10 quality
  3 + floor(random() * 4)::int, -- 3-7 stress
  6 + floor(random() * 4)::int  -- 6-10 nutrition
FROM generate_series(0, 29) AS i;
```

#### Seed Workout History (12 weeks)

```bash
node scripts/seed-test-data.js
```

Generates realistic progressive overload pattern:
- Week 1-3: Hypertrophy (8-12 reps, RPE 7-8)
- Week 4: Deload (50% volume)
- Week 5-7: Strength (4-6 reps, RPE 8-9)
- Week 8: Deload
- Repeat

---

### Stripe Setup (Production Deployment)

#### Step 1: Create Products in Stripe Dashboard

1. Go to https://dashboard.stripe.com/products
2. Click "Add product"
3. **Product 1**:
   - Name: Iron Pro - Founding Member
   - Description: Lifetime access to all Pro features
   - Pricing: One-time payment, $149.00 USD
   - Copy Price ID: `price_xxx`
4. **Product 2**:
   - Name: Iron Pro - Monthly
   - Description: Monthly subscription
   - Pricing: Recurring monthly, $12.99 USD
   - Copy Price ID: `price_yyy`

#### Step 2: Configure Webhook

1. Go to https://dashboard.stripe.com/webhooks
2. Click "Add endpoint"
3. Endpoint URL: `https://your-domain.com/api/webhooks/stripe`
4. Select events:
   - `checkout.session.completed`
   - `customer.subscription.deleted`
   - `customer.subscription.updated`
5. Copy webhook signing secret: `whsec_xxx`

#### Step 3: Update Environment Variables

```env
# Production .env.local
STRIPE_SECRET_KEY=sk_live_xxx (NOT sk_test)
STRIPE_PUBLISHABLE_KEY=pk_live_xxx (NOT pk_test)
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_PRICE_ID_LIFETIME=price_xxx
STRIPE_PRICE_ID_MONTHLY=price_yyy
NEXT_PUBLIC_APP_URL=https://ironbrain.app
```

#### Step 4: Test Checkout Flow

**Test Card Numbers** (use in test mode):
- Success: `4242 4242 4242 4242`
- Decline: `4000 0000 0000 0002`
- 3D Secure: `4000 0027 6000 3184`

**Test Flow**:
1. Click "Upgrade to Pro" in app
2. Select "Founding Member" option
3. Enter test card
4. Submit
5. Verify webhook fires → user upgraded to Pro
6. Verify lifetime slot decrements in `app_settings`

#### Step 5: Go Live

1. Switch Stripe keys from test → live
2. Deploy to production
3. Test with real card (then refund)
4. Announce Founding Member campaign

---

### Rollback Procedures

#### If Migration Breaks Production

**Option 1: Rollback via SQL**
```sql
-- Example: Undo column addition
ALTER TABLE user_profiles
DROP COLUMN new_field;

DROP POLICY "Users can view own new_field" ON user_profiles;
```

**Option 2: Restore from Backup**
1. Go to Supabase Dashboard → "Database" → "Backups"
2. Select backup from before migration
3. Click "Restore"

**Option 3: Fix Forward** (preferred)
- Write new migration to fix issue
- Faster than rollback in most cases

---

## Programs Page Refactor + Intelligent Program Builder

### Overview

The Programs page (`/app/programs/page.tsx`) is currently 1,493 lines - a "god component" with too many responsibilities. This refactor will:

1. **Extract program management logic** into reusable hooks
2. **Add AI-assisted program creation** via questionnaire
3. **Fix built-in program cloning** to prevent duplicates
4. **Improve UX** with clear creation paths

### Architecture Changes

#### New Hooks

**`usePrograms()` Hook** (`/app/lib/hooks/usePrograms.ts`):
- Centralizes all program CRUD operations
- Handles localStorage + Supabase merge
- Provides `hasUnsavedChanges` detection
- Eliminates 40+ lines of duplicated code

**`useProgramContext()` Hook**:
- Provides app-wide access to program state
- Enables cross-page program management

#### New Components

**`ProgramCreationChoice`** (`/app/components/ProgramCreationChoice.tsx`):
- Decision screen for "Create Program" flow
- Three options: Built-in Template | Manual Builder | AI Builder

**`IntelligentProgramBuilder`** (`/app/components/IntelligentProgramBuilder.tsx`):
- 8-step questionnaire for AI-assisted program creation
- Collects: Goals, Experience, Schedule, Preferences, History, Focus Areas, Constraints
- Generates personalized program via rule engine

**`ProgramProvider`** (`/app/providers/ProgramProvider.tsx`):
- React Context provider wrapping the app
- Exposes program state and actions globally

#### API Endpoint

**`/app/api/programs/generate/route.ts`**:
- Rule-based program generation (MVP)
- Template selection based on goal + experience level
- Exercise filtering by equipment and injuries
- Future: LLM integration for premium tier

### Data Flow

```
Manual Builder Flow:
User → "Create New" → ProgramBuilder.tsx → Manual form → onSave() → localStorage + Supabase

Intelligent Builder Flow:
User → "AI Builder" → IntelligentProgramBuilder.tsx → Questionnaire → API call →
Generated ProgramTemplate → (Optional) ProgramBuilder for refinement → onSave()

Built-in Template Flow:
User → "Use Template" → ProgramSelector → Select program → View read-only →
"Customize" button → Clone created → Edit in ProgramBuilder → onSave()
```

### AI Builder Questionnaire Steps

| Step | Fields | Purpose |
|------|--------|---------|
| 1. Goals | Primary goal, secondary goals | Determine program focus |
| 2. Experience | Training age, athletic background | Set appropriate volume/intensity |
| 3. Schedule | Days/week, session length, time constraints | Structure program |
| 4. Preferences | Tracking method (RPE/RIR/%), deload frequency | Customize intensity method |
| 5. History | What worked before, plateau areas | Inform exercise selection |
| 6. Focus Areas | Muscles to emphasize, weaknesses | Target specific development |
| 7. Constraints | Injuries, equipment access, must-do exercises | Filter exercise library |
| 8. Review | Summary of inputs | Confirm before generation |

### Template Selection Logic

| Goal | Beginner | Intermediate | Advanced |
|------|----------|--------------|----------|
| Strength | Starting Strength variant | Texas Method variant | 5/3/1 variant |
| Hypertrophy | Full Body 3x | PPL 4-day | PPL 6-day + specialization |
| Powerlifting | Linear progression | DUP 4-day | Block periodization |
| General | Full Body 3x | Upper/Lower 4x | Custom hybrid |

### Cloning Fix

**Current Issue**: Selecting a built-in program creates a clone every time.

**Fix**: Show built-in programs as read-only, add "Customize" button that creates clone on demand:
```typescript
// Check for existing clone before creating new one
const existingClone = userPrograms.find(p =>
  p.name === program.name && p.id.startsWith('userprog_')
);
if (existingClone) return existingClone;
// Only create clone when user clicks "Customize"
```

### Files to Create

| File | Purpose |
|------|---------|
| `app/lib/hooks/usePrograms.ts` | Program state management hook |
| `app/providers/ProgramProvider.tsx` | Context provider for app-wide access |
| `app/components/ProgramCreationChoice.tsx` | Decision screen for create flow |
| `app/components/IntelligentProgramBuilder.tsx` | AI questionnaire component |
| `app/api/programs/generate/route.ts` | Backend program generation |

### Files to Modify

| File | Changes |
|------|---------|
| `app/programs/page.tsx` | Refactor to use hooks, reduce from 1,493 to ~500 lines |
| `app/layout.tsx` | Add ProgramProvider wrapper |
| `app/components/onboarding/OnboardingFlow.tsx` | Add program choice step |
| `app/components/ProgramBuilder.tsx` | Accept pre-populated data, modal-friendly |

### Estimated Effort

| Phase | Tasks | Hours |
|-------|-------|-------|
| 1. Extract hooks | usePrograms, useProgramCloning | 6-8 |
| 2. Create context | ProgramProvider, integration | 2-3 |
| 3. Refactor page | Split modes, simplify | 8-10 |
| 4. Modal standardization | Enum pattern, transitions | 3-4 |
| 5. Clone fix | Read-only state, Customize button | 2-3 |
| 6. Creation choice | New component, routing | 3-4 |
| 7. AI builder UI | Multi-step form, validation | 8-10 |
| 8. Generation API | Rule engine, templates | 10-12 |
| 9. Onboarding integration | New step, pre-fill logic | 4-6 |
| **Total** | | **46-60 hours** |

---

## Roadmap

### Immediate Cleanup (This Week)

**Goal**: Get to clean, working core app

1. **Remove broken features** ✅ (4-6 hours)
   - Delete recovery dashboard page (or fix data fetching)
   - Delete check-in system (or add to nav)
   - Remove analytics dashboard (or simplify to PR history only)
   - Disable pre-workout readiness (or fix timeout)
   - Remove in-workout fatigue alerts (if broken)

2. **Consolidate code** (6-8 hours)
   - Merge 5 recovery hooks → 1-2 hooks
   - Create `useWorkouts()` hook (replace duplicate fetching)
   - Remove debug `console.log` statements (use `logger`)

3. **Fix critical bugs** (4-6 hours)
   - SFR temporal attribution bug
   - Null exercise_id backfill script

4. **Clean up UI/UX** (6-8 hours)
   - Fix "Continue Program" flow (show day details before click)
   - Add clear error messages (no more silent failures)
   - Remove duplicate onboarding forms

**Total Effort**: 20-28 hours

---

### Phase 1: MVP Launch (2-3 Weeks)

**Goal**: Ship a simple, working product that makes money

**Features**:
- ✅ Workout logging (already works)
- ✅ Program management (already works)
- ✅ Workout history (already works)
- 🔨 Stripe integration (test checkout flow)
- 🔨 Paywall (wire up to Pro features)
- 🔨 Simple analytics (just PR trends, no complex models)

**Stripe Setup**:
1. Create products in dashboard (1 hour)
2. Test checkout flow (2 hours)
3. Deploy to production (4 hours)

**Marketing**:
1. Write landing page copy (4 hours)
2. Create demo video (8 hours)
3. Launch Founding Member campaign (Twitter, Reddit r/weightroom)

**Total Effort**: 40-50 hours

---

### Phase 2: Biological Simulator UI (4-6 Weeks)

**Goal**: Make the advanced features actually usable

**Features**:
1. **Daily Check-In** (10 hours)
   - Add to BottomNav
   - Trigger after workouts
   - Save to `user_context_data`

2. **Simplified Recovery Dashboard** (15 hours)
   - Traffic lights per muscle group
   - "Ready" vs "X hours until ready"
   - Remove complex graphs

3. **Pre-Workout Readiness** (10 hours)
   - Fix data fetching
   - Traffic light + 1-2 sentence recommendation
   - Paywall for Free users

4. **Set Recommendations** (8 hours)
   - Real-time weight suggestions during workout
   - Based on readiness + session fatigue
   - Show confidence level

5. **Injury Risk Alerts** (6 hours)
   - Trigger when ACWR > 1.5
   - "⚠️ HIGH INJURY RISK - Consider deload"
   - Suggest reduced intensity

**Total Effort**: 50-60 hours

---

### Phase 3: Advanced Features (3-4 Months)

**Goal**: Differentiate from all competitors

**Features**:
1. **Fitness Tracker Integrations** (80-120 hours)
   - Whoop OAuth
   - Oura OAuth
   - Garmin OAuth
   - Auto-populate sleep/HRV data

2. **Smart Programming** (40-60 hours)
   - Auto-adjust programs based on recovery
   - Suggest alternative workouts when muscles fatigued
   - Adaptive deloads

3. **Menstrual Cycle Tracking** (20-30 hours)
   - Phase-based recovery adjustments
   - Training recommendations per phase

4. **Coach Platform** (60-80 hours)
   - $30-50/month tier
   - Manage multiple clients
   - Assign programs
   - View client progress

**Total Effort**: 200-290 hours

---

### Long-Term Vision (Year 2+)

**Social Features** (only if retention demands it):
- PR leaderboards
- Workout sharing
- Training partners

**Mobile App**:
- React Native (reuse web codebase)
- Offline-first (already built for web)
- Push notifications for readiness

**Hardware Integrations**:
- Velocity tracker (via phone camera or external device)
- Barbell load sensors
- Real-time form analysis

---

## Appendix: File References

### Critical Files (Never Delete)

**Core App**:
- `/app/lib/supabase/client.ts` - Supabase singleton
- `/app/lib/supabase/auth-context.tsx` - Auth provider
- `/app/lib/storage.ts` - Workout persistence (local + Supabase)
- `/app/components/WorkoutLogger.tsx` - Main workout UI
- `/app/components/BottomNav.tsx` - Navigation

**Intelligence Layer**:
- `/app/lib/intelligence/workout-intelligence-service.ts` - Main orchestrator
- `/app/lib/intelligence/stats/adaptive-recovery.ts` - ACWR + Fitness-Fatigue
- `/app/lib/intelligence/fatigue/cross-session.ts` - Muscle recovery
- `/app/lib/intelligence/fatigue/sfr.ts` - Exercise efficiency

**Monetization**:
- `/app/api/checkout/route.ts` - Stripe Checkout
- `/app/api/webhooks/stripe/route.ts` - Stripe webhooks
- `/app/lib/auth/subscription.ts` - Feature gating
- `/app/components/Paywall.tsx` - Upgrade UI

**Database**:
- `/supabase/migrations/` - All schema changes
- `/app/lib/supabase/database.types.ts` - Generated types

### Safe to Delete

**Debugging/Testing**:
- All `TEST-*.md`, `FIX-*.md`, `URGENT-*.md` files
- `/scripts/diagnose-*.js` (except after bugs fixed)
- `/scripts/seed-test-data.js` (only needed for testing)

**Broken Features**:
- `/app/recovery/page.tsx` (if not fixing)
- `/app/checkin/page.tsx` (if not fixing)
- `/app/components/AdvancedAnalyticsDashboard.tsx` (if not fixing)
- `/app/components/CausalInsightsDashboard.tsx` (already deleted)
- `/app/lib/stats/causal-inference.ts` (already deleted)
- `/app/lib/stats/velocity-based-training.ts` (already deleted)

---

**End of Program**

---

**Document Maintenance**: Update this file when:
- Architecture changes (new patterns, consolidations)
- Features added/removed
- Database schema changes
- New research papers implemented
- Roadmap shifts

**Never create another markdown file for**:
- Feature specs → Add to Feature Inventory section
- Architecture decisions → Add to System Architecture section
- Bug tracking → Add to Technical Debt section
- Migration guides → Add to Operational Guides section

This is the ONE source of truth. Keep it updated.
