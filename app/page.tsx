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
      <main className="flex min-h-screen flex-col items-center">
        {/* Hero Section */}
        <div className="w-full px-2 md:px-8 mt-2 mb-0 bg-black">
          <div className="max-w-[1200px] mx-auto">
            {/* Loading State */}
            {(isInitializing || isConnecting) && (
              <div className="flex flex-col items-center justify-center py-20">
                <PixelSpinner size={48} className="mb-4" />
              </div>
            )}

            {/* Not Connected State */}
            {!isInitializing && !isConnecting && !isConnected && (
              <div className="text-center">
                <h2 className="text-3xl md:text-5xl md:leading-[90px] font-bold text-white mb-0">
                  The best place to trade on PulseChain
                </h2>
                <p className="text-md md:text-xl text-gray-400 max-w-2xl mx-auto mb-6 mt-4 md:mt-0 flex items-center justify-center">
                  Low fees. Fast execution. On your own terms.
                </p>
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

        {/* Main Content */}
        {!isInitializing && !isConnecting && (
          <div className="w-full px-2 md:px-8 mt-2">
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