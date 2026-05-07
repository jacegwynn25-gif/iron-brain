# Supabase Operations

Iron Brain production is linked to Supabase project `nwqqasofqwoinzrcjivo`.

## CLI setup

Install dependencies, then authenticate and link:

```bash
npm install
npm run supabase:link
```

If the CLI is not logged in, run:

```bash
npx supabase login --no-browser
```

Supabase CLI state is generated under `supabase/.temp/` and is intentionally ignored.

## Safe production checks

Use these before backend changes:

```bash
npm run supabase:migrations
npm run verify-production
```

The production verification now checks the `set_logs.prescribed_weight` column because workout prescription logging depends on it.

## Applying the prescribed-weight column

The narrow, idempotent command is:

```bash
npm run supabase:apply:prescribed-weight
```

It applies only `supabase/migrations/030_add_prescribed_weight_to_set_logs.sql`.

## Migration history

Production migration history is repaired and aligned with the local `001` through `030` migration sequence. Before pushing new backend changes, run:

```bash
npm run supabase:migrations
npx supabase db push --dry-run
```

The dry run should report `Remote database is up to date` when there are no pending migrations.
