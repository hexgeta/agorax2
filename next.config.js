/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['raw.githubusercontent.com', 'pbs.twimg.com', 'surhzkquxduscyjdiroh.supabase.co'],
    minimumCacheTTL: 2592000, // 30 days in seconds
    formats: ['image/webp', 'image/avif'],
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    unoptimized: true, // Disable optimization for SVGs
  },
  trailingSlash: false,
  webpack: (config) => {
    config.module.rules.push({
      test: /\.svg$/,
      use: ['@svgr/webpack'],
    });
    
    // Handle pino-pretty module resolution - make it optional
    config.resolve.fallback = {
      ...config.resolve.fallback,
      'pino-pretty': false,
    };
    
    // Add alias to handle pino-pretty gracefully
    config.resolve.alias = {
      ...config.resolve.alias,
      'pino-pretty': false,
    };
    
    return config;
  },
  typescript: {
    // !! WARN !!
    // Dangerously allow production builds to successfully complete even if
    // your project has type errors.
    // !! WARN !!
    ignoreBuildErrors: true,
  },
  async redirects() {
    return [
      {
        source: '/livestream',
        destination: 'https://x.com/i/broadcasts/1YqxookRyOvxv',
        permanent: false,
      },
      
    ]
  },
  async headers() {
    return [
      {
        // Security headers for all routes
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://vercel.live https://plausible.io https://pulse.walletconnect.org https://pulse.walletconnect.com https://cca-lite.coinbase.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "img-src 'self' data: https: blob:",
              "font-src 'self' data: https://fonts.googleapis.com https://fonts.gstatic.com",
              "connect-src 'self' https://rpc.pulsechain.com https://rpc.v4.testnet.pulsechain.com https://pulsechain-testnet-rpc.publicnode.com https://rpc-testnet-pulsechain.g4mm4.io https://*.supabase.co https://vercel.live https://pulse.walletconnect.org https://pulse.walletconnect.com https://rpc.walletconnect.org https://rpc.walletconnect.com https://*.walletconnect.org https://*.walletconnect.com wss://*.supabase.co wss://ws.walletconnect.com wss://ws.walletconnect.org wss://relay.walletconnect.com wss://relay.walletconnect.org https://relay.walletconnect.com https://relay.walletconnect.org https://*.reown.com wss://*.reown.com https://cloudflare-eth.com https://rpc.ankr.com https://api.dexscreener.com https://cca-lite.coinbase.com https://*.coinbase.com",
              "frame-src 'self' https://verify.walletconnect.com https://verify.walletconnect.org https://secure.walletconnect.com https://secure.walletconnect.org https://*.coinbase.com",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'none'",
              "upgrade-insecure-requests"
            ].join('; ')
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()'
          }
        ],
      },
      {
        // Match all image files
        source: '/coin-logos/:path*',
        headers: [
          {
            key: 'Cache-Control',
            // Similar to gopulse.com: public, 30 days, immutable
            value: 'public, max-age=2592000, immutable',
          },
          {
            key: 'Access-Control-Allow-Origin',
            value: '*',
          },
        ],
      },
      {
        source: '/fonts/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
          {
            key: 'Access-Control-Allow-Origin',
            value: '*',
          },
        ],
      },
      {
        source: '/favicon.png',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
          {
            key: 'Access-Control-Allow-Origin',
            value: '*',
          },
        ],
      }
    ];
  },
};

module.exports = nextConfig;
