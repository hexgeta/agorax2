'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { LiquidGlassCard } from '@/components/ui/liquid-glass';
import PixelBlastBackground from '@/components/ui/PixelBlastBackground';

// Challenge tracking documentation
interface ChallengeDoc {
  name: string;
  level: number;
  levelName: string;
  category: string;
  xp: number;
  description: string;
  eventType: string;
  trackingLogic: string;
  eventData: string[];
  status: 'implemented' | 'partial' | 'needs-work';
}

const CHALLENGE_DOCS: ChallengeDoc[] = [
  // Alpha (Level 0)
  {
    name: 'First Steps',
    level: 0,
    levelName: 'Alpha',
    category: 'bootcamp',
    xp: 50,
    description: 'Connect your wallet for the first time',
    eventType: 'wallet_connected',
    trackingLogic: 'Triggered when user connects wallet. API deduplicates - only first connection ever is recorded.',
    eventData: [],
    status: 'implemented',
  },
  {
    name: 'Window Shopper',
    level: 0,
    levelName: 'Alpha',
    category: 'bootcamp',
    xp: 100,
    description: 'View 10 different orders in the marketplace',
    eventType: 'order_viewed',
    trackingLogic: 'Counted by extracting unique order_id values from all order_viewed events for the user.',
    eventData: ['order_id: number', 'token_symbol: string'],
    status: 'implemented',
  },
  {
    name: 'First Order',
    level: 0,
    levelName: 'Alpha',
    category: 'operations',
    xp: 250,
    description: 'Create your first limit order',
    eventType: 'order_created',
    trackingLogic: 'Checked against users.total_orders_created >= 1',
    eventData: ['sell_token', 'buy_tokens', 'sell_amount_usd', 'buy_amount_usd', 'price_vs_market_percent'],
    status: 'implemented',
  },
  {
    name: 'First Fill',
    level: 0,
    levelName: 'Alpha',
    category: 'operations',
    xp: 250,
    description: 'Fill your first order',
    eventType: 'order_filled',
    trackingLogic: 'Checked against users.total_orders_filled >= 1',
    eventData: ['order_id', 'fill_token', 'fill_amount_usd', 'fill_time_seconds'],
    status: 'implemented',
  },
  {
    name: 'Small Fish',
    level: 0,
    levelName: 'Alpha',
    category: 'elite',
    xp: 300,
    description: 'Complete a trade worth $100+',
    eventType: 'trade_completed',
    trackingLogic: 'Checked if event_data.volume_usd >= 100',
    eventData: ['volume_usd', 'sell_token', 'buy_token', 'is_maker'],
    status: 'implemented',
  },
  {
    name: 'Paper Hands',
    level: 0,
    levelName: 'Alpha',
    category: 'wildcard',
    xp: 50,
    description: 'Cancel an order within 1 minute of creating it',
    eventType: 'order_cancelled',
    trackingLogic: 'Checked if event_data.time_since_creation_seconds < 60',
    eventData: ['order_id', 'sell_token', 'time_since_creation_seconds'],
    status: 'implemented',
  },

  // Beta (Level 1)
  {
    name: 'Price Watcher',
    level: 1,
    levelName: 'Beta',
    category: 'bootcamp',
    xp: 100,
    description: 'Check the price chart 10 times',
    eventType: 'chart_viewed',
    trackingLogic: 'Count of chart_viewed events for user >= 10',
    eventData: ['token_pair'],
    status: 'implemented',
  },
  {
    name: 'Token Explorer',
    level: 1,
    levelName: 'Beta',
    category: 'bootcamp',
    xp: 150,
    description: 'View orders for 5 different tokens',
    eventType: 'order_viewed',
    trackingLogic: 'Extract unique token_symbol values from order_viewed events, count >= 5',
    eventData: ['order_id', 'token_symbol'],
    status: 'implemented',
  },
  {
    name: 'Getting Comfortable',
    level: 1,
    levelName: 'Beta',
    category: 'operations',
    xp: 400,
    description: 'Create 5 orders',
    eventType: 'order_created',
    trackingLogic: 'Checked against users.total_orders_created >= 5',
    eventData: ['sell_token', 'buy_tokens'],
    status: 'implemented',
  },
  {
    name: 'Active Buyer',
    level: 1,
    levelName: 'Beta',
    category: 'operations',
    xp: 400,
    description: 'Fill 5 orders',
    eventType: 'order_filled',
    trackingLogic: 'Checked against users.total_orders_filled >= 5',
    eventData: ['order_id', 'fill_token'],
    status: 'implemented',
  },
  {
    name: 'Weekend Warrior',
    level: 1,
    levelName: 'Beta',
    category: 'operations',
    xp: 300,
    description: 'Complete trades on both Saturday and Sunday',
    eventType: 'trade_completed',
    trackingLogic: 'Checks all trade_completed events for user. Needs at least one trade on a Saturday (day 6) AND one on a Sunday (day 0) using UTC getDay().',
    eventData: [],
    status: 'implemented',
  },
  {
    name: 'Volume Starter',
    level: 1,
    levelName: 'Beta',
    category: 'elite',
    xp: 500,
    description: 'Trade $500 in total volume',
    eventType: 'trade_completed',
    trackingLogic: 'Checked against users.total_volume_usd >= 500',
    eventData: ['volume_usd'],
    status: 'implemented',
  },
  {
    name: 'Micro Trader',
    level: 1,
    levelName: 'Beta',
    category: 'wildcard',
    xp: 75,
    description: 'Complete a trade worth less than $1',
    eventType: 'trade_completed',
    trackingLogic: 'Checked if event_data.volume_usd > 0 && volume_usd < 1',
    eventData: ['volume_usd'],
    status: 'implemented',
  },

  // Gamma (Level 2)
  {
    name: 'Multi-Token Beginner',
    level: 2,
    levelName: 'Gamma',
    category: 'bootcamp',
    xp: 300,
    description: 'Trade 5 different tokens',
    eventType: 'trade_completed',
    trackingLogic: 'Extract unique sell_token and buy_token from all trade_completed events, count >= 5',
    eventData: ['sell_token', 'buy_token'],
    status: 'implemented',
  },
  {
    name: 'Market Scanner',
    level: 2,
    levelName: 'Gamma',
    category: 'bootcamp',
    xp: 200,
    description: 'View 50 different orders',
    eventType: 'order_viewed',
    trackingLogic: 'Count unique order_id from order_viewed events >= 50',
    eventData: ['order_id'],
    status: 'implemented',
  },
  {
    name: 'Active Trader',
    level: 2,
    levelName: 'Gamma',
    category: 'operations',
    xp: 500,
    description: 'Complete 10 trades total',
    eventType: 'trade_completed',
    trackingLogic: 'Checked against users.total_trades >= 10',
    eventData: [],
    status: 'implemented',
  },
  {
    name: 'Consistent',
    level: 2,
    levelName: 'Gamma',
    category: 'operations',
    xp: 400,
    description: 'Trade 3 days in a row',
    eventType: 'trade_completed',
    trackingLogic: 'Checked against users.current_streak_days >= 3 (streak updated by database trigger)',
    eventData: [],
    status: 'implemented',
  },
  {
    name: 'Both Sides',
    level: 2,
    levelName: 'Gamma',
    category: 'operations',
    xp: 500,
    description: 'Create an order and fill an order on the same UTC day',
    eventType: 'order_created / order_filled',
    trackingLogic: 'On order_created: checks for any order_filled events from the same UTC day. On order_filled: checks for any order_created events from the same UTC day. Completes if both exist on the same day.',
    eventData: [],
    status: 'implemented',
  },
  {
    name: 'Volume Builder',
    level: 2,
    levelName: 'Gamma',
    category: 'elite',
    xp: 750,
    description: 'Trade $1,000 in total volume',
    eventType: 'trade_completed',
    trackingLogic: 'Checked against users.total_volume_usd >= 1000',
    eventData: ['volume_usd'],
    status: 'implemented',
  },
  {
    name: 'Rising Star',
    level: 2,
    levelName: 'Gamma',
    category: 'elite',
    xp: 600,
    description: 'Complete a trade worth $500+',
    eventType: 'trade_completed',
    trackingLogic: 'Checked if event_data.volume_usd >= 500',
    eventData: ['volume_usd'],
    status: 'implemented',
  },
  {
    name: 'Night Owl',
    level: 2,
    levelName: 'Gamma',
    category: 'wildcard',
    xp: 200,
    description: 'Complete a trade between 3-5 AM UTC',
    eventType: 'trade_completed',
    trackingLogic: 'Checked if current UTC hour is >= 3 and < 5 when trade is completed',
    eventData: [],
    status: 'implemented',
  },
  {
    name: 'Deja Vu',
    level: 2,
    levelName: 'Gamma',
    category: 'wildcard',
    xp: 100,
    description: 'Create a duplicate order with the same sell token, buy tokens, and sell amount',
    eventType: 'order_created',
    trackingLogic: 'On order_created: queries all previous order_created events for this user. Checks if any prior event has the same sell_token, buy_tokens (JSON), and sell_amount. If a match exists, challenge is completed.',
    eventData: ['sell_token', 'buy_tokens', 'sell_amount'],
    status: 'implemented',
  },

  // Delta (Level 3)
  {
    name: 'Token Diversity',
    level: 3,
    levelName: 'Delta',
    category: 'bootcamp',
    xp: 500,
    description: 'Trade 10 different tokens',
    eventType: 'trade_completed',
    trackingLogic: 'Count unique tokens from trade_completed events >= 10',
    eventData: ['sell_token', 'buy_token'],
    status: 'implemented',
  },
  {
    name: 'Market Regular',
    level: 3,
    levelName: 'Delta',
    category: 'bootcamp',
    xp: 300,
    description: 'View 100 different orders',
    eventType: 'order_viewed',
    trackingLogic: 'Count unique order_id from order_viewed events >= 100',
    eventData: ['order_id'],
    status: 'implemented',
  },
  {
    name: 'Order Machine',
    level: 3,
    levelName: 'Delta',
    category: 'operations',
    xp: 800,
    description: 'Create 25 orders',
    eventType: 'order_created',
    trackingLogic: 'Checked against users.total_orders_created >= 25',
    eventData: [],
    status: 'implemented',
  },
  {
    name: 'Fill Expert',
    level: 3,
    levelName: 'Delta',
    category: 'operations',
    xp: 800,
    description: 'Fill 25 orders',
    eventType: 'order_filled',
    trackingLogic: 'Checked against users.total_orders_filled >= 25',
    eventData: [],
    status: 'implemented',
  },
  {
    name: 'Dedicated',
    level: 3,
    levelName: 'Delta',
    category: 'operations',
    xp: 600,
    description: 'Trade 7 days in a row',
    eventType: 'trade_completed',
    trackingLogic: 'Checked against users.current_streak_days >= 7',
    eventData: [],
    status: 'implemented',
  },
  {
    name: 'The Collector',
    level: 3,
    levelName: 'Delta',
    category: 'operations',
    xp: 600,
    description: 'Claim proceeds from 10 different orders',
    eventType: 'proceeds_claimed',
    trackingLogic: 'Count unique order_id values from all proceeds_claimed events for the user. Completes when count >= 10.',
    eventData: ['order_id'],
    status: 'implemented',
  },
  {
    name: 'Clean Sweep',
    level: 3,
    levelName: 'Delta',
    category: 'operations',
    xp: 800,
    description: 'Have 5 orders fully filled as the maker',
    eventType: 'trade_completed',
    trackingLogic: 'Count trade_completed events where is_maker === true AND order_completed === true. Completes when count >= 5.',
    eventData: ['is_maker', 'order_completed'],
    status: 'implemented',
  },
  {
    name: 'Big Spender',
    level: 3,
    levelName: 'Delta',
    category: 'elite',
    xp: 1200,
    description: 'Complete a trade worth $1,000+',
    eventType: 'trade_completed',
    trackingLogic: 'Checked if event_data.volume_usd >= 1000',
    eventData: ['volume_usd'],
    status: 'implemented',
  },
  {
    name: 'Indecisive',
    level: 3,
    levelName: 'Delta',
    category: 'wildcard',
    xp: 100,
    description: 'Cancel 5 orders in one day',
    eventType: 'order_cancelled',
    trackingLogic: 'Count order_cancelled events for user within current UTC day >= 5',
    eventData: ['order_id'],
    status: 'implemented',
  },
  {
    name: 'Ghost Order',
    level: 3,
    levelName: 'Delta',
    category: 'wildcard',
    xp: 75,
    description: 'Have an order expire without any fills',
    eventType: 'order_expired',
    trackingLogic: 'Triggered when batch cancelling expired orders. Checked if fill_percentage === 0',
    eventData: ['order_id', 'fill_percentage'],
    status: 'implemented',
  },
  {
    name: 'Early Bird',
    level: 3,
    levelName: 'Delta',
    category: 'wildcard',
    xp: 250,
    description: 'Complete a trade at midnight UTC (hour 0)',
    eventType: 'trade_completed',
    trackingLogic: 'Checked if current UTC hour === 0 when the trade_completed event is recorded.',
    eventData: [],
    status: 'implemented',
  },

  // Epsilon (Level 4)
  {
    name: 'Token Collector',
    level: 4,
    levelName: 'Epsilon',
    category: 'bootcamp',
    xp: 800,
    description: 'Trade 20 different tokens',
    eventType: 'trade_completed',
    trackingLogic: 'Count unique tokens from trade_completed events >= 20',
    eventData: ['sell_token', 'buy_token'],
    status: 'implemented',
  },
  {
    name: 'HEX Enthusiast',
    level: 4,
    levelName: 'Epsilon',
    category: 'bootcamp',
    xp: 600,
    description: 'Trade 100,000 HEX total',
    eventType: 'trade_completed',
    trackingLogic: 'Sum all HEX amounts from sell_amount and buy_amount where token is HEX >= 100000',
    eventData: ['sell_token', 'buy_token', 'sell_amount', 'buy_amount'],
    status: 'implemented',
  },
  {
    name: 'Veteran Trader',
    level: 4,
    levelName: 'Epsilon',
    category: 'operations',
    xp: 1500,
    description: 'Complete 50 trades total',
    eventType: 'trade_completed',
    trackingLogic: 'Checked against users.total_trades >= 50',
    eventData: [],
    status: 'implemented',
  },
  {
    name: 'Order Veteran',
    level: 4,
    levelName: 'Epsilon',
    category: 'operations',
    xp: 1200,
    description: 'Create 50 orders',
    eventType: 'order_created',
    trackingLogic: 'Checked against users.total_orders_created >= 50',
    eventData: [],
    status: 'implemented',
  },
  {
    name: 'Two Week Warrior',
    level: 4,
    levelName: 'Epsilon',
    category: 'operations',
    xp: 1000,
    description: 'Trade 14 days in a row',
    eventType: 'trade_completed',
    trackingLogic: 'Checked against users.current_streak_days >= 14',
    eventData: [],
    status: 'implemented',
  },
  {
    name: 'Arbitrage Artist',
    level: 4,
    levelName: 'Epsilon',
    category: 'operations',
    xp: 1000,
    description: 'Fill an order then create your own within 2 minutes',
    eventType: 'order_created',
    trackingLogic: 'On order_created: queries order_filled events for the user within the last 120 seconds. If any exist, challenge is completed.',
    eventData: [],
    status: 'implemented',
  },
  {
    name: 'Perfect Record',
    level: 4,
    levelName: 'Epsilon',
    category: 'operations',
    xp: 1500,
    description: 'Complete 10 trades without ever cancelling an order',
    eventType: 'trade_completed',
    trackingLogic: 'Checked if users.total_trades >= 10 AND users.total_orders_cancelled === 0. Both conditions must be true simultaneously.',
    eventData: [],
    status: 'implemented',
  },
  {
    name: 'Volume Veteran',
    level: 4,
    levelName: 'Epsilon',
    category: 'elite',
    xp: 2000,
    description: 'Trade $10,000 in total volume',
    eventType: 'trade_completed',
    trackingLogic: 'Checked against users.total_volume_usd >= 10000',
    eventData: ['volume_usd'],
    status: 'implemented',
  },
  {
    name: 'Iron Hands',
    level: 4,
    levelName: 'Epsilon',
    category: 'elite',
    xp: 1500,
    description: 'Claim proceeds from an order that was open for 30+ days',
    eventType: 'proceeds_claimed',
    trackingLogic: 'On proceeds_claimed: looks up the original order_created event for the same order_id. Calculates the age difference in days. Completes if age >= 30 days.',
    eventData: ['order_id'],
    status: 'implemented',
  },
  {
    name: 'Speed Runner',
    level: 4,
    levelName: 'Epsilon',
    category: 'wildcard',
    xp: 400,
    description: 'Have your order filled within 30 seconds of creating it',
    eventType: 'order_filled',
    trackingLogic: 'Checked if event_data.fill_time_seconds <= 30',
    eventData: ['fill_time_seconds'],
    status: 'implemented',
  },
  {
    name: 'Penny Pincher',
    level: 4,
    levelName: 'Epsilon',
    category: 'wildcard',
    xp: 200,
    description: 'Complete 10 trades each worth less than $1',
    eventType: 'trade_completed',
    trackingLogic: 'Count all trade_completed events for user where event_data.volume_usd < 1 and volume_usd > 0. Completes when count >= 10.',
    eventData: ['volume_usd'],
    status: 'implemented',
  },

  // Zeta (Level 5)
  {
    name: 'Diversified',
    level: 5,
    levelName: 'Zeta',
    category: 'bootcamp',
    xp: 1200,
    description: 'Trade 30 different tokens',
    eventType: 'trade_completed',
    trackingLogic: 'Count unique tokens from trade_completed events >= 30',
    eventData: ['sell_token', 'buy_token'],
    status: 'implemented',
  },
  {
    name: 'PLS Stacker',
    level: 5,
    levelName: 'Zeta',
    category: 'bootcamp',
    xp: 1000,
    description: 'Trade 1,000,000 PLS total',
    eventType: 'trade_completed',
    trackingLogic: 'Sum all PLS/WPLS amounts from trades >= 1000000',
    eventData: ['sell_token', 'buy_token', 'sell_amount', 'buy_amount'],
    status: 'implemented',
  },
  {
    name: 'Century Trader',
    level: 5,
    levelName: 'Zeta',
    category: 'operations',
    xp: 3000,
    description: 'Complete 100 trades total',
    eventType: 'trade_completed',
    trackingLogic: 'Checked against users.total_trades >= 100',
    eventData: [],
    status: 'implemented',
  },
  {
    name: 'Order Legend',
    level: 5,
    levelName: 'Zeta',
    category: 'operations',
    xp: 2500,
    description: 'Create 100 orders',
    eventType: 'order_created',
    trackingLogic: 'Checked against users.total_orders_created >= 100',
    eventData: [],
    status: 'implemented',
  },
  {
    name: 'Market Maker',
    level: 5,
    levelName: 'Zeta',
    category: 'operations',
    xp: 1500,
    description: 'Have 5 active orders at once',
    eventType: 'trade_completed',
    trackingLogic: 'Checked against users.current_active_orders >= 5',
    eventData: [],
    status: 'implemented',
  },
  {
    name: 'AON Champion',
    level: 5,
    levelName: 'Zeta',
    category: 'operations',
    xp: 2500,
    description: 'Complete 3 all-or-nothing orders as maker',
    eventType: 'trade_completed',
    trackingLogic: 'Count trade_completed events where is_maker === true AND order_completed === true AND is_all_or_nothing === true. Completes when count >= 3.',
    eventData: ['is_maker', 'order_completed', 'is_all_or_nothing'],
    status: 'implemented',
  },
  {
    name: 'Claim Machine',
    level: 5,
    levelName: 'Zeta',
    category: 'operations',
    xp: 2000,
    description: 'Claim proceeds 50 times total',
    eventType: 'proceeds_claimed',
    trackingLogic: 'Count total proceeds_claimed events for the user. Completes when count >= 50.',
    eventData: ['order_id'],
    status: 'implemented',
  },
  {
    name: 'Whale Alert',
    level: 5,
    levelName: 'Zeta',
    category: 'elite',
    xp: 4000,
    description: 'Complete a trade worth $10,000+',
    eventType: 'trade_completed',
    trackingLogic: 'Checked if event_data.volume_usd >= 10000',
    eventData: ['volume_usd'],
    status: 'implemented',
  },
  {
    name: 'HEX Baron',
    level: 5,
    levelName: 'Zeta',
    category: 'elite',
    xp: 3000,
    description: 'Trade 1,000,000 HEX total',
    eventType: 'trade_completed',
    trackingLogic: 'Sum all HEX amounts from trade_completed events where sell_token or buy_token is HEX. Adds sell_amount when selling HEX, buy_amount when buying HEX. Completes when total >= 1,000,000.',
    eventData: ['sell_token', 'buy_token', 'sell_amount', 'buy_amount'],
    status: 'implemented',
  },
  {
    name: 'Fatfinger',
    level: 5,
    levelName: 'Zeta',
    category: 'wildcard',
    xp: 150,
    description: 'Create an order above market price',
    eventType: 'order_created',
    trackingLogic: 'Checked if price_vs_market_percent > 0 (any amount above market)',
    eventData: ['price_vs_market_percent'],
    status: 'implemented',
  },
  {
    name: 'Dip Catcher',
    level: 5,
    levelName: 'Zeta',
    category: 'wildcard',
    xp: 150,
    description: 'Create an order 50% below market price',
    eventType: 'order_created',
    trackingLogic: 'Checked if price_vs_market_percent <= -50',
    eventData: ['price_vs_market_percent'],
    status: 'implemented',
  },
  {
    name: 'Order Hoarder',
    level: 5,
    levelName: 'Zeta',
    category: 'wildcard',
    xp: 300,
    description: 'Have 15 open unfilled orders at once',
    eventType: 'order_created',
    trackingLogic: 'On order_created: counts all order_created events minus order_cancelled, order_expired, and fully completed orders. Completes when active unfilled count >= 15.',
    eventData: [],
    status: 'implemented',
  },
  {
    name: 'Ghost Town',
    level: 5,
    levelName: 'Zeta',
    category: 'wildcard',
    xp: 200,
    description: 'Have 5 orders expire with 0% filled',
    eventType: 'order_expired',
    trackingLogic: 'Count order_expired events where fill_percentage === 0. Completes when count >= 5.',
    eventData: ['order_id', 'fill_percentage'],
    status: 'implemented',
  },

  // Eta (Level 6)
  {
    name: 'Token Master',
    level: 6,
    levelName: 'Eta',
    category: 'bootcamp',
    xp: 2000,
    description: 'Trade 40 different tokens',
    eventType: 'trade_completed',
    trackingLogic: 'Count unique tokens from trade_completed events >= 40',
    eventData: ['sell_token', 'buy_token'],
    status: 'implemented',
  },
  {
    name: 'Ethereum Maxi',
    level: 6,
    levelName: 'Eta',
    category: 'bootcamp',
    xp: 1500,
    description: 'Trade wrapped Ethereum tokens (weHEX, etc.)',
    eventType: 'trade_completed',
    trackingLogic: 'Checked if any traded token starts with "WE" (wrapped Ethereum)',
    eventData: ['sell_token', 'buy_token'],
    status: 'implemented',
  },
  {
    name: 'Fill Master',
    level: 6,
    levelName: 'Eta',
    category: 'operations',
    xp: 5000,
    description: 'Fill 200 orders',
    eventType: 'order_filled',
    trackingLogic: 'Checked against users.total_orders_filled >= 200',
    eventData: [],
    status: 'implemented',
  },
  {
    name: 'Power Maker',
    level: 6,
    levelName: 'Eta',
    category: 'operations',
    xp: 2500,
    description: 'Have 10 active orders at once',
    eventType: 'trade_completed',
    trackingLogic: 'Checked against users.current_active_orders >= 10',
    eventData: [],
    status: 'implemented',
  },
  {
    name: 'Multi-Fill',
    level: 6,
    levelName: 'Eta',
    category: 'operations',
    xp: 3000,
    description: 'Have a single order filled by 5 different wallets',
    eventType: 'trade_completed',
    trackingLogic: 'On trade_completed where is_maker === true: queries all trade_completed events for the same order_id and extracts unique filler_wallet addresses. Completes when any single order has >= 5 unique fillers.',
    eventData: ['order_id', 'is_maker', 'filler_wallet'],
    status: 'implemented',
  },
  {
    name: 'Volume King',
    level: 6,
    levelName: 'Eta',
    category: 'elite',
    xp: 8000,
    description: 'Trade $100,000 in total volume',
    eventType: 'trade_completed',
    trackingLogic: 'Checked against users.total_volume_usd >= 100000',
    eventData: ['volume_usd'],
    status: 'implemented',
  },
  {
    name: 'Diamond Hands',
    level: 6,
    levelName: 'Eta',
    category: 'elite',
    xp: 5000,
    description: 'Claim proceeds from an order that was open for 90+ days',
    eventType: 'proceeds_claimed',
    trackingLogic: 'On proceeds_claimed: looks up the original order_created event for the same order_id. Calculates the age difference in days. Completes if age >= 90 days.',
    eventData: ['order_id'],
    status: 'implemented',
  },
  {
    name: 'PLS Baron',
    level: 6,
    levelName: 'Eta',
    category: 'elite',
    xp: 3000,
    description: 'Trade 10,000,000 PLS total',
    eventType: 'trade_completed',
    trackingLogic: 'Sum all PLS/WPLS amounts from trade_completed events. Adds sell_amount when selling PLS/WPLS, buy_amount when buying PLS/WPLS. Completes when total >= 10,000,000.',
    eventData: ['sell_token', 'buy_token', 'sell_amount', 'buy_amount'],
    status: 'implemented',
  },

  // Theta (Level 7)
  {
    name: 'Token Legend',
    level: 7,
    levelName: 'Theta',
    category: 'bootcamp',
    xp: 3000,
    description: 'Trade 50 different tokens',
    eventType: 'trade_completed',
    trackingLogic: 'Count unique tokens from trade_completed events >= 50',
    eventData: ['sell_token', 'buy_token'],
    status: 'implemented',
  },
  {
    name: 'MAXI Maxi',
    level: 7,
    levelName: 'Theta',
    category: 'bootcamp',
    xp: 2000,
    description: 'Trade any MAXI token',
    eventType: 'trade_completed',
    trackingLogic: 'Checked if any traded token contains "MAXI"',
    eventData: ['sell_token', 'buy_token'],
    status: 'implemented',
  },
  {
    name: 'Bond Trader',
    level: 7,
    levelName: 'Theta',
    category: 'bootcamp',
    xp: 2000,
    description: 'Make an order with HTT (Hedron T-Share Token)',
    eventType: 'order_created',
    trackingLogic: 'Checked if sell_token or any buy_token is HTT',
    eventData: ['sell_token', 'buy_tokens'],
    status: 'implemented',
  },
  {
    name: 'Coupon Clipper',
    level: 7,
    levelName: 'Theta',
    category: 'bootcamp',
    xp: 2000,
    description: 'Make an order with COM (Community Token)',
    eventType: 'order_created',
    trackingLogic: 'Checked if sell_token or any buy_token is COM',
    eventData: ['sell_token', 'buy_tokens'],
    status: 'implemented',
  },
  {
    name: '$1 Inevitable',
    level: 7,
    levelName: 'Theta',
    category: 'bootcamp',
    xp: 2000,
    description: 'Make an order with pDAI',
    eventType: 'order_created',
    trackingLogic: 'Checked if sell_token or any buy_token is pDAI (Pulsechain DAI)',
    eventData: ['sell_token', 'buy_tokens'],
    status: 'implemented',
  },
  {
    name: 'Trade Machine',
    level: 7,
    levelName: 'Theta',
    category: 'operations',
    xp: 10000,
    description: 'Complete 500 trades total',
    eventType: 'trade_completed',
    trackingLogic: 'Checked against users.total_trades >= 500',
    eventData: [],
    status: 'implemented',
  },
  {
    name: 'Order God',
    level: 7,
    levelName: 'Theta',
    category: 'operations',
    xp: 8000,
    description: 'Create 500 orders',
    eventType: 'order_created',
    trackingLogic: 'Checked against users.total_orders_created >= 500',
    eventData: [],
    status: 'implemented',
  },
  {
    name: 'Full House',
    level: 7,
    levelName: 'Theta',
    category: 'operations',
    xp: 5000,
    description: 'Have 3 partially filled orders still active',
    eventType: 'trade_completed',
    trackingLogic: 'On trade_completed where is_maker === true AND order_completed === false: counts all such events with unique order_ids (partially filled but not completed). Completes when >= 3 unique partially filled active orders.',
    eventData: ['is_maker', 'order_completed', 'order_id'],
    status: 'implemented',
  },
  {
    name: 'Mega Whale',
    level: 7,
    levelName: 'Theta',
    category: 'elite',
    xp: 20000,
    description: 'Complete a trade worth $100,000+',
    eventType: 'trade_completed',
    trackingLogic: 'Checked if event_data.volume_usd >= 100000',
    eventData: ['volume_usd'],
    status: 'implemented',
  },
  {
    name: 'Stablecoin Baron',
    level: 7,
    levelName: 'Theta',
    category: 'elite',
    xp: 5000,
    description: 'Trade 100,000 in stablecoins total (DAI, USDC, USDT, USDL)',
    eventType: 'trade_completed',
    trackingLogic: 'Sum all stablecoin amounts from trade_completed events. Checks if sell_token or buy_token is DAI, USDC, USDT, or USDL. Adds the corresponding amount. Completes when total >= 100,000.',
    eventData: ['sell_token', 'buy_token', 'sell_amount', 'buy_amount'],
    status: 'implemented',
  },
  {
    name: 'Profit Master',
    level: 7,
    levelName: 'Theta',
    category: 'elite',
    xp: 12000,
    description: 'Claim proceeds 100 times total',
    eventType: 'proceeds_claimed',
    trackingLogic: 'Count total proceeds_claimed events for the user. Completes when count >= 100.',
    eventData: ['order_id'],
    status: 'implemented',
  },
  {
    name: 'Total Chaos',
    level: 7,
    levelName: 'Theta',
    category: 'wildcard',
    xp: 500,
    description: 'Cancel 20 orders in one day',
    eventType: 'order_cancelled',
    trackingLogic: 'Count order_cancelled events for user within current UTC day >= 20',
    eventData: ['order_id'],
    status: 'implemented',
  },

  // Omega (Level 8)
  {
    name: 'Token God',
    level: 8,
    levelName: 'Omega',
    category: 'bootcamp',
    xp: 5000,
    description: 'Trade 75 different tokens',
    eventType: 'trade_completed',
    trackingLogic: 'Count unique tokens from trade_completed events >= 75',
    eventData: ['sell_token', 'buy_token'],
    status: 'implemented',
  },
  {
    name: 'Trade Legend',
    level: 8,
    levelName: 'Omega',
    category: 'operations',
    xp: 25000,
    description: 'Complete 1,000 trades total',
    eventType: 'trade_completed',
    trackingLogic: 'Checked against users.total_trades >= 1000',
    eventData: [],
    status: 'implemented',
  },
  {
    name: 'Order Immortal',
    level: 8,
    levelName: 'Omega',
    category: 'operations',
    xp: 20000,
    description: 'Create 1,000 orders',
    eventType: 'order_created',
    trackingLogic: 'Checked against users.total_orders_created >= 1000',
    eventData: [],
    status: 'implemented',
  },
  {
    name: 'Domination',
    level: 8,
    levelName: 'Omega',
    category: 'operations',
    xp: 5000,
    description: 'Have 20 active orders at once',
    eventType: 'trade_completed',
    trackingLogic: 'Checked against users.current_active_orders >= 20',
    eventData: [],
    status: 'implemented',
  },
  {
    name: 'Volume God',
    level: 8,
    levelName: 'Omega',
    category: 'elite',
    xp: 50000,
    description: 'Trade $1,000,000 in total volume',
    eventType: 'trade_completed',
    trackingLogic: 'Checked against users.total_volume_usd >= 1000000',
    eventData: ['volume_usd'],
    status: 'implemented',
  },
  {
    name: 'Leviathan',
    level: 8,
    levelName: 'Omega',
    category: 'elite',
    xp: 75000,
    description: 'Complete a trade worth $500,000+',
    eventType: 'trade_completed',
    trackingLogic: 'Checked if event_data.volume_usd >= 500000',
    eventData: ['volume_usd'],
    status: 'implemented',
  },
  {
    name: 'Sniper',
    level: 8,
    levelName: 'Omega',
    category: 'wildcard',
    xp: 2000,
    description: 'Fill an order within 1 minute of it being created',
    eventType: 'order_filled',
    trackingLogic: 'Checked if event_data.fill_time_seconds <= 60',
    eventData: ['fill_time_seconds'],
    status: 'implemented',
  },
];

