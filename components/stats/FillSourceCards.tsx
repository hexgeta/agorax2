'use client';

import { useMemo, useState } from 'react';
import { LiquidGlassCard } from '@/components/ui/liquid-glass';
import { formatUSD } from '@/utils/format';

// Switch.Win aggregator adapter on PulseChain. When it fills an AgoraX order,
// this address shows up as filler_address in the OrderFilled event.
export const SWITCH_ADAPTER_ADDRESS = '0x79ea0ec76b510d08bf4ca9a4a53a1f9f80ea1697';

interface FillLike {
  buyer: string;
  sellUsd: number;
  buyUsd: number;
  timestamp: number;
}

interface FillSourceCardsProps {
  fills: FillLike[];
}

type TimeRange = 'all' | '24h' | '7d' | '30d';

const TIME_RANGES: { id: TimeRange; label: string }[] = [
  { id: 'all', label: 'All time' },
  { id: '24h', label: '24h' },
  { id: '7d', label: '7d' },
  { id: '30d', label: '30d' },
];

function rangeStart(range: TimeRange): number | null {
  if (range === 'all') return null;
  const now = Math.floor(Date.now() / 1000);
  if (range === '24h') return now - 24 * 3600;
  if (range === '7d') return now - 7 * 86400;
  return now - 30 * 86400;
}

export default function FillSourceCards({ fills }: FillSourceCardsProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('all');

  const { agoraxFills, agoraxVolume, switchFills, switchVolume } = useMemo(() => {
    const cutoff = rangeStart(timeRange);
    let agFills = 0;
    let agVol = 0;
    let swFills = 0;
    let swVol = 0;
    for (const fill of fills) {
      if (cutoff !== null && (!fill.timestamp || fill.timestamp < cutoff)) continue;
      const volume = Math.max(fill.sellUsd || 0, fill.buyUsd || 0);
      if (fill.buyer?.toLowerCase() === SWITCH_ADAPTER_ADDRESS) {
        swFills++;
        swVol += volume;
      } else {
        agFills++;
        agVol += volume;
      }
    }
    return { agoraxFills: agFills, agoraxVolume: agVol, switchFills: swFills, switchVolume: swVol };
  }, [fills, timeRange]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-2xl font-bold text-white">Fill Source</h2>
        <div className="flex flex-wrap gap-2">
          {TIME_RANGES.map(r => (
            <button
              key={r.id}
              onClick={() => setTimeRange(r.id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                timeRange === r.id
                  ? 'bg-white/10 text-white border border-white/20'
                  : 'bg-transparent text-gray-400 border border-transparent hover:bg-white/10 hover:text-white'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 lg:gap-4">
        <SourceCard
          label="AgoraX Frontend"
          fillCount={agoraxFills}
          volumeUsd={agoraxVolume}
          dotColor="blue"
        />
        <SourceCard
          label="Switch.Win"
          fillCount={switchFills}
          volumeUsd={switchVolume}
          dotColor="green"
        />
      </div>
    </div>
  );
}

interface SourceCardProps {
  label: string;
  fillCount: number;
  volumeUsd: number;
  dotColor: 'blue' | 'green';
}

function SourceCard({ label, fillCount, volumeUsd, dotColor }: SourceCardProps) {
  const dotClass = dotColor === 'blue' ? 'bg-blue-500' : 'bg-green-500';
  return (
    <LiquidGlassCard
      className="p-5 bg-black/40 flex flex-col justify-between min-h-[120px]"
      shadowIntensity="none"
      glowIntensity="none"
    >
      <div className="flex items-center gap-2">
        <div className={`w-2.5 h-2.5 rounded-full ${dotClass}`} />
        <p className="text-gray-400 text-sm font-medium">{label}</p>
      </div>
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-white text-2xl md:text-3xl font-bold">{formatUSD(volumeUsd)}</p>
          <p className="text-gray-500 text-xs mt-1">Volume filled</p>
        </div>
        <div className="text-right">
          <p className="text-white text-xl md:text-2xl font-bold">{fillCount.toLocaleString()}</p>
          <p className="text-gray-500 text-xs mt-1">Fills</p>
        </div>
      </div>
    </LiquidGlassCard>
  );
}
