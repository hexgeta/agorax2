'use client';

import Link from 'next/link';
import { LiquidGlassCard } from '@/components/ui/liquid-glass';

const PRESTIGE_LEVELS = [
  { level: 0, name: 'Alpha', symbol: 'α', color: 'text-rose-400', bgColor: 'bg-rose-500/20' },
  { level: 1, name: 'Beta', symbol: 'β', color: 'text-orange-400', bgColor: 'bg-orange-500/20' },
  { level: 2, name: 'Gamma', symbol: 'γ', color: 'text-lime-400', bgColor: 'bg-lime-500/20' },
  { level: 3, name: 'Delta', symbol: 'δ', color: 'text-emerald-400', bgColor: 'bg-emerald-500/20' },
  { level: 4, name: 'Epsilon', symbol: 'ε', color: 'text-cyan-400', bgColor: 'bg-cyan-500/20' },
  { level: 5, name: 'Zeta', symbol: 'ζ', color: 'text-blue-400', bgColor: 'bg-blue-500/20' },
  { level: 6, name: 'Eta', symbol: 'η', color: 'text-violet-400', bgColor: 'bg-violet-500/20' },
  { level: 7, name: 'Theta', symbol: 'θ', color: 'text-fuchsia-400', bgColor: 'bg-fuchsia-500/20' },
  { level: 8, name: 'Omega', symbol: 'Ω', color: 'text-yellow-400', bgColor: 'bg-yellow-500/20' },
];

interface Challenge {
  name: string;
  xp: number;
  requirement: string;
}

