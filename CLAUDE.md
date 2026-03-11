# Claude Code Rules

## Build & Development
- Do NOT run `next build` after every change. Only build when explicitly asked or when verifying a final result.
- Use the dev server (`next dev`) for iterative testing instead of full builds.
- For TypeScript checks without a full build, use `npx tsc --noEmit` instead.

## Project Overview
- Next.js app on PulseChain (OTC trading protocol)
- Supabase for database, Vercel for hosting
- Contract: AgoraX OTC at `0x06856CEa795D001bED91acdf1264CaB174949bf3`
- Cron job `sync-blockchain` runs every minute to sync on-chain events to Supabase

## Key Directories
- `app/` - Next.js pages and API routes
- `components/stats/` - Stats dashboard chart components
- `hooks/contracts/` - Wagmi contract read hooks
- `hooks/crypto/` - Token price hooks
- `utils/tokenUtils.ts` - Token info resolution
- `contracts/core/` - Solidity contracts
- `constants/crypto.ts` - Token constants (TOKEN_CONSTANTS)

## Conventions
- Use `getTokenInfo()` for token metadata lookup by address
- Use `useTokenPrices()` hook for live token prices
- Token addresses are always lowercased for comparison
- Contract orders use BigInt for amounts
- Stats page (`/stats`) reads from blockchain directly; Stats2 page (`/stats2`) reads from Supabase API
