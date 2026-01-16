'use client';

import { useState, useRef, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { DisclaimerDialog } from '@/components/DisclaimerDialog';
import { LogoPreloader } from '@/components/LogoPreloader';
import useToast from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';
import { PixelSpinner } from '@/components/ui/PixelSpinner';
import PixelBlastBackground from '@/components/ui/PixelBlastBackground';
import { LiquidGlassCard } from '@/components/ui/liquid-glass';
import { motion, AnimatePresence } from 'framer-motion';
import { ConnectButton } from '@/components/ConnectButton';
import { OpenPositionsTable } from '@/components/OpenPositionsTable';
import { LimitOrderChart } from '@/components/LimitOrderChart';
import { LimitOrderForm } from '@/components/LimitOrderForm';

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
      <AnimatePresence initial={false} mode="sync">
        {isOpen && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div className="px-6 pb-6 pt-0">
              <div className="text-gray-400 whitespace-pre-line" dangerouslySetInnerHTML={{ __html: answer }} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </LiquidGlassCard>
  );
}

export default function Home() {
  const [isTransactionLoading, setIsTransactionLoading] = useState(false);
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const { isConnected, isConnecting } = useAccount();
  const { toast } = useToast();
  const openPositionsTableRef = useRef<any>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const accepted = localStorage.getItem('disclaimer-accepted');
      setShowDisclaimer(accepted !== 'true');
    }
  }, []);

  // Set initializing to false once connection status is determined
  useEffect(() => {
    if (!isConnecting) {
      // Add a small delay to ensure smooth transition
      const timer = setTimeout(() => {
        setIsInitializing(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isConnecting]);

  // Fallback: Force initialization complete after max timeout to prevent stuck spinner
  // This runs once on mount and guarantees the spinner won't be stuck
  useEffect(() => {
    const maxTimeout = setTimeout(() => {
      setIsInitializing(false);
    }, 2000); // 2 second max wait
    return () => clearTimeout(maxTimeout);
  }, []);

  // Chart and form state
  const [sellTokenAddress, setSellTokenAddress] = useState<string | undefined>();
  const [buyTokenAddresses, setBuyTokenAddresses] = useState<(string | undefined)[]>([]);
  const [limitOrderPrice, setLimitOrderPrice] = useState<number | undefined>();
  const [currentMarketPrice, setCurrentMarketPrice] = useState<number | undefined>();
  const [isDragging, setIsDragging] = useState(false);
  const [invertPriceDisplay, setInvertPriceDisplay] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('limitOrderInvertPrice');
      // If no saved value, default to true (inverted)
      return saved === null ? true : saved === 'true';
    }
    return true;
  });
  const [pricesBound, setPricesBound] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('limitOrderPricesBound');
      return saved === null ? true : saved === 'true';
    }
    return true;
  });
  const [individualLimitPrices, setIndividualLimitPrices] = useState<(number | undefined)[]>([]);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  // Test functions for toast notifications
  const testSuccessToast = () => {
    toast({
      title: "Transaction Successful!",
      description: "Your order has been created successfully.",
      variant: "success",
    });
  };

  const testErrorToast = () => {
    toast({
      title: "Transaction Failed",
      description: "otc:not enough tokens provided",
      variant: "destructive",
    });
  };

  const testLoadingState = () => {
    setIsTransactionLoading(true);
    // Simulate a transaction
    setTimeout(() => {
      setIsTransactionLoading(false);
      toast({
        title: "Transaction Complete!",
        description: "Your transaction has been processed.",
        variant: "success",
      });
    }, 3000);
  };

  return (
    <>
      <DisclaimerDialog open={showDisclaimer} onAccept={() => setShowDisclaimer(false)} />
      <LogoPreloader />
      <main className="flex min-h-screen flex-col items-center relative overflow-hidden">
        {/* Animated background effect - fades in after UI loads */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: !isInitializing && !isConnecting ? 1 : 0 }}
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
            {/* Loading State */}
            {(isInitializing || isConnecting) && (
              <div className="flex flex-col items-center justify-center py-20">
                <PixelSpinner size={48} className="mb-4" />
              </div>
            )}

            {/* Not Connected State - Landing Page */}
            {!isInitializing && !isConnecting && !isConnected && (
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
                      blurIntensity="md"
                      glowIntensity="low"
                      shadowIntensity="md"
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
                      blurIntensity="md"
                      glowIntensity="low"
                      shadowIntensity="md"
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
                      blurIntensity="md"
                      glowIntensity="low"
                      shadowIntensity="md"
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
                      blurIntensity="md"
                      glowIntensity="low"
                      shadowIntensity="md"
                      className="p-6 text-center"
                    >
                      <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center mb-4 mx-auto">
                        <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                          {/* Dollar sign */}
                          <line x1="12" y1="2" x2="12" y2="22"/>
                          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                        </svg>
                      </div>
                      <h3 className="text-lg font-semibold text-white mb-2">0.2% Fee</h3>
                      <p className="text-gray-400 text-sm">Low fees on sells. Zero fees on buys. The cheapest place on PulseChain to trade.</p>
                    </LiquidGlassCard>

                    
                    <LiquidGlassCard
                      blurIntensity="md"
                      glowIntensity="low"
                      shadowIntensity="md"
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
                      blurIntensity="md"
                      glowIntensity="low"
                      shadowIntensity="md"
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
                      blurIntensity="md"
                      glowIntensity="low"
                      shadowIntensity="md"
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
                      blurIntensity="md"
                      glowIntensity="low"
                      shadowIntensity="md"
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
                      question="Is it safe?"
                      answer="AgoráX is a decentralized, immutable smart contract. Your tokens never leave the smart contract until a trade executes. There's no centralized person, or entity that can take or freeze your funds. All code is on-tchain and verifiable."
                      isOpen={openFaqIndex === 4}
                      onToggle={() => setOpenFaqIndex(openFaqIndex === 4 ? null : 4)}
                    />
                    <FAQItem
                      question="Are there admin keys?"
                      answer="Yes. There are a few basic owner functions, but they are primarily for whitelist and fee management, but even for those users are protected. Their original fee and tokens listed are protected for the remainder of their order's life. The Owner CANNOT access a users funds, but there is an emergency pause that prevents placing and filling orders. Cancelling orders and collecting proceeds are both still possible in the event of a pause."
                      isOpen={openFaqIndex === 5}
                      onToggle={() => setOpenFaqIndex(openFaqIndex === 5 ? null : 5)}
                    />
                    <FAQItem
                      question="Is the code immutable?"
                      answer="Yes. 100% immutable. No upgrades, no proxy contracts."
                      isOpen={openFaqIndex === 6}
                      onToggle={() => setOpenFaqIndex(openFaqIndex === 6 ? null : 6)}
                    />
                    <FAQItem
                      question="Which tokens can I trade?"
                      answer="You can sell any PRC-20 token on PulseChain and buy from a whitelist of 100+ tokens. For whitelist additions DM us at https://x.com/Time_Haven"
                      isOpen={openFaqIndex === 7}
                      onToggle={() => setOpenFaqIndex(openFaqIndex === 7 ? null : 7)}
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
            )}

            {/* Connected State */}
            {!isInitializing && !isConnecting && isConnected && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4 }}
              >
                <div className="flex flex-col items-center gap-4">
                  {/* Main Create Deal Button with Loading State */}
                  {isTransactionLoading && (
                    <div className="flex justify-center">
                      <div className="px-8 py-3 border border-white text-white rounded-full font-semibold flex items-center gap-2">
                        <PixelSpinner size={16} />
                        Loading
                      </div>
                    </div>
                  )}

                  {/* Chart and Form Section */}
                  <div className="w-full mt-8">
                    <div className="flex flex-col lg:grid lg:grid-cols-5 gap-4">
                      {/* Chart - Full width on mobile, 3 columns on desktop */}
                      <div className="w-full lg:col-span-3 min-h-[400px]">
                        <LimitOrderChart
                          sellTokenAddress={sellTokenAddress}
                          buyTokenAddresses={buyTokenAddresses}
                          limitOrderPrice={limitOrderPrice}
                          invertPriceDisplay={invertPriceDisplay}
                          pricesBound={pricesBound}
                          individualLimitPrices={individualLimitPrices}
                          onLimitPriceChange={(newPrice) => {
                            setLimitOrderPrice(newPrice);
                            // Always update individualLimitPrices[0] to keep in sync
                            setIndividualLimitPrices(prev => {
                              const newPrices = [...prev];
                              newPrices[0] = newPrice;
                              return newPrices;
                            });
                          }}
                          onIndividualLimitPriceChange={(index, newPrice) => {
                            setIndividualLimitPrices(prev => {
                              const newPrices = [...prev];
                              newPrices[index] = newPrice;
                              return newPrices;
                            });
                            // When the first token's price is changed, also update the main limit price
                            // so the form input stays in sync
                            if (index === 0) {
                              setLimitOrderPrice(newPrice);
                            }
                          }}
                          onCurrentPriceChange={(price) => {
                            setCurrentMarketPrice(price);
                          }}
                          onDragStateChange={(dragging) => {
                            setIsDragging(dragging);
                          }}
                        />
                      </div>

                      {/* Order Form - Full width on mobile, 2 columns on desktop */}
                      <div className="w-full lg:col-span-2">
                        <LimitOrderForm
                          externalLimitPrice={limitOrderPrice}
                          externalMarketPrice={currentMarketPrice}
                          externalIndividualLimitPrices={individualLimitPrices}
                          isDragging={isDragging}
                          onTokenChange={(sell, buyTokens) => {
                            setSellTokenAddress(sell);
                            setBuyTokenAddresses(buyTokens);
                          }}
                          onLimitPriceChange={(price) => {
                            setLimitOrderPrice(price);
                            // Always update individualLimitPrices[0] to keep in sync
                            // When unbound, this moves the first token's line on the chart
                            setIndividualLimitPrices(prev => {
                              const newPrices = [...prev];
                              newPrices[0] = price;
                              return newPrices;
                            });
                          }}
                          onInvertPriceDisplayChange={(inverted) => {
                            setInvertPriceDisplay(inverted);
                          }}
                          onPricesBoundChange={(bound) => {
                            setPricesBound(bound);
                          }}
                          onIndividualLimitPricesChange={(prices) => {
                            setIndividualLimitPrices(prices);
                          }}
                          onCreateOrderClick={(sellToken, buyTokens, sellAmount, buyAmounts, expirationDays) => {
                            // Order creation is now handled directly in the form
                            // No need to open the modal
                          }}
                          onOrderCreated={() => {
                            // Refresh the positions table when a new order is created
                            if (openPositionsTableRef.current?.refreshAndNavigateToMyActiveOrders) {
                              openPositionsTableRef.current.refreshAndNavigateToMyActiveOrders();
                            }
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </div>

        {/* Main Content - Only for connected users */}
        {!isInitializing && !isConnecting && isConnected && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
            className="w-full px-2 md:px-8 mt-0 relative z-10"
          >
            <div className="max-w-[1200px] mx-auto">
              <OpenPositionsTable ref={openPositionsTableRef} />
            </div>
          </motion.div>
        )}
      </main>
    </>
  );
} 