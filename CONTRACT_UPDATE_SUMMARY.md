# Contract Update Summary

**Date:** December 11, 2025  
**Updated By:** System Update  
**Purpose:** Update to AgoraX Mainnet Contract

---

## Contract Information

### Mainnet Contract

- **Address:** `0xc8a47F14b1833310E2aC72e4C397b5b14a9FEf8B`
- **Network:** PulseChain Mainnet (Chain ID: 369)
- **Environment Variable:** `NEXT_PUBLIC_AGORAX_SMART_CONTRACT`

### Testnet Contract (for development)

- **Address:** `0x321b52b7f55ea307e9ca87891d52cc92f37905cf`
- **Network:** PulseChain Testnet (Chain ID: 943)

---

## Changes Made

### 1. Documentation Updates

#### ✅ Created New Files

- `contracts/core/AgoraX_mainnet.sol` - Full mainnet contract source code reference
- `AGORAX_MAINNET_REFERENCE.md` - Quick reference guide for mainnet contract
- `CONTRACT_UPDATE_SUMMARY.md` - This file

#### ✅ Updated Documentation Files

- `WHITELIST_INFO.md` - Updated with:

  - Correct mainnet contract address
  - Dynamic whitelist system documentation
  - Removed outdated static token list
  - Updated usage examples for new hook-based system
  - Clarified relationship between TOKEN_CONSTANTS and on-chain whitelist

- `FUNCTION_AUDIT_REPORT.txt` - Complete rewrite with:

  - All 6 user write functions documented
  - UI implementation status for each
  - Hook references and file locations
  - Security implementations
  - Testing checklist
  - Based on actual mainnet contract

- `AGORAX_FUNCTIONS_GUIDE.txt` - Complete rewrite with:
  - All write functions (user + owner)
  - All view functions (20+)
  - Complete parameter documentation
  - Usage examples with code
  - Best practices
  - Gas estimates
  - Based on actual mainnet contract

### 2. Code Updates

#### ✅ Configuration Files

- `config/testing.ts` - Updated comments with mainnet and testnet addresses
- `constants/crypto.ts` - Updated header comment to reference mainnet and dynamic whitelist
- `order_query.json` - Updated to use mainnet contract address

#### ✅ Scripts

- `scripts/check-whitelist.js` - Updated to:
  - Use `NEXT_PUBLIC_AGORAX_SMART_CONTRACT` from `.env.local`
  - Default to mainnet address if env not set
  - Updated console messages from "OTC" to "AgoraX"

#### ✅ Hooks

- `hooks/use-notifications.ts` - Updated to:
  - Import `getContractAddress` from config
  - Use dynamic contract address based on chainId
  - Renamed variable from `OTC_CONTRACT_ADDRESS` to `AGORAX_CONTRACT_ADDRESS`
  - Added `chainId` to dependencies

#### ✅ Components

- `components/NavBar.tsx` - Removed notification bell (commented out)
- `components/LimitOrderForm.tsx` - Updated to use dynamic whitelist via `useContractWhitelistRead`
- `components/OpenPositionsTable.tsx` - Removed bistro references from comments
- `components/OrderHistoryTable.tsx` - Removed bistro references from comments
- `hooks/contracts/useContractWhitelist.ts` - Removed bistro function reference

### 3. Removed References

#### ✅ Bistro References Cleaned Up

- ❌ Removed: "works for both Bistro and AgoraX" comments
- ❌ Removed: `getBistroStakingAddress` function reference
- ❌ Removed: "Unable to connect to the AgoráX Bistro contract" message
- ❌ Removed: "(Different from Bistro's 0x...)" comment
- ✅ Verified: No remaining "bistro" references in codebase

#### ✅ Old Contract Addresses Removed

- ❌ `0x342DF6d98d06f03a20Ae6E2c456344Bb91cE33a2` (replaced everywhere)
- ✅ Updated to use `NEXT_PUBLIC_AGORAX_SMART_CONTRACT` environment variable
- ✅ Updated comments to reference both mainnet and testnet addresses

---

## Environment Configuration

### Required .env.local Entry

```bash
# AgoraX Contract Address
# Mainnet: 0xc8a47F14b1833310E2aC72e4C397b5b14a9FEf8B
# Testnet: 0x321b52b7f55ea307e9ca87891d52cc92f37905cf
NEXT_PUBLIC_AGORAX_SMART_CONTRACT=0xc8a47F14b1833310E2aC72e4C397b5b14a9FEf8B
```

---

