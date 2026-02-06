'use client';

import Link from 'next/link';
import { LiquidGlassCard } from '@/components/ui/liquid-glass';

export default function FillingOrdersPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-white/60 text-sm mb-4">
          <Link href="/docs" className="hover:text-white transition-colors">Docs</Link>
          <span>/</span>
          <Link href="/docs/guide" className="hover:text-white transition-colors">Guide</Link>
          <span>/</span>
          <span className="text-white">Filling Orders</span>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">
          Filling Orders
        </h1>
        <p className="text-lg text-white/70">
          How to browse and fill existing orders on the marketplace.
        </p>
      </div>

      {/* Finding Orders */}
      <LiquidGlassCard className="p-6">
        <h2 className="text-xl font-semibold text-white mb-4">Finding Orders</h2>
        <p className="text-white/70 mb-4">
          Browse the marketplace to find orders to fill:
        </p>
        <div className="bg-white/5 p-4 rounded-lg">
          <h3 className="text-white font-medium mb-2">Marketplace</h3>
          <p className="text-white/60 text-sm">
            Browse all active orders with advanced filtering by token, price, size, and status.
          </p>
          <Link href="/marketplace" className="text-blue-400 text-sm hover:underline mt-2 inline-block">
            Go to Marketplace →
          </Link>
        </div>
      </LiquidGlassCard>

      {/* Marketplace Filters */}
      <div>
        <h2 className="text-2xl font-semibold text-white mb-4">Marketplace Filters</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <LiquidGlassCard className="p-5">
            <h3 className="text-white font-medium mb-2">Search</h3>
            <p className="text-white/60 text-sm">
              Search by order ID, seller address, or token ticker
            </p>
          </LiquidGlassCard>
          <LiquidGlassCard className="p-5">
            <h3 className="text-white font-medium mb-2">Status</h3>
            <p className="text-white/60 text-sm">
              Filter by active, expired, completed, or cancelled orders
            </p>
          </LiquidGlassCard>
          <LiquidGlassCard className="p-5">
            <h3 className="text-white font-medium mb-2">Fill %</h3>
            <p className="text-white/60 text-sm">
              Filter by percentage already filled (0-100%)
            </p>
          </LiquidGlassCard>
          <LiquidGlassCard className="p-5">
            <h3 className="text-white font-medium mb-2">Minimum USD</h3>
            <p className="text-white/60 text-sm">
              Hide small "dust" orders below a threshold
            </p>
          </LiquidGlassCard>
          <LiquidGlassCard className="p-5">
            <h3 className="text-white font-medium mb-2">Position</h3>
            <p className="text-white/60 text-sm">
              Filter by limit position relative to market (-100% to +100%)
            </p>
          </LiquidGlassCard>
          <LiquidGlassCard className="p-5">
            <h3 className="text-white font-medium mb-2">Time Period</h3>
            <p className="text-white/60 text-sm">
              Filter orders expiring within a specific timeframe
            </p>
          </LiquidGlassCard>
        </div>
      </div>

      {/* Fill Process */}
      <div>
        <h2 className="text-2xl font-semibold text-white mb-4">How to Fill an Order</h2>
        <div className="space-y-4">
          <LiquidGlassCard className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white font-bold flex-shrink-0">
                1
              </div>
              <div>
                <h3 className="text-white font-medium mb-2">Select an Order</h3>
                <p className="text-white/60 text-sm">
                  Click on any order card to expand details, or click the "Fill" button to open the fill modal.
                </p>
              </div>
            </div>
          </LiquidGlassCard>

          <LiquidGlassCard className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white font-bold flex-shrink-0">
                2
              </div>
              <div>
                <h3 className="text-white font-medium mb-2">Choose Payment Token</h3>
                <p className="text-white/60 text-sm">
                  If the order accepts multiple tokens, choose which one you want to pay with.
                  The required amount will be shown for each option.
                </p>
              </div>
            </div>
          </LiquidGlassCard>

          <LiquidGlassCard className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white font-bold flex-shrink-0">
                3
              </div>
              <div>
                <h3 className="text-white font-medium mb-2">Enter Fill Amount</h3>
                <p className="text-white/60 text-sm mb-3">
                  Enter how much you want to fill. For partial fill orders, you can fill any amount
                  up to the remaining amount. For All-or-Nothing orders, you must fill 100%.
                </p>
                <div className="bg-white/5 p-3 rounded-lg">
                  <p className="text-white/50 text-sm">
                    <strong className="text-white">Example:</strong> Order sells 1000 HEX for 5000 PLS.
                    To fill 50%, you'd pay 2500 PLS and receive 500 HEX.
                  </p>
                </div>
              </div>
            </div>
          </LiquidGlassCard>

          <LiquidGlassCard className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white font-bold flex-shrink-0">
                4
              </div>
              <div>
                <h3 className="text-white font-medium mb-2">Approve & Confirm</h3>
                <p className="text-white/60 text-sm">
                  Approve the payment token (if needed), then confirm the fill transaction.
                  You'll receive the sell tokens immediately upon transaction confirmation.
                </p>
              </div>
            </div>
          </LiquidGlassCard>
        </div>
      </div>

      {/* Understanding Prices */}
      <LiquidGlassCard className="p-6">
        <h2 className="text-xl font-semibold text-white mb-4">Understanding Order Prices</h2>
        <p className="text-white/70 mb-4">
          Each order shows how its price compares to the current market rate:
        </p>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm">-10%</span>
            <span className="text-white/60 text-sm">Good deal! You pay 10% less than market value</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 bg-gray-500/20 text-gray-400 rounded-full text-sm">0%</span>
            <span className="text-white/60 text-sm">Market rate - fair trade</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 bg-red-500/20 text-red-400 rounded-full text-sm">+10%</span>
            <span className="text-white/60 text-sm">Above market - seller wants a premium</span>
          </div>
        </div>
      </LiquidGlassCard>

      {/* Tips */}
      <div className="animated-border rounded-2xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Pro Tips</h2>
        <ul className="space-y-3 text-white/70">
          <li className="flex items-start gap-2">
            <span className="text-amber-400">•</span>
            <span>Look for orders with negative position (below market) for the best deals</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-amber-400">•</span>
            <span>Check the USD values to understand the actual trade amounts</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-amber-400">•</span>
            <span>Partially fill large orders if you don't need the full amount</span>
          </li>
        </ul>
      </div>

      {/* Navigation */}
      <div className="flex flex-col md:flex-row gap-4 pt-4">
        <Link href="/docs/guide/creating-orders" className="flex-1">
          <LiquidGlassCard className="p-6 h-full hover:bg-white/5 transition-colors group">
            <div className="flex items-center gap-4">
              <svg className="w-5 h-5 text-white/40 group-hover:text-white/60 rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <div>
                <p className="text-white/60 text-sm">Previous</p>
                <p className="text-white font-medium group-hover:text-white/90">Creating Orders</p>
              </div>
            </div>
          </LiquidGlassCard>
        </Link>
        <Link href="/docs/guide/managing-orders" className="flex-1">
          <LiquidGlassCard className="p-6 h-full hover:bg-white/5 transition-colors group">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/60 text-sm">Next</p>
                <p className="text-white font-medium group-hover:text-white/90">Managing Orders</p>
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
