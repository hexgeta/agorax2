# Marketplace Order Fetching Fix

**Date**: December 2024  
**Issue**: Marketplace not showing orders from other users after switching wallets  
**Status**: ✅ FIXED

---

## Problem

When navigating to the Marketplace page, users could only see their own orders instead of ALL orders from all users. After switching wallets, the previously created orders were not visible.

**Root Cause**: The `useOpenPositions` hook was incorrectly falling back to the connected wallet address even when `undefined` was explicitly passed for marketplace mode.

### The Bug (Line 282 in `useOpenPositions.ts`):

```typescript
const queryAddress = userAddress || connectedAddress;
```

**What happened**:

1. Marketplace calls `useOpenPositions(undefined)` to fetch ALL orders
2. Hook receives `undefined` as `userAddress`
3. The `||` operator causes fallback to `connectedAddress`
4. Result: Only fetches orders for the currently connected wallet ❌

---

## Solution

Changed the hook signature to explicitly support marketplace mode with a `fetchAllOrders` flag:

### Updated Hook Signature:

```typescript
export function useOpenPositions(
  userAddress?: Address | null,
  fetchAllOrders?: boolean
);
```

### Updated Logic:

```typescript
// Determine query address:
// - If fetchAllOrders is true, use null (marketplace mode - fetch ALL orders)
// - Otherwise use userAddress if provided, or fall back to connectedAddress
const queryAddress = fetchAllOrders ? null : userAddress ?? connectedAddress;
```

### Updated Marketplace Call:

**Before**:

```typescript
useOpenPositions(isMarketplaceMode ? undefined : address);
```

**After**:

```typescript
useOpenPositions(address, isMarketplaceMode);
```

---

## How It Works Now

### User's Own Orders (Homepage):

```typescript
useOpenPositions(address, false);
// ↓
// queryAddress = address
// ↓
// Fetches only orders created by this address (4 efficient contract calls)
```

### Marketplace (All Orders):

```typescript
useOpenPositions(address, true);
// ↓
// queryAddress = null
// ↓
// Fetches ALL orders from ALL users (N contract calls where N = total orders)
```

---

## Files Modified

1. ✅ `hooks/contracts/useOpenPositions.ts`

   - Updated function signature to accept `fetchAllOrders` parameter
   - Changed query logic to use `null` for marketplace mode
   - Updated type definitions for `userAddress` to include `null`

2. ✅ `components/OpenPositionsTable.tsx`
   - Updated hook call from `useOpenPositions(isMarketplaceMode ? undefined : address)`
   - To: `useOpenPositions(address, isMarketplaceMode)`

---

## Benefits

### 1. Explicit Intent

- Clear parameter (`fetchAllOrders`) makes the intent obvious
- No more relying on falsy value tricks (`undefined` vs `null` vs not passed)
- Easier to understand and maintain

### 2. Correct Behavior

- **Marketplace**: Shows ALL orders from ALL users ✅
- **Homepage**: Shows only user's own orders ✅
- **Switching wallets**: Works correctly in both modes ✅

### 3. Performance

- **User's orders**: 4 efficient contract calls (`viewUserOpenOrders`, etc.)
- **Marketplace**: N calls for N total orders (unavoidable for full marketplace view)

---

## Testing Checklist

### Marketplace Mode

- [x] Connect wallet A
- [x] Create order with wallet A
- [x] Switch to wallet B
- [x] Navigate to Marketplace
- [x] ✅ Should see wallet A's order
- [x] Create order with wallet B
- [x] ✅ Should see both orders

### Homepage Mode (My Deals)

- [x] Connect wallet A
- [x] ✅ Should see only wallet A's orders
- [x] Switch to wallet B
- [x] ✅ Should see only wallet B's orders

---

## Edge Cases Handled

1. **No wallet connected**: Works correctly, marketplace shows all orders
2. **Switching between marketplace and homepage**: Correct orders shown in each view
3. **Refreshing page**: Maintains correct mode and shows appropriate orders
4. **Multiple users creating orders**: All orders visible in marketplace

---

## Technical Details

### Contract Call Difference

**User-Specific (Homepage)**:

```solidity
// 4 calls total
viewUserOpenOrders(userAddress, 0, 1000)
viewUserExpiredOrders(userAddress, 0, 1000)
viewUserCompletedOrders(userAddress, 0, 1000)
viewUserCancelledOrders(userAddress, 0, 1000)
```

**All Orders (Marketplace)**:

```solidity
// N calls where N = getTotalOrderCount()
getTotalOrderCount() // Get total
getOrderDetails(1)   // For each order ID
getOrderDetails(2)
getOrderDetails(3)
...
getOrderDetails(N)
```

The marketplace approach is more expensive but necessary to show all users' orders.

---

## Summary

✅ **Marketplace now correctly shows orders from ALL users**  
✅ **Homepage correctly shows only the connected user's orders**  
✅ **Switching wallets works as expected in both modes**  
✅ **Explicit `fetchAllOrders` parameter makes the intent clear**
