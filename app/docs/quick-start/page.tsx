'use client';

import Link from 'next/link';
import { LiquidGlassCard } from '@/components/ui/liquid-glass';

const steps = [
  {
    number: 1,
    title: 'Connect Your Wallet',
    description: 'Click the "Connect Wallet" button and select your preferred wallet (MetaMask, WalletConnect, etc.). Make sure you\'re connected to PulseChain Mainnet.',
  },
  {
    number: 2,
    title: 'Navigate to Swap',
    description: 'Go to the Swap page where you can create new limit orders. You\'ll see the order form with sell and buy token selectors.',
  },
  {
    number: 3,
    title: 'Select Tokens',
    description: 'Choose the token you want to sell and select one or more tokens you\'re willing to accept as payment. You can accept up to 50 different tokens!',
  },
  {
    number: 4,
    title: 'Set Your Price',
    description: 'Use the percentage buttons (+1%, +2%, +5%, +10%) to set your price above market, or drag the limit line on the chart for precise control.',
  },
  {
    number: 5,
    title: 'Approve & Create',
    description: 'Approve the token spending (one-time per token), then confirm the order creation transaction. Pay the listing fee in PLS.',
  },
  {
    number: 6,
    title: 'Monitor & Manage',
    description: 'Track your orders in "My Orders". When someone fills your order, you can collect your proceeds anytime.',
  },
];

export default function QuickStartPage() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-white/60 text-sm mb-4">
          <Link href="/docs" className="hover:text-white transition-colors">Docs</Link>
          <span>/</span>
          <span className="text-white">Quick Start</span>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">
          Quick Start Guide
        </h1>
        <p className="text-lg text-white/70">
          Get started with AgoráX in just a few minutes. Follow these steps to create your first limit order.
        </p>
      </div>

      {/* Prerequisites */}
      <LiquidGlassCard className="p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Prerequisites</h2>
        <ul className="space-y-2 text-white/70">
          <li className="flex items-start gap-2">
            <svg className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span>A Web3 wallet (MetaMask, Rabby, etc.) connected to PulseChain</span>
          </li>
          <li className="flex items-start gap-2">
            <svg className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span>PLS for gas fees and listing fee</span>
          </li>
          <li className="flex items-start gap-2">
            <svg className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span>Tokens you want to trade</span>
          </li>
        </ul>
      </LiquidGlassCard>

      {/* Steps */}
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Steps</h2>
        {steps.map((step, index) => (
          <LiquidGlassCard key={step.number} className="p-6">
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white font-bold">
                {step.number}
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">{step.title}</h3>
                <p className="text-white/70">{step.description}</p>
              </div>
            </div>
            {index < steps.length - 1 && (
              <div className="ml-5 mt-4 h-8 border-l-2 border-dashed border-white/20" />
            )}
          </LiquidGlassCard>
        ))}
      </div>

      {/* Tips */}
      <div className="animated-border rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-white mb-3">Pro Tips</h3>
        <ul className="space-y-2 text-white/70">
          <li className="flex items-start gap-2">
            <span className="text-amber-400">•</span>
            <span>Use the "Market" button to match current prices for faster fills</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-amber-400">•</span>
            <span>Accept multiple buy tokens to increase your chances of getting filled</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-amber-400">•</span>
            <span>Check the Marketplace to see current orders and market conditions</span>
          </li>
        </ul>
      </div>

      {/* Launch CTA */}
      <LiquidGlassCard className="p-6 text-center">
        <h3 className="text-xl font-semibold text-white mb-2">Ready to start trading?</h3>
        <p className="text-white/60 mb-4">Create your first limit order now</p>
        <Link
          href="/trade"
          className="inline-block px-6 py-2.5 bg-white text-black text-sm font-medium rounded-full hover:bg-white/90 transition-colors"
        >
          Launch App
        </Link>
      </LiquidGlassCard>

      {/* Navigation */}
      <div className="flex flex-col md:flex-row gap-4">
        <Link href="/docs" className="flex-1">
          <LiquidGlassCard className="p-6 h-full hover:bg-white/5 transition-colors group">
            <div className="flex items-center gap-4">
              <svg className="w-5 h-5 text-white/40 group-hover:text-white/60 rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <div>
                <p className="text-white/60 text-sm">Previous</p>
                <p className="text-white font-medium group-hover:text-white/90">Documentation</p>
              </div>
            </div>
          </LiquidGlassCard>
        </Link>
        <Link href="/docs/concepts/how-it-works" className="flex-1">
          <LiquidGlassCard className="p-6 h-full hover:bg-white/5 transition-colors group">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/60 text-sm">Next</p>
                <p className="text-white font-medium group-hover:text-white/90">How It Works</p>
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