const LEVEL_COLORS: Record<string, string> = {
  'Alpha': 'text-rose-400 bg-rose-500/20',
  'Beta': 'text-orange-400 bg-orange-500/20',
  'Gamma': 'text-lime-400 bg-lime-500/20',
  'Delta': 'text-emerald-400 bg-emerald-500/20',
  'Epsilon': 'text-cyan-400 bg-cyan-500/20',
  'Zeta': 'text-blue-400 bg-blue-500/20',
  'Eta': 'text-violet-400 bg-violet-500/20',
  'Theta': 'text-fuchsia-400 bg-fuchsia-500/20',
  'Omega': 'text-yellow-400 bg-yellow-500/20',
};

const STATUS_COLORS: Record<string, string> = {
  'implemented': 'bg-green-500/20 text-green-400 border-green-500/30',
  'partial': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  'needs-work': 'bg-red-500/20 text-red-400 border-red-500/30',
};

export default function ChallengeAdminPage() {
  const [filterLevel, setFilterLevel] = useState<number | null>(null);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredChallenges = CHALLENGE_DOCS.filter(challenge => {
    if (filterLevel !== null && challenge.level !== filterLevel) return false;
    if (filterStatus && challenge.status !== filterStatus) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        challenge.name.toLowerCase().includes(query) ||
        challenge.description.toLowerCase().includes(query) ||
        challenge.eventType.toLowerCase().includes(query) ||
        challenge.trackingLogic.toLowerCase().includes(query)
      );
    }
    return true;
  });

  const levels = [...new Set(CHALLENGE_DOCS.map(c => c.level))].sort((a, b) => a - b);

  // Stats
  const totalChallenges = CHALLENGE_DOCS.length;
  const implementedCount = CHALLENGE_DOCS.filter(c => c.status === 'implemented').length;
  const partialCount = CHALLENGE_DOCS.filter(c => c.status === 'partial').length;
  const needsWorkCount = CHALLENGE_DOCS.filter(c => c.status === 'needs-work').length;

  return (
    <main className="flex min-h-screen flex-col items-center relative overflow-hidden">
      {/* Animated background */}
      <div className="fixed inset-0 z-0">
        <PixelBlastBackground />
      </div>

      {/* Main Content */}
      <div className="w-full px-4 md:px-8 mt-20 mb-12 relative z-10">
        <div className="max-w-[1400px] mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <h1 className="text-3xl font-bold text-white mb-2">Challenge Tracking Documentation</h1>
            <p className="text-gray-400">
              Technical reference for how each prestige challenge is tracked and verified.
            </p>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-8"
          >
            <LiquidGlassCard shadowIntensity="sm" glowIntensity="sm" blurIntensity="xl" className="p-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <div className="text-3xl font-bold text-white">{totalChallenges}</div>
                  <div className="text-gray-400 text-sm">Total Challenges</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-green-400">{implementedCount}</div>
                  <div className="text-gray-400 text-sm">Implemented</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-yellow-400">{partialCount}</div>
                  <div className="text-gray-400 text-sm">Partial</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-red-400">{needsWorkCount}</div>
                  <div className="text-gray-400 text-sm">Needs Work</div>
                </div>
              </div>
            </LiquidGlassCard>
          </motion.div>

          {/* XP & Progression System */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="mb-8 space-y-6"
          >
            {/* Action XP Rewards */}
            <LiquidGlassCard shadowIntensity="sm" glowIntensity="sm" blurIntensity="xl" className="p-6">
              <h2 className="text-xl font-semibold text-white mb-4">Action XP Rewards</h2>
              <p className="text-gray-400 text-sm mb-4">
                Every action earns XP. Combined with challenge completions, you need to reach the XP threshold to advance.
              </p>

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div className="p-4 bg-white/5 rounded-lg">
                  <div className="text-2xl font-bold text-green-400 mb-1">+20 XP</div>
                  <div className="text-white font-medium">Create Order</div>
                  <div className="text-gray-500 text-xs mt-1">Each order you create</div>
                </div>
                <div className="p-4 bg-white/5 rounded-lg">
                  <div className="text-2xl font-bold text-blue-400 mb-1">+25 XP</div>
                  <div className="text-white font-medium">Fill Order</div>
                  <div className="text-gray-500 text-xs mt-1">Each order you fill</div>
                </div>
                <div className="p-4 bg-white/5 rounded-lg">
                  <div className="text-2xl font-bold text-cyan-400 mb-1">+30 XP</div>
                  <div className="text-white font-medium">Order Filled (Maker)</div>
                  <div className="text-gray-500 text-xs mt-1">When someone fills your order</div>
                </div>
                <div className="p-4 bg-white/5 rounded-lg">
                  <div className="text-2xl font-bold text-purple-400 mb-1">+10 XP</div>
                  <div className="text-white font-medium">Claim Proceeds</div>
                  <div className="text-gray-500 text-xs mt-1">Each time you claim</div>
                </div>
              </div>

              <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                <div className="text-amber-400 font-medium text-sm">Volume Bonus</div>
                <div className="text-gray-400 text-xs mt-1">
                  +1 XP per $10 USD traded (capped at +100 XP per trade). A $500 trade = +50 bonus XP.
                </div>
              </div>
            </LiquidGlassCard>

            {/* Legion Requirements */}
            <LiquidGlassCard shadowIntensity="sm" glowIntensity="sm" blurIntensity="xl" className="p-6">
              <h2 className="text-xl font-semibold text-white mb-4">Legion Progression Requirements</h2>
              <p className="text-gray-400 text-sm mb-4">
                To advance to the next legion, you need <span className="text-white">BOTH</span>: complete all challenges in your current level <span className="text-white">AND</span> reach the XP threshold.
              </p>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left py-3 text-white/60">From → To</th>
                      <th className="text-right py-3 text-white/60">XP Required</th>
                      <th className="text-right py-3 text-white/60">Challenges</th>
                      <th className="text-right py-3 text-white/60">Challenge XP</th>
                      <th className="text-right py-3 text-white/60">Gap to Fill</th>
                      <th className="text-left py-3 pl-4 text-white/60">Rough Estimate to Fill Gap</th>
                    </tr>
                  </thead>
                  <tbody className="text-white/70">
                    <tr className="border-b border-white/5">
                      <td className="py-3"><span className="text-rose-400">α Alpha</span> → <span className="text-orange-400">β Beta</span></td>
                      <td className="py-3 text-right text-amber-400 font-mono">1,500</td>
                      <td className="py-3 text-right">6</td>
                      <td className="py-3 text-right font-mono">1,000</td>
                      <td className="py-3 text-right text-cyan-400 font-mono">500</td>
                      <td className="py-3 pl-4 text-gray-400 text-xs">~10 orders created + 8 fills</td>
                    </tr>
                    <tr className="border-b border-white/5">
                      <td className="py-3"><span className="text-orange-400">β Beta</span> → <span className="text-lime-400">γ Gamma</span></td>
                      <td className="py-3 text-right text-amber-400 font-mono">4,000</td>
                      <td className="py-3 text-right">7</td>
                      <td className="py-3 text-right font-mono">1,925</td>
                      <td className="py-3 text-right text-cyan-400 font-mono">2,075</td>
                      <td className="py-3 pl-4 text-gray-400 text-xs">~30 orders + 30 fills + $500 volume</td>
                    </tr>
                    <tr className="border-b border-white/5">
                      <td className="py-3"><span className="text-lime-400">γ Gamma</span> → <span className="text-emerald-400">δ Delta</span></td>
                      <td className="py-3 text-right text-amber-400 font-mono">10,000</td>
                      <td className="py-3 text-right">9</td>
                      <td className="py-3 text-right font-mono">3,650</td>
                      <td className="py-3 text-right text-cyan-400 font-mono">6,350</td>
                      <td className="py-3 pl-4 text-gray-400 text-xs">~80 orders + 80 fills + $2K volume</td>
                    </tr>
                    <tr className="border-b border-white/5">
                      <td className="py-3"><span className="text-emerald-400">δ Delta</span> → <span className="text-cyan-400">ε Epsilon</span></td>
                      <td className="py-3 text-right text-amber-400 font-mono">25,000</td>
                      <td className="py-3 text-right">11</td>
                      <td className="py-3 text-right font-mono">6,475</td>
                      <td className="py-3 text-right text-cyan-400 font-mono">18,525</td>
                      <td className="py-3 pl-4 text-gray-400 text-xs">~200 orders + 200 fills + $10K volume</td>
                    </tr>
                    <tr className="border-b border-white/5">
                      <td className="py-3"><span className="text-cyan-400">ε Epsilon</span> → <span className="text-blue-400">ζ Zeta</span></td>
                      <td className="py-3 text-right text-amber-400 font-mono">60,000</td>
                      <td className="py-3 text-right">12</td>
                      <td className="py-3 text-right font-mono">11,500</td>
                      <td className="py-3 text-right text-cyan-400 font-mono">48,500</td>
                      <td className="py-3 pl-4 text-gray-400 text-xs">~500 orders + 500 fills + $50K volume</td>
                    </tr>
                    <tr className="border-b border-white/5">
                      <td className="py-3"><span className="text-blue-400">ζ Zeta</span> → <span className="text-violet-400">η Eta</span></td>
                      <td className="py-3 text-right text-amber-400 font-mono">150,000</td>
                      <td className="py-3 text-right">14</td>
                      <td className="py-3 text-right font-mono">23,900</td>
                      <td className="py-3 text-right text-cyan-400 font-mono">126,100</td>
                      <td className="py-3 pl-4 text-gray-400 text-xs">~1K orders + 1K fills + $200K volume</td>
                    </tr>
                    <tr className="border-b border-white/5">
                      <td className="py-3"><span className="text-violet-400">η Eta</span> → <span className="text-fuchsia-400">θ Theta</span></td>
                      <td className="py-3 text-right text-amber-400 font-mono">400,000</td>
                      <td className="py-3 text-right">8</td>
                      <td className="py-3 text-right font-mono">27,000</td>
                      <td className="py-3 text-right text-cyan-400 font-mono">373,000</td>
                      <td className="py-3 pl-4 text-gray-400 text-xs">~2K orders + 2K fills + $500K volume</td>
                    </tr>
                    <tr className="border-b border-white/5">
                      <td className="py-3"><span className="text-fuchsia-400">θ Theta</span> → <span className="text-yellow-400">Ω Omega</span></td>
                      <td className="py-3 text-right text-amber-400 font-mono">1,000,000</td>
                      <td className="py-3 text-right">13</td>
                      <td className="py-3 text-right font-mono">73,000</td>
                      <td className="py-3 text-right text-cyan-400 font-mono">927,000</td>
                      <td className="py-3 pl-4 text-gray-400 text-xs">~5K orders + 5K fills + $2M volume</td>
                    </tr>
                    <tr className="font-medium bg-yellow-500/5">
                      <td className="py-3"><span className="text-yellow-400">Ω Omega</span> (Final)</td>
                      <td className="py-3 text-right text-yellow-400 font-mono">∞</td>
                      <td className="py-3 text-right">7</td>
                      <td className="py-3 text-right font-mono">182,000</td>
                      <td className="py-3 text-right text-gray-500">—</td>
                      <td className="py-3 pl-4 text-gray-400 text-xs">Complete all challenges for prestige</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                  <div className="text-emerald-400 font-medium text-sm">XP Calculation Example</div>
                  <div className="text-gray-400 text-xs mt-1">
                    Create 50 orders (50×20=1000) + Fill 40 orders (40×25=1000) + Get 30 fills (30×30=900) + $3K volume bonus (300) = <span className="text-white">3,200 XP</span>
                  </div>
                </div>
                <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                  <div className="text-blue-400 font-medium text-sm">Progression Philosophy</div>
                  <div className="text-gray-400 text-xs mt-1">
                    Early levels (Alpha-Delta) are achievable in days/weeks. Mid levels (Epsilon-Eta) take weeks/months. Top levels (Theta-Omega) are for dedicated traders.
                  </div>
                </div>
              </div>
            </LiquidGlassCard>

            {/* Progress Bar Preview */}
            <LiquidGlassCard shadowIntensity="sm" glowIntensity="sm" blurIntensity="xl" className="p-6">
              <h2 className="text-xl font-semibold text-white mb-4">Progress Bar UI Preview</h2>
              <p className="text-gray-400 text-sm mb-4">
                How the progress bar will look for a user in Beta with 2,800 XP (need 4,000 for Gamma):
              </p>

              <div className="max-w-md">
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-orange-400 font-bold">β</span>
                    <span className="text-white font-medium">Beta Legion</span>
                  </div>
                  <span className="text-gray-400 text-sm">2,800 / 4,000 XP</span>
                </div>
                <div className="h-3 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-orange-500 to-lime-500 rounded-full" style={{ width: '70%' }} />
                </div>
                <div className="flex justify-between mt-2 text-xs">
                  <span className="text-gray-500">5/7 Challenges Complete</span>
                  <span className="text-lime-400">→ Gamma</span>
                </div>
              </div>

              <div className="mt-6 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                <div className="text-red-400 font-medium text-sm">Blocked State</div>
                <div className="text-gray-400 text-xs mt-1">
                  If user has enough XP but hasn&apos;t completed all challenges, show: &quot;Complete 2 more challenges to advance&quot;
                </div>
              </div>
            </LiquidGlassCard>
          </motion.div>

          {/* Filters */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mb-6"
          >
            <LiquidGlassCard shadowIntensity="sm" glowIntensity="sm" blurIntensity="xl" className="p-4">
              <div className="flex flex-wrap gap-4 items-center">
                {/* Search */}
                <input
                  type="text"
                  placeholder="Search challenges..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-white/30 w-full md:w-64"
                />

                {/* Level Filter */}
                <select
                  value={filterLevel ?? ''}
                  onChange={(e) => setFilterLevel(e.target.value ? parseInt(e.target.value) : null)}
                  className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-white/30"
                >
                  <option value="">All Levels</option>
                  {levels.map(level => (
                    <option key={level} value={level}>
                      {['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta', 'Theta', 'Omega'][level]}
                    </option>
                  ))}
                </select>

                {/* Status Filter */}
                <select
                  value={filterStatus ?? ''}
                  onChange={(e) => setFilterStatus(e.target.value || null)}
                  className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-white/30"
                >
                  <option value="">All Status</option>
                  <option value="implemented">Implemented</option>
                  <option value="partial">Partial</option>
                  <option value="needs-work">Needs Work</option>
                </select>

                {/* Clear Filters */}
                {(filterLevel !== null || filterStatus || searchQuery) && (
                  <button
                    onClick={() => {
                      setFilterLevel(null);
                      setFilterStatus(null);
                      setSearchQuery('');
                    }}
                    className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                  >
                    Clear Filters
                  </button>
                )}
              </div>
            </LiquidGlassCard>
          </motion.div>

          {/* Challenge List */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <div className="space-y-4">
              {filteredChallenges.map((challenge, index) => (
                <LiquidGlassCard
                  key={`${challenge.level}-${challenge.name}`}
                  shadowIntensity="sm"
                  glowIntensity="sm"
                  blurIntensity="xl"
                  className="p-4"
                >
                  <div className="flex flex-wrap gap-4 items-start">
                    {/* Challenge Info */}
                    <div className="flex-1 min-w-[300px]">
                      <div className="flex items-center gap-3 mb-2">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${LEVEL_COLORS[challenge.levelName]}`}>
                          {challenge.levelName}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-xs border ${STATUS_COLORS[challenge.status]}`}>
                          {challenge.status}
                        </span>
                        <span className="text-amber-400 font-mono text-sm">+{challenge.xp.toLocaleString()} XP</span>
                      </div>
                      <h3 className="text-lg font-semibold text-white mb-1">{challenge.name}</h3>
                      <p className="text-gray-400 text-sm">{challenge.description}</p>
                    </div>

                    {/* Tracking Details */}
                    <div className="flex-1 min-w-[400px]">
                      <div className="mb-3">
                        <span className="text-gray-500 text-xs uppercase tracking-wide">Event Type</span>
                        <div className="text-cyan-400 font-mono text-sm mt-1">{challenge.eventType}</div>
                      </div>
                      <div className="mb-3">
                        <span className="text-gray-500 text-xs uppercase tracking-wide">Tracking Logic</span>
                        <div className="text-gray-300 text-sm mt-1">{challenge.trackingLogic}</div>
                      </div>
                      {challenge.eventData.length > 0 && (
                        <div>
                          <span className="text-gray-500 text-xs uppercase tracking-wide">Required Event Data</span>
                          <div className="flex flex-wrap gap-2 mt-1">
                            {challenge.eventData.map((data, i) => (
                              <span key={i} className="px-2 py-0.5 bg-white/5 rounded text-xs text-gray-300 font-mono">
                                {data}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </LiquidGlassCard>
              ))}
            </div>

            {filteredChallenges.length === 0 && (
              <div className="text-center text-gray-400 py-12">
                No challenges match your filters.
              </div>
            )}
          </motion.div>

          {/* Event Types Reference */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mt-12"
          >
            <h2 className="text-2xl font-bold text-white mb-4">Event Types Reference</h2>
            <LiquidGlassCard shadowIntensity="sm" glowIntensity="sm" blurIntensity="xl" className="p-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <h3 className="text-lg font-semibold text-white mb-3">Core Events</h3>
                  <ul className="space-y-2 text-sm">
                    <li><code className="text-cyan-400">wallet_connected</code> - First wallet connection (deduplicated)</li>
                    <li><code className="text-cyan-400">order_created</code> - New limit order created</li>
                    <li><code className="text-cyan-400">order_filled</code> - Order partially or fully filled</li>
                    <li><code className="text-cyan-400">order_cancelled</code> - Order manually cancelled</li>
                    <li><code className="text-cyan-400">order_expired</code> - Order expired and batch cancelled</li>
                    <li><code className="text-cyan-400">trade_completed</code> - Full trade transaction completed</li>
                    <li><code className="text-cyan-400">proceeds_claimed</code> - Collected proceeds from filled orders</li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white mb-3">View Events</h3>
                  <ul className="space-y-2 text-sm">
                    <li><code className="text-cyan-400">order_viewed</code> - Expanded an order in marketplace</li>
                    <li><code className="text-cyan-400">chart_viewed</code> - Viewed price chart</li>
                    <li><code className="text-cyan-400">marketplace_visited</code> - Visited marketplace (deduplicated)</li>
                  </ul>
                </div>
              </div>
            </LiquidGlassCard>
          </motion.div>

          {/* API Endpoint Info */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mt-8"
          >
            <h2 className="text-2xl font-bold text-white mb-4">API Endpoint</h2>
            <LiquidGlassCard shadowIntensity="sm" glowIntensity="sm" blurIntensity="xl" className="p-6">
              <div className="font-mono text-sm">
                <div className="text-gray-400 mb-2">POST /api/events/track</div>
                <pre className="bg-black/30 p-4 rounded-lg overflow-x-auto text-gray-300">
{`{
  "wallet_address": "0x...",
  "event_type": "trade_completed",
  "event_data": {
    "order_id": 123,
    "sell_token": "HEX",
    "buy_token": "PLS",
    "volume_usd": 1500.50,
    "is_maker": false
  }
}`}
                </pre>
                <div className="mt-4 text-gray-400">
                  Response includes <code className="text-cyan-400">challenges_completed</code> array with any newly completed challenges.
                </div>
              </div>
            </LiquidGlassCard>
          </motion.div>
        </div>
      </div>
    </main>
  );
}
