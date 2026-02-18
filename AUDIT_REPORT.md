# AgoraX Security Audit Report v2

**Contract:** AgoraX.sol
**Version:** Solidity ^0.8.17
**Original Audit Date:** January 21, 2026
**Follow-Up Audit Date:** February 18, 2026
**Methodology:** Manual review with Trail of Bits entry-point analysis and sharp-edges methodology

---

## Executive Summary

This is a follow-up security audit of the AgoraX limit order platform smart contract for PulseChain. The original audit (January 21, 2026) identified 7 findings including 1 High severity issue (H-01: Proceeds permanently locked when one buy token fails). The contract has since been updated to address critical findings.

This follow-up audit verifies the effectiveness of applied fixes, identifies any new issues introduced by the changes, and performs additional deep analysis using entry-point and invariant-based methodology. The contract is now in significantly better shape for production deployment.

### Severity Classification

| Severity | Description |
|----------|-------------|
| **Critical** | Direct fund loss or permanent lock affecting multiple users |
| **High** | Fund loss or lock under specific conditions |
| **Medium** | Griefing attacks, economic manipulation, or denial of service |
| **Low** | Minor issues, best practice violations |
| **Informational** | Observations and recommendations |

### Summary of All Findings

#### Previously Identified (January 21, 2026)

| ID | Severity | Title | Previous Status | Current Status |
|----|----------|-------|-----------------|----------------|
| H-01 | High | Proceeds Locked When One Buy Token Fails | Confirmed | **RESOLVED** |
| M-01 | Medium | Unfillable Dust Orders via Strategic Partial Fills | Confirmed | Acknowledged |
| M-02 | Medium | Front-Running Cancellation Griefing | Confirmed | Acknowledged (mitigated by H-01 fix) |
| L-01 | Low | Arithmetic Underflow in `findFillableOrders` | Confirmed | **RESOLVED** |
| L-02 | Low | No Minimum Order Size Allows Order Book Pollution | Confirmed | Acknowledged |
| L-03 | Low | Cooldown Upper Bound Too High | Confirmed | Acknowledged |
| I-01 | Informational | Fee Address Can Block Protocol if Misconfigured | Confirmed | Acknowledged |

#### New Findings (February 18, 2026)

| ID | Severity | Title | Status |
|----|----------|-------|--------|
| L-04 | Low | `validOrderID` Modifier Allows Order ID 0 | Confirmed |
| L-05 | Low | `cleanInactiveUsers` Swap-and-Pop Affects Pagination Consistency | Confirmed |
| L-06 | Low | Low-Level Call to Non-Existent Token Treats Empty Return as Success | Confirmed |
| I-02 | Informational | Stale Test Cases From Previous Contract Version | **RESOLVED** |
| I-03 | Informational | Rebase Token Limitations | Confirmed |
| I-04 | Informational | Sell Token Not Validated Against Whitelist | Confirmed |

---

## Fix Verification: Previously Identified Issues

---

### H-01: Proceeds Locked When One Buy Token Fails — **RESOLVED**

**Previous Finding:** When an order accepts multiple buy tokens, `_collectProceeds` used `safeTransfer` in a loop. If any single token transfer failed, the entire transaction reverted, permanently locking all proceeds.

**Applied Fix:** The contract now implements a graceful failure pattern:

1. **Low-level `call` instead of `safeTransfer`:** ERC20 transfers use `address(buyToken).call(abi.encodeWithSelector(...))` with manual return data inspection, allowing individual transfer failures without reverting the whole transaction.

2. **State-only-on-success pattern:** `buyTransactionsByOrderID` and `soldByBuyToken` are only zeroed out when a transfer succeeds. Failed transfers leave the state intact for retry.

3. **`ProceedsCollectionFailed` event:** Emitted for each failed token transfer, providing visibility into which tokens couldn't be collected.

4. **`collectProceedsByToken` function:** New function allowing users to collect proceeds for a single specific buy token, providing a targeted retry mechanism when `collectProceeds` partially fails.

**Verification Tests:**

