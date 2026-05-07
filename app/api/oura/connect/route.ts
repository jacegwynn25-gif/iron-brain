import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseUserFromRequest } from '@/app/lib/supabase/admin';

export async function GET(request: NextRequest) {
  const user = await getSupabaseUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json(
    { error: 'Fitness tracker integration is disabled. Use Daily Check-In for readiness.' },
    { status: 410 }
  );
}
