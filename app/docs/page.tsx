'use client';

import Link from 'next/link';
import { LiquidGlassCard } from '@/components/ui/liquid-glass';

const features = [
  {
    title: 'Limit Orders',
    description: 'Set your price and let the market come to you. Create orders with up to 50 different buy tokens.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    href: '/docs/concepts/how-it-works',
  },
  {
    title: 'OTC Trading',
    description: 'Trade directly peer-to-peer without impacting market prices. Perfect for large trades.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
      </svg>
    ),
    href: '/docs/guide/creating-orders',
  },
  {
    title: 'Discover Orders',
    description: 'Find the best deals with our AI-powered recommendation system. Swipe to save orders.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    ),
    href: '/docs/guide/discover',
  },
  {
    title: 'Secure & Audited',
    description: 'Smart contract audited and battle-tested. Your funds are protected by robust security measures.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
    href: '/docs/security/audit',
  },
];

const quickLinks = [
  { title: 'Create Your First Order', href: '/docs/guide/creating-orders', description: 'Step-by-step guide to placing limit orders' },
  { title: 'Smart Contract Reference', href: '/docs/technical/smart-contract', description: 'Technical details for developers' },
  { title: 'Security Audit', href: '/docs/security/audit', description: 'Review our security assessment' },
];

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

      {/* Quick Start CTA */}
      <LiquidGlassCard className="p-6 md:p-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h2 className="text-xl font-semibold text-white mb-2">Ready to start trading?</h2>
            <p className="text-white/60">Connect your wallet and create your first limit order in minutes.</p>
          </div>
          <div className="flex gap-4">
            <Link
              href="/docs/quick-start"
              className="px-6 py-3 bg-white text-black font-medium rounded-full hover:bg-white/90 transition-colors"
            >
              Quick Start Guide
            </Link>
            <Link
              href="/swap"
              className="px-6 py-3 bg-white/10 text-white font-medium rounded-full hover:bg-white/20 transition-colors border border-white/20"
            >
              Launch App
            </Link>
          </div>
        </div>
      </LiquidGlassCard>

      {/* Features Grid */}
      <div>
        <h2 className="text-2xl font-semibold text-white mb-6">Key Features</h2>
        <div className="grid md:grid-cols-2 gap-4">
          {features.map((feature) => (
            <Link key={feature.title} href={feature.href}>
              <LiquidGlassCard className="p-6 h-full hover:bg-white/5 transition-colors group">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-white/10 rounded-xl text-white group-hover:bg-white/20 transition-colors">
                    {feature.icon}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-1 group-hover:text-white/90">
                      {feature.title}
                    </h3>
                    <p className="text-white/60 text-sm">{feature.description}</p>
                  </div>
                </div>
              </LiquidGlassCard>
            </Link>
          ))}
        </div>
      </div>

      {/* Quick Links */}
      <div>
        <h2 className="text-2xl font-semibold text-white mb-6">Popular Topics</h2>
        <div className="space-y-3">
          {quickLinks.map((link) => (
            <Link key={link.href} href={link.href}>
              <LiquidGlassCard className="p-4 hover:bg-white/5 transition-colors group flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-white group-hover:text-white/90">{link.title}</h3>
                  <p className="text-white/50 text-sm">{link.description}</p>
                </div>
                <svg className="w-5 h-5 text-white/40 group-hover:text-white/60 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </LiquidGlassCard>
            </Link>
          ))}
        </div>
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
    </div>
  );
}
