# Block Explorer Update

**Date**: December 2024  
**Change**: Updated all transaction links to use Otterscan for PulseChain Mainnet

---

## Summary

All transaction links in toasts and "View Tx" buttons now correctly use:

- **Mainnet (Chain ID 369)**: `https://otter.pulsechain.com/tx/{hash}`
- **Testnet (Chain ID 943)**: `https://scan.v4.testnet.pulsechain.com/tx/{hash}`

---

## Changes Made

### 1. Created Utility Function

**File**: `utils/blockExplorer.ts`

```typescript
export function getBlockExplorerTxUrl(
  chainId: number | undefined,
  txHash: string
): string {
  // Mainnet (369) - Use Otterscan
  if (chainId === 369) {
    return `https://otter.pulsechain.com/tx/${txHash}`;
  }

  // Testnet (943) - Use PulseChain Testnet Explorer
  if (chainId === 943) {
    return `https://scan.v4.testnet.pulsechain.com/tx/${txHash}`;
  }

  // Default to Otterscan for mainnet
  return `https://otter.pulsechain.com/tx/${txHash}`;
}
```

### 2. Updated Components

#### OpenPositionsTable.tsx

- ✅ Order Fulfilled toast
- ✅ Order Cancelled toast
- ✅ Proceeds Collected toast
- ✅ All Expired Orders Cancelled toast
- ✅ Order Updated toast
- ✅ Expiration Updated toast (new calendar feature)

**Before**:

```typescript
href={`https://otter.pulsechain.com/tx/${txHash}`}
```

**After**:

```typescript
href={getBlockExplorerTxUrl(chainId, txHash)}
```

#### LimitOrderForm.tsx

- ✅ Order Created toast

**Before**:

```typescript
href={`https://scan.v4.testnet.pulsechain.com/tx/${txHash}`}
```

**After**:

```typescript
href={getBlockExplorerTxUrl(chainId, txHash)}
```

#### OrderHistoryTable.tsx

- ✅ "View Tx" button in order history

**Before**:

```typescript
window.open(
  `https://otter.pulsechain.com/tx/${transaction.transactionHash}`,
  "_blank"
);
```

**After**:

```typescript
window.open(
  getBlockExplorerTxUrl(chainId, transaction.transactionHash),
  "_blank"
);
```

#### NotificationBell.tsx

- ✅ "View Tx" button in notifications

**Before**:

```typescript
window.open(`https://otter.pulsechain.com/tx/${notif.txHash}`, "_blank");
```

**After**:

```typescript
window.open(getBlockExplorerTxUrl(chainId, notif.txHash), "_blank");
```

#### transactionTimeout.ts

- ✅ Timeout error message (removed hardcoded explorer link)

**Before**:

```typescript
`Check the block explorer: https://scan.v4.testnet.pulsechain.com/tx/${hash}`;
```

**After**:

```typescript
`Check your wallet or block explorer for transaction status.`;
```

---

## Benefits

### 1. Correct Explorer for Each Network

- **Mainnet users** → See transactions on Otterscan (best mainnet explorer)
- **Testnet users** → See transactions on Testnet Explorer
- **Automatic detection** → No manual switching needed

### 2. Centralized Configuration

- Single source of truth in `utils/blockExplorer.ts`
- Easy to update if explorer URLs change
- Consistent across entire app

### 3. Better User Experience

- Users always see the correct explorer for their network
- No confusion about which explorer to use
- Works seamlessly when switching networks

---

## Testing Checklist

### Mainnet (Chain ID 369)

- [ ] Create an order → Click "View Tx" in toast → Opens Otterscan
- [ ] Fill an order → Click "View Tx" → Opens Otterscan
- [ ] Cancel an order → Click "View Tx" → Opens Otterscan
- [ ] Update expiration → Click "View Tx" → Opens Otterscan
- [ ] Check notification bell → Click "View Tx" → Opens Otterscan
- [ ] Check order history → Click "View Tx" → Opens Otterscan

### Testnet (Chain ID 943)

- [ ] Same operations as above → All should open Testnet Explorer

---

## Example URLs

### Mainnet Transaction

```
https://otter.pulsechain.com/tx/0x89fe401ce10348c9de55adcb5c40240ccfd39413ae831e116585abe09cc77f76
```

### Testnet Transaction

```
https://scan.v4.testnet.pulsechain.com/tx/0xabcd1234...
```

---

## Files Modified

1. ✅ `utils/blockExplorer.ts` (NEW)
2. ✅ `components/OpenPositionsTable.tsx`
3. ✅ `components/LimitOrderForm.tsx`
4. ✅ `components/OrderHistoryTable.tsx`
5. ✅ `components/NotificationBell.tsx`
6. ✅ `utils/transactionTimeout.ts`

---

## Additional Utility Functions

The `blockExplorer.ts` utility also provides:

```typescript
// Get base URL
getBlockExplorerUrl(chainId);
// Returns: "https://otter.pulsechain.com" or "https://scan.v4.testnet.pulsechain.com"

// Get explorer name
getBlockExplorerName(chainId);
// Returns: "Otterscan" or "PulseChain Testnet Explorer"
```

These can be used for other features like:

- Showing explorer name in UI
- Linking to addresses, not just transactions
- Customizing tooltip text

---

## Future Enhancements

Consider adding:

- `getBlockExplorerAddressUrl(chainId, address)` - Link to address pages
- `getBlockExplorerBlockUrl(chainId, blockNumber)` - Link to block pages
- `getBlockExplorerTokenUrl(chainId, tokenAddress)` - Link to token pages

---

## Summary

✅ **All transaction links now use the correct block explorer based on network**  
✅ **Mainnet (369) → Otterscan**  
✅ **Testnet (943) → PulseChain Testnet Explorer**  
✅ **Centralized, maintainable, and consistent across the entire app**
