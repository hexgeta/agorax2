'use client';

import Link from 'next/link';
import { LiquidGlassCard } from '@/components/ui/liquid-glass';
import { CodeBlock } from '@/components/ui/CodeBlock';

export default function ApiReferencePage() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-white/60 text-sm mb-4">
          <Link href="/docs" className="hover:text-white transition-colors">Docs</Link>
          <span>/</span>
          <Link href="/docs/technical" className="hover:text-white transition-colors">Technical</Link>
          <span>/</span>
          <span className="text-white">API Reference</span>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">API Reference</h1>
        <p className="text-white/70">
          REST API endpoints for integrating with AgoraX. All public endpoints use the <code className="text-cyan-400">/api/v1</code> prefix.
        </p>
      </div>

      {/* Base URL */}
      <LiquidGlassCard className="p-6">
        <h2 className="text-xl font-semibold text-white mb-3">Base URL</h2>
        <CodeBlock>https://agorax.win/api/v1</CodeBlock>
        <p className="text-white/50 text-sm mt-3">All v1 endpoints are rate limited. See individual endpoints for limits.</p>
      </LiquidGlassCard>

      {/* GET /v1/stats */}
      <LiquidGlassCard className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <span className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs font-bold rounded">GET</span>
          <code className="text-white font-mono">/v1/stats</code>
          <span className="text-white/40 text-xs">20 req/min</span>
        </div>
        <p className="text-white/70 mb-4">
          Protocol-wide aggregate statistics.
        </p>

        <h3 className="text-white font-medium mb-2">Example Request</h3>
        <div className="flex items-center gap-3 mb-4">
          <pre className="bg-white/5 p-4 rounded-lg overflow-x-auto text-sm flex-1">
            <code className="text-white/80">GET /api/v1/stats</code>
          </pre>
          <a
            href="/api/v1/stats"
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
    "protocol": {
      "total_users": 150,
      "total_xp_issued": 125000,
      "total_trades": 1200,
      "total_volume_usd": 450000.00,
      "total_orders_created": 800,
      "fill_rate_percent": 65.5
    },
    "orders": {
      "total": 800,
      "by_status": { "active": 120, "cancelled": 80, "completed": 600 }
    }
  }
}`}</CodeBlock>
      </LiquidGlassCard>

      {/* GET /v1/leaderboard */}
      <LiquidGlassCard className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <span className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs font-bold rounded">GET</span>
          <code className="text-white font-mono">/v1/leaderboard</code>
          <span className="text-white/40 text-xs">20 req/min</span>
        </div>
        <p className="text-white/70 mb-4">
          Global leaderboard ranked by total XP.
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
              <tr className="border-b border-white/5">
                <td className="py-2 font-mono text-cyan-400">limit</td>
                <td className="py-2">number</td>
                <td className="py-2">Max results (default: 100, max: 500)</td>
              </tr>
              <tr className="border-b border-white/5">
                <td className="py-2 font-mono text-cyan-400">offset</td>
                <td className="py-2">number</td>
                <td className="py-2">Pagination offset (default: 0)</td>
              </tr>
              <tr className="border-b border-white/5">
                <td className="py-2 font-mono text-cyan-400">sort</td>
                <td className="py-2">string</td>
                <td className="py-2">Sort by: xp, trades, volume (default: xp)</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h3 className="text-white font-medium mb-2">Example Request</h3>
        <div className="flex items-center gap-3 mb-4">
          <pre className="bg-white/5 p-4 rounded-lg overflow-x-auto text-sm flex-1">
            <code className="text-white/80">GET /api/v1/leaderboard?limit=10</code>
          </pre>
          <a
            href="/api/v1/leaderboard?limit=10"
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
    "leaderboard": [
      {
        "rank": 1,
        "wallet_address": "0xabc...123",
        "total_xp": 125000,
        "current_prestige": 6,
        "total_trades": 523,
        "total_volume_usd": 450000.00
      }
    ],
    "pagination": { "total": 150, "limit": 10, "offset": 0 }
  }
}`}</CodeBlock>
      </LiquidGlassCard>

      {/* GET /v1/users/[address] */}
      <LiquidGlassCard className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <span className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs font-bold rounded">GET</span>
          <code className="text-white font-mono">/v1/users/{'{address}'}</code>
          <span className="text-white/40 text-xs">30 req/min</span>
        </div>
        <p className="text-white/70 mb-4">
          Full user profile including stats, challenges, events, and orders.
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
              <tr className="border-b border-white/5">
                <td className="py-2 font-mono text-cyan-400">include</td>
                <td className="py-2">string</td>
                <td className="py-2">Comma-separated: challenges, events, orders, daily (default: all)</td>
              </tr>
              <tr className="border-b border-white/5">
                <td className="py-2 font-mono text-cyan-400">events_limit</td>
                <td className="py-2">number</td>
                <td className="py-2">Max events to return (default: 50, max: 200)</td>
              </tr>
              <tr className="border-b border-white/5">
                <td className="py-2 font-mono text-cyan-400">orders_limit</td>
                <td className="py-2">number</td>
                <td className="py-2">Max orders to return (default: 50, max: 200)</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h3 className="text-white font-medium mb-2">Example Request</h3>
        <div className="flex items-center gap-3 mb-4">
          <pre className="bg-white/5 p-4 rounded-lg overflow-x-auto text-sm flex-1">
            <code className="text-white/80">GET /api/v1/users/0x1F12DAE5450522b445Fe1882C4F8D2Cf67B38a43</code>
          </pre>
          <a
            href="/api/v1/users/0x1F12DAE5450522b445Fe1882C4F8D2Cf67B38a43"
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
    "wallet_address": "0x1f12...",
    "stats": {
      "total_xp": 5250,
      "current_prestige": 2,
      "prestige_name": "Gamma",
      "total_orders_created": 23,
      "total_orders_filled": 18,
      "total_trades": 47,
      "total_volume_usd": 12500.50,
      "current_streak_days": 5
    },
    "challenges": {
      "total": 15,
      "by_prestige": { "0": [...], "1": [...] },
      "list": [...]
    },
    "orders": {
      "total": 23,
      "status_counts": { "active": 2, "completed": 18, "cancelled": 3 },
      "list": [...]
    }
  }
}`}</CodeBlock>
      </LiquidGlassCard>

      {/* GET /v1/orders */}
      <LiquidGlassCard className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <span className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs font-bold rounded">GET</span>
          <code className="text-white font-mono">/v1/orders</code>
          <span className="text-white/40 text-xs">30 req/min</span>
        </div>
        <p className="text-white/70 mb-4">
          List and search orders with filters and pagination.
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
              <tr className="border-b border-white/5">
                <td className="py-2 font-mono text-cyan-400">status</td>
                <td className="py-2">string</td>
                <td className="py-2">Filter: active, cancelled, completed</td>
              </tr>
              <tr className="border-b border-white/5">
                <td className="py-2 font-mono text-cyan-400">maker</td>
                <td className="py-2">string</td>
                <td className="py-2">Filter by maker wallet address</td>
              </tr>
              <tr className="border-b border-white/5">
                <td className="py-2 font-mono text-cyan-400">limit</td>
                <td className="py-2">number</td>
                <td className="py-2">Max results (default: 50, max: 200)</td>
              </tr>
              <tr className="border-b border-white/5">
                <td className="py-2 font-mono text-cyan-400">offset</td>
                <td className="py-2">number</td>
                <td className="py-2">Pagination offset</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h3 className="text-white font-medium mb-2">Example Request</h3>
        <div className="flex items-center gap-3 mb-4">
          <pre className="bg-white/5 p-4 rounded-lg overflow-x-auto text-sm flex-1">
            <code className="text-white/80">GET /api/v1/orders?status=active&limit=10</code>
          </pre>
          <a
            href="/api/v1/orders?status=active&limit=10"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
          >
            Try it
          </a>
        </div>
      </LiquidGlassCard>

      {/* GET /v1/orders/[orderId] */}
      <LiquidGlassCard className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <span className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs font-bold rounded">GET</span>
          <code className="text-white font-mono">/v1/orders/{'{orderId}'}</code>
          <span className="text-white/40 text-xs">60 req/min</span>
        </div>
        <p className="text-white/70 mb-4">
          Full order details including fill history.
        </p>

        <h3 className="text-white font-medium mb-2">Example Request</h3>
        <div className="flex items-center gap-3 mb-4">
          <pre className="bg-white/5 p-4 rounded-lg overflow-x-auto text-sm flex-1">
            <code className="text-white/80">GET /api/v1/orders/1</code>
          </pre>
          <a
            href="/api/v1/orders/1"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
          >
            Try it
          </a>
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

        <h3 className="text-white font-medium mt-4 mb-2">Status Codes</h3>
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
                <td className="py-2">Bad request (invalid parameters)</td>
              </tr>
              <tr className="border-b border-white/5">
                <td className="py-2 font-mono text-yellow-400">404</td>
                <td className="py-2">Resource not found</td>
              </tr>
              <tr className="border-b border-white/5">
                <td className="py-2 font-mono text-red-400">429</td>
                <td className="py-2">Rate limit exceeded</td>
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
