'use client';

import Link from 'next/link';
import { LiquidGlassCard } from '@/components/ui/liquid-glass';

const checkIcon = (
  <svg className="w-4 h-4 text-green-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

const crossIcon = (
  <svg className="w-4 h-4 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const partialIcon = (
  <svg className="w-4 h-4 text-amber-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01" />
    <circle cx="12" cy="12" r="10" strokeWidth={1.5} />
  </svg>
);

interface Platform {
  name: string;
  chain: string;
  type: string;
  tradingFee: string;
  buyerFee: string;
  limitOrders: 'yes' | 'no' | 'partial';
  limitOrderNote?: string;
  partialFills: 'yes' | 'no' | 'partial';
  partialFillNote?: string;
  zeroSlippage: 'yes' | 'no' | 'partial';
  slippageNote?: string;
  multiTokenPayment: 'yes' | 'no';
  multiTokenNote?: string;
  mevProtection: 'yes' | 'no' | 'partial';
  mevNote?: string;
  noKyc: 'yes' | 'no';
  custody: string;
  oracleFree: 'yes' | 'no' | 'partial';
  oracleNote?: string;
  gasless: 'yes' | 'no' | 'partial';
  gasNote?: string;
  immutableContract: 'yes' | 'no' | 'partial';
  immutableNote?: string;
  audited: 'yes' | 'no' | 'partial';
  auditNote?: string;
}

const platforms: Platform[] = [
  {
    name: 'AgoraX',
    chain: 'PulseChain',
    type: 'Limit Order DEX',
    tradingFee: '0.2%',
    buyerFee: '0%',
    limitOrders: 'yes',
    partialFills: 'yes',
    partialFillNote: 'Configurable per order',
    zeroSlippage: 'yes',
    slippageNote: 'Peer-to-peer at exact price',
    multiTokenPayment: 'yes',
    multiTokenNote: 'Up to 50 tokens per order',
    mevProtection: 'yes',
    mevNote: 'Built-in cooldown mechanism',
    noKyc: 'yes',
    custody: 'Non-custodial escrow',
    oracleFree: 'yes',
    oracleNote: 'No oracle dependency',
    gasless: 'no',
    gasNote: 'Sub-cent PulseChain gas',
    immutableContract: 'yes',
    immutableNote: '100% immutable, no proxy',
    audited: 'yes',
    auditNote: '0 critical/high findings',
  },
  {
    name: 'Matcha',
    chain: 'Ethereum + 16 chains',
    type: 'DEX Aggregator',
    tradingFee: '0.10%',
    buyerFee: '0.10%',
    limitOrders: 'yes',
    limitOrderNote: 'Via 0x Protocol, off-chain book',
    partialFills: 'yes',
    zeroSlippage: 'partial',
    slippageNote: 'Limit orders only; market swaps have slippage',
    multiTokenPayment: 'no',
    mevProtection: 'partial',
    mevNote: 'Limit orders off-chain; market swaps exposed',
    noKyc: 'yes',
    custody: 'Non-custodial (wallet)',
    oracleFree: 'yes',
    oracleNote: 'Aggregated DEX quotes',
    gasless: 'partial',
    gasNote: 'Matcha Auto mode abstracts gas',
    immutableContract: 'no',
    immutableNote: 'Upgradeable protocol',
    audited: 'yes',
  },
  {
    name: '1inch',
    chain: 'Ethereum + 12 chains',
    type: 'DEX Aggregator',
    tradingFee: '0%',
    buyerFee: '0%',
    limitOrders: 'yes',
    limitOrderNote: 'Gasless; stop-loss & take-profit',
    partialFills: 'yes',
    partialFillNote: 'Configurable per order',
    zeroSlippage: 'partial',
    slippageNote: 'Fusion Dutch auction; variable on Classic',
    multiTokenPayment: 'no',
    mevProtection: 'partial',
    mevNote: 'Strong on Fusion mode; Classic exposed',
    noKyc: 'yes',
    custody: 'Non-custodial (wallet)',
    oracleFree: 'no',
    oracleNote: 'Chainlink for conditional orders',
    gasless: 'yes',
    gasNote: 'Fusion mode is gasless',
    immutableContract: 'no',
    immutableNote: 'Upgradeable protocol',
    audited: 'yes',
  },
  {
    name: 'CoW Swap',
    chain: 'Ethereum + 4 chains',
    type: 'Intent-based DEX',
    tradingFee: 'Surplus-based',
    buyerFee: 'Surplus-based',
    limitOrders: 'yes',
    limitOrderNote: 'With surplus sharing',
    partialFills: 'yes',
    partialFillNote: 'Via batch settlement',
    zeroSlippage: 'partial',
    slippageNote: 'Batch auctions minimize; not guaranteed zero',
    multiTokenPayment: 'no',
    mevProtection: 'yes',
    mevNote: 'Industry-leading batch auction model',
    noKyc: 'yes',
    custody: 'Non-custodial (intents)',
    oracleFree: 'no',
    oracleNote: 'Solver price estimators, Milkman oracles',
    gasless: 'yes',
    gasNote: 'Solvers pay gas',
    immutableContract: 'no',
    immutableNote: 'Upgradeable protocol',
    audited: 'yes',
  },
  {
    name: 'UniswapX',
    chain: 'Ethereum + Arbitrum',
    type: 'Intent-based AMM',
    tradingFee: '0%',
    buyerFee: '0%',
    limitOrders: 'no',
    limitOrderNote: 'Dutch auctions only; v4 Hooks for limits',
    partialFills: 'no',
    partialFillNote: 'All-or-nothing by default',
    zeroSlippage: 'no',
    slippageNote: 'Dutch auction with price decay',
    multiTokenPayment: 'no',
    mevProtection: 'yes',
    mevNote: 'Off-chain orders, filler competition',
    noKyc: 'yes',
    custody: 'Non-custodial (Permit2)',
    oracleFree: 'partial',
    oracleNote: 'Built-in TWAP oracle in v3/v4',
    gasless: 'yes',
    gasNote: 'Fillers pay gas',
    immutableContract: 'partial',
    immutableNote: 'v2/v3 immutable; v4 uses Hooks',
    audited: 'yes',
  },
  {
    name: 'PulseX',
    chain: 'PulseChain',
    type: 'AMM (Uniswap V2 fork)',
    tradingFee: '0.29%',
    buyerFee: '0.29%',
    limitOrders: 'no',
    limitOrderNote: 'AMM swaps only',
    partialFills: 'no',
    partialFillNote: 'All-or-revert AMM model',
    zeroSlippage: 'no',
    slippageNote: 'Standard AMM slippage on every trade',
    multiTokenPayment: 'no',
    mevProtection: 'no',
    mevNote: 'No native MEV protection',
    noKyc: 'yes',
    custody: 'Non-custodial (wallet)',
    oracleFree: 'yes',
    oracleNote: 'AMM formula pricing',
    gasless: 'no',
    gasNote: 'Sub-cent PulseChain gas',
    immutableContract: 'yes',
    immutableNote: 'Uniswap V2 fork, immutable',
    audited: 'partial',
    auditNote: 'Forked from audited Uniswap V2',
  },
  {
    name: '9inch',
    chain: 'PulseChain + Ethereum',
    type: 'AMM + Limit Orders',
    tradingFee: '0.29%',
    buyerFee: '0.29%',
    limitOrders: 'yes',
    limitOrderNote: 'Basic limit order support',
    partialFills: 'partial',
    partialFillNote: 'Not well documented',
    zeroSlippage: 'partial',
    slippageNote: 'Limit orders only; AMM swaps have slippage',
    multiTokenPayment: 'no',
    mevProtection: 'no',
    mevNote: 'No documented MEV protection',
    noKyc: 'yes',
    custody: 'Non-custodial (wallet)',
    oracleFree: 'yes',
    oracleNote: 'AMM formula pricing',
    gasless: 'no',
    gasNote: 'Sub-cent PulseChain gas',
    immutableContract: 'partial',
    immutableNote: 'Not documented',
    audited: 'partial',
    auditNote: 'Not publicly documented',
  },
];

function StatusIcon({ status }: { status: 'yes' | 'no' | 'partial' }) {
  if (status === 'yes') return checkIcon;
  if (status === 'no') return crossIcon;
  return partialIcon;
}

function FeatureCell({ status, note }: { status: 'yes' | 'no' | 'partial'; note?: string }) {
  return (
    <div className="flex items-start gap-1.5">
      <div className="mt-0.5">
        <StatusIcon status={status} />
      </div>
      {note && <span className="text-white/50 text-xs leading-tight">{note}</span>}
    </div>
  );
}

export default function ComparisonPage() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-white/60 text-sm mb-4">
          <Link href="/docs" className="hover:text-white transition-colors">Docs</Link>
          <span>/</span>
          <Link href="/docs/concepts" className="hover:text-white transition-colors">Concepts</Link>
          <span>/</span>
          <span className="text-white">Platform Comparison</span>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">
          Platform Comparison
        </h1>
        <p className="text-lg text-white/70">
          See how AgoraX compares to other popular limit order and trading platforms on PulseChain and Ethereum.
        </p>
      </div>

      {/* Legend */}
      <LiquidGlassCard className="p-4">
        <div className="flex flex-wrap gap-6 text-sm">
          <div className="flex items-center gap-2">
            {checkIcon}
            <span className="text-white/70">Fully supported</span>
          </div>
          <div className="flex items-center gap-2">
            {partialIcon}
            <span className="text-white/70">Partial / limited</span>
          </div>
          <div className="flex items-center gap-2">
            {crossIcon}
            <span className="text-white/70">Not supported</span>
          </div>
        </div>
      </LiquidGlassCard>

      {/* Fee Comparison */}
      <div>
        <h2 className="text-2xl font-semibold text-white mb-4">Fee Comparison</h2>
        <LiquidGlassCard className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left text-white/60 font-medium p-4">Platform</th>
                  <th className="text-left text-white/60 font-medium p-4">Chain</th>
                  <th className="text-left text-white/60 font-medium p-4">Type</th>
                  <th className="text-left text-white/60 font-medium p-4">Seller Fee</th>
                  <th className="text-left text-white/60 font-medium p-4">Buyer Fee</th>
                </tr>
              </thead>
              <tbody>
                {platforms.map((p, i) => (
                  <tr
                    key={p.name}
                    className={`border-b border-white/5 ${i === 0 ? 'bg-green-500/5' : ''}`}
                  >
                    <td className={`p-4 font-medium ${i === 0 ? 'text-green-400' : 'text-white'}`}>
                      {p.name}
                    </td>
                    <td className="p-4 text-white/60">{p.chain}</td>
                    <td className="p-4 text-white/60">{p.type}</td>
                    <td className={`p-4 ${i === 0 ? 'text-green-400 font-medium' : 'text-white/70'}`}>
                      {p.tradingFee}
                    </td>
                    <td className={`p-4 ${i === 0 ? 'text-green-400 font-medium' : 'text-white/70'}`}>
                      {p.buyerFee}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </LiquidGlassCard>
        <p className="text-white/50 text-xs mt-2">
          * CoW Swap takes 50% of price surplus, capped at 0.98% of order volume. 1inch and UniswapX charge 0% interface fees but execution costs may be embedded in settlement prices.
        </p>
      </div>

      {/* Feature Comparison Table */}
      <div>
        <h2 className="text-2xl font-semibold text-white mb-4">Feature Comparison</h2>
        <LiquidGlassCard className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left text-white/60 font-medium p-4 min-w-[140px]">Feature</th>
                  {platforms.map((p, i) => (
                    <th
                      key={p.name}
                      className={`text-left font-medium p-4 min-w-[120px] ${i === 0 ? 'text-green-400' : 'text-white/80'}`}
                    >
                      {p.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-white/5">
                  <td className="p-4 text-white font-medium">Limit Orders</td>
                  {platforms.map((p) => (
                    <td key={p.name} className="p-4">
                      <FeatureCell status={p.limitOrders} note={p.limitOrderNote} />
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-white/5">
                  <td className="p-4 text-white font-medium">Zero Slippage</td>
                  {platforms.map((p) => (
                    <td key={p.name} className="p-4">
                      <FeatureCell status={p.zeroSlippage} note={p.slippageNote} />
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-white/5">
                  <td className="p-4 text-white font-medium">Partial Fills</td>
                  {platforms.map((p) => (
                    <td key={p.name} className="p-4">
                      <FeatureCell status={p.partialFills} note={p.partialFillNote} />
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-white/5">
                  <td className="p-4 text-white font-medium">Multi-Token Payment</td>
                  {platforms.map((p) => (
                    <td key={p.name} className="p-4">
                      <FeatureCell status={p.multiTokenPayment} note={p.multiTokenNote} />
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-white/5">
                  <td className="p-4 text-white font-medium">MEV Protection</td>
                  {platforms.map((p) => (
                    <td key={p.name} className="p-4">
                      <FeatureCell status={p.mevProtection} note={p.mevNote} />
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-white/5">
                  <td className="p-4 text-white font-medium">No KYC</td>
                  {platforms.map((p) => (
                    <td key={p.name} className="p-4">
                      <FeatureCell status={p.noKyc} />
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-white/5">
                  <td className="p-4 text-white font-medium">Oracle-Free</td>
                  {platforms.map((p) => (
                    <td key={p.name} className="p-4">
                      <FeatureCell status={p.oracleFree} note={p.oracleNote} />
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-white/5">
                  <td className="p-4 text-white font-medium">Gasless Trading</td>
                  {platforms.map((p) => (
                    <td key={p.name} className="p-4">
                      <FeatureCell status={p.gasless} note={p.gasNote} />
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-white/5">
                  <td className="p-4 text-white font-medium">Immutable Contract</td>
                  {platforms.map((p) => (
                    <td key={p.name} className="p-4">
                      <FeatureCell status={p.immutableContract} note={p.immutableNote} />
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-white/5">
                  <td className="p-4 text-white font-medium">Audited</td>
                  {platforms.map((p) => (
                    <td key={p.name} className="p-4">
                      <FeatureCell status={p.audited} note={p.auditNote} />
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </LiquidGlassCard>
      </div>

      {/* Per-Platform Breakdown - Cards */}
      <div>
        <h2 className="text-2xl font-semibold text-white mb-4">Platform Details</h2>
        <div className="space-y-4">

          {/* AgoraX */}
          <LiquidGlassCard className="p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center">
                <span className="text-green-400 font-bold text-sm">AX</span>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-green-400">AgoraX</h3>
                <p className="text-white/50 text-xs">PulseChain &middot; Limit Order DEX</p>
              </div>
            </div>
            <p className="text-white/70 text-sm mb-3">
              Purpose-built on-chain limit order book for PulseChain. Peer-to-peer trading with zero slippage,
              0.2% seller fee (zero for buyers), multi-token payment acceptance (up to 50 tokens per order),
              configurable partial fills, and a fully immutable audited smart contract. Built-in MEV protection
              via cooldown mechanism. No oracle dependency eliminates manipulation vectors.
            </p>
            <div className="flex flex-wrap gap-2">
              <span className="text-xs px-2 py-1 rounded bg-green-500/10 text-green-400">Zero Slippage</span>
              <span className="text-xs px-2 py-1 rounded bg-green-500/10 text-green-400">0% Buyer Fee</span>
              <span className="text-xs px-2 py-1 rounded bg-green-500/10 text-green-400">Multi-Token Orders</span>
              <span className="text-xs px-2 py-1 rounded bg-green-500/10 text-green-400">Immutable</span>
              <span className="text-xs px-2 py-1 rounded bg-green-500/10 text-green-400">Audited</span>
            </div>
          </LiquidGlassCard>

          {/* Matcha */}
          <LiquidGlassCard className="p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                <span className="text-white/80 font-bold text-sm">M</span>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Matcha (0x Protocol)</h3>
                <p className="text-white/50 text-xs">Ethereum + 16 chains &middot; DEX Aggregator</p>
              </div>
            </div>
            <p className="text-white/70 text-sm mb-3">
              Multi-chain DEX aggregator powered by 0x Protocol. Aggregates 130+ liquidity sources across 16 chains.
              Offers limit orders via off-chain order book on select chains (Ethereum, Polygon, BNB Chain).
              0.10% platform fee on swaps. Matcha Auto mode provides gasless trading by abstracting gas into the trade.
              Retains positive slippage (trade surplus) on market orders.
            </p>
            <div className="flex flex-wrap gap-2">
              <span className="text-xs px-2 py-1 rounded bg-white/5 text-white/60">16 Chains</span>
              <span className="text-xs px-2 py-1 rounded bg-white/5 text-white/60">130+ Sources</span>
              <span className="text-xs px-2 py-1 rounded bg-white/5 text-white/60">Gasless (Auto)</span>
              <span className="text-xs px-2 py-1 rounded bg-amber-500/10 text-amber-400">Keeps Surplus</span>
            </div>
          </LiquidGlassCard>

          {/* 1inch */}
          <LiquidGlassCard className="p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                <span className="text-white/80 font-bold text-sm">1&quot;</span>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">1inch</h3>
                <p className="text-white/50 text-xs">Ethereum + 12 chains &middot; DEX Aggregator</p>
              </div>
            </div>
            <p className="text-white/70 text-sm mb-3">
              Leading DEX aggregator with zero platform fees. Fusion mode provides gasless, MEV-protected
              trading via Dutch auction pricing and resolver competition. Programmable limit orders support
              stop-loss, take-profit, and conditional execution. Relies on Chainlink oracles for conditional
              orders. Upgradeable protocol contracts.
            </p>
            <div className="flex flex-wrap gap-2">
              <span className="text-xs px-2 py-1 rounded bg-white/5 text-white/60">0% Fee</span>
              <span className="text-xs px-2 py-1 rounded bg-white/5 text-white/60">Gasless Fusion</span>
              <span className="text-xs px-2 py-1 rounded bg-white/5 text-white/60">Conditional Orders</span>
              <span className="text-xs px-2 py-1 rounded bg-amber-500/10 text-amber-400">Oracle Dependent</span>
            </div>
          </LiquidGlassCard>

          {/* CoW Swap */}
          <LiquidGlassCard className="p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                <span className="text-white/80 font-bold text-sm">CoW</span>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">CoW Swap</h3>
                <p className="text-white/50 text-xs">Ethereum + 4 chains &middot; Intent-based DEX</p>
              </div>
            </div>
            <p className="text-white/70 text-sm mb-3">
              Intent-based DEX with industry-leading MEV protection through batch auctions and Coincidence of Wants
              (peer-to-peer matching). Surplus-based fee model: takes 50% of price improvement, capped at 0.98%.
              Limit orders can receive better-than-expected execution. TWAP orders available via Safe wallet.
              Solvers pay gas on behalf of users.
            </p>
            <div className="flex flex-wrap gap-2">
              <span className="text-xs px-2 py-1 rounded bg-white/5 text-white/60">Best MEV Protection</span>
              <span className="text-xs px-2 py-1 rounded bg-white/5 text-white/60">Surplus Sharing</span>
              <span className="text-xs px-2 py-1 rounded bg-white/5 text-white/60">TWAP Orders</span>
              <span className="text-xs px-2 py-1 rounded bg-amber-500/10 text-amber-400">Takes 50% Surplus</span>
            </div>
          </LiquidGlassCard>

          {/* UniswapX */}
          <LiquidGlassCard className="p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                <span className="text-white/80 font-bold text-sm">UX</span>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">UniswapX</h3>
                <p className="text-white/50 text-xs">Ethereum + Arbitrum &middot; Intent-based AMM</p>
              </div>
            </div>
            <p className="text-white/70 text-sm mb-3">
              Intent-based trading layer on top of Uniswap. Uses Exclusive Dutch Orders where price decays from
              a user-favorable starting point. Zero interface fees. Fillers pay gas and compete to provide best
              execution. No traditional limit orders natively — Uniswap v4 Hooks can enable them. Orders are
              all-or-nothing by default.
            </p>
            <div className="flex flex-wrap gap-2">
              <span className="text-xs px-2 py-1 rounded bg-white/5 text-white/60">0% Fee</span>
              <span className="text-xs px-2 py-1 rounded bg-white/5 text-white/60">Gasless</span>
              <span className="text-xs px-2 py-1 rounded bg-amber-500/10 text-amber-400">No True Limit Orders</span>
              <span className="text-xs px-2 py-1 rounded bg-amber-500/10 text-amber-400">No Partial Fills</span>
            </div>
          </LiquidGlassCard>

          {/* PulseX */}
          <LiquidGlassCard className="p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                <span className="text-white/80 font-bold text-sm">PX</span>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">PulseX</h3>
                <p className="text-white/50 text-xs">PulseChain &middot; AMM (Uniswap V2 fork)</p>
              </div>
            </div>
            <p className="text-white/70 text-sm mb-3">
              Dominant AMM on PulseChain, forked from Uniswap V2. 0.29% swap fee on every trade for both sides.
              No native limit order support — only instant AMM swaps with variable slippage. No MEV protection.
              Permissionless pool creation for any token. Accounts for 70%+ of PulseChain TVL.
              Limit orders listed as a future feature.
            </p>
            <div className="flex flex-wrap gap-2">
              <span className="text-xs px-2 py-1 rounded bg-white/5 text-white/60">Largest PulseChain DEX</span>
              <span className="text-xs px-2 py-1 rounded bg-amber-500/10 text-amber-400">No Limit Orders</span>
              <span className="text-xs px-2 py-1 rounded bg-amber-500/10 text-amber-400">Slippage on All Trades</span>
              <span className="text-xs px-2 py-1 rounded bg-amber-500/10 text-amber-400">No MEV Protection</span>
            </div>
          </LiquidGlassCard>

          {/* 9inch */}
          <LiquidGlassCard className="p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                <span className="text-white/80 font-bold text-sm">9&quot;</span>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">9inch</h3>
                <p className="text-white/50 text-xs">PulseChain + Ethereum &middot; AMM + Limit Orders</p>
              </div>
            </div>
            <p className="text-white/70 text-sm mb-3">
              PulseChain DEX offering both AMM swaps and basic limit orders. 0.29% fee on all trades.
              One of the first platforms on PulseChain to introduce limit order functionality.
              Dual-token system (9INCH + BBC). No documented MEV protection. Partial fill support
              and audit status not publicly documented.
            </p>
            <div className="flex flex-wrap gap-2">
              <span className="text-xs px-2 py-1 rounded bg-white/5 text-white/60">Limit Orders</span>
              <span className="text-xs px-2 py-1 rounded bg-white/5 text-white/60">Dual Chain</span>
              <span className="text-xs px-2 py-1 rounded bg-amber-500/10 text-amber-400">No MEV Protection</span>
              <span className="text-xs px-2 py-1 rounded bg-amber-500/10 text-amber-400">Audit Unknown</span>
            </div>
          </LiquidGlassCard>
        </div>
      </div>

      {/* Why AgoraX Section */}
      <LiquidGlassCard className="p-6">
        <h2 className="text-xl font-semibold text-white mb-4">What Makes AgoraX Different</h2>
        <div className="space-y-4 text-white/70 text-sm">
          <div className="flex items-start gap-3">
            {checkIcon}
            <div>
              <strong className="text-white">Only platform with multi-token payment orders.</strong>{' '}
              Accept up to 50 different tokens as payment in a single order. No other limit order platform offers this.
            </div>
          </div>
          <div className="flex items-start gap-3">
            {checkIcon}
            <div>
              <strong className="text-white">True zero slippage, guaranteed.</strong>{' '}
              Peer-to-peer execution at your exact price. Other platforms offer &quot;reduced&quot; slippage via Dutch auctions
              or batch auctions, but only AgoraX guarantees your order fills at exactly the price you set.
            </div>
          </div>
          <div className="flex items-start gap-3">
            {checkIcon}
            <div>
              <strong className="text-white">Zero fees for buyers.</strong>{' '}
              Buyers pay no platform fee whatsoever. Most platforms charge both sides or embed costs in execution price.
            </div>
          </div>
          <div className="flex items-start gap-3">
            {checkIcon}
            <div>
              <strong className="text-white">Fully immutable smart contract.</strong>{' '}
              No proxy contracts, no upgrades, no admin overrides. Most Ethereum limit order platforms use
              upgradeable contracts that can change behavior after deployment.
            </div>
          </div>
          <div className="flex items-start gap-3">
            {checkIcon}
            <div>
              <strong className="text-white">No oracle dependency.</strong>{' '}
              Zero reliance on external price feeds. Eliminates oracle manipulation, stale prices, and
              single points of failure that affect platforms like 1inch and CoW Swap.
            </div>
          </div>
          <div className="flex items-start gap-3">
            {checkIcon}
            <div>
              <strong className="text-white">Lowest fees on PulseChain.</strong>{' '}
              0.2% seller fee vs 0.29% on PulseX and 9inch. The only PulseChain DEX with zero buyer fees.
            </div>
          </div>
        </div>
      </LiquidGlassCard>

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
        <Link href="/docs/guide/creating-orders" className="flex-1">
          <LiquidGlassCard className="p-6 h-full hover:bg-white/5 transition-colors group">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/60 text-sm">Next</p>
                <p className="text-white font-medium group-hover:text-white/90">Creating Orders</p>
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
