#!/bin/bash

# Load environment variables
set -a
source .env.local
set +a

# Run migration
npx tsx scripts/run-migration.ts 012_add_analytics_rls_policies.sql
