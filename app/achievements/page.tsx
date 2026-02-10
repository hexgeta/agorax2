'use client';

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { LiquidGlassCard } from '@/components/ui/liquid-glass';
import PixelBlastBackground from '@/components/ui/PixelBlastBackground';
import { useUserAchievements } from '@/hooks/useUserAchievements';
import { PixelSpinner } from '@/components/ui/PixelSpinner';
import { LegionProgressBar } from '@/components/ui/LegionProgressBar';
import {
  LEGION_XP_THRESHOLDS,
  calculateLegionProgress,
  getXpFloor,
  getXpForNextLevel,
} from '@/constants/xp';

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

interface Challenge {
  name: string;
  description: string;
  requirement: string;
  xp: number;
}

interface PrestigeChallenges {
  challenges: Challenge[];
  wildcard: Challenge[];
}

// Each prestige level has required challenges and wildcard bonuses
const PRESTIGE_CHALLENGES: Record<number, PrestigeChallenges> = {
  // Alpha - Getting Started
  0: {
    challenges: [
      { name: 'First Steps', description: 'Connect your wallet for the first time', requirement: 'Connect wallet', xp: 50 },
      { name: 'First Order', description: 'Create your first limit order', requirement: 'Create 1 order', xp: 250 },
      { name: 'First Fill', description: 'Fill your first order', requirement: 'Fill 1 order', xp: 250 },
      { name: 'Small Fry', description: 'Complete a trade worth $100+', requirement: '$100+ trade', xp: 300 },
    ],
    wildcard: [
      { name: 'Paper Hands', description: 'Cancel an order within 1 minute of creating it', requirement: 'Cancel < 1min', xp: 50 },
    ],
  },
  // Beta - Building Momentum
  1: {
    challenges: [
      { name: 'Getting Comfortable', description: 'Create 5 orders', requirement: 'Create 5 orders', xp: 400 },
      { name: 'Active Buyer', description: 'Fill 5 orders', requirement: 'Fill 5 orders', xp: 400 },
      { name: 'Weekend Warrior', description: 'Create an order on a Saturday or Sunday', requirement: 'Order on Sat/Sun', xp: 300 },
      { name: 'Volume Starter', description: 'Trade $500 in total volume', requirement: '$500 volume', xp: 500 },
    ],
    wildcard: [
      { name: 'DEX Degen', description: 'Create an order with a PulseChain DEX token (PLSX, 9MM, 9INCH, PHUX, TIDE, or UNI)', requirement: 'DEX token order', xp: 150 },
      { name: 'Micro Trader', description: 'Complete a trade worth less than $1', requirement: '< $1 trade', xp: 75 },
    ],
  },
  // Gamma - Active Trading
  2: {
    challenges: [
      { name: 'Multi-Token Beginner', description: 'Trade 5 different tokens', requirement: '5 tokens traded', xp: 300 },
      { name: 'Active Trader', description: 'Complete 10 trades total', requirement: '10 trades', xp: 500 },
      { name: 'Consistent', description: 'Trade 3 days in a row', requirement: '3 day streak', xp: 400 },
      { name: 'Playing Both Sides', description: 'Create an order AND fill someone else\'s order in the same day', requirement: 'Create + fill same day', xp: 500 },
      { name: 'Volume Builder', description: 'Trade $1,000 in total volume', requirement: '$1K volume', xp: 750 },
      { name: 'Rising Star', description: 'Complete a trade worth $500+', requirement: '$500+ trade', xp: 600 },
    ],
    wildcard: [
      { name: 'Night Owl', description: 'Complete a trade between 3-5 AM UTC', requirement: 'Trade at 3-5 AM', xp: 200 },
      { name: 'Deja Vu', description: 'Create the exact same order (same tokens, same amounts) twice', requirement: 'Duplicate order', xp: 100 },
    ],
  },
  // Delta - Dedicated Trader
  3: {
    challenges: [
      { name: 'Token Diversity', description: 'Trade 10 different tokens', requirement: '10 tokens traded', xp: 500 },
      { name: 'Order Machine', description: 'Create 25 orders', requirement: '25 orders', xp: 800 },
      { name: 'Fill Expert', description: 'Fill 25 orders', requirement: '25 fills', xp: 800 },
      { name: 'Dedicated', description: 'Trade 7 days in a row', requirement: '7 day streak', xp: 600 },
      { name: 'The Collector', description: 'Claim proceeds from 10 different orders', requirement: '10 orders claimed', xp: 600 },
      { name: 'Clean Sweep', description: 'Have 5 of your orders reach 100% fill', requirement: '5 fully filled', xp: 800 },
      { name: 'Big Spender', description: 'Complete a trade worth $1,000+', requirement: '$1K+ trade', xp: 1200 },
    ],
    wildcard: [
      { name: 'Indecisive', description: 'Cancel 5 orders in one day', requirement: '5 cancels/day', xp: 100 },
      { name: 'Ghost Order', description: 'Have an order expire without any fills', requirement: 'Order expired 0%', xp: 75 },
      { name: 'Early Bird', description: 'Complete a trade in the first hour of the day (00:00-01:00 UTC)', requirement: 'Trade at midnight UTC', xp: 250 },
    ],
  },
  // Epsilon - Experienced Trader
  4: {
    challenges: [
      { name: 'Token Collector', description: 'Trade 20 different tokens', requirement: '20 tokens traded', xp: 800 },
      { name: 'Hexican', description: 'Trade 100,000 HEX total', requirement: '100K HEX', xp: 600 },
      { name: 'Veteran Trader', description: 'Complete 50 trades total', requirement: '50 trades', xp: 1500 },
      { name: 'Order Veteran', description: 'Create 50 orders', requirement: '50 orders', xp: 1200 },
      { name: 'Two Week Warrior', description: 'Trade 14 days in a row', requirement: '14 day streak', xp: 1000 },
      { name: 'Perfect Record', description: 'Complete 10 trades with zero cancellations', requirement: '10 trades, 0 cancels', xp: 1500 },
      { name: 'Volume Veteran', description: 'Trade $10,000 in total volume', requirement: '$10K volume', xp: 2000 },
    ],
    wildcard: [
      { name: 'Speed Runner', description: 'Have your order filled within 30 seconds of creating it', requirement: 'Fill < 30s', xp: 400 },
      { name: 'Penny Pincher', description: 'Complete 10 trades each worth less than $1', requirement: '10 trades < $1', xp: 200 },
      { name: 'Iron Hands', description: 'Hold an open order for 30+ days without cancelling', requirement: 'Order open 30 days', xp: 1500 },
    ],
  },
  // Zeta - Professional Trader
  5: {
    challenges: [
      { name: 'Diversified', description: 'Trade 30 different tokens', requirement: '30 tokens traded', xp: 1200 },
      { name: 'PLS Stacker', description: 'Trade 1,000,000 PLS total', requirement: '1M PLS', xp: 1000 },
      { name: 'Century Trader', description: 'Complete 100 trades total', requirement: '100 trades', xp: 3000 },
      { name: 'Order Legend', description: 'Create 100 orders', requirement: '100 orders', xp: 2500 },
      { name: 'Market Maker', description: 'Have 5 active orders at once', requirement: '5 concurrent orders', xp: 1500 },
      { name: 'AON Champion', description: 'Create and fully complete 3 All-or-Nothing orders', requirement: '3 completed AON', xp: 2500 },
      { name: 'Claim Machine', description: 'Claim proceeds 50 times', requirement: '50 claims', xp: 2000 },
      { name: 'Whale Alert', description: 'Complete a trade worth $10,000+', requirement: '$10K+ trade', xp: 4000 },
      { name: 'HEX Baron', description: 'Trade 1,000,000 HEX in total volume', requirement: '1M HEX volume', xp: 3000 },
    ],
    wildcard: [
      { name: 'Fatfinger', description: 'Create an order above market price', requirement: 'Above market price', xp: 150 },
      { name: 'Dip Catcher', description: 'Create an order 50% below market price', requirement: '50% below market', xp: 150 },
      { name: 'Order Hoarder', description: 'Have 15 open orders with zero fills', requirement: '15 unfilled orders', xp: 300 },
      { name: 'Ghost Town', description: 'Have 5 orders expire with zero fills', requirement: '5 ghost orders', xp: 200 },
    ],
  },
  // Eta - Elite Trader
  6: {
    challenges: [
      { name: 'Token Master', description: 'Trade 40 different tokens', requirement: '40 tokens traded', xp: 2000 },
      { name: 'Ethereum Maxi', description: 'Trade wrapped Ethereum tokens (weHEX, etc.)', requirement: 'Trade we* tokens', xp: 1500 },
      { name: 'Fill Master', description: 'Fill 200 orders', requirement: '200 fills', xp: 5000 },
      { name: 'Power Maker', description: 'Have 10 active orders at once', requirement: '10 concurrent orders', xp: 2500 },
      { name: 'Volume King', description: 'Trade $100,000 in total volume', requirement: '$100K volume', xp: 8000 },
      { name: 'PLS Baron', description: 'Trade 10,000,000 PLS in total volume', requirement: '10M PLS volume', xp: 3000 },
    ],
    wildcard: [
      { name: 'Multi-Fill', description: 'Have a single order filled by 5 or more different wallets', requirement: '5 unique fillers', xp: 3000 },
      { name: 'Diamond Hands', description: 'Hold an open order for 90+ days without cancelling', requirement: 'Order open 90 days', xp: 5000 },
    ],
  },
  // Theta - Master Trader
  7: {
    challenges: [
      { name: 'Token Legend', description: 'Trade 50 different tokens', requirement: '50 tokens traded', xp: 3000 },
      { name: 'Trade Machine', description: 'Complete 500 trades total', requirement: '500 trades', xp: 10000 },
      { name: 'Order God', description: 'Create 500 orders', requirement: '500 orders', xp: 8000 },
      { name: 'Mega Whale', description: 'Complete a trade worth $100,000+', requirement: '$100K+ trade', xp: 20000 },
      { name: 'Stablecoin Baron', description: 'Trade 100,000 stablecoins in total volume (DAI/USDC/USDT/USDL)', requirement: '100K stablecoin vol', xp: 5000 },
      { name: 'Profit Master', description: 'Collect proceeds 100 times total', requirement: '100 claims', xp: 12000 },
    ],
    wildcard: [
      { name: 'MAXI Maxi', description: 'Trade any MAXI token', requirement: 'Trade MAXI tokens', xp: 2000 },
      { name: 'Bond Trader', description: 'Create an order with HTT (Hedron T-Share Token)', requirement: 'Trade HTT', xp: 2000 },
      { name: 'Coupon Clipper', description: 'Create an order with COM (Community Token)', requirement: 'Trade COM', xp: 2000 },
      { name: '$1 Inevitable', description: 'Create an order with pDAI', requirement: 'Trade pDAI', xp: 2000 },
      { name: 'Full House', description: 'Have 3 of your orders with partial fills active simultaneously', requirement: '3 partially filled', xp: 5000 },
      { name: 'Total Chaos', description: 'Cancel 20 orders in one day', requirement: '20 cancels/day', xp: 500 },
    ],
  },
  // Omega - God Mode
  8: {
    challenges: [
      { name: 'Token God', description: 'Trade 75 different tokens', requirement: '75 tokens traded', xp: 5000 },
      { name: 'Trade Legend', description: 'Complete 1,000 trades total', requirement: '1,000 trades', xp: 25000 },
      { name: 'Order Immortal', description: 'Create 1,000 orders', requirement: '1,000 orders', xp: 20000 },
      { name: 'Domination', description: 'Have 20 active orders at once', requirement: '20 concurrent orders', xp: 5000 },
      { name: 'Volume God', description: 'Trade $1,000,000 in total volume', requirement: '$1M volume', xp: 50000 },
      { name: 'Leviathan', description: 'Complete a trade worth $500,000+', requirement: '$500K+ trade', xp: 75000 },
    ],
    wildcard: [
      { name: 'Sniper', description: 'Fill an order within 1 minute of creation', requirement: 'Fill < 1min', xp: 2000 },
    ],
  },
};

