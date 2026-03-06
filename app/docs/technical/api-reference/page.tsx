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
        <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">
          Frontend API Reference
        </h1>
        <p className="text-lg text-white/70">
          React hooks and utilities for integrating with AgoráX.
        </p>
      </div>

      {/* Contract Hooks */}
      <div>
        <h2 className="text-2xl font-semibold text-white mb-4">Contract Interaction Hooks</h2>

        <div className="space-y-4">
          <LiquidGlassCard className="p-6">
            <h3 className="text-lg font-semibold text-white font-mono mb-3">useContractWhitelist</h3>
            <p className="text-white/70 text-sm mb-4">
              Main hook for contract write operations.
            </p>
            <CodeBlock>{`import { useContractWhitelist } from '@/hooks/contracts/useContractWhitelist';

const {
  placeOrder,
  fillOrder,
  cancelOrder,
  collectProceeds
} = useContractWhitelist();`}</CodeBlock>
          </LiquidGlassCard>

          <LiquidGlassCard className="p-6">
            <h3 className="text-lg font-semibold text-white font-mono mb-3">useContractWhitelistRead</h3>
            <p className="text-white/70 text-sm mb-4">
              Hook for reading whitelist data from the contract.
            </p>
            <CodeBlock>{`import { useContractWhitelistRead } from '@/hooks/contracts/useContractWhitelistRead';

const { activeTokens, isLoading } = useContractWhitelistRead();`}</CodeBlock>
          </LiquidGlassCard>

          <LiquidGlassCard className="p-6">
            <h3 className="text-lg font-semibold text-white font-mono mb-3">useOpenPositions</h3>
            <p className="text-white/70 text-sm mb-4">
              Hook for fetching user's orders and marketplace data.
            </p>
            <CodeBlock>{`import { useOpenPositions } from '@/hooks/contracts/useOpenPositions';

// User's own orders
const { openOrders, expiredOrders, isLoading } = useOpenPositions(address);

// All marketplace orders
const { allOrders } = useOpenPositions(undefined, true);`}</CodeBlock>
          </LiquidGlassCard>
        </div>
      </div>

      {/* Data Hooks */}
      <div>
        <h2 className="text-2xl font-semibold text-white mb-4">Data Hooks</h2>

        <div className="space-y-4">
          <LiquidGlassCard className="p-6">
            <h3 className="text-lg font-semibold text-white font-mono mb-3">useTokenPrices</h3>
            <p className="text-white/70 text-sm mb-4">
              Fetch current token prices from DEX pairs.
            </p>
            <div className="bg-white/5 p-4 rounded-lg mb-4">
              <p className="text-white/60 text-sm">Price value meanings:</p>
              <ul className="text-white/50 text-sm mt-2 space-y-1">
                <li>• <code className="text-green-400">price &gt; 0</code> - Valid market price</li>
                <li>• <code className="text-yellow-400">price === 0</code> - Failed to fetch</li>
                <li>• <code className="text-red-400">price === -1</code> - No price source</li>
              </ul>
            </div>
          </LiquidGlassCard>

          <LiquidGlassCard className="p-6">
            <h3 className="text-lg font-semibold text-white font-mono mb-3">useLimitOrderPricing</h3>
            <p className="text-white/70 text-sm mb-4">
              Centralized pricing logic for the limit order form.
            </p>
            <CodeBlock>{`import { useLimitOrderPricing } from '@/hooks/useLimitOrderPricing';

const pricing = useLimitOrderPricing({
  sellToken,
  buyToken,
  getPrice,
});

// Returns handlers and calculated values
pricing.handlePercentageClick(5); // +5%
pricing.handleLimitPriceChange(1.5);
pricing.handleSellAmountChange("1000");`}</CodeBlock>
          </LiquidGlassCard>

          <LiquidGlassCard className="p-6">
            <h3 className="text-lg font-semibold text-white font-mono mb-3">useClaimableOrdersCount</h3>
            <p className="text-white/70 text-sm mb-4">
              Count orders with unclaimed proceeds (used for NavBar badge).
            </p>
            <CodeBlock>{`import { useClaimableOrdersCount } from '@/hooks/useClaimableOrdersCount';

const { claimableCount, isLoading } = useClaimableOrdersCount();`}</CodeBlock>
          </LiquidGlassCard>
        </div>
      </div>

      {/* Utilities */}
      <div>
        <h2 className="text-2xl font-semibold text-white mb-4">Utilities</h2>

        <div className="space-y-4">
          <LiquidGlassCard className="p-6">
            <h3 className="text-lg font-semibold text-white font-mono mb-3">getContractAddress</h3>
            <p className="text-white/70 text-sm mb-4">
              Get the correct contract address for a given chain ID.
            </p>
            <CodeBlock>{`import { getContractAddress } from '@/config/testing';

const address = getContractAddress(chainId);
// 369 -> mainnet address
// 943 -> testnet address`}</CodeBlock>
          </LiquidGlassCard>

          <LiquidGlassCard className="p-6">
            <h3 className="text-lg font-semibold text-white font-mono mb-3">getBlockExplorerTxUrl</h3>
            <p className="text-white/70 text-sm mb-4">
              Generate block explorer URLs for transactions.
            </p>
            <CodeBlock>{`import { getBlockExplorerTxUrl } from '@/utils/blockExplorer';

const url = getBlockExplorerTxUrl(chainId, txHash);
// 369 -> otter.pulsechain.com
// 943 -> scan.v4.testnet.pulsechain.com`}</CodeBlock>
          </LiquidGlassCard>
        </div>
      </div>

      {/* Rate Limits & Security */}
      <div>
        <h2 className="text-2xl font-semibold text-white mb-4">Rate Limits & Security</h2>
        <LiquidGlassCard className="p-6">
          <div className="space-y-4">
            <div>
              <h3 className="text-white font-medium mb-2">API Rate Limiting</h3>
              <p className="text-white/60 text-sm">All API routes are rate limited to 300 requests/minute per IP address per endpoint.</p>
            </div>
            <div>
              <h3 className="text-white font-medium mb-2">Transaction Timeouts</h3>
              <ul className="text-white/50 text-sm space-y-1">
                <li>• Approvals: 60 seconds</li>
                <li>• Transactions: 60 seconds</li>
                <li>• Approval verification: 30 seconds</li>
              </ul>
            </div>
            <div>
              <h3 className="text-white font-medium mb-2">Amount Validation</h3>
              <ul className="text-white/50 text-sm space-y-1">
                <li>• Overflow protection (max 1e30)</li>
                <li>• Decimal precision validation</li>
                <li>• Dust attack prevention (min 1e-18)</li>
              </ul>
            </div>
          </div>
        </LiquidGlassCard>
      </div>

      {/* Constants */}
      <div>
        <h2 className="text-2xl font-semibold text-white mb-4">Token Constants</h2>
        <LiquidGlassCard className="p-6">
          <CodeBlock>{`import { TOKEN_CONSTANTS } from '@/constants/crypto';

// Each token has:
interface TokenConstant {
  t: string;      // Full name
  ticker: string; // Symbol
  a?: string;     // Contract address (undefined for PLS)
  d: number;      // Decimals
  dexs?: string[];// DEX pair addresses for pricing
}

// Whitelist filtering
const { activeTokens } = useContractWhitelistRead();
const whitelistedSet = new Set(
  activeTokens.map(t => t.tokenAddress.toLowerCase())
);

const tradableTokens = TOKEN_CONSTANTS.filter(t =>
  whitelistedSet.has(t.a?.toLowerCase() ?? '')
);`}</CodeBlock>
        </LiquidGlassCard>
      </div>

      {/* Navigation */}
      <div className="flex flex-col md:flex-row gap-4 pt-4">
        <Link href="/docs/technical/smart-contract" className="flex-1">
          <LiquidGlassCard className="p-6 h-full hover:bg-white/5 transition-colors group">
            <div className="flex items-center gap-4">
              <svg className="w-5 h-5 text-white/40 group-hover:text-white/60 rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <div>
                <p className="text-white/60 text-sm">Previous</p>
                <p className="text-white font-medium group-hover:text-white/90">Smart Contract</p>
              </div>
            </div>
          </LiquidGlassCard>
        </Link>
        <Link href="/docs/technical/data-structures" className="flex-1">
          <LiquidGlassCard className="p-6 h-full hover:bg-white/5 transition-colors group">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/60 text-sm">Next</p>
                <p className="text-white font-medium group-hover:text-white/90">Data Structures</p>
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
