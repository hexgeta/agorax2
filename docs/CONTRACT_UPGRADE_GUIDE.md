# AgoraX Contract Upgrade Guide

## Upgrading from `AgoraX_mainnet.sol` to `AgoraX-final.sol`

Reference: Comparing the deployed contract at `0xc8a47F14b1833310E2aC72e4C397b5b14a9FEf8B` against `contracts/core/AgoraX-final.sol`.

---

## BREAKING CHANGES (Requires Frontend Updates)

### 1. `OrderProceedsCollected` Event Signature Changed

The event now includes detailed information about which tokens and amounts were collected.

**Mainnet (current):**
```solidity
event OrderProceedsCollected(address indexed user, uint256 indexed orderID);
```

**Final (new):**
```solidity
event OrderProceedsCollected(address indexed user, uint256 indexed orderID, uint256[] buyTokenIndices, uint256[] amountsCollected);
```

This changes the event topic hash, so all event listeners will stop matching.

**Files to update:**

| File | What to change |
|------|---------------|
| `app/api/cron/sync-blockchain/route.ts` (line ~60) | Update `parseAbiItem` event signature to include `uint256[] buyTokenIndices, uint256[] amountsCollected` |
| `app/api/events/backfill/route.ts` (line ~61) | Same event signature update |
| `subgraph/subgraph.yaml` (line ~32) | Update event mapping: `OrderProceedsCollected(indexed address,indexed uint256,uint256[],uint256[])` |
| `subgraph/abis/AgoraX.json` (line ~40) | Add the two new non-indexed inputs to the event ABI |
| `subgraph/src/mapping.ts` (line ~249) | Handle the 2 new event params (`buyTokenIndices`, `amountsCollected`) in the handler |
| `app/docs/technical/smart-contract/page.tsx` (line ~271) | Update docs event signature display |
| `docs/API_AND_DATABASE_SETUP.md` (line ~76) | Update docs event signature |
| `DEVELOPER_REFERENCE.md` (line ~256) | Update docs event signature |

### 2. New Event: `ProceedsCollectionFailed`

```solidity
event ProceedsCollectionFailed(address indexed user, uint256 indexed orderID, address failedToken);
```

