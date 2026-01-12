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
import { motion } from 'framer-motion';

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
                    Peer to Peer PulseChain Trading
                  </motion.h1>
                  <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.1 }}
                    className="text-xl md:text-2xl text-gray-400 max-w-2xl mx-auto mb-6"
                  >
                    Low fees. Fast execution. On your own terms.
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


                {/* How it works */}
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.4 }}
                  className="text-center mb-12 bg-black"
                >
                  <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">How it works</h2>

                  <div className="flex flex-col md:flex-row items-center justify-center gap-8 md:gap-4">
                    <div className="flex flex-col items-center max-w-[200px]">
                      <div className="w-10 h-10 rounded-full bg-white border border-white/20 flex items-center justify-center text-black font-semibold mb-3">1</div>
                      <p className="text-white font-medium mb-1">Connect Wallet</p>
                      <p className="text-gray-500 text-sm">Link your Web3 wallet</p>
                    </div>

                    <div className="hidden md:block w-16 h-px bg-white/20"></div>

                    <div className="flex flex-col items-center max-w-[200px]">
                      <div className="w-10 h-10 rounded-full bg-white border border-white/20 flex items-center justify-center text-black font-semibold mb-3">2</div>
                      <p className="text-white font-medium mb-1">Create Order</p>
                      <p className="text-gray-500 text-sm">Set your price and amount</p>
                    </div>

                    <div className="hidden md:block w-16 h-px bg-white/20"></div>

                    <div className="flex flex-col items-center max-w-[200px]">
                      <div className="w-10 h-10 rounded-full bg-white border border-white/20 flex items-center justify-center text-black font-semibold mb-3">3</div>
                      <p className="text-white font-medium mb-1">Trade</p>
                      <p className="text-gray-500 text-sm">Execute or get filled</p>
                    </div>
                  </div>
                </motion.div>

                {/* Section Divider */}
                <div className="w-full h-px bg-gradient-to-r from-black via-gray-400 to-black my-16 md:my-24" />
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
                    AgoraX brings decentralized finance{' '}
                    <span className="text-fuchsia-500 underline underline-offset-4 decoration-2 font-semibold">back to everyday people</span>.
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
                          Custody risk with centralized exchanges
                        </li>
                        <li className="flex items-start gap-3">
                          <svg className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                          High fees that benefit middlemen
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
                          Slow settlement times
                        </li>
                      </ul>
                    </LiquidGlassCard>

                    {/* With AgoraX */}
                    <LiquidGlassCard
                      blurIntensity="md"
                      glowIntensity="low"
                      shadowIntensity="md"
                      className="p-6 md:p-8"
                    >
                      <h3 className="text-xl font-semibold text-green-400 mb-4">With AgoraX</h3>
                      <ul className="space-y-3 text-gray-400">
                        <li className="flex items-start gap-3">
                          <svg className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Non-custodial, trustless settlement
                        </li>
                        <li className="flex items-start gap-3">
                          <svg className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Minimal fees that stay in your pocket
                        </li>
                        <li className="flex items-start gap-3">
                          <svg className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          No KYC, no data exposure
                        </li>
                        <li className="flex items-start gap-3">
                          <svg className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Instant, automated settlement
                        </li>
                      </ul>
                    </LiquidGlassCard>
                  </div>
                </motion.section>

                {/* Why AgoraX Wins Section */}
                <motion.section
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.6 }}
                  className="mb-16 md:mb-24"
                >
                  <h2 className="text-2xl md:text-4xl font-bold text-white mb-10 text-center">Why AgoraX Wins</h2>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
                      <h3 className="text-lg font-semibold text-white mb-2">Killer UX</h3>
                      <p className="text-gray-400 text-sm">Instant, non-custodial settlement that feels simpler than a wire transfer.</p>
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
                      <h3 className="text-lg font-semibold text-white mb-2">PulseChain Native</h3>
                      <p className="text-gray-400 text-sm">Built specifically for PulseChain's high-speed, low-cost ecosystem.</p>
                    </LiquidGlassCard>

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
                      <h3 className="text-lg font-semibold text-white mb-2">True P2P</h3>
                      <p className="text-gray-400 text-sm">Trade directly with counterparties. No order books, no matching engines.</p>
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
                      <h3 className="text-lg font-semibold text-white mb-2">Credible Neutrality</h3>
                      <p className="text-gray-400 text-sm">Settlement is code. No favorites, no listings, no freeze button.</p>
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

                  <div className="space-y-4 max-w-3xl mx-auto">
                    <LiquidGlassCard blurIntensity="sm" glowIntensity="none" shadowIntensity="sm" className="p-6">
                      <h3 className="text-lg font-semibold text-white mb-2">What is AgoraX?</h3>
                      <p className="text-gray-400">
                        AgoraX is a peer-to-peer OTC trading platform built on PulseChain. It allows users to create and fill limit orders directly from their wallets, with no intermediaries, no KYC, and minimal fees.
                      </p>
                    </LiquidGlassCard>

                    <LiquidGlassCard blurIntensity="sm" glowIntensity="none" shadowIntensity="sm" className="p-6">
                      <h3 className="text-lg font-semibold text-white mb-2">How does it work?</h3>
                      <p className="text-gray-400">
                        You create an order by specifying what tokens you want to sell and what you want to receive. Your tokens are held in a smart contract until someone fills your order or you cancel it. Settlement is instant and trustless.
                      </p>
                    </LiquidGlassCard>

                    <LiquidGlassCard blurIntensity="sm" glowIntensity="none" shadowIntensity="sm" className="p-6">
                      <h3 className="text-lg font-semibold text-white mb-2">Is it safe?</h3>
                      <p className="text-gray-400">
                        Yes. AgoraX is non-custodial—your tokens never leave the smart contract until a trade executes. There's no centralized point of failure, no admin keys that can freeze your funds, and all code is on-chain and verifiable.
                      </p>
                    </LiquidGlassCard>

                    <LiquidGlassCard blurIntensity="sm" glowIntensity="none" shadowIntensity="sm" className="p-6">
                      <h3 className="text-lg font-semibold text-white mb-2">What are the fees?</h3>
                      <p className="text-gray-400">
                        AgoraX charges minimal protocol fees that are significantly lower than centralized exchanges. Plus, PulseChain's low gas costs mean your total transaction costs stay minimal.
                      </p>
                    </LiquidGlassCard>

                    <LiquidGlassCard blurIntensity="sm" glowIntensity="none" shadowIntensity="sm" className="p-6">
                      <h3 className="text-lg font-semibold text-white mb-2">Which tokens can I trade?</h3>
                      <p className="text-gray-400">
                        You can trade any PRC-20 token on PulseChain. Create orders for any token pair—popular tokens, new launches, or anything in between.
                      </p>
                    </LiquidGlassCard>
                  </div>
                </motion.section>

                {/* Section Divider */}
                <div className="w-full h-px bg-gradient-to-r from-transparent via-white/20 to-transparent my-16 md:my-24" />

                {/* Full Width CTA */}
                <motion.section
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.8 }}
                  className="text-center mb-16"
                >
                  <h2 className="text-2xl md:text-4xl font-bold text-white mb-4">Ready to Trade?</h2>
                  <p className="text-gray-400 mb-8 max-w-xl mx-auto">
                    Experience crypto trading the way it was meant to be. Peer-to-peer. Trustless. On your terms.
                  </p>
                  <a
                    href="/marketplace"
                    className="inline-block px-8 py-3 bg-white text-black rounded-full font-semibold hover:bg-gray-100 transition-colors"
                  >
                    Go to Marketplace
                  </a>
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
                          onLimitPriceChange={(newPrice) => {
                            setLimitOrderPrice(newPrice);
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