# AgoraX Mainnet Contract Reference

## Contract Information

**Contract Address:** `0xc8a47F14b1833310E2aC72e4C397b5b14a9FEf8B`  
**Network:** PulseChain Mainnet (Chain ID: 369)  
**Token Symbol:** AGX (Non-transferable receipt token)  
**Native Token:** 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE (PLS)

## Overview

AgoraX is a decentralized limit order platform that allows users to:

- Create limit orders to sell tokens in exchange for other tokens
- Fill orders at fixed ratios
- Support for multiple buy tokens per order
- Dynamic token whitelist system
- All-or-nothing (AON) or partial fills
- Cooldown periods for MEV protection

## Key Features

### Order Management

- **Place Orders:** Deposit sell tokens and specify desired buy tokens with amounts
- **Fill Orders:** Anyone can fill orders by providing buy tokens
- **Cancel Orders:** Cancel active orders and collect proceeds
- **Collect Proceeds:** Claim accumulated buy tokens from filled orders
- **Update Expiration:** Extend order expiration times

### Security Features

- **Cooldown Period:** Prevents MEV and flash loan attacks (20-86400 seconds)
- **Pausable:** Owner can pause trading in emergencies
- **Non-transferable Receipt Tokens (AGX):** Prevent secondary market manipulation
- **Reentrancy Guards:** Protection on all state-changing functions

### Fee Structure

- **Listing Fee:** Fixed PLS fee per order (immutable limit enforced)
- **Protocol Fee:** Percentage of proceeds in basis points (100 = 1%)
- **Fee Protection:** Uses minimum of creation time fee or current fee

## Complete Function Reference

### USER WRITE FUNCTIONS (State-Changing)

#### 1. placeOrder

Creates a new limit order.

**Parameters:**

- `address _sellToken` - Token to sell (use NATIVE_ADDRESS for PLS)
- `uint256 _sellAmount` - Amount to sell
- `uint256[] _buyTokensIndex` - Array of whitelist indices (1-50 tokens)
- `uint256[] _buyAmounts` - Corresponding buy amounts
- `uint64 _expirationTime` - Unix timestamp
- `bool _allOrNothing` - True = no partial fills

**Payable:** YES

- Send `listingFee` in PLS
- If selling PLS: Also send `sellAmount`
- If selling ERC20: Only send `listingFee`

**Requirements:**

- Contract not paused
- At least 1 buy token
- Max 50 buy tokens
- No duplicate buy tokens
- All buy tokens must be active in whitelist
- Expiration must be in future
- Sell tokens with transfer fees NOT supported
- Rebase tokens may cause issues

**Emits:** `OrderPlaced`

#### 2. cancelOrder

Cancels an order and collects any proceeds.

**Parameters:**

- `uint256 _orderID` - Order to cancel
- `address _recipient` - Where to send proceeds

**Requirements:**

- Caller must be order owner
- Order not already cancelled
- Must have remaining sell amount

**Notes:**

- Automatically collects proceeds first
- Refunds go to order owner (not recipient)
- Burns AGX receipt tokens

**Emits:** `OrderCancelled`, `OrderProceedsCollected` (if proceeds exist)

#### 3. cancelAllExpiredOrders

Batch cancels up to 50 expired orders.

**Parameters:**

- `address _recipient` - Where to send proceeds

**Returns:**

- `uint256[] cancelledOrderIDs` - Array of cancelled order IDs

**Requirements:**

- Max 50 expired orders to cancel
- Only cancels active + expired orders

**Notes:**

- Automatically collects proceeds from each
- Very gas-efficient for cleanup

**Emits:** `OrderCancelled` (for each order), `OrderProceedsCollected` (if proceeds)

#### 4. fillOrder

Fills an order by providing buy tokens.

**Parameters:**

- `uint256 _orderID` - Order to fill
- `uint256 _buyTokenIndexInOrder` - Index in order's buyTokensIndex array
- `uint256 _buyAmount` - Amount of buy tokens to provide

**Payable:** YES (if buy token is PLS)

**Requirements:**

- Contract not paused
- Order is active and not expired
- Order has remaining sell amount
- Cooldown period has passed
- Buy amount ≤ original buy amount for that token
- AON orders must be filled completely

**Notes:**

- Protocol fee deducted from buy amount
- Seller receives: (buyAmount - fees) \* (sellAmount / originalBuyAmount)
- Partial fills allowed unless AON

**Emits:** `OrderFilled`

#### 5. collectProceeds

Collects accumulated buy tokens from filled orders.

**Parameters:**

- `uint256 _orderID` - Order ID
- `address _recipient` - Where to send proceeds (must accept PLS if applicable)

**Requirements:**

- Caller must be order owner
- Must have collectable proceeds

**Notes:**

- Burns AGX tokens proportional to redeemed amount
- Sends all accumulated buy tokens

**Emits:** `OrderProceedsCollected`

#### 6. updateOrderExpiration

Updates the expiration time of an order.

**Parameters:**

