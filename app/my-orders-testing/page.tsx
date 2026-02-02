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
import { CompleteOrderDetails } from '@/hooks/contracts/useOpenPositions';
import { parseEther } from 'viem';

// Generate mock orders with various states for testing UI
const generateMockOrders = (userAddress: string): CompleteOrderDetails[] => {
  const now = BigInt(Math.floor(Date.now() / 1000));
  const oneDay = BigInt(86400);
  const oneWeek = oneDay * 7n;
  const oneMonth = oneDay * 30n;

  // Token indices from whitelist (these are the indices in the contract's token whitelist)
  // 0 = PLS (native), 1 = HEX, 2 = PLSX, etc. - you can verify in constants/crypto.ts
  const TOKEN_INDICES = {
    PLS: 0n,   // 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE
    HEX: 1n,   // 0x2b591e99afE9f32eAA6214f7B7629768c40Eeb39
    PLSX: 2n,  // 0x95B303987A60C71504D99Aa1b13B4DA07b0790ab
    INC: 3n,   // 0x2fa878Ab3F87CC1C9737Fc071108F904c0B0C95d
    MAXI: 4n,  // pMAXI
    DECI: 5n,  // pDECI
  };

  return [
    // Order 1: Active order with 50% filled, 30% claimable (hasn't claimed yet)
    {
      userDetails: {
        orderIndex: 0n,
        orderOwner: userAddress as `0x${string}`,
      },
      orderDetailsWithID: {
        orderID: 1001n,
        remainingSellAmount: parseEther('500'), // 50% remaining (started with 1000)
        redeemedSellAmount: 0n, // Hasn't claimed anything yet - 50% claimable!
        lastUpdateTime: Number(now - oneDay),
        status: 0, // Active
        creationProtocolFee: parseEther('0.01'),
        orderDetails: {
          sellToken: '0x2b591e99afE9f32eAA6214f7B7629768c40Eeb39' as `0x${string}`, // HEX
          sellAmount: parseEther('1000'),
          buyTokensIndex: [TOKEN_INDICES.PLS],
          buyAmounts: [parseEther('500')], // Asking for 500 PLS
          expirationTime: now + oneMonth,
          allOrNothing: false,
        },
      },
    },

    // Order 2: Active order with 75% filled, partial claim (25% already claimed, 50% claimable)
    {
      userDetails: {
        orderIndex: 1n,
        orderOwner: userAddress as `0x${string}`,
      },
      orderDetailsWithID: {
        orderID: 1002n,
        remainingSellAmount: parseEther('2500'), // 25% remaining (started with 10000)
        redeemedSellAmount: parseEther('2500'), // Already claimed 25%
        lastUpdateTime: Number(now - oneDay * 3n),
        status: 0, // Active
        creationProtocolFee: parseEther('0.05'),
        orderDetails: {
          sellToken: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE' as `0x${string}`, // PLS
          sellAmount: parseEther('10000'),
          buyTokensIndex: [TOKEN_INDICES.HEX, TOKEN_INDICES.PLSX],
          buyAmounts: [parseEther('5000'), parseEther('3000')],
          expirationTime: now + oneWeek,
          allOrNothing: false,
        },
      },
    },

    // Order 3: Active order, 10% filled, nothing claimed yet
    {
      userDetails: {
        orderIndex: 2n,
        orderOwner: userAddress as `0x${string}`,
      },
      orderDetailsWithID: {
        orderID: 1003n,
        remainingSellAmount: parseEther('900'), // 90% remaining
        redeemedSellAmount: 0n, // 10% claimable
        lastUpdateTime: Number(now - oneDay * 2n),
        status: 0, // Active
        creationProtocolFee: parseEther('0.02'),
        orderDetails: {
          sellToken: '0x2b591e99afE9f32eAA6214f7B7629768c40Eeb39' as `0x${string}`, // HEX
          sellAmount: parseEther('1000'),
          buyTokensIndex: [TOKEN_INDICES.MAXI],
          buyAmounts: [parseEther('50000')],
          expirationTime: now + oneMonth * 2n,
          allOrNothing: false,
        },
      },
    },

    // Order 4: Active order, 100% unfilled (no claimable)
    {
      userDetails: {
        orderIndex: 3n,
        orderOwner: userAddress as `0x${string}`,
      },
      orderDetailsWithID: {
        orderID: 1004n,
        remainingSellAmount: parseEther('5000'), // 100% remaining
        redeemedSellAmount: 0n, // Nothing to claim
        lastUpdateTime: Number(now - oneDay),
        status: 0, // Active
        creationProtocolFee: parseEther('0.03'),
        orderDetails: {
          sellToken: '0x95B303987A60C71504D99Aa1b13B4DA07b0790ab' as `0x${string}`, // PLSX
          sellAmount: parseEther('5000'),
          buyTokensIndex: [TOKEN_INDICES.HEX],
          buyAmounts: [parseEther('2500')],
          expirationTime: now + oneWeek * 2n,
          allOrNothing: false,
        },
      },
    },

    // Order 5: Fully filled, all claimed (completed)
    {
      userDetails: {
        orderIndex: 4n,
        orderOwner: userAddress as `0x${string}`,
      },
      orderDetailsWithID: {
        orderID: 1005n,
        remainingSellAmount: 0n, // Fully filled
        redeemedSellAmount: parseEther('2000'), // All claimed
        lastUpdateTime: Number(now - oneWeek),
        status: 2, // Completed
        creationProtocolFee: parseEther('0.01'),
        orderDetails: {
          sellToken: '0x2b591e99afE9f32eAA6214f7B7629768c40Eeb39' as `0x${string}`, // HEX
          sellAmount: parseEther('2000'),
          buyTokensIndex: [TOKEN_INDICES.PLS],
          buyAmounts: [parseEther('1000')],
          expirationTime: now - oneDay, // Already expired
          allOrNothing: false,
        },
      },
    },

    // Order 6: Cancelled order with partial fill (has claimable from before cancel)
    {
      userDetails: {
        orderIndex: 5n,
        orderOwner: userAddress as `0x${string}`,
      },
      orderDetailsWithID: {
        orderID: 1006n,
        remainingSellAmount: parseEther('600'), // 40% remaining when cancelled
        redeemedSellAmount: parseEther('200'), // Only claimed 20%, so 40% claimable
        lastUpdateTime: Number(now - oneDay * 5n),
        status: 1, // Cancelled
        creationProtocolFee: parseEther('0.02'),
        orderDetails: {
          sellToken: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE' as `0x${string}`, // PLS
          sellAmount: parseEther('1000'),
          buyTokensIndex: [TOKEN_INDICES.HEX],
          buyAmounts: [parseEther('500')],
          expirationTime: now + oneWeek, // Still not expired
          allOrNothing: false,
        },
      },
    },

    // Order 7: AON (All or Nothing) order - fully unfilled
    {
      userDetails: {
        orderIndex: 6n,
        orderOwner: userAddress as `0x${string}`,
      },
      orderDetailsWithID: {
        orderID: 1007n,
        remainingSellAmount: parseEther('10000'),
        redeemedSellAmount: 0n,
        lastUpdateTime: Number(now - oneDay * 2n),
        status: 0, // Active
        creationProtocolFee: parseEther('0.05'),
        orderDetails: {
          sellToken: '0x2b591e99afE9f32eAA6214f7B7629768c40Eeb39' as `0x${string}`, // HEX
          sellAmount: parseEther('10000'),
          buyTokensIndex: [TOKEN_INDICES.PLSX, TOKEN_INDICES.INC],
          buyAmounts: [parseEther('5000'), parseEther('100')],
          expirationTime: now + oneMonth,
          allOrNothing: true, // AON!
        },
      },
    },

    // Order 8: Expired order with unclaimed proceeds
    {
      userDetails: {
        orderIndex: 7n,
        orderOwner: userAddress as `0x${string}`,
      },
      orderDetailsWithID: {
        orderID: 1008n,
        remainingSellAmount: parseEther('300'), // 70% filled
        redeemedSellAmount: 0n, // Nothing claimed - 70% claimable!
        lastUpdateTime: Number(now - oneWeek * 2n),
        status: 0, // Still technically active but expired
        creationProtocolFee: parseEther('0.01'),
        orderDetails: {
          sellToken: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE' as `0x${string}`, // PLS
          sellAmount: parseEther('1000'),
          buyTokensIndex: [TOKEN_INDICES.HEX],
          buyAmounts: [parseEther('500')],
          expirationTime: now - oneDay * 3n, // Expired 3 days ago
          allOrNothing: false,
        },
      },
    },
  ];
};

