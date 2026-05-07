import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const baseUrl = new URL('/profile/settings', request.url);
  baseUrl.searchParams.set('tracker', 'disabled');
  return NextResponse.redirect(baseUrl);
}
