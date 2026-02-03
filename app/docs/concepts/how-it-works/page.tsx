'use client';

import Link from 'next/link';
import { LiquidGlassCard } from '@/components/ui/liquid-glass';

export default function HowItWorksPage() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-white/60 text-sm mb-4">
          <Link href="/docs" className="hover:text-white transition-colors">Docs</Link>
          <span>/</span>
          <Link href="/docs/concepts" className="hover:text-white transition-colors">Concepts</Link>
          <span>/</span>
          <span className="text-white">How It Works</span>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">
          How AgoráX Works
        </h1>
        <p className="text-lg text-white/70">
          AgoráX is a decentralized limit order protocol that enables peer-to-peer OTC trading on PulseChain.
        </p>
      </div>

      {/* Overview */}
      <LiquidGlassCard className="p-6">
        <h2 className="text-xl font-semibold text-white mb-4">The Big Picture</h2>
        <p className="text-white/70 mb-4">
          Unlike traditional DEX swaps that execute immediately at market price, AgoráX allows you to set your own price
          and wait for someone to fill your order. This is similar to limit orders on centralized exchanges, but
          fully decentralized and non-custodial.
        </p>
        <div className="grid md:grid-cols-3 gap-4 mt-6">
          <div className="text-center p-4 bg-white/5 rounded-xl">
            <div className="text-3xl mb-2">📝</div>
            <p className="text-white font-medium">Create Order</p>
            <p className="text-white/50 text-sm">Set your price & tokens</p>
          </div>
          <div className="text-center p-4 bg-white/5 rounded-xl">
            <div className="text-3xl mb-2">⏳</div>
            <p className="text-white font-medium">Wait for Fill</p>
            <p className="text-white/50 text-sm">Order sits in marketplace</p>
          </div>
          <div className="text-center p-4 bg-white/5 rounded-xl">
            <div className="text-3xl mb-2">💰</div>
            <p className="text-white font-medium">Collect Proceeds</p>
            <p className="text-white/50 text-sm">Claim your tokens</p>
          </div>
        </div>
      </LiquidGlassCard>

      {/* Order Flow */}
      <div>
        <h2 className="text-2xl font-semibold text-white mb-4">Order Lifecycle</h2>

        <div className="space-y-4">
          <LiquidGlassCard className="p-6">
            <h3 className="text-lg font-semibold text-white mb-2">1. Order Creation</h3>
            <p className="text-white/70 mb-3">
              When you create an order, your sell tokens are transferred to the smart contract and held in escrow.
              The contract records your order details including:
            </p>
            <ul className="space-y-1 text-white/60 ml-4">
              <li>• What token you're selling and the amount</li>
              <li>• Which tokens you'll accept as payment (up to 50)</li>
              <li>• The amounts required for each payment token</li>
              <li>• Order expiration time</li>
              <li>• All-or-nothing preference</li>
            </ul>
          </LiquidGlassCard>

          <LiquidGlassCard className="p-6">
            <h3 className="text-lg font-semibold text-white mb-2">2. Order Discovery</h3>
            <p className="text-white/70 mb-3">
              Your order becomes visible in the marketplace where other users can browse and search for orders.
              Users can filter by:
            </p>
            <ul className="space-y-1 text-white/60 ml-4">
              <li>• Token pairs</li>
              <li>• Price (discount from market)</li>
              <li>• Order size</li>
              <li>• Status and expiration</li>
            </ul>
          </LiquidGlassCard>

          <LiquidGlassCard className="p-6">
            <h3 className="text-lg font-semibold text-white mb-2">3. Order Filling</h3>
            <p className="text-white/70 mb-3">
              When someone wants to fill your order, they choose one of your accepted buy tokens and
              provide the required amount. They receive your sell tokens proportionally.
            </p>
            <div className="bg-white/5 p-4 rounded-lg mt-4">
              <p className="text-white/80 font-medium mb-2">Example:</p>
              <p className="text-white/60 text-sm">
                Order: Selling 1000 HEX, accepting 5000 PLS<br />
                Buyer provides 2500 PLS → receives 500 HEX (50% fill)
              </p>
            </div>
          </LiquidGlassCard>

          <LiquidGlassCard className="p-6">
            <h3 className="text-lg font-semibold text-white mb-2">4. Collecting Proceeds</h3>
            <p className="text-white/70">
              After your order is filled (partially or fully), you can collect your buy tokens anytime.
              The proceeds accumulate in the contract until you claim them. You can also cancel
              unfilled portions of your order to reclaim your sell tokens.
            </p>
          </LiquidGlassCard>
        </div>
      </div>

      {/* Key Concepts */}
      <div>
        <h2 className="text-2xl font-semibold text-white mb-4">Key Concepts</h2>

        <div className="grid md:grid-cols-2 gap-4">
          <LiquidGlassCard className="p-6">
            <h3 className="text-lg font-semibold text-white mb-2">Multi-Token Orders</h3>
            <p className="text-white/70 text-sm">
              Accept up to 50 different tokens as payment for a single order. This increases
              the chances of getting filled and gives buyers more flexibility.
            </p>
          </LiquidGlassCard>

          <LiquidGlassCard className="p-6">
            <h3 className="text-lg font-semibold text-white mb-2">Partial Fills</h3>
            <p className="text-white/70 text-sm">
              Orders can be partially filled unless marked as "All or Nothing". This allows
              multiple buyers to fill portions of large orders.
            </p>
          </LiquidGlassCard>

          <LiquidGlassCard className="p-6">
            <h3 className="text-lg font-semibold text-white mb-2">Non-Custodial</h3>
            <p className="text-white/70 text-sm">
              Your tokens are held in the smart contract, not by any centralized party.
              Only you can cancel your order and reclaim your tokens.
            </p>
          </LiquidGlassCard>

          <LiquidGlassCard className="p-6">
            <h3 className="text-lg font-semibold text-white mb-2">No Price Impact</h3>
            <p className="text-white/70 text-sm">
              Unlike AMM swaps, filling limit orders doesn't move the market price. This
              makes AgoráX ideal for large trades without slippage.
            </p>
          </LiquidGlassCard>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex flex-col md:flex-row gap-4 pt-4">
        <Link href="/docs/quick-start" className="flex-1">
          <LiquidGlassCard className="p-6 h-full hover:bg-white/5 transition-colors group">
            <div className="flex items-center gap-4">
              <svg className="w-5 h-5 text-white/40 group-hover:text-white/60 rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <div>
                <p className="text-white/60 text-sm">Previous</p>
                <p className="text-white font-medium group-hover:text-white/90">Quick Start</p>
              </div>
            </div>
          </LiquidGlassCard>
        </Link>
        <Link href="/docs/concepts/order-types" className="flex-1">
          <LiquidGlassCard className="p-6 h-full hover:bg-white/5 transition-colors group">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/60 text-sm">Next</p>
                <p className="text-white font-medium group-hover:text-white/90">Order Types</p>
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
