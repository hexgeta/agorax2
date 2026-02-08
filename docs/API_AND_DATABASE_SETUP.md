# AgoraX API & Database Setup Guide

## Overview

This document covers:
1. **Supabase database setup** - Tables that mirror all blockchain data
2. **API v1 endpoints** - Public REST API with rate limiting
3. **Manual steps required** - Things you need to do in the Supabase dashboard

---

## 1. Environment Variables

Add these to your `.env.local`:

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJ...your-anon-key
SUPABASE_SERVICE_ROLE_KEY=eyJ...your-service-role-key  # For backfill only
BACKFILL_SECRET=your-random-secret-for-backfill       # Protects /api/events/backfill
```

---

## 2. Database Migrations

Run these in order in the **Supabase SQL Editor** (Dashboard > SQL Editor > New Query):

### Migration 1: Core Schema
**File:** `supabase/migrations/001_user_events_schema.sql`

Creates:
- `event_type` enum (12 event types)
- `users` table (wallet stats, XP, streaks)
- `user_events` table (every tracked event with JSONB data)
- `completed_challenges` table (achievement completions)
- `daily_activity` table (daily aggregates)
- `leaderboard` view
- Functions: `get_or_create_user`, `record_user_event`, `complete_challenge`
- RLS policies (public read, service_role write)

### Migration 2: Achievement Challenges V2
**File:** `supabase/migrations/002_achievement_challenges_v2.sql`

Adds:
- GIN index on `user_events.event_data` (fast JSONB queries)
- Composite index on `(wallet_address, event_type, created_at DESC)`
- `total_proceeds_claimed` column to `users`
- Updated `record_user_event` function for `proceeds_claimed` and `order_expired`

### Migration 3: Full Blockchain Mirror
**File:** `supabase/migrations/003_full_blockchain_mirror.sql`

Creates:
- `orders` table (mirrors every on-chain order)
- `order_fills` table (every individual fill event)
- `order_cancellations` table (cancellation records)
- `order_proceeds` table (proceeds claim records)
- `order_updated` event type added to enum
- New user columns: `total_orders_expired`, `total_volume_as_maker_usd`, `total_volume_as_taker_usd`, `total_fills_given`, `total_fills_received`, `first_trade_date`, `total_unique_tokens_traded`, `total_proceeds_claims`
- Functions: `upsert_order`, `record_order_fill`
- Views: `user_summary`, `order_details_view`
- RLS policies for all new tables

---

## 3. Contract Events → Supabase Mapping

The smart contract at `0xc8a47F14b1833310E2aC72e4C397b5b14a9FEf8B` (PulseChain) emits these events:

| Contract Event | Supabase Tables Written | Event Types Recorded |
|---|---|---|
| `OrderPlaced(address user, uint256 orderID, address sellToken, uint256 sellAmount)` | `orders`, `user_events`, `users` | `order_created`, `wallet_connected` |
| `OrderFilled(address buyer, uint256 orderID, uint256 buyTokenIndex, uint256 buyAmount)` | `order_fills`, `user_events`, `users` | `order_filled`, `trade_completed` |
| `OrderCancelled(address user, uint256 orderID)` | `order_cancellations`, `user_events`, `users` | `order_cancelled` |
| `OrderProceedsCollected(address user, uint256 orderID)` | `order_proceeds`, `user_events`, `users` | `proceeds_claimed` |
| `OrderExecuted(address user, uint256 orderId)` | (Used for notifications only) | — |
| `OrderUpdated(uint256 orderId)` | `orders` (update expiration) | `order_updated` |

### Data Not Available On-Chain (Client-Side Only)
These events can only be tracked from the frontend, not from blockchain logs:
- `order_viewed` - User expanded an order in the marketplace
- `chart_viewed` - User viewed the price chart
- `marketplace_visited` - User visited the marketplace page
- `streak_updated` - Calculated server-side from trade dates
- `prestige_unlocked` - Calculated server-side from XP thresholds

---

## 4. API v1 Endpoints

Base URL: `/api/v1`

All endpoints include:
- **Rate limiting** with `X-RateLimit-*` headers
- **JSON responses** with `{ success, data, timestamp }` format
- **Error responses** with `{ success: false, error, timestamp }`

### GET `/api/v1/users/{address}`

Full user profile with stats, challenges, events, orders, and daily activity.

**Rate limit:** 30 req/min per IP

**Query params:**
| Param | Default | Description |
|---|---|---|
| `include` | `challenges,events,orders,daily` | Comma-separated sections to include |
| `events_limit` | `50` | Max recent events (max 200) |
| `orders_limit` | `50` | Max orders (max 200) |

**Example:**
```
GET /api/v1/users/0x1234...abcd?include=challenges,orders&orders_limit=10
```

**Response shape:**
```json
{
  "success": true,
  "data": {
    "wallet_address": "0x...",
    "stats": {
      "total_xp": 5200,
      "current_prestige": 2,
      "prestige_name": "Gamma",
      "total_orders_created": 45,
      "total_orders_filled": 30,
      "total_orders_cancelled": 5,
      "total_orders_expired": 2,
      "total_trades": 38,
      "total_volume_usd": 15420.50,
      "total_volume_as_maker_usd": 8200.00,
      "total_volume_as_taker_usd": 7220.50,
      "total_fills_given": 30,
      "total_fills_received": 20,
      "unique_tokens_traded": 12,
      "current_active_orders": 3,
      "longest_streak_days": 14,
      "current_streak_days": 5,
      "fill_rate_percent": 66.7,
      "total_proceeds_claimed": 18,
      "member_since": "2025-01-15T..."
    },
    "challenges": {
      "total": 22,
      "by_prestige": { "0": [...], "1": [...] },
      "by_category": { "bootcamp": [...], "operations": [...] },
      "list": [...]
    },
    "orders": {
      "total": 10,
      "status_counts": { "active": 3, "completed": 5, "cancelled": 2 },
      "list": [...]
    },
    "recent_events": [...],
    "daily_activity": [...]
  },
  "timestamp": "2026-02-08T..."
}
```

---

### GET `/api/v1/orders`

List and search orders with filtering, sorting, and pagination.

**Rate limit:** 30 req/min per IP

**Query params:**
| Param | Default | Description |
|---|---|---|
| `maker` | — | Filter by maker wallet address |
| `status` | — | `active`, `completed`, `cancelled` (or `0`, `1`, `2`) |
| `sell_token` | — | Filter by sell token ticker (case-insensitive) |
| `buy_token` | — | Filter by buy token ticker |
| `min_fills` | — | Minimum fill count |
| `has_fills` | — | `true` to only show orders with fills |
| `sort` | `created_at` | `created_at`, `order_id`, `fill_percentage`, `total_fills`, `updated_at` |
| `order` | `desc` | `asc` or `desc` |
| `limit` | `50` | Results per page (max 200) |
| `offset` | `0` | Pagination offset |

**Example:**
```
GET /api/v1/orders?maker=0x123...&status=active&sell_token=HEX&sort=fill_percentage&order=desc
```

---

### GET `/api/v1/orders/{orderId}`

Full order details with fill history, cancellation, and proceeds data.

**Rate limit:** 60 req/min per IP

**Query params:**
| Param | Default | Description |
|---|---|---|
| `include` | `fills,cancellation,proceeds` | Comma-separated sections |
| `fills_limit` | `100` | Max fill records (max 500) |

**Response shape:**
```json
{
  "success": true,
  "data": {
    "order": {
      "order_id": 42,
      "maker_address": "0x...",
      "sell_token_ticker": "HEX",
      "buy_tokens_tickers": ["PLS", "PLSX"],
      "sell_amount_formatted": 100000.0,
      "status": 0,
      "status_label": "active",
      "fill_percentage": 45.5,
      "total_fills": 3,
      "unique_fillers": 2,
      "is_all_or_nothing": false,
      "created_at": "2025-..."
    },
    "fills": {
      "total": 3,
      "unique_fillers": 2,
      "total_volume_usd": 1520.00,
      "list": [
        {
          "filler_address": "0x...",
          "buy_token_ticker": "PLS",
          "buy_amount_formatted": 500000.0,
          "volume_usd": 520.00,
          "tx_hash": "0x...",
          "filled_at": "2025-..."
        }
      ]
    },
    "cancellation": null,
    "proceeds": { "total_claims": 1, "list": [...] },
    "event_history": [...]
  }
}
```

---

### GET `/api/v1/stats`

Protocol-wide aggregate statistics.

**Rate limit:** 20 req/min per IP

**Response shape:**
```json
{
  "success": true,
  "data": {
    "protocol": {
      "total_users": 156,
      "total_xp_issued": 425000,
      "total_trades": 2340,
      "total_volume_usd": 1540000.00,
      "total_orders_created": 3200,
      "total_orders_filled": 2100,
      "total_orders_cancelled": 450,
      "total_fill_volume_usd": 980000.00,
      "fill_rate_percent": 65.6
    },
    "orders": { "total": 3200, "by_status": { "active": 650, "cancelled": 450, "completed": 2100 } },
    "fills": { "total": 5600 },
    "achievements": { "total_challenges_completed": 890, "total_xp_from_challenges": 320000 },
    "events": { "total_recorded": 45000 }
  }
}
```

---

### GET `/api/v1/leaderboard`

Ranked user list sorted by XP or other metrics.

**Rate limit:** 20 req/min per IP

**Query params:**
| Param | Default | Description |
|---|---|---|
| `sort` | `total_xp` | `total_xp`, `total_trades`, `total_volume_usd`, `total_orders_created`, `total_orders_filled`, `current_prestige` |
| `order` | `desc` | `asc` or `desc` |
| `limit` | `50` | Results per page (max 200) |
| `offset` | `0` | Pagination offset |
| `min_xp` | `0` | Minimum XP threshold |
| `min_trades` | `0` | Minimum trades threshold |

---

## 5. Rate Limiting

All endpoints use in-memory rate limiting per IP + path:

| Endpoint | Limit | Window |
|---|---|---|
| `/api/v1/users/{address}` | 30 req | 60 sec |
| `/api/v1/orders` | 30 req | 60 sec |
| `/api/v1/orders/{orderId}` | 60 req | 60 sec |
| `/api/v1/stats` | 20 req | 60 sec |
| `/api/v1/leaderboard` | 20 req | 60 sec |

Rate limit headers on every response:
- `X-RateLimit-Limit` - Max requests in window
- `X-RateLimit-Remaining` - Requests left
- `X-RateLimit-Reset` - Unix timestamp when window resets

When rate limited, returns `429 Too Many Requests` with `Retry-After` header.

---

## 6. Database Schema Diagram

```
users
├── wallet_address (PK, unique)
├── total_xp, current_prestige
├── total_orders_created/filled/cancelled/expired
├── total_trades, total_volume_usd
├── total_volume_as_maker_usd, total_volume_as_taker_usd
├── total_fills_given, total_fills_received
├── unique_tokens_traded, current_active_orders
├── streaks, dates, timestamps
│
├── user_events (FK wallet_address)
│   ├── event_type (enum), event_data (JSONB)
│   └── xp_awarded, created_at
│
├── completed_challenges (FK wallet_address)
│   ├── prestige_level, challenge_name, category
│   └── xp_awarded, completed_at
│
├── daily_activity (FK wallet_address)
│   └── activity_date, trades_count, orders_created, volume_usd
│
└── orders (FK maker_address)
    ├── order_id (unique, on-chain ID)
    ├── sell/buy token details (addresses, tickers, amounts)
    ├── status (0=active, 1=cancelled, 2=completed)
    ├── fill_percentage, is_all_or_nothing, expiration
    ├── total_fills, unique_fillers
    │
    ├── order_fills (FK order_id)
    │   ├── filler_address, buy_token details
    │   ├── amounts (raw + formatted), volume_usd
    │   └── tx_hash, block_number, filled_at
    │
    ├── order_cancellations (FK order_id)
    │   └── cancelled_by, fill_percentage_at_cancel, tx_hash
    │
    └── order_proceeds (FK order_id)
        └── claimed_by, tx_hash, claimed_at
