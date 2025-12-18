# Token Price Data Handling

## Problem Solved

Tokens with no DEX pair address (e.g., `HTT4000`, `hUSDC` without liquidity pools) were:

- ❌ Being skipped entirely in price fetching
- ❌ Showing `$0` or undefined prices
- ❌ No user indication that price data was unavailable
- ❌ Users could create orders without knowing there's no market reference

## Solution Implemented

### 1. Backend Price Detection (`hooks/crypto/useTokenPrices.ts`)

**Detects "null" DEX addresses:**

```typescript
const isNullAddress =
  !dexs ||
  dexs === "" ||
  dexs === "0x0" ||
  dexs === "0x0000000000000000000000000000000000000000";
```

**Returns `-1` for tokens with no price source:**

```typescript
if (!bestPairAddress) {
  results[contractAddress] = {
    ...DEFAULT_PRICE_DATA,
    price: -1, // Special value meaning "no price available"
  };
  continue;
}
```

### 2. Frontend Warning UI (`components/LimitOrderForm.tsx`)

#### A. Warning Banner

Shows a prominent warning when sell or buy token has no price data:

```typescript
{
  sellToken &&
    buyTokens[0] &&
    (prices[sellToken.a]?.price === -1 ||
      prices[buyTokens[0].a]?.price === -1) && (
      <div className="mt-2 p-3 bg-yellow-900/20 border border-yellow-500/30">
        ⚠️ No Market Price Available
        {tokenName} has no market price data. You'll need to manually set your desired
        price.
      </div>
    );
}
```

#### B. "No Price" Badge in Dropdowns

Visual indicator next to tokens in sell/buy dropdowns:

```typescript
{
  token.a && prices[token.a]?.price === -1 && (
    <span className="text-xs bg-yellow-900/30 border border-yellow-500/30 text-yellow-500">
      No Price
    </span>
  );
}
```

#### C. Disabled Percentage Buttons

Market/+1%/+5% buttons are hidden when `marketPrice <= 0`

## Tokens Affected

Common tokens with no price data:

- **HTT4000, HTT6000** - HEX Time Tokens (no active liquidity)
- **hUSDC** - Hyperlane USDC (depending on liquidity)
- **weDAI** - Wrapped DAI (no DEX pair)
- **eTEAM, ePARTY** - Low liquidity Maximus tokens
- **DEVC** - DEV Coin
- **VAULT** - VAULT 369
- **ZERO** - ZeroTrust
- **cDAI** - Compound Dai

## User Experience

### Before:

- Token shows `$0.00` price
- No indication anything is wrong
- Users create orders thinking market price exists
- Confusing "infinite percentage" calculations

### After:

- ⚠️ Clear warning banner: "No Market Price Available"
- 🏷️ "No Price" badge in dropdown
- 🚫 Percentage buttons hidden
- 📝 User informed they must manually set price

## Technical Details

### Price Value Meanings:

- `price > 0` = Valid market price
- `price === 0` = Failed to fetch (error)
- `price === -1` = No price source exists (intentional)

### Detection Logic:

```typescript
// Null address check
dexs === "0x0000000000000000000000000000000000000000";

// Price check in UI
prices[tokenAddress]?.price === -1;
```

## Testing

To test with a token that has no price:

1. Select `HTT4000` or `hUSDC` as sell or buy token
2. You should see:
   - ⚠️ Yellow warning banner below limit price
   - "No Price" badge next to token in dropdown
   - No Market/+1%/+5% buttons
3. You can still create an order by manually entering a limit price

## Benefits

✅ **User Awareness**: Clear warning when no market price exists  
✅ **Better UX**: Visual indicators in dropdowns  
✅ **Prevents Confusion**: No misleading `$0` prices  
✅ **Still Functional**: Users can still trade by manually setting prices  
✅ **Clear Distinction**: `-1` vs `0` vs valid price