| Test | Result | Description |
|------|--------|-------------|
| `test_H01_Fix_GracefulFailureWhenBuyTokenFails` | PASS | TokenB collected despite TokenC reverting |
| `test_H01_Fix_CollectRemainingAfterTokenFixed` | PASS | TokenC collected later via `collectProceedsByToken` |
| `test_Security_H01Fix_PartialCollectionSuccess` | PASS | AGX accounting correct for partial collection |
| `test_Security_H01Fix_AllTokensFail` | PASS | No revert even when ALL tokens fail |
| `test_Security_NoDoubleCountProceeds` | PASS | No double-counting between collection methods |
| `test_Security_CollectProceedsByToken_IndependentCollection` | PASS | Both methods work correctly in sequence |

**Assessment:** The fix is well-implemented. The graceful failure pattern correctly handles token failures without locking other proceeds. The `collectProceedsByToken` function provides an excellent escape hatch. The M-02 (front-running cancellation) worst case scenario is now mitigated because cancellation no longer fails when a proceed token is broken.

---

### L-01: Arithmetic Underflow in `findFillableOrders` — **RESOLVED**

**Previous Finding:** When `findFillableOrders` returned zero matching orders (`cnt = 0`), the bubble sort loop `for (i = 0; i < cnt - 1; ...)` would underflow.

**Applied Fix:** Added `if (cnt > 1)` guard before the bubble sort loop.

**Verification Tests:**

| Test | Result | Description |
|------|--------|-------------|
| `test_Security_L01Fix_FindFillableOrdersZeroResults` | PASS | Empty result set, no underflow |
| `test_Security_L01Fix_FindFillableNoMatchingToken` | PASS | No matching token, returns empty |

**Assessment:** Fix is correct and minimal.

---

### M-01: Unfillable Dust Orders — Acknowledged

**Status:** The team has acknowledged this finding. The `allOrNothing` flag provides opt-in protection for users concerned about dust attacks. Given that the economic impact is limited to gas costs for cancellation, this is an acceptable trade-off for supporting partial fills.

**Existing Tests Confirm:** `test_Attack_M01_TrulyUnfillableDust`, `test_Attack_M01_AllOrNothingPrevents`

---

### M-02: Front-Running Cancellation — Acknowledged (Mitigated)

**Status:** The severity of this finding is reduced by the H-01 fix. Previously, front-running a cancellation with a fill using a "broken" token could permanently lock all funds. Now, even if a front-run fill uses a problematic token, the cancellation's `_collectProceeds` handles failures gracefully. The user still receives their sell token refund and working token proceeds.

**Remaining Impact:** User receives unwanted proceeds tokens + partial refund instead of full refund. This is inherent to public mempool visibility and not specific to AgoraX.

---

### L-02, L-03, I-01 — Acknowledged

These findings remain present by design decision. The listing fee provides economic protection against order book spam (L-02), the 24-hour cooldown maximum is intentional (L-03), and the `updateFeeAddress` function provides an escape hatch for fee address issues (I-01).

---

## New Findings

---

### L-04: `validOrderID` Modifier Allows Order ID 0

**Severity:** Low
**Location:** `src/AgoraX.sol` — `validOrderID` modifier

#### Description

The `validOrderID` modifier checks `_orderID <= orderCounter` but does not reject `_orderID == 0`. Since order IDs start at 1 (after `orderCounter++`), ID 0 is never a valid order. While other checks prevent exploitation (e.g., `validActiveOrder` checks `orderOwner != address(0)`), the modifier should be explicit.

#### Impact

- No direct security impact — all functions with `validOrderID` have additional checks that reject order 0
- Minor code clarity issue
- `getOrderDetails(0)` reverts with an array out-of-bounds error rather than a descriptive message

#### Verification

| Test | Result | Description |
|------|--------|-------------|
| `test_Security_OrderID0_GetDetails` | PASS | Reverts (array bounds) |
| `test_Security_OrderID0_FillOrder` | PASS | Reverts with "Invalid order" |

#### Recommended Fix

```solidity
modifier validOrderID(uint256 _orderID) {
    require(_orderID > 0 && _orderID <= orderCounter, "AgoraX: Invalid order ID");
    _;
}
```

---

### L-05: `cleanInactiveUsers` Swap-and-Pop Affects Pagination Consistency

**Severity:** Low
**Location:** `src/AgoraX.sol` — `cleanInactiveUsers`, `findFillableOrders`

#### Description

