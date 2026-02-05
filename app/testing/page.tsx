'use client';

import { useState } from 'react';
import { LogoPreloader } from '@/components/LogoPreloader';
import PixelBlastBackground from '@/components/ui/PixelBlastBackground';
import { motion } from 'framer-motion';
import { OpenPositionsTable } from '@/components/OpenPositionsTable';
import { CompleteOrderDetails } from '@/hooks/contracts/useOpenPositions';
import { parseEther, parseUnits } from 'viem';
import Link from 'next/link';

// Mock user address for testing
const MOCK_USER_ADDRESS = '0x1234567890123456789012345678901234567890' as `0x${string}`;

// Token addresses from the whitelist (mainnet)
const TOKENS = {
  PLS: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE' as `0x${string}`,
  HEX: '0x2b591e99afE9f32eAA6214f7B7629768c40Eeb39' as `0x${string}`,
  PLSX: '0x95B303987A60C71504D99Aa1b13B4DA07b0790ab' as `0x${string}`,
  INC: '0x2fa878Ab3F87CC1C9737Fc071108F904c0B0C95d' as `0x${string}`,
  WPLS: '0xA1077a294dDE1B09bB078844df40758a5D0f9a27' as `0x${string}`,
  DAI: '0xefD766cCb38EaF1dfd701853BFCe31359239F305' as `0x${string}`,
  USDC: '0x15D38573d2feeb82e7ad5187aB8c1D52810B1f07' as `0x${string}`,
  USDT: '0x0Cb6F5a34ad42ec934882A05265A7d5F59b51A2f' as `0x${string}`,
  WETH: '0x02DcdD04e3F455D838cd1249292C58f3B79e3C3C' as `0x${string}`,
  WBTC: '0xb17D901469B9208B17d916112988A3FeD19b5cA1' as `0x${string}`,
};

// Token index mapping (must match contract whitelist order)
const TOKEN_INDEX: Record<string, bigint> = {
  PLS: 0n,
  HEX: 1n,
  PLSX: 2n,
  INC: 3n,
  WPLS: 4n,
  DAI: 5n,
  USDC: 6n,
  USDT: 7n,
  WETH: 8n,
  WBTC: 9n,
};

