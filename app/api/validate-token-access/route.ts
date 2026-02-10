import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http } from 'viem';
import { pulsechain } from 'viem/chains';
import { 
  PARTY_TOKEN_ADDRESS, 
  TEAM_TOKEN_ADDRESS, 
  REQUIRED_PARTY_TOKENS, 
  REQUIRED_TEAM_TOKENS 
} from '@/config/paywall';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';

// Create a public client for blockchain reads
const publicClient = createPublicClient({
  chain: pulsechain,
  transport: http()
});

// ERC20 balanceOf ABI
const ERC20_BALANCE_ABI = [
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  }
] as const;

export async function POST(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = await checkRateLimit(request, RATE_LIMITS.validation);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    const { address } = await request.json();

    if (!address || typeof address !== 'string') {
      return NextResponse.json(
        { error: 'Valid wallet address is required' },
        { status: 400 }
      );
    }

    // Validate address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return NextResponse.json(
        { error: 'Invalid wallet address format' },
        { status: 400 }
      );
    }

    // Check PARTY token balance
    const partyBalance = await publicClient.readContract({
      address: PARTY_TOKEN_ADDRESS,
      abi: ERC20_BALANCE_ABI,
      functionName: 'balanceOf',
      args: [address as `0x${string}`]
    });

    // Check TEAM token balance
    const teamBalance = await publicClient.readContract({
      address: TEAM_TOKEN_ADDRESS,
      abi: ERC20_BALANCE_ABI,
      functionName: 'balanceOf',
      args: [address as `0x${string}`]
    });

    // Convert to human-readable numbers
    const partyBalanceInTokens = Number(partyBalance) / 1e18; // PARTY has 18 decimals
    const teamBalanceInTokens = Number(teamBalance) / 1e8; // TEAM has 8 decimals

    // Check if user has sufficient balance of either token
    const hasPartyAccess = partyBalanceInTokens >= REQUIRED_PARTY_TOKENS;
    const hasTeamAccess = teamBalanceInTokens >= REQUIRED_TEAM_TOKENS;
    const hasAccess = hasPartyAccess || hasTeamAccess;

    return NextResponse.json({
      hasAccess,
      partyBalance: partyBalanceInTokens,
      teamBalance: teamBalanceInTokens,
      hasPartyAccess,
      hasTeamAccess,
      timestamp: Date.now()
    });

  } catch (error) {
    return NextResponse.json(
      { 
        error: 'Failed to validate token access',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

