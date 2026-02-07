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
    category: 'humiliation',
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
    category: 'humiliation',
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
    category: 'humiliation',
    xp: 200,
    description: 'Complete a trade between 3-5 AM UTC',
    eventType: 'trade_completed',
    trackingLogic: 'Checked if current UTC hour is >= 3 and < 5 when trade is completed',
    eventData: [],
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
    category: 'humiliation',
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
    category: 'humiliation',
    xp: 75,
    description: 'Have an order expire without any fills',
    eventType: 'order_expired',
    trackingLogic: 'Triggered when batch cancelling expired orders. Checked if fill_percentage === 0',
    eventData: ['order_id', 'fill_percentage'],
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
    name: 'Speed Runner',
    level: 4,
    levelName: 'Epsilon',
    category: 'humiliation',
    xp: 400,
    description: 'Have your order filled within 30 seconds of creating it',
    eventType: 'order_filled',
    trackingLogic: 'Checked if event_data.fill_time_seconds <= 30',
    eventData: ['fill_time_seconds'],
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
    name: 'Overkill',
    level: 5,
    levelName: 'Zeta',
    category: 'humiliation',
    xp: 150,
    description: 'Create an order 10x above market price',
    eventType: 'order_created',
    trackingLogic: 'Checked if price_vs_market_percent >= 900 (900% above market = 10x)',
    eventData: ['price_vs_market_percent'],
    status: 'implemented',
  },
  {
    name: 'Fire Sale',
    level: 5,
    levelName: 'Zeta',
    category: 'humiliation',
    xp: 150,
    description: 'Create an order 50% below market price',
    eventType: 'order_created',
    trackingLogic: 'Checked if price_vs_market_percent <= -50',
    eventData: ['price_vs_market_percent'],
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
    name: 'Multi-Chain Explorer',
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
    name: 'Marathon Trader',
    level: 6,
    levelName: 'Eta',
    category: 'operations',
    xp: 4000,
    description: 'Trade 30 days in a row',
    eventType: 'trade_completed',
    trackingLogic: 'Checked against users.current_streak_days >= 30',
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
    name: 'The Sniper',
    level: 6,
    levelName: 'Eta',
    category: 'humiliation',
    xp: 800,
    description: 'Fill an order within 5 seconds of it being created',
    eventType: 'order_filled',
    trackingLogic: 'Checked if event_data.fill_time_seconds <= 5',
    eventData: ['fill_time_seconds'],
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
    name: 'MAXI Supporter',
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
    name: 'Unstoppable',
    level: 7,
    levelName: 'Theta',
    category: 'operations',
    xp: 8000,
    description: 'Trade 60 days in a row',
    eventType: 'trade_completed',
    trackingLogic: 'Checked against users.current_streak_days >= 60',
    eventData: [],
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
    name: 'Total Chaos',
    level: 7,
    levelName: 'Theta',
    category: 'humiliation',
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
    name: 'Full Spectrum',
    level: 8,
    levelName: 'Omega',
    category: 'bootcamp',
    xp: 4000,
    description: 'Trade every whitelisted token category',
    eventType: 'trade_completed',
    trackingLogic: 'Check if user has traded tokens from >= 7 categories (hex, pls, plsx, inc, stablecoin, maxi, etc.)',
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
    name: 'Year Warrior',
    level: 8,
    levelName: 'Omega',
    category: 'operations',
    xp: 15000,
    description: 'Trade 100 days in a row',
    eventType: 'trade_completed',
    trackingLogic: 'Checked against users.current_streak_days >= 100',
    eventData: [],
    status: 'implemented',
  },
  {
    name: 'Market Dominator',
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
    name: 'Instant Legend',
    level: 8,
    levelName: 'Omega',
    category: 'humiliation',
    xp: 2000,
    description: 'Fill an order the exact second it was created',
    eventType: 'order_filled',
    trackingLogic: 'Checked if event_data.fill_time_seconds <= 1',
    eventData: ['fill_time_seconds'],
    status: 'implemented',
  },
  {
    name: 'All-Nighter',
    level: 8,
    levelName: 'Omega',
    category: 'humiliation',
    xp: 3000,
    description: 'Make trades every hour for 24 hours straight',
    eventType: 'trade_completed',
    trackingLogic: 'Check for 24 consecutive hours with at least one trade in each hour',
    eventData: [],
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

const CATEGORY_ICONS: Record<string, string> = {
  'bootcamp': '🎯',
  'operations': '⚔️',
  'elite': '👑',
  'humiliation': '💀',
};

const STATUS_COLORS: Record<string, string> = {
  'implemented': 'bg-green-500/20 text-green-400 border-green-500/30',
  'partial': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  'needs-work': 'bg-red-500/20 text-red-400 border-red-500/30',
};

export default function ChallengeAdminPage() {
  const [filterLevel, setFilterLevel] = useState<number | null>(null);
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredChallenges = CHALLENGE_DOCS.filter(challenge => {
    if (filterLevel !== null && challenge.level !== filterLevel) return false;
    if (filterCategory && challenge.category !== filterCategory) return false;
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
  const categories = [...new Set(CHALLENGE_DOCS.map(c => c.category))];

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

                {/* Category Filter */}
                <select
                  value={filterCategory ?? ''}
                  onChange={(e) => setFilterCategory(e.target.value || null)}
                  className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-white/30"
                >
                  <option value="">All Categories</option>
                  {categories.map(cat => (
                    <option key={cat} value={cat}>
                      {CATEGORY_ICONS[cat]} {cat.charAt(0).toUpperCase() + cat.slice(1)}
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
                {(filterLevel !== null || filterCategory || filterStatus || searchQuery) && (
                  <button
                    onClick={() => {
                      setFilterLevel(null);
                      setFilterCategory(null);
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
                        <span className="text-lg">{CATEGORY_ICONS[challenge.category]}</span>
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