// Helper to generate mock orders
const generateMockOrders = (): CompleteOrderDetails[] => {
  const now = BigInt(Math.floor(Date.now() / 1000));
  const oneDay = BigInt(86400);
  const oneWeek = oneDay * 7n;
  const oneMonth = oneDay * 30n;

  return [
    // Order 1: EXTREME - Large HEX amount (1 billion), 50% filled, 25% claimable
    {
      userDetails: {
        orderIndex: 0n,
        orderOwner: MOCK_USER_ADDRESS,
      },
      orderDetailsWithID: {
        orderID: 1001n,
        remainingSellAmount: parseUnits('500000000', 8), // 500M HEX remaining (8 decimals)
        redeemedSellAmount: parseUnits('250000000', 8), // 250M claimed
        lastUpdateTime: Number(now - oneDay),
        status: 0, // Active
        creationProtocolFee: parseEther('0.01'),
        orderDetails: {
          sellToken: TOKENS.HEX,
          sellAmount: parseUnits('1000000000', 8), // 1 BILLION HEX
          buyTokensIndex: [TOKEN_INDEX.PLS],
          buyAmounts: [parseEther('50000000000')], // 50B PLS
          expirationTime: now + oneMonth,
          allOrNothing: false,
        },
      },
    },

    // Order 2: EXTREME - 20 buy tokens (maximum complexity)
    {
      userDetails: {
        orderIndex: 1n,
        orderOwner: MOCK_USER_ADDRESS,
      },
      orderDetailsWithID: {
        orderID: 1002n,
        remainingSellAmount: parseEther('1000000'), // 1M PLS remaining
        redeemedSellAmount: 0n,
        lastUpdateTime: Number(now - BigInt(3600)), // 1 hour ago
        status: 0, // Active
        creationProtocolFee: parseEther('0.01'),
        orderDetails: {
          sellToken: TOKENS.PLS,
          sellAmount: parseEther('1000000'), // 1M PLS
          // All available tokens as buy options
          buyTokensIndex: [
            TOKEN_INDEX.HEX, TOKEN_INDEX.PLSX, TOKEN_INDEX.INC, TOKEN_INDEX.WPLS,
            TOKEN_INDEX.DAI, TOKEN_INDEX.USDC, TOKEN_INDEX.USDT, TOKEN_INDEX.WETH,
            TOKEN_INDEX.WBTC, TOKEN_INDEX.HEX, TOKEN_INDEX.PLSX, TOKEN_INDEX.INC,
            TOKEN_INDEX.WPLS, TOKEN_INDEX.DAI, TOKEN_INDEX.USDC, TOKEN_INDEX.USDT,
            TOKEN_INDEX.WETH, TOKEN_INDEX.WBTC, TOKEN_INDEX.HEX, TOKEN_INDEX.PLSX,
          ],
          buyAmounts: [
            parseUnits('100000', 8), parseEther('50000'), parseEther('25000'), parseEther('500000'),
            parseEther('500'), parseUnits('500', 6), parseUnits('500', 6), parseEther('0.2'),
            parseUnits('0.01', 8), parseUnits('100000', 8), parseEther('50000'), parseEther('25000'),
            parseEther('500000'), parseEther('500'), parseUnits('500', 6), parseUnits('500', 6),
            parseEther('0.2'), parseUnits('0.01', 8), parseUnits('100000', 8), parseEther('50000'),
          ],
          expirationTime: now + oneWeek,
          allOrNothing: false,
        },
      },
    },

    // Order 3: Tiny dust amounts - very small numbers
    {
      userDetails: {
        orderIndex: 2n,
        orderOwner: MOCK_USER_ADDRESS,
      },
      orderDetailsWithID: {
        orderID: 1003n,
        remainingSellAmount: parseUnits('0.00001', 8), // 0.00001 HEX
        redeemedSellAmount: 0n,
        lastUpdateTime: Number(now - oneDay * 2n),
        status: 0, // Active
        creationProtocolFee: parseEther('0.001'),
        orderDetails: {
          sellToken: TOKENS.HEX,
          sellAmount: parseUnits('0.00001', 8),
          buyTokensIndex: [TOKEN_INDEX.PLS],
          buyAmounts: [parseEther('0.0000001')],
          expirationTime: now + oneMonth,
          allOrNothing: false,
        },
      },
    },

    // Order 4: 99.99% filled - almost complete
    {
      userDetails: {
        orderIndex: 3n,
        orderOwner: MOCK_USER_ADDRESS,
      },
      orderDetailsWithID: {
        orderID: 1004n,
        remainingSellAmount: parseEther('1'), // Only 1 PLS remaining
        redeemedSellAmount: parseEther('9998'), // 9998 claimed
        lastUpdateTime: Number(now - BigInt(7200)),
        status: 0, // Active
        creationProtocolFee: parseEther('0.01'),
        orderDetails: {
          sellToken: TOKENS.PLS,
          sellAmount: parseEther('10000'), // 10K PLS original
          buyTokensIndex: [TOKEN_INDEX.HEX],
          buyAmounts: [parseUnits('1000', 8)],
          expirationTime: now + oneDay,
          allOrNothing: false,
        },
      },
    },

    // Order 5: Expired order
    {
      userDetails: {
        orderIndex: 4n,
        orderOwner: MOCK_USER_ADDRESS,
      },
      orderDetailsWithID: {
        orderID: 1005n,
        remainingSellAmount: parseEther('5000'),
        redeemedSellAmount: parseEther('2500'),
        lastUpdateTime: Number(now - oneWeek),
        status: 0, // Active but expired
        creationProtocolFee: parseEther('0.01'),
        orderDetails: {
          sellToken: TOKENS.PLSX,
          sellAmount: parseEther('10000'),
          buyTokensIndex: [TOKEN_INDEX.PLS, TOKEN_INDEX.HEX],
          buyAmounts: [parseEther('100000'), parseUnits('5000', 8)],
          expirationTime: now - oneDay, // Expired yesterday
          allOrNothing: false,
        },
      },
    },

    // Order 6: Cancelled order with partial fill
    {
      userDetails: {
        orderIndex: 5n,
        orderOwner: MOCK_USER_ADDRESS,
      },
      orderDetailsWithID: {
        orderID: 1006n,
        remainingSellAmount: parseEther('3000'),
        redeemedSellAmount: parseEther('1500'),
        lastUpdateTime: Number(now - oneDay * 3n),
        status: 1, // Cancelled
        creationProtocolFee: parseEther('0.01'),
        orderDetails: {
          sellToken: TOKENS.INC,
          sellAmount: parseEther('5000'),
          buyTokensIndex: [TOKEN_INDEX.PLSX],
          buyAmounts: [parseEther('25000')],
          expirationTime: now + oneMonth,
          allOrNothing: false,
        },
      },
    },

    // Order 7: Completed order (100% filled)
    {
      userDetails: {
        orderIndex: 6n,
        orderOwner: MOCK_USER_ADDRESS,
      },
      orderDetailsWithID: {
        orderID: 1007n,
        remainingSellAmount: 0n,
        redeemedSellAmount: parseUnits('50000', 8),
        lastUpdateTime: Number(now - oneDay * 5n),
        status: 2, // Completed
        creationProtocolFee: parseEther('0.01'),
        orderDetails: {
          sellToken: TOKENS.HEX,
          sellAmount: parseUnits('50000', 8),
          buyTokensIndex: [TOKEN_INDEX.PLS],
          buyAmounts: [parseEther('1000000')],
          expirationTime: now + oneMonth,
          allOrNothing: false,
        },
      },
    },

    // Order 8: All-or-Nothing order
    {
      userDetails: {
        orderIndex: 7n,
        orderOwner: MOCK_USER_ADDRESS,
      },
      orderDetailsWithID: {
        orderID: 1008n,
        remainingSellAmount: parseEther('100000'),
        redeemedSellAmount: 0n,
        lastUpdateTime: Number(now - BigInt(1800)),
        status: 0, // Active
        creationProtocolFee: parseEther('0.01'),
        orderDetails: {
          sellToken: TOKENS.PLSX,
          sellAmount: parseEther('100000'),
          buyTokensIndex: [TOKEN_INDEX.HEX, TOKEN_INDEX.PLS],
          buyAmounts: [parseUnits('10000', 8), parseEther('500000')],
          expirationTime: now + oneWeek * 2n,
          allOrNothing: true, // AON!
        },
      },
    },

    // Order 9: EXTREME long decimal precision
    {
      userDetails: {
        orderIndex: 8n,
        orderOwner: MOCK_USER_ADDRESS,
      },
      orderDetailsWithID: {
        orderID: 1009n,
        remainingSellAmount: parseEther('123456789.123456789012345678'),
        redeemedSellAmount: parseEther('0.000000000000000001'),
        lastUpdateTime: Number(now - oneDay),
        status: 0, // Active
        creationProtocolFee: parseEther('0.01'),
        orderDetails: {
          sellToken: TOKENS.PLS,
          sellAmount: parseEther('123456789.123456789012345679'),
          buyTokensIndex: [TOKEN_INDEX.DAI],
          buyAmounts: [parseEther('4200.69')],
          expirationTime: now + oneMonth * 3n,
          allOrNothing: false,
        },
      },
    },

    // Order 10: Stablecoin swap with multiple stable options
    {
      userDetails: {
        orderIndex: 9n,
        orderOwner: MOCK_USER_ADDRESS,
      },
      orderDetailsWithID: {
        orderID: 1010n,
        remainingSellAmount: parseEther('10000'),
        redeemedSellAmount: parseEther('5000'),
        lastUpdateTime: Number(now - BigInt(43200)), // 12 hours ago
        status: 0, // Active
        creationProtocolFee: parseEther('0.01'),
        orderDetails: {
          sellToken: TOKENS.DAI,
          sellAmount: parseEther('15000'),
          buyTokensIndex: [TOKEN_INDEX.USDC, TOKEN_INDEX.USDT],
          buyAmounts: [parseUnits('15000', 6), parseUnits('15000', 6)],
          expirationTime: now + oneMonth,
          allOrNothing: false,
        },
      },
    },
  ];
};

