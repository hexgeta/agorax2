'use client';

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useNotifications } from '@/hooks/use-notifications';
import { useAccount } from 'wagmi';
import { useOpenPositions } from '@/hooks/contracts/useOpenPositions';
import { useTokenPrices } from '@/hooks/crypto/useTokenPrices';
import { getTokenInfo, getTokenInfoByIndex, formatTokenTicker, formatTokenAmount } from '@/utils/tokenUtils';
import { CircleDollarSign } from 'lucide-react';

// Track which logos have failed to load to avoid repeat 404s
const failedLogosNotif = new Set<string>();

// Simplified TokenLogo component
function TokenLogo({ src, alt, className }: { src: string; alt: string; className: string }) {
  // Check cache first - don't even try to render if we know it will fail
  if (src.includes('default.svg') || failedLogosNotif.has(src)) {
    return (
      <CircleDollarSign 
        className={`${className} text-white`}
      />
    );
  }

  const [hasError, setHasError] = useState(false);

  const handleError = useCallback(() => {
    failedLogosNotif.add(src);
      setHasError(true);
  }, [src]);

  if (hasError) {
    return (
      <CircleDollarSign 
        className={`${className} text-white`}
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

export function NotificationBell() {
  const { isConnected, address } = useAccount();
  const { notifications, isLoading, markAsRead, toggleReadStatus } = useNotifications();
  const { allOrders } = useOpenPositions();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Filter out inactive orders and orders we can't display
  const activeNotifications = useMemo(() => {
    if (!allOrders) return [];
    
    const currentTime = Math.floor(Date.now() / 1000);
    return notifications.filter(notif => {
      const baseOrder = allOrders.find((order: any) => 
        order.orderDetailsWithID.orderID.toString() === notif.orderID
      );
      
      // If order not found, filter it out
      if (!baseOrder) return false;
      
      // Check if token info exists
      const sellTokenInfo = getTokenInfo(baseOrder.orderDetailsWithID.orderDetails.sellToken);
      if (!sellTokenInfo) return false;
      
      const status = baseOrder.orderDetailsWithID.status;
      const expirationTime = Number(baseOrder.orderDetailsWithID.orderDetails.expirationTime);
      const isInactive = status === 0 && expirationTime < currentTime;
      
      return !isInactive;
    });
  }, [notifications, allOrders]);

  // Calculate unread count from active notifications only
  const unreadCount = useMemo(() => {
    return activeNotifications.filter(notif => notif.isNew).length;
  }, [activeNotifications]);
  
  // Collect all unique token addresses from notifications
  const allTokenAddresses = useMemo(() => {
    if (!allOrders || allOrders.length === 0) return [];
    const addresses = new Set<string>();
    allOrders.forEach((order: any) => {
      addresses.add(order.orderDetailsWithID.orderDetails.sellToken);
      // Add buy tokens
      order.orderDetailsWithID.orderDetails.buyTokensIndex.forEach((tokenIndex: bigint) => {
        const tokenInfo = getTokenInfoByIndex(Number(tokenIndex));
        if (tokenInfo) addresses.add(tokenInfo.address);
      });
    });
    return Array.from(addresses);
  }, [allOrders]);

  const { prices: tokenPrices } = useTokenPrices(allTokenAddresses);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleToggle = () => {
    setIsOpen(!isOpen);
  };

  // Helper functions
  const getTokenPrice = useCallback((tokenAddress: string): number => {
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
  }, [tokenPrices]);

  const formatUSD = (amount: number) => {
    if (amount === 0) return '$0';
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

  const formatTokenAmountDisplay = (amount: number): string => {
    if (amount % 1 === 0) {
      return amount.toLocaleString();
    }
    return amount.toFixed(2);
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    const day = date.getUTCDate();
    const month = date.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
    const year = date.getUTCFullYear().toString().slice(-2);
    const hours24 = date.getUTCHours();
    const hours12 = hours24 % 12 || 12;
    const ampm = hours24 >= 12 ? 'PM' : 'AM';
    const minutes = date.getUTCMinutes().toString().padStart(2, '0');
    return {
      date: `${day} ${month} ${year}`,
      time: `${hours12}:${minutes} ${ampm} UTC`
    };
  };

  const getTimeAgo = (timestamp: number) => {
    const now = Math.floor(Date.now() / 1000);
    const diff = now - timestamp;
    const days = Math.floor(diff / 86400);
    const hours = Math.floor(diff / 3600);
    const minutes = Math.floor(diff / 60);
    
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  const getStatusText = (order: any) => {
    const status = order.orderDetailsWithID.status;
    const expirationTime = Number(order.orderDetailsWithID.orderDetails.expirationTime);
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

  // Don't show if wallet not connected
  if (!isConnected) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Icon Button */}
      <button
        onClick={handleToggle}
        className="relative p-2 text-[#00D9FF] hover:text-white transition-colors"
        aria-label="Notifications"
      >
        {/* Bell Icon */}
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>

        {/* Badge for unread count */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-[#FF0080] text-white text-xs font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5 shadow-[0_0_10px_rgba(255,0,128,0.8)]">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="fixed lg:absolute left-1/2 -translate-x-1/2 lg:left-4 lg:translate-x-0 mt-2 w-min-w-[190px] md:min-w-[660px] bg-black border-2 border-[#00D9FF] shadow-[0_0_30px_rgba(0,217,255,0.3)] rounded z-[9999] flex flex-col max-h-[calc(100vh-120px)]">

          {/* Notifications List - Scrollable */}
          <div className="overflow-y-auto flex-1 notifications-scroll"
               style={{ 
                 scrollbarWidth: 'thin',
                 scrollbarColor: 'rgba(0, 217, 255, 0.5) transparent'
               }}
          >
            {isLoading ? (
              <div className="px-4 py-8 text-center text-[#00D9FF]/50">
                Loading...
              </div>
            ) : activeNotifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-[#00D9FF]/50">
                No order history yet
              </div>
            ) : (
              <div className="pl-4 pr-6 py-2 md:py-4">
                {activeNotifications.map((notif, index) => {
                  const notificationId = notif.txHash;
                  const baseOrder = allOrders?.find((order: any) => 
                    order.orderDetailsWithID.orderID.toString() === notif.orderID
                  );

                  if (!baseOrder) return null;

                  const sellTokenInfo = getTokenInfo(baseOrder.orderDetailsWithID.orderDetails.sellToken);
                  if (!sellTokenInfo) return null;

                  // For filled transactions, show ALL BUY tokens received
                  // For other transactions, show the SELL token
                  const displayTokens: Array<{ info: any; amount: number }> = [];
                  
                  if (notif.type === 'filled' && baseOrder.orderDetailsWithID.orderDetails.buyTokensIndex.length > 0) {
                    // Get all buy tokens
                    for (let i = 0; i < baseOrder.orderDetailsWithID.orderDetails.buyTokensIndex.length; i++) {
                      const tokenInfo = getTokenInfoByIndex(Number(baseOrder.orderDetailsWithID.orderDetails.buyTokensIndex[i]));
                      if (tokenInfo && baseOrder.orderDetailsWithID.orderDetails.buyAmounts[i]) {
                        const amount = parseFloat(formatTokenAmount(
                          baseOrder.orderDetailsWithID.orderDetails.buyAmounts[i], 
                          tokenInfo.decimals
                        ));
                        displayTokens.push({ info: tokenInfo, amount });
                      }
                    }
                  } else {
                    // For non-filled notifications, show sell token
                    const amount = parseFloat(formatTokenAmount(
                      baseOrder.orderDetailsWithID.orderDetails.sellAmount, 
                      sellTokenInfo.decimals
                    ));
                    displayTokens.push({ info: sellTokenInfo, amount });
                  }
                  
                  if (displayTokens.length === 0) return null;

                  return (
                    <div
                      key={notif.txHash}
                      onClick={() => toggleReadStatus(notificationId)}
                      className={`border border-[#00D9FF]/20 rounded p-2 md:p-3 mb-1.5 md:mb-2 hover:border-[#00D9FF]/40 transition-colors cursor-pointer ${
                        notif.isNew ? 'bg-[#FF0080]/5' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        {/* Left: Event Badge + Asset Info */}
                        <div className="flex items-center gap-2 md:gap-3 flex-1">
                          {/* Event Type Badge */}
                          <span className={`hidden md:inline px-2 py-1 text-xs font-medium border rounded w-[125px] text-center ${
                            notif.type === 'filled'
                              ? 'bg-green-500/20 text-green-400 border-green-400'
                              : 'bg-yellow-500/20 text-yellow-400 border-yellow-400'
                          }`}>
                            {notif.type === 'filled' ? 'Filled' : 'Updated'}
                          </span>

                          {/* Asset and Amount */}
                          <div className="flex flex-col gap-1">
                            {displayTokens.map((token, idx) => (
                              <div key={idx} className="flex items-center gap-2">
                                <TokenLogo 
                                  src={token.info.logo}
                                  alt={formatTokenTicker(token.info.ticker)}
                                  className="w-5 h-5"
                                />
                                <span className="text-sm text-[#00D9FF] font-medium">
                                  {formatTokenAmountDisplay(token.amount)} {formatTokenTicker(token.info.ticker)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Right: Time and Actions */}
                        <div className="flex items-center gap-1.5 md:gap-3">
                          {/* Time ago */}
                          <div className="text-xs text-[#00D9FF]/60 whitespace-nowrap">
                            {getTimeAgo(notif.timestamp)}
                          </div>

                          {/* Date */}
                          <div className="hidden md:block text-xs text-[#00D9FF]/40 whitespace-nowrap">
                            {formatTimestamp(notif.timestamp).date}
                          </div>

                          {/* View Tx Button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              markAsRead(notificationId);
                              window.open(`https://otter.pulsechain.com/tx/${notif.txHash}`, '_blank');
                            }}
                            className="px-2 py-1 bg-transparent text-[#00D9FF] text-xs border border-[#00D9FF] hover:bg-[#00D9FF]/10 transition-colors whitespace-nowrap"
                          >
                            View Tx
                          </button>

                          {/* Read/Unread Toggle */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleReadStatus(notificationId);
                            }}
                            className="p-1 hover:bg-[#00D9FF]/10 rounded transition-colors"
                            title={notif.isNew ? "Mark as read" : "Mark as unread"}
                          >
                            {notif.isNew ? (
                              <svg className="w-4 h-4 text-[#FF0080]" fill="currentColor" viewBox="0 0 20 20">
                                <circle cx="10" cy="10" r="5" />
                              </svg>
                            ) : (
                              <svg className="w-4 h-4 text-[#00D9FF]/30" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 20 20">
                                <circle cx="10" cy="10" r="5" />
                              </svg>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

