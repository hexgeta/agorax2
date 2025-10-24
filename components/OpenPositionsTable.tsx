'use client';

import { useState, useEffect, useCallback, useMemo, useRef, forwardRef, useImperativeHandle } from 'react';
import { motion } from 'framer-motion';
import { CircleDollarSign, ChevronDown, Trash2, Loader2, Lock, Search, ArrowRight, MoveRight, ChevronRight, Play } from 'lucide-react';
import PaywallModal from './PaywallModal';
import OrderHistoryTable from './OrderHistoryTable';
import useToast from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';
import { useOpenPositions } from '@/hooks/contracts/useOpenPositions';
import { useTokenPrices } from '@/hooks/crypto/useTokenPrices';
import { useTokenStats } from '@/hooks/crypto/useTokenStats';
import { useContractWhitelist } from '@/hooks/contracts/useContractWhitelist';
import { formatEther, parseEther, parseAbiItem } from 'viem';
import { getTokenInfo, getTokenInfoByIndex, formatAddress, formatTokenTicker, parseTokenAmount, formatTokenAmount } from '@/utils/tokenUtils';
import { isNativeToken } from '@/utils/tokenApproval';
import { TOKEN_CONSTANTS } from '@/constants/crypto';
import { waitForTransactionWithTimeout, TRANSACTION_TIMEOUTS } from '@/utils/transactionTimeout';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import { useTransaction } from '@/context/TransactionContext';
import { useTokenAccess } from '@/context/TokenAccessContext';
import { PAYWALL_ENABLED, REQUIRED_PARTY_TOKENS, REQUIRED_TEAM_TOKENS, PAYWALL_TITLE, PAYWALL_DESCRIPTION } from '@/config/paywall';
import { getContractAddress } from '@/config/testing';
import { useContract } from '@/context/ContractContext';

// Sorting types
type SortField = 'sellAmount' | 'askingFor' | 'progress' | 'owner' | 'status' | 'date' | 'backingPrice' | 'currentPrice' | 'otcVsMarket';
type SortDirection = 'asc' | 'desc';

// Helper function to get remaining percentage (works for both Bistro and AgoraX)
const getRemainingPercentage = (orderDetailsWithId: any): bigint => {
  return orderDetailsWithId.remainingFillPercentage || orderDetailsWithId.remainingExecutionPercentage || 0n;
};

// Copy to clipboard function
const copyToClipboard = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
    // You could add a toast notification here if you have one
  } catch (err) {
  }
};

// Format number without scientific notation
const formatAmount = (amount: string) => {
  const num = parseFloat(amount);
  if (num < 0.000001 && num > 0) {
    return num.toFixed(8);
  }
  if (num >= 10000) {
    return num.toLocaleString();
  }
  return amount;
};

// Format number with commas for large numbers while preserving decimal input
const formatNumberWithCommas = (value: string) => {
  if (!value) return '';
  
  // Preserve trailing decimal point or zeros while typing
  if (value.endsWith('.') || value.endsWith('.0')) {
    return value;
  }
  
  const num = parseFloat(value);
  if (isNaN(num)) return value;
  
  // If the original value has more decimal places than toLocaleString would show, preserve them
  const decimalIndex = value.indexOf('.');
  if (decimalIndex !== -1) {
    const decimalPlaces = value.length - decimalIndex - 1;
    return num.toLocaleString('en-US', {
      minimumFractionDigits: decimalPlaces,
      maximumFractionDigits: decimalPlaces
    });
  }
  
  return num.toLocaleString();
};

// Remove commas from number string
const removeCommas = (value: string) => {
  return value.replace(/,/g, '');
};

// Format USD amount without scientific notation
const formatUSD = (amount: number) => {
  // Handle zero values cleanly
  if (amount === 0) {
    return '$0';
  }
  if (amount < 0.000001) {
    return `$${amount.toFixed(8)}`;
  }
  if (amount < 0.01) {
    return `$${amount.toFixed(6)}`;
  }
  if (amount < 1) {
    return `$${amount.toFixed(4)}`;
  }
  if (amount >= 1000) {
    // For amounts $1,000 and above, use locale formatting with commas
    return `$${amount.toLocaleString(undefined, { 
      minimumFractionDigits: 0, 
      maximumFractionDigits: 2 
    })}`;
  }
  // For amounts $1-$999, show up to 2 decimals but don't force them for whole numbers
  const formatted = amount.toFixed(2);
  const withoutTrailingZeros = formatted.replace(/\.?0+$/, '');
  return `$${withoutTrailingZeros}`;
};

// Helper function to format token amounts without unnecessary decimals
const formatTokenAmountDisplay = (amount: number): string => {
  // If it's a whole number, don't show decimals
  if (amount % 1 === 0) {
    return amount.toLocaleString();
  }
  // Otherwise, show 2 decimal places
  return amount.toFixed(2);
};

// Helper function to get token price with hardcoded overrides
const getTokenPrice = (tokenAddress: string, tokenPrices: any): number => {
  // Hardcode weDAI to $1.00
  if (tokenAddress.toLowerCase() === '0xefd766ccb38eaf1dfd701853bfce31359239f305') {
    return 1.0;
  }
  
  // Use WPLS price for PLS (native token addresses)
  const plsAddresses = [
    '0x0000000000000000000000000000000000000000', // 0x0
    '0x000000000000000000000000000000000000dead', // 0xdEaD
  ];
  if (plsAddresses.some(addr => tokenAddress.toLowerCase() === addr.toLowerCase())) {
    // Try to get WPLS price from API, fallback to hardcoded value from DexScreener
    const wplsPrice = tokenPrices['0xa1077a294dde1b09bb078844df40758a5d0f9a27']?.price;
    return wplsPrice || 0.000034; // Fallback to current DexScreener price
  }
  
  // Debug for other tokens that return 0
  const price = tokenPrices[tokenAddress]?.price || 0;
  if (price === 0) {
  }
  
  // Return regular price for other tokens
  return price;
};