export default function TestingPage() {
  const [mockOrders] = useState<CompleteOrderDetails[]>(generateMockOrders);

  return (
    <>
      <LogoPreloader />
      <main className="flex min-h-screen flex-col items-center relative">
        {/* Animated background effect */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.2, delay: 0.3, ease: [0.23, 1, 0.32, 1] }}
          className="fixed inset-0 z-0"
        >
          <PixelBlastBackground />
        </motion.div>

        {/* Main Content */}
        <div className="w-full px-2 md:px-8 mt-2 mb-0 relative z-10">
          <div className="max-w-[1200px] mx-auto">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4 }}
            >
              <div className="flex flex-col gap-2">
                {/* Header */}
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-white">UI Testing</h1>
                    <p className="text-gray-400 text-sm mt-1">
                      Mock orders with extreme edge cases for UI testing
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Link
                      href="/my-orders"
                      className="px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-full text-white font-medium transition-colors text-sm"
                    >
                      View Real Orders
                    </Link>
                    <Link
                      href="/swap"
                      className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-full text-white font-medium transition-colors text-sm"
                    >
                      <span className="text-lg">+</span>
                      Create Order
                    </Link>
                  </div>
                </div>

                {/* Test Cases Legend */}
                <div className="bg-black/40 border border-white/10 rounded-lg p-4 mb-2">
                  <h3 className="text-white font-semibold mb-2">Test Cases:</h3>
                  <ul className="text-gray-400 text-sm space-y-1 grid grid-cols-1 md:grid-cols-2 gap-x-4">
                    <li><span className="text-white">#1001</span> - 1B HEX, 50% filled, 25% claimable</li>
                    <li><span className="text-white">#1002</span> - 20 buy tokens (max complexity)</li>
                    <li><span className="text-white">#1003</span> - Tiny dust amounts</li>
                    <li><span className="text-white">#1004</span> - 99.99% filled (almost complete)</li>
                    <li><span className="text-white">#1005</span> - Expired order with partial fill</li>
                    <li><span className="text-white">#1006</span> - Cancelled with partial fill</li>
                    <li><span className="text-white">#1007</span> - 100% completed</li>
                    <li><span className="text-white">#1008</span> - All-or-Nothing order</li>
                    <li><span className="text-white">#1009</span> - Extreme decimal precision</li>
                    <li><span className="text-white">#1010</span> - Stablecoin with multiple options</li>
                  </ul>
                </div>

                {/* Orders Table with Mock Data */}
                <OpenPositionsTable
                  mockOrders={mockOrders}
                />
              </div>
            </motion.div>
          </div>
        </div>
      </main>
    </>
  );
}
