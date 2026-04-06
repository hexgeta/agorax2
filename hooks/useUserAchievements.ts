'use client';

import { useQuery } from '@tanstack/react-query';
import { useAccount } from 'wagmi';
import type { UserAchievements, LeaderboardEntry } from '@/types/events';

interface AchievementsResponse {
  success: boolean;
  data?: UserAchievements;
  error?: string;
}

interface LeaderboardResponse {
  success: boolean;
  data?: {
    leaderboard: LeaderboardEntry[];
    pagination: {
      total: number;
      limit: number;
      offset: number;
      has_more: boolean;
    };
  };
  error?: string;
}

export function useUserAchievements() {
  const { address } = useAccount();

  const {
    data: achievements,
    isLoading,
    error,
    refetch,
  } = useQuery<UserAchievements | null>({
    queryKey: ['user-achievements', address],
    queryFn: async () => {
      if (!address) return null;

      const response = await fetch(`/api/user/achievements?wallet=${address}`);
      const result: AchievementsResponse = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch achievements');
      }

      return result.data || null;
    },
    enabled: !!address,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });

  return {
    achievements,
    stats: achievements?.stats || null,
    completedChallenges: achievements?.completed_challenges || [],
    xpBreakdown: achievements?.xp_breakdown || null,
    isLoading,
    error,
    refetch,
    walletAddress: address,
    isConnected: !!address,
  };
}

export function useLeaderboard(limit = 100) {
  const {
    data: leaderboard,
    isLoading,
    error,
    refetch,
  } = useQuery<LeaderboardEntry[]>({
    queryKey: ['leaderboard', limit],
    queryFn: async () => {
      const response = await fetch(`/api/v1/leaderboard?limit=${limit}`);
      const result: LeaderboardResponse = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch leaderboard');
      }

      return result.data?.leaderboard || [];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  return {
    leaderboard: leaderboard || [],
    isLoading,
    error,
    refetch,
  };
}