// Map wrapped tokens to base tokens for price fetching
const getBaseTokenForPrice = (ticker: string) => {
  const baseTokenMap: Record<string, string> = {
    'weMAXI': 'MAXI',
    'weDECI': 'DECI', 
    'weLUCKY': 'LUCKY',
    'weTRIO': 'TRIO',
    'weBASE': 'BASE',
    'weHEX': 'HEX',
    'weUSDC': 'USDC',
    'weUSDT': 'USDT',
    'pMAXI': 'MAXI',
    'pDECI': 'DECI',
    'pLUCKY': 'LUCKY', 
    'pTRIO': 'TRIO',
    'pBASE': 'BASE',
    'pHEX': 'HEX',
    'eMAXI': 'MAXI',
    'eDECI': 'DECI',
    'eLUCKY': 'LUCKY',
    'eTRIO': 'TRIO',
    'eBASE': 'BASE',
    'eHEX': 'HEX'
  };
  
  return baseTokenMap[ticker] || ticker;
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

// MAXI token addresses (important tokens to highlight)
const maxiTokenAddresses = [
  // Original tokens
  '0x0d86eb9f43c57f6ff3bc9e23d8f9d82503f0e84b', // MAXI - Original MAXI token
  '0x6b32022693210cd2cfc466b9ac0085de8fc34ea6', // DECI - Original DECI token
  '0x6b0956258ff7bd7645aa35369b55b61b8e6d6140', // LUCKY - Original LUCKY token
  '0xf55cd1e399e1cc3d95303048897a680be3313308', // TRIO - Original TRIO token
  '0xe9f84d418b008888a992ff8c6d22389c2c3504e0', // BASE - Original BASE token
  // Wrapped tokens (from Ethereum)
  '0x352511c9bc5d47dbc122883ed9353e987d10a3ba', // weMAXI
  '0x189a3ca3cc1337e85c7bc0a43b8d3457fd5aae89', // weDECI
  '0x8924f56df76ca9e7babb53489d7bef4fb7caff19', // weLUCKY
  '0x0f3c6134f4022d85127476bc4d3787860e5c5569', // weTRIO
  '0xda073388422065fe8d3b5921ec2ae475bae57bed', // weBASE
  // Pulsechain wrapped tokens (p-prefixed)
  '0xd63204ffcefd8f8cbf7390bbcd78536468c085a2', // pMAXI
  '0x969af590981bb9d19ff38638fa3bd88aed13603a', // pDECI
  '0x52d4b3f479537a15d0b37b6cdbdb2634cc78525e', // pLUCKY
  '0x0b0f8f6c86c506b70e2a488a451e5ea7995d05c9', // pTRIO
  '0xb39490b46d02146f59e80c6061bb3e56b824d672', // pBASE
];

// Cache to remember which logos have failed to load
const failedLogos = new Set<string>();
// Cache to remember which format works for each symbol (svg or png)
const formatCache = new Map<string, 'svg' | 'png'>();

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

  // Debug logging for logo loading
  useEffect(() => {
    if (alt === 'DARK' || alt === 'BRIBE' || alt === 'OG' || alt === 'MAXI') {
    }
  }, [alt, src, hasError, isClient]);

  // If it's already the default.svg or has error, show Lucide icon fallback
  if (src.includes('default.svg') || hasError || !isClient) {
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

export const OpenPositionsTable = forwardRef<any, {}>((props, ref) => {
  const { fillOrExecuteOrder, cancelOrder, updateOrderInfo, updateOrderPrice, updateOrderExpirationTime, isWalletConnected } = useContractWhitelist();
  const { address, chainId } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { activeContract } = useContract();

  // Contract address for querying events - get based on current chain and active contract
  const OTC_CONTRACT_ADDRESS = getContractAddress(chainId, activeContract) as `0x${string}`;
  const { setTransactionPending } = useTransaction();
  const { toast } = useToast();
  
  // Token-gating - use centralized validation
  const { hasTokenAccess, partyBalance, teamBalance, isChecking: checkingTokenBalance } = useTokenAccess();
  
  // Expose refresh function to parent component
  useImperativeHandle(ref, () => ({
    refreshAndNavigateToMyActiveOrders: (sellToken?: any, buyToken?: any) => {
      // Determine if this is a MAXI deal by checking if either token is in the MAXI list
      let isMaxiDeal = false;
      
      if (sellToken?.address) {
        isMaxiDeal = maxiTokenAddresses.some(addr => 
          addr.toLowerCase() === sellToken.address.toLowerCase()
        );
      }
      
      if (!isMaxiDeal && buyToken?.address) {
        isMaxiDeal = maxiTokenAddresses.some(addr => 
          addr.toLowerCase() === buyToken.address.toLowerCase()
        );
      }
      
      // Set appropriate token filter based on whether it's a MAXI deal
      setTokenFilter(isMaxiDeal ? 'maxi' : 'non-maxi');
      setOwnershipFilter('mine');
      setStatusFilter('active');
      
      // Clear any expanded positions
      setExpandedPositions(new Set());
      
      // Refresh the orders to show the new order
      refetch();
      
    }
  }));
  
  // Level 1: Token type filter
  const [tokenFilter, setTokenFilter] = useState<'maxi' | 'non-maxi'>('maxi');
  // Level 2: Ownership filter  
  const [ownershipFilter, setOwnershipFilter] = useState<'mine' | 'non-mine'>('mine');
  // Level 3: Status filter
  const [statusFilter, setStatusFilter] = useState<'active' | 'completed' | 'inactive' | 'cancelled' | 'order-history'>('active');
  // Search filter
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isClient, setIsClient] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [loadingDots, setLoadingDots] = useState(1);
  const [showMotion, setShowMotion] = useState(true);
  const [initialAnimationComplete, setInitialAnimationComplete] = useState(false);
  const animationCompleteRef = useRef(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  
  const [showPaywallModal, setShowPaywallModal] = useState(false);
  
  // Sorting state
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  
  // Expanded positions state
  const [expandedPositions, setExpandedPositions] = useState<Set<string>>(new Set());
  
  // User's purchase history (order IDs they have bought)
  const [purchasedOrderIds, setPurchasedOrderIds] = useState<Set<string>>(new Set());
  
  // User's actual purchase transactions (each transaction is a separate entry)
  const [purchaseTransactions, setPurchaseTransactions] = useState<Array<{
    transactionHash: string;
    orderId: string;
    sellToken: string;
    sellAmount: number;
    buyTokens: Record<string, number>;
    blockNumber: bigint;
    timestamp?: number;
  }>>([]);
  
  // Offer input state
  const [offerInputs, setOfferInputs] = useState<{[orderId: string]: {[tokenAddress: string]: string}}>({});
  
  // State for executing orders
  const [executingOrders, setExecutingOrders] = useState<Set<string>>(new Set());
  const [approvingOrders, setApprovingOrders] = useState<Set<string>>(new Set());
  const [executeErrors, setExecuteErrors] = useState<{[orderId: string]: string}>({});
  
  // State for canceling orders
  const [cancelingOrders, setCancelingOrders] = useState<Set<string>>(new Set());
  const [cancelErrors, setCancelErrors] = useState<{[orderId: string]: string}>({});
  
  // State for editing orders
  const [editingOrder, setEditingOrder] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<{
    sellAmount: string;
    buyAmounts: {[tokenIndex: string]: string};
    expirationTime: string;
  }>({ sellAmount: '', buyAmounts: {}, expirationTime: '' });
  const [updatingOrders, setUpdatingOrders] = useState<Set<string>>(new Set());
  const [updateErrors, setUpdateErrors] = useState<{[orderId: string]: string}>({});
  
  const { 
    contractName, 
    contractOwner, 
    contractSymbol, 
    totalSupply, 
    orderCounter,
    allOrders, 
    activeOrders, 
    completedOrders, 
    cancelledOrders, 
    isLoading, 
    error,
    refetch
  } = useOpenPositions();

  // Get unique sell token addresses for price fetching
  const sellTokenAddresses = allOrders ? [...new Set(allOrders.map(order => 
    order.orderDetailsWithId.orderDetails.sellToken
  ))] : [];
  
  // Get unique buy token addresses for price fetching
  const buyTokenAddresses = allOrders ? [...new Set(allOrders.flatMap(order => {
    const buyTokensIndex = order.orderDetailsWithId.orderDetails.buyTokensIndex;
    if (buyTokensIndex && Array.isArray(buyTokensIndex)) {
      return buyTokensIndex.map((tokenIndex: bigint) => {
        const tokenInfo = getTokenInfoByIndex(Number(tokenIndex));
        return tokenInfo.address;
      });
    }
    return [];
  }))] : [];
  
  // Combine all unique token addresses for price fetching
  const allTokenAddresses = [...new Set([...sellTokenAddresses, ...buyTokenAddresses])];
  
  // Use contract addresses directly for price fetching
  const { prices: tokenPrices, isLoading: pricesLoading } = useTokenPrices(allTokenAddresses);
  const { tokenStats, isLoading: statsLoading } = useTokenStats({ 
    enabled: PAYWALL_ENABLED ? hasTokenAccess : true 
  });
  
  // Check if we have valid price data for all tokens
  const hasValidPriceData = useMemo(() => {
    return tokenPrices && allTokenAddresses.length > 0 && 
           allTokenAddresses.some(address => tokenPrices[address]?.price > 0);
  }, [tokenPrices, allTokenAddresses]);
  
  // Overall loading state - only for initial load
  const isTableLoading = (pricesLoading || !hasValidPriceData) && isInitialLoad;
  
  // Handle animation completion without state updates that cause re-renders
  const handleAnimationComplete = useCallback(() => {
    if (!animationCompleteRef.current) {
      animationCompleteRef.current = true;
      setInitialAnimationComplete(true);
      // Keep motion enabled for filter changes, just mark initial as complete
    }
  }, []);
  

  useEffect(() => {
    setIsClient(true);
    setMounted(true);
  }, []);

  // Effect to handle initial load completion
  useEffect(() => {
    if (hasValidPriceData && !pricesLoading && isInitialLoad) {
      setIsInitialLoad(false);
    }
  }, [hasValidPriceData, pricesLoading, isInitialLoad]);

  // Loading dots animation
  useEffect(() => {
    const interval = setInterval(() => {
      setLoadingDots(prev => prev >= 3 ? 1 : prev + 1);
    }, 500);
    return () => clearInterval(interval);
  }, []);

  // Handle sorting
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Handle position expansion
  const togglePositionExpansion = (orderId: string) => {
    setExpandedPositions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(orderId)) {
        newSet.delete(orderId);
      } else {
        newSet.add(orderId);
        // Scroll the expanded position to the top after a short delay
        setTimeout(() => {
          const element = document.querySelector(`[data-order-id="${orderId}"]`);
          if (element) {
            element.scrollIntoView({ 
              behavior: 'smooth', 
              block: 'start',
              inline: 'nearest'
            });
          }
        }, 100);
      }
      return newSet;
    });
  };

  // Navigate to marketplace and expand specific order
  const navigateToMarketplaceOrder = (order: any) => {
    const orderId = order.orderDetailsWithId.orderId.toString();
    
    // Determine if this is a MAXI deal
    const sellTokenAddress = order.orderDetailsWithId.orderDetails.sellToken;
    const isMaxiDeal = maxiTokenAddresses.some(addr => 
      addr.toLowerCase() === sellTokenAddress.toLowerCase()
    ) || order.orderDetailsWithId.orderDetails.buyTokensIndex.some((tokenIndex: bigint) => {
      const tokenInfo = getTokenInfoByIndex(Number(tokenIndex));
      return maxiTokenAddresses.some(addr => 
        addr.toLowerCase() === tokenInfo.address.toLowerCase()
      );
    });
    
    // Set the correct token filter
    setTokenFilter(isMaxiDeal ? 'maxi' : 'non-maxi');
    
    // Switch to marketplace view
    setOwnershipFilter('non-mine');
    setStatusFilter('active');
    
    // Clear current expanded positions and expand the target order
    setExpandedPositions(new Set([orderId]));
    
    // Clear any execute errors for the target order
    setExecuteErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[orderId];
      return newErrors;
    });

  };

  // Clear all expanded positions
  const clearExpandedPositions = () => {
    setExpandedPositions(new Set());
  };

  // Function to fetch purchase history - extracted so it can be called manually
  const fetchPurchaseHistory = useCallback(async () => {
      if (!address || !publicClient) return;

      try {
        // PART 1: Query OrderExecuted events where the user is the buyer
        const buyerLogs = await publicClient.getLogs({
          address: OTC_CONTRACT_ADDRESS,
          event: parseAbiItem('event OrderExecuted(address indexed user, uint256 orderId)'),
          args: {
            user: address // Current connected wallet as buyer
          },
          fromBlock: 'earliest' // Query from the beginning - could be optimized with a specific block range
        });

        // PART 2: Query OrderExecuted events where the user is the seller (order creator)
        // First, find all orders created by the connected wallet
        const userCreatedOrders = allOrders.filter(order => 
          order.userDetails.orderOwner.toLowerCase() === address.toLowerCase()
        );
        const userCreatedOrderIds = userCreatedOrders.map(order => 
          order.orderDetailsWithId.orderId.toString()
        );
        
        // Query ALL OrderExecuted events for those order IDs (no user filter)
        let sellerLogs: any[] = [];
        if (userCreatedOrderIds.length > 0) {
          sellerLogs = await publicClient.getLogs({
            address: OTC_CONTRACT_ADDRESS,
            event: parseAbiItem('event OrderExecuted(address indexed user, uint256 orderId)'),
            fromBlock: 'earliest'
          });
          
          // Filter to only include events for user's created orders and exclude their own purchases
          sellerLogs = sellerLogs.filter(log => {
            const orderId = log.args.orderId?.toString();
            const buyer = log.args.user?.toLowerCase();
            return orderId && 
                   userCreatedOrderIds.includes(orderId) && 
                   buyer !== address.toLowerCase(); // Exclude own purchases from seller view
          });
        }

        // Extract order IDs that the user has purchased (buyer perspective)
        const orderIds = new Set(buyerLogs.map(log => log.args.orderId?.toString()).filter((id): id is string => Boolean(id)));
        setPurchasedOrderIds(orderIds);
        
        // Now get the actual purchase amounts by analyzing the transaction receipts
        const transactions: Array<{
          transactionHash: string;
          orderId: string;
          sellToken: string;
          sellAmount: number;
          buyTokens: Record<string, number>;
          blockNumber: bigint;
          timestamp?: number;
        }> = [];
        
        // Combine buyer and seller logs for processing
        const allLogs = [...buyerLogs, ...sellerLogs];
        
        for (const log of allLogs) {
          const orderId = log.args.orderId?.toString();
          if (!orderId) continue;
          
          try {
            // Determine if this is a buyer or seller transaction
            const buyerAddress = log.args.user?.toLowerCase();
            const isBuyerTransaction = buyerAddress === address.toLowerCase();
            const relevantAddress = isBuyerTransaction ? address.toLowerCase() : buyerAddress;
            
            // Get the transaction receipt to analyze token transfers
            const receipt = await publicClient.getTransactionReceipt({
              hash: log.transactionHash
            });
            
            // Parse ERC20 Transfer events to get actual amounts transferred
            const transferLogs = receipt.logs.filter(transferLog => {
              // ERC20 Transfer event signature: Transfer(address indexed from, address indexed to, uint256 value)
              return transferLog.topics[0] === '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
            });
            
            
            let sellAmount = 0;
            let sellToken = '';
            const buyTokens: Record<string, number> = {};
            
            for (const transferLog of transferLogs) {
              const tokenAddress = transferLog.address.toLowerCase();
              const from = `0x${transferLog.topics[1]?.slice(26)}`.toLowerCase(); // Remove padding
              const to = `0x${transferLog.topics[2]?.slice(26)}`.toLowerCase(); // Remove padding
              const value = transferLog.data ? BigInt(transferLog.data) : BigInt(0);
              
              
              // If transfer is FROM the contract TO the relevant address, it's what was received (sell token)
              if (from === OTC_CONTRACT_ADDRESS.toLowerCase() && to === relevantAddress) {
                // Find token info by address
                const tokenInfo = getTokenInfo(tokenAddress);
                if (tokenInfo && tokenInfo.address !== '0x0000000000000000000000000000000000000000') {
                  sellAmount = parseFloat(formatTokenAmount(value, tokenInfo.decimals));
                  sellToken = tokenAddress;
                }
              }
              
              // If transfer is FROM the relevant address TO the contract, it's what was paid (buy tokens)
              if (from === relevantAddress && to === OTC_CONTRACT_ADDRESS.toLowerCase()) {
                // Find token info by address
                const tokenInfo = getTokenInfo(tokenAddress);
                if (tokenInfo && tokenInfo.address !== '0x0000000000000000000000000000000000000000') {
                  buyTokens[tokenAddress] = parseFloat(formatTokenAmount(value, tokenInfo.decimals));
                }
              }
            }
            
            if (sellAmount > 0 || Object.keys(buyTokens).length > 0) {
              // Fetch block timestamp
              const block = await publicClient.getBlock({
                blockNumber: log.blockNumber
              });
              
              transactions.push({
                transactionHash: log.transactionHash,
                orderId,
                sellToken,
                sellAmount,
                buyTokens,
                blockNumber: log.blockNumber,
                timestamp: Number(block.timestamp)
              });
            }
          } catch (txError) {
          }
        }
        
        setPurchaseTransactions(transactions);
        
        // Debug: Log each transaction
        transactions.forEach((transaction) => {
        });
        
      } catch (error) {
        // Set empty set on error
        setPurchasedOrderIds(new Set());
        setPurchaseTransactions([]);
      }
  }, [address, publicClient, allOrders]);

  // Query user's purchase history from OrderExecuted events and get actual purchase amounts
  useEffect(() => {
    fetchPurchaseHistory();
  }, [fetchPurchaseHistory]);

  // Lock scrolling when edit modal is open
  useEffect(() => {
    if (editingOrder) {
      // Lock both html and body to prevent scrolling on all browsers
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
    } else {
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
    }
    
    return () => {
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
    };
  }, [editingOrder]);

  // Simplify error messages for user rejections
  const simplifyErrorMessage = (error: any) => {
    const errorMessage = error?.message || error?.toString() || '';
    
    // Check if it's a user rejection
    if (errorMessage.toLowerCase().includes('user rejected') || 
        errorMessage.toLowerCase().includes('user denied') ||
        errorMessage.toLowerCase().includes('rejected the request')) {
      return 'User rejected the request';
    }
    
    return errorMessage;
  };



  // Handle input change for offer amounts
  const handleOfferInputChange = (orderId: string, tokenAddress: string, value: string, order: any) => {
    // Find the maximum allowed amount for this token
    const buyTokensIndex = order.orderDetailsWithId.orderDetails.buyTokensIndex;
    const buyAmounts = order.orderDetailsWithId.orderDetails.buyAmounts;
    
    let maxAllowedAmount = '';
    let tokenIndex = -1;
    if (buyTokensIndex && buyAmounts) {
      tokenIndex = buyTokensIndex.findIndex((idx: bigint) => {
        const tokenInfo = getTokenInfoByIndex(Number(idx));
        return tokenInfo.address === tokenAddress;
      });
      
      if (tokenIndex !== -1 && buyAmounts[tokenIndex]) {
        const tokenInfo = getTokenInfoByIndex(Number(buyTokensIndex[tokenIndex]));
        maxAllowedAmount = formatTokenAmount(buyAmounts[tokenIndex], tokenInfo.decimals);
      }
    }
    
    // Validate the input amount
    const inputAmount = parseFloat(value);
    const maxAmount = parseFloat(maxAllowedAmount);
    
    // If input is valid and within limits, or if it's empty, allow it
    if (value === '' || (!isNaN(inputAmount) && inputAmount <= maxAmount)) {
      // Calculate the percentage for this token
      let percentage = 0;
      if (inputAmount > 0 && maxAmount > 0) {
        percentage = inputAmount / maxAmount;
      }
      
      // Update all other tokens to maintain the same percentage
      const newInputs: {[tokenAddress: string]: string} = {
        ...offerInputs[orderId],
        [tokenAddress]: value
      };
      
      // If we have a valid percentage, apply it to all other tokens
      if (percentage > 0 && tokenIndex !== -1) {
        buyTokensIndex.forEach((idx: bigint, idxNum: number) => {
          if (idxNum !== tokenIndex) {
            const otherTokenInfo = getTokenInfoByIndex(Number(idx));
            const otherMaxAmount = parseFloat(formatTokenAmount(buyAmounts[idxNum], otherTokenInfo.decimals));
            const otherAmount = (otherMaxAmount * percentage).toString();
            newInputs[otherTokenInfo.address] = otherAmount;
          }
        });
      } else if (value === '') {
        // If clearing this input, clear all others too
        buyTokensIndex.forEach((idx: bigint) => {
          const otherTokenInfo = getTokenInfoByIndex(Number(idx));
          newInputs[otherTokenInfo.address] = '';
        });
      }
      
      setOfferInputs(prev => ({
        ...prev,
        [orderId]: newInputs
      }));
    }
    // If input exceeds maximum, don't update the state (effectively preventing the input)
  };

  // Handle percentage fill
  const handlePercentageFill = (order: any, percentage: number) => {
    const orderId = order.orderDetailsWithId.orderId.toString();
    const buyTokensIndex = order.orderDetailsWithId.orderDetails.buyTokensIndex;
    const buyAmounts = order.orderDetailsWithId.orderDetails.buyAmounts;
    
    if (!buyTokensIndex || !Array.isArray(buyTokensIndex)) {
      return;
    }
    
    if (!buyAmounts || !Array.isArray(buyAmounts)) {
      return;
    }
    
    const newInputs: {[tokenAddress: string]: string} = {};
    
    // Fill each token with the specified percentage of its remaining amount
    const remainingPercentage = Number(getRemainingPercentage(order.orderDetailsWithId)) / 1e18;
    
    buyTokensIndex.forEach((tokenIndex: bigint, idx: number) => {
      const tokenInfo = getTokenInfoByIndex(Number(tokenIndex));
      if (tokenInfo.address && buyAmounts[idx]) {
        // Calculate the remaining amount first
        const originalAmount = buyAmounts[idx];
        const remainingAmount = (originalAmount * BigInt(Math.floor(remainingPercentage * 1e18))) / BigInt(1e18);
        const remainingAmountFormatted = parseFloat(formatTokenAmount(remainingAmount, tokenInfo.decimals));
        
        // Apply the percentage to the remaining amount
        const fillAmount = remainingAmountFormatted * percentage;
        // Round to reasonable precision to avoid floating point issues, then convert to string
        // This will automatically remove trailing zeros
        const roundedAmount = Math.round(fillAmount * 1e15) / 1e15;
        newInputs[tokenInfo.address] = roundedAmount.toString();
      }
    });
    
    setOfferInputs(prev => ({
      ...prev,
      [orderId]: newInputs
    }));
  };

  // Handle clear all inputs
  const handleClearInputs = (order: any) => {
    const orderId = order.orderDetailsWithId.orderId.toString();
    const buyTokensIndex = order.orderDetailsWithId.orderDetails.buyTokensIndex;
    
    if (!buyTokensIndex || !Array.isArray(buyTokensIndex)) {
      return;
    }
    
    const newInputs: {[tokenAddress: string]: string} = {};
    
    // Clear all inputs
    buyTokensIndex.forEach((tokenIndex: bigint) => {
      const tokenInfo = getTokenInfoByIndex(Number(tokenIndex));
      if (tokenInfo.address) {
        newInputs[tokenInfo.address] = '';
      }
    });
    
    setOfferInputs(prev => ({
      ...prev,
      [orderId]: newInputs
    }));
  };

  // Handle executing an order
  const handleExecuteOrder = async (order: any) => {
    const orderId = order.orderDetailsWithId.orderId.toString();
    
    if (!isWalletConnected) {
      setExecuteErrors(prev => ({
        ...prev,
        [orderId]: 'Please connect your wallet to execute orders'
      }));
      return;
    }

    const currentInputs = offerInputs[orderId];
    if (!currentInputs) {
      setExecuteErrors(prev => ({
        ...prev,
        [orderId]: 'Please enter amounts for the tokens you want to buy'
      }));
      return;
    }

    // Validate that at least one input has a value
    const hasValidInput = Object.values(currentInputs).some(value => 
      value && parseFloat(removeCommas(value)) > 0
    );

    if (!hasValidInput) {
      setExecuteErrors(prev => ({
        ...prev,
        [orderId]: 'Please enter amounts for the tokens you want to buy'
      }));
      return;
    }

    setExecuteErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[orderId];
      return newErrors;
    });
    setTransactionPending(true);

    try {
      // For now, we'll execute with the first token that has an input
      // In a real implementation, you might want to handle multiple tokens
      const buyTokensIndex = order.orderDetailsWithId.orderDetails.buyTokensIndex;
      const buyAmounts = order.orderDetailsWithId.orderDetails.buyAmounts;
      
      let tokenIndexToExecute = -1;
      let buyAmount = BigInt(0);
      
      let buyTokenInfo = null;
      
      for (let i = 0; i < buyTokensIndex.length; i++) {
        const tokenInfo = getTokenInfoByIndex(Number(buyTokensIndex[i]));
        if (tokenInfo.address && currentInputs[tokenInfo.address]) {
          const inputAmount = parseFloat(removeCommas(currentInputs[tokenInfo.address]));
          if (inputAmount > 0) {
            tokenIndexToExecute = i;
            buyTokenInfo = tokenInfo;
            buyAmount = parseTokenAmount(inputAmount.toString(), tokenInfo.decimals);
            break;
          }
        }
      }

      if (tokenIndexToExecute === -1) {
        throw new Error('No valid token amount found');
      }

      // Check if the buy token is native PLS and send value accordingly
      const value = isNativeToken(buyTokenInfo.address) ? buyAmount : undefined;

      // For ERC20 tokens, check if we need to approve first
      if (!isNativeToken(buyTokenInfo.address)) {
        
        // Check current allowance
        const allowance = await publicClient.readContract({
          address: buyTokenInfo.address as `0x${string}`,
          abi: [
            {
              "inputs": [
                {"name": "owner", "type": "address"},
                {"name": "spender", "type": "address"}
              ],
              "name": "allowance",
              "outputs": [{"name": "", "type": "uint256"}],
              "stateMutability": "view",
              "type": "function"
            }
          ],
          functionName: 'allowance',
          args: [address as `0x${string}`, OTC_CONTRACT_ADDRESS as `0x${string}`]
        });


        // If allowance is insufficient, approve the token
        if (allowance < buyAmount) {
          
          // Set approving state
          setApprovingOrders(prev => new Set(prev).add(orderId));
          
          if (!walletClient) {
            throw new Error('Wallet client not available');
          }
          
          const approveTxHash = await walletClient.writeContract({
            address: buyTokenInfo.address as `0x${string}`,
            abi: [
              {
                "inputs": [
                  {"name": "spender", "type": "address"},
                  {"name": "amount", "type": "uint256"}
                ],
                "name": "approve",
                "outputs": [{"name": "", "type": "bool"}],
                "stateMutability": "nonpayable",
                "type": "function"
              }
            ],
            functionName: 'approve',
            args: [OTC_CONTRACT_ADDRESS as `0x${string}`, buyAmount]
          });

          
          // Wait for approval confirmation with proper timeout handling
          await waitForTransactionWithTimeout(
            publicClient,
            approveTxHash,
            TRANSACTION_TIMEOUTS.APPROVAL
          );
          
          
          // Clear approving state
          setApprovingOrders(prev => {
            const newSet = new Set(prev);
            newSet.delete(orderId);
            return newSet;
          });
        }
      }

      // Set executing state before execution
      setExecutingOrders(prev => new Set(prev).add(orderId));

      // Execute/Fill the order (works for both Bistro and AgoraX)
      const txHash = await fillOrExecuteOrder(
        BigInt(orderId),
        BigInt(tokenIndexToExecute),
        buyAmount,
        value
      );

      
      // Wait for transaction confirmation with proper timeout handling
      const receipt = await waitForTransactionWithTimeout(
        publicClient,
        txHash as `0x${string}`,
        TRANSACTION_TIMEOUTS.TRANSACTION
      );
      
      
      // Show success toast only after confirmation
      toast({
        title: "Order Fulfilled!",
        description: "You have successfully completed this trade.",
        variant: "success",
        action: (
          <ToastAction
            altText="View transaction"
            onClick={() => window.open(`https://otter.pulsechain.com/tx/${txHash}`, '_blank')}
          >
            View TX
          </ToastAction>
        ),
      });
      
      // Clear the inputs for this order
      handleClearInputs(order);
      
      // Determine if this is a MAXI deal
      const sellTokenAddress = order.orderDetailsWithId.orderDetails.sellToken;
      const isMaxiDeal = maxiTokenAddresses.some(addr => 
        addr.toLowerCase() === sellTokenAddress.toLowerCase()
      ) || order.orderDetailsWithId.orderDetails.buyTokensIndex.some((tokenIndex: bigint) => {
        const tokenInfo = getTokenInfoByIndex(Number(tokenIndex));
        return maxiTokenAddresses.some(addr => 
          addr.toLowerCase() === tokenInfo.address.toLowerCase()
        );
      });
      
      // Navigate to "My Deals" > "Order History" to show the fulfilled order
      setTokenFilter(isMaxiDeal ? 'maxi' : 'non-maxi');
      setOwnershipFilter('mine');
      setStatusFilter('order-history');
      setExpandedPositions(new Set());
      
      // Refresh the orders and purchase history to show updated amounts
      refetch();
      fetchPurchaseHistory();
      
    } catch (error: any) {
      setExecuteErrors(prev => ({
        ...prev,
        [orderId]: simplifyErrorMessage(error) || 'Failed to execute order. Please try again.'
      }));
    } finally {
      setExecutingOrders(prev => {
        const newSet = new Set(prev);
        newSet.delete(orderId);
        return newSet;
      });
      setApprovingOrders(prev => {
        const newSet = new Set(prev);
        newSet.delete(orderId);
        return newSet;
      });
      setTransactionPending(false);
    }
  };

  const handleCancelOrder = async (order: any) => {
    const orderId = order.orderDetailsWithId.orderId.toString();
    
    
    if (cancelingOrders.has(orderId)) {
      return;
    }
    
    setCancelingOrders(prev => new Set(prev).add(orderId));
    setCancelErrors(prev => ({ ...prev, [orderId]: '' }));
    setTransactionPending(true);
    
    try {
      const txHash = await cancelOrder(order.orderDetailsWithId.orderId);
      
      
      // Wait for transaction confirmation with proper timeout handling
      const receipt = await waitForTransactionWithTimeout(
        publicClient,
        txHash as `0x${string}`,
        TRANSACTION_TIMEOUTS.TRANSACTION
      );
      
      
      // Show success toast only after confirmation
      toast({
        title: "Order Cancelled!",
        description: "Your order has been cancelled and tokens returned.",
        variant: "success",
        action: (
          <ToastAction
            altText="View transaction"
            onClick={() => window.open(`https://otter.pulsechain.com/tx/${txHash}`, '_blank')}
          >
            View TX
          </ToastAction>
        ),
      });
      
      // Determine if this is a MAXI deal
      const sellTokenAddress = order.orderDetailsWithId.orderDetails.sellToken;
      const isMaxiDeal = maxiTokenAddresses.some(addr => 
        addr.toLowerCase() === sellTokenAddress.toLowerCase()
      ) || order.orderDetailsWithId.orderDetails.buyTokensIndex.some((tokenIndex: bigint) => {
        const tokenInfo = getTokenInfoByIndex(Number(tokenIndex));
        return maxiTokenAddresses.some(addr => 
          addr.toLowerCase() === tokenInfo.address.toLowerCase()
        );
      });
      
      // Navigate to "My Deals" > "Cancelled" to show the cancelled order
      setTokenFilter(isMaxiDeal ? 'maxi' : 'non-maxi');
      setOwnershipFilter('mine');
      setStatusFilter('cancelled');
      setExpandedPositions(new Set());
      
      // Refresh the orders to show updated status
      refetch();
      
      // Clear any previous errors
      setCancelErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[orderId];
        return newErrors;
      });
      
    } catch (error: any) {
      setCancelErrors(prev => ({ 
        ...prev, 
        [orderId]: simplifyErrorMessage(error) || 'Failed to cancel order' 
      }));
    } finally {
      setCancelingOrders(prev => {
        const newSet = new Set(prev);
        newSet.delete(orderId);
        return newSet;
      });
      setTransactionPending(false);
    }
  };

  const handleEditOrder = (order: any) => {
    const orderId = order.orderDetailsWithId.orderId.toString();
    setEditingOrder(orderId);
    
    // Initialize form data with current order values
    const sellTokenInfo = getTokenInfo(order.orderDetailsWithId.orderDetails.sellToken);
    const sellAmount = formatTokenAmount(
      order.orderDetailsWithId.orderDetails.sellAmount,
      sellTokenInfo.decimals
    );
    
    const buyAmounts: {[tokenIndex: string]: string} = {};
    order.orderDetailsWithId.orderDetails.buyTokensIndex.forEach((tokenIndex: bigint, i: number) => {
      const tokenInfo = getTokenInfoByIndex(Number(tokenIndex));
      const amount = formatTokenAmount(
        order.orderDetailsWithId.orderDetails.buyAmounts[i],
        tokenInfo.decimals
      );
      buyAmounts[tokenIndex.toString()] = amount;
    });
    
    const expirationDate = new Date(order.orderDetailsWithId.orderDetails.expirationTime * 1000);
    const expirationTime = expirationDate.toISOString().slice(0, 16); // YYYY-MM-DDTHH:MM format
    
    setEditFormData({
      sellAmount,
      buyAmounts,
      expirationTime
    });
  };

  const handleSaveOrder = async (order: any) => {
    const orderId = order.orderDetailsWithId.orderId.toString();
    
    if (updatingOrders.has(orderId)) return;
    
    setUpdatingOrders(prev => new Set(prev).add(orderId));
    setUpdateErrors(prev => ({ ...prev, [orderId]: '' }));
    setTransactionPending(true);
    
    try {
      // Update order info (sell amount, buy tokens, amounts)
      const sellTokenInfo = getTokenInfo(order.orderDetailsWithId.orderDetails.sellToken);
      const newSellAmount = parseTokenAmount(editFormData.sellAmount, sellTokenInfo.decimals);
      
      const newBuyTokensIndex: bigint[] = [];
      const newBuyAmounts: bigint[] = [];
      
      Object.entries(editFormData.buyAmounts).forEach(([tokenIndex, amount]) => {
        if (amount && parseFloat(amount) > 0) {
          const tokenInfo = getTokenInfoByIndex(Number(tokenIndex));
          newBuyTokensIndex.push(BigInt(tokenIndex));
          newBuyAmounts.push(parseTokenAmount(amount, tokenInfo.decimals));
        }
      });
      
      const txHash1 = await updateOrderInfo(
        order.orderDetailsWithId.orderId,
        newSellAmount,
        newBuyTokensIndex,
        newBuyAmounts
      );
      
      
      // Update expiration time
      const newExpirationTime = Math.floor(new Date(editFormData.expirationTime).getTime() / 1000);
      const txHash2 = await updateOrderExpirationTime(
        order.orderDetailsWithId.orderId,
        BigInt(newExpirationTime)
      );
      
      
      // Wait for both transactions to be confirmed with proper timeout handling
      const [receipt1, receipt2] = await Promise.all([
        waitForTransactionWithTimeout(
          publicClient,
          txHash1 as `0x${string}`,
          TRANSACTION_TIMEOUTS.TRANSACTION
        ),
        waitForTransactionWithTimeout(
          publicClient,
          txHash2 as `0x${string}`,
          TRANSACTION_TIMEOUTS.TRANSACTION
        )
      ]);
      
      
      // Show success toast only after both transactions are confirmed
      toast({
        title: "Order Updated!",
        description: "Your order details have been successfully updated.",
        variant: "success",
        action: (
          <ToastAction
            altText="View transaction"
            onClick={() => window.open(`https://otter.pulsechain.com/tx/${txHash1}`, '_blank')}
          >
            View TX
          </ToastAction>
        ),
      });
      
      // Navigate to "My Deals" > "Active" to show the updated order
      setTokenFilter('maxi');
      setOwnershipFilter('mine');
      setStatusFilter('active');
      setExpandedPositions(new Set());
      
      // Refresh the orders to show updated details
      refetch();
      
      // Clear form and close edit mode
      setEditingOrder(null);
      setEditFormData({ sellAmount: '', buyAmounts: {}, expirationTime: '' });
      
      // Clear any previous errors
      setUpdateErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[orderId];
        return newErrors;
      });
      
    } catch (error: any) {
      setUpdateErrors(prev => ({ 
        ...prev, 
        [orderId]: simplifyErrorMessage(error) || 'Failed to update order' 
      }));
    } finally {
      setUpdatingOrders(prev => {
        const newSet = new Set(prev);
        newSet.delete(orderId);
        return newSet;
      });
      setTransactionPending(false);
    }
  };

  // Memoize the display orders with 3-level filtering
  const displayOrders = useMemo(() => {
    if (!allOrders) return [];
    
    // Filter orders (positions only - no order history)
    let orders = allOrders;
    
    // Level 1: Filter by token type (MAXI vs Non-MAXI)
    if (tokenFilter === 'maxi') {
      orders = orders.filter(order => {
          const sellToken = order.orderDetailsWithId.orderDetails.sellToken.toLowerCase();
          
          // Check if sell token is in MAXI tokens
          const sellTokenInList = maxiTokenAddresses.some(addr => 
            sellToken === addr.toLowerCase()
          );
          
          // Check if any buy token is in MAXI tokens
          const buyTokensInList = order.orderDetailsWithId.orderDetails.buyTokensIndex.some(buyTokenIndex => {
            const buyTokenInfo = getTokenInfoByIndex(Number(buyTokenIndex));
            const buyTokenAddress = buyTokenInfo.address?.toLowerCase() || '';
            return maxiTokenAddresses.some(addr => 
              buyTokenAddress === addr.toLowerCase()
            );
          });
          
          return sellTokenInList || buyTokensInList;
        });
    } else if (tokenFilter === 'non-maxi') {
      orders = orders.filter(order => {
        const sellToken = order.orderDetailsWithId.orderDetails.sellToken.toLowerCase();
        
        // Check if sell token is NOT in MAXI tokens
        const sellTokenInList = maxiTokenAddresses.some(addr => 
          sellToken === addr.toLowerCase()
        );
        
        // Check if any buy token is NOT in MAXI tokens
        const buyTokensInList = order.orderDetailsWithId.orderDetails.buyTokensIndex.some(buyTokenIndex => {
          const buyTokenInfo = getTokenInfoByIndex(Number(buyTokenIndex));
          const buyTokenAddress = buyTokenInfo.address?.toLowerCase() || '';
          return maxiTokenAddresses.some(addr => 
            buyTokenAddress === addr.toLowerCase()
          );
        });
        
        return !(sellTokenInList || buyTokensInList);
      });
    }
    
    // Level 2: Filter by ownership (Mine vs Non-Mine vs Order History)
    if (ownershipFilter === 'mine') {
      orders = orders.filter(order => 
        address && order.userDetails.orderOwner.toLowerCase() === address.toLowerCase()
      );
    } else if (ownershipFilter === 'non-mine') {
      orders = orders.filter(order => 
        !address || order.userDetails.orderOwner.toLowerCase() !== address.toLowerCase()
      );
    }
    
    // Level 3: Filter by status
    let filteredOrders = [];
    switch (statusFilter) {
      case 'active':
          filteredOrders = orders.filter(order => 
            order.orderDetailsWithId.status === 0 && 
            Number(order.orderDetailsWithId.orderDetails.expirationTime) >= Math.floor(Date.now() / 1000)
          );
        break;
      case 'completed':
        filteredOrders = orders.filter(order => 
          order.orderDetailsWithId.status === 2
        );
        break;
        case 'inactive':
          filteredOrders = orders.filter(order => 
            order.orderDetailsWithId.status === 0 && 
            Number(order.orderDetailsWithId.orderDetails.expirationTime) < Math.floor(Date.now() / 1000)
          );
        break;
      case 'cancelled':
        filteredOrders = orders.filter(order => 
          order.orderDetailsWithId.status === 1
        );
        break;
      default:
        filteredOrders = orders;
    }

    // Level 4: Filter by search query (ticker names)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filteredOrders = filteredOrders.filter(order => {
        // Get sell token info
        const sellTokenInfo = getTokenInfo(order.orderDetailsWithId.orderDetails.sellToken);
        const sellTicker = sellTokenInfo.ticker.toLowerCase();
        
        // Get buy token info(s)
        const buyTokensMatch = order.orderDetailsWithId.orderDetails.buyTokensIndex.some(tokenIndex => {
          const buyTokenInfo = getTokenInfoByIndex(Number(tokenIndex));
          const buyTicker = buyTokenInfo.ticker.toLowerCase();
          return buyTicker.includes(query);
        });
        
        // Return true if either sell or buy token matches
        return sellTicker.includes(query) || buyTokensMatch;
      });
    }
    
    // Apply sorting
    const sortedOrders = [...filteredOrders].sort((a, b) => {
      let comparison = 0;
      
      switch (sortField) {
        case 'sellAmount':
          const aSellTokenAddress = a.orderDetailsWithId.orderDetails.sellToken;
          const bSellTokenAddress = b.orderDetailsWithId.orderDetails.sellToken;
          const aSellTokenInfo = getTokenInfo(aSellTokenAddress);
          const bSellTokenInfo = getTokenInfo(bSellTokenAddress);
          const aTokenAmount = parseFloat(formatTokenAmount(a.orderDetailsWithId.orderDetails.sellAmount, aSellTokenInfo.decimals));
          const bTokenAmount = parseFloat(formatTokenAmount(b.orderDetailsWithId.orderDetails.sellAmount, bSellTokenInfo.decimals));
          const aTokenPrice = getTokenPrice(aSellTokenAddress, tokenPrices);
          const bTokenPrice = getTokenPrice(bSellTokenAddress, tokenPrices);
          const aUsdValue = aTokenAmount * aTokenPrice;
          const bUsdValue = bTokenAmount * bTokenPrice;
          comparison = aUsdValue - bUsdValue;
          break;
        case 'askingFor':
          const aAsking = a.orderDetailsWithId.orderDetails.buyTokensIndex.length;
          const bAsking = b.orderDetailsWithId.orderDetails.buyTokensIndex.length;
          comparison = aAsking - bAsking;
          break;
        case 'progress':
          const aProgress = 100 - ((Number(getRemainingPercentage(a.orderDetailsWithId)) / 1e18) * 100);
          const bProgress = 100 - ((Number(getRemainingPercentage(b.orderDetailsWithId)) / 1e18) * 100);
          comparison = aProgress - bProgress;
          break;
        case 'owner':
          comparison = a.userDetails.orderOwner.localeCompare(b.userDetails.orderOwner);
          break;
        case 'status':
          comparison = a.orderDetailsWithId.status - b.orderDetailsWithId.status;
          break;
        case 'date':
          comparison = Number(a.orderDetailsWithId.orderDetails.expirationTime) - Number(b.orderDetailsWithId.orderDetails.expirationTime);
          break;
        case 'backingPrice':
          const aBackingPrice = (() => {
            const sellTokenInfo = getTokenInfo(a.orderDetailsWithId.orderDetails.sellToken);
            const sellTokenKey = sellTokenInfo.ticker.startsWith('e') ? `e${sellTokenInfo.ticker.slice(1)}` : `p${sellTokenInfo.ticker}`;
            const sellTokenStat = Array.isArray(tokenStats) ? tokenStats.find(stat => stat.token.ticker === sellTokenKey) : null;
            return sellTokenStat?.token?.backingPerToken || 0;
          })();
          const bBackingPrice = (() => {
            const sellTokenInfo = getTokenInfo(b.orderDetailsWithId.orderDetails.sellToken);
            const sellTokenKey = sellTokenInfo.ticker.startsWith('e') ? `e${sellTokenInfo.ticker.slice(1)}` : `p${sellTokenInfo.ticker}`;
            const sellTokenStat = Array.isArray(tokenStats) ? tokenStats.find(stat => stat.token.ticker === sellTokenKey) : null;
            return sellTokenStat?.token?.backingPerToken || 0;
          })();
          comparison = aBackingPrice - bBackingPrice;
          break;
        case 'currentPrice':
          const aCurrentPrice = (() => {
            const sellTokenInfo = getTokenInfo(a.orderDetailsWithId.orderDetails.sellToken);
            const sellTokenKey = sellTokenInfo.ticker.startsWith('e') ? `e${sellTokenInfo.ticker.slice(1)}` : `p${sellTokenInfo.ticker}`;
            const sellTokenStat = Array.isArray(tokenStats) ? tokenStats.find(stat => stat.token.ticker === sellTokenKey) : null;
            return sellTokenStat?.token?.priceHEX || 0;
          })();
          const bCurrentPrice = (() => {
            const sellTokenInfo = getTokenInfo(b.orderDetailsWithId.orderDetails.sellToken);
            const sellTokenKey = sellTokenInfo.ticker.startsWith('e') ? `e${sellTokenInfo.ticker.slice(1)}` : `p${sellTokenInfo.ticker}`;
            const sellTokenStat = Array.isArray(tokenStats) ? tokenStats.find(stat => stat.token.ticker === sellTokenKey) : null;
            return sellTokenStat?.token?.priceHEX || 0;
          })();
          comparison = aCurrentPrice - bCurrentPrice;
          break;
        case 'otcVsMarket':
          // Calculate OTC vs Market percentage for order A
          const aOtcPercentage = (() => {
            const sellTokenAddress = a.orderDetailsWithId.orderDetails.sellToken;
            const sellTokenInfo = getTokenInfo(sellTokenAddress);
            const rawRemainingPercentage = getRemainingPercentage(a.orderDetailsWithId);
            const remainingPercentage = Number(rawRemainingPercentage) / 1e18;
            const originalSellAmount = a.orderDetailsWithId.orderDetails.sellAmount;
            const isCompletedOrCancelled = a.orderDetailsWithId.status === 2 || a.orderDetailsWithId.status === 1;
            const sellAmountToUse = isCompletedOrCancelled 
              ? originalSellAmount 
              : (originalSellAmount * BigInt(Math.floor(remainingPercentage * 1e18))) / BigInt(1e18);
            const sellTokenAmount = parseFloat(formatTokenAmount(sellAmountToUse, sellTokenInfo.decimals));
            const sellTokenPrice = getTokenPrice(sellTokenAddress, tokenPrices);
            const sellUsdValue = sellTokenAmount * sellTokenPrice;
            
            // Calculate minimum asking USD value
            let askingUsdValue = 0;
            const buyTokensIndex = a.orderDetailsWithId.orderDetails.buyTokensIndex;
            const buyAmounts = a.orderDetailsWithId.orderDetails.buyAmounts;
            
            if (buyTokensIndex && buyAmounts && Array.isArray(buyTokensIndex) && Array.isArray(buyAmounts)) {
              const tokenValues: number[] = [];
              buyTokensIndex.forEach((tokenIndex: bigint, idx: number) => {
                const tokenInfo = getTokenInfoByIndex(Number(tokenIndex));
                const originalAmount = buyAmounts[idx];
                const buyAmountToUse = isCompletedOrCancelled
                  ? originalAmount
                  : (originalAmount * BigInt(Math.floor(remainingPercentage * 1e18))) / BigInt(1e18);
                const tokenAmount = parseFloat(formatTokenAmount(buyAmountToUse, tokenInfo.decimals));
                const tokenPrice = getTokenPrice(tokenInfo.address, tokenPrices);
                const usdValue = tokenAmount * tokenPrice;
                tokenValues.push(usdValue);
              });
              askingUsdValue = tokenValues.length > 0 ? Math.min(...tokenValues) : 0;
            }
            
            if (sellUsdValue > 0 && askingUsdValue > 0) {
              return ((sellUsdValue - askingUsdValue) / sellUsdValue) * 100;
            }
            return -Infinity; // Orders without percentage go to the end
          })();
          
          // Calculate OTC vs Market percentage for order B
          const bOtcPercentage = (() => {
            const sellTokenAddress = b.orderDetailsWithId.orderDetails.sellToken;
            const sellTokenInfo = getTokenInfo(sellTokenAddress);
            const rawRemainingPercentage = getRemainingPercentage(b.orderDetailsWithId);
            const remainingPercentage = Number(rawRemainingPercentage) / 1e18;
            const originalSellAmount = b.orderDetailsWithId.orderDetails.sellAmount;
            const isCompletedOrCancelled = b.orderDetailsWithId.status === 2 || b.orderDetailsWithId.status === 1;
            const sellAmountToUse = isCompletedOrCancelled 
              ? originalSellAmount 
              : (originalSellAmount * BigInt(Math.floor(remainingPercentage * 1e18))) / BigInt(1e18);
            const sellTokenAmount = parseFloat(formatTokenAmount(sellAmountToUse, sellTokenInfo.decimals));
            const sellTokenPrice = getTokenPrice(sellTokenAddress, tokenPrices);
            const sellUsdValue = sellTokenAmount * sellTokenPrice;
            
            // Calculate minimum asking USD value
            let askingUsdValue = 0;
            const buyTokensIndex = b.orderDetailsWithId.orderDetails.buyTokensIndex;
            const buyAmounts = b.orderDetailsWithId.orderDetails.buyAmounts;
            
            if (buyTokensIndex && buyAmounts && Array.isArray(buyTokensIndex) && Array.isArray(buyAmounts)) {
              const tokenValues: number[] = [];
              buyTokensIndex.forEach((tokenIndex: bigint, idx: number) => {
                const tokenInfo = getTokenInfoByIndex(Number(tokenIndex));
                const originalAmount = buyAmounts[idx];
                const buyAmountToUse = isCompletedOrCancelled
                  ? originalAmount
                  : (originalAmount * BigInt(Math.floor(remainingPercentage * 1e18))) / BigInt(1e18);
                const tokenAmount = parseFloat(formatTokenAmount(buyAmountToUse, tokenInfo.decimals));
                const tokenPrice = getTokenPrice(tokenInfo.address, tokenPrices);
                const usdValue = tokenAmount * tokenPrice;
                tokenValues.push(usdValue);
              });
              askingUsdValue = tokenValues.length > 0 ? Math.min(...tokenValues) : 0;
            }
            
            if (sellUsdValue > 0 && askingUsdValue > 0) {
              return ((sellUsdValue - askingUsdValue) / sellUsdValue) * 100;
            }
            return -Infinity; // Orders without percentage go to the end
          })();
          
          comparison = aOtcPercentage - bOtcPercentage;
          break;
      }
      
      return sortDirection === 'asc' ? comparison : -comparison;
    });
    
    return sortedOrders;
  }, [allOrders, tokenFilter, ownershipFilter, statusFilter, searchQuery, sortField, sortDirection, tokenPrices, tokenStats, address, purchasedOrderIds, purchaseTransactions]);

  // Helper functions
  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    const day = date.getDate();
    const month = date.toLocaleDateString('en-US', { month: 'short' });
    const year = date.getFullYear().toString().slice(-2);
    return `${day} ${month} ${year}`;
  };

  const formatPercentage = (percentage: number) => {
    // If it's a whole number (no decimals), don't show decimals
    if (percentage % 1 === 0) {
      return `${percentage}%`;
    }
    // Otherwise, round to 1 decimal place
    return `${percentage.toFixed(1)}%`;
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
      default: return 'text-gray-400';
    }
  };

  // Helper functions for cascading filter counts
  const getLevel1Orders = (tokenType: 'maxi' | 'non-maxi') => {
    // Use allOrders directly (order history is handled separately)
    const cleanOrders = allOrders;
    
    if (tokenType === 'maxi') {
        return cleanOrders.filter(order => {
          const sellToken = order.orderDetailsWithId.orderDetails.sellToken.toLowerCase();
          const sellTokenInList = maxiTokenAddresses.some(addr => 
            sellToken === addr.toLowerCase()
          );
          const buyTokensInList = order.orderDetailsWithId.orderDetails.buyTokensIndex.some(buyTokenIndex => {
            const buyTokenInfo = getTokenInfoByIndex(Number(buyTokenIndex));
            const buyTokenAddress = buyTokenInfo.address?.toLowerCase() || '';
            return maxiTokenAddresses.some(addr => 
              buyTokenAddress === addr.toLowerCase()
            );
          });
          return sellTokenInList || buyTokensInList;
        });
    } else {
      return cleanOrders.filter(order => {
        const sellToken = order.orderDetailsWithId.orderDetails.sellToken.toLowerCase();
        const sellTokenInList = maxiTokenAddresses.some(addr => 
          sellToken === addr.toLowerCase()
        );
        const buyTokensInList = order.orderDetailsWithId.orderDetails.buyTokensIndex.some(buyTokenIndex => {
          const buyTokenInfo = getTokenInfoByIndex(Number(buyTokenIndex));
          const buyTokenAddress = buyTokenInfo.address?.toLowerCase() || '';
          return maxiTokenAddresses.some(addr => 
            buyTokenAddress === addr.toLowerCase()
          );
        });
        return !(sellTokenInList || buyTokensInList);
      });
    }
  };

  const getLevel2Orders = (tokenType: 'maxi' | 'non-maxi', ownership: 'mine' | 'non-mine') => {
    const level1Orders = getLevel1Orders(tokenType);
    if (ownership === 'mine') {
      return level1Orders.filter(order => 
        address && order.userDetails.orderOwner.toLowerCase() === address.toLowerCase()
      );
    } else {
      return level1Orders.filter(order => 
        !address || order.userDetails.orderOwner.toLowerCase() !== address.toLowerCase()
      );
    }
  };

  const getLevel3Orders = (tokenType: 'maxi' | 'non-maxi', ownership: 'mine' | 'non-mine', status: 'active' | 'completed' | 'inactive' | 'cancelled' | 'order-history') => {
    const level2Orders = getLevel2Orders(tokenType, ownership);
    switch (status) {
      case 'active':
        return level2Orders.filter(order => 
          order.orderDetailsWithId.status === 0 && 
          Number(order.orderDetailsWithId.orderDetails.expirationTime) >= Math.floor(Date.now() / 1000)
        );
      case 'completed':
        return level2Orders.filter(order => order.orderDetailsWithId.status === 2);
      case 'inactive':
        return level2Orders.filter(order => 
          order.orderDetailsWithId.status === 0 && 
          Number(order.orderDetailsWithId.orderDetails.expirationTime) < Math.floor(Date.now() / 1000)
        );
      case 'cancelled':
        return level2Orders.filter(order => order.orderDetailsWithId.status === 1);
      case 'order-history':
        // For order history, count transactions (not unique orders) with token filter applied
        if (ownership === 'mine') {
          const filteredTransactions = purchaseTransactions.filter(transaction => {
            const baseOrder = allOrders.find(order => 
              order.orderDetailsWithId.orderId.toString() === transaction.orderId
            );
            if (!baseOrder) return false;
            
            // Apply token filter
            if (tokenType === 'maxi') {
              const sellToken = baseOrder.orderDetailsWithId.orderDetails.sellToken.toLowerCase();
              const sellTokenInList = maxiTokenAddresses.some(addr => sellToken === addr.toLowerCase());
              const buyTokensInList = baseOrder.orderDetailsWithId.orderDetails.buyTokensIndex.some((buyTokenIndex: bigint) => {
                const buyTokenInfo = getTokenInfoByIndex(Number(buyTokenIndex));
                const buyTokenAddress = buyTokenInfo?.address?.toLowerCase() || '';
                return maxiTokenAddresses.some(addr => buyTokenAddress === addr.toLowerCase());
              });
              return sellTokenInList || buyTokensInList;
            } else if (tokenType === 'non-maxi') {
              const sellToken = baseOrder.orderDetailsWithId.orderDetails.sellToken.toLowerCase();
              const sellTokenInList = maxiTokenAddresses.some(addr => sellToken === addr.toLowerCase());
              const buyTokensInList = baseOrder.orderDetailsWithId.orderDetails.buyTokensIndex.some((buyTokenIndex: bigint) => {
                const buyTokenInfo = getTokenInfoByIndex(Number(buyTokenIndex));
                const buyTokenAddress = buyTokenInfo?.address?.toLowerCase() || '';
                return maxiTokenAddresses.some(addr => buyTokenAddress === addr.toLowerCase());
              });
              return !(sellTokenInList || buyTokensInList);
            }
            return true;
          });
          return filteredTransactions.length;
        }
        return 0 as any; // Return 0 but typed as any to match array return type for other cases
      default:
        return level2Orders;
    }
  };

  // Separate count for MAXI tokens (always calculated independently)
  const maxiTokenOrders = useMemo(() => {
    return allOrders.filter(order => {
      const sellTokenAddress = order.orderDetailsWithId.orderDetails.sellToken;
      const sellTokenInfo = getTokenInfo(sellTokenAddress);
      return sellTokenInfo.isMaxiToken;
    });
  }, [allOrders]);

  // Loading state - only for initial load
  if (!mounted || isTableLoading) {
    return (
      <div className="bg-black text-white relative overflow-hidden">
        <div className="max-w-[1000px] mx-auto w-full relative">
          <div 
            className="bg-black border-0 border-white/10 rounded-full p-6 text-center max-w-[660px] w-full mx-auto"
          >
            <div className="flex items-center justify-center gap-3 text-gray-400 text-base md:text-lg">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Loading data</span>
            </div>
          </div>
        </div>
      </div>
    );
  }


  if (error) {
    return (
      <div className="w-full max-w-6xl mx-auto mb-8 mt-8">
        <div className="bg-white/5 p-6 rounded-lg border-2 border-white/10">
          <h2 className="text-xl font-bold mb-4">AgoráX Contract Information</h2>
          <div className="text-red-500">
            <p className="font-semibold mb-2">Unable to connect to the AgoráX Bistro contract</p>
            <p className="text-sm mb-2">Error: {error.message}</p>
            <p className="text-sm text-gray-400 mb-2">
              Contract Address: {OTC_CONTRACT_ADDRESS || 'Not deployed on this chain'}
            </p>
            <p className="text-sm text-gray-400 mb-3">
              RPC Endpoint: https://rpc.pulsechain.com
            </p>
            <p className="text-sm text-gray-400 mb-3">
              This could mean:
            </p>
            <ul className="text-sm text-gray-400 ml-4 mb-4">
              <li>• The contract is not deployed at the expected address</li>
              <li>• The contract is not properly initialized</li>
              <li>• There's a network connectivity issue</li>
              <li>• The RPC endpoint is not responding correctly</li>
              <li>• Check the browser console for detailed error messages</li>
            </ul>
            <button 
              onClick={() => window.location.reload()} 
              className="px-4 py-2 bg-white text-black rounded hover:bg-white/80"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }


  return (
    <div 
      className="w-full max-w-[1200px] mx-auto mb-8 mt-8"
    >
      {/* Level 1: Token Type Filter - Hidden (forced to MAXI) */}
      <div className="hidden">
        <button
          onClick={() => {
            setTokenFilter('maxi');
            clearExpandedPositions();
          }}
          className={`px-6 py-3 rounded-full transition-all duration-100 border ${
            tokenFilter === 'maxi'
              ? 'bg-purple-500/20 text-purple-400 border-purple-400'
              : 'bg-gray-800/50 text-gray-300 border-gray-600 hover:bg-gray-700/50'
          }`}
        >
          MAXI ({getLevel1Orders('maxi').length})
        </button>
        <button
          onClick={() => {
            setTokenFilter('non-maxi');
            clearExpandedPositions();
          }}
          className={`px-6 py-3 rounded-full transition-all duration-100 border ${
            tokenFilter === 'non-maxi'
              ? 'bg-blue-500/20 text-blue-400 border-blue-400'
              : 'bg-gray-800/50 text-gray-300 border-gray-600 hover:bg-gray-700/50'
          }`}
        >
          Non-MAXI ({getLevel1Orders('non-maxi').length})
        </button>
      </div>

      {/* Level 2: Ownership Filter */}
      <div className="flex justify-center sm:justify-start mb-4 w-full md:w-auto">
        <div className={`inline-flex items-center bg-black border rounded-full relative w-full md:w-auto ${
          ownershipFilter === 'mine' ? 'border-green-600' : 'border-orange-600'
        }`}>
          <button
            onClick={() => {
              setOwnershipFilter('mine');
              clearExpandedPositions();
            }}
            className={`flex-1 md:flex-none px-3 md:px-4 py-2 rounded-full text-sm md:text-base font-medium transition-colors duration-200 relative z-10 whitespace-nowrap ${
              ownershipFilter === 'mine'
                ? 'text-white'
                : 'text-orange-600 hover:text-orange-500'
            }`}
          >
            {ownershipFilter === 'mine' && (
              <motion.div
                layoutId="activeTab"
                className="absolute inset-0 rounded-full bg-green-600 shadow-sm"
                transition={{
                  type: "spring",
                  stiffness: 300,
                  damping: 30
                }}
                style={{ zIndex: -1 }}
              />
            )}
            My Deals ({getLevel2Orders(tokenFilter, 'mine').length})
          </button>
          <button
            onClick={() => {
              setOwnershipFilter('non-mine');
              // If currently on order-history, switch to active when going to marketplace
              if (statusFilter === 'order-history') {
                setStatusFilter('active');
              }
              clearExpandedPositions();
            }}
            className={`flex-1 md:flex-none px-3 md:px-4 py-2 rounded-full text-sm md:text-base font-medium transition-colors duration-200 relative z-10 whitespace-nowrap ${
              ownershipFilter === 'non-mine'
                ? 'text-white'
                : 'text-green-600 hover:text-green-500'
            }`}
          >
            {ownershipFilter === 'non-mine' && (
              <motion.div
                layoutId="activeTab"
                className="absolute inset-0 rounded-full bg-orange-600 shadow-sm"
                transition={{
                  type: "spring",
                  stiffness: 300,
                  damping: 30
                }}
                style={{ zIndex: -1 }}
              />
            )}
            Marketplace ({getLevel2Orders(tokenFilter, 'non-mine').length})
          </button>
        </div>
      </div>

      {/* Level 3: Status Filter */}
        <div className="flex flex-wrap justify-center sm:justify-start gap-3 mb-6">
        <button
          onClick={() => {
            setStatusFilter('active');
            clearExpandedPositions();
          }}
          className={`px-3 md:px-4 py-2 rounded-full transition-all duration-100 border whitespace-nowrap text-sm md:text-base ${
            statusFilter === 'active'
              ? 'bg-green-500/20 text-green-400 border-green-400'
              : 'bg-gray-800/50 text-gray-300 border-gray-600 hover:bg-gray-700/50'
          }`}
        >
          Active ({getLevel3Orders(tokenFilter, ownershipFilter, 'active').length})
        </button>
        <button
          onClick={() => {
            setStatusFilter('completed');
            clearExpandedPositions();
          }}
          className={`px-3 md:px-4 py-2 rounded-full transition-all duration-100 border whitespace-nowrap text-sm md:text-base ${
            statusFilter === 'completed'
              ? 'bg-blue-500/20 text-blue-400 border-blue-400'
              : 'bg-gray-800/50 text-gray-300 border-gray-600 hover:bg-gray-700/50'
          }`}
        >
          Completed ({getLevel3Orders(tokenFilter, ownershipFilter, 'completed').length})
        </button>
        <button
          onClick={() => {
            setStatusFilter('inactive');
            clearExpandedPositions();
          }}
          className={`px-3 md:px-4 py-2 rounded-full transition-all duration-100 border whitespace-nowrap text-sm md:text-base ${
            statusFilter === 'inactive'
              ? 'bg-yellow-500/20 text-yellow-400 border-yellow-400'
              : 'bg-gray-800/50 text-gray-300 border-gray-600 hover:bg-gray-700/50'
          }`}
        >
          Inactive ({getLevel3Orders(tokenFilter, ownershipFilter, 'inactive').length})
        </button>
        <button
          onClick={() => {
            setStatusFilter('cancelled');
            clearExpandedPositions();
          }}
          className={`px-3 md:px-4 py-2 rounded-full transition-all duration-100 border whitespace-nowrap text-sm md:text-base ${
            statusFilter === 'cancelled'
              ? 'bg-red-500/20 text-red-400 border-red-400'
              : 'bg-gray-800/50 text-gray-300 border-gray-600 hover:bg-gray-700/50'
          }`}
        >
          Cancelled ({getLevel3Orders(tokenFilter, ownershipFilter, 'cancelled').length})
        </button>
        {ownershipFilter === 'mine' && (
          <button
            onClick={() => {
              setStatusFilter('order-history');
              clearExpandedPositions();
            }}
            className={`px-3 md:px-4 py-2 rounded-full transition-all duration-100 border whitespace-nowrap text-sm md:text-base ${
              statusFilter === 'order-history'
                ? 'bg-purple-500/20 text-purple-400 border-purple-400'
                : 'bg-gray-800/50 text-gray-300 border-gray-600 hover:bg-gray-700/50'
            }`}
          >
            Order History ({purchaseTransactions.length})
          </button>
        )}
        </div>

      {/* Search Bar */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-black border-2 border-white/10 rounded-full text-white placeholder-gray-500 focus:outline-none focus:border-white/10 focus:bg-black/10 transition-colors"
          />
        </div>
      </div>

      <div 
        className={`bg-black border-2 border-white/10 rounded-2xl p-6 transition-all duration-500 ease-out ${
          expandedPositions.size > 0 ? 'shadow-2xl shadow-white/10' : ''
        }`}
        style={{ 
          minHeight: '200px',
          width: '100%'
        }}
      >
        {/* Render separate OrderHistoryTable component for order history */}
        {statusFilter === 'order-history' ? (
          <div className="overflow-x-auto scrollbar-hide -mx-6 px-6">
            <OrderHistoryTable
              purchaseTransactions={purchaseTransactions}
              allOrders={allOrders || []}
              tokenFilter={tokenFilter}
              searchTerm={searchQuery}
              maxiTokenAddresses={maxiTokenAddresses}
              onNavigateToMarketplace={navigateToMarketplaceOrder}
            />
          </div>
        ) : (
          /* Horizontal scroll container with hidden scrollbar */
        <div className="overflow-x-auto scrollbar-hide -mx-6 px-6">
          {!displayOrders || displayOrders.length === 0 ? (
            <div className="text-center py-8">
                <p className="text-gray-400 mb-2">No {statusFilter} {ownershipFilter === 'mine' ? 'deals' : 'orders'} found</p>
            </div>
          ) : (
            <div className="w-full min-w-[800px] text-lg">
            {/* Table Header */}
            <div 
              className={`grid grid-cols-[minmax(120px,1fr)_minmax(120px,1fr)_minmax(80px,120px)_minmax(100px,140px)_minmax(100px,140px)_minmax(80px,120px)_minmax(80px,120px)_minmax(80px,120px)_auto] items-center gap-4 pb-4 border-b border-white/10 ${
                expandedPositions.size > 0 ? 'opacity-90' : 'opacity-100'
              }`}
            >
              {/* COLUMN 1: Token For Sale */}
              <button 
                onClick={() => handleSort('sellAmount')}
                className={`text-sm font-medium text-left hover:text-white transition-colors ${
                  sortField === 'sellAmount' ? 'text-white' : 'text-gray-400'
                }`}
              >
                            {statusFilter === 'completed' ? 'Sold' : 'For Sale'} {sortField === 'sellAmount' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
              </button>
              
              {/* COLUMN 2: Asking For */}
              <button 
                onClick={() => handleSort('askingFor')}
                className={`text-sm font-medium text-left hover:text-white transition-colors ${
                  sortField === 'askingFor' ? 'text-white' : 'text-gray-400'
                }`}
              >
                            {statusFilter === 'completed' ? 'Bought' : 'Asking For'} {sortField === 'askingFor' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
              </button>
              
              {/* COLUMN 3: Fill Status % */}
              <button 
                onClick={() => handleSort('progress')}
                className={`text-sm font-medium text-center hover:text-white transition-colors ${
                  sortField === 'progress' ? 'text-white' : 'text-gray-400'
                }`}
              >
                Fill Status % {sortField === 'progress' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
              </button>
              
              {/* COLUMN 4: OTC % */}
              <button 
                onClick={() => handleSort('otcVsMarket')}
                className={`text-sm font-medium text-center hover:text-white transition-colors ${
                  sortField === 'otcVsMarket' ? 'text-white' : 'text-gray-400'
                }`}
              >
                OTC vs Market Price {sortField === 'otcVsMarket' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
              </button>
              
              {/* COLUMN 5: Backing Price */}
              <button 
                onClick={() => handleSort('backingPrice')}
                className={`text-sm font-medium text-center hover:text-white transition-colors ${
                  sortField === 'backingPrice' ? 'text-white' : 'text-gray-400'
                }`}
              >
                OTC vs Backing Price{sortField === 'backingPrice' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
              </button>
              
              {/* COLUMN 6: Status */}
              <button 
                onClick={() => handleSort('status')}
                className={`text-sm font-medium text-center hover:text-white transition-colors ${
                  sortField === 'status' ? 'text-white' : 'text-gray-400'
                }`}
              >
                Status {sortField === 'status' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
              </button>
              
              {/* COLUMN 7: Expires */}
              <button 
                onClick={() => handleSort('date')}
                className={`text-sm font-medium text-center hover:text-white transition-colors ${
                  sortField === 'date' ? 'text-white' : 'text-gray-400'
                }`}
              >
                Expires {sortField === 'date' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
              </button>
              
              {/* COLUMN 8: Actions / Order ID */}
              <div className="text-sm font-medium text-center text-gray-400">
                {(statusFilter === 'inactive' || statusFilter === 'completed') ? 'Order ID' : ''}
            </div>
            </div>

            {/* Table Rows */}
                <div 
              className={`space-y-1 ${expandedPositions.size > 0 ? 'pt-0' : ''}`}
            >
              {displayOrders.map((order, index) => {
                const orderId = order.orderDetailsWithId.orderId.toString();
                const isExpanded = expandedPositions.has(orderId);
                const hasAnyExpanded = expandedPositions.size > 0;
                const shouldShow = !hasAnyExpanded || isExpanded;
                
                // Don't render at all if shouldn't show
                if (!shouldShow) return null;
                
                // Calculate USD values for percentage calculation
                const sellTokenAddress = order.orderDetailsWithId.orderDetails.sellToken;
                const sellTokenInfo = getTokenInfo(sellTokenAddress);
                const rawRemainingPercentage = getRemainingPercentage(order.orderDetailsWithId);
                const remainingPercentage = Number(rawRemainingPercentage) / 1e18;
                const originalSellAmount = order.orderDetailsWithId.orderDetails.sellAmount;
                
                // For completed/cancelled orders, use original amounts; for active, use remaining
                const isCompletedOrCancelled = order.orderDetailsWithId.status === 2 || order.orderDetailsWithId.status === 1;
                const sellAmountToUse = isCompletedOrCancelled 
                  ? originalSellAmount 
                  : (originalSellAmount * BigInt(Math.floor(remainingPercentage * 1e18))) / BigInt(1e18);
                
                const sellTokenAmount = parseFloat(formatTokenAmount(sellAmountToUse, sellTokenInfo.decimals));
                const sellTokenPrice = getTokenPrice(sellTokenAddress, tokenPrices);
                const sellUsdValue = sellTokenAmount * sellTokenPrice;
                
                // Calculate minimum asking USD value (buyer can choose any token, so use the cheapest)
                let askingUsdValue = 0;
                const buyTokensIndex = order.orderDetailsWithId.orderDetails.buyTokensIndex;
                const buyAmounts = order.orderDetailsWithId.orderDetails.buyAmounts;
                
                if (buyTokensIndex && buyAmounts && Array.isArray(buyTokensIndex) && Array.isArray(buyAmounts)) {
                  const tokenValues: number[] = [];
                  buyTokensIndex.forEach((tokenIndex: bigint, idx: number) => {
                    const tokenInfo = getTokenInfoByIndex(Number(tokenIndex));
                    const originalAmount = buyAmounts[idx];
                    
                    // For completed/cancelled orders, use original amounts; for active, use remaining
                    const buyAmountToUse = isCompletedOrCancelled
                      ? originalAmount
                      : (originalAmount * BigInt(Math.floor(remainingPercentage * 1e18))) / BigInt(1e18);
                    
                    const tokenAmount = parseFloat(formatTokenAmount(buyAmountToUse, tokenInfo.decimals));
                    const tokenPrice = getTokenPrice(tokenInfo.address, tokenPrices);
                    const usdValue = tokenAmount * tokenPrice;
                    tokenValues.push(usdValue);
                  });
                  // Use minimum value (cheapest option for buyer)
                  askingUsdValue = tokenValues.length > 0 ? Math.min(...tokenValues) : 0;
                }
                
                // Calculate how much smaller the ask is than the offer as a %
                let percentageDifference = null;
                let isAboveAsking = false;
                if (sellUsdValue > 0 && askingUsdValue > 0) {
                  percentageDifference = ((sellUsdValue - askingUsdValue) / sellUsdValue) * 100;
                  isAboveAsking = percentageDifference > 0; // positive means ask is smaller than offer (discount)
                }
                
                // Calculate backing price discount - simple USD comparison like market price column
                let backingPriceDiscount = null;
                let isAboveBackingPrice = false;
                
                // Check if this token is eligible for backing stats (is a MAXI token)
                const isEligibleForBackingStats = maxiTokenAddresses.some(addr => 
                  addr.toLowerCase() === sellTokenInfo.address.toLowerCase()
                );
                
                // Check if this is a MAXI token that has backing price data
                // Don't show stats if there's a chain mismatch (pHEX with weMAXI or weHEX with pMAXI)
                const isEthereumWrappedSell = sellTokenInfo.ticker.startsWith('we') || sellTokenInfo.ticker.startsWith('e');
                const isPulseChainSell = !isEthereumWrappedSell;
                
                // Check if any buy token has chain mismatch with sell token
                const hasChainMismatch = buyTokensIndex.some((index: bigint) => {
                  const buyTokenInfo = getTokenInfoByIndex(Number(index));
                  if (!buyTokenInfo) return false;
                  
                  const buyTicker = formatTokenTicker(buyTokenInfo.ticker);
                  const isEthereumWrappedBuy = buyTicker.startsWith('we') || buyTicker.startsWith('e');
                  
                  // Mismatch if: pHEX/pMAXI with weHEX/weMAXI or vice versa
                  return (isPulseChainSell && isEthereumWrappedBuy) || (isEthereumWrappedSell && !isEthereumWrappedBuy);
                });
                
                // Map wrapped tokens (we*) to their ethereum versions (e*) for stats lookup
                // For tokens with multiple versions (DECI, LUCKY, TRIO, BASE), find the highest version
                const tokensWithVersions = ['DECI', 'LUCKY', 'TRIO', 'BASE'];
                let sellTokenKey: string;
                
                if (sellTokenInfo.ticker.startsWith('we')) {
                  // weMAXI -> eMAXI, weDECI -> highest eDECI version, weBASE -> highest eBASE version
                  const baseTicker = sellTokenInfo.ticker.slice(2); // Remove 'we' prefix
                  if (tokensWithVersions.includes(baseTicker)) {
                    sellTokenKey = getHighestTokenVersion(tokenStats, 'e', baseTicker);
                  } else {
                    sellTokenKey = `e${baseTicker}`;
                  }
                } else if (sellTokenInfo.ticker.startsWith('e')) {
                  // eBASE -> highest eBASE version, eMAXI -> eMAXI
                  const baseTicker = sellTokenInfo.ticker.slice(1);
                  if (tokensWithVersions.includes(baseTicker)) {
                    sellTokenKey = getHighestTokenVersion(tokenStats, 'e', baseTicker);
                  } else {
                    sellTokenKey = sellTokenInfo.ticker;
                  }
                } else {
                  // Regular tokens like MAXI -> pMAXI, BASE -> highest pBASE version
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
                    
                    // Calculate OTC price per token in USD (use the already calculated sellTokenAmount from line 1587)
                    const otcPriceUsd = sellTokenAmount > 0 ? askingUsdValue / sellTokenAmount : 0; // asking total USD / sell token units
                    
                    
                    if (otcPriceUsd > 0 && backingPriceUsd > 0) {
                      // Calculate percentage: how much above/below backing price the OTC price is
                      backingPriceDiscount = ((otcPriceUsd - backingPriceUsd) / backingPriceUsd) * 100;
                      isAboveBackingPrice = backingPriceDiscount > 0;
                      
                    } else {
                    }
                  }
                }
                
                return (
                  <div key={`${orderId}-${tokenFilter}-${ownershipFilter}-${statusFilter}`} data-order-id={orderId}
                      className={`grid grid-cols-[minmax(120px,1fr)_minmax(120px,1fr)_minmax(80px,120px)_minmax(100px,140px)_minmax(100px,140px)_minmax(80px,120px)_minmax(80px,120px)_minmax(80px,120px)_auto] items-start gap-4 py-8 ${
                        index < displayOrders.length - 1 ? 'border-b border-white/10' : ''
                      }`}
                    >
                    {/* COLUMN 1: Token For Sale Content */}
                    <div className="flex flex-col items-start space-y-1 min-w-0 overflow-hidden">
                    {(() => {
                      const formattedAmount = formatTokenAmount(order.orderDetailsWithId.orderDetails.sellAmount, sellTokenInfo.decimals);
                      // For completed orders, show original amounts; for others, show remaining amounts
                      const isCompleted = statusFilter === 'completed' || order.orderDetailsWithId.status === 1;
                      
                      let tokenAmount: number;
                      if (isCompleted) {
                        // Use original amount for completed orders
                        tokenAmount = parseFloat(formatTokenAmount(order.orderDetailsWithId.orderDetails.sellAmount, sellTokenInfo.decimals));
                      } else {
                        // Use remaining amount for active orders
                        tokenAmount = sellTokenAmount;
                      }
                      
                      const tokenPrice = sellTokenPrice; // Use pre-calculated value
                      let usdValue: number;
                      if (isCompleted) {
                        // Recalculate USD for completed orders
                        usdValue = tokenAmount * tokenPrice;
                      } else {
                        // Use pre-calculated value for active orders
                        usdValue = sellUsdValue;
                      }
                      
                      
                      return (
                        <div className="inline-block">
                          <span className={`text-lg font-medium ${tokenPrice > 0 ? 'text-white' : 'text-gray-500'} ${tokenPrice === 0 ? 'py-1' : ''}`}>
                            {tokenPrice > 0 ? formatUSD(usdValue) : '--'}
                          </span>
                          <div className="w-1/2 h-px bg-white/10 my-2"></div>
                  <div className="flex items-center space-x-2">
                    <TokenLogo 
                      src={getTokenInfo(order.orderDetailsWithId.orderDetails.sellToken).logo}
                              alt={formatTokenTicker(getTokenInfo(order.orderDetailsWithId.orderDetails.sellToken).ticker)}
                      className="w-6 h-6 rounded-full"
                    />
                            <div className="flex flex-col">
                    <span className="text-white text-sm font-medium whitespace-nowrap">
                                {formatTokenTicker(getTokenInfo(order.orderDetailsWithId.orderDetails.sellToken).ticker)}
                    </span>
                              <span className="text-gray-400 text-xs whitespace-nowrap">
                                {formatTokenAmountDisplay(tokenAmount)}
                              </span>
                              {/* Hide individual USD price for single token (redundant with total) */}
                  </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                  
                  {/* COLUMN 2: Asking For Content */}
                  <div className="flex flex-col items-start space-y-1 min-w-0 overflow-hidden">
                    {(() => {
                      // For completed orders, recalculate total USD using original amounts
                      const isCompleted = statusFilter === 'completed' || order.orderDetailsWithId.status === 1;
                      let totalUsdValue = askingUsdValue; // Default to pre-calculated value
                      
                      if (isCompleted) {
                        // Recalculate minimum USD value using original amounts for completed orders
                        const tokenValues: number[] = [];
                        buyTokensIndex.forEach((tokenIndex: bigint, idx: number) => {
                      const tokenInfo = getTokenInfoByIndex(Number(tokenIndex));
                          const originalAmount = buyAmounts[idx];
                          const tokenAmount = parseFloat(formatTokenAmount(originalAmount, tokenInfo.decimals));
                          const tokenPrice = getTokenPrice(tokenInfo.address, tokenPrices);
                          const usdValue = tokenAmount * tokenPrice;
                          tokenValues.push(usdValue);
                        });
                        // Use minimum value (cheapest option for buyer)
                        totalUsdValue = tokenValues.length > 0 ? Math.min(...tokenValues) : 0;
                      }
                      
                      return (
                        <div className="inline-block">
                          <span className={`text-lg font-medium ${totalUsdValue > 0 ? 'text-white' : 'text-gray-500'} ${totalUsdValue === 0 ? 'py-1' : ''}`}>
                            {totalUsdValue > 0 ? formatUSD(totalUsdValue) : '--'}
                          </span>
                          <div className="w-1/2 h-px bg-white/10 my-2"></div>
                          {(() => {
                            // For completed and active orders
                            const hasMultipleTokens = buyTokensIndex.length > 1;
                            return buyTokensIndex.map((tokenIndex: bigint, idx: number) => {
                      const tokenInfo = getTokenInfoByIndex(Number(tokenIndex));
                            const originalAmount = buyAmounts[idx];
                              // For completed orders, show original amounts; for others, show remaining amounts
                              // Check if we're in completed filter section - if so, always use original amounts
                              const isCompleted = statusFilter === 'completed' || order.orderDetailsWithId.status === 1;
                            const remainingPercentage = Number(getRemainingPercentage(order.orderDetailsWithId)) / 1e18;
                            
                            // Debug: Log status for completed orders (only once per order)
                            if (statusFilter === 'completed' && idx === 0) {
                            }
                              const remainingAmount = (originalAmount * BigInt(Math.floor(remainingPercentage * 1e18))) / BigInt(1e18);
                                const tokenAmount = isCompleted ? 
                                  parseFloat(formatTokenAmount(originalAmount, tokenInfo.decimals)) :
                                  parseFloat(formatTokenAmount(remainingAmount, tokenInfo.decimals));
                            const tokenPrice = getTokenPrice(tokenInfo.address, tokenPrices);
                            const usdValue = tokenAmount * tokenPrice;
                            
                            // Enhanced debug: Log the actual calculation
                            if (statusFilter === 'completed' && idx === 0) {
                            }
                            
                            
                      return (
                              <div key={idx} className="flex items-center space-x-2 mb-3">
                          <TokenLogo 
                            src={tokenInfo.logo}
                                  alt={formatTokenTicker(tokenInfo.ticker)}
                            className="w-6 h-6 rounded-full"
                          />
                                <div className="flex flex-col">
                          <span className="text-white text-sm font-medium whitespace-nowrap">
                                    {formatTokenTicker(tokenInfo.ticker)}
                          </span>
                                  <span className="text-gray-400 text-xs whitespace-nowrap">
                            {formatTokenAmountDisplay(tokenAmount)}
                          </span>
                                  {/* Only show individual USD price if there are multiple tokens */}
                                  {hasMultipleTokens && tokenPrice > 0 && (
                                    <span className="text-gray-500 text-xs">
                                      {formatUSD(usdValue)}
                                    </span>
                                  )}
                                </div>
                        </div>
                      );
                            });
                          })()}
                  </div>
                      );
                    })()}
                  </div>
                  
                  {/* COLUMN 3: Fill Status % Content */}
                  <div className="flex flex-col items-center space-y-2  mt-0.5 min-w-0">
                    {(() => {
                      const fillPercentage = 100 - ((Number(getRemainingPercentage(order.orderDetailsWithId)) / 1e18) * 100);
                      
                      return (
                        <span className={`text-xs ${fillPercentage === 0 ? 'text-gray-500' : 'text-white'}`}>
                          {formatPercentage(fillPercentage)}
                    </span>
                      );
                    })()}
                    <div className="w-[60px] h-1 bg-gray-500 rounded-full overflow-hidden relative">
                      {(() => {
                        const fillPercentage = 100 - ((Number(getRemainingPercentage(order.orderDetailsWithId)) / 1e18) * 100);
                        
                        return (
                          <div 
                            className={`h-full rounded-full transition-all duration-300 ${
                              fillPercentage === 0 ? 'bg-gray-500' : 'bg-blue-500'
                            }`}
                        style={{ 
                              width: `${fillPercentage}%` 
                        }}
                      />
                        );
                      })()}
                    </div>
                  </div>
                  
                  {/* COLUMN 4: OTC % Content */}
                  <div className="text-center min-w-0">
                    <div className="text-sm">
                      {percentageDifference !== null ? (
                        <span className={`font-medium ${
                          isAboveAsking 
                            ? 'text-red-400'    // Red discount - getting more value than paying for
                            : 'text-green-400'  // Green premium - paying more than getting
                        }`}>
                          {isAboveAsking 
                            ? `-${Math.abs(percentageDifference).toLocaleString('en-US', { maximumFractionDigits: 0 })}%`
                            : `+${Math.abs(percentageDifference).toLocaleString('en-US', { maximumFractionDigits: 0 })}%`
                          }
                        </span>
                      ) : (
                        <span className="text-gray-500">--</span>
                      )}
                    </div>
                    {percentageDifference !== null && (
                      <div className="text-xs text-gray-400 mt-0">
                        {isAboveAsking ? 'discount' : 'premium'}
                      </div>
                    )}
                  </div>
                  
                  {/* COLUMN 5: Backing Price Discount Content */}
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
                              <Lock className="w-5 h-5 -mt-1 text-gray-400 hover:text-white" />
                            </button>
                          ) : (
                            <span className={`font-medium ${
                              isAboveBackingPrice 
                                ? 'text-gray-400'    // Neutral - selling above backing price
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
                        <>
                          {/* Show lock for MAXI tokens even when data doesn't load if user has no access */}
                          {isEligibleForBackingStats && (PAYWALL_ENABLED && !hasTokenAccess) ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowPaywallModal(true);
                              }}
                              className="p-2 inline-flex items-center justify-center hover:opacity-80 transition-opacity"
                            >
                              <Lock className="w-5 h-5 -mt-1 text-gray-400 hover:text-white" />
                            </button>
                          ) : (
                            <span className="text-gray-500">--</span>
                          )}
                        </>
                      )}
                    </div>
                    {backingPriceDiscount !== null && !(PAYWALL_ENABLED && !hasTokenAccess) && (
                      <div className="text-xs text-gray-400 mt-0">
                        {isAboveBackingPrice ? 'premium' : 'discount'}
                      </div>
                    )}
                  </div>
                  
                  {/* COLUMN 6: Status Content */}
                  <div className="text-center min-w-0 mt-1">
                    <span className={`px-3 py-2 rounded-full text-sm font-medium border ${
                      getStatusText(order) === 'Inactive'
                        ? 'bg-yellow-500/20 text-yellow-400 border-yellow-400'
                        : order.orderDetailsWithId.status === 0 
                        ? 'bg-green-500/20 text-green-400 border-green-400' 
                        : order.orderDetailsWithId.status === 1
                        ? 'bg-red-500/20 text-red-400 border-red-400'
                        : 'bg-blue-500/20 text-blue-400 border-blue-400'
                    }`}>
                      {getStatusText(order)}
                    </span>
                  </div>
                  
                  {/* COLUMN 7: Expires Content */}
                  <div className="text-gray-400 text-sm text-center min-w-0 mt-1.5">
                    {formatTimestamp(Number(order.orderDetailsWithId.orderDetails.expirationTime))}
                  </div>
                  
                  {/* COLUMN 8: Actions / Order ID Content */}
                    <div className="text-center min-w-0">
                      {(statusFilter === 'inactive' || statusFilter === 'completed' || statusFilter === 'cancelled') ? (
                        <div className="text-gray-400 mt-1.5 text-sm">{order.orderDetailsWithId.orderId.toString()}</div>
                      ) : (
                        <>
                      {ownershipFilter === 'mine' && order.orderDetailsWithId.status === 0 ? (
                          <button
                            onClick={() => handleCancelOrder(order)}
                            disabled={cancelingOrders.has(order.orderDetailsWithId.orderId.toString())}
                            className="p-2 -mt-1.5 rounded hover:bg-gray-700/50 transition-colors disabled:opacity-50"
                          >
                            {cancelingOrders.has(order.orderDetailsWithId.orderId.toString()) ? (
                              <Loader2 className="w-5 h-5 text-red-400 animate-spin mx-auto" />
                            ) : (
                              <Trash2 className="w-5 h-5 text-red-400 hover:text-red-300 mx-auto" />
                            )}
                      </button>
                      ) : ownershipFilter === 'non-mine' && order.orderDetailsWithId.status === 0 && statusFilter === 'active' ? (
                          <button
                            onClick={() => togglePositionExpansion(order.orderDetailsWithId.orderId.toString())}
                          className={`flex items-center gap-1 ml-4 px-4 py-2 text-xs rounded-full transition-colors ${
                            expandedPositions.has(order.orderDetailsWithId.orderId.toString())
                              ? 'bg-transparent border border-white text-white hover:bg-white/10'
                              : 'bg-white text-black hover:bg-gray-200'
                          }`}
                          >
                            <span>Buy</span>
                            <ChevronDown 
                              className={`w-3 h-3 transition-transform duration-200 ${
                                expandedPositions.has(order.orderDetailsWithId.orderId.toString()) ? '' : 'rotate-180'
                              }`}
                            />
                          </button>
                        ) : (
                        // No action button for completed/inactive/cancelled orders
                        <div className="w-16 h-8"></div>
                      )}
                        </>
                      )}
                  </div>
                  
                  {/* Expandable Actions Shelf */}
                    {expandedPositions.has(order.orderDetailsWithId.orderId.toString()) && (
                      <div
                        className="col-span-full rounded-2xl mt-2 border border-white/10 bg-white/5 w-full"
                      >
                        <div className="p-3">
                          <div className="flex flex-col space-y-2">
                            <h4 className="text-white font-medium text-xl">Your Trade</h4>
                            
                            {/* Offer Input Fields */}
                            <div className="mt-3 pt-3 border-t border-white/10">
                              <h5 className="text-white font-medium text-xs mb-2">You pay:</h5>
                              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                {order.orderDetailsWithId.orderDetails.buyTokensIndex.map((tokenIndex: bigint, idx: number) => {
                                  const tokenInfo = getTokenInfoByIndex(Number(tokenIndex));
                                  const orderId = order.orderDetailsWithId.orderId.toString();
                                  const currentAmount = offerInputs[orderId]?.[tokenInfo.address] || '';
                                  
                                  return (
                                    <div key={tokenInfo.address} className="flex items-center space-x-2 bg-gray-400/5 rounded-lg px-3 py-2 min-h-[60px]">
                                      <div className="flex items-center space-x-2 flex-1">
                                        <TokenLogo 
                                          src={tokenInfo.logo}
                                          alt={formatTokenTicker(tokenInfo.ticker)}
                                          className="w-6 h-6 rounded-full flex-shrink-0"
                                        />
                                        <span className="text-white text-sm font-medium">
                                          {formatTokenTicker(tokenInfo.ticker)}
                                        </span>
            </div>
                                      <div className="flex flex-col">
                                        <input
                                          type="text"
                                          value={formatNumberWithCommas(currentAmount)}
                                          onChange={(e) => handleOfferInputChange(
                                            orderId, 
                                            tokenInfo.address, 
                                            removeCommas(e.target.value),
                                            order
                                          )}
                                          className="bg-transparent border border-white/20 rounded px-2 py-1 text-white text-sm w-26 md:w-20 focus:border-white/40 focus:outline-none"
                                          placeholder="0"
                                        />
          </div>
                                    </div>
                                  );
                                })}
          </div>
                              
                              {/* Percentage buttons and Clear under all inputs */}
                              <div className="mt-4 flex space-x-2">
                                <button
                                  onClick={() => handlePercentageFill(order, 0.1)}
                                  className="px-3 py-1 text-xs bg-blue-500/20 text-blue-400 border border-blue-400 rounded hover:bg-blue-500/30 transition-colors"
                                >
                                  10%
                                </button>
                                <button
                                  onClick={() => handlePercentageFill(order, 0.5)}
                                  className="px-3 py-1 text-xs bg-blue-500/20 text-blue-400 border border-blue-400 rounded hover:bg-blue-500/30 transition-colors"
                                >
                                  50%
                                </button>
                                <button
                                  onClick={() => handlePercentageFill(order, 1.0)}
                                  className="px-3 py-1 text-xs bg-blue-500/20 text-blue-400 border border-blue-400 rounded hover:bg-blue-500/30 transition-colors"
                                >
                                  100%
                                </button>
                                <button
                                  onClick={() => handleClearInputs(order)}
                                  className="px-3 py-1 text-xs bg-red-500/20 text-red-400 border border-red-400 rounded hover:bg-red-500/30 transition-colors"
                                >
                                  Clear
                                </button>
                              </div>
                              
                              {/* Fee Breakdown */}
                              {(() => {
                                const orderId = order.orderDetailsWithId.orderId.toString();
                                const currentInputs = offerInputs[orderId];
                                if (!currentInputs) return null;
                                
                                // Calculate total buy amount (what buyer will pay)
                                let totalBuyAmount = 0;
                                let primaryTokenInfo = null;
                                const buyTokensIndex = order.orderDetailsWithId.orderDetails.buyTokensIndex;
                                const buyAmounts = order.orderDetailsWithId.orderDetails.buyAmounts;
                                
                                if (buyTokensIndex && buyAmounts && Array.isArray(buyTokensIndex) && Array.isArray(buyAmounts)) {
                                  buyTokensIndex.forEach((tokenIndex: bigint, idx: number) => {
                                    const tokenInfo = getTokenInfoByIndex(Number(tokenIndex));
                                    if (tokenInfo.address && currentInputs[tokenInfo.address]) {
                                      const inputAmount = parseFloat(removeCommas(currentInputs[tokenInfo.address]));
                                      if (!isNaN(inputAmount)) {
                                        totalBuyAmount += inputAmount;
                                        // Use the first token with an input as the primary token for display
                                        if (!primaryTokenInfo) {
                                          primaryTokenInfo = tokenInfo;
                                        }
                                      }
                                    }
                                  });
                                }
                                
                                if (totalBuyAmount > 0) {
                                  const platformFee = totalBuyAmount * 0.01; // 1% fee
                                  const orderOwnerReceives = totalBuyAmount - platformFee;
                                  
                                  return (
                                    <div className="mt-4 p-3 bg-white/5 rounded-lg">
                                      <h5 className="text-white font-medium mb-2">Order Breakdown</h5>
                                      <div className="space-y-1 text-sm">
                                        <div className="flex justify-between">
                                          <span className="text-gray-400">Seller Receives:</span>
                                          <div className="flex items-center space-x-1">
                                            <span className="text-white">{orderOwnerReceives.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })}</span>
                                            {primaryTokenInfo && (
                                              <>
                                                <TokenLogo 
                                                  src={primaryTokenInfo.logo}
                                                  alt={formatTokenTicker(primaryTokenInfo.ticker)}
                                                  className="w-4 h-4 rounded-full"
                                                />
                                                <span className="text-white">{formatTokenTicker(primaryTokenInfo.ticker)}</span>
                                              </>
                                            )}
                                          </div>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="text-gray-400">Platform Fee (1%):</span>
                                          <div className="flex items-center space-x-1">
                                            <span className="text-white">{platformFee.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })}</span>
                                            {primaryTokenInfo && (
                                              <>
                                                <TokenLogo 
                                                  src={primaryTokenInfo.logo}
                                                  alt={formatTokenTicker(primaryTokenInfo.ticker)}
                                                  className="w-4 h-4 rounded-full"
                                                />
                                                <span className="text-white">{formatTokenTicker(primaryTokenInfo.ticker)}</span>
                                              </>
                                            )}
                                          </div>
                                        </div>
                                        <div className="border-t border-white/10 pt-1">
                                          <div className="flex justify-between">
                                            <span className="text-white font-bold">You Pay:</span>
                                            <div className="flex items-center space-x-1">
                                              <span className="text-white font-bold">{formatNumberWithCommas(formatTokenAmountDisplay(totalBuyAmount))}</span>
                                              {primaryTokenInfo && (
                                                <>
                                                  <TokenLogo 
                                                    src={primaryTokenInfo.logo}
                                                    alt={formatTokenTicker(primaryTokenInfo.ticker)}
                                                    className="w-4 h-4 rounded-full"
                                                  />
                                                  <span className="text-white font-bold">{formatTokenTicker(primaryTokenInfo.ticker)}</span>
                                                </>
                                              )}
                                          </div>
                                        </div>
                                        </div>
                                        
                                        {/* Divider */}
                                        <div className="pt-2 mt-2">
                                        </div>
                                        
                                         {/* What you receive section */}
                                         {(() => {
                                           const sellTokenInfo = getTokenInfo(order.orderDetailsWithId.orderDetails.sellToken);
                                           const sellAmount = parseFloat(formatTokenAmount(order.orderDetailsWithId.orderDetails.sellAmount, sellTokenInfo.decimals));
                                           const buyAmount = parseFloat(formatTokenAmount(order.orderDetailsWithId.orderDetails.buyAmounts[0], primaryTokenInfo.decimals));
                                           
                                           // Calculate the exchange rate: sellAmount / buyAmount
                                           const exchangeRate = sellAmount / buyAmount;
                                           
                                           // What you receive = what you pay * exchange rate
                                           const receiveAmount = totalBuyAmount * exchangeRate;
                                           
                                           return (
                                             <div className="flex justify-between">
                                               <span className="text-white font-medium">You Receive:</span>
                                               <div className="flex items-center space-x-1">
                                                 <span className="text-white font-bold">{receiveAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })}</span>
                                                 <TokenLogo 
                                                   src={sellTokenInfo.logo}
                                                   alt={formatTokenTicker(sellTokenInfo.ticker)}
                                                   className="w-4 h-4 rounded-full"
                                                 />
                                                 <span className="text-white font-bold">{formatTokenTicker(sellTokenInfo.ticker)}</span>
                                               </div>
                                             </div>
                                           );
                                         })()}
                                      </div>
                                    </div>
                                  );
                                }
                                return null;
                              })()}

                              {/* Error Display */}
                              {executeErrors[order.orderDetailsWithId.orderId.toString()] && (
                                <div className="mt-4 p-3 bg-red-900/20 border border-red-500/30 rounded-lg">
                                  <p className="text-red-400 text-sm">{executeErrors[order.orderDetailsWithId.orderId.toString()]}</p>
                                </div>
                              )}

                              {/* Submit Section */}
                              <div className="mt-4 pt-3 border-t border-white/10">
                                {(() => {
                                  const orderId = order.orderDetailsWithId.orderId.toString();
                                  const currentInputs = offerInputs[orderId];
                                  const buyTokensIndex = order.orderDetailsWithId.orderDetails.buyTokensIndex;
                                  
                                  const hasNativeTokenInput = currentInputs && buyTokensIndex.some((tokenIndex: bigint) => {
                                    const tokenInfo = getTokenInfoByIndex(Number(tokenIndex));
                                    return tokenInfo.address && currentInputs[tokenInfo.address] && parseFloat(removeCommas(currentInputs[tokenInfo.address])) > 0 && isNativeToken(tokenInfo.address);
                                  });
                                  
                                  return (
                                <button 
                                  onClick={() => handleExecuteOrder(order)}
                                      disabled={executingOrders.has(orderId) || approvingOrders.has(orderId) || !isWalletConnected}
                                  className="px-6 py-2 bg-white text-black border border-white rounded-lg hover:bg-gray-100 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                       {approvingOrders.has(orderId) ? 'Approving...' : executingOrders.has(orderId) ? 'Executing...' : (hasNativeTokenInput ? 'Confirm Trade' : 'Approve & Confirm Trade')}
                                </button>
                                  );
                                })()}
                              </div>
                            </div>
                            
                            <div className="text-xs text-gray-500 mt-4">
                              Order ID: {order.orderDetailsWithId.orderId.toString()}
                            </div>
                            
                            <div className="text-xs text-gray-500 mt-1">
                              Seller: {order.userDetails.orderOwner}
                            </div>
                            
                            {/* Owner Actions - Only show for user's own orders */}
                            {address && order.userDetails.orderOwner.toLowerCase() === address.toLowerCase() && (
                              <div className="mt-3 pt-3 border-t border-white/10">
                                <div className="flex gap-2">
                                  {/* Cancel Button */}
                                  <button
                                    onClick={() => handleCancelOrder(order)}
                                    disabled={cancelingOrders.has(order.orderDetailsWithId.orderId.toString()) || 
                                             order.orderDetailsWithId.status !== 0}
                                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    {cancelingOrders.has(order.orderDetailsWithId.orderId.toString()) ? 'Canceling...' : 'Cancel Order'}
                                  </button>
                                  
                                  {/* Edit Button */}
                                  <button
                                    onClick={() => handleEditOrder(order)}
                                    disabled={order.orderDetailsWithId.status !== 0}
                                    className="hidden px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    Edit Order
                                  </button>
                                </div>
                                
                                {/* Cancel Error Display */}
                                {cancelErrors[order.orderDetailsWithId.orderId.toString()] && (
                                  <div className="mt-2 p-2 bg-red-900/20 border border-red-500/30 rounded-lg">
                                    <p className="text-red-400 text-xs">{cancelErrors[order.orderDetailsWithId.orderId.toString()]}</p>
                                  </div>
                                )}
                                
                                {/* Update Error Display */}
                                {updateErrors[order.orderDetailsWithId.orderId.toString()] && (
                                  <div className="mt-2 p-2 bg-red-900/20 border border-red-500/30 rounded-lg">
                                    <p className="text-red-400 text-xs">{updateErrors[order.orderDetailsWithId.orderId.toString()]}</p>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
        </div>
      </div>
                    )}
        </div>
                );
              })}
            </div>
          </div>
        )}
        </div>
        )}
      </div>
      
      {/* Edit Order Modal */}
      {editingOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-white mb-4">Edit Order</h3>
            
            <div className="space-y-4">
              {/* Sell Amount */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Sell Amount
                </label>
                <input
                  type="text"
                  value={editFormData.sellAmount}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, sellAmount: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  placeholder="Enter sell amount"
                />
              </div>
              
              {/* Buy Amounts */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Buy Amounts
                </label>
                {Object.entries(editFormData.buyAmounts).map(([tokenIndex, amount]) => {
                  const tokenInfo = getTokenInfoByIndex(Number(tokenIndex));
                  return (
                    <div key={tokenIndex} className="mb-2">
                      <div className="flex items-center gap-2 mb-1">
                        <img src={tokenInfo.logo} alt={tokenInfo.ticker} className="w-4 h-4" />
                        <span className="text-sm text-gray-300">{tokenInfo.ticker}</span>
                      </div>
                      <input
                        type="text"
                        value={amount}
                        onChange={(e) => setEditFormData(prev => ({
                          ...prev,
                          buyAmounts: { ...prev.buyAmounts, [tokenIndex]: e.target.value }
                        }))}
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                        placeholder={`Enter ${tokenInfo.ticker} amount`}
                      />
                    </div>
                  );
                })}
              </div>
              
              {/* Expiration Time */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Expiration Time
                </label>
                <input
                  type="datetime-local"
                  value={editFormData.expirationTime}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, expirationTime: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
            
            {/* Action Buttons */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setEditingOrder(null);
                  setEditFormData({ sellAmount: '', buyAmounts: {}, expirationTime: '' });
                }}
                className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const order = allOrders?.find(o => o.orderDetailsWithId.orderId.toString() === editingOrder);
                  if (order) handleSaveOrder(order);
                }}
                disabled={updatingOrders.has(editingOrder)}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {updatingOrders.has(editingOrder) ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

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
});

export default OpenPositionsTable;
