# Limit Order Form - Data Flow Rules

> **Implementation**: See `/hooks/useLimitOrderPricing.ts` for the centralized pricing logic hook.
> This hook contains ALL pricing calculations and action handlers in one place.

This document explains how the limit order form handles prices, inputs, and token changes. Use this as reference when making changes.

---

## The Core Concept

The user sets a **percentage** above or below market price (e.g., +5%, -10%, or 0% for market).

This percentage is the "anchor" - it should stay constant when tokens change. Everything else recalculates around it.

---

## The Key Variables

| Variable | What it is | Example |
|----------|-----------|---------|
| `sellAmount` | How many tokens the user is selling | 45,086 MAXI |
| `buyAmount` | How many tokens the user wants to receive | 52,740 HEX |
| `limitPrice` | The ratio: buy tokens per 1 sell token | 1.17 (means 1.17 HEX per MAXI) |
| `pricePercentage` | How far from market price | +5% means 5% above market |
| `marketPrice` | Current exchange rate based on USD prices | Calculated from price feeds |

---

## How Market Price is Calculated

```
marketPrice = sellTokenUsdPrice / buyTokenUsdPrice
```

Example:
- MAXI = $0.00264 USD
- HEX = $0.00225 USD
- Market price = 0.00264 / 0.00225 = 1.17 HEX per MAXI

---

## How Limit Price Relates to Market Price

```
limitPrice = marketPrice * (1 + percentage/100)
```

Examples:
- Market price = 1.17, percentage = 0% → limit price = 1.17
- Market price = 1.17, percentage = +5% → limit price = 1.23
- Market price = 1.17, percentage = -10% → limit price = 1.05

---

## How Buy Amount is Calculated

```
buyAmount = sellAmount * limitPrice
```

Example:
- Selling 45,086 MAXI
- Limit price = 1.17 HEX per MAXI
- Buy amount = 45,086 * 1.17 = 52,750 HEX

---

## User Actions and What Should Happen

### Action 1: User changes the SELL token

**What stays the same:**
- Sell amount (the number in the input)
- Percentage from market

**What changes:**
- Market price (recalculated for new token pair)
- Limit price (new market price × percentage multiplier)
- Buy amount (sell amount × new limit price)

**Example:**
- Was: Selling 1000 PLS for HEX at +5%
- Changed sell token to: MAXI
- Now: Selling 1000 MAXI for HEX at +5% (new limit price and buy amount calculated)

---

### Action 2: User changes the BUY token

**What stays the same:**
- Sell amount
- Percentage from market

**What changes:**
- Market price (recalculated for new token pair)
- Limit price (new market price × percentage multiplier)
- Buy amount (sell amount × new limit price)

**Example:**
- Was: Selling 1000 MAXI for HEX at +5%
- Changed buy token to: PLS
- Now: Selling 1000 MAXI for PLS at +5% (new limit price and buy amount calculated)

---

### Action 3: User clicks a percentage button (+1%, +2%, +5%, +10%, Market)

**What stays the same:**
- Sell amount
- Sell token
- Buy token
- Market price (it's based on current tokens, doesn't change)

**What changes:**
- Percentage (set to the button value)
- Limit price (market price × new percentage multiplier)
- Buy amount (sell amount × new limit price)

---

### Action 4: User drags the limit price line on the chart

**What stays the same:**
- Sell amount
- Sell token
- Buy token

**What changes:**
- Limit price (set to where user dragged)
- Percentage (recalculated: how far is new limit price from market?)
- Buy amount (sell amount × new limit price)

---

### Action 5: User types in the limit price input

**What stays the same:**
- Sell amount
- Sell token
- Buy token

**What changes:**
- Limit price (set to what user typed)
- Percentage (recalculated from new limit price vs market)
- Buy amount (sell amount × new limit price)

---

### Action 6: User types in the sell amount input

**What stays the same:**
- Sell token
- Buy token
- Limit price
- Percentage

**What changes:**
- Sell amount (set to what user typed)
- Buy amount (new sell amount × limit price)

---

### Action 7: User types in the buy amount input

**What stays the same:**
- Sell token
- Buy token
- Sell amount

**What changes:**
- Buy amount (set to what user typed)
- Limit price (recalculated: buy amount / sell amount)
- Percentage (recalculated from new limit price vs market)

---

## Important: The `activeInputRef` Flag

To prevent infinite loops when inputs update each other, we use `activeInputRef.current` to track which input the user is actively typing in.

- When user types in sell input: `activeInputRef.current = 'sell'`
- When user types in buy input: `activeInputRef.current = 'buy'`
- When code updates an input programmatically (not user typing): DON'T set the flag

This way, useEffects can check the flag and know whether to recalculate or not.

---

## Important: Avoid Feedback Loops

Bad pattern (causes infinite loop):
```
User types in sell → triggers useEffect → updates buy → triggers useEffect → updates sell → ...
```

Good pattern:
```
User types in sell → triggers useEffect → checks activeInputRef →
  if activeInputRef === 'sell', update buy (don't trigger sell update)
```

---

## The Formula Cheat Sheet

| I have... | I want... | Formula |
|-----------|-----------|---------|
| Sell amount + limit price | Buy amount | `buyAmount = sellAmount * limitPrice` |
| Sell amount + buy amount | Limit price | `limitPrice = buyAmount / sellAmount` |
| Market price + percentage | Limit price | `limitPrice = marketPrice * (1 + pct/100)` |
| Market price + limit price | Percentage | `percentage = ((limitPrice / marketPrice) - 1) * 100` |
| Sell USD + Buy USD | Market price | `marketPrice = sellUsd / buyUsd` |

---

## Important: Deferred Token Change Handling

When the user changes tokens, price recalculation is handled by a **deferred useEffect** rather than synchronously in the selection handler. This fixes a race condition where prices weren't ready when the handler ran.

### The Problem (Before)

```
1. User selects new buy token
2. handleBuyTokenSelect() calls pricing.handleBuyTokenChange() immediately
3. getPrice() callback still has old prices in closure (React hasn't re-rendered)
4. Market price calculated with stale/wrong data
5. Limit price "goes crazy" to wrong value
6. On next render with fresh prices, it snaps back to correct value
```

### The Solution (After)

```
1. User selects new buy token
2. handleBuyTokenSelect() only updates token state (no pricing call)
3. useEffect detects token address changed via refs
4. useEffect checks if BOTH tokens have valid prices (> 0)
5. If prices not ready: effect exits early, will retry when prices update
6. If prices ready: calculate new limit price and buy amount
7. Update refs to prevent re-triggering
```

The key refs used:
- `prevSellTokenAddressRef` - tracks previous sell token address
- `prevBuyTokenAddressRef` - tracks previous buy token address

Search for "DEFERRED TOKEN CHANGE HANDLER" in `LimitOrderForm.tsx` to find the implementation.

---

## Summary: The Golden Rules

1. **Percentage is king** - When tokens change, percentage stays, everything else recalculates
2. **Sell amount is stable** - User's sell amount only changes when THEY type in it
3. **One-way data flow** - Know which variable is the "source" and which are "derived"
4. **Use activeInputRef** - Prevent feedback loops by tracking user input focus
5. **Don't update limit price on token change unless recalculating** - The old limit price number is meaningless for a new token pair
6. **Defer price recalculation on token change** - Use useEffect with price availability check to avoid race conditions
