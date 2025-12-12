# AgoraX Contract Whitelist Information

## Overview

This document provides information about the whitelisted tokens on the AgoraX contract and how to dynamically fetch them from the blockchain.

## Contract Address

**AgoraX Mainnet Contract:** `0xc8a47F14b1833310E2aC72e4C397b5b14a9FEf8B`
**Network:** PulseChain Mainnet (Chain ID: 369)

The contract address is configured via the environment variable `NEXT_PUBLIC_AGORAX_SMART_CONTRACT` in `.env.local`.

## Dynamic Whitelist System

**Important:** The whitelist is now **dynamically loaded from the contract**. The UI automatically fetches the current whitelist using the `useContractWhitelistRead` hook, so tokens will appear/disappear based on the on-chain whitelist state.

**Current Status:** As of December 2025, the mainnet contract has **103 active whitelisted tokens**.

### How the Whitelist Works

1. The contract owner can add tokens via `addTokenAddress(address)`
2. The contract owner can activate/deactivate tokens via `setTokenStatus(address, bool)`
3. The frontend queries `viewWhitelisted(cursor, size)` to get all tokens
4. Only **active** tokens are available for trading in the UI

### Important Limits

- **Total Whitelist Size:** No hard limit in contract (frontend fetches all dynamically)
- **Max Buy Tokens Per Order:** 50 (you can only select up to 50 different buy tokens when creating a single order)

## Checking the Whitelist

To verify the current whitelist from the contract, run:

```bash
npm run check-whitelist
```

Or directly:

```bash
node scripts/check-whitelist.js
```

This will query the contract via RPC and display all whitelisted tokens with their active status.

## Using Whitelisted Tokens in Code

The whitelist is dynamically fetched from the contract using React hooks:

### Get Active Whitelisted Tokens

```typescript
import { useContractWhitelistRead } from "@/hooks/contracts/useContractWhitelistRead";

// In your component
const { activeTokens, whitelistedTokens, isLoading } =
  useContractWhitelistRead();

// activeTokens = only currently active tokens
// whitelistedTokens = all tokens (including inactive)
// isLoading = loading state
```

### Frontend Implementation

The `LimitOrderForm` component automatically filters `TOKEN_CONSTANTS` to only show tokens that are:

1. In `TOKEN_CONSTANTS` (for UI metadata like ticker, name, logo)
2. AND in the contract's active whitelist (verified via address)

```typescript
// Example from LimitOrderForm.tsx
const { activeTokens } = useContractWhitelistRead();

const whitelistedAddresses = new Set(
  activeTokens.map((token) => token.tokenAddress.toLowerCase())
);

const availableTokens = TOKEN_CONSTANTS.filter((t) => {
  if (!t.a || !t.dexs) return false;
  return whitelistedAddresses.has(t.a.toLowerCase());
});
```

## Updating the Whitelist

### On-Chain Updates (Contract Owner Only)

The contract owner can update the whitelist using these functions:

- `addTokenAddress(address)` - Add a new token to whitelist
- `setTokenStatus(address, bool)` - Activate/deactivate a token

### Frontend Updates

**No code changes needed!** The whitelist automatically updates in the UI when:

1. The contract owner modifies the whitelist on-chain
2. Users refresh the page or reconnect their wallet
3. The `useContractWhitelistRead` hook refetches data

### Viewing Current Whitelist

To check the current whitelist state:

```bash
npm run check-whitelist
```

Or query the contract directly via etherscan/block explorer

## Important Notes

- The whitelist is **entirely controlled by the smart contract**
- The frontend **automatically reads** from the contract - no manual updates needed
- Only **active** tokens can be used for creating limit orders
- The contract owner can add/remove/activate/deactivate tokens at any time
- Token metadata (name, ticker, logo) comes from `TOKEN_CONSTANTS` in `constants/crypto.ts`
- Token availability comes from the contract's whitelist

## Adding New Tokens to TOKEN_CONSTANTS

If a token is whitelisted on-chain but not in `TOKEN_CONSTANTS`:

1. Add the token to `constants/crypto.ts` with proper metadata:

```typescript
{
  chain: 369,
  a: "0x...",  // Token address
  dexs: "0x...",  // DEX pair address (if available)
  ticker: "SYMBOL",
  decimals: 18,
  name: "Token Name"
}
```

2. The token will automatically appear in the UI if it's active in the contract whitelist
