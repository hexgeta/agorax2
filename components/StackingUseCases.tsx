'use client';

import { useEffect, useRef, useState } from 'react';
import { LiquidGlassCard } from '@/components/ui/liquid-glass';

const useCases = [
  {
    title: 'Zero Slippage Trading',
    description:
      'Buy tokens with low liquidity and experience zero slippage. Get exactly the amount you want at the price you set - no more, no less.',
    textOnLeft: true,
    icon: (
      <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <circle cx="12" cy="12" r="10" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2" />
      </svg>
    ),
  },
  {
    title: 'Whale-Sized Trades',
    description:
      'Even with the most liquid tokens, getting in and out of large positions can be difficult, getting eaten up by fees and slippage. AgoráX lets whales trade freely at exact prices.',
    textOnLeft: false,
    icon: (
      <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
      </svg>
    ),
  },
  {
    title: 'Snipe Strategic Discounts',
    description:
      'Set limit orders at strategic prices on tokens you believe in. When the price dips, your order fills automatically - no need to watch charts 24/7.',
    textOnLeft: true,
    icon: (
      <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
      </svg>
    ),
  },
  {
    title: 'Buy Undervalued Assets',
    description:
      'Scoop up depegged stablecoins during flash crashes or discounted tokens backed by HEX stakes. Set orders at your target price and wait.',
    textOnLeft: false,
    icon: (
      <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    title: 'eHEX/pHEX Ratio Plays',
    description:
      'Speculate on the eHEX vs pHEX ratio without USD exposure. Set a sell order at 1:1 or any ratio you believe will hit.',
    textOnLeft: true,
    icon: (
      <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
      </svg>
    ),
  },
  {
    title: 'Instant Arb Fills',
    description:
      'Set orders slightly above market price on illiquid tokens. Arb bots fill them instantly at your exact price - no waiting, no slippage.',
    textOnLeft: false,
    icon: (
      <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
      </svg>
    ),
  },
  {
    title: 'Zero-Fee Arbitrage',
    description:
      'Buyers pay zero fees on existing orders. Exploit small price discrepancies that would be unprofitable on fee-heavy AMMs.',
    textOnLeft: true,
    icon: (
      <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 14.25l6-6m4.5-3.493V21.75l-3.75-1.5-3.75 1.5-3.75-1.5-3.75 1.5V4.757c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0c1.1.128 1.907 1.077 1.907 2.185zM9.75 9h.008v.008H9.75V9zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm4.125 4.5h.008v.008h-.008V13.5zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
      </svg>
    ),
  },
  {
    title: 'LP Token Secondary Market',
    description:
      'Sell your Liquidity Pool tokens directly without unwrapping. A secondary market for LP positions that didn\'t exist before.',
    textOnLeft: false,
    icon: (
      <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375" />
      </svg>
    ),
  },
  {
    title: 'On-Chain Token Launchpad',
    description:
      'Project creators can launch tokens by depositing supply into sell orders at set prices, accepting only whitelisted payments. Fair, decentralized ICOs without rugs or bot sniping.',
    textOnLeft: true,
    icon: (
      <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
      </svg>
    ),
  },
  {
    title: 'OTC Bulk Swaps',
    description:
      'Post massive sell orders for niche tokens at precise prices, accepting payment in multiple tokens with custom rates. On-chain OTC deals without CEX KYC or counterparty risk.',
    textOnLeft: false,
    icon: (
      <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
      </svg>
    ),
  },
  {
    title: 'Simply the Best Rates',
    description:
      'Not interested in advanced strategies? Just sell tokens at the lowest fees on PulseChain. 0.2% beats every AMM - more profit stays in your pocket.',
    textOnLeft: true,
    icon: (
      <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
      </svg>
    ),
  },
];

export function StackingUseCases() {
  const sectionRef = useRef<HTMLElement>(null);
  const [scrollProgress, setScrollProgress] = useState(0); // 0 to useCases.length
  const [isInView, setIsInView] = useState(false);

  // Pixels of scroll per card - lower = faster card transitions
  const scrollPerCard = 300;
  const totalScrollHeight = useCases.length * scrollPerCard;

  useEffect(() => {
    const handleScroll = () => {
      if (!sectionRef.current) return;

      const rect = sectionRef.current.getBoundingClientRect();
      const sectionTop = rect.top;
      const sectionBottom = rect.bottom;
      const viewportHeight = window.innerHeight;

      // Check if section is in view - show fixed content when section top is past halfway
      const shouldShowFixed = sectionTop < viewportHeight * 0.5 && sectionBottom > viewportHeight;
      setIsInView(shouldShowFixed);

      if (!shouldShowFixed) {
        return;
      }

      // Calculate continuous scroll progress
      const scrolledIntoSection = -sectionTop;
      const progress = Math.max(0, scrolledIntoSection / scrollPerCard);
      setScrollProgress(Math.min(progress, useCases.length - 1));
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => window.removeEventListener('scroll', handleScroll);
  }, [scrollPerCard]);

  return (
    <section
      ref={sectionRef}
      className="relative bg-black"
      style={{ height: `calc(100vh + ${totalScrollHeight}px)` }}
    >
      {/* Dot navigation indicator - left side */}
      <div
        className={`fixed left-6 md:left-10 top-1/2 -translate-y-1/2 z-20 transition-opacity duration-300 ${isInView ? 'opacity-100' : 'opacity-0'}`}
      >
        <div className="flex flex-col items-center gap-2">
          {/* Card dots */}
          {useCases.map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                Math.round(scrollProgress) === i
                  ? 'bg-white/50 scale-125'
                  : scrollProgress > i
                    ? 'bg-white/20'
                    : 'bg-white/10 hover:bg-white/20'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Fixed container - only visible when section is in view, no transition to avoid flash */}
      <div className={`fixed inset-0 pointer-events-none z-10 ${isInView ? 'block' : 'hidden'}`}>
        {/* Header - always visible at the top, below navbar */}
        <div className="absolute top-20 md:top-28 left-0 right-0 flex justify-center z-20">
          <div className="text-center max-w-2xl px-8">
            <h1 className="text-3xl md:text-5xl font-bold text-white tracking-tight leading-tight mb-4">
              Powerful Use Cases
            </h1>
            <p className="text-gray-400 text-base md:text-lg mb-4">
              From instant arbitrage to sophisticated market-making strategies, AgoráX enables trading patterns impossible on traditional DEXs.
            </p>
          </div>
        </div>

        {/* Cards container - positioned below the header */}
        <div className="absolute inset-0 flex items-center justify-center" style={{ paddingTop: '180px' }}>
          {/* Cards - stacked on top of each other, smoothly follow scroll */}
          {useCases.map((useCase, i) => {
            // Calculate how far this card should have traveled (0 = not started, 1 = fully in place)
            const cardProgress = Math.max(0, Math.min(1, scrollProgress - i + 1));
            // Each card has a fixed rotation: 0, 2, -2, 2, -2... (alternating after first)
            const fixedRotation = i === 0 ? 0 : (i % 2 === 1 ? 2 : -2);
            // Smooth Y position: starts at 100vh below, ends at 0
            const yPosition = (1 - cardProgress) * 100;
            // Rotation eases in as card arrives
            const currentRotation = fixedRotation + (1 - cardProgress) * 4;

            return (
              <div
                key={i}
                className="absolute"
                style={{
                  zIndex: i + 1,
                  transform: `translateY(${yPosition}vh) rotate(${currentRotation}deg)`,
                }}
              >
                <LiquidGlassCard
                  shadowIntensity="lg"
                  glowIntensity="sm"
                  blurIntensity="xl"
                  className="h-[400px] w-[90vw] max-w-[900px] rounded-2xl p-8 md:p-12 bg-black/80 border-2 border-white/20"
                >
                  <div className="flex h-full items-start">
                    <span className="text-white/10 text-[200px] md:text-[280px] font-bold select-none leading-none -mt-12">{i + 1}</span>
                    <div className="flex flex-col justify-center pt-4">
                      <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">{useCase.title}</h2>
                      <p className="text-gray-400 text-xl md:text-2xl leading-relaxed">{useCase.description}</p>
                    </div>
                  </div>
                </LiquidGlassCard>
              </div>
            );
          })}
        </div>
      </div>

      {/* Static content at the bottom - only visible when fixed content is hidden */}
      <div
        className={`absolute bottom-0 left-0 right-0 flex flex-col items-center ${isInView ? 'hidden' : 'block'}`}
        style={{ paddingBottom: '40px' }}
      >
        {/* Static header */}
        <div className="text-center max-w-2xl px-8 mb-8">
          <h1 className="text-3xl md:text-5xl font-bold text-white tracking-tight leading-tight mb-4">
            Powerful Use Cases
          </h1>
          <p className="text-gray-400 text-base md:text-lg mb-4">
            From instant arbitrage to sophisticated market-making strategies, AgoráX enables trading patterns impossible on traditional DEXs.
          </p>
        </div>

        {/* Static stacked cards */}
        <div className="relative flex items-center justify-center" style={{ height: '450px' }}>
          {useCases.map((useCase, i) => {
            const fixedRotation = i === 0 ? 0 : (i % 2 === 1 ? 2 : -2);
            return (
              <div
                key={i}
                className="absolute"
                style={{
                  zIndex: i + 1,
                  transform: `rotate(${fixedRotation}deg)`,
                }}
              >
                <LiquidGlassCard
                  shadowIntensity="lg"
                  glowIntensity="sm"
                  blurIntensity="xl"
                  className="h-[400px] w-[90vw] max-w-[900px] rounded-2xl p-8 md:p-12 bg-black/80 border-2 border-white/20"
                >
                  <div className="flex h-full items-start">
                    <span className="text-white/10 text-[200px] md:text-[280px] font-bold select-none leading-none -mt-12">{i + 1}</span>
                    <div className="flex flex-col justify-center pt-4">
                      <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">{useCase.title}</h2>
                      <p className="text-gray-400 text-xl md:text-2xl leading-relaxed">{useCase.description}</p>
                    </div>
                  </div>
                </LiquidGlassCard>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
