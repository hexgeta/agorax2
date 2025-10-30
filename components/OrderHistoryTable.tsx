'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { CircleDollarSign, Lock } from 'lucide-react';
import { getTokenInfo, getTokenInfoByIndex, formatTokenTicker, formatTokenAmount } from '@/utils/tokenUtils';
import { useTokenPrices } from '@/hooks/crypto/useTokenPrices';
import { useTokenStats } from '@/hooks/crypto/useTokenStats';
import { useAccount, usePublicClient } from 'wagmi';
import { useTokenAccess } from '@/context/TokenAccessContext';
import { PAYWALL_ENABLED, REQUIRED_PARTY_TOKENS, REQUIRED_TEAM_TOKENS, PAYWALL_TITLE, PAYWALL_DESCRIPTION } from '@/config/paywall';
import { getContractAddress } from '@/config/testing';
import PaywallModal from './PaywallModal';

// Helper function to get remaining percentage (works for both Bistro and AgoraX)
const getRemainingPercentage = (orderDetailsWithId: any): bigint => {
  return orderDetailsWithId.remainingFillPercentage || orderDetailsWithId.remainingExecutionPercentage || 0n;
};

// Helper function to find the highest version of a token in tokenStats
// e.g. if API has eBASE, eBASE2, eBASE3, it returns "eBASE3"
const getHighestTokenVersion = (tokenStats: Record<string, any>, prefix: string, baseTicker: string): string => {
  const pattern = new RegExp(`^${prefix}${baseTicker}(\\d*)$`);
  let highestVersion = 0;
  let highestKey = `${prefix}${baseTicker}`;
  
  Object.keys(tokenStats).forEach(key => {
    const match = key.match(pattern);
    if (match) {
      const version = match[1] ? parseInt(match[1], 10) : 0;
      if (version > highestVersion) {
        highestVersion = version;
        highestKey = key;
      } else if (version === 0 && highestVersion === 0) {
        // If no version found yet, use the base version (e.g., "eBASE")
        highestKey = key;
      }
    }
  });
  
  return highestKey;
};

// Simplified TokenLogo component that always shows fallback for missing logos
function TokenLogo({ src, alt, className }: { src: string; alt: string; className: string }) {
  const [hasError, setHasError] = useState(false);
  const [isClient, setIsClient] = useState(false);
  
  useEffect(() => {
    setIsClient(true);
  }, []);

  const handleError = useCallback(() => {
      setHasError(true);
  }, []);

  // If it's already the default.svg or has error, show Lucide icon fallback
  if (src.includes('default.svg') || hasError || !isClient) {
    return (
      <CircleDollarSign 
        className={`${className} text-[#00D9FF]`}
      />
    );
  }

  return (
    <img 
      src={src}
      alt={alt}
      className={className}
      loading="lazy"
      onError={handleError}
      draggable="false"
    />
  );
}

// Sorting types
type SortField = 'sellAmount' | 'askingFor' | 'progress' | 'date' | 'otcVsMarket';
type SortDirection = 'asc' | 'desc';

// Transaction interface
interface PurchaseTransaction {
  transactionHash: string;
  orderId: string;
  sellToken: string;
  sellAmount: number;
  buyTokens: Record<string, number>;
  blockNumber: bigint;
  timestamp?: number;
}

interface OrderHistoryTableProps {
  purchaseTransactions: PurchaseTransaction[];
  allOrders: any[];
  tokenFilter: 'all' | 'maxi' | 'non-maxi';
  searchTerm: string;
  maxiTokenAddresses: string[];
  onNavigateToMarketplace: (order: any) => void;
}

// Format USD amount without scientific notation
const formatUSD = (amount: number) => {
  if (amount === 0) return '$0';
  if (amount < 0.000001) return `$${amount.toFixed(8)}`;
  if (amount < 0.01) return `$${amount.toFixed(6)}`;
  if (amount < 1) return `$${amount.toFixed(4)}`;
  if (amount >= 1000) {
    return `$${amount.toLocaleString(undefined, { 
      minimumFractionDigits: 0, 
      maximumFractionDigits: 2 
    })}`;
  }
  const formatted = amount.toFixed(2);
  const withoutTrailingZeros = formatted.replace(/\.?0+$/, '');
  return `$${withoutTrailingZeros}`;
};

// Helper function to format token amounts without unnecessary decimals
const formatTokenAmountDisplay = (amount: number): string => {
  if (amount % 1 === 0) {
    return amount.toLocaleString();
  }
  return amount.toFixed(2);
};

// Helper function to get token price
const getTokenPrice = (tokenAddress: string, tokenPrices: any): number => {
  // Hardcode weDAI to $1.00
  if (tokenAddress.toLowerCase() === '0xefd766ccb38eaf1dfd701853bfce31359239f305') {
    return 1.0;
  }
  
  // Use WPLS price for PLS (native token addresses)
  const plsAddresses = [
    '0x0000000000000000000000000000000000000000',
    '0x000000000000000000000000000000000000dead',
  ];
  if (plsAddresses.some(addr => tokenAddress.toLowerCase() === addr.toLowerCase())) {
    const wplsPrice = tokenPrices['0xa1077a294dde1b09bb078844df40758a5d0f9a27']?.price;
    return wplsPrice || 0.000034;
  }
  
  return tokenPrices[tokenAddress]?.price || 0;
};

