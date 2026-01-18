'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { LiquidGlassCard } from '@/components/ui/liquid-glass';
import PixelBlastBackground from '@/components/ui/PixelBlastBackground';

// Prestige levels with Greek letters - user starts at Alpha
const PRESTIGE_LEVELS = [
  { symbol: 'α', name: 'Alpha', color: 'text-rose-400', bgColor: 'bg-rose-500/20', goldColor: 'text-yellow-400', goldBg: 'bg-yellow-500/30' },
  { symbol: 'β', name: 'Beta', color: 'text-orange-400', bgColor: 'bg-orange-500/20', goldColor: 'text-yellow-400', goldBg: 'bg-yellow-500/30' },
  { symbol: 'γ', name: 'Gamma', color: 'text-lime-400', bgColor: 'bg-lime-500/20', goldColor: 'text-yellow-400', goldBg: 'bg-yellow-500/30' },
  { symbol: 'δ', name: 'Delta', color: 'text-emerald-400', bgColor: 'bg-emerald-500/20', goldColor: 'text-yellow-400', goldBg: 'bg-yellow-500/30' },
  { symbol: 'ε', name: 'Epsilon', color: 'text-cyan-400', bgColor: 'bg-cyan-500/20', goldColor: 'text-yellow-400', goldBg: 'bg-yellow-500/30' },
  { symbol: 'ζ', name: 'Zeta', color: 'text-blue-400', bgColor: 'bg-blue-500/20', goldColor: 'text-yellow-400', goldBg: 'bg-yellow-500/30' },
  { symbol: 'η', name: 'Eta', color: 'text-violet-400', bgColor: 'bg-violet-500/20', goldColor: 'text-yellow-400', goldBg: 'bg-yellow-500/30' },
  { symbol: 'θ', name: 'Theta', color: 'text-fuchsia-400', bgColor: 'bg-fuchsia-500/20', goldColor: 'text-yellow-400', goldBg: 'bg-yellow-500/30' },
  { symbol: 'Ω', name: 'Omega', color: 'text-yellow-400', bgColor: 'bg-yellow-500/20', goldColor: 'text-yellow-400', goldBg: 'bg-yellow-500/30' },
];

// Challenge categories
type ChallengeCategory = 'bootcamp' | 'operations' | 'elite' | 'humiliation';

interface Challenge {
  name: string;
  description: string;
  requirement: string;
  xp: number;
}

interface PrestigeChallenges {
  bootcamp: { title: string; description: string; icon: string; color: string; challenges: Challenge[] };
  operations: { title: string; description: string; icon: string; color: string; challenges: Challenge[] };
  elite: { title: string; description: string; icon: string; color: string; challenges: Challenge[] };
  humiliation: { title: string; description: string; icon: string; color: string; challenges: Challenge[] };
}

