# AgoraX Events & Achievement System

## Overview

The achievement system tracks on-chain and UI events to award XP and complete challenges across 9 prestige levels (Alpha through Omega). Events are recorded to Supabase via `/api/events/track` and challenges are auto-evaluated on each event.

---

## Event Types

### Core Events

| Event | XP | Trigger | Key `event_data` fields |
|-------|----|---------|------------------------|
| `wallet_connected` | 0 | First wallet connection (one-off) | — |
| `order_created` | 10 | User places a limit order | `order_id`, `sell_token`, `sell_amount`, `buy_tokens[]`, `buy_amounts[]`, `volume_usd?`, `is_all_or_nothing?`, `expiration?`, `price_vs_market_percent?` |
| `order_filled` | 10 | User fills someone else's order | `order_id`, `fill_amount`, `fill_percentage`, `buy_token_used`, `volume_usd?`, `fill_time_seconds?` |
| `order_cancelled` | 0 | User cancels their order | `order_id`, `time_since_creation_seconds?`, `fill_percentage_at_cancel?` |
| `order_expired` | 0 | Order reaches expiration | `order_id`, `fill_percentage` |
| `proceeds_claimed` | 5 | User collects proceeds from filled order | `order_id` |
| `trade_completed` | 25 | A fill completes (fired for both maker + filler) | `order_id`, `sell_token`, `buy_token`, `sell_amount`, `buy_amount`, `volume_usd`, `is_maker`, `filler_wallet?`, `order_completed?`, `is_all_or_nothing?` |

### UI Events

| Event | XP | Trigger | Key `event_data` fields |
|-------|----|---------|------------------------|
| `chart_viewed` | 1 | User views a price chart | — |
| `marketplace_visited` | 1 | First marketplace page visit (one-off) | — |

### Special Events

| Event | XP | Trigger |
|-------|----|---------|
| `streak_updated` | 0 | Daily streak recalculation |
| `prestige_unlocked` | 0 | User completes all challenges in a prestige level |

---

## Required `event_data` Fields for New Challenges

Several new challenges require specific fields in `trade_completed` events. **These must be included when firing `trade_completed` from the frontend:**

| Field | Type | Used By |
|-------|------|---------|
| `is_maker` | `boolean` | Clean Sweep, AON Champion, Multi-Fill, Full House |
| `order_completed` | `boolean` | Clean Sweep, AON Champion, Full House |
| `is_all_or_nothing` | `boolean` | AON Champion |
| `filler_wallet` | `string` | Multi-Fill (address of whoever filled the order) |
| `volume_usd` | `number` | Penny Pincher, all volume challenges |

---

## All Challenges (84 total)

### Alpha (Prestige 0) — Getting Started

| Challenge | Category | XP | Requirement | Detection |
|-----------|----------|-----|-------------|-----------|
| First Steps | bootcamp | 50 | Connect wallet | `wallet_connected` event |
| First Order | operations | 250 | Create 1 order | `total_orders_created >= 1` |
| First Fill | operations | 250 | Fill 1 order | `total_orders_filled >= 1` |
| Small Fry | elite | 300 | $100+ single trade | `trade_completed` volume_usd >= 100 |
| Paper Hands | humiliation | 50 | Cancel < 1 min | `order_cancelled` time_since_creation < 60 |

### Beta (Prestige 1) — Building Momentum

| Challenge | Category | XP | Requirement | Detection |
|-----------|----------|-----|-------------|-----------|
| Getting Comfortable | operations | 400 | Create 5 orders | `total_orders_created >= 5` |
| Active Buyer | operations | 400 | Fill 5 orders | `total_orders_filled >= 5` |
| Weekend Warrior | operations | 300 | Create order on Sat/Sun | `order_created` UTC day = 0 (Sun) or 6 (Sat) |
| DEX Degen | wildcard | 150 | Order with DEX token | `order_created` sell/buy token in PLSX, 9MM, 9INCH, PHUX, TIDE, UNI |
| Volume Starter | elite | 500 | $500 total volume | `total_volume_usd >= 500` |
| Micro Trader | humiliation | 75 | Trade < $1 | `trade_completed` volume_usd < 1 |