const CHALLENGES_BY_LEVEL: Record<string, Challenge[]> = {
  'Alpha': [
    { name: 'First Steps', xp: 50, requirement: 'Connect your wallet' },
    { name: 'Window Shopper', xp: 100, requirement: 'View 10 orders' },
    { name: 'First Order', xp: 250, requirement: 'Create your first order' },
    { name: 'First Fill', xp: 250, requirement: 'Fill your first order' },
    { name: 'Small Fish', xp: 300, requirement: '$100+ single trade' },
    { name: 'Paper Hands', xp: 50, requirement: 'Cancel an order within 1 minute' },
  ],
  'Beta': [
    { name: 'Price Watcher', xp: 100, requirement: 'View price charts 10 times' },
    { name: 'Token Explorer', xp: 150, requirement: 'View orders for 5 different tokens' },
    { name: 'Getting Comfortable', xp: 400, requirement: 'Create 5 orders' },
    { name: 'Active Buyer', xp: 400, requirement: 'Fill 5 orders' },
    { name: 'Weekend Warrior', xp: 300, requirement: 'Trade on both Saturday and Sunday' },
    { name: 'Volume Starter', xp: 500, requirement: '$500 total volume' },
    { name: 'Micro Trader', xp: 75, requirement: 'Complete a trade under $1' },
  ],
  'Gamma': [
    { name: 'Multi-Token Beginner', xp: 300, requirement: 'Trade 5 different tokens' },
    { name: 'Market Scanner', xp: 200, requirement: 'View 50 orders' },
    { name: 'Active Trader', xp: 500, requirement: 'Complete 10 trades' },
    { name: 'Consistent', xp: 400, requirement: '3-day trading streak' },
    { name: 'Both Sides', xp: 500, requirement: 'Create and fill an order on the same day' },
    { name: 'Volume Builder', xp: 750, requirement: '$1K total volume' },
    { name: 'Rising Star', xp: 600, requirement: '$500+ single trade' },
    { name: 'Night Owl', xp: 200, requirement: 'Trade between 3-5 AM UTC' },
    { name: 'Deja Vu', xp: 100, requirement: 'Create a duplicate order' },
  ],
  'Delta': [
    { name: 'Token Diversity', xp: 500, requirement: 'Trade 10 different tokens' },
    { name: 'Market Regular', xp: 300, requirement: 'View 100 orders' },
    { name: 'Order Machine', xp: 800, requirement: 'Create 25 orders' },
    { name: 'Fill Expert', xp: 800, requirement: 'Fill 25 orders' },
    { name: 'Dedicated', xp: 600, requirement: '7-day trading streak' },
    { name: 'The Collector', xp: 600, requirement: 'Claim proceeds from 10 orders' },
    { name: 'Clean Sweep', xp: 800, requirement: 'Have 5 orders fully filled' },
    { name: 'Big Spender', xp: 1200, requirement: '$1K+ single trade' },
    { name: 'Indecisive', xp: 100, requirement: 'Cancel 5 orders in one day' },
    { name: 'Ghost Order', xp: 75, requirement: 'Have an order expire with 0% filled' },
    { name: 'Early Bird', xp: 250, requirement: 'Trade at midnight UTC' },
  ],
  'Epsilon': [
    { name: 'Token Collector', xp: 800, requirement: 'Trade 20 different tokens' },
    { name: 'HEX Enthusiast', xp: 600, requirement: 'Trade 100K HEX total' },
    { name: 'Veteran Trader', xp: 1500, requirement: 'Complete 50 trades' },
    { name: 'Order Veteran', xp: 1200, requirement: 'Create 50 orders' },
    { name: 'Two Week Warrior', xp: 1000, requirement: '14-day trading streak' },
    { name: 'Arbitrage Artist', xp: 1000, requirement: 'Fill then create an order within 2 minutes' },
    { name: 'Perfect Record', xp: 1500, requirement: '10 trades with 0 cancellations' },
    { name: 'Volume Veteran', xp: 2000, requirement: '$10K total volume' },
    { name: 'Iron Hands', xp: 1500, requirement: 'Keep an order open for 30+ days' },
    { name: 'Speed Runner', xp: 400, requirement: 'Fill an order within 30 seconds' },
    { name: 'Penny Pincher', xp: 200, requirement: 'Complete 10 trades under $1' },
  ],
  'Zeta': [
    { name: 'Diversified', xp: 1200, requirement: 'Trade 30 different tokens' },
    { name: 'PLS Stacker', xp: 1000, requirement: 'Trade 1M PLS total' },
    { name: 'Century Trader', xp: 3000, requirement: 'Complete 100 trades' },
    { name: 'Order Legend', xp: 2500, requirement: 'Create 100 orders' },
    { name: 'Market Maker', xp: 1500, requirement: 'Have 5 active orders at once' },
    { name: 'AON Champion', xp: 2500, requirement: 'Complete 3 All-or-Nothing orders' },
    { name: 'Claim Machine', xp: 2000, requirement: 'Claim proceeds 50 times' },
    { name: 'Whale Alert', xp: 4000, requirement: '$10K+ single trade' },
    { name: 'HEX Baron', xp: 3000, requirement: 'Trade 1M HEX total' },
    { name: 'Fatfinger', xp: 150, requirement: 'Create an order above market price' },
    { name: 'Dip Catcher', xp: 150, requirement: 'Create an order 50% below market' },
    { name: 'Order Hoarder', xp: 300, requirement: 'Have 15+ unfilled orders' },
    { name: 'Ghost Town', xp: 200, requirement: 'Have 5 orders expire with 0% filled' },
  ],
  'Eta': [
    { name: 'Token Master', xp: 2000, requirement: 'Trade 40 different tokens' },
    { name: 'Ethereum Maxi', xp: 1500, requirement: 'Trade wrapped ETH tokens (weHEX, etc.)' },
    { name: 'Fill Master', xp: 5000, requirement: 'Fill 200 orders' },
    { name: 'Power Maker', xp: 2500, requirement: 'Have 10 active orders at once' },
    { name: 'Multi-Fill', xp: 3000, requirement: 'Have 5 unique fillers on one order' },
    { name: 'Volume King', xp: 8000, requirement: '$100K total volume' },
    { name: 'Diamond Hands', xp: 5000, requirement: 'Keep an order open for 90+ days' },
    { name: 'PLS Baron', xp: 3000, requirement: 'Trade 10M PLS total' },
  ],
  'Theta': [
    { name: 'Token Legend', xp: 3000, requirement: 'Trade 50 different tokens' },
    { name: 'MAXI Maxi', xp: 2000, requirement: 'Trade any MAXI token' },
    { name: 'Bond Trader', xp: 2000, requirement: 'Create an order with HTT token' },
    { name: 'Coupon Clipper', xp: 2000, requirement: 'Create an order with COM token' },
    { name: '$1 Inevitable', xp: 2000, requirement: 'Create an order with pDAI' },
    { name: 'Trade Machine', xp: 10000, requirement: 'Complete 500 trades' },
    { name: 'Order God', xp: 8000, requirement: 'Create 500 orders' },
    { name: 'Full House', xp: 5000, requirement: 'Have 3 partially filled orders active' },
    { name: 'Mega Whale', xp: 20000, requirement: '$100K+ single trade' },
    { name: 'Stablecoin Baron', xp: 5000, requirement: 'Trade 100K in stablecoins' },
    { name: 'Profit Master', xp: 12000, requirement: 'Claim proceeds 100 times' },
    { name: 'Total Chaos', xp: 500, requirement: 'Cancel 20 orders in one day' },
  ],
  'Omega': [
    { name: 'Token God', xp: 5000, requirement: 'Trade 75 different tokens' },
    { name: 'Trade Legend', xp: 25000, requirement: 'Complete 1,000 trades' },
    { name: 'Order Immortal', xp: 20000, requirement: 'Create 1,000 orders' },
    { name: 'Domination', xp: 5000, requirement: 'Have 20 active orders at once' },
    { name: 'Volume God', xp: 50000, requirement: '$1M total volume' },
    { name: 'Leviathan', xp: 75000, requirement: '$500K+ single trade' },
    { name: 'Sniper', xp: 2000, requirement: 'Fill an order within 1 minute of creation' },
  ],
};

