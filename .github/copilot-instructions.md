# Iron Brain - AI Agent Instructions

## Project Overview
**Iron Brain** is a Next.js 16 + React 19 strength training app that uses PhD-level algorithms to assess athlete readiness and prescribe workouts based on real-time recovery metrics. It combines offline-first localStorage with Supabase backend, real-time fatigue calculations, and a simple "traffic light" UI translating complex statistics into actionable recommendations.

---

## Architecture & Key Patterns

### The Three-Layer Model

1. **UI Layer** (`/app/components/`)
   - All client components: `'use client'` directive
   - Responsibility: Display traffic lights (Green/Yellow/Red), NOT raw numbers
   - Example: `PreWorkoutReadiness.tsx` shows "GO FOR A PR" not "ACWR: 1.2"
   - Components follow a data-heavy → UI translation pattern

2. **Translation Layer** (`/app/lib/intelligence/workout-intelligence-service.ts`)
   - Converts PhD-level model outputs to user-friendly messages
   - **Key Interfaces**: `PreWorkoutReadiness`, `SetRecommendation`, `SessionFatigueAssessment`
   - Takes complex metrics (ACWR, fitness-fatigue, hierarchical estimates) → Simple recommendations ("Reduce weight 20%", "Deload today")
   - This is the bridge between backend analytics and frontend UI

3. **Biological Simulator** (`/app/lib/stats/`, `/app/lib/intelligence/recovery/`)
   - 9 distinct calculation modules (ACWR, Fitness-Fatigue, SFR, Hierarchical Bayesian, RPE Calibration, etc.)
   - Input: Workout sessions + set logs
   - Output: Recovery profiles, readiness scores, per-muscle-group recovery percentages
   - **Pattern**: Pure math functions with minimal side effects; results cached in Supabase

4. **Data Layer** (Supabase + localStorage)
   - **Pattern**: Hybrid offline-first; sync via `SyncStorage` class
   - Core tables: `workout_sessions`, `set_logs`, `exercises`, `user_profiles`
   - Recovery system tables: `fatigue_events`, `user_recovery_parameters`, `user_context_data` (Migration 016)
   - RLS enforced; user isolation at database level

---

## Critical Data Flows

### Workout Logging Flow
```
User enters set data → WorkoutLogger component 
→ saveWorkout() in /app/lib/storage.ts 
→ queued if offline (offline-queue.ts) 
→ saved to localStorage AND Supabase 
→ triggers saveFatigueEventsToNewSystem() (bridge function) 
→ populates both old and new recovery systems
```

### Readiness Calculation Flow
```
API call to /api/workout-readiness (or direct service call)
→ getPreWorkoutReadiness() in workout-intelligence-service.ts
→ aggregates: ACWR + fitness-fatigue + muscle recovery profiles
→ TranslationLayer outputs human-readable status + warnings
→ cached result stored in model_cache (Supabase)
→ next call checks cache before recalculating
```

### Dual Recovery System (Current State)
- **OLD**: `cross-session.ts` + `set_logs` table (works, powers current UI)
- **NEW**: `recovery-integration-service.ts` + 7 new tables (complete backend, UI integration in progress)
- **Bridge**: `saveFatigueEventsToNewSystem()` saves to BOTH during transition
- Migration path: Once new UI built, deprecate old system

---

## Project-Specific Conventions