```

---

## 7. Manual Steps Required

### Step 1: Create Supabase Project
1. Go to [supabase.com](https://supabase.com) and create a project
2. Copy your project URL and anon key to `.env.local`

### Step 2: Run Migrations
In the Supabase SQL Editor, run each migration file in order:
1. `001_user_events_schema.sql`
2. `002_achievement_challenges_v2.sql`
3. `003_full_blockchain_mirror.sql`

### Step 3: Run the Backfill
Once migrations are in place and env vars are set:
```bash
curl -X POST http://localhost:3000/api/events/backfill \
  -H "Content-Type: application/json" \
  -d '{"secret": "your-BACKFILL_SECRET-value"}'
```

This reads all historical blockchain events from the contract deployment block and populates:
- User records for every wallet that interacted
- All order_created, order_filled, order_cancelled, proceeds_claimed events in `user_events`
- Full order data in the `orders` table (fetched via `getOrderDetails` RPC calls)
- Fill records in `order_fills` table
- Cancellation records in `order_cancellations` table
- Proceeds claim records in `order_proceeds` table
- Achievement/challenge evaluations based on historical data
- Aggregate user stats (XP, volumes, fill counts, unique tokens, streaks)

### Step 4: Verify
Test the API:
```bash
# Check protocol stats
curl http://localhost:3000/api/v1/stats

