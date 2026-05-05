# Production Readiness And Scale Plan

This document defines how Iron Brain decides whether a release is safe enough to ship and how the system should grow as user count and data volume increase.

## Release Decision

The app is release-ready only when all of these are true:

- `npm run release:gate` passes locally.
- The Vercel production deployment is ready.
- `npm run verify-production` passes after deployment.
- No known critical/security/data-loss/mobile-navigation bugs are open.
- Manual QA has been run on at least one real iPhone Safari session and one desktop Chrome session.
- Rollback target is known: the previous green Vercel production deployment.

Passing the release gate does not prove the app has no bugs. It proves the known critical paths and hardening checks are green.

## Current Ship Status

Current confidence: controlled-launch ready, not “scale-to-everyone” mature.

The app is appropriate for a small public launch or private beta once the product-polish issues are acceptable. It is not yet proven at high user counts because we do not have production traffic data, long-running database growth data, or real-world error-rate data.

## Ship Blockers

These block launch:

- Auth bypass on a private API route.
- Cross-user data read/write.
- Payment flow failure or Stripe webhook misconfiguration.
- Data corruption or data loss in workout logging/resume.
- Mobile navigation controls that cannot be reliably tapped.
- Broken production build.
- Secrets committed to git.
- Supabase RLS disabled on user data tables.

These do not block a controlled launch, but should be tracked:

- Full workout editing after save.
- Deeper analytics polish.
- More complete automated coverage for every profile/settings subpage.
- Stripe customer portal.
- Native mobile app.

## Scale Plan

### 0 to 10,000 Users

Primary goal: correctness, observability, and keeping the database predictable.

Required:

- Keep the release gate green before every deploy.
- Add Sentry or equivalent for client and server errors.
- Watch Vercel function errors, Stripe webhook failures, and Supabase API errors weekly.
- Add database indexes for every high-traffic query pattern before user growth creates pain.
- Keep workout history queries scoped by `user_id`, paginated, and ordered by indexed timestamps.
- Keep localStorage as a resilience layer only, not the source of truth for signed-in users.

Main risks:

- Unbounded workout history reads.
- Analytics pages pulling too many historical rows at once.
- Silent sync failures.
- Users creating malformed local state that later syncs poorly.

### 10,000 to 100,000 Users

Primary goal: reduce per-user query cost and isolate background work.

Required:

- Add cursor pagination to history and analytics data fetches.
- Materialize or cache analytics summaries by user and time window.
- Move expensive recovery/analytics calculations out of interactive page loads.
- Add background jobs for post-workout analytics.
- Track p95/p99 latency for checkout, workout save, history load, and analytics load.
- Add database alerts for slow queries, table bloat, index hit rate, and connection pressure.
- Add webhook replay tooling for Stripe event recovery.

Main risks:

- N+1 or all-history analytics becoming expensive.
- Supabase connection pressure from serverless bursts.
- Large set log tables slowing unindexed queries.
- Hard-to-debug user-specific sync bugs.

### 100,000 to 1,000,000 Users

Primary goal: separate hot paths from analytical paths.

Required:

- Partition very large event/log tables by time or user strategy if Supabase/Postgres metrics demand it.
- Move analytical workloads to precomputed summary tables or a warehouse-like pipeline.
- Introduce queues for Stripe/webhook/recovery/analytics side effects.
- Add rate limiting to expensive authenticated APIs.
- Add admin tooling for user support, webhook inspection, and data repair.
- Consider dedicated read replicas or upgraded Supabase plan before latency degrades.
- Formalize incident response: owner, severity, rollback, customer comms, and postmortem.

Main risks:

- Workout/set log tables becoming too large for naive reads.
- Analytics recomputation creating noisy database load.
- Webhook retries or background jobs double-processing without idempotency.
- Lack of support tooling slowing down user recovery.

## Tech Debt Policy

Every new feature must include:

- A clear owner path in the codebase.
- A test or release-gate assertion for its critical failure mode.
- A data model migration plan if it stores user data.
- A rollback or graceful-failure path.

Tech debt is acceptable only when:

- It is documented.
- It does not touch security, payments, or workout data integrity.
- It has a follow-up issue or roadmap entry.

Do not add placeholder UI to production navigation or settings. If a feature is not functional, keep it out of the primary UI.

## Data Growth Rules

- Never fetch all workouts for a user when a paginated or bounded query is sufficient.
- Never run global analytics from an interactive page request.
- Store raw workout logs, but read summaries for dashboards when possible.
- Keep user-owned data indexed by `user_id` plus the relevant time/order column.
- Prefer idempotent writes for sync and webhook flows.

## Operational Checklist

Weekly after launch:

- Review Vercel runtime errors.
- Review Supabase slow queries and table sizes.
- Review Stripe webhook failures.
- Run `npm run release:gate` before every release.
- Manually exercise workout start/resume/finish on a phone.

Monthly after launch:

- Review top database tables by size.
- Review analytics query cost.
- Review support issues for repeated product confusion.
- Delete dead code behind abandoned experiments.
- Refresh the release runbook if the release process changes.
