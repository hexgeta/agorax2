import { NextRequest, NextResponse } from 'next/server';
import { verifyMessage } from 'viem';
import { AUTH_MESSAGE, createSessionToken } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limit';

const RATE_LIMIT = { limit: 10, windowSeconds: 60 };

export async function POST(request: NextRequest) {
  const rateLimited = await checkRateLimit(request, RATE_LIMIT);
  if (rateLimited) return rateLimited;

  try {
    const { wallet_address, signature } = await request.json();

    if (!wallet_address || !signature) {
      return NextResponse.json(
        { success: false, error: 'Missing wallet_address or signature' },
        { status: 400 },
      );
    }

    if (!/^0x[a-fA-F0-9]{40}$/.test(wallet_address)) {
      return NextResponse.json(
        { success: false, error: 'Invalid wallet address' },
        { status: 400 },
      );
    }

    // Verify the signature matches the wallet address
    const valid = await verifyMessage({
      address: wallet_address as `0x${string}`,
      message: AUTH_MESSAGE,
      signature: signature as `0x${string}`,
    });

    if (!valid) {
      return NextResponse.json(
        { success: false, error: 'Invalid signature' },
        { status: 401 },
      );
    }

    // Issue a stateless session token
    const { token, expiresAt } = createSessionToken(wallet_address);

    return NextResponse.json({
      success: true,
      token,
      expires_at: expiresAt,
    });
  } catch (error) {
    console.error('Auth verify error:', error);
    return NextResponse.json(
      { success: false, error: 'Verification failed' },
      { status: 500 },
    );
  }
}
