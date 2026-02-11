import { NextRequest, NextResponse } from 'next/server';
import { FEATURES } from '@/app/lib/features';
import { getSupabaseAdmin, getSupabaseUserFromRequest } from '@/app/lib/supabase/admin';
import type { Database } from '@/app/lib/supabase/database.types';
import type { CoachClientLinkStatus } from '@/app/lib/types';

const EDITABLE_STATUS_SET = new Set<CoachClientLinkStatus>(['accepted', 'rejected', 'revoked']);

const ensureEnabled = () => {
  if (!FEATURES.coachCollab) {
    return NextResponse.json({ error: 'Coach collaboration is disabled' }, { status: 404 });
  }
  return null;
};

type RouteContext = {
  params: Promise<{ id: string }>;
};

type CoachClientLinkUpdate = Database['public']['Tables']['coach_client_links']['Update'];

export async function PATCH(request: NextRequest, context: RouteContext) {
  const disabled = ensureEnabled();
  if (disabled) return disabled;

  const user = await getSupabaseUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await context.params;
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const status = typeof payload.status === 'string' ? payload.status.trim().toLowerCase() : '';
  if (!EDITABLE_STATUS_SET.has(status as CoachClientLinkStatus)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data: existing, error: existingError } = await supabase
    .from('coach_client_links')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (existingError) {
    console.error('Failed to fetch collaboration link:', existingError);
    return NextResponse.json({ error: 'Failed to update link' }, { status: 500 });
  }
  if (!existing) return NextResponse.json({ error: 'Link not found' }, { status: 404 });

  const isCoach = existing.coach_user_id === user.id;
  const isClient = existing.client_user_id === user.id;
  if (!isCoach && !isClient) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  if (status === 'accepted' && !isClient) {
    return NextResponse.json({ error: 'Only the client can accept a link request' }, { status: 403 });
  }

  const updatePayload: CoachClientLinkUpdate = { status };
  if (status !== 'pending') {
    updatePayload.responded_at = new Date().toISOString();
  }

  const { data: updated, error: updateError } = await supabase
    .from('coach_client_links')
    .update(updatePayload)
    .eq('id', id)
    .select('*')
    .single();

  if (updateError) {
    console.error('Failed to update collaboration link:', updateError);
    return NextResponse.json({ error: 'Failed to update link' }, { status: 500 });
  }

  return NextResponse.json({ link: updated });
}