# Check a user
curl http://localhost:3000/api/v1/users/0xYOUR_WALLET_HERE

# List orders
curl http://localhost:3000/api/v1/orders?limit=10

# Get leaderboard
curl http://localhost:3000/api/v1/leaderboard?limit=20
```

---

## 8. Backfill Details

The `/api/events/backfill` endpoint now writes to **all** tables:

| Event | Tables Written |
|---|---|
| `OrderPlaced` | `users`, `user_events`, `orders` |
| `OrderFilled` | `users`, `user_events`, `order_fills` |
| `OrderCancelled` | `users`, `user_events`, `order_cancellations`, `orders` (status update) |
| `OrderProceedsCollected` | `users`, `user_events`, `order_proceeds` |

The backfill also:
- Fetches the token whitelist via `viewWhitelisted` to resolve buy token indices to addresses/tickers
- Batch-fetches full order details via `getOrderDetails` (buy amounts, AON flag, expiration, fill %)
- Calculates `fill_percentage` from `remainingSellAmount` and `redeemedSellAmount`
- Updates order status from the contract's `status` field (0=active, 1=cancelled, 2=completed)
- Recalculates all aggregate user stats (XP, volumes, fill counts, unique tokens, proceeds claims)
- Evaluates all achievement challenges based on historical data

**Authentication:** Send the `BACKFILL_SECRET` as a Bearer token:
```bash
curl -X POST http://localhost:3000/api/events/backfill \
  -H "Authorization: Bearer your-BACKFILL_SECRET-value" \
  -H "Content-Type: application/json" \
  -d '{"from_block": 21266815}'
```

**Note:** Requires runtime access to a PulseChain RPC node and Supabase credentials.

---

## 9. Existing Endpoints (Pre-v1)

These endpoints still work and are used by the frontend:

| Endpoint | Purpose |
|---|---|
| `POST /api/events/track` | Record a single event (used by `useEventTracking` hook) |
| `POST /api/events/backfill` | Historical blockchain event backfill |
| `GET /api/user/achievements?wallet=0x...` | User achievements for the frontend |
| `GET /api/leaderboard?limit=100` | Legacy leaderboard for the frontend |
