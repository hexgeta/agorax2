'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { DisclaimerDialog } from '@/components/DisclaimerDialog';
import { LogoPreloader } from '@/components/LogoPreloader';
import useToast from '@/hooks/use-toast';
import { PixelSpinner } from '@/components/ui/PixelSpinner';
import PixelBlastBackground from '@/components/ui/PixelBlastBackground';
import { motion } from 'framer-motion';
import { ConnectButton } from '@/components/ConnectButton';
import { OpenPositionsTable } from '@/components/OpenPositionsTable';
import { LimitOrderChart } from '@/components/LimitOrderChart';
import { LimitOrderForm } from '@/components/LimitOrderForm';

export default function MyOrdersPage() {
  const [isTransactionLoading, setIsTransactionLoading] = useState(false);
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const { isConnected, isConnecting } = useAccount();
  const { toast } = useToast();
  const openPositionsTableRef = useRef<any>(null);
  const proStatsContainerRef = useRef<HTMLDivElement>(null);
  const formCardRef = useRef<HTMLDivElement>(null);
  const [proStatsContainerMounted, setProStatsContainerMounted] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [formCardHeight, setFormCardHeight] = useState<number | null>(null);

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
  useEffect(() => {
    const maxTimeout = setTimeout(() => {
      setIsInitializing(false);
    }, 2000);
    return () => clearTimeout(maxTimeout);
  }, []);

  // Set proStatsContainerMounted when the ref is available
  useEffect(() => {
    if (proStatsContainerRef.current && !proStatsContainerMounted) {
      setProStatsContainerMounted(true);
    }
  });

  // Track form card height to sync chart height on desktop
  useEffect(() => {
    if (!formCardRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setFormCardHeight(entry.contentRect.height);
      }
    });

    resizeObserver.observe(formCardRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  // Chart and form state
  const [sellTokenAddress, setSellTokenAddress] = useState<string | undefined>();
  const [buyTokenAddresses, setBuyTokenAddresses] = useState<(string | undefined)[]>([]);
  const [limitOrderPrice, setLimitOrderPrice] = useState<number | undefined>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('limitOrderPrice');
      if (saved) {
        const parsed = parseFloat(saved);
        return parsed > 0 ? parsed : undefined;
      }
    }
    return undefined;
  });
  const [currentMarketPrice, setCurrentMarketPrice] = useState<number | undefined>();
  const [isDragging, setIsDragging] = useState(false);
  const [invertPriceDisplay, setInvertPriceDisplay] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('limitOrderInvertPrice');
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
  const [individualLimitPrices, setIndividualLimitPrices] = useState<(number | undefined)[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('limitOrderIndividualPrices');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {
          return [];
        }
      }
    }
    return [];
  });
  const [displayedTokenIndex, setDisplayedTokenIndex] = useState(0);
  const [showUsdPrices, setShowUsdPrices] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('limitOrderShowUsdPrices');
      return saved === 'true';
    }
    return false;
  });

  // USD prices from form - passed to chart for consistent percentage calculations
  const [formSellTokenUsdPrice, setFormSellTokenUsdPrice] = useState<number | undefined>();
  const [formBuyTokenUsdPrices, setFormBuyTokenUsdPrices] = useState<Record<string, number> | undefined>();

  // Handle prices from form - memoized to prevent infinite loops
  const handlePricesChange = useCallback((sellTokenUsdPrice: number, buyTokenUsdPrices: Record<string, number>) => {
    setFormSellTokenUsdPrice(sellTokenUsdPrice);
    setFormBuyTokenUsdPrices(buyTokenUsdPrices);
  }, []);

  // Persist showUsdPrices to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('limitOrderShowUsdPrices', showUsdPrices.toString());
    }
  }, [showUsdPrices]);

  const [pageVisible, setPageVisible] = useState(false);

  useEffect(() => {
    if (!isInitializing && !isConnecting) {
      requestAnimationFrame(() => setPageVisible(true));
    }
  }, [isInitializing, isConnecting]);

  return (
    <>
      <DisclaimerDialog open={showDisclaimer} onAccept={() => setShowDisclaimer(false)} />
      <LogoPreloader />
      <main className="flex min-h-screen flex-col items-center relative">
        {/* Animated background effect */}
        <div className="fixed inset-0 z-0">
          <PixelBlastBackground />
        </div>

        {/* Main Content */}
        <div
          style={{ opacity: pageVisible ? 1 : 0, transition: 'opacity 0.6s ease-out' }}
          className="w-full px-2 md:px-8 mt-2 mb-0 relative z-10"
        >
          <div className="max-w-[1200px] mx-auto">
            {/* Loading State */}
            {(isInitializing || isConnecting) && (
              <div className="flex flex-col items-center justify-center py-20">
                <PixelSpinner size={48} className="mb-4" />
              </div>
            )}

            {/* Not Connected State */}
            {!isInitializing && !isConnecting && !isConnected && (
              <div className="flex flex-col items-center justify-center py-20 px-4">
                <h1 className="text-2xl md:text-4xl font-bold text-white mb-4 text-center">
                  Connect Your Wallet
                </h1>
                <p className="text-gray-400 text-center max-w-md mb-8">
                  Connect your wallet to view and manage your limit orders.
                </p>
                <ConnectButton />
              </div>
            )}

            {/* Connected State - Trading UI */}
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
                  <div className="w-full mt-2 pb-8">
                    {/* Mobile layout: uses flex with order */}
                    <div className="flex flex-col gap-4 lg:hidden">
                      {/* Chart - order 1 on mobile */}
                      <div className="order-1 w-full h-[350px]">
                        <LimitOrderChart
                          sellTokenAddress={sellTokenAddress}
                          buyTokenAddresses={buyTokenAddresses}
                          limitOrderPrice={limitOrderPrice}
                          invertPriceDisplay={invertPriceDisplay}
                          pricesBound={pricesBound}
                          individualLimitPrices={individualLimitPrices}
                          displayedTokenIndex={displayedTokenIndex}
                          externalSellTokenUsdPrice={formSellTokenUsdPrice}
                          externalBuyTokenUsdPrices={formBuyTokenUsdPrices}
                          onLimitPriceChange={(newPrice) => {
                            setLimitOrderPrice(newPrice);
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
                          onDisplayedTokenIndexChange={(index) => {
                            setDisplayedTokenIndex(index);
                          }}
                          showUsdPrices={showUsdPrices}
                          onShowUsdPricesChange={setShowUsdPrices}
                        />
                      </div>

                      {/* Order Form - order 2 on mobile (after chart) */}
                      <div className="order-2 w-full">
                        <LimitOrderForm
                          externalLimitPrice={limitOrderPrice}
                          externalMarketPrice={currentMarketPrice}
                          externalIndividualLimitPrices={individualLimitPrices}
                          isDragging={isDragging}
                          displayedTokenIndex={displayedTokenIndex}
                          showUsdPrices={showUsdPrices}
                          onTokenChange={(sell, buyTokens) => {
                            setSellTokenAddress(sell);
                            setBuyTokenAddresses(buyTokens);
                          }}
                          onLimitPriceChange={(price) => {
                            setLimitOrderPrice(price);
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
                          onDisplayedTokenIndexChange={(index) => {
                            setDisplayedTokenIndex(index);
                          }}
                          onPricesChange={handlePricesChange}
                          onCreateOrderClick={(sellToken, buyTokens, sellAmount, buyAmounts, expirationDays) => {
                          }}
                          onOrderCreated={() => {
                            if (openPositionsTableRef.current?.refreshAndNavigateToMyActiveOrders) {
                              openPositionsTableRef.current.refreshAndNavigateToMyActiveOrders();
                            }
                          }}
                        />
                      </div>

                      {/* Orders Table - order 3 on mobile */}
                      <div className="order-3 w-full">
                        <OpenPositionsTable ref={openPositionsTableRef} showViewAllLink compactMode />
                      </div>

                    </div>

                    {/* Desktop layout: uses grid with columns */}
                    <div className="hidden lg:grid lg:grid-cols-5 gap-4 lg:items-start">
                      {/* Left Column - Chart, Table, Pro Stats */}
                      <div className="lg:col-span-3 flex flex-col gap-4">
                        {/* Chart - height synced with form card on desktop */}
                        <div
                          className="lg:min-h-0"
                          style={{ height: formCardHeight ? `${formCardHeight}px` : '400px' }}
                        >
                          <LimitOrderChart
                            sellTokenAddress={sellTokenAddress}
                            buyTokenAddresses={buyTokenAddresses}
                            limitOrderPrice={limitOrderPrice}
                            invertPriceDisplay={invertPriceDisplay}
                            pricesBound={pricesBound}
                            individualLimitPrices={individualLimitPrices}
                            displayedTokenIndex={displayedTokenIndex}
                            externalSellTokenUsdPrice={formSellTokenUsdPrice}
                            externalBuyTokenUsdPrices={formBuyTokenUsdPrices}
                            onLimitPriceChange={(newPrice) => {
                              setLimitOrderPrice(newPrice);
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
                            onDisplayedTokenIndexChange={(index) => {
                              setDisplayedTokenIndex(index);
                            }}
                            showUsdPrices={showUsdPrices}
                            onShowUsdPricesChange={setShowUsdPrices}
                          />
                        </div>

                        {/* Orders Table */}
                        <OpenPositionsTable ref={openPositionsTableRef} showViewAllLink compactMode />

                        {/* Pro Stats container - directly after order history */}
                        <div ref={proStatsContainerRef} className="w-full" />
                      </div>

                      {/* Right Column - Order Form, sticky on desktop */}
                      <div ref={formCardRef} className="lg:col-span-2 lg:sticky lg:top-4 lg:self-start">
                        <LimitOrderForm
                          externalLimitPrice={limitOrderPrice}
                          externalMarketPrice={currentMarketPrice}
                          externalIndividualLimitPrices={individualLimitPrices}
                          isDragging={isDragging}
                          displayedTokenIndex={displayedTokenIndex}
                          showUsdPrices={showUsdPrices}
                          onTokenChange={(sell, buyTokens) => {
                            setSellTokenAddress(sell);
                            setBuyTokenAddresses(buyTokens);
                          }}
                          onLimitPriceChange={(price) => {
                            setLimitOrderPrice(price);
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
                          onDisplayedTokenIndexChange={(index) => {
                            setDisplayedTokenIndex(index);
                          }}
                          onPricesChange={handlePricesChange}
                          onCreateOrderClick={(sellToken, buyTokens, sellAmount, buyAmounts, expirationDays) => {
                          }}
                          onOrderCreated={() => {
                            if (openPositionsTableRef.current?.refreshAndNavigateToMyActiveOrders) {
                              openPositionsTableRef.current.refreshAndNavigateToMyActiveOrders();
                            }
                          }}
                          proStatsContainerRef={proStatsContainerRef}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
