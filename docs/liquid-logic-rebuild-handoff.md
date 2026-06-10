# Iron Brain Liquid Logic Rebuild Handoff

## Mock Checkpoint

Static visual artifact:

- `docs/liquid-logic-rebuild-mocks.html`

This is a local review surface only. It is not linked from production navigation and does not touch workout, program, auth, analytics, database, or deployment behavior.

The mock covers:

- Mobile dashboard at `390 x 844`
- Mobile log/start launchpad at `390 x 844`
- Mobile programs list at `390 x 844`
- Mobile guided builder at `390 x 844`
- Desktop guided builder workspace at `1280 x 720`

## Locked Direction

- Keep a small Liquid Glass route dock: compact centered dock on mobile, compact side rail on desktop.
- Split mobile dock islands were reviewed and rejected; they looked visually awkward instead of premium.
- Treat mobile nav as unresolved until the compact dock is compared against a route-menu/command-button option.
- Dock routes only: Dashboard, Log, Programs, History, Insights.
- Move secondary actions into source-attached menus, sheets, and inspectors.
- Use glass for controls, route dock, topbars, menus, sheets, popovers, segmented controls, and focused overlays.
- Keep dense content direct: rows, lists, separators, compact metric groups, and whitespace.
- Avoid nested content containers and glass-on-glass.
- Avoid blueprint/grid backgrounds; the content canvas should stay dark, calm, and non-decorative.
- Keep page and builder headers as direct content, not text trapped inside a glass toolbar.
- Filled color is reserved for primary actions only: `#10b981` and `#059669`. Neutral controls use glass, borders, lift, and opacity, not gray color fills.
- Preserve Iron Brain identity: Inter, black italic brand/page moments, classic action green `#10b981`, pressed/depth green `#059669`.
- Keep popups more transparent than the current sheets while preserving readable text contrast.
- Builder becomes a guided workspace editing one week/session at a time.

## Apple-Informed Design Logic

- Liquid Glass should mostly live in the navigation/control layer, floating over direct content.
- Avoid making table/list/content surfaces glass; it muddies hierarchy.
- Avoid glass-on-glass. If something sits on glass, use a thin overlay treatment instead of another full material.
- Menus and sheets should feel attached to the source control that opened them.
- Bar items should be grouped by function and frequency; crowded bars should move secondary actions into a more/menu control.
- Custom control chrome should be reduced. Hierarchy should come from grouping, layout, and material behavior, not decorative borders or random fills.

References:

- [Meet Liquid Glass](https://developer.apple.com/videos/play/wwdc2025/219/)
- [Get to know the new design system](https://developer.apple.com/videos/play/wwdc2025/356/)
- [Human Interface Guidelines: Materials](https://developer.apple.com/design/human-interface-guidelines/materials)
- [Human Interface Guidelines: Tab bars](https://developer.apple.com/design/human-interface-guidelines/tab-bars)
- [Human Interface Guidelines: Buttons](https://developer.apple.com/design/human-interface-guidelines/buttons)

## Implementation Checkpoints After Mock Acceptance

1. Shell and tokens
   - Replace remaining visual drift with canonical Liquid v2 variables.
   - Restyle route navigation as compact glass dock/side rail.
   - Remove square nav hover states.
   - Establish direct-content rules before page rebuilds.

2. Dashboard, Log/Start, Programs
   - Dashboard: one Today content zone, one primary action, no duplicate CTAs, no forced scroll unless content genuinely exceeds viewport.
   - Log/Start: compact launchpad with planned lift, freestyle, quick log, and selected program/session picker.
   - Programs: dense direct list, one active indicator, source-attached row action menus.
   - Keep program filters behind a source-attached menu unless the list becomes large enough to justify visible tabs.

3. Builder guided workspace
   - Full-screen dark workspace with direct header content and separate Back/Done controls.
   - Week/session strip.
   - Direct exercise rows.
   - One focused editor at a time: source-attached sheet on mobile, side inspector/popover on desktop.

4. History, Insights, Profile/settings/maxes
   - History: direct workout list, details/edit/delete in liquid sheets.
   - Insights: top tabs, direct metric groups, audit/help hidden behind disclosure.
   - Profile/settings/maxes: settings-list style, not boxed admin forms.

5. QA and cleanup
   - Run the full QA suite.
   - Remove obsolete legacy visual helpers only after migrated pages pass.
   - Avoid speculative refactors that do not reduce real risk or duplication.

## Behavior Boundaries

Do not change:

- Database or Supabase behavior
- Stripe or auth behavior
- Workout logging logic
- Program algorithm logic
- Analytics/intelligence algorithms
- Program-template schemas
- Route paths

Keep these route paths unchanged:

- `/`
- `/start`
- `/programs`
- `/history`
- `/analytics`
- `/profile`
- `/profile/settings`
- `/profile/maxes`

Keep `npm run build` on webpack. Keep `npm run build:turbo` as a diagnostic path until the local `lightningcss`/Turbopack signing issue is resolved separately.

GitHub connector-backed PR status/comments require user reauthentication in Codex. Normal git push remains usable.

## QA Hooks To Preserve

- `dashboard-command-center`
- `dashboard-smart-action`
- `dashboard-next-session`
- `dashboard-training-pulse`
- `app-bottom-nav`
- `quick-log-confirm`
- `quick-log-confirm-start`
- `program-tune-up`
- `program-tune-up-apply`
- `program-tune-up-dismiss`
- `logger-exercise-row`

Also preserve accessible names and labels required by builder QA:

- `New`
- `Done`
- `Add Exercise`
- `Edit Sets`
- `Collapse`
- `Exercise Actions`
- `Remove Exercise`
- picker/search labels

## Test Plan After Implementation

- `npm run lint`
- `npm run build`
- `npm run qa:hardening`
- `npm run qa:workout`
- `npm run qa:builder`
- `npm run qa:dead-code`

Browser verification:

- Mobile `390 x 844`: dashboard, log/start, programs, builder, workout logger, history, insights, profile/settings/maxes.
- Desktop `1280 x 720`: dashboard, programs, builder, log/start, history, insights.

Acceptance checks:

- No horizontal overflow.
- No nav overlap.
- No blocked guest mode.
- No square nav hover.
- No nested glass/card stacks.
- Popups remain source-attached.
- Builder save/load, cloning, custom exercise creation, superset invariants, tune-up staging, fingerprints, discard confirm, and start URL generation still work.
