# Program Builder V2 Blueprint

Status: Draft for implementation
Owner: Product + Engineering
Last updated: 2026-02-10

## 1) Problem Statement
The current builder is functional but still feels heavy:
- Mixed mental model: block-first internals and exercise-first edits.
- High visual density: too many nested containers and repeated borders.
- Action overload: many small controls visible at once.
- Custom exercise creation is now metadata-aware, but the flow still competes with picker browsing.

## 2) Product Goal
Make program creation/editing fast, obvious, and low-friction while preserving advanced programming power.

Primary outcome:
- A user can build a 4-day program with 5-7 exercises per day in under 2 minutes without confusion.

## 3) Design Principles
1. Exercise-first everywhere
- Session is an ordered list of exercises.
- Sets are nested under each exercise.
- Supersets are a relationship between exercises, not a competing layout system.

2. Progressive disclosure
- Show summary state by default.
- Expand only one exercise at a time for detailed set editing.
- Advanced controls stay behind explicit `Advanced` mode.

3. One primary action per region
- Session-level primary CTA: `Add Exercise`.
- Exercise-level primary CTA: `Add Set`.
- Secondary actions move into a compact overflow menu.

4. Touch-first ergonomics
- Minimum 44px interactive height for tappable controls.
- Minimum 12px readable action labels.
- Avoid icon-only controls for destructive/critical actions.

5. Visual restraint
- Max one container layer per logical section.
- Prefer separators over stacked cards.
- Keep emphasis on content hierarchy, not decoration.

## 4) Target Information Architecture
### 4.1 Session Editor Structure
1. Program Meta Header
- Name, weeks, sessions/week, goal/intensity/experience.

2. Session Navigator
- Week selector and Session selector.

3. Session Canvas (core)
- Session title
- Session stats: exercise count, set count
- Primary action: `Add Exercise`
- Exercise rows (ordered)

4. Footer
- `Cancel`, `Save Program`

### 4.2 Exercise Row States
1. Collapsed (default)
- Exercise name
- Set count and compact summary
- Optional superset badge (`A1`, `A2`)
- Actions: `Edit` and overflow (`Copy`, `Replace`, `Remove`)

2. Expanded (single active)
- Set list with inline simple fields
- Per-set actions (`Edit`, `Copy`, `Delete`) with large tap targets
- `Add Set`

3. Focus mode (optional)
- Dims non-active set rows only when editing advanced fields

## 5) Superset Model (UX)
Superset should feel like linking two exercises, not adding a new block type first.

User flow:
1. Add exercise A
2. Add exercise B
3. Mark both as Superset Group A (`A1`, `A2` auto-assigned)

Alternate quick action:
- `Add Superset Pair` adds two rows and opens picker for both.

UI behavior:
- Superset pair appears as two adjacent exercise rows with shared `Group A` tag.
- Round/rest settings appear at group level when one paired row is expanded.

## 6) Custom Exercise Flow (Target)
Current improvement already captures metadata. V2 should refine it into a strict 2-step flow.

### Step 1: Resolve or Create
Inside picker after typing query:
- If exact name exists: `Use "<name>"`
- Else: `Create "<name>"`

### Step 2: Minimal Required Metadata
Required:
- Name
- Exercise type (`compound` | `isolation`)
- Equipment
- Primary muscles (1+)

Optional:
- Secondary muscles
- Movement pattern

Save behavior:
- Persist to Supabase/local storage via existing custom exercise service.
- Immediately insert selected new exercise into the active session.

Validation behavior:
- Inline errors; never dismiss user input on error.
- Always keep a clear escape hatch back to picker results.

## 7) Data Strategy
### 7.1 Near-term (no breaking migration)
Keep persisted `ProgramTemplate` compatible with existing save paths.

Approach:
- Introduce a `SessionExerciseViewModel` derived from existing day blocks/sets.
- Render and edit against view model semantics.
- Compile back to current canonical program shape on save.

View model fields:
- `id`
- `exerciseId`
- `sets[]`
- `order`
- `groupType?: 'single' | 'superset'`
- `groupId?: string`
- `groupSlot?: 'A1' | 'A2'`

### 7.2 Mid-term (optional migration)
If complexity remains high, migrate canonical storage to exercise-first day structure and retain block adapter only for backward compatibility.

## 8) Interaction Spec (Concrete)
1. Session-level controls
- Show: `Add Exercise` (primary), `Add Superset Pair` (secondary text action)
- Hide block-level management from default view.

2. Exercise-level controls
- Default visible: `Edit`, overflow menu
- Overflow: `Replace Exercise`, `Duplicate Exercise`, `Remove Exercise`

3. Set-level controls
- Default visible: set summary row and `Edit`
- Advanced controls only when set row is active.

4. Delete safety
- Exercise deletion requires one-tap undo toast instead of browser confirm.

5. Keyboard and accessibility
- Form labels must map to inputs (`aria-label` or `label htmlFor`).
- Focus trap in bottom-sheet pickers/modals.

## 9) Visual System Rules
1. Layout density
- Vertical rhythm: 8/12/16 spacing scale.
- One divider between exercises; no nested card inside card.

2. Typography
- Session and exercise names carry emphasis.
- Meta chips and helper text remain subtle.

3. Color semantics
- Green: positive primary actions.
- Cyan: active edit focus.
- Rose: destructive actions.
- Avoid extra accent colors unless semantically necessary.

## 10) Acceptance Criteria
### 10.1 Functional
- User can add/remove/reorder exercises in a session.
- User can add/remove/copy sets per exercise.
- User can create custom exercise with metadata and reuse it later.
- User can define and edit supersets without leaving exercise-first canvas.
- Save/reopen preserves all structure and metadata.

### 10.2 Usability
- 95% of primary interactions reachable within one tap from current context.
- No critical action uses touch target under 44px.
- No dead-end modal states.

### 10.3 Technical
- Lint/type/build pass.
- Desktop + mobile smoke flows pass.
- No regression in existing program save/load APIs.

## 11) Implementation Plan
### Phase A: Structure and UX cleanup (1 PR)
- Flatten nested containers in session canvas.
- Normalize action sizing and spacing.
- Consolidate row actions into overflow.

### Phase B: Exercise-first interaction pass (1 PR)
- Introduce `SessionExerciseViewModel` adapter in editor layer.
- Move default operations to exercise rows (not blocks).
- Keep compile-to-existing-save-shape for compatibility.

### Phase C: Superset linking UX (1 PR)
- Implement exercise linking for supersets.
- Group-level metadata editor for rounds/rest.

### Phase D: Custom exercise final polish (1 PR)
- Keep current metadata form.
- Make step-2 form deterministic and reduce visual competition with picker list.
- Add undo/error handling polish.

### Phase E: QA and hardening (1 PR)
- Add deterministic playwright smoke script for builder critical paths.
- Validate mobile viewport and keyboard focus behavior.

## 12) Risks and Mitigations
1. Risk: Data model drift between view model and save model
- Mitigation: round-trip unit tests for adapter compile/decompile.

2. Risk: Superset edge-case regressions
- Mitigation: explicit pair invariants (`A1/A2` uniqueness, rounds sync).

3. Risk: Scope creep in visual polish
- Mitigation: lock to this blueprint’s acceptance criteria per phase.

## 13) Immediate Next Steps
1. Approve this blueprint as V2 target.
2. Execute Phase A + B first (highest UX impact).
3. Review with screenshots and a timed build task before Phase C.
