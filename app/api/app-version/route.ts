import { NextResponse } from 'next/server';
import { APP_DEPLOYMENT, APP_VERSION } from '@/app/lib/app-version';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  return NextResponse.json(
    {
      version: APP_VERSION,
      deployment: APP_DEPLOYMENT,
      checkedAt: new Date().toISOString(),
    },
    {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    }
  );
}