### Gamma (Prestige 2) — Active Trading

| Challenge | Category | XP | Requirement | Detection |
|-----------|----------|-----|-------------|-----------|
| Multi-Token Beginner | bootcamp | 300 | Trade 5 tokens | unique tokens in `trade_completed` >= 5 |
| Active Trader | operations | 500 | 10 total trades | `total_trades >= 10` |
| Consistent | operations | 400 | 3-day streak | `current_streak_days >= 3` |
| Playing Both Sides | operations | 500 | Create + fill same day | `order_created` + `order_filled` same UTC day |
| Volume Builder | elite | 750 | $1K total volume | `total_volume_usd >= 1000` |
| Rising Star | elite | 600 | $500+ single trade | `trade_completed` volume_usd >= 500 |
| Night Owl | humiliation | 200 | Trade 3-5 AM UTC | `trade_completed` UTC hour 3-4 |
| Deja Vu | humiliation | 100 | Duplicate order | `order_created` same sell_token + buy_tokens + sell_amount |

### Delta (Prestige 3) — Dedicated Trader

| Challenge | Category | XP | Requirement | Detection |
|-----------|----------|-----|-------------|-----------|
| Token Diversity | bootcamp | 500 | Trade 10 tokens | unique tokens >= 10 |
| Order Machine | operations | 800 | Create 25 orders | `total_orders_created >= 25` |
| Fill Expert | operations | 800 | Fill 25 orders | `total_orders_filled >= 25` |
| Dedicated | operations | 600 | 7-day streak | `current_streak_days >= 7` |
| The Collector | operations | 600 | Claim 10 orders | `proceeds_claimed` unique order_ids >= 10 |
| Clean Sweep | operations | 800 | 5 orders fully filled | `trade_completed` is_maker + order_completed count >= 5 |
| Big Spender | elite | 1200 | $1K+ single trade | volume_usd >= 1000 |
| Indecisive | humiliation | 100 | 5 cancels in 1 day | `order_cancelled` same UTC day >= 5 |
| Ghost Order | humiliation | 75 | Order expires 0% filled | `order_expired` fill_percentage = 0 |
| Early Bird | humiliation | 250 | Trade midnight UTC | `trade_completed` UTC hour = 0 |

### Epsilon (Prestige 4) — Experienced Trader

| Challenge | Category | XP | Requirement | Detection |
|-----------|----------|-----|-------------|-----------|
| Token Collector | bootcamp | 800 | Trade 20 tokens | unique tokens >= 20 |
| Hexican | wildcard | 600 | Trade 100K HEX | total HEX volume >= 100,000 |
| Veteran Trader | operations | 1500 | 50 total trades | `total_trades >= 50` |
| Order Veteran | operations | 1200 | Create 50 orders | `total_orders_created >= 50` |
| Two Week Warrior | operations | 1000 | 14-day streak | `current_streak_days >= 14` |
| Perfect Record | operations | 1500 | 10 trades, 0 cancels | `total_trades >= 10 && total_orders_cancelled == 0` |
| Volume Veteran | elite | 2000 | $10K total volume | `total_volume_usd >= 10000` |
| Iron Hands | wildcard | 1500 | Order open 30+ days | `proceeds_claimed` order age >= 30 days |
| Speed Runner | humiliation | 400 | Fill < 30s | `order_filled` fill_time_seconds <= 30 |
| Penny Pincher | humiliation | 200 | 10 trades < $1 | `trade_completed` volume_usd < 1, count >= 10 |

### Zeta (Prestige 5) — Professional Trader

