'use client';

import { useState, useRef, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { OpenPositionsTable } from '@/components/OpenPositionsTable';
import { WhitelistDebugger } from '@/components/WhitelistDebugger';
import { DisclaimerDialog } from '@/components/DisclaimerDialog';
import { LogoPreloader } from '@/components/LogoPreloader';
import { LimitOrderChart } from '@/components/LimitOrderChart';
import { LimitOrderForm } from '@/components/LimitOrderForm';
import useToast from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';
import { PixelSpinner } from '@/components/ui/PixelSpinner';
import PixelBlastBackground from '@/components/ui/PixelBlastBackground';
import { LiquidGlassCard } from '@/components/ui/liquid-glass';
import { motion, AnimatePresence } from 'framer-motion';

// FAQ Accordion Item Component
function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <LiquidGlassCard blurIntensity="sm" glowIntensity="none" shadowIntensity="sm" className="overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
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
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="px-6 pb-6 pt-0">
              <p className="text-gray-400">{answer}</p>
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

  // Set to false to hide the whitelist debugger
  const SHOW_WHITELIST_DEBUGGER = false;

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
              <div className="pt-12 md:pt-20 pb-16">
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
                  <h2 className="text-2xl md:text-4xl font-bold text-white mb-4 text-center">A New Paradigm</h2>
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

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <LiquidGlassCard
                      blurIntensity="md"
                      glowIntensity="low"
                      shadowIntensity="md"
                      className="p-6 text-center"
                    >
                      <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center mb-4 mx-auto">
                        <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="4" r="2"/>
                          <line x1="12" y1="6" x2="12" y2="10"/>
                          <line x1="12" y1="10" x2="6" y2="14"/>
                          <line x1="12" y1="10" x2="12" y2="14"/>
                          <line x1="12" y1="10" x2="18" y2="14"/>
                          <line x1="6" y1="14" x2="6" y2="18"/>
                          <line x1="12" y1="14" x2="12" y2="18"/>
                          <line x1="18" y1="14" x2="18" y2="18"/>
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
                        <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <circle cx="12" cy="12" r="10" strokeWidth={1.5} />
                          <path d="M2 12h20" strokeWidth={1.5} />
                          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" strokeWidth={1.5} />
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
                      <p className="text-gray-400 text-sm">Buy and sell peer-to-peer effortlessly with an apple UX-like app.</p>
                    </LiquidGlassCard>

                    <LiquidGlassCard
                      blurIntensity="md"
                      glowIntensity="low"
                      shadowIntensity="md"
                      className="p-6 text-center"
                    >
                      <div className="w-12 h-12 rounded-xl bg-orange-500/20 flex items-center justify-center mb-4 mx-auto">
                        <svg className="w-6 h-6 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                          <line x1="12" y1="5" x2="12" y2="19"/>
                          <line x1="5" y1="12" x2="19" y2="12"/>
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
                      <div className="w-12 h-12 rounded-xl bg-orange-500/20 flex items-center justify-center mb-4 mx-auto">
                        <svg className="w-6 h-6 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                          <line x1="12" y1="5" x2="12" y2="19"/>
                          <line x1="5" y1="12" x2="19" y2="12"/>
                        </svg>
                      </div>
                      <h3 className="text-lg font-semibold text-white mb-2">Partial Order Fills</h3>
                      <p className="text-gray-400 text-sm">Users can accept pertial fills or require complete fills for their orders.</p>
                    </LiquidGlassCard>

                                        <LiquidGlassCard
                      blurIntensity="md"
                      glowIntensity="low"
                      shadowIntensity="md"
                      className="p-6 text-center"
                    >
                      <div className="w-12 h-12 rounded-xl bg-orange-500/20 flex items-center justify-center mb-4 mx-auto">
                        <svg className="w-6 h-6 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                          <line x1="12" y1="5" x2="12" y2="19"/>
                          <line x1="5" y1="12" x2="19" y2="12"/>
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
                      answer="AgoráX is a peer-to-peer OTC trading platform built on PulseChain. It allows users to create and fill limit orders directly from their wallets, with no intermediaries, no KYC, and minimal fees."
                    />
                    <FAQItem
                      question="How does it work?"
                      answer="You create an order by specifying what tokens you want to sell and what you want to receive. Your tokens are held in a smart contract until someone fills your order or you cancel it. Settlement is trustless."
                    />
                    <FAQItem
                      question="Is it safe?"
                      answer="Yes. AgoráX is non-custodial. Your tokens never leave the smart contract until a trade executes. There's no centralized point of failure, no admin keys that can freeze your funds, and all code is on-chain and verifiable."
                    />
                    <FAQItem
                      question="Are there admin keys?"
                      answer="tbc"
                    />
                    <FAQItem
                      question="Is the code immutable?"
                      answer="tbc"
                    />
                    <FAQItem
                      question="What is the liquidity & slippage like?"
                      answer="AgoráX uses peer-to-peer limit order logic to complete your trades. This means that there is no slippage on your orders whatsoever. You either get filled at your exact price or you don't."
                    />
                    <FAQItem
                      question="What are the fees?"
                      answer="AgoráX charges a flat 100 PLS listing fee + a 0.2% fee deducted from the seller's bought tokens on order complete. These fees are the lowest of any DEX on PulseChain. For example, 
                      
                      When it comes to selling, with our fees at 0.2%, we beat: <br><br>
• PHUX/TIDE at 0.3%
• Uniswap V2 and V3 at 0.3%
• PulseX V1 and V2 at 0.29%
• 9mm V2 and V3 at 0.25%
• 9inch V3 at 0.25%
• 9inch V2 at 0.22%"
                    />
                    <FAQItem
                      question="Which tokens can I trade?"
                      answer="You can sell any PRC-20 token on PulseChain and buy from a whitelist of 100+ tokens. For whitelist additions DM us at https://x.com/Time_Haven"
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
                    Experience crypto trading the way it was meant to be. Peer-to-peer. Trustless. On your own terms.
                  </p>
                </motion.section>

              </div>
            )}

            {/* Connected State */}
            {!isInitializing && !isConnecting && isConnected && (
              <>
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
                          }}
                          onIndividualLimitPriceChange={(index, newPrice) => {
                            setIndividualLimitPrices(prev => {
                              const newPrices = [...prev];
                              newPrices[index] = newPrice;
                              return newPrices;
                            });
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
              </>
            )}
          </div>
        </div>

        {/* Main Content - Only for connected users */}
        {!isInitializing && !isConnecting && isConnected && (
          <div className="w-full px-2 md:px-8 mt-2 relative z-10">
            <div className="max-w-[1200px] mx-auto">
              {SHOW_WHITELIST_DEBUGGER && <WhitelistDebugger />}
              <OpenPositionsTable ref={openPositionsTableRef} />
            </div>
          </div>
        )}
      </main>
    </>
  );
} 