`cleanInactiveUsers` uses a swap-and-pop algorithm to remove inactive users from `allUsersWithOrders`. This reorders the array, which can affect `findFillableOrders` pagination. If `cleanInactiveUsers` is called between paginated `findFillableOrders` queries, some users may be skipped or double-counted.

#### Impact

- Affects frontend pagination consistency only
- No fund safety impact
- Mitigation: Frontend can re-query from the beginning after cleanup

#### Verification

| Test | Result | Description |
|------|--------|-------------|
| `test_Security_CleanInactiveUsers_SwapAndPop` | PASS | Correctly removes inactive users |
| `test_Security_CleanInactiveUsers_Pagination` | PASS | Paginated cleanup works |

#### Recommended Mitigation

Document that `cleanInactiveUsers` should not be called during active frontend pagination. Consider adding a view function returning a cleanup-safe snapshot.

---

### L-06: Low-Level Call to Non-Existent Token Treats Empty Return as Success

**Severity:** Low
**Location:** `src/AgoraX.sol` — `_collectProceeds`, `collectProceedsByToken`

#### Description

The graceful failure pattern in `_collectProceeds` uses a low-level `call` for ERC20 transfers. If a token contract self-destructs or has no code at its address, the EVM returns `success = true` with empty `returndata`. The code treats empty return data as success (to handle old-style tokens like USDT that don't return a value), which means:

1. `buyTransactionsByOrderID` is zeroed out
2. AGX is burned
3. But no actual tokens are transferred

The proceeds would be effectively lost.

#### Impact

- Requires a whitelisted token to self-destruct or have no code — extremely unlikely
- `SELFDESTRUCT` is deprecated post-Dencun (EIP-6780)
- Whitelist is owner-controlled, limiting exposure

#### Recommended Mitigation

Add an `extcodesize` check before transfer:

```solidity
if (address(buyToken).code.length == 0) {
    emit ProceedsCollectionFailed(msg.sender, _orderID, address(buyToken));
    continue;
}
```

---

### I-02: Stale Test Cases From Previous Contract Version — **RESOLVED**

**Severity:** Informational
**Status:** Resolved in this audit

#### Description

Four test cases from the original audit expected the OLD contract behavior (H-01 vulnerability present):
- `test_Attack_H01_ProceedsLockedWhenBuyTokenFails` — expected `vm.expectRevert`
- `test_Attack_H01_ProceedsUnlockedWhenTokenFixed` — expected intermediate revert
- `test_CollectProceeds_Success` — expected old event signature
- `test_CollectProceeds_RevertRecipientCantReceiveNative` — expected revert for non-receivable

These have been updated to test the new behavior:
- H-01 tests now verify graceful failure and `collectProceedsByToken` recovery
- Event test now matches updated `OrderProceedsCollected` signature
- Non-receivable recipient test now verifies graceful failure with proceeds retention

---

### I-03: Rebase Token Limitations

**Severity:** Informational
**Location:** Contract-wide

#### Description

Rebase tokens (positive or negative) are not explicitly handled:
- **Positive rebase:** Extra tokens in the contract are locked with no withdrawal mechanism
- **Negative rebase:** Cancellation refunds or proceed transfers may fail if the contract's balance dropped

The contract's fee-on-transfer detection (balance checks before/after deposit) does not catch rebase behavior since rebases occur asynchronously.

#### Recommended Mitigation

Document this limitation. Consider adding an admin `rescueTokens` function for tokens accidentally sent to the contract (a common pattern). Avoid whitelisting known rebase tokens.

---

### I-04: Sell Token Not Validated Against Whitelist

**Severity:** Informational
**Location:** `src/AgoraX.sol` — `placeOrder`

#### Description

The `placeOrder` function validates buy tokens against the whitelist but does not validate the sell token. Any ERC20 token can be used as a sell token. This is a design choice — the sell token is provided by the order creator, and buyers choose whether to fill — but it means:

- Orders for worthless tokens can be created (listing fee provides economic protection)
- `findFillableOrders` searches by sell token, so the frontend handles filtering

#### Assessment

This is an intentional design decision. The listing fee acts as a spam deterrent. No change recommended.

---

## Security Strengths

The contract demonstrates robust security practices:

| Feature | Implementation | Assessment |
|---------|----------------|------------|
| Reentrancy Protection | `ReentrancyGuard` on all state-changing externals | Strong |
| Access Control | `Ownable2Step` for two-step ownership transfer | Strong |
| Token Transfer Safety | `SafeERC20` for deposits; graceful failure for withdrawals | Strong |
| Integer Overflow | Solidity 0.8+ automatic checks + `Math.mulDiv` | Strong |
| Fee-on-Transfer Detection | Balance diff checks on all token deposits | Strong |
| MEV Protection | Configurable cooldown period (20s–86400s) | Adequate |
| Non-transferable Receipts | AGX transfer/approve/transferFrom all disabled | Strong |
| Graceful Failure | `_collectProceeds` handles individual token failures | Strong (new) |
| Selective Recovery | `collectProceedsByToken` for targeted retry | Strong (new) |
| Pause Mechanism | Admin can pause new orders/fills; cancel/collect still work | Strong |

---

## AGX Token Invariant Analysis

The AGX receipt token is minted 1:1 with sell amounts and burned during proceeds collection and cancellation. Our invariant analysis confirms:

| Invariant | Verified | Tests |
|-----------|----------|-------|
| Mint amount equals sell amount | Yes | `test_Security_AGXSupplyInvariant_PlaceAndCancel` |
| Burn on cancel equals remaining amount | Yes | `test_Security_AGXSupplyInvariant_PlaceAndCancel` |
| Partial fill + cancel: correct total burn | Yes | `test_Security_AGXSupplyInvariant_PartialFillAndCancel` |
| Multi-user multi-order supply accounting | Yes | `test_Security_AGXSupplyInvariant_MultiUserMultiOrder` |
| No double-counting between collection methods | Yes | `test_Security_NoDoubleCountProceeds` |
| Graceful failure: no AGX burned on failed transfer | Yes | `test_Security_H01Fix_AllTokensFail` |

---

## Protocol Fee Analysis

| Scenario | Expected Behavior | Verified |
|----------|-------------------|----------|
| Fee lowered after order placement | Uses lower current fee | `test_Security_ProtocolFee_MinCreationAndCurrent` |
| Fee raised after order placement | Uses lower creation fee | `test_Security_ProtocolFee_MinCreationAndCurrentRaised` |
| Zero protocol fee | No fee deducted | `test_Security_ZeroProtocolFee` |
| Zero listing fee | Orders accepted with no payment | `test_Security_ZeroListingFee` |

The `min(creationFee, currentFee)` pattern is fair to order creators and prevents retroactive fee increases.

---

## Test Coverage Summary

| Category | Tests | Status |
|----------|-------|--------|
| Unit Tests (AgoraXTest) | 137 | All Pass |
| Fuzz Tests (AgoraXFuzzTest) | 5 | All Pass |
| Invariant Tests (AgoraXInvariantTest) | 4 | All Pass |
| Attack Vector Tests (AttackVectorTest) | 10 | All Pass |
| **Security Audit Tests (SecurityAuditTest)** | **40** | **All Pass** |
| **Total** | **196** | **All Pass** |

### New Security Audit Tests Added

| Test | Category |
|------|----------|
| `test_Security_H01Fix_PartialCollectionSuccess` | H-01 Fix Verification |
| `test_Security_H01Fix_AllTokensFail` | H-01 Fix Verification |
| `test_Security_CollectProceedsByToken_IndependentCollection` | H-01 Fix Verification |
| `test_Security_NoDoubleCountProceeds` | H-01 Fix Verification |
| `test_Security_L01Fix_FindFillableOrdersZeroResults` | L-01 Fix Verification |
| `test_Security_L01Fix_FindFillableNoMatchingToken` | L-01 Fix Verification |
| `test_Security_AGXSupplyInvariant_PlaceAndCancel` | AGX Invariant |
| `test_Security_AGXSupplyInvariant_PartialFillAndCancel` | AGX Invariant |
| `test_Security_AGXSupplyInvariant_MultiUserMultiOrder` | AGX Invariant |
| `test_Security_CooldownNotResetOnExpirationExtend` | Cooldown Bypass |
| `test_Security_CooldownResetOnRevive` | Cooldown Bypass |
| `test_Security_OrderID0_GetDetails` | Edge Case |
| `test_Security_OrderID0_FillOrder` | Edge Case |
| `test_Security_MultiBuyToken_AccountingCorrect` | Multi-Token |
| `test_Security_MultiBuyToken_IndependentRatios` | Multi-Token |
| `test_Security_CancelCompletedOrder` | Edge Case |
| `test_Security_BatchCancelWithPartialProceeds` | Batch Operations |
| `test_Security_NativeSellOrder_FeeAndAmountSeparation` | Native Token |
| `test_Security_NativeBuyFill_FeeAndRefund` | Native Token |
| `test_Security_ZeroProtocolFee` | Fee Edge Cases |
| `test_Security_ProtocolFee_MinCreationAndCurrent` | Fee Edge Cases |
| `test_Security_ProtocolFee_MinCreationAndCurrentRaised` | Fee Edge Cases |
| `test_Security_CleanInactiveUsers_SwapAndPop` | Cleanup |
| `test_Security_CleanInactiveUsers_Pagination` | Cleanup |
| `test_Security_DifferentDecimalTokens` | Token Compatibility |
| `test_Security_ReentrancyGuard_CancelOrder` | Reentrancy |
| `test_Security_PausedState_CancelAndCollectStillWork` | Pause Safety |
| `test_Security_DeactivatedBuyToken_ExistingOrderFillable` | Whitelist |
| `test_Security_DeactivatedBuyToken_NewOrderReverts` | Whitelist |
| `test_Security_ZeroListingFee` | Fee Edge Cases |
| `test_Security_AGXNonTransferable` | Token Safety |
| `test_Security_MaxBuyTokens` | Limits |
| `test_Security_ExceedMaxBuyTokens` | Limits |
| `test_Security_TwoStepOwnership` | Access Control |
| `test_Security_DirectPLSRejected` | Receive Guard |
| `test_Security_FeeAddressCannotBeSelf` | Validation |
| `test_Security_FeeAddressCannotBeZero` | Validation |
| `test_Security_FindFillableOrders_Sorted` | View Functions |
| `test_Security_FindFillableOrders_CursorBeyondRange` | View Functions |
| `test_Security_CollectProceedsByToken_ToRecipient` | Proceeds |

---

## Recommendations Summary

| Priority | ID | Recommendation | Status |
|----------|----|----------------|--------|
| **Resolved** | H-01 | Graceful failure in `_collectProceeds` | Fixed |
| **Resolved** | L-01 | `cnt > 1` guard in `findFillableOrders` | Fixed |
| **Resolved** | I-02 | Update stale test cases | Fixed |
| **Consider** | L-04 | Add `_orderID > 0` check to `validOrderID` | Open |
| **Consider** | L-06 | Add `extcodesize` check before low-level transfer | Open |
| **Document** | L-05 | Note pagination impact of `cleanInactiveUsers` | Open |
| **Document** | I-03 | Document rebase token limitations | Open |
| **Acknowledged** | M-01 | Dust orders — `allOrNothing` flag mitigates | By design |
| **Acknowledged** | M-02 | Front-run cancellation — mitigated by H-01 fix | By design |
| **Acknowledged** | L-02 | Minimum order size — listing fee deters spam | By design |
| **Acknowledged** | L-03 | Cooldown upper bound — intentional range | By design |

---

## Conclusion

The AgoraX contract has been significantly improved since the original audit. The critical H-01 vulnerability (proceeds permanently locked when one buy token fails) has been properly resolved with a well-implemented graceful failure pattern and the addition of `collectProceedsByToken` as a targeted recovery mechanism. The L-01 underflow in `findFillableOrders` has also been fixed.

No new Critical or High severity findings were identified. The remaining Low and Informational findings are minor and do not present fund-safety risks. The contract demonstrates mature security practices including reentrancy protection, two-step ownership, fee-on-transfer detection, MEV cooldown, and non-transferable receipt tokens.

**The contract is suitable for production deployment.** The remaining Low-severity recommendations (L-04, L-05, L-06) are quality improvements that can be addressed at the team's discretion.

---

**Report Generated:** February 18, 2026
**Audit Classification:** Security Review (Follow-Up)
**Total Tests:** 192 passing (40 new security tests added)