// Each prestige level has unique challenges split into 4 categories
const PRESTIGE_CHALLENGES: Record<number, PrestigeChallenges> = {
  // Alpha - Getting Started (Easiest)
  0: {
    bootcamp: {
      title: 'Boot Camp',
      description: 'Getting started challenges',
      icon: '🎯',
      color: 'text-green-400',
      challenges: [
        { name: 'First Steps', description: 'Connect your wallet for the first time', requirement: 'Connect wallet', xp: 50 },
        { name: 'Window Shopper', description: 'View 10 different orders in the marketplace', requirement: 'View 10 orders', xp: 100 },
      ],
    },
    operations: {
      title: 'Operations',
      description: 'Basic trading milestones',
      icon: '⚔️',
      color: 'text-blue-400',
      challenges: [
        { name: 'First Order', description: 'Create your first limit order', requirement: 'Create 1 order', xp: 250 },
        { name: 'First Fill', description: 'Fill your first order', requirement: 'Fill 1 order', xp: 250 },
      ],
    },
    elite: {
      title: 'Elite',
      description: 'Prove your worth',
      icon: '👑',
      color: 'text-amber-400',
      challenges: [
        { name: 'Small Fish', description: 'Complete a trade worth $100+', requirement: '$100+ trade', xp: 300 },
      ],
    },
    humiliation: {
      title: 'Humiliation',
      description: 'Funny achievements',
      icon: '💀',
      color: 'text-red-400',
      challenges: [
        { name: 'Paper Hands', description: 'Cancel an order within 1 minute of creating it', requirement: 'Cancel < 1min', xp: 50 },
      ],
    },
  },
  // Beta - Building Momentum
  1: {
    bootcamp: {
      title: 'Boot Camp',
      description: 'Learning the ropes',
      icon: '🎯',
      color: 'text-green-400',
      challenges: [
        { name: 'Price Watcher', description: 'Check the price chart 10 times', requirement: 'View chart 10x', xp: 100 },
        { name: 'Token Explorer', description: 'View orders for 5 different tokens', requirement: 'Explore 5 tokens', xp: 150 },
      ],
    },
    operations: {
      title: 'Operations',
      description: 'Building consistency',
      icon: '⚔️',
      color: 'text-blue-400',
      challenges: [
        { name: 'Getting Comfortable', description: 'Create 5 orders', requirement: 'Create 5 orders', xp: 400 },
        { name: 'Active Buyer', description: 'Fill 5 orders', requirement: 'Fill 5 orders', xp: 400 },
      ],
    },
    elite: {
      title: 'Elite',
      description: 'Growing your volume',
      icon: '👑',
      color: 'text-amber-400',
      challenges: [
        { name: 'Volume Starter', description: 'Trade $500 in total volume', requirement: '$500 volume', xp: 500 },
      ],
    },
    humiliation: {
      title: 'Humiliation',
      description: 'Questionable decisions',
      icon: '💀',
      color: 'text-red-400',
      challenges: [
        { name: 'Micro Trader', description: 'Complete a trade worth less than $1', requirement: '< $1 trade', xp: 75 },
      ],
    },
  },
  // Gamma - Active Trading
  2: {
    bootcamp: {
      title: 'Boot Camp',
      description: 'Expanding horizons',
      icon: '🎯',
      color: 'text-green-400',
      challenges: [
        { name: 'Multi-Token Beginner', description: 'Trade 5 different tokens', requirement: '5 tokens traded', xp: 300 },
        { name: 'Market Scanner', description: 'View 50 different orders', requirement: 'View 50 orders', xp: 200 },
      ],
    },
    operations: {
      title: 'Operations',
      description: 'Regular activity',
      icon: '⚔️',
      color: 'text-blue-400',
      challenges: [
        { name: 'Active Trader', description: 'Complete 10 trades total', requirement: '10 trades', xp: 500 },
        { name: 'Consistent', description: 'Trade 3 days in a row', requirement: '3 day streak', xp: 400 },
      ],
    },
    elite: {
      title: 'Elite',
      description: 'Serious volume',
      icon: '👑',
      color: 'text-amber-400',
      challenges: [
        { name: 'Volume Builder', description: 'Trade $1,000 in total volume', requirement: '$1K volume', xp: 750 },
        { name: 'Rising Star', description: 'Complete a trade worth $500+', requirement: '$500+ trade', xp: 600 },
      ],
    },
    humiliation: {
      title: 'Humiliation',
      description: 'Odd timing',
      icon: '💀',
      color: 'text-red-400',
      challenges: [
        { name: 'Night Owl', description: 'Complete a trade between 3-5 AM UTC', requirement: 'Trade at 3-5 AM', xp: 200 },
      ],
    },
  },
  // Delta - Dedicated Trader
  3: {
    bootcamp: {
      title: 'Boot Camp',
      description: 'Mastering the basics',
      icon: '🎯',
      color: 'text-green-400',
      challenges: [
        { name: 'Token Diversity', description: 'Trade 10 different tokens', requirement: '10 tokens traded', xp: 500 },
        { name: 'Market Regular', description: 'View 100 different orders', requirement: 'View 100 orders', xp: 300 },
      ],
    },
    operations: {
      title: 'Operations',
      description: 'Scaling up',
      icon: '⚔️',
      color: 'text-blue-400',
      challenges: [
        { name: 'Order Machine', description: 'Create 25 orders', requirement: '25 orders', xp: 800 },
        { name: 'Fill Expert', description: 'Fill 25 orders', requirement: '25 fills', xp: 800 },
        { name: 'Dedicated', description: 'Trade 7 days in a row', requirement: '7 day streak', xp: 600 },
      ],
    },
    elite: {
      title: 'Elite',
      description: 'Big moves',
      icon: '👑',
      color: 'text-amber-400',
      challenges: [
        { name: 'Big Spender', description: 'Complete a trade worth $1,000+', requirement: '$1K+ trade', xp: 1200 },
      ],
    },
    humiliation: {
      title: 'Humiliation',
      description: 'Changed your mind?',
      icon: '💀',
      color: 'text-red-400',
      challenges: [
        { name: 'Indecisive', description: 'Cancel 5 orders in one day', requirement: '5 cancels/day', xp: 100 },
        { name: 'Ghost Order', description: 'Have an order expire without any fills', requirement: 'Order expired 0%', xp: 75 },
      ],
    },
  },
  // Epsilon - Experienced Trader
  4: {
    bootcamp: {
      title: 'Boot Camp',
      description: 'Advanced exploration',
      icon: '🎯',
      color: 'text-green-400',
      challenges: [
        { name: 'Token Collector', description: 'Trade 20 different tokens', requirement: '20 tokens traded', xp: 800 },
        { name: 'HEX Enthusiast', description: 'Trade 100,000 HEX total', requirement: '100K HEX', xp: 600 },
      ],
    },
    operations: {
      title: 'Operations',
      description: 'Serious commitment',
      icon: '⚔️',
      color: 'text-blue-400',
      challenges: [
        { name: 'Veteran Trader', description: 'Complete 50 trades total', requirement: '50 trades', xp: 1500 },
        { name: 'Order Veteran', description: 'Create 50 orders', requirement: '50 orders', xp: 1200 },
        { name: 'Two Week Warrior', description: 'Trade 14 days in a row', requirement: '14 day streak', xp: 1000 },
      ],
    },
    elite: {
      title: 'Elite',
      description: 'Volume veteran',
      icon: '👑',
      color: 'text-amber-400',
      challenges: [
        { name: 'Volume Veteran', description: 'Trade $10,000 in total volume', requirement: '$10K volume', xp: 2000 },
      ],
    },
    humiliation: {
      title: 'Humiliation',
      description: 'Speed demons',
      icon: '💀',
      color: 'text-red-400',
      challenges: [
        { name: 'Speed Runner', description: 'Have your order filled within 30 seconds of creating it', requirement: 'Fill < 30s', xp: 400 },
      ],
    },
  },
  // Zeta - Professional Trader
  5: {
    bootcamp: {
      title: 'Boot Camp',
      description: 'Portfolio mastery',
      icon: '🎯',
      color: 'text-green-400',
      challenges: [
        { name: 'Diversified', description: 'Trade 30 different tokens', requirement: '30 tokens traded', xp: 1200 },
        { name: 'PLS Stacker', description: 'Trade 1,000,000 PLS total', requirement: '1M PLS', xp: 1000 },
      ],
    },
    operations: {
      title: 'Operations',
      description: 'Market presence',
      icon: '⚔️',
      color: 'text-blue-400',
      challenges: [
        { name: 'Century Trader', description: 'Complete 100 trades total', requirement: '100 trades', xp: 3000 },
        { name: 'Order Legend', description: 'Create 100 orders', requirement: '100 orders', xp: 2500 },
        { name: 'Market Maker', description: 'Have 5 active orders at once', requirement: '5 concurrent orders', xp: 1500 },
      ],
    },
    elite: {
      title: 'Elite',
      description: 'Whale territory',
      icon: '👑',
      color: 'text-amber-400',
      challenges: [
        { name: 'Whale Alert', description: 'Complete a trade worth $10,000+', requirement: '$10K+ trade', xp: 4000 },
      ],
    },
    humiliation: {
      title: 'Humiliation',
      description: 'Questionable pricing',
      icon: '💀',
      color: 'text-red-400',
      challenges: [
        { name: 'Overkill', description: 'Create an order 10x above market price', requirement: '10x overpriced', xp: 150 },
        { name: 'Fire Sale', description: 'Create an order 50% below market price', requirement: '50% underpriced', xp: 150 },
      ],
    },
  },
  // Eta - Elite Trader
  6: {
    bootcamp: {
      title: 'Boot Camp',
      description: 'Market expert',
      icon: '🎯',
      color: 'text-green-400',
      challenges: [
        { name: 'Token Master', description: 'Trade 40 different tokens', requirement: '40 tokens traded', xp: 2000 },
        { name: 'Multi-Chain Explorer', description: 'Trade wrapped Ethereum tokens (weHEX, etc.)', requirement: 'Trade we* tokens', xp: 1500 },
      ],
    },
    operations: {
      title: 'Operations',
      description: 'Legendary status',
      icon: '⚔️',
      color: 'text-blue-400',
      challenges: [
        { name: 'Fill Master', description: 'Fill 200 orders', requirement: '200 fills', xp: 5000 },
        { name: 'Marathon Trader', description: 'Trade 30 days in a row', requirement: '30 day streak', xp: 4000 },
        { name: 'Power Maker', description: 'Have 10 active orders at once', requirement: '10 concurrent orders', xp: 2500 },
      ],
    },
    elite: {
      title: 'Elite',
      description: 'Serious volume',
      icon: '👑',
      color: 'text-amber-400',
      challenges: [
        { name: 'Volume King', description: 'Trade $100,000 in total volume', requirement: '$100K volume', xp: 8000 },
      ],
    },
    humiliation: {
      title: 'Humiliation',
      description: 'Lightning fast',
      icon: '💀',
      color: 'text-red-400',
      challenges: [
        { name: 'The Sniper', description: 'Fill an order within 5 seconds of it being created', requirement: 'Fill < 5s', xp: 800 },
      ],
    },
  },
  // Theta - Master Trader
  7: {
    bootcamp: {
      title: 'Boot Camp',
      description: 'Complete mastery',
      icon: '🎯',
      color: 'text-green-400',
      challenges: [
        { name: 'Token Legend', description: 'Trade 50 different tokens', requirement: '50 tokens traded', xp: 3000 },
        { name: 'MAXI Supporter', description: 'Trade any MAXI token', requirement: 'Trade MAXI tokens', xp: 2000 },
      ],
    },
    operations: {
      title: 'Operations',
      description: 'Top tier activity',
      icon: '⚔️',
      color: 'text-blue-400',
      challenges: [
        { name: 'Trade Machine', description: 'Complete 500 trades total', requirement: '500 trades', xp: 10000 },
        { name: 'Order God', description: 'Create 500 orders', requirement: '500 orders', xp: 8000 },
        { name: 'Unstoppable', description: 'Trade 60 days in a row', requirement: '60 day streak', xp: 8000 },
      ],
    },
    elite: {
      title: 'Elite',
      description: 'Mega whale',
      icon: '👑',
      color: 'text-amber-400',
      challenges: [
        { name: 'Mega Whale', description: 'Complete a trade worth $100,000+', requirement: '$100K+ trade', xp: 20000 },
      ],
    },
    humiliation: {
      title: 'Humiliation',
      description: 'Mass cancellation',
      icon: '💀',
      color: 'text-red-400',
      challenges: [
        { name: 'Total Chaos', description: 'Cancel 20 orders in one day', requirement: '20 cancels/day', xp: 500 },
      ],
    },
  },
  // Omega - God Mode (Hardest)
  8: {
    bootcamp: {
      title: 'Boot Camp',
      description: 'Absolute completionist',
      icon: '🎯',
      color: 'text-green-400',
      challenges: [
        { name: 'Token God', description: 'Trade 75 different tokens', requirement: '75 tokens traded', xp: 5000 },
        { name: 'Full Spectrum', description: 'Trade every whitelisted token category', requirement: 'All categories', xp: 4000 },
      ],
    },
    operations: {
      title: 'Operations',
      description: 'Legendary commitment',
      icon: '⚔️',
      color: 'text-blue-400',
      challenges: [
        { name: 'Trade Legend', description: 'Complete 1,000 trades total', requirement: '1,000 trades', xp: 25000 },
        { name: 'Order Immortal', description: 'Create 1,000 orders', requirement: '1,000 orders', xp: 20000 },
        { name: 'Year Warrior', description: 'Trade 100 days in a row', requirement: '100 day streak', xp: 15000 },
        { name: 'Market Dominator', description: 'Have 20 active orders at once', requirement: '20 concurrent orders', xp: 5000 },
      ],
    },
    elite: {
      title: 'Elite',
      description: 'Volume god',
      icon: '👑',
      color: 'text-amber-400',
      challenges: [
        { name: 'Volume God', description: 'Trade $1,000,000 in total volume', requirement: '$1M volume', xp: 50000 },
        { name: 'Leviathan', description: 'Complete a trade worth $500,000+', requirement: '$500K+ trade', xp: 75000 },
      ],
    },
    humiliation: {
      title: 'Humiliation',
      description: 'The ultimate',
      icon: '💀',
      color: 'text-red-400',
      challenges: [
        { name: 'Instant Legend', description: 'Fill an order the exact second it was created', requirement: 'Instant fill', xp: 2000 },
        { name: 'All-Nighter', description: 'Make trades every hour for 24 hours straight', requirement: '24 hour trading', xp: 3000 },
      ],
    },
  },
};

