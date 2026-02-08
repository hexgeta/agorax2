import { NextRequest, NextResponse } from 'next/server';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface RateLimitConfig {
  /** Max requests per window */
  limit: number;
  /** Window duration in seconds */
  windowSeconds: number;
}

// In-memory store keyed by "ip:path"
const store = new Map<string, RateLimitEntry>();
let lastCleanup = Date.now();
const CLEANUP_INTERVAL = 60_000; // 1 minute

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  for (const [key, entry] of store) {
    if (now > entry.resetAt) store.delete(key);
  }
}

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

/**
 * Check rate limit for a request.
 * Returns null if allowed, or a NextResponse 429 if blocked.
 */
export function checkRateLimit(
  request: NextRequest,
  config: RateLimitConfig = { limit: 60, windowSeconds: 60 }
): NextResponse | null {
  cleanup();

  const ip = getClientIp(request);
  const path = new URL(request.url).pathname;
  const key = `${ip}:${path}`;
  const now = Date.now();

  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    // New window
    store.set(key, {
      count: 1,
      resetAt: now + config.windowSeconds * 1000,
    });
    return null;
  }

  entry.count++;

  if (entry.count > config.limit) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return NextResponse.json(
      {
        success: false,
        error: 'Rate limit exceeded',
        retry_after_seconds: retryAfter,
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(retryAfter),
          'X-RateLimit-Limit': String(config.limit),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(Math.ceil(entry.resetAt / 1000)),
        },
      }
    );
  }

  return null;
}

/**
 * Add rate limit headers to a successful response.
 */
export function addRateLimitHeaders(
  response: NextResponse,
  request: NextRequest,
  config: RateLimitConfig = { limit: 60, windowSeconds: 60 }
): NextResponse {
  const ip = getClientIp(request);
  const path = new URL(request.url).pathname;
  const key = `${ip}:${path}`;
  const entry = store.get(key);

  if (entry) {
    response.headers.set('X-RateLimit-Limit', String(config.limit));
    response.headers.set(
      'X-RateLimit-Remaining',
      String(Math.max(0, config.limit - entry.count))
    );
    response.headers.set(
      'X-RateLimit-Reset',
      String(Math.ceil(entry.resetAt / 1000))
    );
  }

  return response;
}

/** Validate Ethereum address format */
export function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/** Standard JSON success response with rate limit headers */
export function apiSuccess(
  data: unknown,
  request: NextRequest,
  rateLimitConfig?: RateLimitConfig
): NextResponse {
  const response = NextResponse.json({
    success: true,
    data,
    timestamp: new Date().toISOString(),
  });
  return addRateLimitHeaders(response, request, rateLimitConfig);
}

/** Standard JSON error response */
export function apiError(
  message: string,
  status: number = 400
): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: message,
      timestamp: new Date().toISOString(),
    },
    { status }
  );
}
