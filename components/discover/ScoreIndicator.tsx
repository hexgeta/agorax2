'use client';

import { cn } from '@/lib/utils';

interface ScoreIndicatorProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

export function ScoreIndicator({
  score,
  size = 'md',
  showLabel = true,
  className,
}: ScoreIndicatorProps) {
  // Clamp score between 0-100
  const clampedScore = Math.max(0, Math.min(100, score));

  // Calculate stroke dasharray for the progress ring
  const radius = size === 'sm' ? 16 : size === 'md' ? 24 : 32;
  const strokeWidth = size === 'sm' ? 3 : size === 'md' ? 4 : 5;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (clampedScore / 100) * circumference;

  // Color based on score
  const getColor = (score: number) => {
    if (score >= 70) return '#22c55e'; // green-500
    if (score >= 40) return '#eab308'; // yellow-500
    return '#ef4444'; // red-500
  };

  const color = getColor(clampedScore);
  const svgSize = (radius + strokeWidth) * 2;

  const fontSize = size === 'sm' ? 'text-xs' : size === 'md' ? 'text-sm' : 'text-base';

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="relative" style={{ width: svgSize, height: svgSize }}>
        <svg
          width={svgSize}
          height={svgSize}
          viewBox={`0 0 ${svgSize} ${svgSize}`}
          className="transform -rotate-90"
        >
          {/* Background circle */}
          <circle
            cx={svgSize / 2}
            cy={svgSize / 2}
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.1)"
            strokeWidth={strokeWidth}
          />
          {/* Progress circle */}
          <circle
            cx={svgSize / 2}
            cy={svgSize / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-500 ease-out"
          />
        </svg>
        {/* Score text in center */}
        <div
          className={cn(
            'absolute inset-0 flex items-center justify-center font-bold',
            fontSize
          )}
          style={{ color }}
        >
          {clampedScore}
        </div>
      </div>
      {showLabel && (
        <span className="text-white/60 text-xs">Match</span>
      )}
    </div>
  );
}