// Mock user data (will be replaced with real data)
const MOCK_USER = {
  currentXp: 1000,
  // Track completed challenges per prestige level
  completedChallenges: {
    0: ['First Steps', 'Window Shopper', 'First Order', 'First Fill', 'Small Fish', 'Paper Hands'], // Alpha - all complete
    1: [], // Beta - none
    2: [], // Gamma - none
  } as Record<number, string[]>,
};

// Helper to check if all challenges for a prestige are complete
function isPrestigeComplete(prestigeIndex: number, completedChallenges: Record<number, string[]>): boolean {
  const prestigeChallenges = PRESTIGE_CHALLENGES[prestigeIndex];
  if (!prestigeChallenges) return false;

  const allChallengeNames: string[] = [];
  (Object.keys(prestigeChallenges) as ChallengeCategory[]).forEach((category) => {
    prestigeChallenges[category].challenges.forEach((c) => allChallengeNames.push(c.name));
  });

  const completed = completedChallenges[prestigeIndex] || [];
  return allChallengeNames.every((name) => completed.includes(name));
}

// Helper to get total XP for a prestige level
function getPrestigeTotalXp(prestigeIndex: number): number {
  const prestigeChallenges = PRESTIGE_CHALLENGES[prestigeIndex];
  if (!prestigeChallenges) return 0;

  let total = 0;
  (Object.keys(prestigeChallenges) as ChallengeCategory[]).forEach((category) => {
    prestigeChallenges[category].challenges.forEach((c) => {
      total += c.xp;
    });
  });
  return total;
}

