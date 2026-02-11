import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface RateLimitConfig {
  /** Max requests per window */
  limit: number;
  /** Window duration in seconds */
  windowSeconds: number;
}

interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number; // unix seconds
}

// ── Check if Vercel KV is configured ───────────────────────────────────────────

function isKvConfigured(): boolean {
  return !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

// ── Vercel KV Rate Limiting ────────────────────────────────────────────────────

async function kvRateLimit(
  identifier: string,
  config: RateLimitConfig,
): Promise<RateLimitInfo & { blocked: boolean }> {
  const key = `rl:${identifier}`;
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - config.windowSeconds;

  try {
    // Use a sliding window approach with sorted sets
    // Remove old entries
    await kv.zremrangebyscore(key, 0, windowStart);

    // Count current entries
    const count = await kv.zcard(key);

    if (count >= config.limit) {
      // Get the oldest entry to calculate reset time
      const oldest = await kv.zrange(key, 0, 0, { withScores: true });
      const resetTime = oldest.length > 1 ? (oldest[1] as number) + config.windowSeconds : now + config.windowSeconds;

      return {
        blocked: true,
        limit: config.limit,
        remaining: 0,
        reset: resetTime,
      };
    }

    // Add new entry with current timestamp as score
    await kv.zadd(key, { score: now, member: `${now}:${Math.random()}` });
    await kv.expire(key, config.windowSeconds + 1);

    return {
      blocked: false,
      limit: config.limit,
      remaining: config.limit - count - 1,
      reset: now + config.windowSeconds,
    };
  } catch (error) {
    console.error('KV rate limit error:', error);
    // Fall back to allowing the request on error
    return {
      blocked: false,
      limit: config.limit,
      remaining: config.limit - 1,
      reset: now + config.windowSeconds,
    };
  }
}

// ── In-memory fallback (local dev / missing env vars) ──────────────────────────

interface MemoryEntry {
  count: number;
  resetAt: number;
}

const memoryStore = new Map<string, MemoryEntry>();
let lastCleanup = Date.now();
const CLEANUP_INTERVAL = 60_000;

function memoryCleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  for (const [key, entry] of memoryStore) {
    if (now > entry.resetAt) memoryStore.delete(key);
  }
}

function memoryRateLimit(
  identifier: string,
  config: RateLimitConfig,
): RateLimitInfo & { blocked: boolean } {
  memoryCleanup();
  const now = Date.now();
  const entry = memoryStore.get(identifier);

  if (!entry || now > entry.resetAt) {
    memoryStore.set(identifier, {
      count: 1,
      resetAt: now + config.windowSeconds * 1000,
    });
    return {
      blocked: false,
      limit: config.limit,
      remaining: config.limit - 1,
      reset: Math.ceil((now + config.windowSeconds * 1000) / 1000),
    };
  }

  entry.count++;
  const remaining = Math.max(0, config.limit - entry.count);
  const reset = Math.ceil(entry.resetAt / 1000);

  return {
    blocked: entry.count > config.limit,
    limit: config.limit,
    remaining,
    reset,
  };
}

// ── IP extraction ──────────────────────────────────────────────────────────────

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

// Store per-request rate limit info so apiSuccess can set headers without
// another round-trip to Redis.
const requestRateLimitInfo = new WeakMap<NextRequest, RateLimitInfo>();

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Check rate limit for a request.
 * Uses Vercel KV when configured, falls back to in-memory otherwise.
 * Returns null if allowed, or a 429 NextResponse if blocked.
 */
export async function checkRateLimit(
  request: NextRequest,
  config: RateLimitConfig = { limit: 60, windowSeconds: 60 },
): Promise<NextResponse | null> {
  const ip = getClientIp(request);
  const path = new URL(request.url).pathname;
  const identifier = `${ip}:${path}`;

  let result: RateLimitInfo & { blocked: boolean };

  if (isKvConfigured()) {
    result = await kvRateLimit(identifier, config);
  } else {
    result = memoryRateLimit(identifier, config);
  }

  requestRateLimitInfo.set(request, {
    limit: result.limit,
    remaining: result.remaining,
    reset: result.reset,
  });

  if (result.blocked) {
    const retryAfter = Math.max(result.reset - Math.ceil(Date.now() / 1000), 1);
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
          'X-RateLimit-Limit': String(result.limit),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(result.reset),
        },
      },
    );
  }

  return null;
}

/**
 * Add rate-limit headers to a successful response.
 */
export function addRateLimitHeaders(
  response: NextResponse,
  request: NextRequest,
): NextResponse {
  const info = requestRateLimitInfo.get(request);
  if (info) {
    response.headers.set('X-RateLimit-Limit', String(info.limit));
    response.headers.set('X-RateLimit-Remaining', String(info.remaining));
    response.headers.set('X-RateLimit-Reset', String(info.reset));
  }
  return response;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Validate Ethereum address format */
export function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/** Standard JSON success response with rate limit headers */
export function apiSuccess(
  data: unknown,
  request: NextRequest,
): NextResponse {
  const response = NextResponse.json({
    success: true,
    data,
    timestamp: new Date().toISOString(),
  });
  return addRateLimitHeaders(response, request);
}

/** Standard JSON error response */
export function apiError(
  message: string,
  status: number = 400,
): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: message,
      timestamp: new Date().toISOString(),
    },
    { status },
  );
}

// ── Preset configs (replaces utils/rateLimit.ts RATE_LIMITS) ───────────────────

export const RATE_LIMITS = {
  /** Strict limit for validation endpoints */
  validation: { limit: 20, windowSeconds: 60 } satisfies RateLimitConfig,
  /** More relaxed for data fetching */
  data: { limit: 60, windowSeconds: 60 } satisfies RateLimitConfig,
  /** Very strict for write operations */
  write: { limit: 10, windowSeconds: 60 } satisfies RateLimitConfig,
} as const;