- `uint256 _orderID` - Order ID
- `uint64 _newExpiration` - New expiration timestamp

**Requirements:**

- Caller must be order owner
- Order must be active
- New expiration must be in future

**Notes:**

- Only resets cooldown if reviving expired order
- Does NOT reset cooldown for active orders

**Emits:** `OrderExpirationUpdated`

---

### OWNER WRITE FUNCTIONS (Admin Only)

#### 1. pause / unpause

Pauses or unpauses the contract.

**Requirements:**

- Only owner
- Cannot pause if already paused (and vice versa)

**Notes:**

- When paused: placeOrder and fillOrder are disabled
- Cancel, collect, and view functions still work

**Emits:** `Paused`

#### 2. updateFeeAddress

Updates the fee collection address.

**Parameters:**

- `address _newFeeAddress` - New fee address

**Requirements:**

- Only owner
- Address cannot be zero or contract
- Must be different from current

**Emits:** `FeeAddressUpdated`

#### 3. updateCooldownPeriod

Updates the cooldown period.

**Parameters:**

- `uint64 _newCooldownPeriod` - New period in seconds (20-86400)

**Requirements:**

- Only owner
- Must be between 20 seconds and 1 day

**Emits:** `CooldownPeriodUpdated`

#### 4. updateListingFee

Updates the listing fee.

**Parameters:**

- `uint256 _newFee` - New fee in wei

**Requirements:**

- Only owner
- Must not exceed LISTING_FEES_LIMIT

**Emits:** `ListingFeeUpdated`

#### 5. updateProtocolFee

Updates the protocol fee.

**Parameters:**

- `uint256 _newFee` - New fee in basis points (100 = 1%)

**Requirements:**

- Only owner
- Must not exceed PROTOCOL_FEES_LIMIT

**Emits:** `ProtocolFeeUpdated`

#### 6. cleanInactiveUsers

Cleans up users with zero AGX balance from tracking.

**Parameters:**

- `uint256 cursor` - Starting index
- `uint256 size` - Max users to process

**Returns:**

- `uint256 nextCursor` - Next starting index

**Requirements:**

- Only owner

**Notes:**

- Improves `findFillableOrders` performance
- Safe to call multiple times for large cleanups

**Emits:** `UserListCleanup`

#### 7. addTokenAddress (Whitelist)

Adds a token to the whitelist.

**Parameters:**

- `address _address` - Token address to whitelist

**Requirements:**

- Only owner
- Address not zero
- Not already whitelisted

**Notes:**

- Token is active by default

**Emits:** `TokenWhitelisted`

#### 8. setTokenStatus (Whitelist)

Activates or deactivates a whitelisted token.

**Parameters:**

- `address _address` - Token address
- `bool _isActive` - New status

**Requirements:**

- Only owner
- Token must be whitelisted
- Status must be different from current

**Emits:** `TokenStatusChanged`

---

### VIEW FUNCTIONS (Read-Only, No Gas)

#### Order Queries

**getOrderDetails(uint256 \_orderID)**

- Returns complete order details including user info

**getTotalOrderCount()**

- Returns total number of orders created

**viewCollectableProceeds(uint256 \_orderID)**

- Returns arrays of claimable tokens and amounts

**findFillableOrders(address \_sellToken, uint256 \_minSellAmount, uint256 cursor, uint256 size)**

- Finds matching fillable orders (max 50)
- Returns sorted order IDs and next cursor

#### User Order Functions

**getUserOrderCount(address \_user)**

- Returns total number of orders for a user

**getUserExpiredOrdersCount(address \_user)**

- Returns count of expired active orders

**viewUserOpenOrders(address \_user, uint256 \_cursor, uint256 \_size)**

- Returns paginated array of open orders

**viewUserExpiredOrders(address \_user, uint256 \_cursor, uint256 \_size)**

- Returns paginated array of expired orders

**viewUserCompletedOrders(address \_user, uint256 \_cursor, uint256 \_size)**

- Returns paginated array of completed orders

**viewUserCancelledOrders(address \_user, uint256 \_cursor, uint256 \_size)**

- Returns paginated array of cancelled orders

#### System Info

**getCurrentTimestamp()**

- Returns current block timestamp

**trackedUserCounts()**

- Returns (totalUsers, inactiveUsers) for cleanup estimation

**paused()**

- Returns pause state

**feeAddress()**

- Returns fee collection address

**cooldownPeriod()**

- Returns cooldown period in seconds

**listingFee()**

- Returns current listing fee

**protocolFee()**

- Returns current protocol fee (basis points)

**LISTING_FEES_LIMIT()**

- Returns immutable listing fee limit

**PROTOCOL_FEES_LIMIT()**

- Returns immutable protocol fee limit (max 10000 = 100%)

**NATIVE_ADDRESS()**

- Returns 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE

#### Whitelist Functions

**isWhitelisted(address \_address)**

- Returns true if token is whitelisted AND active

**viewCountWhitelisted()**

- Returns total count of whitelisted tokens