// Helper to get earned XP for a prestige level
function getPrestigeEarnedXp(prestigeIndex: number, completedChallenges: Record<number, string[]>): number {
  const prestigeChallenges = PRESTIGE_CHALLENGES[prestigeIndex];
  if (!prestigeChallenges) return 0;

  const completed = completedChallenges[prestigeIndex] || [];
  let total = 0;
  (Object.keys(prestigeChallenges) as ChallengeCategory[]).forEach((category) => {
    prestigeChallenges[category].challenges.forEach((c) => {
      if (completed.includes(c.name)) {
        total += c.xp;
      }
    });
  });
  return total;
}

function ChallengeTable({
  prestigeIndex,
  category,
  completedChallenges,
}: {
  prestigeIndex: number;
  category: ChallengeCategory;
  completedChallenges: string[];
}) {
  const prestigeChallenges = PRESTIGE_CHALLENGES[prestigeIndex];
  if (!prestigeChallenges) return null;

  const data = prestigeChallenges[category];

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-white/10">
            <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">Challenge</th>
            <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm hidden sm:table-cell">Requirement</th>
            <th className="text-right py-3 px-4 text-gray-400 font-medium text-sm">XP</th>
          </tr>
        </thead>
        <tbody>
          {data.challenges.map((challenge) => {
            const isCompleted = completedChallenges.includes(challenge.name);
            return (
              <tr
                key={challenge.name}
                className={`border-b border-white/5 transition-colors hover:bg-white/5 ${isCompleted ? 'opacity-60' : ''}`}
              >
                <td className="py-3 px-4">
                  <div className="flex items-center gap-3">
                    {isCompleted ? (
                      <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                        <svg className="w-3 h-3 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    ) : (
                      <div className="w-5 h-5 rounded-full border border-white/20 flex-shrink-0" />
                    )}
                    <div>
                      <div className={`font-medium ${isCompleted ? 'text-gray-400 line-through' : 'text-white'}`}>
                        {challenge.name}
                      </div>
                      <div className="text-gray-500 text-sm">{challenge.description}</div>
                      <div className="text-gray-500 text-xs sm:hidden mt-1">{challenge.requirement}</div>
                    </div>
                  </div>
                </td>
                <td className="py-3 px-4 text-gray-400 text-sm hidden sm:table-cell">{challenge.requirement}</td>
                <td className="py-3 px-4 text-right">
                  <span className={`font-mono font-medium ${isCompleted ? 'text-gray-500' : 'text-amber-400'}`}>
                    +{challenge.xp.toLocaleString()}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// Find current active prestige (first incomplete one) - used for initial state
function getInitialActivePrestige(): number {
  const activeIndex = PRESTIGE_LEVELS.findIndex(
    (_, idx) => !isPrestigeComplete(idx, MOCK_USER.completedChallenges)
  );
  return activeIndex === -1 ? PRESTIGE_LEVELS.length - 1 : activeIndex;
}

export default function RanksPage() {
  const [selectedPrestige, setSelectedPrestige] = useState<number>(getInitialActivePrestige);
  const [activeCategory, setActiveCategory] = useState<ChallengeCategory>('bootcamp');

  const currentPrestige = PRESTIGE_LEVELS[selectedPrestige];
  const isViewingCompleted = isPrestigeComplete(selectedPrestige, MOCK_USER.completedChallenges);

  // Find current active prestige (first incomplete one)
  const currentActivePrestige = PRESTIGE_LEVELS.findIndex(
    (_, idx) => !isPrestigeComplete(idx, MOCK_USER.completedChallenges)
  );

  // Calculate challenges completed for selected prestige
  const selectedPrestigeChallenges = PRESTIGE_CHALLENGES[selectedPrestige];
  const completedInPrestige = MOCK_USER.completedChallenges[selectedPrestige] || [];
  const totalInPrestige = selectedPrestigeChallenges
    ? (Object.keys(selectedPrestigeChallenges) as ChallengeCategory[]).reduce(
        (acc, cat) => acc + selectedPrestigeChallenges[cat].challenges.length,
        0
      )
    : 0;

  return (
    <main className="flex min-h-screen flex-col items-center relative overflow-hidden">
      {/* Animated background */}
      <div className="fixed inset-0 z-0">
        <PixelBlastBackground />
      </div>

      {/* Main Content */}
      <div className="w-full px-4 md:px-8 mt-20 mb-12 relative z-10">
        <div className="max-w-[1200px] mx-auto">
          {/* Prestige Icons - Clickable */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mb-8"
          >
            <LiquidGlassCard
              shadowIntensity="sm"
              glowIntensity="sm"
              blurIntensity="xl"
              className="p-6"
            >
              <h3 className="text-lg font-semibold text-white mb-2 text-center">Your Legion</h3>
              <p className="text-gray-400 text-sm mb-6 text-center">
                Complete all challenges in each legion to earn it's badge and unlock the next set of challenges.
              </p>
              <div className="flex items-center justify-center gap-3 md:gap-4 flex-wrap">
                {PRESTIGE_LEVELS.map((prestige, index) => {
                  const isComplete = isPrestigeComplete(index, MOCK_USER.completedChallenges);
                  const isSelected = selectedPrestige === index;
                  const isCurrent = currentActivePrestige === index;
                  const isLocked = index > currentActivePrestige && !isComplete;

                  return (
                    <button
                      key={prestige.symbol}
                      onClick={() => setSelectedPrestige(index)}
                      className="flex flex-col items-center gap-2 group"
                    >
                      <div
                        className={`w-14 h-14 md:w-16 md:h-16 rounded-full flex items-center justify-center transition-all
                          ${isSelected ? 'ring-2 ring-white ring-offset-2 ring-offset-black' : ''}
                          ${isComplete ? prestige.bgColor : isCurrent ? 'bg-gray-500/30' : isLocked ? 'bg-gray-800/30' : prestige.bgColor}
                          ${isCurrent && !isSelected ? 'ring-1 ring-gray-400/50' : ''}
                        `}
                      >
                        <span
                          className={`text-2xl md:text-3xl font-bold ${
                            isComplete ? prestige.color : isCurrent ? 'text-gray-300' : isLocked ? 'text-gray-600' : prestige.color
                          }`}
                        >
                          {prestige.symbol}
                        </span>
                      </div>
                      <span
                        className={`text-xs ${
                          isSelected ? 'text-white font-medium' : isCurrent ? 'text-gray-300' : isLocked ? 'text-gray-600' : 'text-gray-500'
                        }`}
                      >
                        {prestige.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </LiquidGlassCard>
          </motion.div>

          {/* Selected Prestige Challenges */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            {/* Prestige Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center ${currentPrestige.bgColor}`}
                >
                  <span
                    className={`text-xl font-bold ${currentPrestige.color}`}
                  >
                    {currentPrestige.symbol}
                  </span>
                </div>
                <div>
                  <h2 className={`text-xl font-bold ${currentPrestige.color}`}>{currentPrestige.name} Challenges</h2>
                  <p className="text-gray-400 text-sm">
                    {completedInPrestige.length}/{totalInPrestige} completed
                    {isViewingCompleted && <span className="text-yellow-400 ml-2">★ Complete!</span>}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <div className={`font-bold ${currentPrestige.color}`}>
                  {getPrestigeEarnedXp(selectedPrestige, MOCK_USER.completedChallenges).toLocaleString()} /{' '}
                  {getPrestigeTotalXp(selectedPrestige).toLocaleString()} XP
                </div>
              </div>
            </div>

            {/* Category Tabs */}
            <div className="flex flex-wrap gap-2 mb-4">
              {selectedPrestigeChallenges &&
                (Object.keys(selectedPrestigeChallenges) as ChallengeCategory[]).map((category) => {
                  const data = selectedPrestigeChallenges[category];
                  const isActive = activeCategory === category;
                  const completedInCategory = data.challenges.filter((c) =>
                    completedInPrestige.includes(c.name)
                  ).length;

                  return (
                    <button
                      key={category}
                      onClick={() => setActiveCategory(category)}
                      className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2
                        ${
                          isActive
                            ? `${currentPrestige.bgColor} ${currentPrestige.color} border border-current/20`
                            : 'bg-white/5 text-gray-400 border border-transparent hover:bg-white/10 hover:text-white'
                        }`}
                    >
                      <span>{data.icon}</span>
                      <span className="hidden sm:inline">{data.title}</span>
                      <span className="text-xs opacity-60">
                        {completedInCategory}/{data.challenges.length}
                      </span>
                    </button>
                  );
                })}
            </div>

            {/* Active Category Content */}
            {selectedPrestigeChallenges && (
              <LiquidGlassCard shadowIntensity="sm" glowIntensity="sm" blurIntensity="xl" className="p-4 md:p-6">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-2xl">{selectedPrestigeChallenges[activeCategory].icon}</span>
                  <div>
                    <h3 className={`text-xl font-semibold ${currentPrestige.color}`}>
                      {selectedPrestigeChallenges[activeCategory].title}
                    </h3>
                    <p className="text-gray-400 text-sm">{selectedPrestigeChallenges[activeCategory].description}</p>
                  </div>
                </div>
                <ChallengeTable
                  prestigeIndex={selectedPrestige}
                  category={activeCategory}
                  completedChallenges={completedInPrestige}
                />
              </LiquidGlassCard>
            )}
          </motion.div>

          {/* Footer Note */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.5 }}
            className="text-center text-gray-500 text-sm mt-8"
          >
            XP and challenges are tracked on-chain. Progress syncs automatically when you connect your wallet.
          </motion.p>
        </div>
      </div>
    </main>
  );
}
