'use client';

import { motion } from 'framer-motion';
import { LEGIONS } from '@/constants/xp';

interface LegionProgressBarProps {
  currentLegion: number;
  totalXp: number;
  xpProgress: number; // 0-100
  xpFloor: number;
  xpCeiling: number | null; // null means infinity (max level)
  challengesCompleted: number;
  requiredChallenges: number;
  className?: string;
  compact?: boolean;
}

const LEGION_COLORS: Record<string, { text: string; bg: string; hex: string }> = {
  rose: { text: 'text-rose-400', bg: 'bg-rose-500', hex: '#f43f5e' },
  orange: { text: 'text-orange-400', bg: 'bg-orange-500', hex: '#f97316' },
  lime: { text: 'text-lime-400', bg: 'bg-lime-500', hex: '#84cc16' },
  emerald: { text: 'text-emerald-400', bg: 'bg-emerald-500', hex: '#10b981' },
  cyan: { text: 'text-cyan-400', bg: 'bg-cyan-500', hex: '#06b6d4' },
  blue: { text: 'text-blue-400', bg: 'bg-blue-500', hex: '#3b82f6' },
  violet: { text: 'text-violet-400', bg: 'bg-violet-500', hex: '#8b5cf6' },
  fuchsia: { text: 'text-fuchsia-400', bg: 'bg-fuchsia-500', hex: '#d946ef' },
  yellow: { text: 'text-yellow-400', bg: 'bg-yellow-500', hex: '#eab308' },
};

export function LegionProgressBar({
  currentLegion,
  totalXp,
  xpProgress,
  xpFloor,
  xpCeiling,
  challengesCompleted,
  requiredChallenges,
  className = '',
  compact = false,
}: LegionProgressBarProps) {
  const currentLegionInfo = LEGIONS[currentLegion] || LEGIONS[0];
  const nextLegionInfo = currentLegion < 8 ? LEGIONS[currentLegion + 1] : null;
  const isMaxLevel = currentLegion >= 8;
  const colors = LEGION_COLORS[currentLegionInfo.color] || LEGION_COLORS.rose;
  const nextColors = nextLegionInfo ? LEGION_COLORS[nextLegionInfo.color] : null;

  const xpNeeded = xpCeiling ? xpCeiling - totalXp : 0;
  const challengesNeeded = requiredChallenges - challengesCompleted;
  const hasEnoughXp = xpCeiling ? totalXp >= xpCeiling : true;
  const hasAllChallenges = challengesCompleted >= requiredChallenges;
  const canAdvance = hasEnoughXp && hasAllChallenges && !isMaxLevel;

  // Build gradient style with proper colors
  const gradientStyle = nextColors
    ? { background: `linear-gradient(to right, ${colors.hex}, ${nextColors.hex})` }
    : { background: colors.hex };

  if (compact) {
    return (
      <div className={`${className}`}>
        <div className="flex items-center gap-2 mb-1.5">
          <span className={`text-lg font-bold ${colors.text}`}>{currentLegionInfo.symbol}</span>
          <span className="text-white/60 text-sm">{currentLegionInfo.name}</span>
          {nextLegionInfo && (
            <>
              <span className="text-white/30 text-xs">→</span>
              <span className={`text-sm ${nextColors?.text || 'text-white/40'}`}>{nextLegionInfo.symbol}</span>
            </>
          )}
        </div>
        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${xpProgress}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="h-full rounded-full"
            style={gradientStyle}
          />
        </div>
        <div className="flex justify-between mt-1 text-xs text-white/40">
          <span>{totalXp.toLocaleString()} XP</span>
          {xpCeiling && <span>{xpCeiling.toLocaleString()} XP</span>}
        </div>
      </div>
    );
  }

  return (
    <div className={`${className}`}>
      {/* Header */}
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${colors.bg}/20`}>
            <span className={`text-xl font-bold ${colors.text}`}>{currentLegionInfo.symbol}</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-white font-medium">{currentLegionInfo.name} Legion</span>
              {canAdvance && (
                <span className="text-green-400 text-xs px-2 py-0.5 bg-green-500/20 rounded-full">
                  Ready to advance!
                </span>
              )}
            </div>
            {isMaxLevel ? (
              <span className="text-yellow-400 text-sm">Maximum Level Achieved</span>
            ) : (
              <span className="text-white/50 text-sm">
                {totalXp.toLocaleString()} / {xpCeiling?.toLocaleString()} XP
              </span>
            )}
          </div>
        </div>
        {nextLegionInfo && (
          <div className="text-right">
            <span className={`text-sm ${nextColors?.text || 'text-white/40'}`}>
              → {nextLegionInfo.name}
            </span>
          </div>
        )}
      </div>

      {/* Progress Bar */}
      <div className="h-3 bg-white/10 rounded-full overflow-hidden mb-3">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(xpProgress, 100)}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="h-full rounded-full relative"
          style={gradientStyle}
        >
          {xpProgress >= 5 && (
            <div className="absolute inset-0 flex items-center justify-end pr-2">
              <span className="text-[10px] font-bold text-white/80">{Math.round(xpProgress)}%</span>
            </div>
          )}
        </motion.div>
      </div>

      {/* Status Messages */}
      {!isMaxLevel && (
        <div className="flex flex-wrap gap-3 text-sm">
          {!hasEnoughXp && (
            <div className="flex items-center gap-1.5 text-white/60">
              <div className="w-2 h-2 rounded-full bg-amber-500/50" />
              <span>{xpNeeded.toLocaleString()} XP needed</span>
            </div>
          )}
          {hasEnoughXp && !hasAllChallenges && (
            <div className="flex items-center gap-1.5 text-white/60">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-green-400">XP requirement met!</span>
            </div>
          )}
          {!hasAllChallenges && (
            <div className="flex items-center gap-1.5 text-white/60">
              <div className="w-2 h-2 rounded-full bg-red-500/50" />
              <span>
                Complete {challengesNeeded} more challenge{challengesNeeded !== 1 ? 's' : ''} to advance
              </span>
            </div>
          )}
          {hasAllChallenges && !hasEnoughXp && (
            <div className="flex items-center gap-1.5 text-white/60">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-green-400">All challenges complete!</span>
            </div>
          )}
        </div>
      )}

      {isMaxLevel && (
        <div className="text-center text-yellow-400/80 text-sm">
          You have reached the pinnacle. Continue trading to grow your legacy.
        </div>
      )}
    </div>
  );
}
