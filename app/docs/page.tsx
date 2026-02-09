'use client';

import Link from 'next/link';
import { LiquidGlassCard } from '@/components/ui/liquid-glass';

export default function DocsPage() {
  return (
    <div className="space-y-12">
      {/* Hero Section */}
      <div className="text-center space-y-4">
        <h1 className="text-4xl md:text-5xl font-bold text-white">
          AgoráX Documentation
        </h1>
        <p className="text-lg text-white/70 max-w-2xl mx-auto">
          The decentralized OTC limit order platform on PulseChain. Trade any token at your price,
          with up to 50 accepted payment tokens per order.
        </p>
      </div>

      {/* Contract Info */}
      <LiquidGlassCard className="p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Contract Information</h2>
        <div className="space-y-3">
          <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
            <span className="text-white/60 text-sm">Mainnet Address:</span>
            <code className="text-sm bg-white/5 px-3 py-1.5 rounded font-mono text-white/80 break-all">
              0xc8a47F14b1833310E2aC72e4C397b5b14a9FEf8B
            </code>
          </div>
          <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
            <span className="text-white/60 text-sm">Network:</span>
            <span className="text-white/80 text-sm">PulseChain Mainnet (Chain ID: 369)</span>
          </div>
          <a
            href="https://otter.pulsechain.com/address/0xc8a47F14b1833310E2aC72e4C397b5b14a9FEf8B"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors mt-2"
          >
            View on Block Explorer
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>
      </LiquidGlassCard>

      {/* Navigation */}
      <div className="flex justify-end">
        <Link href="/docs/quick-start" className="flex-1 max-w-sm">
          <LiquidGlassCard className="p-6 h-full hover:bg-white/5 transition-colors group">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/60 text-sm">Next</p>
                <p className="text-white font-medium group-hover:text-white/90">Quick Start</p>
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
