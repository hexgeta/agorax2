# AgoraX Security Audit Report

**Contract:** AgoraX-final.sol
**Version:** Solidity ^0.8.17
**Audit Date:** February 3, 2026
**Auditor:** Claude Code Security Analysis

---

## Executive Summary

This audit report analyzes the security posture, accounting integrity, and mathematical correctness of the AgoraX limit order platform smart contract. The contract demonstrates excellent security fundamentals with comprehensive use of OpenZeppelin libraries (Ownable2Step, ReentrancyGuard, SafeERC20), immutable fee caps, and robust validation patterns. The final version addresses previous audit findings and implements graceful failure handling for token transfers.

---

## Severity Classification

| Severity | Description |
|----------|-------------|
| Critical | Direct fund loss or permanent lock affecting multiple users |
| High | Fund loss or lock under specific conditions |
| Medium | Griefing attacks, economic manipulation, or denial of service |
| Low | Minor issues, best practice violations |
| Informational | Observations and recommendations |

---

## Summary of Findings

| ID | Severity | Title | Status |
|----|----------|-------|--------|
| ✅ | Resolved | Proceeds Lock on Token Failure | Fixed via try/catch |
| ✅ | Resolved | Selective Token Collection | Implemented |
| L-01 | Low | Dust Orders via Strategic Partial Fills | Mitigated (allOrNothing) |
| L-02 | Low | No Minimum Order Size | Accepted (listing fee mitigates) |
| L-03 | Low | Cooldown Upper Bound of 24 Hours | Accepted (admin trust) |
| I-01 | Informational | Non-Transferable Receipt Tokens | Design Feature |
| I-02 | Informational | No Price Oracle Dependency | Security Feature |
| I-03 | Informational | Immutable Fee Caps | Security Feature |

---

## Security Features Analysis

### 1. Reentrancy Protection
**Location:** Contract-wide via `ReentrancyGuard`
**Status:** ✅ Properly Implemented

All state-changing external functions use the `nonReentrant` modifier:
- `placeOrder()`
- `cancelOrder()`
- `cancelAllExpiredOrders()`
- `fillOrder()`
- `collectProceeds()`
- `collectProceedsByToken()`
- `updateOrderExpiration()`

```solidity
function fillOrder(...) external payable nonReentrant validActiveOrder(_orderID) whenNotPaused {
```

### 2. Transfer Verification (Fee-on-Transfer Protection)
**Location:** Lines 452-458, 586-592
**Status:** ✅ Properly Implemented

The contract verifies actual received amounts match expected amounts:

```solidity
uint256 sellTokenAmountBefore = IERC20(_sellToken).balanceOf(address(this));
IERC20(_sellToken).safeTransferFrom(msg.sender, address(this), _sellAmount);
uint256 sellTokenAmountAfter = IERC20(_sellToken).balanceOf(address(this));
require(
    sellTokenAmountAfter - sellTokenAmountBefore == _sellAmount,
    "AgoraX: Sell token transfer failed. Verify token has no taxes/fees on transfer"
);
```

This prevents:
- Fee-on-transfer token exploits
- Deflationary token accounting errors
- Rebasing token manipulation

### 3. Cooldown Mechanism (MEV/Flash Loan Protection)
**Location:** Lines 203, 309-313, 989-992
**Status:** ✅ Properly Implemented

```solidity
uint64 public cooldownPeriod; // MEV and flash-loan order protection in seconds

require(
    orderDetailsWithID.lastUpdateTime + cooldownPeriod < uint64(block.timestamp),
    "AgoraX: Order still in cooldown period"
);
```

Configurable between 20 seconds and 24 hours (86400 seconds):
```solidity
require(_newCooldownPeriod >= 20 && _newCooldownPeriod <= 86400, "AgoraX: New cooldown period out of bounds");
```

### 4. Graceful Failure Handling for Proceeds Collection
**Location:** Lines 1033-1109, 614-669
**Status:** ✅ Properly Implemented (Addresses H-01 from previous audit)

The contract now uses try/catch-style handling to prevent one failed token transfer from blocking all proceeds:

