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

It applies only `supabase/migrations/026_add_prescribed_weight_to_set_logs.sql`.

## Migration history warning

Do not run `supabase db push` against production until migration history is repaired. The remote project currently has app tables but no populated `supabase_migrations.schema_migrations` history, and this repo has older numeric migration filenames with duplicate prefixes. A full push dry run attempts to replay the whole migration set.
