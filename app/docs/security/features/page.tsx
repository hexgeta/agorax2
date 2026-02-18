'use client';

import Link from 'next/link';
import { LiquidGlassCard } from '@/components/ui/liquid-glass';

export default function SecurityFeaturesPage() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-white/60 text-sm mb-4">
          <Link href="/docs" className="hover:text-white transition-colors">Docs</Link>
          <span>/</span>
          <Link href="/docs/security" className="hover:text-white transition-colors">Security</Link>
          <span>/</span>
          <span className="text-white">Security Features</span>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">
          Security Features
        </h1>
        <p className="text-lg text-white/70">
          An overview of the security measures implemented in AgoráX.
        </p>
      </div>

      {/* Smart Contract Security */}
      <div>
        <h2 className="text-2xl font-semibold text-white mb-4">Smart Contract Security</h2>
        <div className="space-y-4">
          <LiquidGlassCard className="p-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-green-500/20 rounded-xl text-green-400 flex-shrink-0">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Reentrancy Protection</h3>
                <p className="text-white/70 text-sm">
                  All state changes are performed before external calls (Checks-Effects-Interactions pattern).
                  This prevents attackers from exploiting callback mechanisms to manipulate contract state.
                </p>
              </div>
            </div>
          </LiquidGlassCard>

          <LiquidGlassCard className="p-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-blue-500/20 rounded-xl text-blue-400 flex-shrink-0">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Transfer Verification</h3>
                <p className="text-white/70 text-sm">
                  Every token transfer is verified by checking balance changes before and after.
                  This catches fee-on-transfer tokens and prevents amount manipulation attacks.
                </p>
                <div className="mt-3 bg-white/5 p-3 rounded-lg font-mono text-xs text-white/60">
                  require(balanceAfter - balanceBefore == amount, "Transfer mismatch");
                </div>
              </div>
            </div>
          </LiquidGlassCard>

          <LiquidGlassCard className="p-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-purple-500/20 rounded-xl text-purple-400 flex-shrink-0">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Cooldown Mechanism</h3>
                <p className="text-white/70 text-sm">
                  A configurable cooldown period (20-86400 seconds) prevents rapid order manipulation
                  and front-running attacks. Users must wait before cancelling or modifying orders.
                </p>
              </div>
            </div>
          </LiquidGlassCard>

          <LiquidGlassCard className="p-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-yellow-500/20 rounded-xl text-yellow-400 flex-shrink-0">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Whitelist System</h3>
                <p className="text-white/70 text-sm">
                  Buy tokens must be whitelisted and active. This protects users from receiving
                  worthless, malicious, or honeypot tokens when filling orders.
                </p>
              </div>
            </div>
          </LiquidGlassCard>

          <LiquidGlassCard className="p-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-red-500/20 rounded-xl text-red-400 flex-shrink-0">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Batch Operation Limits</h3>
                <p className="text-white/70 text-sm">
                  Batch operations (like cancelling multiple orders) are limited to 50 items per transaction.
                  This prevents gas griefing attacks and ensures transactions stay within block limits.
                </p>
              </div>
            </div>
          </LiquidGlassCard>

          <LiquidGlassCard className="p-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-cyan-500/20 rounded-xl text-cyan-400 flex-shrink-0">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Graceful Proceeds Collection</h3>
                <p className="text-white/70 text-sm">
                  When collecting proceeds from multi-token orders, if one token has a transfer issue
                  (paused contract, blacklisted address, etc.), the remaining tokens are still collected
                  successfully. Failed tokens can be retried individually later. This prevents a single
                  broken token from locking all your proceeds.
                </p>
              </div>
            </div>
          </LiquidGlassCard>

          <LiquidGlassCard className="p-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-emerald-500/20 rounded-xl text-emerald-400 flex-shrink-0">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">No Price Oracle Dependency</h3>
                <p className="text-white/70 text-sm">
                  AgoráX operates without reliance on external price oracles. Order prices are set directly
                  by makers and accepted by fillers, eliminating oracle manipulation risks, stale price
                  vulnerabilities, and single points of failure that plague many DeFi protocols.
                </p>
              </div>
            </div>
          </LiquidGlassCard>
        </div>
      </div>

      {/* Frontend Security */}
      <div>
        <h2 className="text-2xl font-semibold text-white mb-4">Frontend Security</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <LiquidGlassCard className="p-5">
            <h3 className="text-white font-medium mb-2">Rate Limiting</h3>
            <p className="text-white/60 text-sm">
              API endpoints are rate-limited to prevent abuse and DoS attacks.
            </p>
            <ul className="mt-2 text-white/50 text-xs space-y-1">
              <li>• Validation: 20 req/min</li>
              <li>• Data: 60 req/min</li>
            </ul>
          </LiquidGlassCard>

          <LiquidGlassCard className="p-5">
            <h3 className="text-white font-medium mb-2">Transaction Timeouts</h3>
            <p className="text-white/60 text-sm">
              All blockchain operations have timeouts to prevent hanging transactions.
            </p>
            <ul className="mt-2 text-white/50 text-xs space-y-1">
              <li>• Approvals: 60s</li>
              <li>• Transactions: 60s</li>
            </ul>
          </LiquidGlassCard>

          <LiquidGlassCard className="p-5">
            <h3 className="text-white font-medium mb-2">Input Validation</h3>
            <p className="text-white/60 text-sm">
              All user inputs are validated before processing.
            </p>
            <ul className="mt-2 text-white/50 text-xs space-y-1">
              <li>• Overflow protection</li>
              <li>• Decimal precision</li>
              <li>• Dust prevention</li>
            </ul>
          </LiquidGlassCard>

          <LiquidGlassCard className="p-5">
            <h3 className="text-white font-medium mb-2">Content Security Policy</h3>
            <p className="text-white/60 text-sm">
              Strict CSP headers prevent XSS and injection attacks.
            </p>
          </LiquidGlassCard>
        </div>
      </div>

      {/* User Safety */}
      <div>
        <h2 className="text-2xl font-semibold text-white mb-4">User Safety Guidelines</h2>
        <LiquidGlassCard className="p-6">
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <span className="text-green-400 text-lg">1.</span>
              <div>
                <p className="text-white font-medium">Verify Transaction Details</p>
                <p className="text-white/60 text-sm">Always review token addresses and amounts in your wallet before confirming transactions.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-green-400 text-lg">2.</span>
              <div>
                <p className="text-white font-medium">Check Token Contracts</p>
                <p className="text-white/60 text-sm">Verify that tokens you're trading are legitimate by checking their contract addresses on the block explorer.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-green-400 text-lg">3.</span>
              <div>
                <p className="text-white font-medium">Start with Small Amounts</p>
                <p className="text-white/60 text-sm">When trading new tokens or trying new features, start with small amounts to verify everything works as expected.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-green-400 text-lg">4.</span>
              <div>
                <p className="text-white font-medium">Understand Order Terms</p>
                <p className="text-white/60 text-sm">Review all order details including expiration, accepted tokens, and all-or-nothing settings before creating or filling orders.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-green-400 text-lg">5.</span>
              <div>
                <p className="text-white font-medium">Monitor Your Orders</p>
                <p className="text-white/60 text-sm">Regularly check your open orders and collect proceeds from filled orders promptly.</p>
              </div>
            </div>
          </div>
        </LiquidGlassCard>
      </div>

      {/* Disclaimer */}
      <div className="animated-border rounded-2xl p-6">
        <h2 className="text-lg font-semibold text-white mb-3">Important Disclaimer</h2>
        <p className="text-white/70 text-sm">
          While AgoráX implements robust security measures, DeFi protocols carry inherent risks including
          smart contract vulnerabilities, market volatility, and user errors. Never invest more than you
          can afford to lose. Always do your own research and understand the risks before using any
          decentralized application.
        </p>
      </div>

      {/* Contract Verification */}
      <LiquidGlassCard className="p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Contract Verification</h2>
        <p className="text-white/70 text-sm mb-4">
          The AgoráX smart contract source code is verified and publicly available:
        </p>
        <div className="space-y-3">
          <a
            href="https://otter.pulsechain.com/address/0x06856CEa795D001bED91acdf1264CaB174949bf3"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-blue-400 hover:text-blue-300 text-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            View Verified Contract on Otter Explorer
          </a>
          <p className="text-white/50 text-xs">
            Contract: 0x06856CEa795D001bED91acdf1264CaB174949bf3
          </p>
        </div>
      </LiquidGlassCard>

      {/* Navigation */}
      <div className="flex flex-col md:flex-row gap-4 pt-4">
        <Link href="/docs/security/audit" className="flex-1">
          <LiquidGlassCard className="p-6 h-full hover:bg-white/5 transition-colors group">
            <div className="flex items-center gap-4">
              <svg className="w-5 h-5 text-white/40 group-hover:text-white/60 rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <div>
                <p className="text-white/60 text-sm">Previous</p>
                <p className="text-white font-medium group-hover:text-white/90">Audit Report</p>
              </div>
            </div>
          </LiquidGlassCard>
        </Link>
        <Link href="/docs" className="flex-1">
          <LiquidGlassCard className="p-6 h-full hover:bg-white/5 transition-colors group">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/60 text-sm">Back to</p>
                <p className="text-white font-medium group-hover:text-white/90">Documentation Home</p>
              </div>
              <svg className="w-5 h-5 text-white/40 group-hover:text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
            </div>
          </LiquidGlassCard>
        </Link>
      </div>
    </div>
  );
}
