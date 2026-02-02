# FAQ: Token Compatibility for Orders

## What tokens can I use to create orders?

### Sell Tokens (What You're Offering)

**Any ERC20 token can be used as a sell token**, including:
- Whitelisted tokens (PLS, HEX, PLSX, INC, etc.)
- Non-whitelisted tokens
- Native tokens (wrapped as needed)

**Important Compatibility Notes:**
- **Rebasing tokens** (tokens that automatically adjust balances) are **not recommended**. The contract enforces exact balance increases when placing orders and will revert if there's a discrepancy.
- **Fee-on-transfer tokens** (tokens that take a fee on every transfer) are **not supported**. The contract checks that the exact amount transferred matches what was expected - any fee deduction will cause the transaction to fail.
- **Standard ERC20 tokens** work perfectly fine, even if they're not on the platform's whitelist.

### Buy Tokens (What You Want to Receive)

**Buy tokens must be whitelisted and active on the platform.**

This restriction exists to:
1. Protect users from receiving worthless or scam tokens
2. Ensure liquidity and tradability of received tokens
3. Maintain price oracle support for accurate valuations

The whitelist is managed by platform administrators and includes major tokens in the ecosystem.

---

## Why the asymmetry?

The different rules for sell vs buy tokens serve different purposes:

| Token Type | Rule | Reason |
|------------|------|--------|
| **Sell** | Any token | Allows users to exit positions in any token they hold |
| **Buy** | Whitelist only | Protects order fillers from receiving problematic tokens |

This design allows maximum flexibility for order creators while protecting order fillers.

---

## What happens if I try to use an incompatible token?

| Scenario | Result |
|----------|--------|
| Sell a fee-on-transfer token | Transaction reverts during `placeOrder` |
| Sell a rebasing token | May revert or cause balance discrepancies |
| Buy a non-whitelisted token | Transaction reverts with whitelist check failure |
| Buy an inactive whitelisted token | Transaction reverts with token inactive error |

---

## Can I request a token to be whitelisted?

Contact the platform administrators to request whitelist additions for legitimate tokens with sufficient liquidity and community demand.

---

## Technical Details

The contract enforces these rules in `_checkTokenAndAmount`:
- Verifies buy tokens are in the whitelist
- Checks that whitelisted tokens are marked as active
- For sell tokens, verifies exact balance increase after transfer (catches fee-on-transfer issues)

```solidity
// Simplified logic flow
function placeOrder(...) {
    // Sell token: any address accepted, but must transfer exact amount
    uint256 balanceBefore = sellToken.balanceOf(address(this));
    sellToken.transferFrom(msg.sender, address(this), amount);
    uint256 balanceAfter = sellToken.balanceOf(address(this));
    require(balanceAfter - balanceBefore == amount, "Transfer amount mismatch");

    // Buy tokens: must pass whitelist check
    for (each buyToken) {
        _checkTokenAndAmount(buyToken, buyAmount); // Reverts if not whitelisted/active
    }
}
```