**getTokenInfoAt(uint256 \_index)**

- Returns (address, isActive) for token at index

**getTokenWhitelistIndex(address \_address)**

- Returns 0-based array index for token

**viewWhitelisted(uint256 cursor, uint256 size)**

- Returns paginated TokenInfo array (active and inactive)

**viewActiveWhitelisted(uint256 cursor, uint256 size)**

- Returns paginated array of active token addresses

#### ERC20 Functions (All Disabled)

**transfer()** - Reverts with "AGX: Transfer disabled"  
**approve()** - Reverts with "AGX: Approve disabled"  
**transferFrom()** - Reverts with "AGX: TransferFrom disabled"  
**allowance()** - Reverts with "AGX: Allowance disabled"

**Working ERC20 Functions:**

- `name()` - Returns "AgoraX"
- `symbol()` - Returns "AGX"
- `decimals()` - Returns 18
- `totalSupply()` - Returns total AGX minted
- `balanceOf(address)` - Returns AGX balance

---

## Data Structures

### OrderStatus (enum)

```solidity
0 = Active
1 = Cancelled
2 = Completed
```

### OrderDetails (struct)

```solidity
struct OrderDetails {
    address sellToken;
    uint256 sellAmount;
    uint256[] buyTokensIndex;
    uint256[] buyAmounts;
    uint64 expirationTime;
    bool allOrNothing;
}
```

### OrderDetailsWithID (struct)

```solidity
struct OrderDetailsWithID {
    uint256 orderID;
    uint256 remainingSellAmount;
    uint256 redeemedSellAmount;
    uint64 lastUpdateTime;
    OrderStatus status;
    uint256 creationProtocolFee;
    OrderDetails orderDetails;
}
```

### CompleteOrderDetails (struct)

```solidity
struct CompleteOrderDetails {
    UserOrderDetails userDetails;
    OrderDetailsWithID orderDetailsWithID;
}
```

### TokenInfo (struct)

```solidity
struct TokenInfo {
    address tokenAddress;
    bool isActive;
}
```

---

## Events

```solidity
event OrderPlaced(address indexed user, uint256 indexed orderID, address indexed sellToken, uint256 sellAmount, uint256[] buyTokensIndex, uint256[] buyAmounts, uint64 expirationTime, bool allOrNothing);
event OrderCancelled(address indexed user, uint256 indexed orderID);
event OrderFilled(address indexed buyer, uint256 indexed orderID, uint256 indexed buyTokenIndex, uint256 buyAmount);
event OrderProceedsCollected(address indexed user, uint256 indexed orderID);
event OrderExpirationUpdated(uint256 indexed orderID, uint64 newExpiration);
event Paused(address indexed owner, bool paused);
event FeeAddressUpdated(address indexed oldAddress, address indexed newAddress);
event CooldownPeriodUpdated(uint64 oldPeriod, uint64 newPeriod);
event ListingFeeUpdated(uint256 oldFee, uint256 newFee);
event ProtocolFeeUpdated(uint256 oldFee, uint256 newFee);
event TokenWhitelisted(address indexed token);
event TokenStatusChanged(address indexed token, bool isActive);
event UserListCleanup(uint256 cursor, uint256 size, uint256 removedCount, uint256 remainingUsers);
```

---

## Important Notes

### Security Considerations

1. **Transfer Fee Tokens:** Do NOT use tokens with transfer fees (will fail)
2. **Rebase Tokens:** May cause unexpected behavior
3. **Cooldown Period:** Required wait time after placing/extending orders
4. **MEV Protection:** Cooldown prevents same-block manipulation
5. **Recipient Validation:** Must be able to receive PLS if collecting PLS proceeds

### Gas Optimization

1. **Batch Cancellations:** Use `cancelAllExpiredOrders` for multiple orders
2. **User Cleanup:** Owner can call `cleanInactiveUsers` to improve search performance
3. **Pagination:** All view functions support cursor-based pagination

### Best Practices

1. Always check `viewCollectableProceeds` before calling `collectProceeds`
2. Use `findFillableOrders` to discover orders programmatically
3. Verify token whitelisting before attempting to place orders
4. Consider AON vs partial fills based on use case
5. Set reasonable expiration times (cooldown applies when extending)

---

## Environment Configuration

In your `.env.local` file:

```bash
NEXT_PUBLIC_AGORAX_SMART_CONTRACT=0xc8a47F14b1833310E2aC72e4C397b5b14a9FEf8B
```

This address is used throughout the application via:

```typescript
import { getContractAddress } from "@/config/testing";
const contractAddress = getContractAddress(chainId);
```

---

## Links

**Contract File:** `contracts/core/AgoraX_mainnet.sol`  
**Whitelist Info:** `WHITELIST_INFO.md`  
**Transaction Timeout Guide:** `TRANSACTION_TIMEOUT_IMPLEMENTATION.md`

---

_Last Updated: December 2025_  
_Contract Version: AgoraX v1.0 (Mainnet)_
