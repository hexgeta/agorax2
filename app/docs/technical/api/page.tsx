'use client';

import Link from 'next/link';
import { LiquidGlassCard } from '@/components/ui/liquid-glass';
import { CodeBlock } from '@/components/ui/CodeBlock';

export default function ApiReferencePage() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">API Reference</h1>
        <p className="text-white/70">
          REST API endpoints for integrating with AgoraX. Track events, fetch user achievements,
          and access leaderboard data.
        </p>
      </div>

      {/* Base URL */}
      <LiquidGlassCard className="p-6">
        <h2 className="text-xl font-semibold text-white mb-3">Base URL</h2>
        <CodeBlock>https://agorax.app/api</CodeBlock>
      </LiquidGlassCard>

      {/* GET /user */}
      <LiquidGlassCard className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <span className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs font-bold rounded">GET</span>
          <code className="text-white font-mono">/user</code>
        </div>
        <p className="text-white/70 mb-4">
          Fetch a user&apos;s stats and order activity history.
        </p>

        <h3 className="text-white font-medium mb-2">Query Parameters</h3>
        <div className="overflow-x-auto mb-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left py-2 text-white/60">Parameter</th>
                <th className="text-left py-2 text-white/60">Type</th>
                <th className="text-left py-2 text-white/60">Description</th>
              </tr>
            </thead>
            <tbody className="text-white/70">
              <tr>
                <td className="py-2 font-mono text-cyan-400">wallet</td>
                <td className="py-2">string</td>
                <td className="py-2">Wallet address (required)</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h3 className="text-white font-medium mb-2">Example Request</h3>
        <div className="flex items-center gap-3 mb-4">
          <pre className="bg-white/5 p-4 rounded-lg overflow-x-auto text-sm flex-1">
            <code className="text-white/80">GET /api/user?wallet=0x1F12DAE5450522b445Fe1882C4F8D2Cf67B38a43</code>
          </pre>
          <a
            href="/api/user?wallet=0x1F12DAE5450522b445Fe1882C4F8D2Cf67B38a43"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
          >
            Try it
          </a>
        </div>

        <h3 className="text-white font-medium mb-2">Response</h3>
        <CodeBlock>{`{
  "success": true,
  "data": {
    "stats": {
      "wallet_address": "0x1f12...",
      "total_xp": 0,
      "total_orders_created": 12,
      "total_orders_filled": 5,
      "total_orders_cancelled": 3,
      "total_trades": 10,
      "total_volume_usd": 0,
      "current_active_orders": 2
    },
    "activity": [
      {
        "id": "uuid",
        "event_type": "order_created",
        "event_data": {
          "order_id": 12,
          "sell_token": "HEX",
          "sell_amount": "20000",
          "tx_hash": "0x..."
        },
        "xp_awarded": 0,
        "created_at": "2026-01-19T12:36:35+00:00"
      },
      {
        "id": "uuid",
        "event_type": "trade_completed",
        "event_data": {
          "order_id": 9,
          "sell_token": "HEX",
          "buy_token": "PLS",
          "buy_amount": "93.27645",
          "is_maker": true,
          "filler_wallet": "0xdb85...",
          "tx_hash": "0x..."
        },
        "xp_awarded": 0,
        "created_at": "2026-01-18T22:20:35+00:00"
      }
    ]
  }
}`}</CodeBlock>

        <h3 className="text-white font-medium mt-4 mb-2">Activity Event Types</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left py-2 text-white/60">Event Type</th>
                <th className="text-left py-2 text-white/60">Description</th>
              </tr>
            </thead>
            <tbody className="text-white/70">
              <tr className="border-b border-white/5">
                <td className="py-2 font-mono text-green-400">order_created</td>
                <td className="py-2">User created a new order</td>
              </tr>
              <tr className="border-b border-white/5">
                <td className="py-2 font-mono text-blue-400">order_filled</td>
                <td className="py-2">User filled someone else&apos;s order</td>
              </tr>
              <tr className="border-b border-white/5">
                <td className="py-2 font-mono text-cyan-400">trade_completed</td>
                <td className="py-2">A trade was completed (for both maker and taker)</td>
              </tr>
              <tr className="border-b border-white/5">
                <td className="py-2 font-mono text-red-400">order_cancelled</td>
                <td className="py-2">User cancelled their order</td>
              </tr>
              <tr className="border-b border-white/5">
                <td className="py-2 font-mono text-purple-400">proceeds_claimed</td>
                <td className="py-2">User claimed proceeds from a filled order</td>
              </tr>
            </tbody>
          </table>
        </div>
      </LiquidGlassCard>

      {/* GET /user/achievements */}
      <LiquidGlassCard className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <span className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs font-bold rounded">GET</span>
          <code className="text-white font-mono">/user/achievements</code>
        </div>
        <p className="text-white/70 mb-4">
          Fetch a user&apos;s stats, XP, prestige level, and completed challenges.
        </p>

        <h3 className="text-white font-medium mb-2">Query Parameters</h3>
        <div className="overflow-x-auto mb-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left py-2 text-white/60">Parameter</th>
                <th className="text-left py-2 text-white/60">Type</th>
                <th className="text-left py-2 text-white/60">Description</th>
              </tr>
            </thead>
            <tbody className="text-white/70">
              <tr>
                <td className="py-2 font-mono text-cyan-400">wallet</td>
                <td className="py-2">string</td>
                <td className="py-2">Wallet address (required)</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h3 className="text-white font-medium mb-2">Example Request</h3>
        <div className="flex items-center gap-3 mb-4">
          <pre className="bg-white/5 p-4 rounded-lg overflow-x-auto text-sm flex-1">
            <code className="text-white/80">GET /api/user/achievements?wallet=0x1F12DAE5450522b445Fe1882C4F8D2Cf67B38a43</code>
          </pre>
          <a
            href="/api/user/achievements?wallet=0x1F12DAE5450522b445Fe1882C4F8D2Cf67B38a43"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
          >
            Try it
          </a>
        </div>

        <h3 className="text-white font-medium mb-2">Response</h3>
        <CodeBlock>{`{
  "wallet_address": "0x1234...abcd",
  "total_xp": 5250,
  "prestige_level": 2,
  "current_streak_days": 5,
  "total_trades": 47,
  "total_orders_created": 23,
  "total_orders_filled": 18,
  "total_volume_usd": 12500.50,
  "completed_challenges": [
    {
      "prestige_level": 0,
      "challenge_name": "First Order",
      "category": "operations",
      "xp_awarded": 250,
      "completed_at": "2024-01-15T10:30:00Z"
    },
    ...
  ]
}`}</CodeBlock>
      </LiquidGlassCard>

      {/* GET /leaderboard */}
      <LiquidGlassCard className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <span className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs font-bold rounded">GET</span>
          <code className="text-white font-mono">/leaderboard</code>
        </div>
        <p className="text-white/70 mb-4">
          Fetch the global leaderboard ranked by total XP.
        </p>

        <h3 className="text-white font-medium mb-2">Query Parameters</h3>
        <div className="overflow-x-auto mb-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left py-2 text-white/60">Parameter</th>
                <th className="text-left py-2 text-white/60">Type</th>
                <th className="text-left py-2 text-white/60">Description</th>
              </tr>
            </thead>
            <tbody className="text-white/70">
              <tr>
                <td className="py-2 font-mono text-cyan-400">limit</td>
                <td className="py-2">number</td>
                <td className="py-2">Max results to return (default: 100)</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h3 className="text-white font-medium mb-2">Example Request</h3>
        <div className="flex items-center gap-3 mb-4">
          <pre className="bg-white/5 p-4 rounded-lg overflow-x-auto text-sm flex-1">
            <code className="text-white/80">GET /api/leaderboard?limit=10</code>
          </pre>
          <a
            href="/api/leaderboard?limit=10"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
          >
            Try it
          </a>
        </div>

        <h3 className="text-white font-medium mb-2">Response</h3>
        <CodeBlock>{`{
  "leaderboard": [
    {
      "rank": 1,
      "wallet_address": "0xabc...123",
      "total_xp": 125000,
      "prestige_level": 6,
      "total_trades": 523,
      "total_volume_usd": 450000.00
    },
    {
      "rank": 2,
      "wallet_address": "0xdef...456",
      "total_xp": 98500,
      "prestige_level": 5,
      "total_trades": 312,
      "total_volume_usd": 280000.00
    },
    ...
  ]
}`}</CodeBlock>
      </LiquidGlassCard>

      {/* Event Data Fields */}
      <LiquidGlassCard className="p-6">
        <h2 className="text-xl font-semibold text-white mb-4">Event Data Fields</h2>
        <p className="text-white/70 mb-4">
          Each event type requires specific fields in the <code className="text-cyan-400">event_data</code> object:
        </p>

        <div className="space-y-4">
          <div>
            <h3 className="text-white font-medium mb-2">order_created</h3>
            <CodeBlock>{`{
  "order_id": number,
  "sell_token": string,
  "sell_amount": number,
  "buy_tokens": string[],
  "buy_amounts": number[],
  "volume_usd": number,
  "is_all_or_nothing": boolean,
  "expiration": string (ISO date),
  "price_vs_market_percent": number
}`}</CodeBlock>
          </div>

          <div>
            <h3 className="text-white font-medium mb-2">order_filled</h3>
            <CodeBlock>{`{
  "order_id": number,
  "fill_amount": number,
  "fill_percentage": number,
  "buy_token_used": string,
  "volume_usd": number,
  "fill_time_seconds": number
}`}</CodeBlock>
          </div>

          <div>
            <h3 className="text-white font-medium mb-2">trade_completed</h3>
            <CodeBlock>{`{
  "order_id": number,
  "sell_token": string,
  "buy_token": string,
  "sell_amount": number,
  "buy_amount": number,
  "volume_usd": number,
  "is_maker": boolean,
  "filler_wallet": string,
  "order_completed": boolean,
  "is_all_or_nothing": boolean
}`}</CodeBlock>
          </div>

          <div>
            <h3 className="text-white font-medium mb-2">proceeds_claimed</h3>
            <CodeBlock>{`{
  "order_id": number,
  "amount_claimed": number,
  "token": string
}`}</CodeBlock>
          </div>

          <div>
            <h3 className="text-white font-medium mb-2">order_cancelled</h3>
            <CodeBlock>{`{
  "order_id": number,
  "time_since_creation_seconds": number,
  "fill_percentage_at_cancel": number
}`}</CodeBlock>
          </div>
        </div>
      </LiquidGlassCard>

      {/* Error Responses */}
      <LiquidGlassCard className="p-6">
        <h2 className="text-xl font-semibold text-white mb-4">Error Responses</h2>
        <p className="text-white/70 mb-4">
          All endpoints return errors in a consistent format:
        </p>
        <CodeBlock>{`{
  "success": false,
  "error": "Error message here"
}`}</CodeBlock>

        <h3 className="text-white font-medium mt-4 mb-2">Common Status Codes</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left py-2 text-white/60">Code</th>
                <th className="text-left py-2 text-white/60">Description</th>
              </tr>
            </thead>
            <tbody className="text-white/70">
              <tr className="border-b border-white/5">
                <td className="py-2 font-mono text-green-400">200</td>
                <td className="py-2">Success</td>
              </tr>
              <tr className="border-b border-white/5">
                <td className="py-2 font-mono text-yellow-400">400</td>
                <td className="py-2">Bad request (missing/invalid parameters)</td>
              </tr>
              <tr className="border-b border-white/5">
                <td className="py-2 font-mono text-red-400">401</td>
                <td className="py-2">Unauthorized (backfill endpoint)</td>
              </tr>
              <tr className="border-b border-white/5">
                <td className="py-2 font-mono text-red-400">500</td>
                <td className="py-2">Internal server error</td>
              </tr>
            </tbody>
          </table>
        </div>
      </LiquidGlassCard>

      {/* Navigation */}
      <div className="flex justify-between gap-4">
        <Link href="/docs/technical/data-structures" className="flex-1 max-w-sm">
          <LiquidGlassCard className="p-6 h-full hover:bg-white/5 transition-colors group">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/60 text-sm">Previous</p>
                <p className="text-white font-medium group-hover:text-white/90">Data Structures</p>
              </div>
              <svg className="w-5 h-5 text-white/40 group-hover:text-white/60 rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </LiquidGlassCard>
        </Link>
        <Link href="/docs/security/audit" className="flex-1 max-w-sm">
          <LiquidGlassCard className="p-6 h-full hover:bg-white/5 transition-colors group">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/60 text-sm">Next</p>
                <p className="text-white font-medium group-hover:text-white/90">Audit Report</p>
              </div>
              <svg className="w-5 h-5 text-white/40 group-hover:text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </LiquidGlassCard>
        </Link>
      </div>
    </div>
  );
}
