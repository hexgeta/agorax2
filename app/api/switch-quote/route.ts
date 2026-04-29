import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const SWITCH_QUOTE_ENDPOINT = 'https://quote.switch.win';

export async function GET(request: NextRequest) {
  const rateLimitResponse = await checkRateLimit(request, RATE_LIMITS.data);
  if (rateLimitResponse) return rateLimitResponse;

  const apiKey = process.env.SWITCH_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'SWITCH_API_KEY not configured on server' },
      { status: 500 }
    );
  }

  const sp = request.nextUrl.searchParams;
  const from = sp.get('from');
  const to = sp.get('to');
  const amount = sp.get('amount');
  const sender = sp.get('sender') || undefined;
  const receiver = sp.get('receiver') || undefined;
  const slippage = sp.get('slippage') || '50';
  const adapters = sp.get('adapters') || undefined;
  const feeOnOutput = sp.get('feeOnOutput') || 'false';

  if (!from || !to || !amount) {
    return NextResponse.json({ error: 'Missing required params: from, to, amount' }, { status: 400 });
  }

  const qs = new URLSearchParams({
    network: 'pulsechain',
    from,
    to,
    amount,
    slippage,
    feeOnOutput,
  });
  if (sender) qs.set('sender', sender);
  if (receiver) qs.set('receiver', receiver);
  if (adapters) qs.set('adapters', adapters);

  // Partner fee — injected server-side from env so the address isn't exposed client-side.
  // Switch splits the fee 50/50 between the partnerAddress and Switch.
  // Min fee is 30 bps (0.30%) per Switch SDK.
  const partnerAddress = process.env.SWITCH_FEE_ADDRESS?.trim();
  if (partnerAddress && /^0x[a-fA-F0-9]{40}$/.test(partnerAddress)) {
    qs.set('partnerAddress', partnerAddress);
    qs.set('fee', '30');
  }

  try {
    const upstream = await fetch(`${SWITCH_QUOTE_ENDPOINT}/swap/quote?${qs.toString()}`, {
      headers: { 'x-api-key': apiKey },
      cache: 'no-store',
    });
    const data = await upstream.json();
    return NextResponse.json(data, { status: upstream.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upstream fetch failed';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
