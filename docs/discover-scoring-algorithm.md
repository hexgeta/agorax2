# Discover Page - Order Scoring Algorithm

## Overview

The Discover page uses a recommendation algorithm to score and rank OTC orders based on the user's ability to fill them and their price attractiveness. Orders are presented in a Tinder-style swipe interface, with the highest-scoring orders shown first.

## Scoring Breakdown (0-100 points)

The total score is a composite of three weighted categories:

| Category | Max Points | Weight |
|----------|-----------|--------|
| Fillability | 40 | 40% |
| Price Attractiveness | 40 | 40% |
| Relevance | 20 | 20% |

---

## 1. Fillability Score (0-40 points)

**Purpose:** Can the user actually fill this order with tokens they hold?

### Calculation

For each buy token the order accepts:
```
fillPercentage = userBalance / requiredBuyAmount
```

The score uses the **maximum fill percentage** across all accepted buy tokens:
```
fillabilityScore = min(maxFillPercentage, 1.0) × 40
```

### Examples

| User Balance | Required Amount | Fill % | Score |
|-------------|-----------------|--------|-------|
| 1000 PLSX | 1000 PLSX | 100% | 40 pts |
| 500 PLSX | 1000 PLSX | 50% | 20 pts |
| 100 PLSX | 1000 PLSX | 10% | 4 pts |
| 0 PLSX | 1000 PLSX | 0% | 0 pts |

### Multi-Token Orders

If an order accepts multiple buy tokens (e.g., PLSX or HEX), the algorithm checks the user's balance for each and uses the highest fill percentage.

---

## 2. Price Attractiveness Score (0-40 points)

**Purpose:** Is this a good deal compared to current market prices?

### Calculation

1. Calculate the USD value of what's being sold:
   ```
   sellValueUsd = sellAmount × sellTokenPrice
   ```

2. Calculate what the seller is implicitly pricing the buy token at:
   ```
   limitBuyTokenPrice = sellValueUsd / buyAmount
   ```

3. Compare to market price:
   ```
   priceDiscount = ((limitBuyTokenPrice - marketBuyTokenPrice) / marketBuyTokenPrice) × 100
   ```

### Interpretation

- **Positive discount:** Seller is pricing buy token above market → Good deal for buyer
- **Negative discount:** Seller is pricing buy token below market → Bad deal for buyer

### Score Mapping

| Price Discount | Score | Meaning |
|---------------|-------|---------|
| ≥ +20% | 40 pts | Excellent deal |
| +10% | 30 pts | Good deal |
| 0% (market rate) | 20 pts | Fair deal |
| -10% | 10 pts | Below market |
| ≤ -20% | 0 pts | Poor deal |

The score scales linearly between these thresholds.

### Example

An order selling 1000 PLS ($5.00) for 100 HEX:
- Implied HEX price: $5.00 / 100 = $0.05 per HEX
- Market HEX price: $0.04
- Discount: (0.05 - 0.04) / 0.04 = +25%
- Score: 40 pts (excellent deal - seller values HEX 25% above market)

---

## 3. Relevance Score (0-20 points)

**Purpose:** Does the user likely want what's being sold?

### Components

| Condition | Points |
|-----------|--------|
| User already holds the sell token | +10 pts |
| Sell token is a core ecosystem token | +10 pts |

### Core Tokens

The following are considered core ecosystem tokens:
- PLS (Native token)
- HEX
- PLSX
- INC

### Rationale

- **Already holds:** If user has some of a token, they might want more
- **Core tokens:** High liquidity, widely used, generally desirable

---

## Order Filtering

Before scoring, orders are filtered to only show:

1. **Active orders** (status = 0)
2. **Not expired** (expirationTime > now)
3. **Not fully filled** (remainingSellAmount > 0)

---

## Dynamic Discount Display

When a user cycles through different buy token options on a card, the displayed market discount updates dynamically to reflect that specific token's discount. This helps users identify the best deal among multi-token orders.

---

## Viewed Orders Persistence

Orders that users have already swiped are tracked in localStorage to avoid showing the same orders repeatedly.

### Storage Keys
- `agorax_saved_orders` - Orders swiped right (saved)
- `agorax_viewed_orders` - All viewed orders with timestamps and action
- `agorax_discover_settings` - User preferences

### Configurable Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `hideViewed` | `true` | Whether to hide previously viewed orders |
| `expiryHours` | `24` | Hours until passed orders appear again |

### Expiry Behavior
- **Saved orders**: Never expire from being hidden (always in saved list)
- **Passed orders**: Reappear after `expiryHours` has elapsed

---

## Implementation Files

| File | Purpose |
|------|---------|
| `hooks/useOrderScoring.ts` | Main scoring algorithm |
| `hooks/useSavedOrders.ts` | Saved orders localStorage persistence |
| `hooks/useViewedOrders.ts` | Viewed orders tracking with expiry |
| `components/discover/SwipeCard.tsx` | Card display with dynamic discount |
| `types/discover.ts` | TypeScript interfaces for scored orders |

---

## Score Breakdown Interface

```typescript
interface ScoreBreakdown {
  fillabilityScore: number;  // 0-40
  priceScore: number;        // 0-40
  relevanceScore: number;    // 0-20
}

interface ScoredOrder extends CompleteOrderDetails {
  score: number;           // 0-100 composite
  canFill: boolean;        // User can fully fill
  fillPercentage: number;  // 0-100%
  priceDiscount: number;   // % from market
  breakdown: ScoreBreakdown;
}
```