Not a break, but you should add listeners for it. Without this, partial collection failures are invisible to the frontend. The final contract skips failed token transfers instead of reverting the whole tx (see behavioral change #4 below).

**Recommended updates:**

| File | What to add |
|------|------------|
| `app/api/cron/sync-blockchain/route.ts` | Add `parseAbiItem` for `ProceedsCollectionFailed` and process these logs |
| `app/api/events/backfill/route.ts` | Same |
| `subgraph/subgraph.yaml` | Add event handler mapping |
| `subgraph/abis/AgoraX.json` | Add event ABI entry |
| `subgraph/src/mapping.ts` | Add handler function |

### 3. Update Contract Address

| File | What to change |
|------|---------------|
| `.env` / `.env.local` | Update `NEXT_PUBLIC_AGORAX_SMART_CONTRACT` env var to new contract address |

---

## BEHAVIORAL CHANGES (No Code Breaks, But Works Differently)

### 4. `_collectProceeds` — Graceful Failure Instead of Hard Revert

**Mainnet:** Uses `safeTransfer` — if ANY token transfer fails, the entire transaction reverts. Burns AGX upfront before transfers.

**Final:** Uses low-level `.call()` with manual return data checking:
- Skips tokens that fail to transfer (instead of reverting the whole tx)
- Only burns AGX for tokens that were successfully transferred
- Emits `ProceedsCollectionFailed` for each failed token
- Emits `OrderProceedsCollected` with detailed indices/amounts for successes

**User impact:** Users will no longer get stuck when one of their proceed tokens is broken, paused, or has a transfer issue. The tx succeeds partially. Consider surfacing `ProceedsCollectionFailed` events in the UI so users know which tokens failed.

### 5. New Function: `collectProceedsByToken`

```solidity
function collectProceedsByToken(uint256 _orderID, uint256 _buyTokenIndexInOrder, address _recipient) external
```

Allows collecting proceeds for a single specific buy token instead of all at once. The ABI in `config/abis.ts` already includes this function (lines 111-134), and `useContractWhitelist` already wraps it. This function simply doesn't exist on the current mainnet contract — after upgrade it starts working with no frontend changes.

### 6. `_fillOrder` Now Tracks `soldByBuyToken`

**Final adds:**
```solidity
mapping(uint256 => mapping(uint256 => uint256)) private soldByBuyToken;
// In _fillOrder:
soldByBuyToken[_orderID][buyTokenIndex] += _soldAmount;
```

Internal storage needed for per-token proceeds collection (`collectProceedsByToken`). No frontend impact.

---

## BUG FIXES (No Frontend Impact)

### 7. `viewWhitelisted` Bounds Check
- **Mainnet:** Underflows if `cursor >= whitelistedTokens.length`
- **Final:** Returns empty array gracefully with early return

### 8. `findFillableOrders` Cursor + Sort Fix
- **Mainnet:** `cnt - 1` underflows when `cnt == 0` in the bubble sort loop
- **Final:** Guards with `if (cnt > 1)` and adds early return for invalid cursor

### 9. `viewActiveWhitelisted` Bounds Check
- Same cursor bounds fix as `viewWhitelisted`

---

## UNCHANGED FUNCTIONS (No Updates Needed)

All of these are identical in both contracts:

**Write functions:**
- `placeOrder` — same signature, same behavior
- `cancelOrder` — same
- `cancelAllExpiredOrders` — same
- `fillOrder` — same
- `collectProceeds` — same signature (internal behavior changed, see #4)
- `updateOrderExpiration` — same

**View functions:**
- `getOrderDetails` — same
- `getTotalOrderCount` — same
- `getUserOrderCount` — same
- `getUserExpiredOrdersCount` — same
- `viewUserOpenOrders` — same
- `viewUserExpiredOrders` — same
- `viewUserCompletedOrders` — same
- `viewUserCancelledOrders` — same
- `viewCollectableProceeds` — same
- `getCurrentTimestamp` — same
- `trackedUserCounts` — same

**Whitelist functions:**
- `addTokenAddress`, `setTokenStatus`, `isWhitelisted`, `viewCountWhitelisted`, `getTokenInfoAt`, `getTokenWhitelistIndex`, `viewWhitelisted`, `viewActiveWhitelisted` — all same

**ERC20 / Admin functions:**
- `name`, `symbol`, `totalSupply`, `decimals`, `owner`, `balanceOf` — all same
- `listingFee`, `protocolFee` — same
- `pause`, `unpause`, `updateFeeAddress`, `updateCooldownPeriod`, `updateListingFee`, `updateProtocolFee`, `cleanInactiveUsers` — all same

**Structs:**
- `OrderDetails`, `OrderDetailsWithID`, `CompleteOrderDetails`, `UserOrderDetails`, `TokenInfo` — all identical

**Other events (unchanged):**
- `OrderPlaced`, `OrderCancelled`, `OrderFilled`, `OrderExpirationUpdated`, `Paused`, `FeeAddressUpdated`, `CooldownPeriodUpdated`, `ListingFeeUpdated`, `ProtocolFeeUpdated`, `UserListCleanup`, `TokenWhitelisted`, `TokenStatusChanged`

---

## EXISTING ABI STATUS

The ABI in `config/abis.ts` is already aligned with the final contract for all **function** signatures. The only mismatch is on the event side (events are not in `abis.ts` — they're hardcoded in the API routes and subgraph).

**Already ready (no changes needed):**
- `collectProceedsByToken` — already in ABI (lines 111-134) and wrapped in `useContractWhitelist`
- `viewCollectableProceeds` — already in ABI (lines 135-159)
- All other function ABIs match

**Note:** `getUserOrdersLength` in the ABI (line 452) maps to `getUserOrderCount` in the contract. Both exist in both contracts, so this is fine.

---

## UPGRADE CHECKLIST

1. [ ] Deploy `AgoraX-final.sol` to PulseChain mainnet
2. [ ] Update contract address in `.env` (`NEXT_PUBLIC_AGORAX_SMART_CONTRACT`)
3. [ ] Update `OrderProceedsCollected` event signature in `sync-blockchain/route.ts`
4. [ ] Update `OrderProceedsCollected` event signature in `backfill/route.ts`
5. [ ] Add `ProceedsCollectionFailed` event listener to `sync-blockchain/route.ts`
6. [ ] Add `ProceedsCollectionFailed` event listener to `backfill/route.ts`
7. [ ] Update subgraph: `subgraph.yaml`, `abis/AgoraX.json`, `src/mapping.ts`
8. [ ] Update docs: smart-contract page, API_AND_DATABASE_SETUP.md, DEVELOPER_REFERENCE.md
9. [ ] Run backfill against new contract to populate historical data
10. [ ] Test `collectProceedsByToken` in the UI (should just work)
11. [ ] Consider adding UI notification for `ProceedsCollectionFailed` events
