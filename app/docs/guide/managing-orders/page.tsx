'use client';

import Link from 'next/link';
import { LiquidGlassCard } from '@/components/ui/liquid-glass';

export default function ManagingOrdersPage() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-white/60 text-sm mb-4">
          <Link href="/docs" className="hover:text-white transition-colors">Docs</Link>
          <span>/</span>
          <Link href="/docs/guide" className="hover:text-white transition-colors">Guide</Link>
          <span>/</span>
          <span className="text-white">Managing Orders</span>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">
          Managing Orders
        </h1>
        <p className="text-lg text-white/70">
          Learn how to monitor, modify, and manage your active orders.
        </p>
      </div>

      {/* My Orders Page */}
      <LiquidGlassCard className="p-6">
        <h2 className="text-xl font-semibold text-white mb-4">The My Orders Dashboard</h2>
        <p className="text-white/70 mb-4">
          Access your personal order dashboard at <Link href="/my-orders" className="text-blue-400 hover:underline">/my-orders</Link>.
          Here you can view all your orders organized by status and manage them.
        </p>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-white/5 p-4 rounded-lg">
            <h3 className="text-white font-medium mb-2">Filters Available</h3>
            <ul className="text-white/60 text-sm space-y-1">
              <li>• Status (Active, Expired, Completed, Cancelled)</li>
              <li>• Claimable proceeds</li>
              <li>• Fill percentage</li>
              <li>• Limit position</li>
              <li>• Order ID search</li>
            </ul>
          </div>
          <div className="bg-white/5 p-4 rounded-lg">
            <h3 className="text-white font-medium mb-2">Quick Actions</h3>
            <ul className="text-white/60 text-sm space-y-1">
              <li>• Collect proceeds</li>
              <li>• Cancel order</li>
              <li>• Extend expiration</li>
              <li>• View transaction history</li>
            </ul>
          </div>
        </div>
      </LiquidGlassCard>

      {/* Actions */}
      <div>
        <h2 className="text-2xl font-semibold text-white mb-4">Order Actions</h2>
        <div className="space-y-4">
          {/* Collect Proceeds */}
          <LiquidGlassCard className="p-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-green-500/20 rounded-xl text-green-400">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-white mb-2">Collect Proceeds</h3>
                <p className="text-white/70 mb-3">
                  When your order gets filled, the buy tokens accumulate in the contract. Claim them anytime
                  by clicking "Collect" on orders with claimable proceeds.
                </p>
                <div className="bg-white/5 p-3 rounded-lg">
                  <p className="text-white/60 text-sm">
                    <strong className="text-white">Note:</strong> Proceeds can be collected even from partially
                    filled orders without affecting the remaining unfilled portion.
                  </p>
                </div>
              </div>
            </div>
          </LiquidGlassCard>

          {/* Cancel Order */}
          <LiquidGlassCard className="p-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-red-500/20 rounded-xl text-red-400">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-white mb-2">Cancel Order</h3>
                <p className="text-white/70 mb-3">
                  Cancel your order to reclaim any unsold tokens. This also collects any accumulated proceeds
                  from partial fills.
                </p>
                <div className="bg-yellow-500/10 p-3 rounded-lg border border-yellow-500/20">
                  <p className="text-yellow-300 text-sm">
                    <strong>Cooldown:</strong> There may be a cooldown period after placing an order before
                    you can cancel it. Check the contract for current cooldown settings.
                  </p>
                </div>
              </div>
            </div>
          </LiquidGlassCard>

          {/* Extend Expiration */}
          <LiquidGlassCard className="p-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-blue-500/20 rounded-xl text-blue-400">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-white mb-2">Extend Expiration</h3>
                <p className="text-white/70 mb-3">
                  Keep your order active longer by extending its expiration time. You can only extend
                  to a future date, not shorten it.
                </p>
                <div className="bg-white/5 p-3 rounded-lg">
                  <p className="text-white/60 text-sm">
                    Useful when you want to keep an order open longer without recreating it.
                  </p>
                </div>
              </div>
            </div>
          </LiquidGlassCard>

          {/* Batch Cancel */}
          <LiquidGlassCard className="p-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-purple-500/20 rounded-xl text-purple-400">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-white mb-2">Batch Cancel Expired</h3>
                <p className="text-white/70 mb-3">
                  Cancel multiple expired orders at once to reclaim all your tokens in a single transaction.
                  Maximum 50 orders per batch.
                </p>
              </div>
            </div>
          </LiquidGlassCard>
        </div>
      </div>

      {/* Order Status Indicators */}
      <div>
        <h2 className="text-2xl font-semibold text-white mb-4">Status Indicators</h2>
        <LiquidGlassCard className="p-6">
          <div className="space-y-4">
            <div className="flex items-center gap-4 p-3 bg-white/5 rounded-lg">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <div>
                <p className="text-white font-medium">Active</p>
                <p className="text-white/50 text-sm">Order is live and can be filled</p>
              </div>
            </div>
            <div className="flex items-center gap-4 p-3 bg-white/5 rounded-lg">
              <div className="w-3 h-3 rounded-full bg-yellow-500" />
              <div>
                <p className="text-white font-medium">Partially Filled</p>
                <p className="text-white/50 text-sm">Some tokens have been filled, rest is still active</p>
              </div>
            </div>
            <div className="flex items-center gap-4 p-3 bg-white/5 rounded-lg">
              <div className="w-3 h-3 rounded-full bg-orange-500" />
              <div>
                <p className="text-white font-medium">Expired</p>
                <p className="text-white/50 text-sm">Order expired, cancel to reclaim tokens</p>
              </div>
            </div>
            <div className="flex items-center gap-4 p-3 bg-white/5 rounded-lg">
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              <div>
                <p className="text-white font-medium">Completed</p>
                <p className="text-white/50 text-sm">Order fully filled</p>
              </div>
            </div>
            <div className="flex items-center gap-4 p-3 bg-white/5 rounded-lg">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <div>
                <p className="text-white font-medium">Cancelled</p>
                <p className="text-white/50 text-sm">Order cancelled by owner</p>
              </div>
            </div>
          </div>
        </LiquidGlassCard>
      </div>

      {/* Claimable Badge */}
      <LiquidGlassCard className="p-6 border-l-4 border-red-500/50">
        <h2 className="text-lg font-semibold text-white mb-3">Claimable Proceeds Notification</h2>
        <p className="text-white/70">
          The navigation bar shows a red badge on "My Orders" when you have unclaimed proceeds.
          This helps you stay on top of collecting your filled tokens.
        </p>
      </LiquidGlassCard>

      {/* Navigation */}
      <div className="flex flex-col md:flex-row gap-4 pt-4">
        <Link href="/docs/guide/filling-orders" className="flex-1">
          <LiquidGlassCard className="p-6 h-full hover:bg-white/5 transition-colors group">
            <div className="flex items-center gap-4">
              <svg className="w-5 h-5 text-white/40 group-hover:text-white/60 rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <div>
                <p className="text-white/60 text-sm">Previous</p>
                <p className="text-white font-medium group-hover:text-white/90">Filling Orders</p>
              </div>
            </div>
          </LiquidGlassCard>
        </Link>
        <Link href="/docs/guide/discover" className="flex-1">
          <LiquidGlassCard className="p-6 h-full hover:bg-white/5 transition-colors group">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/60 text-sm">Next</p>
                <p className="text-white font-medium group-hover:text-white/90">Discover Feature</p>
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
