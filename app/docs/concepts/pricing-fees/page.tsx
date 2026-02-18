'use client';

import Link from 'next/link';
import { LiquidGlassCard } from '@/components/ui/liquid-glass';

export default function PricingFeesPage() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-white/60 text-sm mb-4">
          <Link href="/docs" className="hover:text-white transition-colors">Docs</Link>
          <span>/</span>
          <Link href="/docs/concepts" className="hover:text-white transition-colors">Concepts</Link>
          <span>/</span>
          <span className="text-white">Pricing & Fees</span>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">
          Pricing & Fees
        </h1>
        <p className="text-lg text-white/70">
          Understanding how prices work and what fees apply on AgoráX.
        </p>
      </div>

      {/* Pricing Concept */}
      <LiquidGlassCard className="p-6">
        <h2 className="text-xl font-semibold text-white mb-4">How Limit Prices Work</h2>
        <p className="text-white/70 mb-4">
          When creating an order, you set a <strong className="text-white">limit price</strong> — the exchange rate
          at which you're willing to trade. This is typically expressed as a percentage above or below the current
          market price.
        </p>

        <div className="bg-white/5 p-4 rounded-lg mb-4">
          <h4 className="text-white font-medium mb-2">The Formula</h4>
          <code className="text-green-400 text-sm">
            Limit Price = Market Price × (1 + Percentage / 100)
          </code>
        </div>

        <div className="space-y-3 text-white/70">
          <p><strong className="text-white">Example:</strong></p>
          <ul className="space-y-2 ml-4">
            <li>• Market price: 1 HEX = 1.17 PLSX</li>
            <li>• You want +5% premium</li>
            <li>• Limit price = 1.17 × 1.05 = 1.23 PLSX per HEX</li>
            <li>• If selling 1000 HEX, you'll receive 1,230 PLSX minus any fees</li>
          </ul>
        </div>
      </LiquidGlassCard>

      {/* Price Presets */}
      <div>
        <h2 className="text-2xl font-semibold text-white mb-4">Price Presets</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: 'Market', value: '0%', desc: 'Current market rate' },
            { label: '+1%', value: '1%', desc: 'Slight premium' },
            { label: '+2%', value: '2%', desc: 'Small premium' },
            { label: '+5%', value: '5%', desc: 'Moderate premium' },
            { label: '+10%', value: '10%', desc: 'Significant premium' },
          ].map((preset) => (
            <LiquidGlassCard key={preset.label} className="p-4 text-center">
              <p className="text-white font-semibold">{preset.label}</p>
              <p className="text-white/50 text-xs mt-1">{preset.desc}</p>
            </LiquidGlassCard>
          ))}
        </div>
        <p className="text-white/60 text-sm mt-3">
          You can also drag the limit line on the price chart or manually enter any price.
        </p>
      </div>

      {/* Fees */}
      <div>
        <h2 className="text-2xl font-semibold text-white mb-4">Platform Fees</h2>

        <div className="space-y-4">
          <LiquidGlassCard className="p-6">
            <div className="flex items-start gap-4">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Listing Fee</h3>
                <p className="text-white/70 text-sm mt-1">
                  A small fee paid in PLS when creating an order. This covers the cost of storing
                  your order on-chain and helps prevent spam.
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <code className="bg-white/10 px-2 py-1 rounded text-sm text-white/80">
                    contract.listingFee()
                  </code>
                  <span className="text-white/50 text-sm">← Check current fee</span>
                </div>
              </div>
            </div>
          </LiquidGlassCard>

          <LiquidGlassCard className="p-6">
            <div className="flex items-start gap-4">
              <div className="p-2 bg-purple-500/20 rounded-lg">
                <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Protocol Fee</h3>
                <p className="text-white/70 text-sm mt-1">
                  A 0.2% fee taken from sellers when collecting proceeds. This is deducted from
                  the buy tokens received. Buyers pay no platform fee.
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <code className="bg-white/10 px-2 py-1 rounded text-sm text-white/80">
                    0.2% seller fee (20 basis points)
                  </code>
                </div>
              </div>
            </div>
          </LiquidGlassCard>

          <LiquidGlassCard className="p-6">
            <div className="flex items-start gap-4">
              <div className="p-2 bg-green-500/20 rounded-lg">
                <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Gas Fees</h3>
                <p className="text-white/70 text-sm mt-1">
                  Standard PulseChain network fees for transaction execution. These are typically very low
                  compared to other networks.
                </p>
                <div className="mt-3 bg-white/5 p-3 rounded-lg">
                  <p className="text-white/60 text-sm">Approximate gas costs:</p>
                  <ul className="text-white/50 text-sm mt-2 space-y-1">
                    <li>• Place Order: ~150k-300k gas</li>
                    <li>• Fill Order: ~120k-200k gas</li>
                    <li>• Cancel Order: ~80k-150k gas</li>
                    <li>• Collect Proceeds: ~80k-150k gas</li>
                  </ul>
                </div>
              </div>
            </div>
          </LiquidGlassCard>
        </div>
      </div>

      {/* Payment Logic */}
      <LiquidGlassCard className="p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Payment Logic for Order Creation</h2>
        <div className="space-y-4">
          <div className="bg-white/5 p-4 rounded-lg">
            <h4 className="text-white font-medium mb-2">Selling ERC20 Token</h4>
            <code className="text-blue-400 text-sm">msg.value = listingFee</code>
            <p className="text-white/60 text-sm mt-2">
              Approve the sell token first, then send only the listing fee as PLS.
            </p>
          </div>
          <div className="bg-white/5 p-4 rounded-lg">
            <h4 className="text-white font-medium mb-2">Selling Native PLS</h4>
            <code className="text-blue-400 text-sm">msg.value = sellAmount + listingFee</code>
            <p className="text-white/60 text-sm mt-2">
              Send both the sell amount and listing fee together.
            </p>
          </div>
        </div>
      </LiquidGlassCard>

      {/* Navigation */}
      <div className="flex flex-col md:flex-row gap-4 pt-4">
        <Link href="/docs/concepts/token-compatibility" className="flex-1">
          <LiquidGlassCard className="p-6 h-full hover:bg-white/5 transition-colors group">
            <div className="flex items-center gap-4">
              <svg className="w-5 h-5 text-white/40 group-hover:text-white/60 rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <div>
                <p className="text-white/60 text-sm">Previous</p>
                <p className="text-white font-medium group-hover:text-white/90">Token Compatibility</p>
              </div>
            </div>
          </LiquidGlassCard>
        </Link>
        <Link href="/docs/concepts/comparison" className="flex-1">
          <LiquidGlassCard className="p-6 h-full hover:bg-white/5 transition-colors group">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/60 text-sm">Next</p>
                <p className="text-white font-medium group-hover:text-white/90">Platform Comparison</p>
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