// Default empty user data (used when not connected or no data)
const EMPTY_USER = {
  currentXp: 0,
  completedChallenges: {} as Record<number, string[]>,
};

// Helper to check if all REQUIRED challenges for a prestige are complete
// Wildcard challenges are bonus and not required to advance
function isPrestigeComplete(prestigeIndex: number, completedChallenges: Record<number, string[]>): boolean {
  const p = PRESTIGE_CHALLENGES[prestigeIndex];
  if (!p) return false;
  const completed = completedChallenges[prestigeIndex] || [];
  return p.challenges.every((c) => completed.includes(c.name));
}

// Helper to get total XP for a prestige level
function getPrestigeTotalXp(prestigeIndex: number): number {
  const p = PRESTIGE_CHALLENGES[prestigeIndex];
  if (!p) return 0;
  return [...p.challenges, ...p.wildcard].reduce((sum, c) => sum + c.xp, 0);
}

// Helper to get earned XP for a prestige level
function getPrestigeEarnedXp(prestigeIndex: number, completedChallenges: Record<number, string[]>): number {
  const p = PRESTIGE_CHALLENGES[prestigeIndex];
  if (!p) return 0;
  const completed = completedChallenges[prestigeIndex] || [];
  return [...p.challenges, ...p.wildcard]
    .filter((c) => completed.includes(c.name))
    .reduce((sum, c) => sum + c.xp, 0);
}

