# AgoraX Quick Reference Card

## Contract Address

```
Mainnet: 0xc8a47F14b1833310E2aC72e4C397b5b14a9FEf8B
Network: PulseChain (Chain ID: 369)
```

## Environment Variable

```bash
NEXT_PUBLIC_AGORAX_SMART_CONTRACT=0xc8a47F14b1833310E2aC72e4C397b5b14a9FEf8B
```

## Native Token Address

```
PLS: 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE
```

## Key Contract Functions

### User Functions

1. **placeOrder** - Create limit order (up to 50 buy tokens)
2. **fillOrder** - Fill order by providing buy tokens
3. **cancelOrder** - Cancel order and collect proceeds
4. **cancelAllExpiredOrders** - Batch cancel (max 50)
5. **collectProceeds** - Claim accumulated buy tokens
6. **updateOrderExpiration** - Extend order lifetime

### View Functions (Most Used)

- `getOrderDetails(orderID)` - Get full order info
- `viewUserOpenOrders(user, cursor, size)` - Active orders
- `viewCollectableProceeds(orderID)` - Check claimable amounts
- `viewActiveWhitelisted(cursor, size)` - Get tradable tokens
- `getTotalOrderCount()` - Platform statistics

## React Hooks

```typescript
// Contract interactions
import { useContractWhitelist } from "@/hooks/contracts/useContractWhitelist";
const { placeOrder, fillOrder, cancelOrder, collectProceeds } =
  useContractWhitelist();

// Whitelist data
import { useContractWhitelistRead } from "@/hooks/contracts/useContractWhitelistRead";
const { activeTokens, isLoading } = useContractWhitelistRead();

// User orders
import { useOpenPositions } from "@/hooks/contracts/useOpenPositions";
const { openOrders, expiredOrders, isLoading } = useOpenPositions();
```

## Documentation Files

| File                                | Purpose                         |
| ----------------------------------- | ------------------------------- |
| `AGORAX_MAINNET_REFERENCE.md`       | Overview and quick reference    |
| `AGORAX_FUNCTIONS_GUIDE.txt`        | Complete function documentation |
| `FUNCTION_AUDIT_REPORT.txt`         | UI implementation status        |
| `WHITELIST_INFO.md`                 | Whitelist system guide          |
| `CONTRACT_UPDATE_SUMMARY.md`        | Recent changes log              |
| `contracts/core/AgoraX_mainnet.sol` | Full contract source            |

## Common Operations

### Check Whitelist

```bash
npm run check-whitelist
```

### Get Contract Address in Code

```typescript
import { getContractAddress } from "@/config/testing";
const contractAddress = getContractAddress(chainId);
```

### Verify Token is Whitelisted

```typescript
const { activeTokens } = useContractWhitelistRead();
const isWhitelisted = activeTokens.some(
  (t) => t.tokenAddress.toLowerCase() === tokenAddress.toLowerCase()
);
```

## Important Constants

```typescript
PERCENTAGE_DIVISOR = 10000
Protocol Fee: basis points (100 = 1%, 500 = 5%)
Cooldown: 20-86400 seconds
Max Buy Tokens Per Order: 50 (limit per single order)
Max Batch Cancel: 50 orders
Total Whitelisted Tokens: 103 (Dec 2025, dynamically loaded)
```

## Gas Estimates

| Function         | Approximate Gas |
| ---------------- | --------------- |
| placeOrder       | 150k-300k       |
| fillOrder        | 120k-200k       |
| cancelOrder      | 80k-150k        |
| collectProceeds  | 80k-150k        |
| updateExpiration | 50k-70k         |

## Block Explorer

**PulseChain Scan:** https://scan.pulsechain.com/address/0xc8a47F14b1833310E2aC72e4C397b5b14a9FEf8B

---

_For detailed documentation, see AGORAX_FUNCTIONS_GUIDE.txt_
