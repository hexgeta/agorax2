'use client';

import Link from 'next/link';
import { LiquidGlassCard } from '@/components/ui/liquid-glass';

export default function DiscoverPage() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-white/60 text-sm mb-4">
          <Link href="/docs" className="hover:text-white transition-colors">Docs</Link>
          <span>/</span>
          <Link href="/docs/guide" className="hover:text-white transition-colors">Guide</Link>
          <span>/</span>
          <span className="text-white">Discover Feature</span>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">
          Discover Feature
        </h1>
        <p className="text-lg text-white/70">
          AI-powered order recommendations in a Tinder-style swipe interface.
        </p>
      </div>

      {/* Overview */}
      <LiquidGlassCard className="p-6">
        <h2 className="text-xl font-semibold text-white mb-4">What is Discover?</h2>
        <p className="text-white/70 mb-4">
          Discover is an intelligent order discovery feature that presents you with personalized recommendations
          based on your token holdings and the attractiveness of available orders. Instead of browsing through
          hundreds of orders, let the algorithm find the best deals for you.
        </p>
        <div className="flex items-center gap-4 text-white/60 text-sm">
          <span className="flex items-center gap-1">
            <span className="text-green-400">→</span> Swipe right to save
          </span>
          <span className="flex items-center gap-1">
            <span className="text-red-400">←</span> Swipe left to skip
          </span>
        </div>
      </LiquidGlassCard>

      {/* Scoring Algorithm */}
      <div>
        <h2 className="text-2xl font-semibold text-white mb-4">How Orders Are Scored</h2>
        <p className="text-white/60 mb-4">
          Each order receives a score from 0-100 based on three weighted factors:
        </p>

        <div className="space-y-4">
          <LiquidGlassCard className="p-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-14 h-14 rounded-xl bg-blue-500/20 flex items-center justify-center">
                <span className="text-blue-400 font-bold text-lg">40</span>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-white mb-2">Fillability Score</h3>
                <p className="text-white/70 text-sm mb-3">
                  Can you actually fill this order? The score is based on your balance of the required buy tokens
                  compared to what the order needs.
                </p>
                <div className="bg-white/5 p-3 rounded-lg">
                  <p className="text-white/60 text-sm">
                    100% fillable = 40 points<br />
                    50% fillable = 20 points<br />
                    0% fillable = 0 points
                  </p>
                </div>
              </div>
            </div>
          </LiquidGlassCard>

          <LiquidGlassCard className="p-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-14 h-14 rounded-xl bg-green-500/20 flex items-center justify-center">
                <span className="text-green-400 font-bold text-lg">40</span>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-white mb-2">Price Score</h3>
                <p className="text-white/70 text-sm mb-3">
                  Is this a good deal? Compares the order's price to current market rates.
                  Better discounts = higher scores.
                </p>
                <div className="bg-white/5 p-3 rounded-lg">
                  <p className="text-white/60 text-sm">
                    +20% discount or better = 40 points<br />
                    Market rate (0%) = 20 points<br />
                    -20% (above market) = 0 points
                  </p>
                </div>
              </div>
            </div>
          </LiquidGlassCard>

          <LiquidGlassCard className="p-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-14 h-14 rounded-xl bg-purple-500/20 flex items-center justify-center">
                <span className="text-purple-400 font-bold text-lg">20</span>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-white mb-2">Relevance Score</h3>
                <p className="text-white/70 text-sm mb-3">
                  Is this order relevant to you? Based on whether you hold the sell token
                  and if it's a core ecosystem token.
                </p>
                <div className="bg-white/5 p-3 rounded-lg">
                  <p className="text-white/60 text-sm">
                    You hold sell token = +10 points<br />
                    Core token (PLS, HEX, PLSX, INC) = +10 points
                  </p>
                </div>
              </div>
            </div>
          </LiquidGlassCard>
        </div>
      </div>

      {/* How to Use */}
      <div>
        <h2 className="text-2xl font-semibold text-white mb-4">How to Use Discover</h2>
        <div className="space-y-4">
          <LiquidGlassCard className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white font-bold flex-shrink-0">
                1
              </div>
              <div>
                <h3 className="text-white font-medium mb-2">Connect Your Wallet</h3>
                <p className="text-white/60 text-sm">
                  For personalized recommendations, connect your wallet so Discover can check your token balances.
                </p>
              </div>
            </div>
          </LiquidGlassCard>

          <LiquidGlassCard className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white font-bold flex-shrink-0">
                2
              </div>
              <div>
                <h3 className="text-white font-medium mb-2">Browse the Card Stack</h3>
                <p className="text-white/60 text-sm">
                  Orders appear as cards with their score, price discount, and fill capability clearly displayed.
                </p>
              </div>
            </div>
          </LiquidGlassCard>

          <LiquidGlassCard className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white font-bold flex-shrink-0">
                3
              </div>
              <div>
                <h3 className="text-white font-medium mb-2">Swipe or Tap</h3>
                <p className="text-white/60 text-sm">
                  Swipe right (or tap the save button) to save interesting orders. Swipe left to pass.
                  Saved orders go to your saved drawer for later.
                </p>
              </div>
            </div>
          </LiquidGlassCard>

          <LiquidGlassCard className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white font-bold flex-shrink-0">
                4
              </div>
              <div>
                <h3 className="text-white font-medium mb-2">Fill Saved Orders</h3>
                <p className="text-white/60 text-sm">
                  Open your saved orders drawer to view and fill orders you've saved.
                  You can remove orders from saved if you change your mind.
                </p>
              </div>
            </div>
          </LiquidGlassCard>
        </div>
      </div>

      {/* Card Information */}
      <LiquidGlassCard className="p-6">
        <h2 className="text-xl font-semibold text-white mb-4">Understanding the Card</h2>
        <p className="text-white/70 mb-4">Each order card shows:</p>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-500 to-blue-500 flex items-center justify-center text-white text-xs font-bold">
                85
              </div>
              <span className="text-white/70 text-sm">Overall score (0-100)</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs">-12%</span>
              <span className="text-white/70 text-sm">Price discount from market</span>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="text-white/70 text-sm">🟢 100%</span>
              <span className="text-white/50 text-sm">You can fully fill this order</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-white/70 text-sm">🟡 50%</span>
              <span className="text-white/50 text-sm">You can partially fill this order</span>
            </div>
          </div>
        </div>
      </LiquidGlassCard>

      {/* Persistence */}
      <LiquidGlassCard className="p-6 border-l-4 border-blue-500/50">
        <h2 className="text-lg font-semibold text-white mb-3">Order Memory</h2>
        <p className="text-white/70 mb-3">
          Discover remembers which orders you've already seen:
        </p>
        <ul className="space-y-2 text-white/60 text-sm">
          <li>• <strong className="text-white">Saved orders:</strong> Stay in your saved list until you remove them</li>
          <li>• <strong className="text-white">Passed orders:</strong> Reappear after 24 hours (configurable)</li>
          <li>• <strong className="text-white">Settings:</strong> Stored locally in your browser</li>
        </ul>
      </LiquidGlassCard>

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
        <Link href="/docs/technical/smart-contract" className="flex-1">
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
