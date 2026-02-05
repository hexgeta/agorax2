'use client';

import Link from 'next/link';
import { LiquidGlassCard } from '@/components/ui/liquid-glass';

export default function OrderTypesPage() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-white/60 text-sm mb-4">
          <Link href="/docs" className="hover:text-white transition-colors">Docs</Link>
          <span>/</span>
          <Link href="/docs/concepts" className="hover:text-white transition-colors">Concepts</Link>
          <span>/</span>
          <span className="text-white">Order Types</span>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">
          Order Types
        </h1>
        <p className="text-lg text-white/70">
          Understanding the different order configurations available on AgoráX.
        </p>
      </div>

      {/* Partial Fill Orders */}
      <LiquidGlassCard className="p-6">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-blue-500/20 rounded-xl text-blue-400">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-white mb-2">Partial Fill Orders (Default)</h2>
            <p className="text-white/70 mb-4">
              The default order type that allows buyers to fill any portion of your order. This is ideal for
              larger orders where you want maximum flexibility.
            </p>
            <div className="bg-white/5 p-4 rounded-lg">
              <h4 className="text-white font-medium mb-2">Example</h4>
              <p className="text-white/60 text-sm">
                You create an order selling 10,000 HEX for 50,000 PLS.<br />
                • Buyer A fills 20% → pays 10,000 PLS, receives 2,000 HEX<br />
                • Buyer B fills 30% → pays 15,000 PLS, receives 3,000 HEX<br />
                • Remaining 50% stays open for future fills
              </p>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm">More likely to fill</span>
              <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm">Flexible</span>
              <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm">Good for large orders</span>
            </div>
          </div>
        </div>
      </LiquidGlassCard>

      {/* All-or-Nothing Orders */}
      <LiquidGlassCard className="p-6">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-purple-500/20 rounded-xl text-purple-400">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-white mb-2">All-or-Nothing (AON) Orders</h2>
            <p className="text-white/70 mb-4">
              Orders marked as "All or Nothing" must be filled completely in a single transaction.
              No partial fills are allowed.
            </p>
            <div className="bg-white/5 p-4 rounded-lg">
              <h4 className="text-white font-medium mb-2">Use Cases</h4>
              <ul className="text-white/60 text-sm space-y-1">
                <li>• You need the full amount to complete another trade</li>
                <li>• You don't want to manage partially filled orders</li>
                <li>• You want to ensure a specific total value received</li>
              </ul>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="px-3 py-1 bg-yellow-500/20 text-yellow-400 rounded-full text-sm">Requires full fill</span>
              <span className="px-3 py-1 bg-yellow-500/20 text-yellow-400 rounded-full text-sm">Simpler management</span>
            </div>
          </div>
        </div>
      </LiquidGlassCard>

      {/* Multi-Token Orders */}
      <LiquidGlassCard className="p-6">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-orange-500/20 rounded-xl text-orange-400">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-white mb-2">Multi-Token Orders</h2>
            <p className="text-white/70 mb-4">
              A unique feature of AgoráX that allows you to accept up to 50 different tokens as payment
              for a single order. Each buyer can choose which token to pay with.
            </p>
            <div className="bg-white/5 p-4 rounded-lg">
              <h4 className="text-white font-medium mb-2">Example</h4>
              <p className="text-white/60 text-sm mb-2">
                Selling 1,000 HEX, accepting:
              </p>
              <ul className="text-white/60 text-sm space-y-1 ml-4">
                <li>• 5,000 PLS, OR</li>
                <li>• 2,000 PLSX, OR</li>
                <li>• 500 INC</li>
              </ul>
              <p className="text-white/60 text-sm mt-2">
                Buyer chooses whichever token is most convenient for them.
              </p>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm">Maximum flexibility</span>
              <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm">Higher fill probability</span>
              <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm">Up to 50 tokens</span>
            </div>
          </div>
        </div>
      </LiquidGlassCard>

      {/* Order States */}
      <div>
        <h2 className="text-2xl font-semibold text-white mb-4">Order States</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <LiquidGlassCard className="p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <h3 className="text-white font-semibold">Active</h3>
            </div>
            <p className="text-white/60 text-sm">
              Order is live and can be filled. Tokens are held in escrow.
            </p>
          </LiquidGlassCard>

          <LiquidGlassCard className="p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-3 h-3 rounded-full bg-yellow-500" />
              <h3 className="text-white font-semibold">Expired</h3>
            </div>
            <p className="text-white/60 text-sm">
              Order reached its expiration time. Can no longer be filled but tokens can be reclaimed.
            </p>
          </LiquidGlassCard>

          <LiquidGlassCard className="p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <h3 className="text-white font-semibold">Cancelled</h3>
            </div>
            <p className="text-white/60 text-sm">
              Order was cancelled by the owner. Remaining tokens returned to owner.
            </p>
          </LiquidGlassCard>

          <LiquidGlassCard className="p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              <h3 className="text-white font-semibold">Completed</h3>
            </div>
            <p className="text-white/60 text-sm">
              Order has been fully filled. All sell tokens have been exchanged.
            </p>
          </LiquidGlassCard>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex flex-col md:flex-row gap-4 pt-4">
        <Link href="/docs/concepts/how-it-works" className="flex-1">
          <LiquidGlassCard className="p-6 h-full hover:bg-white/5 transition-colors group">
            <div className="flex items-center gap-4">
              <svg className="w-5 h-5 text-white/40 group-hover:text-white/60 rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <div>
                <p className="text-white/60 text-sm">Previous</p>
                <p className="text-white font-medium group-hover:text-white/90">How It Works</p>
              </div>
            </div>
          </LiquidGlassCard>
        </Link>
        <Link href="/docs/concepts/token-compatibility" className="flex-1">
          <LiquidGlassCard className="p-6 h-full hover:bg-white/5 transition-colors group">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/60 text-sm">Next</p>
                <p className="text-white font-medium group-hover:text-white/90">Token Compatibility</p>
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
