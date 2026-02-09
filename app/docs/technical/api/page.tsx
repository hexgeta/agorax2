'use client';

import Link from 'next/link';
import { LiquidGlassCard } from '@/components/ui/liquid-glass';

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
        <code className="block bg-white/5 px-4 py-3 rounded-lg text-green-400 font-mono text-sm">
          https://agorax.app/api
        </code>
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
        <pre className="bg-white/5 p-4 rounded-lg overflow-x-auto text-sm">
          <code className="text-white/80">{`{
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
}`}</code>
        </pre>
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
        <pre className="bg-white/5 p-4 rounded-lg overflow-x-auto text-sm">
          <code className="text-white/80">{`{
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
}`}</code>
        </pre>
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
            <pre className="bg-white/5 p-4 rounded-lg overflow-x-auto text-sm">
              <code className="text-white/80">{`{
  "order_id": number,
  "sell_token": string,
  "sell_amount": number,
  "buy_tokens": string[],
  "buy_amounts": number[],
  "volume_usd": number,
  "is_all_or_nothing": boolean,
  "expiration": string (ISO date),
  "price_vs_market_percent": number
}`}</code>
            </pre>
          </div>

          <div>
            <h3 className="text-white font-medium mb-2">order_filled</h3>
            <pre className="bg-white/5 p-4 rounded-lg overflow-x-auto text-sm">
              <code className="text-white/80">{`{
  "order_id": number,
  "fill_amount": number,
  "fill_percentage": number,
  "buy_token_used": string,
  "volume_usd": number,
  "fill_time_seconds": number
}`}</code>
            </pre>
          </div>

          <div>
            <h3 className="text-white font-medium mb-2">trade_completed</h3>
            <pre className="bg-white/5 p-4 rounded-lg overflow-x-auto text-sm">
              <code className="text-white/80">{`{
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
}`}</code>
            </pre>
          </div>

          <div>
            <h3 className="text-white font-medium mb-2">proceeds_claimed</h3>
            <pre className="bg-white/5 p-4 rounded-lg overflow-x-auto text-sm">
              <code className="text-white/80">{`{
  "order_id": number,
  "amount_claimed": number,
  "token": string
}`}</code>
            </pre>
          </div>

          <div>
            <h3 className="text-white font-medium mb-2">order_cancelled</h3>
            <pre className="bg-white/5 p-4 rounded-lg overflow-x-auto text-sm">
              <code className="text-white/80">{`{
  "order_id": number,
  "time_since_creation_seconds": number,
  "fill_percentage_at_cancel": number
}`}</code>
            </pre>
          </div>
        </div>
      </LiquidGlassCard>

      {/* Error Responses */}
      <LiquidGlassCard className="p-6">
        <h2 className="text-xl font-semibold text-white mb-4">Error Responses</h2>
        <p className="text-white/70 mb-4">
          All endpoints return errors in a consistent format:
        </p>
        <pre className="bg-white/5 p-4 rounded-lg overflow-x-auto text-sm">
          <code className="text-white/80">{`{
  "success": false,
  "error": "Error message here"
}`}</code>
        </pre>

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