| Challenge | Category | XP | Requirement | Detection |
|-----------|----------|-----|-------------|-----------|
| Diversified | bootcamp | 1200 | Trade 30 tokens | unique tokens >= 30 |
| PLS Stacker | bootcamp | 1000 | Trade 1M PLS | total PLS volume >= 1,000,000 |
| Century Trader | operations | 3000 | 100 total trades | `total_trades >= 100` |
| Order Legend | operations | 2500 | Create 100 orders | `total_orders_created >= 100` |
| Market Maker | operations | 1500 | 5 concurrent orders | `current_active_orders >= 5` |
| AON Champion | operations | 2500 | 3 completed AON orders | `trade_completed` is_maker + order_completed + is_all_or_nothing >= 3 |
| Claim Machine | operations | 2000 | 50 total claims | `proceeds_claimed` count >= 50 |
| Whale Alert | elite | 4000 | $10K+ single trade | volume_usd >= 10000 |
| HEX Baron | elite | 3000 | 1M HEX total volume | total HEX traded >= 1,000,000 |
| Fatfinger | humiliation | 150 | Order above market price | `order_created` price_vs_market_percent > 0 |
| Dip Catcher | humiliation | 150 | 50% below market | `order_created` price_vs_market_percent <= -50 |
| Order Hoarder | humiliation | 300 | 15 open unfilled orders | `current_active_orders >= 15` |
| Ghost Town | humiliation | 200 | 5 expired 0-fill orders | `order_expired` fill_percentage = 0, count >= 5 |

### Eta (Prestige 6) — Elite Trader

| Challenge | Category | XP | Requirement | Detection |
|-----------|----------|-----|-------------|-----------|
| Token Master | bootcamp | 2000 | Trade 40 tokens | unique tokens >= 40 |
| Ethereum Maxi | bootcamp | 1500 | Trade wrapped ETH tokens | any token starting with "WE" (weHEX, etc.) |
| Fill Master | operations | 5000 | Fill 200 orders | `total_orders_filled >= 200` |
| Power Maker | operations | 2500 | 10 concurrent orders | `current_active_orders >= 10` |
| Multi-Fill | wildcard | 3000 | 5 unique fillers on 1 order | `trade_completed` unique filler_wallets per order_id >= 5 |
| Volume King | elite | 8000 | $100K total volume | `total_volume_usd >= 100000` |
| Diamond Hands | wildcard | 5000 | Order open 90+ days | `proceeds_claimed` order age >= 90 days |
| PLS Baron | elite | 3000 | 10M PLS total volume | total PLS traded >= 10,000,000 |

### Theta (Prestige 7) — Master Trader

| Challenge | Category | XP | Requirement | Detection |
|-----------|----------|-----|-------------|-----------|
| Token Legend | bootcamp | 3000 | Trade 50 tokens | unique tokens >= 50 |
| MAXI Maxi | wildcard | 2000 | Trade any MAXI token | any token containing "MAXI" |
| Bond Trader | wildcard | 2000 | Order with HTT token | `order_created` with HTT (Hedron T-Share Token) |
| Coupon Clipper | wildcard | 2000 | Order with COM token | `order_created` with COM (Community Token) |
| $1 Inevitable | wildcard | 2000 | Order with pDAI | `order_created` with pDAI/DAI |
| Trade Machine | operations | 10000 | 500 total trades | `total_trades >= 500` |
| Order God | operations | 8000 | Create 500 orders | `total_orders_created >= 500` |
| Full House | wildcard | 5000 | 3 partially filled orders | `trade_completed` partially filled active maker orders >= 3 |
| Mega Whale | elite | 20000 | $100K+ single trade | volume_usd >= 100000 |
| Stablecoin Baron | elite | 5000 | 100K stablecoin volume | total DAI+USDC+USDT+USDL traded >= 100,000 |
| Profit Master | elite | 12000 | 100 total claims | `proceeds_claimed` count >= 100 |
| Total Chaos | humiliation | 500 | 20 cancels in 1 day | `order_cancelled` same UTC day >= 20 |

### Omega (Prestige 8) — God Mode

