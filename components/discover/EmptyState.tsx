'use client';

import { cn } from '@/lib/utils';
import { LiquidGlassCard } from '@/components/ui/liquid-glass';

interface EmptyStateProps {
  type: 'no-orders' | 'end-of-stack' | 'loading' | 'not-connected';
  onRefresh?: () => void;
  className?: string;
}

export function EmptyState({ type, onRefresh, className }: EmptyStateProps) {
  const content = {
    'no-orders': {
      icon: '📭',
      title: 'No Orders Available',
      description: 'There are no active orders in the marketplace right now. Check back later!',
      action: onRefresh ? 'Refresh' : null,
    },
    'end-of-stack': {
      icon: '✨',
      title: "You've Seen Them All!",
      description: 'You\'ve browsed through all available orders. Check your saved orders or wait for new ones.',
      action: onRefresh ? 'Start Over' : null,
    },
    'loading': {
      icon: '⏳',
      title: 'Loading Orders...',
      description: 'Fetching the best orders for you based on your holdings.',
      action: null,
    },
    'not-connected': {
      icon: '🔗',
      title: 'Connect Your Wallet',
      description: 'Connect your wallet to see personalized order recommendations based on your token holdings.',
      action: null,
    },
  };

  const { icon, title, description, action } = content[type];

  return (
    <div className={cn('flex items-center justify-center min-h-[400px]', className)}>
      <LiquidGlassCard
        className="p-8 text-center max-w-sm"
        glowIntensity="low"
        blurIntensity="md"
      >
        <div className="text-5xl mb-4">{icon}</div>
        <h3 className="text-xl font-semibold text-white mb-2">{title}</h3>
        <p className="text-white/60 text-sm mb-6">{description}</p>
        {action && onRefresh && (
          <button
            onClick={onRefresh}
            className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
          >
            {action}
          </button>
        )}
      </LiquidGlassCard>
    </div>
  );
}