const formatPercentage = (percentage: number) => {
  if (isNaN(percentage)) return 'NaN';
  return `${Math.round(percentage)}%`;
};

const formatTimestamp = (timestamp: number) => {
  const date = new Date(timestamp * 1000);
  const day = date.getUTCDate();
  const month = date.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
  const year = date.getUTCFullYear().toString().slice(-2);
  const hours24 = date.getUTCHours();
  const hours12 = hours24 % 12 || 12; // Convert to 12-hour format, 0 becomes 12
  const ampm = hours24 >= 12 ? 'PM' : 'AM';
  const minutes = date.getUTCMinutes().toString().padStart(2, '0');
  return {
    date: `${day} ${month} ${year}`,
    time: `${hours12}:${minutes} ${ampm} UTC`
  };
};

const getStatusText = (order: any) => {
  const status = order.orderDetailsWithId.status;
  const expirationTime = Number(order.orderDetailsWithId.orderDetails.expirationTime);
  const currentTime = Math.floor(Date.now() / 1000);
  
  if (status === 0 && expirationTime < currentTime) {
    return 'Inactive';
  }
  
  switch (status) {
    case 0: return 'Active';
    case 1: return 'Cancelled';
    case 2: return 'Completed';
    default: return 'Unknown';
  }
};

const getStatusColor = (order: any) => {
  const status = order.orderDetailsWithId.status;
  const expirationTime = Number(order.orderDetailsWithId.orderDetails.expirationTime);
  const currentTime = Math.floor(Date.now() / 1000);
  
  if (status === 0 && expirationTime < currentTime) {
    return 'text-yellow-400';
  }
  
  switch (status) {
    case 0: return 'text-green-400';
    case 1: return 'text-red-400';
    case 2: return 'text-blue-400';
    default: return 'text-[#00D9FF]/60';
  }
};