| Challenge | Category | XP | Requirement | Detection |
|-----------|----------|-----|-------------|-----------|
| Token God | bootcamp | 5000 | Trade 75 tokens | unique tokens >= 75 |
| Trade Legend | operations | 25000 | 1000 total trades | `total_trades >= 1000` |
| Order Immortal | operations | 20000 | Create 1000 orders | `total_orders_created >= 1000` |
| Domination | operations | 5000 | 20 concurrent orders | `current_active_orders >= 20` |
| Volume God | elite | 50000 | $1M total volume | `total_volume_usd >= 1000000` |
| Leviathan | elite | 75000 | $500K+ single trade | volume_usd >= 500000 |
| Sniper | humiliation | 2000 | Fill within 1 minute | `order_filled` fill_time_seconds <= 60 |

---

## Recent Challenge Updates

**Renamed:**
- MAXI Supporter → MAXI Maxi
- Market Dominator → Domination
- Instant Legend → Sniper (threshold changed to 60 seconds)
- Multi-Chain Explorer → Ethereum Maxi
- Fire Sale → Dip Catcher
- Overkill → Fatfinger (now triggers on any order above market price)

**Removed:**
- All-Nighter (24 consecutive hours of trading)
- Year Warrior (100 day streak)
- Full Spectrum (trade all token categories)
- Unstoppable (60 day streak)
- Marathon Trader (30 day streak)
- The Sniper (5 second fill - replaced by Sniper at 60 seconds)
- Fat Finger (100x above market - consolidated into Fatfinger)

**Added:**
- Bond Trader (Theta/Level 7) - Make an order with HTT token - 2000 XP
- Coupon Clipper (Theta/Level 7) - Make an order with COM token - 2000 XP
- $1 Inevitable (Theta/Level 7) - Make an order with pDAI - 2000 XP
- DEX Degen (Beta/Level 1) - Order with DEX token (PLSX, 9MM, 9INCH, PHUX, TIDE, UNI) - 150 XP

**Renamed:**
- Small Fish → Small Fry
- Both Sides → Playing Both Sides
- HEX Enthusiast → Hexican

**Removed:**
- Price Watcher (chart_viewed challenge)
- Window Shopper, Token Explorer, Market Scanner, Market Regular (order_viewed challenges)
- Arbitrage Artist (fill then create within 2 minutes)

**Changed:**
- Weekend Warrior: now triggers on order_created on Sat/Sun (was trade on both Sat AND Sun)
- Categories removed: bootcamp/operations/elite no longer used. Challenges are either required or wildcard
- Moved to wildcard: Iron Hands, Multi-Fill, Diamond Hands, MAXI Maxi, Bond Trader, Coupon Clipper, $1 Inevitable, Full House, Hexican

---

## API Endpoints

### POST `/api/events/track`

Record a new event and auto-evaluate challenges.

```json
{
  "wallet_address": "0x...",
  "event_type": "trade_completed",
  "event_data": {
    "order_id": 42,
    "sell_token": "HEX",
    "buy_token": "PLS",
    "sell_amount": "1000",
    "buy_amount": "50000",
    "volume_usd": 150.00,
    "is_maker": true,
    "filler_wallet": "0xabc...",
    "order_completed": false,
    "is_all_or_nothing": false
  }
}
```

Response:
```json
{
  "success": true,
  "event_id": "uuid",
  "xp_awarded": 75,
  "challenges_completed": [
    { "prestige_level": 0, "challenge_name": "Small Fry", "category": "elite", "xp_awarded": 300 }
  ]
}
```

### POST `/api/events/backfill`

Scan on-chain events and populate users/events/achievements retroactively. Protected by `BACKFILL_SECRET` env var.

```json
{
  "from_block": 21266815,
  "to_block": 22000000
}
```

### GET `/api/user/achievements?wallet=0x...`

Fetch a user's stats and completed challenges.

---

## Database Schema

See `supabase/migrations/001_user_events_schema.sql` for base schema.
See `supabase/migrations/002_achievement_challenges_v2.sql` for:
- GIN index on `event_data` JSONB (fast contains queries)
- Composite index for date-range event queries
- `total_proceeds_claimed` column on users table
- Updated `record_user_event` function with `proceeds_claimed` + `order_expired` handling
