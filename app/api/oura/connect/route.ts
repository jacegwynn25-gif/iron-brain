import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseUserFromRequest } from '@/app/lib/supabase/admin';
import { createOuraState, getOuraConfig, OURA_AUTHORIZE_URL } from '@/app/lib/integrations/oura';

export async function GET(request: NextRequest) {
  try {
    const user = await getSupabaseUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { clientId, redirectUri, stateSecret } = getOuraConfig();
    const state = createOuraState(user.id, stateSecret);
    const scope = request.nextUrl.searchParams.get('scope') || 'daily';

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      scope,
      state,
    });

    return NextResponse.json({ url: `${OURA_AUTHORIZE_URL}?${params.toString()}` });
  } catch (error) {
    console.error('Failed to build Oura auth URL:', error);
    return NextResponse.json({ error: 'Failed to start Oura connection' }, { status: 500 });
  }
}
