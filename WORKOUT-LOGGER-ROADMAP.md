# Workout Logger Roadmap

## Acceptance Checklist (Definition of Done)
- [ ] Log sets with weight/reps/RPE
- [ ] Edit previous sets without flow traps
- [ ] Add/remove sets and exercises
- [ ] Session saves to cloud (Supabase) quickly + reliably
- [ ] History screen shows saved sessions
- [ ] Summary shows accurate stats
- [ ] PRs per exercise (max load, e1RM, max volume, max reps)
- [ ] PRs surfaced in summary UI
- [ ] Dead code cleanup pass
- [ ] Visual cohesion across screens

## Phases
### Phase 1: Cloud Save Pipeline (Fast + Stealth)
- Optimistic UI + background Supabase write
- Offline queue fallback
- Save on Finish Workout
- History reads from Supabase (with cache fallback)

### Phase 2: PR Engine
- Per-exercise PR rules:
  - Max load
  - Max e1RM
  - Max volume
  - Max reps
- Compute on save, store in DB

### Phase 3: Summary PR UI
- Visual PR badges / callouts in summary

### Phase 4: History Screen Revamp
- Logger aesthetic
- Filters + drill-in
- PR markers

### Phase 5: Program Progress Tracking
- Track program day index + last completed
- Use history to auto-suggest weights/reps

### Phase 6: Onboarding Revamp
- Skip if already onboarded
- Replace outdated flow
