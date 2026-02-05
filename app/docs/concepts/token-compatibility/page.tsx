'use client';

import Link from 'next/link';
import { LiquidGlassCard } from '@/components/ui/liquid-glass';

export default function TokenCompatibilityPage() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-white/60 text-sm mb-4">
          <Link href="/docs" className="hover:text-white transition-colors">Docs</Link>
          <span>/</span>
          <Link href="/docs/concepts" className="hover:text-white transition-colors">Concepts</Link>
          <span>/</span>
          <span className="text-white">Token Compatibility</span>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">
          Token Compatibility
        </h1>
        <p className="text-lg text-white/70">
          Understanding which tokens can be used for selling and buying on AgoráX.
        </p>
      </div>

      {/* Overview */}
      <LiquidGlassCard className="p-6 border-l-4 border-blue-500/50">
        <h2 className="text-lg font-semibold text-white mb-2">Key Difference</h2>
        <p className="text-white/70">
          <strong className="text-white">Sell tokens</strong> can be any standard ERC20 token, while{' '}
          <strong className="text-white">buy tokens</strong> must be whitelisted on the platform.
          This asymmetry protects buyers while giving sellers maximum flexibility.
        </p>
      </LiquidGlassCard>

      {/* Sell Tokens */}
      <div>
        <h2 className="text-2xl font-semibold text-white mb-4">Sell Tokens (What You're Offering)</h2>
        <LiquidGlassCard className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-green-500/20 rounded-lg">
              <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-white">Any ERC20 Token Accepted</h3>
          </div>
          <p className="text-white/70 mb-4">
            You can sell any standard ERC20 token, including tokens not on the platform's whitelist.
            This allows you to exit positions in any token you hold.
          </p>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <span className="text-green-400">✓</span>
              <span className="text-white/70">Whitelisted tokens (PLS, HEX, PLSX, INC, etc.)</span>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-green-400">✓</span>
              <span className="text-white/70">Non-whitelisted tokens</span>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-green-400">✓</span>
              <span className="text-white/70">Native PLS is also supported without the need for wrapping</span>
            </div>
          </div>
        </LiquidGlassCard>
      </div>

      {/* Buy Tokens */}
      <div>
        <h2 className="text-2xl font-semibold text-white mb-4">Buy Tokens (What You Want to Receive)</h2>
        <LiquidGlassCard className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-yellow-500/20 rounded-lg">
              <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-white">Whitelist Required</h3>
          </div>
          <p className="text-white/70 mb-4">
            Buy tokens must be whitelisted and active on the platform. This protects order fillers from
            receiving worthless or scam tokens.
          </p>
          <div className="bg-white/5 p-4 rounded-lg">
            <h4 className="text-white font-medium mb-2">Why Whitelisting?</h4>
            <ul className="space-y-2 text-white/60 text-sm">
              <li>• Filters out problematic rebasing and tax/fee-on-transfer tokens</li>
              <li>• Protects buyers from receiving scam/worthless tokens</li>
            </ul>
          </div>
        </LiquidGlassCard>
      </div>

      {/* Incompatible Tokens */}
      <div>
        <h2 className="text-2xl font-semibold text-white mb-4">Incompatible Token Types</h2>
        <div className="space-y-4">
          <LiquidGlassCard className="p-6 border-l-4 border-red-500/50">
            <h3 className="text-lg font-semibold text-white mb-2">Fee-on-Transfer Tokens</h3>
            <p className="text-white/70 mb-3">
              Tokens that deduct a fee on every transfer are <strong className="text-red-400">NOT supported</strong>.
              The contract verifies exact transfer amounts and will reject these tokens.
            </p>
            <div className="bg-red-500/10 p-3 rounded-lg">
              <p className="text-red-300 text-sm">
                Transaction will revert with "Transfer amount mismatch" error.
              </p>
            </div>
          </LiquidGlassCard>

          <LiquidGlassCard className="p-6 border-l-4 border-yellow-500/50">
            <h3 className="text-lg font-semibold text-white mb-2">Rebasing Tokens</h3>
            <p className="text-white/70 mb-3">
              Tokens that automatically adjust balances (elastic supply) are <strong className="text-yellow-400">NOT recommended</strong>.
              They may cause unexpected behavior or transaction failures.
            </p>
            <div className="bg-yellow-500/10 p-3 rounded-lg">
              <p className="text-yellow-300 text-sm">
                They may cause unexpected behavior, transaction failures, or stuck funds.
              </p>
            </div>
          </LiquidGlassCard>
        </div>
      </div>

      {/* Compatibility Table */}
      <div>
        <h2 className="text-2xl font-semibold text-white mb-4">Compatibility Summary</h2>
        <LiquidGlassCard className="p-6 overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left border-b border-white/10">
                <th className="pb-3 text-white/60 font-medium">Token Type</th>
                <th className="pb-3 text-white/60 font-medium text-center">As Sell Token</th>
                <th className="pb-3 text-white/60 font-medium text-center">As Buy Token</th>
              </tr>
            </thead>
            <tbody className="text-white/80">
              <tr className="border-b border-white/5">
                <td className="py-3">Standard ERC20 (whitelisted)</td>
                <td className="py-3 text-center"><span className="text-green-400">✓</span></td>
                <td className="py-3 text-center"><span className="text-green-400">✓</span></td>
              </tr>
              <tr className="border-b border-white/5">
                <td className="py-3">Standard ERC20 (not whitelisted)</td>
                <td className="py-3 text-center"><span className="text-green-400">✓</span></td>
                <td className="py-3 text-center"><span className="text-red-400">✗</span></td>
              </tr>
              <tr className="border-b border-white/5">
                <td className="py-3">Native PLS</td>
                <td className="py-3 text-center"><span className="text-green-400">✓</span></td>
                <td className="py-3 text-center"><span className="text-green-400">✓</span></td>
              </tr>
              <tr className="border-b border-white/5">
                <td className="py-3">Fee-on-transfer tokens</td>
                <td className="py-3 text-center"><span className="text-red-400">✗</span></td>
                <td className="py-3 text-center"><span className="text-red-400">✗</span></td>
              </tr>
              <tr>
                <td className="py-3">Rebasing tokens</td>
                <td className="py-3 text-center"><span className="text-yellow-400">⚠</span></td>
                <td className="py-3 text-center"><span className="text-red-400">✗</span></td>
              </tr>
            </tbody>
          </table>
        </LiquidGlassCard>
      </div>

      {/* Request Whitelist */}
      <LiquidGlassCard className="p-6">
        <h2 className="text-lg font-semibold text-white mb-2">Request Token Whitelisting</h2>
        <p className="text-white/70">
          Contact the platform administrators to request whitelist additions for legitimate tokens
          with sufficient liquidity and community demand.
        </p>
      </LiquidGlassCard>

      {/* Navigation */}
      <div className="flex flex-col md:flex-row gap-4 pt-4">
        <Link href="/docs/concepts/order-types" className="flex-1">
          <LiquidGlassCard className="p-6 h-full hover:bg-white/5 transition-colors group">
            <div className="flex items-center gap-4">
              <svg className="w-5 h-5 text-white/40 group-hover:text-white/60 rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <div>
                <p className="text-white/60 text-sm">Previous</p>
                <p className="text-white font-medium group-hover:text-white/90">Order Types</p>
              </div>
            </div>
          </LiquidGlassCard>
        </Link>
        <Link href="/docs/concepts/pricing-fees" className="flex-1">
          <LiquidGlassCard className="p-6 h-full hover:bg-white/5 transition-colors group">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/60 text-sm">Next</p>
                <p className="text-white font-medium group-hover:text-white/90">Pricing & Fees</p>
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