```solidity
if (buyToken == NATIVE_ADDRESS) {
    (bool canReceive, ) = _recipient.call{value: 0}("");
    if (canReceive) {
        (success, ) = payable(_recipient).call{value: boughtAmount}("");
    }
} else {
    (success, returndata) = address(buyToken).call(
        abi.encodeWithSelector(IERC20.transfer.selector, _recipient, boughtAmount)
    );
    if (success) {
        if (returndata.length == 0) {
            // Assumes success for old tokens that have no return data
        } else if (returndata.length == 32) {
            if (!abi.decode(returndata, (bool))) {
                success = false;
            }
        } else {
            success = false; // Rejects malformed return data
        }
    }
}

if (success) {
    // Clear state and burn tokens
} else {
    emit ProceedsCollectionFailed(msg.sender, _orderID, buyToken);
    // Proceeds remain in contract for later collection attempt
}
```

Additionally, `collectProceedsByToken()` allows selective collection of individual tokens.

### 5. Immutable Fee Caps
**Location:** Lines 208-209, 265-269
**Status:** ✅ Security Feature

```solidity
uint256 public immutable PROTOCOL_FEES_LIMIT;
uint256 public immutable LISTING_FEES_LIMIT;

// Constructor validation
require(_listingFee <= _listingFeesLimit, "AgoraX: Listing fee exceeds limit");
require(_protocolFee <= _protocolFeesLimit, "AgoraX: Protocol fee exceeds limit");
require(_protocolFeesLimit <= PERCENTAGE_DIVISOR, "AgoraX: Protocol fee limit exceeds 100%");
```

Fee updates are bounded:
```solidity
function updateListingFee(uint256 _newFee) external onlyOwner {
    require(_newFee <= LISTING_FEES_LIMIT, "AgoraX: Listing fee exceeds limit");
    // ...
}
```

### 6. Grandfathered Fee Protection
**Location:** Lines 1021-1025
**Status:** ✅ User Protection Feature

Orders lock in the fee rate at creation time, using the lower of creation or current fee:

```solidity
uint256 effectiveFee = (orderDetailsWithID.creationProtocolFee < protocolFee)
    ? orderDetailsWithID.creationProtocolFee
    : protocolFee;
```

### 7. Non-Transferable Receipt Tokens
**Location:** Lines 1174-1193
**Status:** ✅ Security Feature (Informational)

AGX tokens are non-transferable by design:

```solidity
function transfer(address, uint256) public pure override returns (bool) {
    revert("AGX: Transfer disabled");
}

function approve(address, uint256) public pure override returns (bool) {
    revert("AGX: Approve disabled");
}

function transferFrom(address, address, uint256) public pure override returns (bool) {
    revert("AGX: TransferFrom disabled");
}
```

This prevents:
- Accidental loss of order ownership
- Social engineering attacks
- Complex secondary market exploits

### 8. Direct PLS Transfer Rejection
**Location:** Lines 1201-1204
**Status:** ✅ User Protection

```solidity
receive() external payable {
    revert("AgoraX: Direct PLS transfers not allowed");
}
```

Prevents accidental PLS loss from direct transfers to the contract.

### 9. No Price Oracle Dependency
**Status:** ✅ Security Feature

The contract operates without external price oracles. Order prices are set directly by makers and accepted by fillers, eliminating:
- Oracle manipulation attacks
- Stale price vulnerabilities
- Flash loan oracle attacks
- Single points of failure

---

## Mathematical/Accounting Analysis

### 1. Fill Calculation Precision
**Location:** Lines 1004-1006
**Status:** ✅ Correctly Implemented

```solidity
_soldAmount = Math.mulDiv(_buyAmount, originalSellAmount, originalBuyAmount);
require(_soldAmount > 0, "AgoraX: Fill size too small");
```

Uses OpenZeppelin's `Math.mulDiv` for safe multiplication with division, preventing overflow and ensuring precision.

### 2. Fee Calculation
**Location:** Lines 1021-1026
**Status:** ✅ Correctly Implemented

