'use client';

import { useRef } from 'react';
import { AnimatedBeam, Circle } from '@/components/ui/animated-beam';
import { CoinLogo } from '@/components/ui/CoinLogo';
import Image from 'next/image';

export function HowItWorks() {
  const containerRef = useRef<HTMLDivElement>(null);

  // Seller side refs (left)
  const sellerRef = useRef<HTMLDivElement>(null);
  const sellToken1Ref = useRef<HTMLDivElement>(null);
  const sellToken2Ref = useRef<HTMLDivElement>(null);
  const sellToken3Ref = useRef<HTMLDivElement>(null);

  // Center (AgoraX)
  const centerRef = useRef<HTMLDivElement>(null);

  // Buyer side refs (right)
  const buyerRef = useRef<HTMLDivElement>(null);
  const buyToken1Ref = useRef<HTMLDivElement>(null);
  const buyToken2Ref = useRef<HTMLDivElement>(null);
  const buyToken3Ref = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={containerRef}
      className="relative flex w-full max-w-[700px] mx-auto items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-black/50 backdrop-blur-sm p-6 md:p-10"
    >
      <div className="flex h-full w-full flex-row items-center justify-between gap-4 md:gap-8">
        {/* Left Column - Seller's tokens (what they're selling) */}
        <div className="flex flex-col items-center gap-4 md:gap-6">
          <span className="text-xs text-gray-500 mb-2">Sell</span>
          <Circle ref={sellToken1Ref} className="h-10 w-10 md:h-14 md:w-14 p-1">
            <CoinLogo symbol="HEX" size="lg" />
          </Circle>
          <Circle ref={sellToken2Ref} className="h-10 w-10 md:h-14 md:w-14 p-1">
            <CoinLogo symbol="INC" size="lg" />
          </Circle>
          <Circle ref={sellToken3Ref} className="h-10 w-10 md:h-14 md:w-14 p-2">
            <CoinLogo symbol="PLSX" size="lg" />
          </Circle>
        </div>

        {/* Center - AgoraX Logo */}
        <div className="flex flex-col items-center">
          <Circle ref={centerRef} className="h-20 w-20 md:h-28 md:w-28 p-0 border-white/30 overflow-hidden">
            <Image
              src="/favicon.svg"
              alt="AgoraX"
              width={112}
              height={112}
              className="w-full h-full scale-110"
            />
          </Circle>
          <span className="text-white/60 text-xs mt-3 font-medium">AgoraX</span>
        </div>

        {/* Right Column - Buyer's tokens (what seller accepts) */}
        <div className="flex flex-col items-center gap-4 md:gap-6">
          <span className="text-xs text-gray-500 mb-2">Accept</span>
          <Circle ref={buyToken1Ref} className="h-10 w-10 md:h-14 md:w-14 p-1">
            <CoinLogo symbol="PLS" size="lg" />
          </Circle>
          <Circle ref={buyToken2Ref} className="h-10 w-10 md:h-14 md:w-14 p-1">
            <CoinLogo symbol="COM" size="lg" />
          </Circle>
          <Circle ref={buyToken3Ref} className="h-10 w-10 md:h-14 md:w-14 p-1">
            <CoinLogo symbol="USDT" size="lg" />
          </Circle>
        </div>
      </div>

      {/* Animated Beams - Left to Center (Selling) */}
      <AnimatedBeam
        containerRef={containerRef}
        fromRef={sellToken1Ref}
        toRef={centerRef}
        curvature={-40}
        endYOffset={-10}
        dotted
        gradientStartColor="#ff6b6b"
        gradientStopColor="#9c40ff"
      />
      <AnimatedBeam
        containerRef={containerRef}
        fromRef={sellToken2Ref}
        toRef={centerRef}
        dotted
        gradientStartColor="#ff6b6b"
        gradientStopColor="#9c40ff"
      />
      <AnimatedBeam
        containerRef={containerRef}
        fromRef={sellToken3Ref}
        toRef={centerRef}
        curvature={40}
        endYOffset={10}
        dotted
        gradientStartColor="#ff6b6b"
        gradientStopColor="#9c40ff"
      />

      {/* Animated Beams - Center to Right (Accepting payment) */}
      <AnimatedBeam
        containerRef={containerRef}
        fromRef={buyToken1Ref}
        toRef={centerRef}
        curvature={40}
        endYOffset={-10}
        reverse
        dotted
        gradientStartColor="#4ade80"
        gradientStopColor="#22d3ee"
      />
      <AnimatedBeam
        containerRef={containerRef}
        fromRef={buyToken2Ref}
        toRef={centerRef}
        reverse
        dotted
        gradientStartColor="#4ade80"
        gradientStopColor="#22d3ee"
      />
      <AnimatedBeam
        containerRef={containerRef}
        fromRef={buyToken3Ref}
        toRef={centerRef}
        curvature={-40}
        endYOffset={10}
        reverse
        dotted
        gradientStartColor="#4ade80"
        gradientStopColor="#22d3ee"
      />
    </div>
  );
}
