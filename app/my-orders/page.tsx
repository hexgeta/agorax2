'use client';

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { DisclaimerDialog } from '@/components/DisclaimerDialog';
import { LogoPreloader } from '@/components/LogoPreloader';
import { PixelSpinner } from '@/components/ui/PixelSpinner';
import PixelBlastBackground from '@/components/ui/PixelBlastBackground';
import { motion } from 'framer-motion';
import { ConnectButton } from '@/components/ConnectButton';
import { OpenPositionsTable } from '@/components/OpenPositionsTable';
import Link from 'next/link';

export default function MyOrdersPage() {
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const { isConnected, isConnecting } = useAccount();
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
      const timer = setTimeout(() => {
        setIsInitializing(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isConnecting]);

  // Fallback: Force initialization complete after max timeout
  useEffect(() => {
    const maxTimeout = setTimeout(() => {
      setIsInitializing(false);
    }, 2000);
    return () => clearTimeout(maxTimeout);
  }, []);

  return (
    <>
      <DisclaimerDialog open={showDisclaimer} onAccept={() => setShowDisclaimer(false)} />
      <LogoPreloader />
      <main className="flex min-h-screen flex-col items-center relative">
        {/* Animated background effect */}
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

        {/* Main Content */}
        <div className="w-full px-2 md:px-8 mt-2 mb-0 relative z-10">
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

            {/* Connected State - Orders Table */}
            {!isInitializing && !isConnecting && isConnected && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4 }}
              >
                <div className="flex flex-col gap-4">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-2">
                    <h1 className="text-2xl md:text-3xl font-bold text-white">My Orders</h1>
                    <Link
                      href="/swap"
                      className="px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg text-white font-medium transition-colors"
                    >
                      Create New Order
                    </Link>
                  </div>

                  {/* Orders Table */}
                  <OpenPositionsTable />
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
