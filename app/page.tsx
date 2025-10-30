'use client';

import { useState, useRef, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { OpenPositionsTable } from '@/components/OpenPositionsTable';
import { CreatePositionModal } from '@/components/CreatePositionModal';
import { WhitelistDebugger } from '@/components/WhitelistDebugger';
import { DisclaimerDialog } from '@/components/DisclaimerDialog';
import { LogoPreloader } from '@/components/LogoPreloader';
import { LimitOrderChart } from '@/components/LimitOrderChart';
import { LimitOrderForm } from '@/components/LimitOrderForm';
import useToast from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';
import { Loader2 } from 'lucide-react';

export default function Home() {
  const [showCreateModal, setShowCreateModal] = useState(false);
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
  const [buyTokenAddress, setBuyTokenAddress] = useState<string | undefined>();
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
      <div className="w-full px-2 md:px-8 mt-24 mb-0 bg-black">
        <div className="max-w-[1200px] mx-auto text-center">
          {/* Loading State */}
          {(isInitializing || isConnecting) && (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="h-12 w-12 animate-spin text-[#00D9FF] mb-4" />
            </div>
          )}
          
          {/* Not Connected State */}
          {!isInitializing && !isConnecting && !isConnected && (
            <>
              <h2 className="text-3xl md:text-5xl md:leading-[90px] font-bold text-white mb-0">
                The best place to trade on PulseChain
              </h2>
              <p className="text-md md:text-xl text-gray-400 max-w-2xl mx-auto mb-6 mt-4 md:mt-0 flex items-center justify-center">
                Low fees. Fast execution. On your own terms.
              </p>
            </>
          )}
          
          {/* Connected State */}
          {!isInitializing && !isConnecting && isConnected && (
            <>
              <div className="flex flex-col items-center gap-4">
              {/* Main Create Deal Button with Loading State */}
              {isTransactionLoading && (
                <div className="flex justify-center">
                  <div className="px-8 py-3 border border-white text-white rounded-full font-semibold flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Processing Transaction...
                  </div>
                </div>
              )}
              
              {/* Chart and Form Section */}
              <div className="w-full max-w-[1200px] mx-auto mt-8">
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                  {/* Chart - Takes up 3 columns */}
                  <div className="lg:col-span-3">
                    <LimitOrderChart 
                      sellTokenAddress={sellTokenAddress}
                      buyTokenAddress={buyTokenAddress}
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
                  
                  {/* Order Form - Takes up 2 columns */}
                  <div className="lg:col-span-2">
                    <LimitOrderForm
                      externalLimitPrice={limitOrderPrice}
                      externalMarketPrice={currentMarketPrice}
                      isDragging={isDragging}
                      onTokenChange={(sell, buy) => {
                        setSellTokenAddress(sell);
                        setBuyTokenAddress(buy);
                      }}
                      onLimitPriceChange={(price) => {
                        setLimitOrderPrice(price);
                      }}
                      onInvertPriceDisplayChange={(inverted) => {
                        setInvertPriceDisplay(inverted);
                      }}
                      onCreateOrderClick={(sellToken, buyTokens, sellAmount, buyAmounts, expirationDays) => {
                        // Open the CreatePositionModal with prefilled values
                        setShowCreateModal(true);
                        // TODO: Prefill the modal with these values
                        // sellToken, buyTokens (array), sellAmount, buyAmounts (array), expirationDays
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

      {/* Create Position Modal */}
      <CreatePositionModal 
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onTransactionStart={() => setIsTransactionLoading(true)}
        onTransactionEnd={() => setIsTransactionLoading(false)}
        onTransactionSuccess={(message, txHash) => {
          toast({
            title: "Transaction Successful!",
            description: message || "Your order has been created successfully.",
            variant: "success",
            action: txHash ? (
              <ToastAction
                altText="View transaction"
                onClick={() => window.open(`https://otter.pulsechain.com/tx/${txHash}`, '_blank')}
              >
                View TX
              </ToastAction>
            ) : undefined,
          });
        }}
        onTransactionError={(error) => {
          toast({
            title: "Transaction Failed",
            description: error || "An error occurred while creating your order.",
            variant: "destructive",
          });
        }}
        onOrderCreated={(sellToken, buyToken) => {
          // Refresh the orders table and navigate to "My Deals" > "Active"
          if (openPositionsTableRef.current) {
            openPositionsTableRef.current.refreshAndNavigateToMyActiveOrders(sellToken, buyToken);
          }
        }}
      />
      </main>
    </>
  );
} 