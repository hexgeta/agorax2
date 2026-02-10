import { NextRequest, NextResponse } from 'next/server';

// Allowed origins for API write requests (POST, PUT, PATCH, DELETE).
// Browsers automatically set the Origin header — this blocks cross-origin
// requests from other websites. Note: non-browser clients (curl, scripts)
// can spoof this header, so this is defense-in-depth, not a full auth solution.
const ALLOWED_ORIGINS = new Set([
  'https://agorax2.lookintomaxi.com',
  // Local dev
  'http://localhost:3000',
  'http://localhost:3001',
]);

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  return ALLOWED_ORIGINS.has(origin);
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only apply origin checks to API routes
  if (!pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // Allow GET/HEAD/OPTIONS — these are read-only or preflight
  const method = request.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    // Handle CORS preflight
    if (method === 'OPTIONS') {
      const origin = request.headers.get('origin');
      if (isAllowedOrigin(origin)) {
        return new NextResponse(null, {
          status: 204,
          headers: {
            'Access-Control-Allow-Origin': origin!,
            'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Access-Control-Max-Age': '86400',
          },
        });
      }
      return new NextResponse(null, { status: 403 });
    }
    return NextResponse.next();
  }

  // Allow cron jobs authenticated by bearer token (no Origin header)
  if (pathname.startsWith('/api/cron/') || pathname.startsWith('/api/events/backfill')) {
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      return NextResponse.next();
    }
  }

  // For mutation requests (POST, PUT, PATCH, DELETE), verify origin
  const origin = request.headers.get('origin');

  if (!isAllowedOrigin(origin)) {
    return NextResponse.json(
      { success: false, error: 'Forbidden: invalid origin' },
      { status: 403 },
    );
  }

  // Add CORS headers to the response
  const response = NextResponse.next();
  response.headers.set('Access-Control-Allow-Origin', origin!);
  return response;
}

export const config = {
  matcher: '/api/:path*',
};
