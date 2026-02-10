import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/app/lib/supabase/admin';
import { getOuraConfig, verifyOuraState, OURA_TOKEN_URL } from '@/app/lib/integrations/oura';

export async function GET(request: NextRequest) {
  const baseUrl = new URL('/profile/settings', request.url);
  try {
    const errorParam = request.nextUrl.searchParams.get('error');
    if (errorParam) {
      baseUrl.searchParams.set('oura', 'error');
      baseUrl.searchParams.set('reason', errorParam);
      return NextResponse.redirect(baseUrl);
    }

    const code = request.nextUrl.searchParams.get('code');
    const state = request.nextUrl.searchParams.get('state');
    if (!code || !state) {
      baseUrl.searchParams.set('oura', 'error');
      baseUrl.searchParams.set('reason', 'missing_code');
      return NextResponse.redirect(baseUrl);
    }

    const { clientId, clientSecret, redirectUri, stateSecret } = getOuraConfig();
    const userId = verifyOuraState(state, stateSecret);
    if (!userId) {
      baseUrl.searchParams.set('oura', 'error');
      baseUrl.searchParams.set('reason', 'invalid_state');
      return NextResponse.redirect(baseUrl);
    }

    const tokenResponse = await fetch(OURA_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        client_secret: clientSecret,
      }).toString(),
    });

    const tokenPayload = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error('Oura token exchange failed:', tokenPayload);
      baseUrl.searchParams.set('oura', 'error');
      const rawReason =
        (typeof tokenPayload?.error === 'string' && tokenPayload.error) ||
        (typeof tokenPayload?.error_description === 'string' && tokenPayload.error_description) ||
        'token_exchange_failed';
      const normalizedReason = rawReason.replace(/\s+/g, '_').slice(0, 120);
      baseUrl.searchParams.set('reason', normalizedReason);
      return NextResponse.redirect(baseUrl);
    }

    const accessToken = tokenPayload.access_token as string | undefined;
    const refreshToken = tokenPayload.refresh_token as string | undefined;
    const expiresIn = tokenPayload.expires_in as number | undefined;
    const scope = tokenPayload.scope as string | undefined;

    if (!accessToken) {
      baseUrl.searchParams.set('oura', 'error');
      baseUrl.searchParams.set('reason', 'missing_access_token');
      return NextResponse.redirect(baseUrl);
    }

    const tokenExpiresAt = expiresIn
      ? new Date(Date.now() + expiresIn * 1000).toISOString()
      : null;

    const supabase = getSupabaseAdmin();
    const { error: upsertError } = await supabase
      .from('fitness_tracker_connections')
      .upsert(
        {
          user_id: userId,
          provider: 'oura',
          access_token: accessToken,
          refresh_token: refreshToken ?? null,
          token_expires_at: tokenExpiresAt,
          scope: scope ?? 'daily',
          last_sync_status: 'success',
          sync_error: null,
          is_active: true,
        },
        { onConflict: 'user_id,provider' }
      );

    if (upsertError) {
      console.error('Failed to save Oura tokens:', upsertError);
      baseUrl.searchParams.set('oura', 'error');
      baseUrl.searchParams.set('reason', 'token_store_failed');
      return NextResponse.redirect(baseUrl);
    }

    baseUrl.searchParams.set('oura', 'connected');
    return NextResponse.redirect(baseUrl);
  } catch (error) {
    console.error('Oura callback error:', error);
    baseUrl.searchParams.set('oura', 'error');
    baseUrl.searchParams.set('reason', 'unexpected');
    return NextResponse.redirect(baseUrl);
  }
}
