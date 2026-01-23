#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import { normalizeProgramMetadata } from '../app/lib/programs/normalize';
import type { ProgramTemplate } from '../app/lib/types';

type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

type ProgramRow = {
  id: string;
  user_id: string;
  name: string | null;
  program_data: Json;
};

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const DRY_RUN = process.env.DRY_RUN !== 'false';
const TARGET_USER_ID = process.env.TARGET_USER_ID;

const PAGE_SIZE = 500;

function parseProgramData(value: Json): ProgramTemplate | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, Json>;
  if (typeof record.name !== 'string') return null;
  if (!Array.isArray(record.weeks)) return null;
  return record as unknown as ProgramTemplate;
}

async function fetchPrograms(): Promise<ProgramRow[]> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('❌ Missing Supabase credentials');
    console.error('Required: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false },
  });

  let allRows: ProgramRow[] = [];
  let from = 0;

  while (true) {
    let query = supabase
      .from('custom_programs')
      .select('id, user_id, name, program_data')
      .range(from, from + PAGE_SIZE - 1);

    if (TARGET_USER_ID) {
      query = query.eq('user_id', TARGET_USER_ID);
    }

    const { data, error } = await query;
    if (error) {
      console.error('❌ Failed to load custom programs:', error);
      process.exit(1);
    }

    const rows = (data ?? []) as ProgramRow[];
    allRows = allRows.concat(rows);

    if (rows.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return allRows;
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║   IRON BRAIN: Normalize Custom Program Metadata         ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  if (DRY_RUN) {
    console.log('🔍 DRY RUN MODE - No data will be modified');
    console.log('   Set DRY_RUN=false to perform updates\n');
  }

  const rows = await fetchPrograms();
  console.log(`✅ Loaded ${rows.length} custom programs`);

  if (rows.length === 0) {
    console.log('No programs found. Nothing to do.');
    return;
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('❌ Missing Supabase credentials');
    return;
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false },
  });

  let updated = 0;
  let skipped = 0;
  const previewLimit = 20;
  let previewed = 0;

  for (const row of rows) {
    const program = parseProgramData(row.program_data);
    if (!program) {
      skipped++;
      continue;
    }

    const { program: normalizedProgram, changed } = normalizeProgramMetadata(program);
    const normalizedName = normalizedProgram.name;
    const needsUpdate = changed || normalizedName !== row.name;

    if (!needsUpdate) continue;

    if (DRY_RUN && previewed < previewLimit) {
      console.log(`• ${program.name} → ${normalizedName}`);
      previewed++;
    }

    if (!DRY_RUN) {
      const programData: Json = JSON.parse(JSON.stringify(normalizedProgram));
      const { error } = await supabase
        .from('custom_programs')
        .update({
          name: normalizedName,
          program_data: programData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', row.id);

      if (error) {
        console.error(`❌ Failed to update program ${row.id}:`, error);
        continue;
      }
    }

    updated++;
  }

  console.log('\nSummary');
  console.log(`- Updated: ${updated}`);
  console.log(`- Skipped (invalid data): ${skipped}`);
  if (DRY_RUN) {
    console.log('\nRun with DRY_RUN=false to apply changes.');
  }
}

main().catch((error) => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});
