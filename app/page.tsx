'use client';

import { useState } from 'react';
import { DisclaimerDialog } from '@/components/DisclaimerDialog';
import { LogoPreloader } from '@/components/LogoPreloader';
import PixelBlastBackground from '@/components/ui/PixelBlastBackground';
import { LiquidGlassCard } from '@/components/ui/liquid-glass';
import { motion } from 'framer-motion';
import { ConnectButton } from '@/components/ConnectButton';
import { OpenPositionsTable } from '@/components/OpenPositionsTable';
import { StackingUseCases } from '@/components/StackingUseCases';
import { HowItWorks } from '@/components/HowItWorks';
import { useEffect } from 'react';

// FAQ Accordion Item Component
function FAQItem({ question, answer, isOpen, onToggle }: { question: string; answer: string; isOpen: boolean; onToggle: () => void }) {
  return (
    <LiquidGlassCard blurIntensity="sm" glowIntensity="none" shadowIntensity="sm" className="overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full p-6 flex items-center justify-between text-left"
      >
        <h3 className="text-lg font-semibold text-white pr-4">{question}</h3>
        <motion.svg
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="w-5 h-5 text-gray-400 flex-shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </motion.svg>
      </button>
      <motion.div
        initial={false}
        animate={{
          height: isOpen ? 'auto' : 0,
          opacity: isOpen ? 1 : 0
        }}
        transition={{
          duration: 0.2,
          ease: 'easeInOut'
        }}
        style={{ overflow: 'hidden' }}
      >
        <div className="px-6 pb-6 pt-0">
          <div className="text-gray-400 whitespace-pre-line" dangerouslySetInnerHTML={{ __html: answer }} />
        </div>
      </motion.div>
    </LiquidGlassCard>
  );
}