function AllChallengesTable({
  prestigeIndex,
  completedChallenges,
}: {
  prestigeIndex: number;
  completedChallenges: string[];
}) {
  const prestigeChallenges = PRESTIGE_CHALLENGES[prestigeIndex];
  if (!prestigeChallenges) return null;

  const requiredChallenges = prestigeChallenges.challenges;
  const wildcardChallenges = prestigeChallenges.wildcard;

  return (
    <div className="space-y-6">
      {/* Required Challenges Table */}
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
            {requiredChallenges.map((challenge) => {
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
                        <span className={`font-medium ${isCompleted ? 'text-gray-400 line-through' : 'text-white'}`}>
                          {challenge.name}
                        </span>
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

      {/* Wildcard Challenges Section */}
      {wildcardChallenges.length > 0 && (
        <div className="mt-6 pt-6 border-t border-white/10">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-xl">🎲</span>
            <div>
              <h3 className="text-lg font-semibold text-purple-400">Wildcard Challenges</h3>
              <p className="text-gray-500 text-sm">Fun bonus challenges - not required for advancement</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <tbody>
                {wildcardChallenges.map((challenge) => {
                  const isCompleted = completedChallenges.includes(challenge.name);
                  return (
                    <tr
                      key={challenge.name}
                      className={`border-b border-white/5 transition-colors hover:bg-purple-500/5 ${isCompleted ? 'opacity-60' : ''}`}
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          {isCompleted ? (
                            <div className="w-5 h-5 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                              <svg className="w-3 h-3 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                          ) : (
                            <div className="w-5 h-5 rounded-full border border-purple-500/30 flex-shrink-0" />
                          )}
                          <div>
                            <div className="flex items-center gap-2">
                              <span className={`font-medium ${isCompleted ? 'text-gray-400 line-through' : 'text-white'}`}>
                                {challenge.name}
                              </span>
                              <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 leading-none">
                                Wildcard
                              </span>
                            </div>
                            <div className="text-gray-500 text-sm">{challenge.description}</div>
                            <div className="text-gray-500 text-xs sm:hidden mt-1">{challenge.requirement}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-gray-400 text-sm hidden sm:table-cell">{challenge.requirement}</td>
                      <td className="py-3 px-4 text-right">
                        <span className={`font-mono font-medium ${isCompleted ? 'text-gray-500' : 'text-purple-400'}`}>
                          +{challenge.xp.toLocaleString()}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// Find current active prestige (first incomplete one) - used for initial state
function getInitialActivePrestige(completedChallenges: Record<number, string[]>): number {
  const activeIndex = PRESTIGE_LEVELS.findIndex(
    (_, idx) => !isPrestigeComplete(idx, completedChallenges)
  );
  return activeIndex === -1 ? PRESTIGE_LEVELS.length - 1 : activeIndex;
}

export default function RanksPage() {
  const [selectedPrestige, setSelectedPrestige] = useState<number>(0);

  // Fetch real user data from Supabase
  const { stats, completedChallenges: rawCompletedChallenges, isLoading, isConnected } = useUserAchievements();

  // Transform completed challenges into the format expected by the UI
  const userData = useMemo(() => {
    if (!rawCompletedChallenges || rawCompletedChallenges.length === 0) {
      return EMPTY_USER;
    }

    // Group completed challenges by prestige level
    const completedByPrestige: Record<number, string[]> = {};
    let totalXp = 0;

    rawCompletedChallenges.forEach((challenge) => {
      if (!completedByPrestige[challenge.prestige_level]) {
        completedByPrestige[challenge.prestige_level] = [];
      }
      completedByPrestige[challenge.prestige_level].push(challenge.challenge_name);
      totalXp += challenge.xp_awarded;
    });

    return {
      currentXp: stats?.total_xp || totalXp,
      completedChallenges: completedByPrestige,
    };
  }, [rawCompletedChallenges, stats]);

  const currentPrestige = PRESTIGE_LEVELS[selectedPrestige];
  const isViewingCompleted = isPrestigeComplete(selectedPrestige, userData.completedChallenges);

  // Find current active prestige (first incomplete one)
  const currentActivePrestige = PRESTIGE_LEVELS.findIndex(
    (_, idx) => !isPrestigeComplete(idx, userData.completedChallenges)
  );

  // Calculate required challenges completed for selected prestige
  const selectedPrestigeChallenges = PRESTIGE_CHALLENGES[selectedPrestige];
  const completedInPrestige = userData.completedChallenges[selectedPrestige] || [];
  const requiredInPrestige = selectedPrestigeChallenges?.challenges.length || 0;
  const requiredCompleted = selectedPrestigeChallenges
    ? selectedPrestigeChallenges.challenges.filter((c) => completedInPrestige.includes(c.name)).length
    : 0;

  // Calculate challenges for CURRENT ACTIVE prestige (used in progress bar)
  const activeLegionIndex = currentActivePrestige >= 0 ? currentActivePrestige : 0;
  const activePrestigeChallenges = PRESTIGE_CHALLENGES[activeLegionIndex];
  const completedInActivePrestige = userData.completedChallenges[activeLegionIndex] || [];
  const requiredInActivePrestige = activePrestigeChallenges?.challenges.length || 0;
  const requiredCompletedInActive = activePrestigeChallenges
    ? activePrestigeChallenges.challenges.filter((c) => completedInActivePrestige.includes(c.name)).length
    : 0;

  return (
    <main className="flex min-h-screen flex-col items-center relative overflow-hidden">
      {/* Animated background */}
      <div className="fixed inset-0 z-0">
        <PixelBlastBackground />
      </div>

      {/* Main Content */}
      <div className="w-full px-2 md:px-8 mt-2 pb-12 relative z-10">
        <div className="max-w-[1200px] mx-auto space-y-6">
          {/* Prestige Icons - Clickable */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <LiquidGlassCard
              shadowIntensity="sm"
              glowIntensity="sm"
              blurIntensity="xl"
              className="p-4 md:p-6"
            >
              {/* XP Progress Bar - only show when viewing current active legion */}
              {selectedPrestige === activeLegionIndex && (
                <div className="mb-6">
                  <LegionProgressBar
                    currentLegion={activeLegionIndex}
                    totalXp={userData.currentXp}
                    xpProgress={calculateLegionProgress(userData.currentXp, activeLegionIndex)}
                    xpFloor={getXpFloor(activeLegionIndex)}
                    xpCeiling={getXpForNextLevel(activeLegionIndex)}
                    challengesCompleted={requiredCompletedInActive}
                    requiredChallenges={requiredInActivePrestige}
                  />
                </div>
              )}
              <p className="text-gray-400 text-sm mb-4 text-center">
                Complete all required challenges AND reach the XP threshold to unlock the next legion.
              </p>
              <div className="flex items-center justify-center gap-2 md:gap-3 flex-wrap">
                {PRESTIGE_LEVELS.map((prestige, index) => {
                  const isComplete = isPrestigeComplete(index, userData.completedChallenges);
                  const isSelected = selectedPrestige === index;
                  const isCurrent = currentActivePrestige === index;
                  const isLocked = index > currentActivePrestige && !isComplete;

                  return (
                    <button
                      key={prestige.symbol}
                      onClick={() => setSelectedPrestige(index)}
                      className="flex flex-col items-center gap-1 group"
                    >
                      <div
                        className={`w-11 h-11 md:w-14 md:h-14 rounded-full flex items-center justify-center transition-all
                          ${isSelected ? 'ring-2 ring-white ring-offset-2 ring-offset-black' : ''}
                          ${isComplete ? prestige.bgColor : isCurrent ? 'bg-gray-500/30' : isLocked ? 'bg-gray-800/30' : prestige.bgColor}
                          ${isCurrent && !isSelected ? 'ring-1 ring-gray-400/50' : ''}
                        `}
                      >
                        <span
                          className={`text-xl md:text-2xl font-bold ${
                            isComplete ? prestige.color : isCurrent ? 'text-gray-300' : isLocked ? 'text-gray-600' : prestige.color
                          }`}
                        >
                          {prestige.symbol}
                        </span>
                      </div>
                      <span
                        className={`text-[10px] md:text-xs ${
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
                    {requiredCompleted}/{requiredInPrestige} required
                    {isViewingCompleted && <span className="text-yellow-400 ml-2">★ Complete!</span>}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <div className={`font-bold ${currentPrestige.color}`}>
                  {getPrestigeEarnedXp(selectedPrestige, userData.completedChallenges).toLocaleString()} /{' '}
                  {getPrestigeTotalXp(selectedPrestige).toLocaleString()} XP
                </div>
              </div>
            </div>

            {/* All Challenges */}
            {selectedPrestigeChallenges && (
              <LiquidGlassCard shadowIntensity="sm" glowIntensity="sm" blurIntensity="xl" className="p-4 md:p-6">
                <AllChallengesTable
                  prestigeIndex={selectedPrestige}
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