## Dynamic Whitelist System

### How It Works

1. **Contract Storage:** Tokens are stored on-chain in the AgoraX contract
2. **Frontend Fetch:** UI calls `viewWhitelisted()` or `viewActiveWhitelisted()`
3. **Hook Integration:** `useContractWhitelistRead` provides React state
4. **UI Update:** Token dropdowns automatically show only active whitelisted tokens

### Benefits

- ✅ No manual frontend updates needed when whitelist changes
- ✅ Always in sync with on-chain state
- ✅ Owner can manage whitelist without frontend deployment
- ✅ Reduces hardcoded data and potential mismatches

### Implementation Files

- `hooks/contracts/useContractWhitelistRead.ts` - Whitelist fetching hook
- `components/LimitOrderForm.tsx` - Uses dynamic whitelist for token selection
- `config/abis.ts` - Contains whitelist function ABIs

---

## Function Changes from Previous Version

### Updated Function Signatures

The mainnet contract uses **individual parameters** instead of struct parameters:

#### placeOrder - NOW:

```solidity
function placeOrder(
  address _sellToken,
  uint256 _sellAmount,
  uint256[] calldata _buyTokensIndex,
  uint256[] calldata _buyAmounts,
  uint64 _expirationTime,
  bool _allOrNothing
) external payable
```

#### placeOrder - BEFORE (some versions):

```solidity
function placeOrder(
  OrderDetails calldata _orderDetails
) external payable
```

**Impact:** Frontend already uses individual parameters, no changes needed.

### New Features in Mainnet

1. **cleanInactiveUsers** - Optimization for findFillableOrders performance
2. **trackedUserCounts** - View function to estimate cleanup needs
3. **Improved pagination** - Better cursor handling in view functions

---

## Testing Checklist

### Contract Address Verification

- [ ] Verify `.env.local` has correct mainnet address
- [ ] Test wallet connection on mainnet
- [ ] Verify contract calls use correct address
- [ ] Check block explorer shows contract at address

### Whitelist Functionality

- [ ] Run `npm run check-whitelist` to verify on-chain whitelist
- [ ] Verify UI shows only whitelisted tokens
- [ ] Test token selection in LimitOrderForm
- [ ] Confirm tokens appear/disappear when whitelist changes

### Core Functions

- [ ] Place order with whitelisted token
- [ ] Fill an order
- [ ] Cancel order
- [ ] Collect proceeds
- [ ] Extend expiration
- [ ] Batch cancel expired orders

### UI Integration

- [ ] Notification bell hidden
- [ ] No console errors related to contract
- [ ] All transaction toasts working
- [ ] Price calculations accurate
- [ ] Balance displays correct

---

## Files Changed

### New Files Created

1. `contracts/core/AgoraX_mainnet.sol`
2. `AGORAX_MAINNET_REFERENCE.md`
3. `CONTRACT_UPDATE_SUMMARY.md`

### Files Updated

1. `WHITELIST_INFO.md`
2. `FUNCTION_AUDIT_REPORT.txt`
3. `AGORAX_FUNCTIONS_GUIDE.txt`
4. `config/testing.ts`
5. `constants/crypto.ts`
6. `order_query.json`
7. `scripts/check-whitelist.js`
8. `hooks/use-notifications.ts`
9. `components/NavBar.tsx`
10. `components/LimitOrderForm.tsx`
11. `components/OpenPositionsTable.tsx`
12. `components/OrderHistoryTable.tsx`
13. `hooks/contracts/useContractWhitelist.ts`

### Files Deleted

- None (old versions of FUNCTION_AUDIT_REPORT.txt and AGORAX_FUNCTIONS_GUIDE.txt were replaced)

---

## Next Steps

### Immediate

1. ✅ Verify `.env.local` has correct contract address
2. ✅ Test on mainnet with small transaction
3. ✅ Run `npm run check-whitelist` to verify whitelist

### Optional

1. Consider renaming `OTC_CONTRACT_ADDRESS` variables to `AGORAX_CONTRACT_ADDRESS` for consistency (cosmetic)
2. Update any additional scripts or tooling
3. Test all user flows end-to-end

---

## Support

**Contract Explorer:** https://scan.pulsechain.com/address/0xc8a47F14b1833310E2aC72e4C397b5b14a9FEf8B  
**Documentation:** See `AGORAX_MAINNET_REFERENCE.md`  
**Function Guide:** See `AGORAX_FUNCTIONS_GUIDE.txt`

---

_Update Complete ✅_
