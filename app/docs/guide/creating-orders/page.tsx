'use client';

import Link from 'next/link';
import { LiquidGlassCard } from '@/components/ui/liquid-glass';

export default function CreatingOrdersPage() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-white/60 text-sm mb-4">
          <Link href="/docs" className="hover:text-white transition-colors">Docs</Link>
          <span>/</span>
          <Link href="/docs/guide" className="hover:text-white transition-colors">Guide</Link>
          <span>/</span>
          <span className="text-white">Creating Orders</span>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">
          Creating Orders
        </h1>
        <p className="text-lg text-white/70">
          Step-by-step guide to creating limit orders on AgoráX.
        </p>
      </div>

      {/* Steps */}
      <div className="space-y-6">
        {/* Step 1 */}
        <LiquidGlassCard className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white font-bold">
              1
            </div>
            <h2 className="text-xl font-semibold text-white">Select Your Sell Token</h2>
          </div>
          <p className="text-white/70 mb-4">
            Click on the token selector in the "You're Selling" section and choose the token you want to sell.
            You can search by name, ticker, or paste a contract address.
          </p>
          <div className="bg-white/5 p-4 rounded-lg">
            <p className="text-white/60 text-sm">
              <strong className="text-white">Tip:</strong> Any standard ERC20 token can be sold, even if it's not
              on the whitelist. However, fee-on-transfer tokens are not supported.
            </p>
          </div>
        </LiquidGlassCard>

        {/* Step 2 */}
        <LiquidGlassCard className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white font-bold">
              2
            </div>
            <h2 className="text-xl font-semibold text-white">Enter Sell Amount</h2>
          </div>
          <p className="text-white/70 mb-4">
            Enter the amount of tokens you want to sell. You can use the "MAX" button to sell your entire balance.
          </p>
          <div className="flex items-center gap-2 text-white/60 text-sm">
            <svg className="w-4 h-4 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>Leave some balance for gas fees if selling native PLS</span>
          </div>
        </LiquidGlassCard>

        {/* Step 3 */}
        <LiquidGlassCard className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white font-bold">
              3
            </div>
            <h2 className="text-xl font-semibold text-white">Select Buy Token(s)</h2>
          </div>
          <p className="text-white/70 mb-4">
            Choose one or more tokens you're willing to accept as payment. You can add up to 50 different tokens
            to maximize your chances of getting filled.
          </p>
          <div className="grid md:grid-cols-2 gap-4 mt-4">
            <div className="bg-white/5 p-4 rounded-lg">
              <p className="text-white font-medium text-sm mb-2">Single Token</p>
              <p className="text-white/60 text-sm">Simple setup, clear pricing</p>
            </div>
            <div className="bg-white/5 p-4 rounded-lg">
              <p className="text-white font-medium text-sm mb-2">Multiple Tokens</p>
              <p className="text-white/60 text-sm">More flexibility, higher fill probability</p>
            </div>
          </div>
        </LiquidGlassCard>

        {/* Step 4 */}
        <LiquidGlassCard className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white font-bold">
              4
            </div>
            <h2 className="text-xl font-semibold text-white">Set Your Price</h2>
          </div>
          <p className="text-white/70 mb-4">
            Use the percentage buttons to set your price relative to the current market rate, or manually
            adjust using the chart or input fields.
          </p>
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <span className="px-3 py-1.5 bg-white/10 rounded-lg text-white text-sm">Market</span>
              <span className="px-3 py-1.5 bg-white/10 rounded-lg text-white text-sm">+1%</span>
              <span className="px-3 py-1.5 bg-white/10 rounded-lg text-white text-sm">+2%</span>
              <span className="px-3 py-1.5 bg-white/10 rounded-lg text-white text-sm">+5%</span>
              <span className="px-3 py-1.5 bg-white/10 rounded-lg text-white text-sm">+10%</span>
            </div>
            <p className="text-white/60 text-sm">
              Higher percentages mean better prices for you, but may take longer to fill.
            </p>
          </div>
        </LiquidGlassCard>

        {/* Step 5 */}
        <LiquidGlassCard className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white font-bold">
              5
            </div>
            <h2 className="text-xl font-semibold text-white">Configure Order Options</h2>
          </div>
          <div className="space-y-4 text-white/70">
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 rounded border border-white/30 flex items-center justify-center mt-0.5">
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <p className="text-white font-medium">All or Nothing</p>
                <p className="text-sm">Require the entire order to be filled in one transaction</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 rounded border border-white/30 flex items-center justify-center mt-0.5">
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-white font-medium">Expiration Time</p>
                <p className="text-sm">Set when your order expires (default: 7 days)</p>
              </div>
            </div>
          </div>
        </LiquidGlassCard>

        {/* Step 6 */}
        <LiquidGlassCard className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white font-bold">
              6
            </div>
            <h2 className="text-xl font-semibold text-white">Approve & Confirm</h2>
          </div>
          <p className="text-white/70 mb-4">
            If this is your first time selling this token, you'll need to approve it first. Then confirm
            the order creation transaction.
          </p>
          <div className="space-y-3">
            <div className="bg-blue-500/10 p-4 rounded-lg border border-blue-500/20">
              <p className="text-blue-300 text-sm">
                <strong>Step 1:</strong> Approve token spending (one-time per token)
              </p>
            </div>
            <div className="bg-green-500/10 p-4 rounded-lg border border-green-500/20">
              <p className="text-green-300 text-sm">
                <strong>Step 2:</strong> Confirm order creation (includes listing fee)
              </p>
            </div>
          </div>
        </LiquidGlassCard>
      </div>

      {/* Best Practices */}
      <div className="animated-border rounded-2xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Best Practices</h2>
        <ul className="space-y-3 text-white/70">
          <li className="flex items-start gap-2">
            <span className="text-amber-400">•</span>
            <span>Start with smaller orders to test the process</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-amber-400">•</span>
            <span>Accept multiple buy tokens to increase fill probability</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-amber-400">•</span>
            <span>Check current market prices before setting your limit</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-amber-400">•</span>
            <span>Set reasonable expiration times based on your urgency</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-amber-400">•</span>
            <span>Monitor your orders in the "My Orders" section</span>
          </li>
        </ul>
      </div>

      {/* Navigation */}
      <div className="flex flex-col md:flex-row gap-4 pt-4">
        <Link href="/docs/concepts/pricing-fees" className="flex-1">
          <LiquidGlassCard className="p-6 h-full hover:bg-white/5 transition-colors group">
            <div className="flex items-center gap-4">
              <svg className="w-5 h-5 text-white/40 group-hover:text-white/60 rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <div>
                <p className="text-white/60 text-sm">Previous</p>
                <p className="text-white font-medium group-hover:text-white/90">Pricing & Fees</p>
              </div>
            </div>
          </LiquidGlassCard>
        </Link>
        <Link href="/docs/guide/filling-orders" className="flex-1">
          <LiquidGlassCard className="p-6 h-full hover:bg-white/5 transition-colors group">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/60 text-sm">Next</p>
                <p className="text-white font-medium group-hover:text-white/90">Filling Orders</p>
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
