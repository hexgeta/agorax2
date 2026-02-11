'use client';

import { useEffect, useRef, useState } from 'react';
import { LiquidGlassCard } from '@/components/ui/liquid-glass';

const useCases = [
  {
    title: 'Zero Slippage Trading',
    description:
      'Buy tokens with low liquidity and experience zero slippage. Get exactly the amount you want at the price you set - no more, no less.',
  },
  {
    title: 'Whale-Sized Trades',
    description:
      'Even with the most liquid tokens, getting in and out of large positions can be difficult, getting eaten up by fees and slippage. AgoráX lets whales trade freely at exact prices.',
  },
  {
    title: 'Snipe Strategic Discounts',
    description:
      'Set limit orders at strategic prices on tokens you believe in. When the price dips, your order fills automatically - no need to watch charts 24/7.',
  },
  {
    title: 'Buy Undervalued Assets',
    description:
      'Scoop up depegged stablecoins during flash crashes or discounted tokens backed by HEX stakes. Set orders at your target price and wait.',
  },
  {
    title: 'eHEX/pHEX Ratio Plays',
    description:
      'Speculate on the eHEX vs pHEX ratio without USD exposure. Set a sell order at 1:1 or any ratio you believe will hit.',
  },
  {
    title: 'Instant Arb Fills',
    description:
      'Set orders slightly above market price on illiquid tokens. Arb bots fill them instantly at your exact price - no waiting, no slippage.',
  },
  {
    title: 'Zero-Fee Arbitrage',
    description:
      'Buyers pay zero fees on existing orders. Exploit small price discrepancies that would be unprofitable on fee-heavy AMMs.',
  },
  {
    title: 'LP Token Secondary Market',
    description:
      'Sell your Liquidity Pool tokens directly without unwrapping. A secondary market for LP positions that didn\'t exist before.',
  },
  {
    title: 'On-Chain Token Launchpad',
    description:
      'Project creators can launch tokens by depositing supply into sell orders at set prices, accepting only whitelisted payments. Fair, decentralized ICOs without rugs or bot sniping.',
  },
  {
    title: 'OTC Bulk Swaps',
    description:
      'Post massive sell orders for niche tokens at precise prices, accepting payment in multiple tokens with custom rates. On-chain OTC deals without CEX KYC or counterparty risk.',
  },
  {
    title: 'Simply the Best Rates',
    description:
      'Not interested in advanced strategies? Just sell tokens at the lowest fees on PulseChain. 0.2% beats every AMM - more profit stays in your pocket.',
  },
  {
    title: 'Privacy-Enhanced Transfers',
    description:
      'Transfer tokens between wallets without a direct address-to-address link on the block explorer. At 0.2%, lower fees than ZK transfer services (0.5%), though less private than mixing pools.',
  },
];

export function StackingUseCases() {
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [cardPositions, setCardPositions] = useState<number[]>([]);
  const [totalHeight, setTotalHeight] = useState(0);

  // Overlap percentage (5% = 0.05 means each card shows 95% of its height)
  const OVERLAP_PERCENT = 0.05;

  useEffect(() => {
    const calculatePositions = () => {
      const positions: number[] = [];
      let currentTop = 0;

      cardRefs.current.forEach((card, i) => {
        if (card) {
          positions[i] = currentTop;
          const cardHeight = card.offsetHeight;
          // Next card starts at (1 - overlap) * cardHeight from current position
          currentTop += cardHeight * (1 - OVERLAP_PERCENT);
        }
      });

      setCardPositions(positions);

      // Calculate total height: last position + last card height
      const lastCard = cardRefs.current[cardRefs.current.length - 1];
      if (lastCard && positions.length > 0) {
        setTotalHeight(positions[positions.length - 1] + lastCard.offsetHeight);
      }
    };

    // Initial calculation
    calculatePositions();

    // Recalculate on resize
    const resizeObserver = new ResizeObserver(calculatePositions);
    cardRefs.current.forEach((card) => {
      if (card) resizeObserver.observe(card);
    });

    return () => resizeObserver.disconnect();
  }, []);

  // Hardcoded rotations: subtle alternating pattern
  const rotations = [0, 0.8, -0.5, 1, -0.8, 0.6, -1, 0.8, -0.6, 0.9, -0.7, 0.5];
  // Hardcoded x offsets: subtle left/right variation (in pixels)
  const xOffsets = [0, 8, -5, 12, -8, 6, -10, 8, -6, 10, -7, 7];

  return (
    <section className="relative bg-black py-16 md:py-24 px-4 md:px-6 w-full z-10">
      {/* Header */}
      <div className="text-center max-w-2xl mx-auto mb-12 md:mb-16">
        <h1 className="text-3xl md:text-5xl font-bold text-white tracking-tight leading-tight mb-4">
          Powerful Use Cases
        </h1>
        <p className="text-gray-400 text-base md:text-lg">
          From instant arbitrage to sophisticated market-making strategies, AgoráX enables trading patterns impossible on traditional DEXs.
        </p>
      </div>

      {/* Cards - stacked with dynamic overlap based on card height */}
      <div
        ref={containerRef}
        className="max-w-4xl mx-auto relative"
        style={{
          height: totalHeight > 0 ? `${totalHeight}px` : 'auto',
        }}
      >
        {useCases.map((useCase, i) => {
          const rotation = rotations[i] || 0;
          const xOffset = xOffsets[i] || 0;

          return (
            <div
              key={i}
              ref={(el) => { cardRefs.current[i] = el; }}
              className="absolute left-1/2 w-full max-w-3xl px-4"
              style={{
                top: cardPositions[i] ?? i * 170, // Fallback to estimate before measurement
                transform: `translateX(calc(-50% + ${xOffset}px)) rotate(${rotation}deg)`,
                zIndex: i + 1,
              }}
            >
              <LiquidGlassCard
                shadowIntensity="md"
                glowIntensity="sm"
                blurIntensity="xl"
                className="w-full rounded-2xl p-6 md:p-8 bg-black/80 border border-white/15"
              >
                <div className="flex items-start gap-4 md:gap-6">
                  <span className="text-white/10 text-6xl md:text-8xl font-bold select-none leading-none flex-shrink-0 -mt-2">
                    {i + 1}
                  </span>
                  <div className="flex flex-col justify-center min-w-0">
                    <h2 className="text-xl md:text-2xl font-bold text-white mb-2 md:mb-3">
                      {useCase.title}
                    </h2>
                    <p className="text-gray-400 text-sm md:text-base leading-relaxed">
                      {useCase.description}
                    </p>
                  </div>
                </div>
              </LiquidGlassCard>
            </div>
          );
        })}
      </div>
    </section>
  );
}
