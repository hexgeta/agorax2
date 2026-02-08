import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export const alt = "AgoráX - PulseChain's On-chain Limit Order DEX";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: 'black',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'sans-serif',
        }}
      >
        {/* Logo A shape */}
        <svg
          width="120"
          height="120"
          viewBox="0 0 550 550"
          fill="none"
        >
          <rect width="550" height="550" rx="275" fill="black" />
          <path
            d="M275.119 104.207L136.629 363.793L270.428 363.732L317.916 310.775L219.453 310.846L274.541 208.567L356.625 362.984H412.375L275.119 104.207Z"
            fill="white"
            stroke="#92919F"
          />
          <path
            d="M368.082 258.816H370.332H413.289L413.373 206.609L368.082 258.816Z"
            fill="white"
            stroke="#92919F"
          />
        </svg>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            marginTop: 40,
          }}
        >
          <div
            style={{
              fontSize: 72,
              fontWeight: 'bold',
              color: 'white',
              letterSpacing: '-0.02em',
            }}
          >
            AgoráX
          </div>
          <div
            style={{
              fontSize: 28,
              color: '#9CA3AF',
              marginTop: 12,
            }}
          >
            PulseChain&apos;s On-chain Limit Order DEX
          </div>
          <div
            style={{
              display: 'flex',
              gap: 32,
              marginTop: 40,
              color: '#6B7280',
              fontSize: 18,
            }}
          >
            <span>Zero Slippage</span>
            <span>•</span>
            <span>Low Fees</span>
            <span>•</span>
            <span>Peer-to-Peer</span>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