export default function Home() {
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const accepted = localStorage.getItem('disclaimer-accepted');
      setShowDisclaimer(accepted !== 'true');
    }
  }, []);

  return (
    <>
      <DisclaimerDialog open={showDisclaimer} onAccept={() => setShowDisclaimer(false)} />
      <LogoPreloader />
      <main className="flex min-h-screen flex-col items-center relative">
        {/* Animated background effect */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{
            duration: 1.2,
            delay: 0.3,
            ease: [0.23, 1, 0.32, 1]
          }}
          className="fixed inset-0 z-0"
        >
          <PixelBlastBackground />
        </motion.div>

        {/* Hero Section */}
        <div className="w-full px-2 md:px-8 mt-2 mb-0 relative z-10">
          <div className="max-w-[1200px] mx-auto">
            <div className="pt-12 md:pt-20 pb-16 px-4 md:px-6">
              {/* Hero Section */}
              <div className="text-center mb-8 md:mb-12">
                <motion.h1
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6 }}
                  className="text-4xl md:text-7xl font-bold text-white mb-6 tracking-tight"
                >
                  PulseChain's On-chain Limit Order DEX
                </motion.h1>
                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.1 }}
                  className="text-xl md:text-2xl text-gray-400 max-w-2xl mx-auto mb-6"
                >
                  Zero slippage. Low fees.  Peer-to-peer.
                </motion.p>
              </div>

              {/* Live Orders Table - Right after header */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="mb-16 md:mb-24"
              >
                <OpenPositionsTable isMarketplaceMode={true} isLandingPageMode={true} />
              </motion.div>

              {/* Paradigm Shift Section */}
              <motion.section
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.5 }}
                className="mb-16 md:mb-24"
              >
                <h2 className="text-2xl md:text-4xl font-bold text-white mb-4 text-center">A New Way to Trade</h2>
                <p className="text-gray-400 text-center max-w-2xl mx-auto mb-10">
                  Crypto was invented to remove middlemen but crypto exchanges became the new middlemen.
                  AgoráX brings decentralized finance{' '}
                  <span className="text-green-400 underline underline-offset-4 decoration-2 font-semibold">back to everyday people</span>.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* The Old Way */}
                  <LiquidGlassCard
                    shadowIntensity="sm"
                    glowIntensity="sm"
                    blurIntensity="xl"
                    className="p-6 md:p-8"
                  >
                    <h3 className="text-xl font-semibold text-red-400 mb-4">The Old Way</h3>
                    <ul className="space-y-3 text-gray-400">
                      <li className="flex items-start gap-3">
                        <svg className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        Low liquidity & high slippage
                      </li>
                      <li className="flex items-start gap-3">
                        <svg className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        Exchanges hold and lose your crypto
                      </li>
                      <li className="flex items-start gap-3">
                        <svg className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        High middlemen fees
                      </li>
                      <li className="flex items-start gap-3">
                        <svg className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        Privacy violations and KYC requirements
                      </li>
                      <li className="flex items-start gap-3">
                        <svg className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        Order book & bot manipulation
                      </li>
                    </ul>
                  </LiquidGlassCard>

                  {/* New Way */}
                  <LiquidGlassCard
                    shadowIntensity="sm"
                    glowIntensity="sm"
                    blurIntensity="xl"
                    className="p-6 md:p-8"
                  >
                    <h3 className="text-xl font-semibold text-green-400 mb-4">With AgoráX</h3>
                    <ul className="space-y-3 text-gray-400">
                      <li className="flex items-start gap-3">
                        <svg className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Zero slippage - Unlocking trades that were not previously feasable
                      </li>
                      <li className="flex items-start gap-3">
                        <svg className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Safe - Non-custodial, trustless & instant settlement
                      </li>
                      <li className="flex items-start gap-3">
                        <svg className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Cheap - No fees for buyers & a low 0.2% fee for sellers
                      </li>
                      <li className="flex items-start gap-3">
                        <svg className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Private - No KYC & no data collection
                      </li>
                      <li className="flex items-start gap-3">
                        <svg className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        User First - Bot protection & transparent order book
                      </li>
                    </ul>
                  </LiquidGlassCard>
                </div>
              </motion.section>


              {/* Section Divider */}
              <div className="w-full h-px bg-gradient-to-r from-black via-gray-400 to-black my-16 md:my-24" />

              {/* How It Works Section */}
              <motion.section
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.55 }}
                className="mb-16 md:mb-24"
              >
                <h2 className="text-2xl md:text-4xl font-bold text-white mb-4 text-center">How It Works</h2>
                <p className="text-gray-400 text-center max-w-2xl mx-auto mb-10">
                  Create limit orders with tokens you want to sell, and specify which tokens you'll accept as payment - all at your exact prices.
                </p>
                <HowItWorks />
                <div className="flex flex-col md:flex-row justify-center gap-8 mt-10 text-center">
                  <div className="flex-1 max-w-[250px] mx-auto">
                    <div className="w-10 h-10 rounded-full bg-black border-2 border-white-600 flex items-center justify-center mx-auto mb-3">
                      <span className="text-white-600 font-bold">1</span>
                    </div>
                    <h3 className="text-white font-semibold mb-1">Deposit Tokens</h3>
                    <p className="text-gray-500 text-sm">Deposit the tokens you want to sell into the contract</p>
                  </div>
                  <div className="flex-1 max-w-[250px] mx-auto">
                    <div className="w-10 h-10 rounded-full bg-black border-2 border-white-600 flex items-center justify-center mx-auto mb-3">
                      <span className="text-white-600 font-bold">2</span>
                    </div>
                    <h3 className="text-white font-semibold mb-1">Set Your Price</h3>
                    <p className="text-gray-500 text-sm">Choose which tokens to accept and at what rates</p>
                  </div>
                  <div className="flex-1 max-w-[250px] mx-auto">
                    <div className="w-10 h-10 rounded-full bg-black border-2 border-white-600 flex items-center justify-center mx-auto mb-3">
                      <span className="text-white-600 font-bold">3</span>
                    </div>
                    <h3 className="text-white font-semibold mb-1">Get Filled</h3>
                    <p className="text-gray-500 text-sm">Buyers fill your order at your exact price - zero slippage</p>
                  </div>
                </div>
              </motion.section>

            </div>
            {/* End of padded container - Use Cases needs full width */}

            {/* Use Cases Section - After How It Works, before Unique Features */}
            <StackingUseCases />

            {/* Content After Use Cases */}
            <div className="pt-12 md:pt-20 pb-16 px-4 md:px-6">
              {/* Why AgoráX Wins Section */}
              <motion.section
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.6 }}
                className="mb-16 md:mb-24"
              >
                <h2 className="text-2xl md:text-4xl font-bold text-white mb-10 text-center">Unique Features</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <LiquidGlassCard
                    shadowIntensity="sm"
                    glowIntensity="sm"
                    blurIntensity="xl"
                    className="p-6 text-center"
                  >
                    <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center mb-4 mx-auto">
                      <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                        {/* Centered circle */}
                        <circle cx="12" cy="12" r="8"/>
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-2">Zero Slippage</h3>
                    <p className="text-gray-400 text-sm">Trade even the most illiquid tokens at size with zero slippage for either the buyer or seller.</p>
                  </LiquidGlassCard>

                  <LiquidGlassCard
                    shadowIntensity="sm"
                    glowIntensity="sm"
                    blurIntensity="xl"
                    className="p-6 text-center"
                  >
                    <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center mb-4 mx-auto">
                      <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                        {/* Dollar sign */}
                        <line x1="12" y1="2" x2="12" y2="22"/>
                        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-2">Lowest Fees</h3>
                    <p className="text-gray-400 text-sm">Low 0.2% fee on sells. Zero fees on buys. The #1cheapest place on PulseChain to trade.</p>
                  </LiquidGlassCard>


                  <LiquidGlassCard
                    shadowIntensity="sm"
                    glowIntensity="sm"
                    blurIntensity="xl"
                    className="p-6 text-center"
                  >
                    <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center mb-4 mx-auto">
                      <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-2">Killer User Experience</h3>
                    <p className="text-gray-400 text-sm">Buy and sell peer-to-peer effortlessly, with an iOS app-like experience.</p>
                  </LiquidGlassCard>

                  <LiquidGlassCard
                    shadowIntensity="sm"
                    glowIntensity="sm"
                    blurIntensity="xl"
                    className="p-6 text-center"
                  >
                    <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center mb-4 mx-auto">
                      <svg className="w-6 h-6 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                        {/* Grid of coins/tokens */}
                        <circle cx="7" cy="7" r="3"/>
                        <circle cx="17" cy="7" r="3"/>
                        <circle cx="7" cy="17" r="3"/>
                        <circle cx="17" cy="17" r="3"/>
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-2">100+ Tokens Supported</h3>
                    <p className="text-gray-400 text-sm">Supports sells of any token and buys of 100+ tokens on PulseChain.</p>
                  </LiquidGlassCard>

                  <LiquidGlassCard
                    shadowIntensity="sm"
                    glowIntensity="sm"
                    blurIntensity="xl"
                    className="p-6 text-center"
                  >
                    <div className="w-12 h-12 rounded-xl bg-cyan-500/20 flex items-center justify-center mb-4 mx-auto">
                      <svg className="w-6 h-6 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                        {/* Pie chart - partial fill */}
                        <circle cx="12" cy="12" r="10"/>
                        <path d="M12 2a10 10 0 0 1 10 10h-10z" fill="currentColor" opacity="0.3"/>
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-2">Partial Order Fills</h3>
                    <p className="text-gray-400 text-sm">Users can accept partial fills or require complete fills for their orders.</p>
                  </LiquidGlassCard>

                  <LiquidGlassCard
                    shadowIntensity="sm"
                    glowIntensity="sm"
                    blurIntensity="xl"
                    className="p-6 text-center"
                  >
                    <div className="w-12 h-12 rounded-xl bg-pink-500/20 flex items-center justify-center mb-4 mx-auto">
                      <svg className="w-6 h-6 text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                        {/* Multiple coins stacked - payment flexibility */}
                        <ellipse cx="12" cy="6" rx="8" ry="3"/>
                        <path d="M4 6v6c0 1.657 3.582 3 8 3s8-1.343 8-3V6"/>
                        <path d="M4 12v6c0 1.657 3.582 3 8 3s8-1.343 8-3v-6"/>
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-2">Payment Flexibility</h3>
                    <p className="text-gray-400 text-sm">Users are able to accept payment in multiple tokens, at different price points.</p>
                  </LiquidGlassCard>
                </div>
              </motion.section>

              {/* Death by 1000 Cuts Section */}
              <motion.section
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.65 }}
                className="mb-16 md:mb-24"
              >
                <h2 className="text-2xl md:text-4xl font-bold text-white mb-8 text-center">+ more microconsiderations to protect you</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl mx-auto">
                  {/* Claim When You Want */}
                  <LiquidGlassCard
                    shadowIntensity="sm"
                    glowIntensity="sm"
                    blurIntensity="xl"
                    className="p-6"
                  >
                    <div className="flex gap-4">
                      <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-white font-semibold mb-1">Claims Proceed Only When You Want</h3>
                        <p className="text-gray-400 text-sm">Choose when to collect your proceeds - useful for tax planning or security reasons. Unlike LP positions where rewards auto-compound.</p>
                      </div>
                    </div>
                  </LiquidGlassCard>

                  {/* Anti-Spam Protection */}
                  <LiquidGlassCard
                    shadowIntensity="sm"
                    glowIntensity="sm"
                    blurIntensity="xl"
                    className="p-6"
                  >
                    <div className="flex gap-4">
                      <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-white font-semibold mb-1">Anti-Spam Protection</h3>
                        <p className="text-gray-400 text-sm">100 PLS listing fee prevents order book spam and keeps the marketplace clean for real traders.</p>
                      </div>
                    </div>
                  </LiquidGlassCard>

                  {/* No Spending Permissions */}
                  <LiquidGlassCard
                    shadowIntensity="sm"
                    glowIntensity="sm"
                    blurIntensity="xl"
                    className="p-6"
                  >
                    <div className="flex gap-4">
                      <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-white font-semibold mb-1">No Spending Permissions</h3>
                        <p className="text-gray-400 text-sm">We escrow funds in the contract like Uniswap - no unlimited approvals that could drain your wallet if hacked. You always know exactly what's at risk.</p>
                      </div>
                    </div>
                  </LiquidGlassCard>

                  {/* Non-Tradeable Receipt Tokens */}
                  <LiquidGlassCard
                    shadowIntensity="sm"
                    glowIntensity="sm"
                    blurIntensity="xl"
                    className="p-6"
                  >
                    <div className="flex gap-4">
                      <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-white font-semibold mb-1">Non-Tradeable Receipt Tokens</h3>
                        <p className="text-gray-400 text-sm">AgoraX receipt tokens can't be transferred - a security feature noted in the audit. No risk of accidentally losing access to your limit order funds.</p>
                      </div>
                    </div>
                  </LiquidGlassCard>

                  {/* MEV & Flash Loan Protection */}
                  <LiquidGlassCard
                    shadowIntensity="sm"
                    glowIntensity="sm"
                    blurIntensity="xl"
                    className="p-6"
                  >
                    <div className="flex gap-4">
                      <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0-10.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.75c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.57-.598-3.75h-.152c-3.196 0-6.1-1.249-8.25-3.286zm0 13.036h.008v.008H12v-.008z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-white font-semibold mb-1">MEV & Flash Loan Protection</h3>
                        <p className="text-gray-400 text-sm">Built-in cooldown period on new orders prevents flash loan attacks and MEV exploitation. Your orders can't be sandwiched.</p>
                      </div>
                    </div>
                  </LiquidGlassCard>

                  {/* Grandfathered Fees */}
                  <LiquidGlassCard
                    shadowIntensity="sm"
                    glowIntensity="sm"
                    blurIntensity="xl"
                    className="p-6"
                  >
                    <div className="flex gap-4">
                      <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-white font-semibold mb-1">Grandfathered Fees</h3>
                        <p className="text-gray-400 text-sm">Your order locks in the fee rate at creation. If fees increase later, you still pay the lower rate. You're protected for the order's lifetime.</p>
                      </div>
                    </div>
                  </LiquidGlassCard>

                  {/* Immutable Fee Caps */}
                  <LiquidGlassCard
                    shadowIntensity="sm"
                    glowIntensity="sm"
                    blurIntensity="xl"
                    className="p-6"
                  >
                    <div className="flex gap-4">
                      <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-white font-semibold mb-1">Immutable Fee Caps</h3>
                        <p className="text-gray-400 text-sm">Hard-coded maximum fee limits in the contract. The owner can never raise fees beyond the immutable cap set at deployment.</p>
                      </div>
                    </div>
                  </LiquidGlassCard>

                  {/* No Accidental PLS Loss */}
                  <LiquidGlassCard
                    shadowIntensity="sm"
                    glowIntensity="sm"
                    blurIntensity="xl"
                    className="p-6"
                  >
                    <div className="flex gap-4">
                      <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-white font-semibold mb-1">PLS Send to Contract Protection</h3>
                        <p className="text-gray-400 text-sm">Direct transfers of PLS to the contract are rejected. You can't accidentally send to the Contract address and lose them forever.</p>
                      </div>
                    </div>
                  </LiquidGlassCard>

                  {/* Reentrancy Protection */}
                  <LiquidGlassCard
                    shadowIntensity="sm"
                    glowIntensity="sm"
                    blurIntensity="xl"
                    className="p-6"
                  >
                    <div className="flex gap-4">
                      <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-white font-semibold mb-1">Reentrancy Protection</h3>
                        <p className="text-gray-400 text-sm">All state-changing functions use OpenZeppelin's ReentrancyGuard. Protection against the class of exploits that drained millions from other protocols.</p>
                      </div>
                    </div>
                  </LiquidGlassCard>

                  {/* No Price Oracle */}
                  <LiquidGlassCard
                    shadowIntensity="sm"
                    glowIntensity="sm"
                    blurIntensity="xl"
                    className="p-6"
                  >
                    <div className="flex gap-4">
                      <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-white font-semibold mb-1">No Price Oracle Dependency</h3>
                        <p className="text-gray-400 text-sm">Zero reliance on external price oracles. No potential for oracle manipulation, stale prices, or single points of failure.</p>
                      </div>
                    </div>
                  </LiquidGlassCard>
                </div>
              </motion.section>

              {/* Section Divider */}
              <div className="w-full h-px bg-gradient-to-r from-black via-gray-400 to-black my-16 md:my-24" />

              {/* FAQ Section */}
              <motion.section
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.7 }}
                className="mb-16 md:mb-24"
              >
                <h2 className="text-2xl md:text-4xl font-bold text-white mb-10 text-center">Frequently Asked Questions</h2>

                <div className="space-y-3 max-w-3xl mx-auto">
                  <FAQItem
                    question="What is AgoráX?"
                    answer="AgoráX is a peer-to-peer OTC trading platform built on PulseChain. It allows users to create and fill limit orders directly from their wallets - no KYC, no slippage, and minimal fees."
                    isOpen={openFaqIndex === 0}
                    onToggle={() => setOpenFaqIndex(openFaqIndex === 0 ? null : 0)}
                  />
                  <FAQItem
                    question="How does it work?"
                    answer="You create an order by specifying what tokens you want to sell and what you want to receive, and at what price. Your tokens are held in a smart contract until someone fills your order or you cancel it."
                    isOpen={openFaqIndex === 1}
                    onToggle={() => setOpenFaqIndex(openFaqIndex === 1 ? null : 1)}
                  />
                  <FAQItem
                    question="What are the fees?"
                    answer="AgoráX charges a flat <strong class='text-white'>100 PLS</strong> listing fee + a <strong class='text-white'>0.2%</strong> fee deducted from the seller's received tokens on order completion.<br/><br/>These are the lowest fees of any DEX on PulseChain:<br/><br/><span class='text-green-400'>✓ AgoráX: 0.2%</span><br/><span class='text-gray-500'>• 9inch V2: 0.22%</span><br/><span class='text-gray-500'>• 9mm V2/V3: 0.25%</span><br/><span class='text-gray-500'>• 9inch V3: 0.25%</span><br/><span class='text-gray-500'>• PulseX V1/V2: 0.29%</span><br/><span class='text-gray-500'>• Uniswap V2/V3: 0.3%</span><br/><span class='text-gray-500'>• PHUX/TIDE: 0.3%</span>"
                    isOpen={openFaqIndex === 2}
                    onToggle={() => setOpenFaqIndex(openFaqIndex === 2 ? null : 2)}
                  />
                  <FAQItem
                    question="What is the liquidity & slippage like?"
                    answer="AgoráX uses peer-to-peer limit order logic to complete your trades. This means that there is no slippage on your orders whatsoever. You either get filled at your exact price or you don't."
                    isOpen={openFaqIndex === 3}
                    onToggle={() => setOpenFaqIndex(openFaqIndex === 3 ? null : 3)}
                  />
                  <FAQItem
                    question="How is AgoráX different from Uniswap V3?"
                    answer="<strong class='text-white'>Fundamentally different architectures:</strong><br/><br/><strong class='text-green-400'>AgoráX (Limit Order Book):</strong><br/>• <strong>Zero slippage</strong> - You set exact prices, trade executes at that price or not at all<br/>• <strong>One order, 50 tokens</strong> - Accept payment in up to 50 different tokens simultaneously<br/>• <strong>No impermanent loss</strong> - You're a trader, not a liquidity provider<br/>• <strong>Non-transferable receipts</strong> - AGX tokens can't be transferred, sold, or stolen via phishing<br/>• <strong>No pooled funds</strong> - Your tokens are in YOUR order, not a shared pool that can be drained<br/>• <strong>MEV protection</strong> - Built-in cooldown period prevents sandwich attacks and flash loan exploits<br/><br/><strong class='text-red-400'>Uniswap V3 (AMM):</strong><br/>• Slippage on every trade - price worsens as trade size increases<br/>• Single token pairs only - one LP position = one pair<br/>• Impermanent loss risk - you lose value when prices move<br/>• LP positions are NFTs - transferable, sellable, and vulnerable to theft<br/>• Shared liquidity pools - one exploit can drain everyone's funds<br/>• MEV vulnerable - sandwich attacks are common"
                    isOpen={openFaqIndex === 4}
                    onToggle={() => setOpenFaqIndex(openFaqIndex === 4 ? null : 4)}
                  />
                  <FAQItem
                    question="Is it safe?"
                    answer="AgoráX is a decentralized, immutable smart contract. Your tokens never leave the smart contract until a trade executes. There's no centralized person, or entity that can take or freeze your funds. All code is on-chain and verifiable."
                    isOpen={openFaqIndex === 5}
                    onToggle={() => setOpenFaqIndex(openFaqIndex === 5 ? null : 5)}
                  />
                  <FAQItem
                    question="Are there admin keys?"
                    answer="Yes. There are a few basic owner functions, but they are primarily for whitelist and fee management, but even for those users are protected. Their original fee and tokens listed are protected for the remainder of their order's life. The Owner CANNOT access a users funds, but there is an emergency pause that prevents placing and filling orders. Cancelling orders and collecting proceeds are both still possible in the event of a pause."
                    isOpen={openFaqIndex === 6}
                    onToggle={() => setOpenFaqIndex(openFaqIndex === 6 ? null : 6)}
                  />
                  <FAQItem
                    question="Is the code immutable?"
                    answer="Yes. 100% immutable. No upgrades, no proxy contracts."
                    isOpen={openFaqIndex === 7}
                    onToggle={() => setOpenFaqIndex(openFaqIndex === 7 ? null : 7)}
                  />
                  <FAQItem
                    question="Which tokens can I trade?"
                    answer="<strong class='text-white'>Sell Tokens (What You Offer):</strong><br/>You can sell <strong class='text-green-400'>any PRC-20 token</strong> on PulseChain, including non-whitelisted tokens.<br/><br/><strong class='text-red-400'>⚠️ Not Supported:</strong><br/>• <strong>Rebasing tokens</strong> - tokens that auto-adjust balances will cause transactions to fail<br/>• <strong>Fee-on-transfer/tax tokens</strong> - tokens that take fees on transfers will revert<br/><br/><strong class='text-white'>Buy Tokens (What You Receive):</strong><br/>Buy tokens must be <strong class='text-cyan-400'>whitelisted and active</strong> on the platform. This protects order fillers from receiving scam or worthless tokens.<br/><br/><strong class='text-white'>Why the difference?</strong><br/>Sellers can exit any position they hold, while fillers are protected from problematic tokens. The whitelist currently includes 100+ major PulseChain tokens.<br/><br/>For whitelist additions DM us at <a href='https://x.com/Time_Haven' target='_blank' class='text-cyan-400 hover:underline'>x.com/Time_Haven</a>"
                    isOpen={openFaqIndex === 8}
                    onToggle={() => setOpenFaqIndex(openFaqIndex === 8 ? null : 8)}
                  />
                </div>
              </motion.section>

              {/* Section Divider */}
              <div className="w-full h-px bg-gradient-to-r from-black via-gray-400 to-black my-16 md:my-24" />

              {/* Full Width CTA */}
              <motion.section
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.8 }}
                className="text-center mb-16"
              >
                <h2 className="text-2xl md:text-4xl font-bold text-white mb-4">Ready to Trade?</h2>
                <p className="text-gray-400 mb-8 max-w-xl mx-auto">
                  Experience crypto trading the way it was meant to be.
                </p>
                <div className="flex justify-center">
                  <ConnectButton />
                </div>
              </motion.section>

            </div>
          </div>
        </div>
      </main>
    </>
  );
}
