'use client';

import Link from 'next/link';
import { LiquidGlassCard } from '@/components/ui/liquid-glass';

const LEGIONS = [
  { level: 0, name: 'Alpha', symbol: 'α', color: 'text-rose-400', bgColor: 'bg-rose-500/20', xpThreshold: 0 },
  { level: 1, name: 'Beta', symbol: 'β', color: 'text-orange-400', bgColor: 'bg-orange-500/20', xpThreshold: 1500 },
  { level: 2, name: 'Gamma', symbol: 'γ', color: 'text-lime-400', bgColor: 'bg-lime-500/20', xpThreshold: 4000 },
  { level: 3, name: 'Delta', symbol: 'δ', color: 'text-emerald-400', bgColor: 'bg-emerald-500/20', xpThreshold: 10000 },
  { level: 4, name: 'Epsilon', symbol: 'ε', color: 'text-cyan-400', bgColor: 'bg-cyan-500/20', xpThreshold: 25000 },
  { level: 5, name: 'Zeta', symbol: 'ζ', color: 'text-blue-400', bgColor: 'bg-blue-500/20', xpThreshold: 60000 },
  { level: 6, name: 'Eta', symbol: 'η', color: 'text-violet-400', bgColor: 'bg-violet-500/20', xpThreshold: 150000 },
  { level: 7, name: 'Theta', symbol: 'θ', color: 'text-fuchsia-400', bgColor: 'bg-fuchsia-500/20', xpThreshold: 400000 },
  { level: 8, name: 'Omega', symbol: 'Ω', color: 'text-yellow-400', bgColor: 'bg-yellow-500/20', xpThreshold: 1000000 },
];

export default function ChallengesPage() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-white/60 text-sm mb-4">
          <Link href="/docs" className="hover:text-white transition-colors">Docs</Link>
          <span>/</span>
          <Link href="/docs/guide" className="hover:text-white transition-colors">Guide</Link>
          <span>/</span>
          <span className="text-white">Legions</span>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">Legions</h1>
        <p className="text-white/70">
          Earn XP through trading and challenges to progress through 9 Legions.
        </p>
      </div>

      {/* How It Works */}
      <LiquidGlassCard className="p-6">
        <h2 className="text-xl font-semibold text-white mb-4">How It Works</h2>
        <div className="space-y-4 text-white/70">
          <div className="flex gap-3">
            <span className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400 text-sm shrink-0">1</span>
            <p><span className="text-white font-medium">Earn XP</span> from on-chain actions (creating orders, filling orders, claiming proceeds) and completing challenges.</p>
          </div>
          <div className="flex gap-3">
            <span className="w-6 h-6 rounded-full bg-cyan-500/20 flex items-center justify-center text-cyan-400 text-sm shrink-0">2</span>
            <p><span className="text-white font-medium">Complete challenges</span> in your current Legion to unlock progression. Each Legion has required challenges you must finish.</p>
          </div>
          <div className="flex gap-3">
            <span className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 text-sm shrink-0">3</span>
            <p><span className="text-white font-medium">Reach XP thresholds</span> to advance. You need both completed challenges AND enough XP to level up.</p>
          </div>
        </div>
      </LiquidGlassCard>

      {/* XP Sources */}
      <LiquidGlassCard className="p-6">
        <h2 className="text-xl font-semibold text-white mb-4">XP Sources</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="p-3 rounded-lg bg-white/5">
            <p className="text-white font-medium">Create Order</p>
            <p className="text-amber-400 text-sm">+20 XP</p>
          </div>
          <div className="p-3 rounded-lg bg-white/5">
            <p className="text-white font-medium">Fill Order</p>
            <p className="text-amber-400 text-sm">+25 XP</p>
          </div>
          <div className="p-3 rounded-lg bg-white/5">
            <p className="text-white font-medium">Your Order Filled</p>
            <p className="text-amber-400 text-sm">+30 XP</p>
          </div>
          <div className="p-3 rounded-lg bg-white/5">
            <p className="text-white font-medium">Claim Proceeds</p>
            <p className="text-amber-400 text-sm">+10 XP</p>
          </div>
          <div className="p-3 rounded-lg bg-white/5 sm:col-span-2">
            <p className="text-white font-medium">Volume Bonus</p>
            <p className="text-amber-400 text-sm">+1 XP per $10 traded (max +100 per trade)</p>
          </div>
        </div>
      </LiquidGlassCard>

      {/* Legion Progression */}
      <LiquidGlassCard className="p-6">
        <h2 className="text-xl font-semibold text-white mb-4">Legion Progression</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left py-2 text-white/60">Legion</th>
                <th className="text-right py-2 text-white/60">XP Required</th>
              </tr>
            </thead>
            <tbody className="text-white/70">
              {LEGIONS.map((legion, i) => (
                <tr key={legion.level} className="border-b border-white/5">
                  <td className="py-2">
                    <span className={`${legion.color} font-bold mr-2`}>{legion.symbol}</span>
                    <span className="text-white">{legion.name}</span>
                  </td>
                  <td className="py-2 text-right text-amber-400">
                    {i === 0 ? 'Start' : legion.xpThreshold.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </LiquidGlassCard>

      {/* Challenge Types */}
      <LiquidGlassCard className="p-6">
        <h2 className="text-xl font-semibold text-white mb-4">Challenge Types</h2>
        <p className="text-white/70 mb-4">
          Challenges are divided into <span className="text-white">required</span> (must complete to advance) and <span className="text-amber-400">wildcard</span> (bonus XP, not required).
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="p-3 rounded-lg bg-white/5">
            <p className="text-white font-medium">Volume</p>
            <p className="text-white/50 text-sm">Hit trade value milestones</p>
          </div>
          <div className="p-3 rounded-lg bg-white/5">
            <p className="text-white font-medium">Activity</p>
            <p className="text-white/50 text-sm">Create/fill orders, maintain streaks</p>
          </div>
          <div className="p-3 rounded-lg bg-white/5">
            <p className="text-white font-medium">Token-Based</p>
            <p className="text-white/50 text-sm">Trade specific tokens</p>
          </div>
          <div className="p-3 rounded-lg bg-white/5">
            <p className="text-white font-medium">Timing</p>
            <p className="text-white/50 text-sm">Trade at specific times</p>
          </div>
          <div className="p-3 rounded-lg bg-white/5">
            <p className="text-white font-medium">Whale</p>
            <p className="text-white/50 text-sm">Large single trades ($10K+)</p>
          </div>
          <div className="p-3 rounded-lg bg-white/5">
            <p className="text-white font-medium">Wildcard</p>
            <p className="text-white/50 text-sm">Fun achievements (Paper Hands, Ghost Order, etc.)</p>
          </div>
        </div>
      </LiquidGlassCard>

      {/* Navigation */}
      <div className="flex justify-between gap-4">
        <Link href="/docs/guide/managing-orders" className="flex-1 max-w-sm">
          <LiquidGlassCard className="p-6 h-full hover:bg-white/5 transition-colors group">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/60 text-sm">Previous</p>
                <p className="text-white font-medium group-hover:text-white/90">Managing Orders</p>
              </div>
              <svg className="w-5 h-5 text-white/40 group-hover:text-white/60 rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </LiquidGlassCard>
        </Link>
        <Link href="/docs/technical/smart-contract" className="flex-1 max-w-sm">
          <LiquidGlassCard className="p-6 h-full hover:bg-white/5 transition-colors group">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/60 text-sm">Next</p>
                <p className="text-white font-medium group-hover:text-white/90">Smart Contract</p>
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
