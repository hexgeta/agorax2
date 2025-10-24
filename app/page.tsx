'use client';

import { useState, useRef } from 'react';
import { useAccount } from 'wagmi';
import { OpenPositionsTable } from '@/components/OpenPositionsTable';
import { CreatePositionModal } from '@/components/CreatePositionModal';
import { WhitelistDebugger } from '@/components/WhitelistDebugger';
import { DisclaimerDialog } from '@/components/DisclaimerDialog';
import useToast from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';
import { Loader2 } from 'lucide-react';

export default function Home() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isTransactionLoading, setIsTransactionLoading] = useState(false);
  const { isConnected } = useAccount();
  const { toast } = useToast();
  const openPositionsTableRef = useRef<any>(null);
  
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
      <DisclaimerDialog />
      <main className="flex min-h-screen flex-col items-center">
        {/* Hero Section */}
      <div className="w-full px-2 md:px-8 mt-24 mb-0 bg-black">
        <div className="max-w-6xl mx-auto text-center">
          <h2 className="text-3xl md:text-5xl md:leading-[90px] font-bold text-white mb-0">
            Trade Pooled HEX Stake Tokens OTC
          </h2>
          <p className="text-md md:text-xl text-gray-400 max-w-2xl mx-auto mb-6 mt-4 md:mt-0 flex items-center justify-center">
            Peer-to-peer. At scale. On your own terms.
          </p>
          {isConnected && (
            <div className="flex flex-col items-center gap-4">
              {/* Main Create Deal Button with Loading State */}
              <div className="flex justify-center">
                {isTransactionLoading ? (
                  <div className="px-8 py-3 border border-white text-white rounded-full font-semibold flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Processing Transaction...
                  </div>
                ) : (
                  <button 
                    onClick={() => setShowCreateModal(true)}
                    className="px-6 md:px-8 py-3 mb-4 border border-white text-white rounded-full font-semibold transition-colors duration-0 create-deal-button text-sm md:text-base"
                  >
                    + Create New OTC Dea
                  </button>
                )}
              </div>
              
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="w-full px-2 md:px-8 mt-2">
                <div className="max-w-6xl mx-auto">
                  {SHOW_WHITELIST_DEBUGGER && <WhitelistDebugger />}
                  <OpenPositionsTable ref={openPositionsTableRef} />
                </div>
      </div>

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