import { NextRequest, NextResponse } from 'next/server';
import { FEATURES } from '@/app/lib/features';
import { getSupabaseAdmin, getSupabaseUserFromRequest } from '@/app/lib/supabase/admin';
import type { CoachClientLinkStatus } from '@/app/lib/types';

const STATUS_SET = new Set<CoachClientLinkStatus>(['pending', 'accepted', 'rejected', 'revoked']);

const ensureEnabled = () => {
  if (!FEATURES.coachCollab) {
    return NextResponse.json({ error: 'Coach collaboration is disabled' }, { status: 404 });
  }
  return null;
};

export async function GET(request: NextRequest) {
  const disabled = ensureEnabled();
  if (disabled) return disabled;

  const user = await getSupabaseUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const statusFilter = request.nextUrl.searchParams.get('status');
  const supabase = getSupabaseAdmin();

  let query = supabase
    .from('coach_client_links')
    .select('*')
    .or(`coach_user_id.eq.${user.id},client_user_id.eq.${user.id}`)
    .order('updated_at', { ascending: false });

  if (statusFilter && STATUS_SET.has(statusFilter as CoachClientLinkStatus)) {
    query = query.eq('status', statusFilter);
  }

  const { data, error } = await query;
  if (error) {
    console.error('Failed to list collaboration links:', error);
    return NextResponse.json({ error: 'Failed to list links' }, { status: 500 });
  }

  return NextResponse.json({ links: data ?? [] });
}

export async function POST(request: NextRequest) {
  const disabled = ensureEnabled();
  if (disabled) return disabled;

  const user = await getSupabaseUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const clientUserId = typeof payload.clientUserId === 'string' ? payload.clientUserId.trim() : '';
  if (!clientUserId) return NextResponse.json({ error: 'clientUserId is required' }, { status: 400 });
  if (clientUserId === user.id) return NextResponse.json({ error: 'Cannot link yourself' }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const { data: existing, error: existingError } = await supabase
    .from('coach_client_links')
    .select('*')
    .eq('coach_user_id', user.id)
    .eq('client_user_id', clientUserId)
    .maybeSingle();

  if (existingError) {
    console.error('Failed to check existing link:', existingError);
    return NextResponse.json({ error: 'Failed to create link' }, { status: 500 });
  }

  if (existing) {
    return NextResponse.json({ link: existing });
  }

  const { data, error } = await supabase
    .from('coach_client_links')
    .insert({
      coach_user_id: user.id,
      client_user_id: clientUserId,
      status: 'pending',
    })
    .select('*')
    .single();

  if (error) {
    console.error('Failed to create coach/client link:', error);
    return NextResponse.json({ error: 'Failed to create link' }, { status: 500 });
  }

  return NextResponse.json({ link: data }, { status: 201 });
}