export default function ChallengesPage() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">Challenges & XP</h1>
        <p className="text-white/70">
          Complete challenges to earn XP and progress through 9 prestige levels (Legions).
          Each level unlocks new challenges with bigger rewards.
        </p>
      </div>

      {/* Overview */}
      <LiquidGlassCard className="p-6">
        <h2 className="text-xl font-semibold text-white mb-4">How It Works</h2>
        <div className="space-y-3 text-white/70">
          <p>
            XP is earned exclusively from completing challenges - individual actions like creating orders
            or filling trades don&apos;t give XP directly, but they count toward challenge progress.
          </p>
          <p>
            There are <span className="text-white font-medium">84 challenges</span> across 9 prestige levels.
            Complete all challenges in a level to progress to the next Legion.
          </p>
        </div>
      </LiquidGlassCard>

      {/* Prestige Levels */}
      <LiquidGlassCard className="p-6">
        <h2 className="text-xl font-semibold text-white mb-4">Prestige Levels (Legions)</h2>
        <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-9 gap-3">
          {PRESTIGE_LEVELS.map((level) => (
            <div key={level.level} className="text-center">
              <div className={`w-12 h-12 mx-auto rounded-full flex items-center justify-center ${level.bgColor}`}>
                <span className={`text-xl font-bold ${level.color}`}>{level.symbol}</span>
              </div>
              <p className={`text-sm mt-1 ${level.color}`}>{level.name}</p>
            </div>
          ))}
        </div>
      </LiquidGlassCard>

      {/* Challenges by Level */}
      {PRESTIGE_LEVELS.map((level) => (
        <LiquidGlassCard key={level.level} className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${level.bgColor}`}>
              <span className={`text-lg font-bold ${level.color}`}>{level.symbol}</span>
            </div>
            <h2 className="text-xl font-semibold text-white">{level.name}</h2>
            <span className="text-white/40 text-sm">
              {CHALLENGES_BY_LEVEL[level.name]?.length || 0} challenges
            </span>
          </div>

          <div className="space-y-2">
            {CHALLENGES_BY_LEVEL[level.name]?.map((challenge) => (
              <div
                key={challenge.name}
                className="flex items-center justify-between py-2 px-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
              >
                <div>
                  <p className="text-white font-medium">{challenge.name}</p>
                  <p className="text-white/50 text-sm">{challenge.requirement}</p>
                </div>
                <span className="text-amber-400 font-mono text-sm whitespace-nowrap ml-4">
                  +{challenge.xp.toLocaleString()} XP
                </span>
              </div>
            ))}
          </div>
        </LiquidGlassCard>
      ))}

      {/* Token-Specific Challenges */}
      <LiquidGlassCard className="p-6">
        <h2 className="text-xl font-semibold text-white mb-4">Token-Specific Challenges</h2>
        <p className="text-white/70 mb-4">
          These special challenges reward trading specific tokens:
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="p-3 rounded-lg bg-white/5">
            <p className="text-white font-medium">Bond Trader</p>
            <p className="text-white/50 text-sm">Trade HTT (Hedron T-Share Token)</p>
          </div>
          <div className="p-3 rounded-lg bg-white/5">
            <p className="text-white font-medium">Coupon Clipper</p>
            <p className="text-white/50 text-sm">Trade COM (Community Token)</p>
          </div>
          <div className="p-3 rounded-lg bg-white/5">
            <p className="text-white font-medium">$1 Inevitable</p>
            <p className="text-white/50 text-sm">Trade pDAI (Pulsechain DAI)</p>
          </div>
          <div className="p-3 rounded-lg bg-white/5">
            <p className="text-white font-medium">MAXI Maxi</p>
            <p className="text-white/50 text-sm">Trade any MAXI token</p>
          </div>
          <div className="p-3 rounded-lg bg-white/5">
            <p className="text-white font-medium">Ethereum Maxi</p>
            <p className="text-white/50 text-sm">Trade wrapped ETH tokens (weHEX, etc.)</p>
          </div>
          <div className="p-3 rounded-lg bg-white/5">
            <p className="text-white font-medium">HEX Baron</p>
            <p className="text-white/50 text-sm">Trade 1M HEX total</p>
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
