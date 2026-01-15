# AgoraX Developer Reference

## Contract Information

**Mainnet Address:** `0xc8a47F14b1833310E2aC72e4C397b5b14a9FEf8B`
**Network:** PulseChain Mainnet (Chain ID: 369)
**Testnet Address:** `0x321b52b7f55ea307e9ca87891d52cc92f37905cf`
**Native Token:** `0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE` (PLS)

```bash
# Environment Variable
NEXT_PUBLIC_AGORAX_SMART_CONTRACT=0xc8a47F14b1833310E2aC72e4C397b5b14a9FEf8B
```

---

## Quick Reference

### User Write Functions

| Function | Purpose | Payable |
|----------|---------|---------|
| `placeOrder` | Create limit order (up to 50 buy tokens) | Yes |
| `fillOrder` | Fill order by providing buy tokens | Yes (if PLS) |
| `cancelOrder` | Cancel order and collect proceeds | No |
| `cancelAllExpiredOrders` | Batch cancel (max 50) | No |
| `collectProceeds` | Claim accumulated buy tokens | No |
| `updateOrderExpiration` | Extend order lifetime | No |

### Key View Functions

| Function | Purpose |
|----------|---------|
| `getOrderDetails(orderID)` | Get full order info |
| `viewUserOpenOrders(user, cursor, size)` | Active orders |
| `viewUserExpiredOrders(user, cursor, size)` | Expired orders |
| `viewCollectableProceeds(orderID)` | Check claimable amounts |
| `viewActiveWhitelisted(cursor, size)` | Get tradable tokens |
| `getTotalOrderCount()` | Platform statistics |
| `listingFee()` | Current listing fee |
| `protocolFee()` | Current protocol fee (basis points) |

### Constants

```
Max Buy Tokens Per Order: 50
Max Batch Cancel: 50 orders
Cooldown Period: 20-86400 seconds
Protocol Fee: basis points (100 = 1%)
```

---

## React Hooks

### Contract Interactions

```typescript
import { useContractWhitelist } from '@/hooks/contracts/useContractWhitelist';

const { placeOrder, fillOrder, cancelOrder, collectProceeds } = useContractWhitelist();
```

### Whitelist Data

```typescript
import { useContractWhitelistRead } from '@/hooks/contracts/useContractWhitelistRead';

const { activeTokens, isLoading } = useContractWhitelistRead();
```

### User Orders

```typescript
import { useOpenPositions } from '@/hooks/contracts/useOpenPositions';

const { openOrders, expiredOrders, isLoading } = useOpenPositions();
```

### Get Contract Address

```typescript
import { getContractAddress } from '@/config/testing';

const contractAddress = getContractAddress(chainId);
```

---

## Whitelist System

The whitelist is **dynamically loaded from the contract**. No manual frontend updates needed.

### How It Works

1. Contract owner adds tokens via `addTokenAddress(address)`
2. Contract owner can activate/deactivate via `setTokenStatus(address, bool)`
3. Frontend queries `viewActiveWhitelisted(cursor, size)`
4. Only active tokens appear in the UI

### Check Current Whitelist

```bash
npm run check-whitelist
```

### Using in Components

```typescript
const { activeTokens } = useContractWhitelistRead();

const whitelistedAddresses = new Set(
  activeTokens.map(token => token.tokenAddress.toLowerCase())
);

const availableTokens = TOKEN_CONSTANTS.filter(t => {
  if (!t.a || !t.dexs) return false;
  return whitelistedAddresses.has(t.a.toLowerCase());
});
```

---

## Listing Fee

The contract charges a listing fee when placing orders.

### Reading the Fee

```typescript
// Correct function name (auto-generated getter for public variable)
functionName: 'listingFee'  // NOT 'getListingFee'
```

### Payment Logic

- **Selling ERC20:** `msg.value = listingFee`
- **Selling PLS:** `msg.value = sellAmount + listingFee`

---

## Block Explorer URLs

```typescript
import { getBlockExplorerTxUrl } from '@/utils/blockExplorer';

// Mainnet (369) -> https://otter.pulsechain.com/tx/{hash}
// Testnet (943) -> https://scan.v4.testnet.pulsechain.com/tx/{hash}
const url = getBlockExplorerTxUrl(chainId, txHash);
```

---

## Logo System

Logos use a manifest system to avoid 404 errors.

### How It Works

1. `scripts/generate-logo-manifest.js` scans `public/coin-logos/`
2. Creates `constants/logo-manifest.json` mapping ticker -> format
3. Components look up format before loading

### Regenerate Manifest

```bash
npm run generate-logos
# Or automatically on build
```

---

## Price Data Handling

Tokens without DEX pairs return `price: -1` (no price available).

### Price Value Meanings

- `price > 0` = Valid market price
- `price === 0` = Failed to fetch (error)
- `price === -1` = No price source exists

---

## Security Implementations

### Rate Limiting

All API routes are rate limited via `/utils/rateLimit.ts`:
- Validation endpoints: 20 requests/minute
- Data endpoints: 60 requests/minute

### Transaction Timeouts

All blockchain operations use timeouts via `/utils/transactionTimeout.ts`:
- Approvals: 60 seconds
- Transactions: 60 seconds
- Approval verification: 30 seconds

### Input Validation

Amount validation via `/utils/amountValidation.ts`:
- Overflow protection (max 1e30)
- Decimal precision validation
- Dust attack prevention (min 1e-18)

### Content Security Policy

Configured in `next.config.js` headers.

---

## Gas Estimates

| Function | Approximate Gas |
|----------|-----------------|
| placeOrder | 150k-300k |
| fillOrder | 120k-200k |
| cancelOrder | 80k-150k |
| collectProceeds | 80k-150k |
| updateExpiration | 50k-70k |

---

## Data Structures

### OrderStatus

```
0 = Active
1 = Cancelled
2 = Completed
```

### OrderDetails

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

---

## Events

```solidity
event OrderPlaced(address indexed user, uint256 indexed orderID, ...);
event OrderCancelled(address indexed user, uint256 indexed orderID);
event OrderFilled(address indexed buyer, uint256 indexed orderID, ...);
event OrderProceedsCollected(address indexed user, uint256 indexed orderID);
event OrderExpirationUpdated(uint256 indexed orderID, uint64 newExpiration);
```

---

## Important Notes

1. **Transfer Fee Tokens:** Do NOT use tokens with transfer fees (will fail)
2. **Rebase Tokens:** May cause unexpected behavior
3. **Cooldown Period:** Required wait time after placing/extending orders
4. **AON Orders:** All-or-nothing orders must be filled completely
5. **Recipient Validation:** Must be able to receive PLS if collecting PLS proceeds

---

## Links

- **Block Explorer:** https://otter.pulsechain.com/address/0xc8a47F14b1833310E2aC72e4C397b5b14a9FEf8B
- **Contract Source:** `contracts/core/AgoraX_mainnet.sol`

---

_Last Updated: January 2026_
