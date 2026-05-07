import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseUserFromRequest } from '@/app/lib/supabase/admin';

export async function POST(request: NextRequest) {
  const user = await getSupabaseUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json(
    { error: 'Fitness tracker sync is disabled. Readiness now uses Daily Check-In and training load.' },
    { status: 410 }
  );
}