```solidity
uint256 effectiveFee = (orderDetailsWithID.creationProtocolFee < protocolFee)
    ? orderDetailsWithID.creationProtocolFee
    : protocolFee;
_fees = (_buyAmount * effectiveFee) / PERCENTAGE_DIVISOR;
uint256 _newBoughtAmount = _buyAmount > _fees ? _buyAmount - _fees : 0;
```

- Uses basis points (10000 = 100%) for precision
- Protects against underflow with conditional check
- Fee is calculated on gross buy amount, not net

### 3. Remaining Amount Tracking
**Location:** Lines 1012, 1016-1018
**Status:** ✅ Correctly Implemented

```solidity
orderDetailsWithID.remainingSellAmount -= _soldAmount;

if (orderDetailsWithID.remainingSellAmount == 0) {
    orderDetailsWithID.status = OrderStatus.Completed;
}
```

State transition to `Completed` only occurs when remaining is exactly zero.

### 4. Redeemed Amount Accounting
**Location:** Lines 1039-1040, 1086, 1097
**Status:** ✅ Correctly Implemented

```solidity
uint256 currentFilled = originalSellAmount - orderDetailsWithID.remainingSellAmount;
uint256 redeemableSell = currentFilled - orderDetailsWithID.redeemedSellAmount;

// After successful transfer:
totalRedeemedThisCall += soldForThisToken;
orderDetailsWithID.redeemedSellAmount += totalRedeemedThisCall;
```

Tracks:
- `remainingSellAmount`: How much sell token is still available
- `redeemedSellAmount`: How much has been collected as proceeds

### 5. Dual Mapping for Per-Token Accounting
**Location:** Lines 198-199, 1027-1028
**Status:** ✅ Correctly Implemented

```solidity
mapping(uint256 => mapping(uint256 => uint256)) private buyTransactionsByOrderID;
mapping(uint256 => mapping(uint256 => uint256)) private soldByBuyToken;

// On fill:
buyTransactionsByOrderID[_orderID][buyTokenIndex] += _newBoughtAmount;
soldByBuyToken[_orderID][buyTokenIndex] += _soldAmount;
```

Enables:
- Per-token proceeds tracking
- Selective token collection
- Accurate partial fill accounting

### 6. Token Burn on Collection
**Location:** Lines 495, 541, 658, 1096
**Status:** ✅ Correctly Implemented

AGX tokens are burned when:
- Order is cancelled (unfilled portion)
- Proceeds are collected (filled portion)

This maintains the invariant: `totalSupply == sum of all uncollected sell amounts`

---

## Detailed Findings

### L-01: Dust Orders via Strategic Partial Fills
**Severity:** Low
**Location:** Lines 1004-1010
**Status:** Mitigated

**Description:**
Due to integer rounding in fill calculations, an attacker could theoretically fill an order to leave a remainder smaller than the minimum fillable amount.

**Mitigation in Place:**
The `allOrNothing` flag completely prevents this attack:
```solidity
if (orderDetailsWithID.orderDetails.allOrNothing) {
    require(_soldAmount == orderDetailsWithID.remainingSellAmount, "AgoraX: Partial fills not allowed for AON orders");
}
```

**Recommendation:** Users creating orders with ratios that could result in dust should use `allOrNothing = true`.

---

### L-02: No Minimum Order Size
**Severity:** Low
**Location:** Line 410
**Status:** Accepted

**Description:**
There is no minimum order size, theoretically allowing order book pollution.

**Mitigation in Place:**
The listing fee (configurable, e.g., 100 PLS) acts as an economic deterrent:
```solidity
require(msg.value >= listingFee, "AgoraX: Insufficient listing fee");
```

At 100 PLS per order, spam attacks become economically unfeasible.

---

### L-03: Cooldown Upper Bound
**Severity:** Low
**Location:** Line 310
**Status:** Accepted (Admin Trust)

**Description:**
The maximum cooldown period of 86400 seconds (24 hours) could theoretically be used maliciously by a compromised admin.