export default function MyOrdersTestingPage() {
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const { address, isConnected, isConnecting } = useAccount();
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

  // Generate mock orders with current user's address
  const mockOrders = address ? generateMockOrders(address) : [];

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
            {/* Testing Header */}
            <div className="mb-4 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
              <h1 className="text-xl font-bold text-yellow-400 mb-2">UI Testing: Mock Orders</h1>
              <p className="text-white/60 text-sm mb-2">
                This page displays mock orders to test the UI. Orders include various states:
              </p>
              <ul className="text-white/50 text-xs space-y-1 ml-4 list-disc">
                <li><span className="text-green-400">Order 1001:</span> 50% filled, 50% claimable (never claimed)</li>
                <li><span className="text-green-400">Order 1002:</span> 75% filled, 25% claimed, 50% claimable</li>
                <li><span className="text-green-400">Order 1003:</span> 10% filled, 10% claimable</li>
                <li><span className="text-white/60">Order 1004:</span> 0% filled, nothing claimable</li>
                <li><span className="text-blue-400">Order 1005:</span> Completed, all claimed</li>
                <li><span className="text-red-400">Order 1006:</span> Cancelled with 40% claimable</li>
                <li><span className="text-purple-400">Order 1007:</span> AON order, unfilled</li>
                <li><span className="text-orange-400">Order 1008:</span> Expired with 70% claimable</li>
              </ul>
            </div>

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
                  Connect your wallet to view mock orders with claimable amounts.
                </p>
                <ConnectButton />
              </div>
            )}

            {/* Connected State - Orders Table with Mock Data */}
            {!isInitializing && !isConnecting && isConnected && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4 }}
              >
                <OpenPositionsTable mockOrders={mockOrders} />
              </motion.div>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
