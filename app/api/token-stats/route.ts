import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const response = await fetch('https://app.lookintomaxi.com/api/tokens', {
      headers: {
        'Accept': 'application/json',
      },
      next: { revalidate: 30 } // Cache for 30 seconds
    });

    if (!response.ok) {
      throw new Error(`API responded with status: ${response.status}`);
    }

    const data = await response.json();
    
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
      },
    });
  } catch (error) {
    
    return NextResponse.json(
      { error: 'Failed to fetch token stats', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