### Storage & Namespace Pattern
```typescript
// Storage is namespaced by user ID or 'default'
setUserNamespace(userId) // Call on auth state change in AuthProvider
// Handles migration of orphaned 'default' workouts to user namespace
```
- Always call `setUserNamespace()` after login/logout changes
- Workouts in localStorage live in separate namespaced keys
- View: [app/lib/storage.ts](app/lib/storage.ts#L1)

### Type System
- Use Zod schemas for runtime validation (see `app/lib/schemas/`)
- Generate Supabase types via CLI: `npx supabase gen types typescript --project-id <ref> > app/lib/supabase/database.types.ts`
- Never use `(supabase as any)` casts—regenerate types after DB schema changes

### Decimal Precision for RPE/RIR
- Migration 019 changed RPE/RIR columns to `NUMERIC(3,1)` (allows 6.5, 7.5, etc.)
- Always store as decimals; UI must accept 0.5 increments
- View: [IRON-BRAIN-BLUEPRINT.md](IRON-BRAIN-BLUEPRINT.md#L140)

### Exercise Slug System
- Old: `exercise_id` (UUID, deprecated with null values)
- New: `exercise_slug` (text ID like `'bench_tng'`)
- When adding exercises, use both fields for backward compatibility; new code prefers slug

---

## Build & Development Workflows

### Development Server
```bash
npm run dev
# Starts on http://localhost:3000
# Hot reload works; TurboPack enabled
```

### Build & Deploy
```bash
npm run build  # TypeScript compilation + optimizations
npm run start  # Production server
# Note: No test framework configured; testing is manual/external
```

### Linting
```bash
npm run lint  # ESLint (v9) + ESLint Next.js config
# TypeScript strict mode enabled; no auto-fixes applied
```

### Seeding & Migrations
```bash
npm run seed:dev  # Load sample data via /scripts/seed-dev-data.ts
npm run verify-supabase  # Check connection & credentials

# Manual migrations:
npx tsx scripts/run-migration.ts <migration-filename>  # From /supabase/migrations/
```

### Regenerate Types After DB Changes
```bash
supabase link --project-ref <PROJECT_ID>
supabase db pull  # Pull schema from remote
npx supabase gen types typescript --project-id <PROJECT_ID> > app/lib/supabase/database.types.ts
```

---

## Authentication & Environment

### Required Environment Variables (`.env.local`)
```bash
NEXT_PUBLIC_SUPABASE_URL=https://[project].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...  # Public JWT
SUPABASE_SERVICE_ROLE_KEY=...  # (Optional, for scripts only)
```

### Auth Flow
- View: [app/lib/supabase/auth-context.tsx](app/lib/supabase/auth-context.tsx#L1)
- OAuth (Google) + Email/Password via Supabase Auth
- User profiles auto-created in `user_profiles` + `user_settings` on first login
- Auth state change → triggers namespace migration + pending workout sync

---

## Common Pitfalls & Patterns to Avoid

1. **Offline Sync Issues**: Always check `isOnline()` before Supabase queries; use `queueOperation()` for offline fallback
2. **Double Fatigue Calculations**: Both old and new systems calculate fatigue. Check which is actively used before modifying
3. **Type Generation**: After any Supabase schema change, regenerate types immediately—don't use `any` casts
4. **Namespace Initialization**: `setUserNamespace()` must be called from `AuthProvider` before any storage access
5. **Component Hydration**: All data-fetching components need `'use client'` directive; be careful with SSR assumptions

---

## Key Files Reference

| Purpose | File | Key Exports |
|---------|------|-------------|
| Workout readiness logic | [app/lib/intelligence/workout-intelligence-service.ts](app/lib/intelligence/workout-intelligence-service.ts) | `getPreWorkoutReadiness()`, `SetRecommendation` interface |
| Storage/sync | [app/lib/storage.ts](app/lib/storage.ts) | `saveWorkout()`, `getWorkoutHistory()`, `setUserNamespace()` |
| Recovery calculations | [app/lib/fatigue/cross-session.ts](app/lib/fatigue/cross-session.ts) | `getRecoveryProfiles()`, `saveFatigueSnapshot()` |
| Auth context | [app/lib/supabase/auth-context.tsx](app/lib/supabase/auth-context.tsx) | `useAuth()`, `AuthProvider` |
| Supabase client | [app/lib/supabase/client.ts](app/lib/supabase/client.ts) | `supabase` instance, `getCurrentUser()` |
| Program templates | [app/lib/programs.ts](app/lib/programs.ts) | `defaultExercises`, program builders |
| Types | [app/lib/types.ts](app/lib/types.ts) | `WorkoutSession`, `SetLog`, `Exercise`, `CustomExercise` |
| System exercises | [app/lib/exercises](app/lib/exercises) | Exercise database organized by muscle group |

---

## External Dependencies Worth Knowing

- **Supabase JS v2.89**: Queries, auth, RLS (user isolation is automatic via auth token)
- **Stripe v20**: Checkout API integration for paid features
- **Recharts v3.5**: Recovery dashboards & analytics visualizations
- **Framer Motion v12**: Smooth UI transitions and animations
- **Date-fns v4**: All date utilities (prefer this over native Date)
- **Zod v4**: Runtime schema validation for form inputs & API data
- **Next.js 16 + React 19**: Latest features; turbo build system enabled

---

## Quick Start for Contributors

1. **Set up environment**: Copy `.env.local.example` to `.env.local` with Supabase credentials
2. **Install**: `npm install`
3. **Verify connection**: `npm run verify-supabase`
4. **Start dev**: `npm run dev`
5. **Load sample data**: `npm run seed:dev` (optional, for testing)
6. **Make changes**: All components in `/app/components/` are hot-reloadable
7. **Check types**: `npm run lint` after edits

---

## Architecture Decisions (The "Why")

- **Offline-first localStorage**: Enables use in gym (often poor connectivity); critical UX requirement
- **Dual recovery systems**: Old system stable & proven; new system more sophisticated—running both during transition minimizes risk
- **Traffic light UI philosophy**: Complex statistics confuse users; simple visual feedback (Green/Yellow/Red) drives behavior
- **Namespace-based storage**: Allows multiple users per device; migration on login ensures data consistency
- **Supabase RLS**: User isolation enforced at DB layer, not app layer; harder to accidentally leak data

---

**Last Updated**: 2026-01-21 | **Maintained by**: Development Team
