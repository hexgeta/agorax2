'use client';

import Link from 'next/link';
import { LiquidGlassCard } from '@/components/ui/liquid-glass';

export default function SmartContractPage() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-white/60 text-sm mb-4">
          <Link href="/docs" className="hover:text-white transition-colors">Docs</Link>
          <span>/</span>
          <Link href="/docs/technical" className="hover:text-white transition-colors">Technical</Link>
          <span>/</span>
          <span className="text-white">Smart Contract</span>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">
          Smart Contract Reference
        </h1>
        <p className="text-lg text-white/70">
          Technical documentation for the AgoráX smart contract.
        </p>
      </div>

      {/* Contract Info */}
      <LiquidGlassCard className="p-6">
        <h2 className="text-xl font-semibold text-white mb-4">Contract Information</h2>
        <div className="space-y-4">
          <div>
            <p className="text-white/60 text-sm mb-1">Mainnet Address</p>
            <code className="block bg-white/5 p-3 rounded-lg text-white/80 font-mono text-sm break-all">
              0xc8a47F14b1833310E2aC72e4C397b5b14a9FEf8B
            </code>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <p className="text-white/60 text-sm mb-1">Network</p>
              <p className="text-white">PulseChain Mainnet (Chain ID: 369)</p>
            </div>
            <div>
              <p className="text-white/60 text-sm mb-1">Native Token Address</p>
              <code className="text-white/80 font-mono text-sm">0xEeee...eEEeE</code>
            </div>
          </div>
          <a
            href="https://otter.pulsechain.com/address/0xc8a47F14b1833310E2aC72e4C397b5b14a9FEf8B"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 text-sm"
          >
            View on Block Explorer
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>
      </LiquidGlassCard>

      {/* Write Functions */}
      <div>
        <h2 className="text-2xl font-semibold text-white mb-4">User Write Functions</h2>
        <div className="space-y-4">
          <LiquidGlassCard className="p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-white font-mono">placeOrder</h3>
              <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs">payable</span>
            </div>
            <p className="text-white/70 text-sm mb-3">
              Create a new limit order with up to 50 buy tokens.
            </p>
            <div className="bg-white/5 p-3 rounded-lg font-mono text-sm">
              <p className="text-white/80">Parameters:</p>
              <ul className="text-white/60 mt-2 space-y-1">
                <li>• sellToken: address</li>
                <li>• sellAmount: uint256</li>
                <li>• buyTokensIndex: uint256[]</li>
                <li>• buyAmounts: uint256[]</li>
                <li>• expirationTime: uint64</li>
                <li>• allOrNothing: bool</li>
              </ul>
            </div>
          </LiquidGlassCard>

          <LiquidGlassCard className="p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-white font-mono">fillOrder</h3>
              <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs">payable</span>
            </div>
            <p className="text-white/70 text-sm mb-3">
              Fill an existing order by providing buy tokens.
            </p>
            <div className="bg-white/5 p-3 rounded-lg font-mono text-sm">
              <p className="text-white/80">Parameters:</p>
              <ul className="text-white/60 mt-2 space-y-1">
                <li>• orderID: uint256</li>
                <li>• buyTokenIndexInOrder: uint256</li>
                <li>• buyAmount: uint256</li>
              </ul>
            </div>
          </LiquidGlassCard>

          <LiquidGlassCard className="p-6">
            <h3 className="text-lg font-semibold text-white font-mono mb-3">cancelOrder</h3>
            <p className="text-white/70 text-sm mb-3">
              Cancel an order, reclaim unsold tokens, and collect any accumulated proceeds.
            </p>
            <div className="bg-white/5 p-3 rounded-lg font-mono text-sm">
              <p className="text-white/60">Parameters: orderID: uint256, recipient: address</p>
            </div>
          </LiquidGlassCard>

          <LiquidGlassCard className="p-6">
            <h3 className="text-lg font-semibold text-white font-mono mb-3">collectProceeds</h3>
            <p className="text-white/70 text-sm mb-3">
              Claim all accumulated buy tokens from filled orders. If a token transfer fails,
              it is skipped and the remaining tokens are still collected.
            </p>
            <div className="bg-white/5 p-3 rounded-lg font-mono text-sm">
              <p className="text-white/60">Parameters: orderID: uint256, recipient: address</p>
            </div>
          </LiquidGlassCard>

          <LiquidGlassCard className="p-6">
            <h3 className="text-lg font-semibold text-white font-mono mb-3">collectProceedsByToken</h3>
            <p className="text-white/70 text-sm mb-3">
              Claim proceeds for a specific buy token from an order. Useful for recovering tokens
              when one token in a multi-token order has transfer issues.
            </p>
            <div className="bg-white/5 p-3 rounded-lg font-mono text-sm">
              <p className="text-white/60">Parameters: orderID: uint256, buyTokenIndexInOrder: uint256, recipient: address</p>
            </div>
          </LiquidGlassCard>

          <LiquidGlassCard className="p-6">
            <h3 className="text-lg font-semibold text-white font-mono mb-3">updateOrderExpiration</h3>
            <p className="text-white/70 text-sm mb-3">
              Extend an order's expiration time.
            </p>
            <div className="bg-white/5 p-3 rounded-lg font-mono text-sm">
              <p className="text-white/60">Parameters: orderID: uint256, newExpiration: uint64</p>
            </div>
          </LiquidGlassCard>

          <LiquidGlassCard className="p-6">
            <h3 className="text-lg font-semibold text-white font-mono mb-3">cancelAllExpiredOrders</h3>
            <p className="text-white/70 text-sm mb-3">
              Batch cancel all expired orders (max 50) and collect any accumulated proceeds.
            </p>
            <div className="bg-white/5 p-3 rounded-lg font-mono text-sm">
              <p className="text-white/60">Parameters: recipient: address</p>
            </div>
          </LiquidGlassCard>
        </div>
      </div>

      {/* View Functions */}
      <div>
        <h2 className="text-2xl font-semibold text-white mb-4">Key View Functions</h2>
        <LiquidGlassCard className="p-6 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left">
                <th className="pb-3 text-white/60 font-medium">Function</th>
                <th className="pb-3 text-white/60 font-medium">Purpose</th>
              </tr>
            </thead>
            <tbody className="text-white/80">
              <tr className="border-b border-white/5">
                <td className="py-3 font-mono text-sm">getOrderDetails(orderID)</td>
                <td className="py-3">Get full order information</td>
              </tr>
              <tr className="border-b border-white/5">
                <td className="py-3 font-mono text-sm">viewUserOpenOrders(user, cursor, size)</td>
                <td className="py-3">List user's active orders</td>
              </tr>
              <tr className="border-b border-white/5">
                <td className="py-3 font-mono text-sm">viewUserExpiredOrders(user, cursor, size)</td>
                <td className="py-3">List user's expired orders</td>
              </tr>
              <tr className="border-b border-white/5">
                <td className="py-3 font-mono text-sm">viewCollectableProceeds(orderID)</td>
                <td className="py-3">Check claimable amounts</td>
              </tr>
              <tr className="border-b border-white/5">
                <td className="py-3 font-mono text-sm">findFillableOrders(sellToken, minAmount, cursor, size)</td>
                <td className="py-3">Search for fillable orders by sell token</td>
              </tr>
              <tr className="border-b border-white/5">
                <td className="py-3 font-mono text-sm">viewActiveWhitelisted(cursor, size)</td>
                <td className="py-3">Get tradable tokens</td>
              </tr>
              <tr className="border-b border-white/5">
                <td className="py-3 font-mono text-sm">getTotalOrderCount()</td>
                <td className="py-3">Platform statistics</td>
              </tr>
              <tr className="border-b border-white/5">
                <td className="py-3 font-mono text-sm">listingFee()</td>
                <td className="py-3">Current listing fee</td>
              </tr>
              <tr>
                <td className="py-3 font-mono text-sm">protocolFee()</td>
                <td className="py-3">Current protocol fee (basis points)</td>
              </tr>
            </tbody>
          </table>
        </LiquidGlassCard>
      </div>

      {/* Constants */}
      <div>
        <h2 className="text-2xl font-semibold text-white mb-4">Contract Constants</h2>
        <LiquidGlassCard className="p-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <p className="text-white/60 text-sm mb-1">Max Buy Tokens Per Order</p>
              <p className="text-white font-mono text-2xl">50</p>
            </div>
            <div>
              <p className="text-white/60 text-sm mb-1">Max Batch Cancel</p>
              <p className="text-white font-mono text-2xl">50 orders</p>
            </div>
            <div>
              <p className="text-white/60 text-sm mb-1">Cooldown Period</p>
              <p className="text-white font-mono">20 - 86,400 seconds</p>
            </div>
            <div>
              <p className="text-white/60 text-sm mb-1">Protocol Fee</p>
              <p className="text-white font-mono">basis points (100 = 1%)</p>
            </div>
          </div>
        </LiquidGlassCard>
      </div>

      {/* Gas Estimates */}
      <div>
        <h2 className="text-2xl font-semibold text-white mb-4">Gas Estimates</h2>
        <LiquidGlassCard className="p-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left">
                <th className="pb-3 text-white/60 font-medium">Function</th>
                <th className="pb-3 text-white/60 font-medium">Approximate Gas</th>
              </tr>
            </thead>
            <tbody className="text-white/80">
              <tr className="border-b border-white/5">
                <td className="py-3">placeOrder</td>
                <td className="py-3 font-mono">150k - 300k</td>
              </tr>
              <tr className="border-b border-white/5">
                <td className="py-3">fillOrder</td>
                <td className="py-3 font-mono">120k - 200k</td>
              </tr>
              <tr className="border-b border-white/5">
                <td className="py-3">cancelOrder</td>
                <td className="py-3 font-mono">80k - 150k</td>
              </tr>
              <tr className="border-b border-white/5">
                <td className="py-3">collectProceeds</td>
                <td className="py-3 font-mono">80k - 150k</td>
              </tr>
              <tr className="border-b border-white/5">
                <td className="py-3">collectProceedsByToken</td>
                <td className="py-3 font-mono">60k - 100k</td>
              </tr>
              <tr>
                <td className="py-3">updateExpiration</td>
                <td className="py-3 font-mono">50k - 70k</td>
              </tr>
            </tbody>
          </table>
        </LiquidGlassCard>
      </div>

      {/* Events */}
      <div>
        <h2 className="text-2xl font-semibold text-white mb-4">Events</h2>
        <LiquidGlassCard className="p-6">
          <div className="space-y-3 font-mono text-sm">
            <p className="text-white/80">OrderPlaced(address indexed user, uint256 indexed orderID, ...)</p>
            <p className="text-white/80">OrderCancelled(address indexed user, uint256 indexed orderID)</p>
            <p className="text-white/80">OrderFilled(address indexed buyer, uint256 indexed orderID, ...)</p>
            <p className="text-white/80">OrderProceedsCollected(address indexed user, uint256 indexed orderID, uint256[] buyTokenIndices, uint256[] amountsCollected)</p>
            <p className="text-white/80">ProceedsCollectionFailed(address indexed user, uint256 indexed orderID, address failedToken)</p>
            <p className="text-white/80">OrderExpirationUpdated(uint256 indexed orderID, uint64 newExpiration)</p>
          </div>
        </LiquidGlassCard>
      </div>

      {/* Navigation */}
      <div className="flex flex-col md:flex-row gap-4 pt-4">
        <Link href="/docs/guide/managing-orders" className="flex-1">
          <LiquidGlassCard className="p-6 h-full hover:bg-white/5 transition-colors group">
            <div className="flex items-center gap-4">
              <svg className="w-5 h-5 text-white/40 group-hover:text-white/60 rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <div>
                <p className="text-white/60 text-sm">Previous</p>
                <p className="text-white font-medium group-hover:text-white/90">Managing Orders</p>
              </div>
            </div>
          </LiquidGlassCard>
        </Link>
        <Link href="/docs/technical/api-reference" className="flex-1">
          <LiquidGlassCard className="p-6 h-full hover:bg-white/5 transition-colors group">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/60 text-sm">Next</p>
                <p className="text-white font-medium group-hover:text-white/90">API Reference</p>
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