export default function OrderHistoryTable({
  purchaseTransactions,
  allOrders,
  tokenFilter,
  searchTerm,
  maxiTokenAddresses,
  onNavigateToMarketplace
}: OrderHistoryTableProps) {
  const { address, chainId } = useAccount();
  const publicClient = usePublicClient();
  
  // Contract address for querying events - get based on current chain
  const OTC_CONTRACT_ADDRESS = getContractAddress(chainId);
  
  // Token-gating - use centralized validation
  const { hasTokenAccess, partyBalance, teamBalance, isChecking: checkingTokenBalance } = useTokenAccess();
  const [showPaywallModal, setShowPaywallModal] = useState(false);
  
  // Collect all unique token addresses from transactions
  const allTokenAddresses = useMemo(() => {
    const addresses = new Set<string>();
    purchaseTransactions.forEach(tx => {
      addresses.add(tx.sellToken);
      Object.keys(tx.buyTokens).forEach(addr => addresses.add(addr));
    });
    return Array.from(addresses);
  }, [purchaseTransactions]);

  const { prices: tokenPrices } = useTokenPrices(allTokenAddresses);
  const { tokenStats } = useTokenStats({ 
    enabled: PAYWALL_ENABLED ? hasTokenAccess : true 
  });
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Build display rows from transactions
  const displayRows = useMemo(() => {
    if (purchaseTransactions.length === 0) return [];

    const rows = purchaseTransactions
      .map(transaction => {
        // Find the base order to get order details
        const baseOrder = allOrders.find(order => 
          order.orderDetailsWithId.orderId.toString() === transaction.orderId
        );
        
        if (!baseOrder) {
          return null;
        }
        
        // Apply token filter
        if (tokenFilter === 'maxi') {
          const sellToken = baseOrder.orderDetailsWithId.orderDetails.sellToken.toLowerCase();
          const sellTokenInList = maxiTokenAddresses.some(addr => sellToken === addr.toLowerCase());
          const buyTokensInList = baseOrder.orderDetailsWithId.orderDetails.buyTokensIndex.some((buyTokenIndex: bigint) => {
            const buyTokenInfo = getTokenInfoByIndex(Number(buyTokenIndex));
            const buyTokenAddress = buyTokenInfo?.address?.toLowerCase() || '';
            return maxiTokenAddresses.some(addr => buyTokenAddress === addr.toLowerCase());
          });
          if (!(sellTokenInList || buyTokensInList)) return null;
        } else if (tokenFilter === 'non-maxi') {
          const sellToken = baseOrder.orderDetailsWithId.orderDetails.sellToken.toLowerCase();
          const sellTokenInList = maxiTokenAddresses.some(addr => sellToken === addr.toLowerCase());
          const buyTokensInList = baseOrder.orderDetailsWithId.orderDetails.buyTokensIndex.some((buyTokenIndex: bigint) => {
            const buyTokenInfo = getTokenInfoByIndex(Number(buyTokenIndex));
            const buyTokenAddress = buyTokenInfo?.address?.toLowerCase() || '';
            return maxiTokenAddresses.some(addr => buyTokenAddress === addr.toLowerCase());
          });
          if (sellTokenInList || buyTokensInList) return null;
        }
        
        // Apply search filter
        if (searchTerm) {
          const sellTokenInfo = getTokenInfo(transaction.sellToken);
          const sellTicker = sellTokenInfo ? formatTokenTicker(sellTokenInfo.ticker).toLowerCase() : '';
          
          const buyTokenMatches = Object.keys(transaction.buyTokens).some(buyTokenAddr => {
            const buyTokenInfo = getTokenInfo(buyTokenAddr);
            const buyTicker = buyTokenInfo ? formatTokenTicker(buyTokenInfo.ticker).toLowerCase() : '';
            return buyTicker.includes(searchTerm.toLowerCase());
          });
          
          if (!sellTicker.includes(searchTerm.toLowerCase()) && !buyTokenMatches) {
            return null;
          }
        }
        
        return {
          transaction,
          baseOrder
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);

    // Apply sorting
    rows.sort((a, b) => {
      let comparison = 0;
      
      switch (sortField) {
        case 'sellAmount': {
          const aSellPrice = getTokenPrice(a.transaction.sellToken, tokenPrices);
          const bSellPrice = getTokenPrice(b.transaction.sellToken, tokenPrices);
          const aSellUSD = a.transaction.sellAmount * aSellPrice;
          const bSellUSD = b.transaction.sellAmount * bSellPrice;
          comparison = aSellUSD - bSellUSD;
          break;
        }
        case 'askingFor': {
          const aMinUSD = Math.min(...Object.entries(a.transaction.buyTokens).map(([addr, amount]) => {
            const price = getTokenPrice(addr, tokenPrices);
            return amount * price;
          }));
          const bMinUSD = Math.min(...Object.entries(b.transaction.buyTokens).map(([addr, amount]) => {
            const price = getTokenPrice(addr, tokenPrices);
            return amount * price;
          }));
          comparison = aMinUSD - bMinUSD;
          break;
        }
        case 'progress': {
          const aSellTokenInfo = getTokenInfo(a.transaction.sellToken);
          const bSellTokenInfo = getTokenInfo(b.transaction.sellToken);
          
          const aOriginalSellAmount = Number(formatTokenAmount(a.baseOrder.orderDetailsWithId.orderDetails.sellAmount, aSellTokenInfo.decimals));
          const bOriginalSellAmount = Number(formatTokenAmount(b.baseOrder.orderDetailsWithId.orderDetails.sellAmount, bSellTokenInfo.decimals));
          
          const aUserShare = (a.transaction.sellAmount / aOriginalSellAmount) * 100;
          const bUserShare = (b.transaction.sellAmount / bOriginalSellAmount) * 100;
          
          comparison = aUserShare - bUserShare;
          break;
        }
        case 'date': {
          const aTimestamp = a.transaction.timestamp || 0;
          const bTimestamp = b.transaction.timestamp || 0;
          comparison = aTimestamp - bTimestamp;
          break;
        }
        case 'otcVsMarket': {
          // Calculate OTC vs Market percentage using ORIGINAL order amounts
          const calcOtcPercentage = (row: typeof a) => {
            const sellTokenInfo = getTokenInfo(row.transaction.sellToken);
            if (!sellTokenInfo) return -Infinity;
            
            const baseOrder = allOrders.find(order => 
              order.orderDetailsWithId.orderId.toString() === row.transaction.orderId
            );
            if (!baseOrder) return -Infinity;
            
            // Use original order amounts
            const originalSellAmount = baseOrder.orderDetailsWithId.orderDetails.sellAmount;
            const originalSellAmountNum = parseFloat(formatTokenAmount(originalSellAmount, sellTokenInfo.decimals));
            const sellPrice = getTokenPrice(row.transaction.sellToken, tokenPrices);
            const originalSellAmountUSD = originalSellAmountNum * sellPrice;
            
            // Calculate original buy amounts in USD
            const originalBuyAmounts = baseOrder.orderDetailsWithId.orderDetails.buyAmounts;
            const originalBuyTokensIndex = baseOrder.orderDetailsWithId.orderDetails.buyTokensIndex;
            const originalBuyAmountsUSD = originalBuyTokensIndex.map((tokenIndex: bigint, idx: number) => {
              const tokenInfo = getTokenInfoByIndex(Number(tokenIndex));
              const amount = parseFloat(formatTokenAmount(originalBuyAmounts[idx], tokenInfo.decimals));
              const price = getTokenPrice(tokenInfo.address, tokenPrices);
              return amount * price;
            });
            const originalMinBuyAmountUSD = originalBuyAmountsUSD.length > 0 ? Math.min(...originalBuyAmountsUSD) : 0;
            
            if (originalSellAmountUSD === 0 || originalMinBuyAmountUSD === 0) return -Infinity;
            
            return ((originalMinBuyAmountUSD - originalSellAmountUSD) / originalSellAmountUSD) * 100;
          };
          
          const aOtcPercentage = calcOtcPercentage(a);
          const bOtcPercentage = calcOtcPercentage(b);
          comparison = aOtcPercentage - bOtcPercentage;
          break;
        }
      }
      
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return rows;
  }, [purchaseTransactions, allOrders, tokenFilter, searchTerm, maxiTokenAddresses, tokenPrices, sortField, sortDirection]);

  if (displayRows.length === 0) {
    return (
      <div className="text-center py-8 text-[#00D9FF]/60">
        No order history found
      </div>
    );
  }

  return (
    <div className="w-full min-w-[800px] text-lg">
      {/* Table Header */}
      <div className="grid grid-cols-[minmax(120px,1fr)_minmax(120px,1fr)_minmax(80px,120px)_minmax(100px,140px)_minmax(100px,140px)_minmax(80px,120px)_minmax(80px,120px)_minmax(80px,120px)_auto] items-center gap-4 pb-4 border-b border-[#00D9FF]/30">
        {/* COLUMN 1: You Bought */}
        <button 
          onClick={() => handleSort('sellAmount')}
          className={`text-sm font-medium text-left hover:text-[#00D9FF] transition-colors ${
            sortField === 'sellAmount' ? 'text-[#00D9FF]' : 'text-[#00D9FF]/60'
          }`}
        >
          You Bought {sortField === 'sellAmount' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
        </button>
        
        {/* COLUMN 2: You Paid */}
        <button 
          onClick={() => handleSort('askingFor')}
          className={`text-sm font-medium text-left hover:text-[#00D9FF] transition-colors ${
            sortField === 'askingFor' ? 'text-[#00D9FF]' : 'text-[#00D9FF]/60'
          }`}
        >
          You Paid {sortField === 'askingFor' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
        </button>
        
        {/* COLUMN 3: Fill Status % */}
        <button 
          onClick={() => handleSort('progress')}
          className={`text-sm font-medium text-center hover:text-[#00D9FF] transition-colors ${
            sortField === 'progress' ? 'text-[#00D9FF]' : 'text-[#00D9FF]/60'
          }`}
        >
          Fill Status % {sortField === 'progress' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
        </button>
        
        {/* COLUMN 4: OTC % */}
        <button 
          onClick={() => handleSort('otcVsMarket')}
          className={`text-sm font-medium text-center hover:text-[#00D9FF] transition-colors ${
            sortField === 'otcVsMarket' ? 'text-[#00D9FF]' : 'text-[#00D9FF]/60'
          }`}
        >
          OTC vs Market Price {sortField === 'otcVsMarket' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
        </button>
        
        {/* COLUMN 5: Status */}
        <div className="text-sm font-medium text-center text-[#00D9FF]/60">
          Status
        </div>
        
        {/* COLUMN 6: Date */}
        <button 
          onClick={() => handleSort('date')}
          className={`text-sm font-medium text-center hover:text-[#00D9FF] transition-colors ${
            sortField === 'date' ? 'text-[#00D9FF]' : 'text-[#00D9FF]/60'
          }`}
        >
          Tx Date {sortField === 'date' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
        </button>
        
        {/* COLUMN 7: Actions */}
        <div className="text-sm font-medium text-center text-[#00D9FF]/60">
          
        </div>
      </div>

      {/* Table Body */}
      <div className="space-y-4 pt-4">
      {displayRows.map(({ transaction, baseOrder }) => {
        const sellTokenInfo = getTokenInfo(transaction.sellToken);
        if (!sellTokenInfo) return null;

        // Determine if this is a Buy or Sell transaction
        const orderSeller = baseOrder.userDetails.orderOwner.toLowerCase();
        const isSellTransaction = address?.toLowerCase() === orderSeller;

        const sellPrice = getTokenPrice(transaction.sellToken, tokenPrices);
        const sellUSD = transaction.sellAmount * sellPrice;

        // Calculate buy tokens
        const buyTokenEntries = Object.entries(transaction.buyTokens);
        const buyAmountsUSD = buyTokenEntries.map(([addr, amount]) => {
          const price = getTokenPrice(addr, tokenPrices);
          return amount * price;
        });
        const minBuyAmountUSD = Math.min(...buyAmountsUSD);
        const hasMultipleTokens = buyTokenEntries.length > 1;

        // Calculate fill percentages from base order
        const originalSellAmount = baseOrder.orderDetailsWithId.orderDetails.sellAmount;
        const remainingExecutionPercentage = getRemainingPercentage(baseOrder.orderDetailsWithId);
        
        // Convert to numbers for percentage calculation
        const originalSellAmountNum = Number(formatTokenAmount(originalSellAmount, sellTokenInfo.decimals));
        
        // Calculate total fill percentage (100% - remaining%)
        const remainingPercentage = Number(remainingExecutionPercentage) / 1e18;
        const fillPercentage = (1 - remainingPercentage) * 100;
        
        // Calculate user's share percentage
        const userSharePercentage = originalSellAmountNum > 0
          ? (transaction.sellAmount / originalSellAmountNum) * 100
          : 0;

        // Calculate OTC vs Market Price using ORIGINAL order amounts (not transaction amounts)
        const originalBuyAmounts = baseOrder.orderDetailsWithId.orderDetails.buyAmounts;
        const originalBuyTokensIndex = baseOrder.orderDetailsWithId.orderDetails.buyTokensIndex;
        const originalSellAmountUSD = originalSellAmountNum * sellPrice;
        
        // Calculate original buy amounts in USD
        const originalBuyAmountsUSD = originalBuyTokensIndex.map((tokenIndex: bigint, idx: number) => {
          const tokenInfo = getTokenInfoByIndex(Number(tokenIndex));
          const amount = parseFloat(formatTokenAmount(originalBuyAmounts[idx], tokenInfo.decimals));
          const price = getTokenPrice(tokenInfo.address, tokenPrices);
          return amount * price;
        });
        const originalMinBuyAmountUSD = originalBuyAmountsUSD.length > 0 ? Math.min(...originalBuyAmountsUSD) : 0;
        
        // Calculate OTC vs Market Price based on original order
        const otcPercentage = originalSellAmountUSD > 0 && originalMinBuyAmountUSD > 0
          ? ((originalMinBuyAmountUSD - originalSellAmountUSD) / originalSellAmountUSD) * 100
          : null;

        // Calculate backing price discount
        let backingPriceDiscount = null;
        let isAboveBackingPrice = false;
        
        // Check if this is a MAXI token that has backing price data
        // Don't show stats if there's a chain mismatch
        const isEthereumWrappedSell = sellTokenInfo.ticker.startsWith('we') || sellTokenInfo.ticker.startsWith('e');
        const isPulseChainSell = !isEthereumWrappedSell;
        
        // Check if any buy token has chain mismatch with sell token
        const hasChainMismatch = buyTokenEntries.some(([buyTokenAddr]) => {
          const buyTokenInfo = getTokenInfo(buyTokenAddr);
          if (!buyTokenInfo) return false;
          
          const buyTicker = formatTokenTicker(buyTokenInfo.ticker);
          const isEthereumWrappedBuy = buyTicker.startsWith('we') || buyTicker.startsWith('e');
          
          // Mismatch if: pHEX/pMAXI with weHEX/weMAXI or vice versa
          return (isPulseChainSell && isEthereumWrappedBuy) || (isEthereumWrappedSell && !isEthereumWrappedBuy);
        });
        
        // Map wrapped tokens (we*) to their ethereum versions (e*) for stats lookup
        const tokensWithVersions = ['DECI', 'LUCKY', 'TRIO', 'BASE'];
        let sellTokenKey: string;
        
        if (sellTokenInfo.ticker.startsWith('we')) {
          const baseTicker = sellTokenInfo.ticker.slice(2);
          if (tokensWithVersions.includes(baseTicker)) {
            sellTokenKey = getHighestTokenVersion(tokenStats, 'e', baseTicker);
          } else {
            sellTokenKey = `e${baseTicker}`;
          }
        } else if (sellTokenInfo.ticker.startsWith('e')) {
          const baseTicker = sellTokenInfo.ticker.slice(1);
          if (tokensWithVersions.includes(baseTicker)) {
            sellTokenKey = getHighestTokenVersion(tokenStats, 'e', baseTicker);
          } else {
            sellTokenKey = sellTokenInfo.ticker;
          }
        } else {
          if (tokensWithVersions.includes(sellTokenInfo.ticker)) {
            sellTokenKey = getHighestTokenVersion(tokenStats, 'p', sellTokenInfo.ticker);
          } else {
            sellTokenKey = `p${sellTokenInfo.ticker}`;
          }
        }
        const sellTokenStat = tokenStats[sellTokenKey];
        
        // Only show stats if there's no chain mismatch
        if (!hasChainMismatch && sellTokenStat && sellTokenStat.token.backingPerToken > 0) {
          // Get HEX price in USD
          const hexPrice = getTokenPrice('0x2b591e99afe9f32eaa6214f7b7629768c40eeb39', tokenPrices);
          
          if (hexPrice > 0) {
            // Calculate backing price per token in USD
            const backingPriceUsd = sellTokenStat.token.backingPerToken * hexPrice;
            
            // Calculate OTC price per token in USD using ORIGINAL order amounts
            const otcPriceUsd = originalSellAmountNum > 0 ? originalMinBuyAmountUSD / originalSellAmountNum : 0;
            
            if (otcPriceUsd > 0 && backingPriceUsd > 0) {
              // Calculate percentage: how much above/below backing price the OTC price is
              backingPriceDiscount = ((otcPriceUsd - backingPriceUsd) / backingPriceUsd) * 100;
              isAboveBackingPrice = backingPriceDiscount > 0;
            }
          }
        }

        return (
          <div
            key={transaction.transactionHash}
            className={`grid grid-cols-[minmax(120px,1fr)_minmax(120px,1fr)_minmax(80px,120px)_minmax(100px,140px)_minmax(100px,140px)_minmax(80px,120px)_minmax(80px,120px)_minmax(80px,120px)_auto] items-start gap-4 py-8 ${
              displayRows.indexOf(displayRows.find(r => r.transaction.transactionHash === transaction.transactionHash)!) < displayRows.length - 1 ? 'border-b border-[#00D9FF]/20' : ''
            }`}
          >
            {/* COLUMN 1: You Bought Content */}
            <div className="flex flex-col items-start space-y-1 min-w-0 overflow-hidden">
              <div className="inline-block">
                {isSellTransaction ? (
                  // For SELL: Show what you received (buy tokens from ORIGINAL order)
                  <>
                    <span className={`text-lg font-medium ${originalMinBuyAmountUSD > 0 ? 'text-[#00D9FF]' : 'text-gray-500'}`}>
                      {originalMinBuyAmountUSD > 0 ? formatUSD(originalMinBuyAmountUSD) : '--'}
                    </span>
                    <div className="w-1/2 h-px bg-[#00D9FF]/10 my-2"></div>
                    <div className="flex flex-col gap-1">
                      {originalBuyTokensIndex.map((tokenIndex: bigint, idx: number) => {
                        const buyTokenInfo = getTokenInfoByIndex(Number(tokenIndex));
                        if (!buyTokenInfo) return null;

                        const originalAmount = parseFloat(formatTokenAmount(originalBuyAmounts[idx], buyTokenInfo.decimals));
                        const buyPrice = getTokenPrice(buyTokenInfo.address, tokenPrices);
                        const buyUSD = originalAmount * buyPrice;

                        return (
                          <div key={buyTokenInfo.address} className="flex items-center space-x-2 mb-3">
                            <TokenLogo 
                              src={buyTokenInfo.logo}
                              alt={formatTokenTicker(buyTokenInfo.ticker)}
                              className="w-6 h-6 rounded-full"
                            />
                            <div className="flex flex-col">
                              <span className="text-[#00D9FF] text-sm font-medium whitespace-nowrap">
                                {formatTokenTicker(buyTokenInfo.ticker)}
                              </span>
                              <span className="text-[#00D9FF]/60 text-xs whitespace-nowrap">
                                {formatTokenAmountDisplay(originalAmount)}
                              </span>
                              {originalBuyTokensIndex.length > 1 && buyPrice > 0 && (
                                <span className="text-gray-500 text-xs">
                                  {formatUSD(buyUSD)}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  // For BUY: Show what you bought (sell token)
                  <>
                    <span className={`text-lg font-medium ${sellPrice > 0 ? 'text-[#00D9FF]' : 'text-gray-500'}`}>
                      {sellPrice > 0 ? formatUSD(sellUSD) : '--'}
                    </span>
                    <div className="w-1/2 h-px bg-[#00D9FF]/10 my-2"></div>
                    <div className="flex items-center space-x-2">
                      <TokenLogo 
                        src={sellTokenInfo.logo}
                        alt={formatTokenTicker(sellTokenInfo.ticker)}
                        className="w-6 h-6 rounded-full"
                      />
                      <div className="flex flex-col">
                        <span className="text-[#00D9FF] text-sm font-medium whitespace-nowrap">
                          {formatTokenTicker(sellTokenInfo.ticker)}
                        </span>
                        <span className="text-[#00D9FF]/60 text-xs whitespace-nowrap">
                          {formatTokenAmountDisplay(transaction.sellAmount)}
                        </span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* COLUMN 2: You Paid Content */}
            <div className="flex flex-col items-start space-y-1 min-w-0 overflow-hidden">
              <div className="inline-block">
                {isSellTransaction ? (
                  // For SELL: Show what you gave (sell token - use ORIGINAL amount)
                  <>
                    <span className={`text-lg font-medium ${sellPrice > 0 ? 'text-[#00D9FF]' : 'text-gray-500'}`}>
                      {sellPrice > 0 ? formatUSD(originalSellAmountUSD) : '--'}
                    </span>
                    <div className="w-1/2 h-px bg-[#00D9FF]/10 my-2"></div>
                    <div className="flex items-center space-x-2">
                      <TokenLogo 
                        src={sellTokenInfo.logo}
                        alt={formatTokenTicker(sellTokenInfo.ticker)}
                        className="w-6 h-6 rounded-full"
                      />
                      <div className="flex flex-col">
                        <span className="text-[#00D9FF] text-sm font-medium whitespace-nowrap">
                          {formatTokenTicker(sellTokenInfo.ticker)}
                        </span>
                        <span className="text-[#00D9FF]/60 text-xs whitespace-nowrap">
                          {formatTokenAmountDisplay(originalSellAmountNum)}
                        </span>
                      </div>
                    </div>
                  </>
                ) : (
                  // For BUY: Show what you paid (buy tokens from ORIGINAL order)
                  <>
                    <span className={`text-lg font-medium ${originalMinBuyAmountUSD > 0 ? 'text-[#00D9FF]' : 'text-gray-500'}`}>
                      {originalMinBuyAmountUSD > 0 ? formatUSD(originalMinBuyAmountUSD) : '--'}
                    </span>
                    <div className="w-1/2 h-px bg-[#00D9FF]/10 my-2"></div>
                    <div className="flex flex-col gap-1">
                      {originalBuyTokensIndex.map((tokenIndex: bigint, idx: number) => {
                        const buyTokenInfo = getTokenInfoByIndex(Number(tokenIndex));
                        if (!buyTokenInfo) return null;

                        const originalAmount = parseFloat(formatTokenAmount(originalBuyAmounts[idx], buyTokenInfo.decimals));
                        const buyPrice = getTokenPrice(buyTokenInfo.address, tokenPrices);
                        const buyUSD = originalAmount * buyPrice;

                        return (
                          <div key={buyTokenInfo.address} className="flex items-center space-x-2 mb-3">
                            <TokenLogo 
                              src={buyTokenInfo.logo}
                              alt={formatTokenTicker(buyTokenInfo.ticker)}
                              className="w-6 h-6 rounded-full"
                            />
                            <div className="flex flex-col">
                              <span className="text-[#00D9FF] text-sm font-medium whitespace-nowrap">
                                {formatTokenTicker(buyTokenInfo.ticker)}
                              </span>
                              <span className="text-[#00D9FF]/60 text-xs whitespace-nowrap">
                                {formatTokenAmountDisplay(originalAmount)}
                              </span>
                              {originalBuyTokensIndex.length > 1 && buyPrice > 0 && (
                                <span className="text-gray-500 text-xs">
                                  {formatUSD(buyUSD)}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* COLUMN 3: Fill Status % Content */}
            <div className="flex flex-col items-center space-y-2 mt-0.5 min-w-0">
              <span className={`text-xs ${fillPercentage === 0 ? 'text-gray-500' : 'text-[#00D9FF]'}`}>
                {userSharePercentage > 0 
                  ? `${formatPercentage(userSharePercentage)} / ${formatPercentage(fillPercentage)}`
                  : formatPercentage(fillPercentage)
                }
              </span>
              <div className="w-[60px] h-1 bg-gray-500 rounded-full overflow-hidden relative">
                {/* Total fill percentage (blue) */}
                <div 
                  className={`h-full rounded-full transition-all duration-300 ${
                    fillPercentage === 0 ? 'bg-gray-500' : 'bg-blue-500'
                  }`}
                  style={{ 
                    width: `${fillPercentage}%` 
                  }}
                />
                {/* User's share (green for buy, red for sell overlay) */}
                {userSharePercentage > 0 && (
                  <div 
                    className={`absolute top-0 left-0 h-full rounded-full transition-all duration-300 ${
                      isSellTransaction ? 'bg-red-500' : 'bg-green-500'
                    }`}
                    style={{ 
                      width: `${userSharePercentage}%` 
                    }}
                  />
                )}
              </div>
            </div>

            {/* COLUMN 4: OTC vs Market Price Content */}
            <div className="text-center min-w-0">
              <div className="text-sm">
                {otcPercentage !== null ? (
                  <span className={`font-medium ${
                    otcPercentage < 0 
                      ? 'text-red-400'    // Red discount
                      : 'text-green-400'  // Green premium
                  }`}>
                    {otcPercentage < 0 
                      ? `-${Math.abs(otcPercentage).toLocaleString('en-US', { maximumFractionDigits: 0 })}%`
                      : `+${Math.abs(otcPercentage).toLocaleString('en-US', { maximumFractionDigits: 0 })}%`
                    }
                  </span>
                ) : (
                  <span className="text-gray-500">--</span>
                )}
              </div>
              {otcPercentage !== null && (
                <div className="text-xs text-[#00D9FF]/60 mt-0">
                  {otcPercentage < 0 ? 'discount' : 'premium'}
                </div>
              )}
            </div>

            {/* COLUMN 5: OTC vs Backing Price */}
            <div className="text-center min-w-0">
              <div className="text-sm">
                {backingPriceDiscount !== null ? (
                  <>
                    {(PAYWALL_ENABLED && !hasTokenAccess) ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowPaywallModal(true);
                        }}
                        className="p-2 inline-flex items-center justify-center hover:opacity-80 transition-opacity"
                      >
                        <Lock className="w-5 h-5 -mt-1 text-[#00D9FF]/60 hover:text-[#00D9FF]" />
                      </button>
                    ) : (
                      <span className={`font-medium ${
                        isAboveBackingPrice 
                          ? 'text-[#00D9FF]/60'    // Neutral - selling above backing price
                          : 'text-red-400'     // Red discount - selling below backing price (good deal)
                      }`}>
                        {isAboveBackingPrice 
                          ? `+${Math.abs(backingPriceDiscount).toLocaleString('en-US', { maximumFractionDigits: 0 })}%`
                          : `-${Math.abs(backingPriceDiscount).toLocaleString('en-US', { maximumFractionDigits: 0 })}%`
                        }
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-gray-500">-</span>
                )}
              </div>
              {backingPriceDiscount !== null && !(PAYWALL_ENABLED && !hasTokenAccess) && (
                <div className="text-xs text-[#00D9FF]/60 mt-0">
                  {isAboveBackingPrice ? 'premium' : 'discount'}
                </div>
              )}
            </div>

            {/* COLUMN 6: Status */}
            <div className="text-center min-w-0 mt-1">
              <div className="flex flex-col items-center gap-2">
                <span className={`px-3 py-1 rounded-full text-sm font-medium border w-[110px] ${
                  isSellTransaction 
                    ? 'bg-red-500/20 text-red-400 border-red-400' 
                    : 'bg-green-500/20 text-green-400 border-green-400'
                }`}>
                  {isSellTransaction ? 'Sell' : 'Buy'}
                </span>
                <span className={`px-3 py-1 rounded-full text-sm font-medium border w-[110px] ${
                  getStatusText(baseOrder) === 'Inactive'
                    ? 'bg-yellow-500/20 text-yellow-400 border-yellow-400'
                    : baseOrder.orderDetailsWithId.status === 0 
                    ? 'bg-green-500/20 text-green-400 border-green-400' 
                    : baseOrder.orderDetailsWithId.status === 1
                    ? 'bg-red-500/20 text-red-400 border-red-400'
                    : 'bg-blue-500/20 text-blue-400 border-blue-400'
                }`}>
                  {getStatusText(baseOrder)}
                </span>
              </div>
            </div>

            {/* COLUMN 7: Date */}
            <div className="text-center min-w-0 mt-0.5">
              {transaction.timestamp ? (
                <div className="flex flex-col items-center">
                  <span className="text-[#00D9FF] text-sm font-medium">
                    {formatTimestamp(transaction.timestamp).date}
                  </span>
                  <span className="text-[#00D9FF]/60 text-xs">
                    {formatTimestamp(transaction.timestamp).time}
                  </span>
                </div>
              ) : (
                <span className="text-[#00D9FF]/60 text-sm">--</span>
              )}
            </div>

            {/* COLUMN 8: Actions Content */}
            <div className="text-center min-w-0">
              <div className="flex flex-col items-center gap-1">
                {/* Only show "Buy More" for active orders where user was the buyer */}
                {!isSellTransaction && baseOrder.orderDetailsWithId.status === 0 && getStatusText(baseOrder) === 'Active' && (
                  <button
                    onClick={() => onNavigateToMarketplace(baseOrder)}
                    className="px-3 py-2 bg-white text-black text-xs rounded-full hover:bg-gray-200 transition-colors font-medium"
                    title="View in Marketplace"
                  >
                    Buy More
                  </button>
                )}
                {transaction?.transactionHash && (
                  <button
                    onClick={() => window.open(`https://otter.pulsechain.com/tx/${transaction.transactionHash}`, '_blank')}
                    className="px-3 py-2 mt-1 font-medium bg-transparent text-[#00D9FF] text-xs rounded-full border border-white hover:bg-[#00D9FF]/10 hover:text-[#00D9FF] transition-colors"
                    title="View Transaction on Otterscan"
                  >
                    View Tx
                  </button>
                )}
                <span className="text-gray-600 text-xs mt-1">
                  Order ID: {transaction.orderId}
                </span>
              </div>
            </div>
          </div>
        );
      })}
      </div>
      
      {/* Note about pricing */}
      <div className="mt-6 text-center text-sm text-[#00D9FF]/60">
        All $ values are based on today's prices
      </div>
      
      {/* Paywall Modal */}
      <PaywallModal 
        isOpen={showPaywallModal}
        onClose={() => setShowPaywallModal(false)}
        title={PAYWALL_TITLE}
        description={PAYWALL_DESCRIPTION}
        price={checkingTokenBalance ? "Checking..." : hasTokenAccess ? "Access Granted" : `${REQUIRED_PARTY_TOKENS.toLocaleString()} PARTY or ${REQUIRED_TEAM_TOKENS.toLocaleString()} TEAM`}
        contactUrl="https://x.com/hexgeta"
        partyBalance={partyBalance}
        teamBalance={teamBalance}
        requiredParty={REQUIRED_PARTY_TOKENS}
        requiredTeam={REQUIRED_TEAM_TOKENS}
      />
    </div>
  );
}