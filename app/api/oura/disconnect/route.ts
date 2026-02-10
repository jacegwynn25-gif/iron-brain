import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, getSupabaseUserFromRequest } from '@/app/lib/supabase/admin';

export async function DELETE(request: NextRequest) {
  const user = await getSupabaseUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from('fitness_tracker_connections')
    .update({
      is_active: false,
      access_token: '',
      refresh_token: null,
      token_expires_at: null,
      scope: null,
      last_sync_at: null,
      last_sync_status: 'failed',
      sync_error: 'Disconnected by user',
    })
    .eq('user_id', user.id)
    .eq('provider', 'oura');

  if (error) {
    console.error('Failed to disconnect Oura:', error);
    return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