```solidity
require(_newCooldownPeriod >= 20 && _newCooldownPeriod <= 86400, "AgoraX: New cooldown period out of bounds");
```

**Mitigation:**
- Two-step ownership transfer (`Ownable2Step`) prevents accidental admin changes
- Expected normal operation uses short cooldowns (e.g., 60 seconds)

---

### I-01: Non-Transferable Receipt Tokens
**Severity:** Informational
**Status:** Design Feature

The AGX receipt token cannot be transferred, traded, or approved. This is an intentional security feature that:
- Prevents accidental loss of order access
- Eliminates secondary market attack vectors
- Simplifies the security model

---

### I-02: No Price Oracle Dependency
**Severity:** Informational
**Status:** Security Feature

The contract has zero reliance on external price oracles. This eliminates entire categories of attacks:
- Oracle manipulation
- Flash loan + oracle attacks
- Stale price exploitation
- Oracle downtime issues

Order pricing is purely peer-to-peer: makers set prices, fillers accept or reject.

---

### I-03: Immutable Fee Caps
**Severity:** Informational
**Status:** Security Feature

Fee limits are set at deployment and cannot be changed:
```solidity
uint256 public immutable PROTOCOL_FEES_LIMIT;
uint256 public immutable LISTING_FEES_LIMIT;
```

This provides users with permanent guarantees about maximum possible fees.

---

## Access Control Analysis

### Owner Capabilities
| Function | Risk Level | Notes |
|----------|------------|-------|
| `addTokenAddress()` | Medium | Can whitelist tokens |
| `setTokenStatus()` | Medium | Can enable/disable tokens |
| `pause()` / `unpause()` | Medium | Emergency stop |
| `updateFeeAddress()` | Low | Fee collection address |
| `updateCooldownPeriod()` | Low | Bounded 20-86400s |
| `updateListingFee()` | Low | Bounded by immutable cap |
| `updateProtocolFee()` | Low | Bounded by immutable cap |
| `cleanInactiveUsers()` | Low | Maintenance only |

### Owner Cannot
- Withdraw user funds
- Modify existing orders
- Change fee caps (immutable)
- Transfer receipt tokens
- Access funds during pause

### Two-Step Ownership
The contract uses `Ownable2Step` requiring:
1. Current owner proposes new owner
2. New owner must accept

This prevents:
- Accidental ownership transfer to wrong address
- Single-transaction ownership hijacking

---

## Gas Optimization Notes

1. **Unchecked Increments:** Loop counters use `unchecked { ++i; }` where safe
2. **Storage vs Memory:** Appropriate use of `storage` for modifications, `memory` for reads
3. **Short-Circuit Evaluation:** Conditions ordered for early exit
4. **Batch Limits:** 50-item limits prevent unbounded gas consumption

---

## Conclusion

The AgoraX-final.sol contract demonstrates strong security practices:

✅ **Reentrancy Protection:** All external state-changing functions protected
✅ **Transfer Verification:** Fee-on-transfer tokens properly rejected
✅ **Cooldown Mechanism:** MEV and flash loan protection implemented
✅ **Graceful Failure Handling:** Token failures don't lock other proceeds
✅ **Immutable Fee Caps:** Users have permanent fee guarantees
✅ **No Oracle Dependency:** Eliminates oracle attack vectors
✅ **Two-Step Ownership:** Protected admin transfer process
✅ **Non-Transferable Tokens:** Receipt tokens secured by design

The contract is suitable for mainnet deployment. Users should be aware of the dust order edge case (use `allOrNothing` for protection) and understand that the listing fee serves as anti-spam protection.

---

## Appendix: Key Constants

| Constant | Value | Purpose |
|----------|-------|---------|
| `PERCENTAGE_DIVISOR` | 10000 | Basis points denominator |
| `NATIVE_ADDRESS` | 0xEeee...eEEE | PLS sentinel address |
| Batch limit | 50 | Max items per batch operation |
| Cooldown bounds | 20-86400 | Seconds (20s to 24h) |

---

*This audit was performed by automated analysis. A professional third-party audit is recommended before handling significant value.*
