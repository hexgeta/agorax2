'use client';

import Link from 'next/link';
import { LiquidGlassCard } from '@/components/ui/liquid-glass';

export default function DataStructuresPage() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-white/60 text-sm mb-4">
          <Link href="/docs" className="hover:text-white transition-colors">Docs</Link>
          <span>/</span>
          <Link href="/docs/technical" className="hover:text-white transition-colors">Technical</Link>
          <span>/</span>
          <span className="text-white">Data Structures</span>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">
          Data Structures
        </h1>
        <p className="text-lg text-white/70">
          Key data structures used in the AgoráX smart contract and frontend.
        </p>
      </div>

      {/* Order Status */}
      <LiquidGlassCard className="p-6">
        <h2 className="text-xl font-semibold text-white mb-4">OrderStatus Enum</h2>
        <p className="text-white/70 text-sm mb-4">
          Represents the current state of an order.
        </p>
        <div className="bg-white/5 p-4 rounded-lg font-mono text-sm">
          <pre className="text-white/80">{`enum OrderStatus {
  Active = 0,     // Order is live and fillable
  Cancelled = 1,  // Order was cancelled by owner
  Completed = 2   // Order was fully filled
}`}</pre>
        </div>
        <div className="mt-4 grid md:grid-cols-3 gap-3">
          <div className="flex items-center gap-2 p-3 bg-green-500/10 rounded-lg">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span className="text-white/80 text-sm">0 = Active</span>
          </div>
          <div className="flex items-center gap-2 p-3 bg-red-500/10 rounded-lg">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <span className="text-white/80 text-sm">1 = Cancelled</span>
          </div>
          <div className="flex items-center gap-2 p-3 bg-blue-500/10 rounded-lg">
            <div className="w-3 h-3 rounded-full bg-blue-500" />
            <span className="text-white/80 text-sm">2 = Completed</span>
          </div>
        </div>
      </LiquidGlassCard>

      {/* OrderDetails Struct */}
      <LiquidGlassCard className="p-6">
        <h2 className="text-xl font-semibold text-white mb-4">OrderDetails Struct (Solidity)</h2>
        <p className="text-white/70 text-sm mb-4">
          Core structure for storing order information on-chain.
        </p>
        <div className="bg-white/5 p-4 rounded-lg font-mono text-sm overflow-x-auto">
          <pre className="text-white/80">{`struct OrderDetails {
    address sellToken;        // Token being sold
    uint256 sellAmount;       // Total amount to sell
    uint256[] buyTokensIndex; // Indices into whitelist
    uint256[] buyAmounts;     // Required amounts per buy token
    uint64 expirationTime;    // Unix timestamp
    bool allOrNothing;        // Must fill 100% at once
}`}</pre>
        </div>
      </LiquidGlassCard>

      {/* OrderDetailsWithID Struct */}
      <LiquidGlassCard className="p-6">
        <h2 className="text-xl font-semibold text-white mb-4">OrderDetailsWithID Struct</h2>
        <p className="text-white/70 text-sm mb-4">
          Extended order information returned by view functions.
        </p>
        <div className="bg-white/5 p-4 rounded-lg font-mono text-sm overflow-x-auto">
          <pre className="text-white/80">{`struct OrderDetailsWithID {
    uint256 orderID;             // Unique order identifier
    address owner;               // Order creator
    OrderDetails orderDetails;   // Core order data
    OrderStatus status;          // Current status
    uint256 remainingSellAmount; // Unfilled sell tokens
    uint256 redeemedSellAmount;  // Proceeds already claimed
    uint256 cooldownExpiry;      // When actions are unlocked
}`}</pre>
        </div>
      </LiquidGlassCard>

      {/* Frontend Types */}
      <div>
        <h2 className="text-2xl font-semibold text-white mb-4">Frontend TypeScript Types</h2>

        <div className="space-y-4">
          <LiquidGlassCard className="p-6">
            <h3 className="text-lg font-semibold text-white font-mono mb-3">CompleteOrderDetails</h3>
            <p className="text-white/70 text-sm mb-4">
              Full order data as used in the React frontend.
            </p>
            <div className="bg-white/5 p-4 rounded-lg font-mono text-sm overflow-x-auto">
              <pre className="text-white/80">{`interface CompleteOrderDetails {
  orderDetailsWithID: {
    orderID: bigint;
    owner: \`0x\${string}\`;
    status: number;
    remainingSellAmount: bigint;
    redeemedSellAmount: bigint;
    cooldownExpiry: bigint;
    orderDetails: {
      sellToken: \`0x\${string}\`;
      sellAmount: bigint;
      buyTokensIndex: readonly bigint[];
      buyAmounts: readonly bigint[];
      expirationTime: bigint;
      allOrNothing: boolean;
    };
  };
  buyTokenAddresses: readonly \`0x\${string}\`[];
}`}</pre>
            </div>
          </LiquidGlassCard>


          <LiquidGlassCard className="p-6">
            <h3 className="text-lg font-semibold text-white font-mono mb-3">TokenConstant</h3>
            <p className="text-white/70 text-sm mb-4">
              Token configuration from the constants file.
            </p>
            <div className="bg-white/5 p-4 rounded-lg font-mono text-sm overflow-x-auto">
              <pre className="text-white/80">{`interface TokenConstant {
  t: string;          // Full name (e.g., "PulseChain")
  ticker: string;     // Symbol (e.g., "PLS")
  a?: string;         // Contract address (undefined for native)
  d: number;          // Decimals (usually 18)
  dexs?: string[];    // DEX pair addresses for pricing
  logoFormat?: string;// "svg" | "png" | "webp"
}`}</pre>
            </div>
          </LiquidGlassCard>
        </div>
      </div>

      {/* Whitelist Token */}
      <LiquidGlassCard className="p-6">
        <h2 className="text-xl font-semibold text-white mb-4">Whitelist Token</h2>
        <p className="text-white/70 text-sm mb-4">
          Token data returned from the contract whitelist.
        </p>
        <div className="bg-white/5 p-4 rounded-lg font-mono text-sm overflow-x-auto">
          <pre className="text-white/80">{`interface WhitelistToken {
  tokenAddress: \`0x\${string}\`;
  isActive: boolean;
  whitelistIndex: bigint;
}`}</pre>
        </div>
      </LiquidGlassCard>

      {/* Filter State */}
      <LiquidGlassCard className="p-6">
        <h2 className="text-xl font-semibold text-white mb-4">Filter State (URL Params)</h2>
        <p className="text-white/70 text-sm mb-4">
          Filter configuration stored in URL query parameters.
        </p>
        <div className="bg-white/5 p-4 rounded-lg font-mono text-sm overflow-x-auto">
          <pre className="text-white/80">{`interface FilterState {
  searchQuery: string;   // order-id | seller | ticker
  status: 'active' | 'expired' | 'completed' | 'cancelled';
  dateFilter: '1h' | '12h' | '24h' | '7d' | '30d' | '90d' | '180d' | 'custom' | null;
  customDateStart: number | null;  // Unix timestamp
  customDateEnd: number | null;    // Unix timestamp
  aonFilter: boolean;              // All-or-nothing only
  dustFilter: string | null;       // Min USD value
  claimableFilter: boolean;        // Has claimable proceeds
  fillRange: [number, number];     // 0-100 % filled
  positionRange: [number, number]; // -100 to +100 limit position
}`}</pre>
        </div>
      </LiquidGlassCard>

      {/* Navigation */}
      <div className="flex flex-col md:flex-row gap-4 pt-4">
        <Link href="/docs/technical/api-reference" className="flex-1">
          <LiquidGlassCard className="p-6 h-full hover:bg-white/5 transition-colors group">
            <div className="flex items-center gap-4">
              <svg className="w-5 h-5 text-white/40 group-hover:text-white/60 rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <div>
                <p className="text-white/60 text-sm">Previous</p>
                <p className="text-white font-medium group-hover:text-white/90">API Reference</p>
              </div>
            </div>
          </LiquidGlassCard>
        </Link>
        <Link href="/docs/security/audit" className="flex-1">
          <LiquidGlassCard className="p-6 h-full hover:bg-white/5 transition-colors group">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/60 text-sm">Next</p>
                <p className="text-white font-medium group-hover:text-white/90">Security Audit</p>
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
