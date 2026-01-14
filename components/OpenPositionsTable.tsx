'use client';

import { useState, useEffect, useCallback, useMemo, useRef, forwardRef, useImperativeHandle } from 'react';
import { motion } from 'framer-motion';
import { CircleDollarSign, ChevronDown, Trash2, Lock, Search, ArrowRight, MoveRight, ChevronRight, Play, CalendarDays } from 'lucide-react';
import { PixelSpinner } from './ui/PixelSpinner';
import PaywallModal from './PaywallModal';
import { DisclaimerDialog } from './DisclaimerDialog';
import OrderHistoryTable from './OrderHistoryTable';
import { LiquidGlassCard } from '@/components/ui/liquid-glass';
import { Calendar } from '@/components/ui/calendar';
import useToast from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';
import { useOpenPositions, CompleteOrderDetails } from '@/hooks/contracts/useOpenPositions';
import { useTokenPrices } from '@/hooks/crypto/useTokenPrices';
import { useTokenStats } from '@/hooks/crypto/useTokenStats';
import { useContractWhitelist } from '@/hooks/contracts/useContractWhitelist';
import { CONTRACT_ABI } from '@/config/abis';
import { formatEther, parseEther, parseAbiItem } from 'viem';
import { getTokenInfo, getTokenInfoByIndex, formatAddress, formatTokenTicker, parseTokenAmount, formatTokenAmount } from '@/utils/tokenUtils';
import { isNativeToken } from '@/utils/tokenApproval';
import { getRemainingPercentage } from '@/utils/orderUtils';
import { getBlockExplorerTxUrl } from '@/utils/blockExplorer';
import { TOKEN_CONSTANTS } from '@/constants/crypto';
import { waitForTransactionWithTimeout, TRANSACTION_TIMEOUTS } from '@/utils/transactionTimeout';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import { useAppKit } from '@reown/appkit/react';
import { useTransaction } from '@/context/TransactionContext';
import { useTokenAccess } from '@/context/TokenAccessContext';
import { PAYWALL_ENABLED, REQUIRED_PARTY_TOKENS, REQUIRED_TEAM_TOKENS, PAYWALL_TITLE, PAYWALL_DESCRIPTION } from '@/config/paywall';
import { getContractAddress } from '@/config/testing';

// Sorting types
type SortField = 'sellAmount' | 'askingFor' | 'progress' | 'owner' | 'status' | 'date' | 'backingPrice' | 'currentPrice' | 'otcVsMarket';
type SortDirection = 'asc' | 'desc';

// Helper function to get remaining sell amount (AgoraX_final.sol)
const getRemainingSellAmount = (orderDetailsWithID: any): bigint => {
  return orderDetailsWithID.remainingSellAmount || 0n;
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

// Track which logos have failed to load to avoid repeat 404s
const failedLogos = new Set<string>();

// Simplified TokenLogo component that always shows fallback for missing logos
function TokenLogo({ src, alt, className }: { src: string; alt: string; className: string }) {
  // Check cache first - don't even try to render if we know it will fail
  if (src.includes('default.svg') || failedLogos.has(src)) {
    return (
      <CircleDollarSign
        className={`${className} text-white`}
      />
    );
  }

  const [hasError, setHasError] = useState(false);

  const handleError = useCallback(() => {
    failedLogos.add(src);
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

// Helper to simplify error messages
const simplifyErrorMessage = (error: any): string => {
  if (error?.shortMessage) return error.shortMessage;
  if (error?.message) {
    // Extract user-friendly message from common error patterns
    if (error.message.includes('User rejected')) return 'Transaction rejected by user';
    if (error.message.includes('insufficient funds')) return 'Insufficient funds for transaction';
    if (error.message.includes('Order expired')) return 'Order has expired';
    return error.message;
  }
  return 'An unknown error occurred';
};

interface OpenPositionsTableProps {
  isMarketplaceMode?: boolean;
  isLandingPageMode?: boolean; // Simplified view for landing page - shows top 10 active, no search/toggles
}

export const OpenPositionsTable = forwardRef<any, OpenPositionsTableProps>(({ isMarketplaceMode = false, isLandingPageMode = false }, ref) => {
  const { fillOrExecuteOrder, cancelOrder, collectProceeds, cancelAllExpiredOrders, updateOrderExpiration, isWalletConnected } = useContractWhitelist();
  const { address, chainId } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { open: openWalletModal } = useAppKit();

  // Contract address for querying events - get based on current chain
  const OTC_CONTRACT_ADDRESS = getContractAddress(chainId) as `0x${string}`;
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
  // Level 2: Ownership filter - set based on mode
  const [ownershipFilter, setOwnershipFilter] = useState<'mine' | 'non-mine'>(isMarketplaceMode ? 'non-mine' : 'mine');
  // Level 3: Status filter
  const [statusFilter, setStatusFilter] = useState<'active' | 'expired' | 'completed' | 'cancelled' | 'order-history'>('active');
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
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

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

  // Combined orders for transaction history (includes user's orders + orders they've interacted with)
  const [ordersForHistory, setOrdersForHistory] = useState<CompleteOrderDetails[]>([]);

  // Offer input state
  const [offerInputs, setOfferInputs] = useState<{ [orderId: string]: { [tokenAddress: string]: string } }>({});

  // State for executing orders
  const [executingOrders, setExecutingOrders] = useState<Set<string>>(new Set());
  const [approvingOrders, setApprovingOrders] = useState<Set<string>>(new Set());
  const [executeErrors, setExecuteErrors] = useState<{ [orderId: string]: string }>({});

  // State for canceling orders
  const [cancelingOrders, setCancelingOrders] = useState<Set<string>>(new Set());
  const [cancelErrors, setCancelErrors] = useState<{ [orderId: string]: string }>({});

  // State for collecting proceeds
  const [collectingOrders, setCollectingOrders] = useState<Set<string>>(new Set());
  const [collectErrors, setCollectErrors] = useState<{ [orderId: string]: string }>({});

  // State for batch cancelling expired orders
  const [isCancellingAll, setIsCancellingAll] = useState(false);
  const [cancelAllError, setCancelAllError] = useState<string>('');

  // State for editing orders
  const [editingOrder, setEditingOrder] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<{
    sellAmount: string;
    buyAmounts: { [tokenIndex: string]: string };
    expirationTime: string;
  }>({ sellAmount: '', buyAmounts: {}, expirationTime: '' });

  // State for calendar popup for expiration edit
  const [showExpirationCalendar, setShowExpirationCalendar] = useState<string | null>(null);
  const [selectedExpirationDate, setSelectedExpirationDate] = useState<Date | undefined>(undefined);
  const [updatingOrders, setUpdatingOrders] = useState<Set<string>>(new Set());
  const [updateErrors, setUpdateErrors] = useState<{ [orderId: string]: string }>({});

  // State for landing page connect button disclaimer
  const [showLandingDisclaimer, setShowLandingDisclaimer] = useState(false);

  // State for horizontal scroll shadows (landing page)
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Handle scroll to update shadow indicators
  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const { scrollLeft, scrollWidth, clientWidth } = container;
    setCanScrollLeft(scrollLeft > 0);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 1);
  }, []);

  // Check scroll state on mount and resize
  useEffect(() => {
    if (!isLandingPageMode) return;

    const container = scrollContainerRef.current;
    if (!container) return;

    handleScroll();

    const resizeObserver = new ResizeObserver(handleScroll);
    resizeObserver.observe(container);

    return () => resizeObserver.disconnect();
  }, [isLandingPageMode, handleScroll]);

  // Efficient querying: Pass address for user orders, undefined for marketplace (all orders)
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
  } = useOpenPositions(address, isMarketplaceMode);

  // Get unique sell token addresses for price fetching
  const sellTokenAddresses = allOrders ? [...new Set(allOrders.map(order =>
    order.orderDetailsWithID.orderDetails.sellToken
  ))] : [];

  // Get unique buy token addresses for price fetching
  const buyTokenAddresses = allOrders ? [...new Set(allOrders.flatMap(order => {
    const buyTokensIndex = order.orderDetailsWithID.orderDetails.buyTokensIndex;
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
    // If no tokens to fetch prices for, consider it valid (no orders = valid state)
    if (allTokenAddresses.length === 0) return true;
    return tokenPrices && allTokenAddresses.some(address => tokenPrices[address]?.price > 0);
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
    const orderId = order.orderDetailsWithID.orderID.toString();

    // Determine if this is a MAXI deal
    const sellTokenAddress = order.orderDetailsWithID.orderDetails.sellToken;
    const isMaxiDeal = maxiTokenAddresses.some(addr =>
      addr.toLowerCase() === sellTokenAddress.toLowerCase()
    ) || order.orderDetailsWithID.orderDetails.buyTokensIndex.some((tokenIndex: bigint) => {
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
    if (!publicClient) {
      return;
    }

    // In marketplace mode, fetch ALL transactions; otherwise fetch user-specific
    const fetchAllTransactions = isMarketplaceMode;

    try {
      // PART 1: Query OrderFilled events
      const buyerLogs = await publicClient.getLogs({
        address: OTC_CONTRACT_ADDRESS,
        event: parseAbiItem('event OrderFilled(address indexed buyer, uint256 indexed orderID, uint256 indexed buyTokenIndex, uint256 buyAmount)'),
        args: fetchAllTransactions ? {} : {
          buyer: address // Current connected wallet as buyer (or all if marketplace)
        },
        fromBlock: 'earliest' // Query from the beginning - could be optimized with a specific block range
      });

      // PART 2: Query OrderFilled events where the user is the seller (order creator)
      // Skip this in marketplace mode since we already have all transactions
      let sellerLogs: any[] = [];

      if (!fetchAllTransactions && address) {
        // First, find all orders created by the connected wallet
        const userCreatedOrders = allOrders.filter(order =>
          order.userDetails.orderOwner.toLowerCase() === address.toLowerCase()
        );
        const userCreatedOrderIds = userCreatedOrders.map(order =>
          order.orderDetailsWithID.orderID.toString()
        );

        // Query ALL OrderFilled events for those order IDs (no buyer filter)
        if (userCreatedOrderIds.length > 0) {
          sellerLogs = await publicClient.getLogs({
            address: OTC_CONTRACT_ADDRESS,
            event: parseAbiItem('event OrderFilled(address indexed buyer, uint256 indexed orderID, uint256 indexed buyTokenIndex, uint256 buyAmount)'),
            fromBlock: 'earliest'
          });

          // Filter to only include events for user's created orders and exclude their own purchases
          sellerLogs = sellerLogs.filter(log => {
            const orderId = log.args.orderID?.toString();
            const buyer = log.args.buyer?.toLowerCase();
            return orderId &&
              userCreatedOrderIds.includes(orderId) &&
              buyer !== address.toLowerCase(); // Exclude own purchases from seller view
          });
        }
      }

      // Extract order IDs that the user has purchased (buyer perspective)
      const orderIds = new Set(buyerLogs.map(log => log.args.orderID?.toString()).filter((id): id is string => Boolean(id)));
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
        const orderId = log.args.orderID?.toString();
        if (!orderId) continue;

        try {
          // Determine if this is a buyer or seller transaction
          const buyerAddress = log.args.buyer?.toLowerCase();
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

      // Fetch missing order details for transactions
      const transactionOrderIds = new Set(transactions.map(t => t.orderId));
      const existingOrderIds = new Set(allOrders.map(o => o.orderDetailsWithID.orderID.toString()));
      const missingOrderIds = Array.from(transactionOrderIds).filter(id => !existingOrderIds.has(id));

      // Fetch missing orders
      const missingOrders: CompleteOrderDetails[] = [];
      for (const orderId of missingOrderIds) {
        try {
          const orderDetails = await publicClient.readContract({
            address: OTC_CONTRACT_ADDRESS,
            abi: CONTRACT_ABI,
            functionName: 'getOrderDetails',
            args: [BigInt(orderId)]
          }) as any;

          if (orderDetails && orderDetails.orderDetailsWithID) {
            missingOrders.push(orderDetails as CompleteOrderDetails);
          }
        } catch (err) {
          // Silently handle errors
        }
      }


      // Combine allOrders with missing orders for transaction history
      const combinedOrders = [...allOrders, ...missingOrders];
      setOrdersForHistory(combinedOrders);

      setPurchaseTransactions(transactions);

    } catch (error) {
      // Set empty set on error
      setPurchasedOrderIds(new Set());
      setPurchaseTransactions([]);
      setOrdersForHistory(allOrders);
    }
  }, [address, publicClient, allOrders, isMarketplaceMode]);

  // Query user's purchase history from OrderFilled events and get actual purchase amounts
  useEffect(() => {
    fetchPurchaseHistory();
  }, [fetchPurchaseHistory]);

  // Update ordersForHistory when allOrders changes (fallback if no transactions yet)
  useEffect(() => {
    if (ordersForHistory.length === 0 && allOrders && allOrders.length > 0) {
      setOrdersForHistory(allOrders);
    }
  }, [allOrders, ordersForHistory.length]);

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
    const buyTokensIndex = order.orderDetailsWithID.orderDetails.buyTokensIndex;
    const buyAmounts = order.orderDetailsWithID.orderDetails.buyAmounts;

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
      const newInputs: { [tokenAddress: string]: string } = {
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
    const orderId = order.orderDetailsWithID.orderID.toString();
    const buyTokensIndex = order.orderDetailsWithID.orderDetails.buyTokensIndex;
    const buyAmounts = order.orderDetailsWithID.orderDetails.buyAmounts;

    if (!buyTokensIndex || !Array.isArray(buyTokensIndex)) {
      return;
    }

    if (!buyAmounts || !Array.isArray(buyAmounts)) {
      return;
    }

    const newInputs: { [tokenAddress: string]: string } = {};

    // Fill each token with the specified percentage of its remaining amount
    const remainingPercentage = Number(getRemainingPercentage(order.orderDetailsWithID)) / 1e18;

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
    const orderId = order.orderDetailsWithID.orderID.toString();
    const buyTokensIndex = order.orderDetailsWithID.orderDetails.buyTokensIndex;

    if (!buyTokensIndex || !Array.isArray(buyTokensIndex)) {
      return;
    }

    const newInputs: { [tokenAddress: string]: string } = {};

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
    const orderId = order.orderDetailsWithID.orderID.toString();

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

    let txHash: string | undefined;

    try {
      // For now, we'll execute with the first token that has an input
      // In a real implementation, you might want to handle multiple tokens
      const buyTokensIndex = order.orderDetailsWithID.orderDetails.buyTokensIndex;
      const buyAmounts = order.orderDetailsWithID.orderDetails.buyAmounts;

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

      if (!buyTokenInfo) {
        throw new Error('Token information not found');
      }

      if (!publicClient) {
        throw new Error('Public client not available');
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
                { "name": "owner", "type": "address" },
                { "name": "spender", "type": "address" }
              ],
              "name": "allowance",
              "outputs": [{ "name": "", "type": "uint256" }],
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
                  { "name": "spender", "type": "address" },
                  { "name": "amount", "type": "uint256" }
                ],
                "name": "approve",
                "outputs": [{ "name": "", "type": "bool" }],
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

      // Execute/Fill the order
      txHash = await fillOrExecuteOrder(
        BigInt(orderId),
        BigInt(tokenIndexToExecute),
        buyAmount,
        value
      );


      // Show immediate success toast (don't wait for receipt - PulseChain RPC is slow to index)
      toast({
        title: "✅ Order Fill Submitted!",
        description: "Your transaction has been submitted successfully. The order will update shortly.",
        variant: "success",
        action: txHash ? (
          <a
            href={getBlockExplorerTxUrl(chainId, txHash)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-white hover:underline font-medium"
          >
            View Tx
          </a>
        ) : undefined,
      });

      // Clear the inputs for this order
      handleClearInputs(order);

      // Refresh the data after short delays to show updated amounts
      setTimeout(() => {
        refetch();
        fetchPurchaseHistory();
      }, 3000); // First refresh after 3 seconds

      setTimeout(() => {
        refetch();
        fetchPurchaseHistory();
      }, 8000); // Second refresh after 8 seconds to catch slower confirmations

    } catch (error: any) {
      const errorMsg = simplifyErrorMessage(error) || 'Failed to execute order. Please try again.';

      setExecuteErrors(prev => ({
        ...prev,
        [orderId]: errorMsg
      }));

      // Show error toast
      toast({
        title: "Fill Order Failed",
        description: errorMsg,
        variant: "destructive",
      });
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
    const orderId = order.orderDetailsWithID.orderID.toString();


    if (cancelingOrders.has(orderId)) {
      return;
    }

    if (!publicClient) {
      toast({
        title: "Error",
        description: "Public client not available",
        variant: "destructive"
      });
      return;
    }

    setCancelingOrders(prev => new Set(prev).add(orderId));
    setCancelErrors(prev => ({ ...prev, [orderId]: '' }));
    setTransactionPending(true);

    try {
      const txHash = await cancelOrder(order.orderDetailsWithID.orderID);


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
        action: txHash ? (
          <a
            href={getBlockExplorerTxUrl(chainId, txHash)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-white hover:underline font-medium"
          >
            View Tx
          </a>
        ) : undefined,
      });

      // Determine if this is a MAXI deal
      const sellTokenAddress = order.orderDetailsWithID.orderDetails.sellToken;
      const isMaxiDeal = maxiTokenAddresses.some(addr =>
        addr.toLowerCase() === sellTokenAddress.toLowerCase()
      ) || order.orderDetailsWithID.orderDetails.buyTokensIndex.some((tokenIndex: bigint) => {
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
      const errorMsg = simplifyErrorMessage(error) || 'Failed to cancel order';
      setCancelErrors(prev => ({
        ...prev,
        [orderId]: errorMsg
      }));

      // Show error toast
      toast({
        title: "Cancel Order Failed",
        description: errorMsg,
        variant: "destructive",
      });
    } finally {
      setCancelingOrders(prev => {
        const newSet = new Set(prev);
        newSet.delete(orderId);
        return newSet;
      });
      setTransactionPending(false);
    }
  };

  const handleCollectProceeds = async (order: any) => {
    const orderId = order.orderDetailsWithID.orderID.toString();

    if (collectingOrders.has(orderId)) {
      return;
    }

    if (!publicClient) {
      toast({
        title: "Error",
        description: "Public client not available",
        variant: "destructive"
      });
      return;
    }

    setCollectingOrders(prev => new Set(prev).add(orderId));
    setCollectErrors(prev => ({ ...prev, [orderId]: '' }));
    setTransactionPending(true);

    let txHash: string | undefined;

    try {
      txHash = await collectProceeds(order.orderDetailsWithID.orderID);

      // Wait for transaction confirmation
      const receipt = await waitForTransactionWithTimeout(
        publicClient,
        txHash as `0x${string}`,
        TRANSACTION_TIMEOUTS.TRANSACTION
      );

      // Show success toast only after confirmation
      toast({
        title: "✅ Proceeds Collected!",
        description: "Your earnings have been transferred to your wallet.",
        variant: "success",
        action: txHash ? (
          <a
            href={getBlockExplorerTxUrl(chainId, txHash)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-white hover:underline font-medium"
          >
            View Tx
          </a>
        ) : undefined,
      });

      // Clear any previous errors
      setCollectErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[orderId];
        return newErrors;
      });

      // Refresh the data to show updated amounts
      refetch();
      fetchPurchaseHistory();

    } catch (error: any) {
      const errorMsg = simplifyErrorMessage(error) || 'Failed to collect proceeds';
      const isTimeout = error.isTimeout ||
        errorMsg.includes('taking longer than expected') ||
        errorMsg.includes('confirmation is taking longer') ||
        errorMsg.includes('Check Otterscan');

      setCollectErrors(prev => ({
        ...prev,
        [orderId]: errorMsg
      }));

      // Show appropriate toast based on error type
      if (isTimeout) {
        // Transaction submitted but confirmation timeout
        toast({
          title: "⏳ Collection Pending",
          description: "Your transaction was submitted but is taking longer to confirm. Funds may arrive soon - check Otterscan.",
          variant: "default",
          action: txHash ? (
            <a
              href={getBlockExplorerTxUrl(chainId, txHash)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-white hover:underline font-medium"
            >
              View Tx
            </a>
          ) : undefined,
        });

        // Refresh after delays to check if collection succeeded
        setTimeout(() => {
          refetch();
          fetchPurchaseHistory();
        }, 5000);

        setTimeout(() => {
          refetch();
          fetchPurchaseHistory();
        }, 15000);
      } else {
        // Real error
        toast({
          title: "Collection Failed",
          description: errorMsg,
          variant: "destructive",
        });
      }
    } finally {
      setCollectingOrders(prev => {
        const newSet = new Set(prev);
        newSet.delete(orderId);
        return newSet;
      });
      setTransactionPending(false);
    }
  };

  const handleCancelAllExpired = async () => {
    if (isCancellingAll) {
      return;
    }

    if (!publicClient) {
      toast({
        title: "Error",
        description: "Public client not available",
        variant: "destructive"
      });
      return;
    }

    // Count expired orders
    const expiredOrders = allOrders?.filter(order =>
      order.orderDetailsWithID.status === 0 && // Active
      order.orderDetailsWithID.orderDetails.expirationTime <= BigInt(Math.floor(Date.now() / 1000))
    ) || [];

    if (expiredOrders.length === 0) {
      toast({
        title: "No Expired Orders",
        description: "You don't have any expired orders to cancel.",
        variant: "info",
      });
      return;
    }

    if (expiredOrders.length > 50) {
      toast({
        title: "Too Many Expired Orders",
        description: `You have ${expiredOrders.length} expired orders. The contract can only cancel 50 at a time. Please try again after this batch completes.`,
        variant: "destructive",
      });
      return;
    }

    setIsCancellingAll(true);
    setCancelAllError('');
    setTransactionPending(true);

    try {
      const txHash = await cancelAllExpiredOrders();

      // Wait for transaction confirmation
      const receipt = await waitForTransactionWithTimeout(
        publicClient,
        txHash as `0x${string}`,
        TRANSACTION_TIMEOUTS.TRANSACTION
      );

      // Show success toast
      toast({
        title: "All Expired Orders Cancelled!",
        description: `Successfully cancelled ${expiredOrders.length} expired order(s). Tokens have been returned to your wallet.`,
        variant: "success",
        action: txHash ? (
          <a
            href={getBlockExplorerTxUrl(chainId, txHash)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-white hover:underline font-medium"
          >
            View Tx
          </a>
        ) : undefined,
      });

      // Navigate to cancelled tab
      const firstOrder = expiredOrders[0];
      const sellTokenAddress = firstOrder.orderDetailsWithID.orderDetails.sellToken;
      const isMaxiDeal = maxiTokenAddresses.some(addr =>
        addr.toLowerCase() === sellTokenAddress.toLowerCase()
      );

      setTokenFilter(isMaxiDeal ? 'maxi' : 'non-maxi');
      setOwnershipFilter('mine');
      setStatusFilter('cancelled');
      setExpandedPositions(new Set());

      // Refresh the orders
      refetch();

      setCancelAllError('');

    } catch (error: any) {
      const errorMsg = simplifyErrorMessage(error) || 'Failed to cancel expired orders';
      setCancelAllError(errorMsg);

      // Show error toast
      toast({
        title: "Batch Cancel Failed",
        description: errorMsg,
        variant: "destructive",
      });
    } finally {
      setIsCancellingAll(false);
      setTransactionPending(false);
    }
  };

  const handleEditOrder = (order: any) => {
    const orderId = order.orderDetailsWithID.orderID.toString();
    setEditingOrder(orderId);

    // Initialize form data with current order values
    const sellTokenInfo = getTokenInfo(order.orderDetailsWithID.orderDetails.sellToken);
    const sellAmount = formatTokenAmount(
      order.orderDetailsWithID.orderDetails.sellAmount,
      sellTokenInfo.decimals
    );

    const buyAmounts: { [tokenIndex: string]: string } = {};
    order.orderDetailsWithID.orderDetails.buyTokensIndex.forEach((tokenIndex: bigint, i: number) => {
      const tokenInfo = getTokenInfoByIndex(Number(tokenIndex));
      const amount = formatTokenAmount(
        order.orderDetailsWithID.orderDetails.buyAmounts[i],
        tokenInfo.decimals
      );
      buyAmounts[tokenIndex.toString()] = amount;
    });

    const expirationDate = new Date(order.orderDetailsWithID.orderDetails.expirationTime * 1000);
    const expirationTime = expirationDate.toISOString().slice(0, 16); // YYYY-MM-DDTHH:MM format

    setEditFormData({
      sellAmount,
      buyAmounts,
      expirationTime
    });
  };

  const handleSaveOrder = async (order: any) => {
    const orderId = order.orderDetailsWithID.orderID.toString();

    if (updatingOrders.has(orderId)) return;

    if (!publicClient) {
      toast({
        title: "Error",
        description: "Public client not available",
        variant: "destructive"
      });
      return;
    }

    setUpdatingOrders(prev => new Set(prev).add(orderId));
    setUpdateErrors(prev => ({ ...prev, [orderId]: '' }));
    setTransactionPending(true);

    try {
      // Get the new expiration time from edit form
      const newExpiration = BigInt(editFormData.expirationTime);

      // Call updateOrderExpiration
      const txHash = await updateOrderExpiration(
        order.orderDetailsWithID.orderID,
        newExpiration
      );

      // Wait for transaction confirmation
      const receipt = await waitForTransactionWithTimeout(
        publicClient,
        txHash as `0x${string}`,
        TRANSACTION_TIMEOUTS.TRANSACTION
      );

      // Show success toast
      toast({
        title: "Order Updated!",
        description: "Your order expiration has been updated successfully.",
        variant: "success",
        action: txHash ? (
          <a
            href={getBlockExplorerTxUrl(chainId, txHash)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-white hover:underline font-medium"
          >
            View Tx
          </a>
        ) : undefined,
      });

      // Clear form and close edit mode
      setEditingOrder(null);
      setEditFormData({ sellAmount: '', buyAmounts: {}, expirationTime: '' });

      // Refresh orders
      refetch();

      // Clear any previous errors
      setUpdateErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[orderId];
        return newErrors;
      });

    } catch (error: any) {
      const errorMsg = simplifyErrorMessage(error) || 'Failed to update order';
      setUpdateErrors(prev => ({
        ...prev,
        [orderId]: errorMsg
      }));

      // Show error toast
      toast({
        title: "Update Failed",
        description: errorMsg,
        variant: "destructive",
      });
    } finally {
      setUpdatingOrders(prev => {
        const newSet = new Set(prev);
        newSet.delete(orderId);
        return newSet;
      });
      setTransactionPending(false);
    }
  };

  // Handler for quick expiration update from calendar popup
  const handleQuickExpirationUpdate = async (orderId: string) => {
    if (!selectedExpirationDate || !publicClient) {
      toast({
        title: "Error",
        description: "Please select a valid date",
        variant: "destructive"
      });
      return;
    }

    if (updatingOrders.has(orderId)) return;

    setUpdatingOrders(prev => new Set(prev).add(orderId));
    setUpdateErrors(prev => ({ ...prev, [orderId]: '' }));
    setTransactionPending(true);
    setShowExpirationCalendar(null);

    try {
      // Convert date to Unix timestamp (seconds)
      const newExpiration = BigInt(Math.floor(selectedExpirationDate.getTime() / 1000));

      // Call updateOrderExpiration
      const txHash = await updateOrderExpiration(
        BigInt(orderId),
        newExpiration
      );

      // Wait for transaction confirmation
      await waitForTransactionWithTimeout(
        publicClient,
        txHash as `0x${string}`,
        TRANSACTION_TIMEOUTS.TRANSACTION
      );

      // Show success toast
      toast({
        title: "Expiration Updated!",
        description: `Order will now expire on ${selectedExpirationDate.toLocaleDateString()}`,
        variant: "success",
        action: txHash ? (
          <a
            href={getBlockExplorerTxUrl(chainId, txHash)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-white hover:underline font-medium"
          >
            View Tx
          </a>
        ) : undefined,
      });

      // Refresh orders
      refetch();

    } catch (error: any) {
      const errorMsg = simplifyErrorMessage(error) || 'Failed to update order expiration';
      setUpdateErrors(prev => ({
        ...prev,
        [orderId]: errorMsg
      }));

      toast({
        title: "Update Failed",
        description: errorMsg,
        variant: "destructive"
      });
    } finally {
      setUpdatingOrders(prev => {
        const newSet = new Set(prev);
        newSet.delete(orderId);
        return newSet;
      });
      setTransactionPending(false);
      setSelectedExpirationDate(undefined);
    }
  };

  // Memoize the display orders with 3-level filtering
  const displayOrders = useMemo(() => {
    if (!allOrders) return [];

    // Filter orders (positions only - no order history)
    let orders = allOrders;

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
          order.orderDetailsWithID.status === 0 &&
          Number(order.orderDetailsWithID.orderDetails.expirationTime) >= Math.floor(Date.now() / 1000)
        );
        break;
      case 'expired':
        filteredOrders = orders.filter(order =>
          order.orderDetailsWithID.status === 0 &&
          Number(order.orderDetailsWithID.orderDetails.expirationTime) < Math.floor(Date.now() / 1000)
        );
        break;
      case 'completed':
        filteredOrders = orders.filter(order =>
          order.orderDetailsWithID.status === 2
        );
        break;
      case 'cancelled':
        filteredOrders = orders.filter(order =>
          order.orderDetailsWithID.status === 1
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
        const sellTokenInfo = getTokenInfo(order.orderDetailsWithID.orderDetails.sellToken);
        const sellTicker = sellTokenInfo.ticker.toLowerCase();

        // Get buy token info(s)
        const buyTokensMatch = order.orderDetailsWithID.orderDetails.buyTokensIndex.some(tokenIndex => {
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
          const aSellTokenAddress = a.orderDetailsWithID.orderDetails.sellToken;
          const bSellTokenAddress = b.orderDetailsWithID.orderDetails.sellToken;
          const aSellTokenInfo = getTokenInfo(aSellTokenAddress);
          const bSellTokenInfo = getTokenInfo(bSellTokenAddress);
          const aTokenAmount = parseFloat(formatTokenAmount(a.orderDetailsWithID.orderDetails.sellAmount, aSellTokenInfo.decimals));
          const bTokenAmount = parseFloat(formatTokenAmount(b.orderDetailsWithID.orderDetails.sellAmount, bSellTokenInfo.decimals));
          const aTokenPrice = getTokenPrice(aSellTokenAddress, tokenPrices);
          const bTokenPrice = getTokenPrice(bSellTokenAddress, tokenPrices);
          const aUsdValue = aTokenAmount * aTokenPrice;
          const bUsdValue = bTokenAmount * bTokenPrice;
          comparison = aUsdValue - bUsdValue;
          break;
        case 'askingFor':
          const aAsking = a.orderDetailsWithID.orderDetails.buyTokensIndex.length;
          const bAsking = b.orderDetailsWithID.orderDetails.buyTokensIndex.length;
          comparison = aAsking - bAsking;
          break;
        case 'progress':
          const aProgress = 100 - ((Number(getRemainingPercentage(a.orderDetailsWithID)) / 1e18) * 100);
          const bProgress = 100 - ((Number(getRemainingPercentage(b.orderDetailsWithID)) / 1e18) * 100);
          comparison = aProgress - bProgress;
          break;
        case 'owner':
          comparison = a.userDetails.orderOwner.localeCompare(b.userDetails.orderOwner);
          break;
        case 'status':
          comparison = a.orderDetailsWithID.status - b.orderDetailsWithID.status;
          break;
        case 'date':
          comparison = Number(a.orderDetailsWithID.orderDetails.expirationTime) - Number(b.orderDetailsWithID.orderDetails.expirationTime);
          break;
        case 'backingPrice':
          const aBackingPrice = (() => {
            const sellTokenInfo = getTokenInfo(a.orderDetailsWithID.orderDetails.sellToken);
            const sellTokenKey = sellTokenInfo.ticker.startsWith('e') ? `e${sellTokenInfo.ticker.slice(1)}` : `p${sellTokenInfo.ticker}`;
            const sellTokenStat = Array.isArray(tokenStats) ? tokenStats.find(stat => stat.token.ticker === sellTokenKey) : null;
            return sellTokenStat?.token?.backingPerToken || 0;
          })();
          const bBackingPrice = (() => {
            const sellTokenInfo = getTokenInfo(b.orderDetailsWithID.orderDetails.sellToken);
            const sellTokenKey = sellTokenInfo.ticker.startsWith('e') ? `e${sellTokenInfo.ticker.slice(1)}` : `p${sellTokenInfo.ticker}`;
            const sellTokenStat = Array.isArray(tokenStats) ? tokenStats.find(stat => stat.token.ticker === sellTokenKey) : null;
            return sellTokenStat?.token?.backingPerToken || 0;
          })();
          comparison = aBackingPrice - bBackingPrice;
          break;
        case 'currentPrice':
          const aCurrentPrice = (() => {
            const sellTokenInfo = getTokenInfo(a.orderDetailsWithID.orderDetails.sellToken);
            const sellTokenKey = sellTokenInfo.ticker.startsWith('e') ? `e${sellTokenInfo.ticker.slice(1)}` : `p${sellTokenInfo.ticker}`;
            const sellTokenStat = Array.isArray(tokenStats) ? tokenStats.find(stat => stat.token.ticker === sellTokenKey) : null;
            return sellTokenStat?.token?.priceHEX || 0;
          })();
          const bCurrentPrice = (() => {
            const sellTokenInfo = getTokenInfo(b.orderDetailsWithID.orderDetails.sellToken);
            const sellTokenKey = sellTokenInfo.ticker.startsWith('e') ? `e${sellTokenInfo.ticker.slice(1)}` : `p${sellTokenInfo.ticker}`;
            const sellTokenStat = Array.isArray(tokenStats) ? tokenStats.find(stat => stat.token.ticker === sellTokenKey) : null;
            return sellTokenStat?.token?.priceHEX || 0;
          })();
          comparison = aCurrentPrice - bCurrentPrice;
          break;
        case 'otcVsMarket':
          // Calculate limit price vs market percentage for order A
          const aLimitPercentage = (() => {
            const sellTokenAddress = a.orderDetailsWithID.orderDetails.sellToken;
            const sellTokenInfo = getTokenInfo(sellTokenAddress);
            const rawRemainingPercentage = getRemainingPercentage(a.orderDetailsWithID);
            const remainingPercentage = Number(rawRemainingPercentage) / 1e18;
            const originalSellAmount = a.orderDetailsWithID.orderDetails.sellAmount;
            const isCompletedOrCancelled = a.orderDetailsWithID.status === 2 || a.orderDetailsWithID.status === 1;
            const sellAmountToUse = isCompletedOrCancelled
              ? originalSellAmount
              : (originalSellAmount * BigInt(Math.floor(remainingPercentage * 1e18))) / BigInt(1e18);
            const sellTokenAmount = parseFloat(formatTokenAmount(sellAmountToUse, sellTokenInfo.decimals));
            const sellTokenPrice = getTokenPrice(sellTokenAddress, tokenPrices);
            const sellUsdValue = sellTokenAmount * sellTokenPrice;

            // Get buy tokens data for calculations
            const buyTokensIndex = a.orderDetailsWithID.orderDetails.buyTokensIndex;
            const buyAmounts = a.orderDetailsWithID.orderDetails.buyAmounts;

            if (buyTokensIndex && buyAmounts && Array.isArray(buyTokensIndex) && Array.isArray(buyAmounts) && buyTokensIndex.length > 0) {
              const firstBuyTokenIndex = Number(buyTokensIndex[0]);
              const firstBuyTokenInfo = getTokenInfoByIndex(firstBuyTokenIndex);
              const firstBuyAmount = buyAmounts[0];

              const buyAmountToUse = isCompletedOrCancelled
                ? firstBuyAmount
                : (firstBuyAmount * BigInt(Math.floor(remainingPercentage * 1e18))) / BigInt(1e18);

              const buyTokenAmount = parseFloat(formatTokenAmount(buyAmountToUse, firstBuyTokenInfo.decimals));
              const buyTokenMarketPrice = getTokenPrice(firstBuyTokenInfo.address, tokenPrices);

              if (sellUsdValue > 0 && buyTokenAmount > 0 && buyTokenMarketPrice > 0) {
                const limitBuyTokenPrice = sellUsdValue / buyTokenAmount;
                return ((limitBuyTokenPrice - buyTokenMarketPrice) / buyTokenMarketPrice) * 100;
              }
            }
            return -Infinity; // Orders without percentage go to the end
          })();

          // Calculate limit price vs market percentage for order B
          const bLimitPercentage = (() => {
            const sellTokenAddress = b.orderDetailsWithID.orderDetails.sellToken;
            const sellTokenInfo = getTokenInfo(sellTokenAddress);
            const rawRemainingPercentage = getRemainingPercentage(b.orderDetailsWithID);
            const remainingPercentage = Number(rawRemainingPercentage) / 1e18;
            const originalSellAmount = b.orderDetailsWithID.orderDetails.sellAmount;
            const isCompletedOrCancelled = b.orderDetailsWithID.status === 2 || b.orderDetailsWithID.status === 1;
            const sellAmountToUse = isCompletedOrCancelled
              ? originalSellAmount
              : (originalSellAmount * BigInt(Math.floor(remainingPercentage * 1e18))) / BigInt(1e18);
            const sellTokenAmount = parseFloat(formatTokenAmount(sellAmountToUse, sellTokenInfo.decimals));
            const sellTokenPrice = getTokenPrice(sellTokenAddress, tokenPrices);
            const sellUsdValue = sellTokenAmount * sellTokenPrice;

            // Use first buy token for price comparison
            const buyTokensIndex = b.orderDetailsWithID.orderDetails.buyTokensIndex;
            const buyAmounts = b.orderDetailsWithID.orderDetails.buyAmounts;

            if (buyTokensIndex && buyAmounts && Array.isArray(buyTokensIndex) && Array.isArray(buyAmounts) && buyTokensIndex.length > 0) {
              const firstBuyTokenIndex = Number(buyTokensIndex[0]);
              const firstBuyTokenInfo = getTokenInfoByIndex(firstBuyTokenIndex);
              const firstBuyAmount = buyAmounts[0];

              const buyAmountToUse = isCompletedOrCancelled
                ? firstBuyAmount
                : (firstBuyAmount * BigInt(Math.floor(remainingPercentage * 1e18))) / BigInt(1e18);

              const buyTokenAmount = parseFloat(formatTokenAmount(buyAmountToUse, firstBuyTokenInfo.decimals));
              const buyTokenMarketPrice = getTokenPrice(firstBuyTokenInfo.address, tokenPrices);

              if (sellUsdValue > 0 && buyTokenAmount > 0 && buyTokenMarketPrice > 0) {
                const limitBuyTokenPrice = sellUsdValue / buyTokenAmount;
                return ((limitBuyTokenPrice - buyTokenMarketPrice) / buyTokenMarketPrice) * 100;
              }
            }
            return -Infinity; // Orders without percentage go to the end
          })();

          comparison = aLimitPercentage - bLimitPercentage;
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
    const status = order.orderDetailsWithID.status;
    const expirationTime = Number(order.orderDetailsWithID.orderDetails.expirationTime);
    const currentTime = Math.floor(Date.now() / 1000);

    if (status === 0 && expirationTime < currentTime) {
      return 'Expired';
    }

    switch (status) {
      case 0: return 'Active';
      case 1: return 'Cancelled';
      case 2: return 'Completed';
      default: return 'Unknown';
    }
  };

  const getStatusColor = (order: any) => {
    const status = order.orderDetailsWithID.status;
    const expirationTime = Number(order.orderDetailsWithID.orderDetails.expirationTime);
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
    // Return all orders - no longer filtering by token type
    return allOrders;
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

  const getLevel3Orders = (tokenType: 'maxi' | 'non-maxi', ownership: 'mine' | 'non-mine', status: 'active' | 'expired' | 'completed' | 'cancelled' | 'order-history') => {
    const level2Orders = getLevel2Orders(tokenType, ownership);
    switch (status) {
      case 'active':
        return level2Orders.filter(order =>
          order.orderDetailsWithID.status === 0 &&
          Number(order.orderDetailsWithID.orderDetails.expirationTime) >= Math.floor(Date.now() / 1000)
        );
      case 'expired':
        return level2Orders.filter(order =>
          order.orderDetailsWithID.status === 0 &&
          Number(order.orderDetailsWithID.orderDetails.expirationTime) < Math.floor(Date.now() / 1000)
        );
      case 'completed':
        return level2Orders.filter(order => order.orderDetailsWithID.status === 2);
      case 'cancelled':
        return level2Orders.filter(order => order.orderDetailsWithID.status === 1);
      case 'order-history':
        // For order history, count transactions (not unique orders) with token filter applied
        if (ownership === 'mine') {
          const filteredTransactions = purchaseTransactions.filter(transaction => {
            const baseOrder = allOrders.find(order =>
              order.orderDetailsWithID.orderID.toString() === transaction.orderID
            );
            if (!baseOrder) return false;

            // Apply token filter
            if (tokenType === 'maxi') {
              const sellToken = baseOrder.orderDetailsWithID.orderDetails.sellToken.toLowerCase();
              const sellTokenInList = maxiTokenAddresses.some(addr => sellToken === addr.toLowerCase());
              const buyTokensInList = baseOrder.orderDetailsWithID.orderDetails.buyTokensIndex.some((buyTokenIndex: bigint) => {
                const buyTokenInfo = getTokenInfoByIndex(Number(buyTokenIndex));
                const buyTokenAddress = buyTokenInfo?.address?.toLowerCase() || '';
                return maxiTokenAddresses.some(addr => buyTokenAddress === addr.toLowerCase());
              });
              return sellTokenInList || buyTokensInList;
            } else if (tokenType === 'non-maxi') {
              const sellToken = baseOrder.orderDetailsWithID.orderDetails.sellToken.toLowerCase();
              const sellTokenInList = maxiTokenAddresses.some(addr => sellToken === addr.toLowerCase());
              const buyTokensInList = baseOrder.orderDetailsWithID.orderDetails.buyTokensIndex.some((buyTokenIndex: bigint) => {
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
    const MAXI_TOKENS = [
      '0x0d86eb9f43c57f6ff3bc9e23d8f9d82503f0e84b', // pMAXI
      '0x6b32022693210cd2cfc466b9ac0085de8fc34ea6', // pDECI
      '0x3ec6435afe50db04d3e1c9f1f37e1bc3e92e8c82', // pLUCKY
      '0x28de5c10def00e4c0e3851e5b3b0d1e88daaaa38', // pTRIO
      '0xc2663d79e0a4e46c0f3ef11e28b60d74b93c2adf', // pBASE
    ];

    return allOrders.filter(order => {
      const sellTokenAddress = order.orderDetailsWithID.orderDetails.sellToken;
      return MAXI_TOKENS.includes(sellTokenAddress.toLowerCase());
    });
  }, [allOrders]);

  // Show nothing if wallet not connected (unless in marketplace mode)
  if (!mounted || (!address && !isMarketplaceMode)) {
    return null;
  }

  // Loading state - only for initial load when connected
  if (isTableLoading) {
    return (
      <div className="bg-black text-white relative overflow-hidden">
        <div className="max-w-[1000px] mx-auto w-full relative">
          <div
            className="bg-black border-0 border-white/10 rounded-full p-6 text-center max-w-[660px] w-full mx-auto"
          >
            <div className="flex items-center justify-center gap-3 text-gray-400 text-base md:text-lg">
              <PixelSpinner size={20} />
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
            <p className="font-semibold mb-2">Unable to connect to the AgoráX contract</p>
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


  // For landing page mode, only show top 10 active orders
  const landingPageOrders = isLandingPageMode ? displayOrders.slice(0, 10) : displayOrders;

  return (
    <LiquidGlassCard
      className={`w-full max-w-[1200px] mx-auto mb-6 mt-2 p-0 ${isLandingPageMode ? 'relative mx-2 md:mx-auto' : ''}`}
      shadowIntensity="sm"
      glowIntensity="sm"
      blurIntensity="xl"
    >
      {/* Scroll shadow indicators for landing page */}
      {isLandingPageMode && canScrollLeft && (
        <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-black/60 to-transparent z-10 md:hidden" />
      )}
      {isLandingPageMode && canScrollRight && (
        <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-black/60 to-transparent z-10 md:hidden" />
      )}
      <div
        ref={isLandingPageMode ? scrollContainerRef : undefined}
        onScroll={isLandingPageMode ? handleScroll : undefined}
        className={`p-4 md:p-6 ${isLandingPageMode ? 'overflow-x-scroll pb-0 modern-scrollbar' : ''}`}
      >
      {/* Status filter buttons - hide in landing page mode */}
      {!isLandingPageMode && (
      <div className="flex flex-wrap justify-start gap-3 mb-6">
        <button
          onClick={() => {
            setStatusFilter('active');
            clearExpandedPositions();
          }}
          className={`px-4 md:px-6 py-2 transition-all duration-100 border whitespace-nowrap text-sm md:text-base rounded-full font-medium ${statusFilter === 'active'
            ? 'bg-white text-black border-white/10'
            : 'bg-black/40 text-gray-300 border-white/10 hover:bg-white/10 hover:text-white'
            }`}
        >
          Active ({getLevel3Orders(tokenFilter, ownershipFilter, 'active').length})
        </button>
        <button
          onClick={() => {
            setStatusFilter('expired');
            clearExpandedPositions();
          }}
          className={`px-4 md:px-6 py-2 transition-all duration-100 border whitespace-nowrap text-sm md:text-base rounded-full font-medium ${statusFilter === 'expired'
            ? 'bg-white text-black border-white/10'
            : 'bg-black/40 text-gray-300 border-white/10 hover:bg-white/10 hover:text-white'
            }`}
        >
          Expired ({getLevel3Orders(tokenFilter, ownershipFilter, 'expired').length})
        </button>
        <button
          onClick={() => {
            setStatusFilter('completed');
            clearExpandedPositions();
          }}
          className={`px-4 md:px-6 py-2 transition-all duration-100 border whitespace-nowrap text-sm md:text-base rounded-full font-medium ${statusFilter === 'completed'
            ? 'bg-white text-black border-white/10'
            : 'bg-black/40 text-gray-300 border-white/10 hover:bg-white/10 hover:text-white'
            }`}
        >
          Completed ({getLevel3Orders(tokenFilter, ownershipFilter, 'completed').length})
        </button>
        <button
          onClick={() => {
            setStatusFilter('cancelled');
            clearExpandedPositions();
          }}
          className={`px-4 md:px-6 py-2 transition-all duration-100 border whitespace-nowrap text-sm md:text-base rounded-full font-medium ${statusFilter === 'cancelled'
            ? 'bg-white text-black border-white/10'
            : 'bg-black/40 text-gray-300 border-white/10 hover:bg-white/10 hover:text-white'
            }`}
        >
          Cancelled ({getLevel3Orders(tokenFilter, ownershipFilter, 'cancelled').length})
        </button>
        <button
          onClick={() => {
            setStatusFilter('order-history');
            clearExpandedPositions();
          }}
          className={`px-4 md:px-6 py-2 transition-all duration-100 border whitespace-nowrap text-sm md:text-base rounded-full font-medium ${statusFilter === 'order-history'
            ? 'bg-white text-black border-white/10'
            : 'bg-black/40 text-gray-300 border-white/10 hover:bg-white/10 hover:text-white'
            }`}
        >
          Tx History ({purchaseTransactions.length})
        </button>
      </div>
      )}

      {/* Cancel All Expired Button - Show only in Expired tab for My Deals */}
      {!isLandingPageMode && ownershipFilter === 'mine' && statusFilter === 'expired' && (() => {
        const expiredCount = getLevel3Orders(tokenFilter, ownershipFilter, 'expired').length;

        return expiredCount > 0 && (
          <div className="mb-4 flex items-center gap-4">
            <button
              onClick={handleCancelAllExpired}
              disabled={isCancellingAll}
              className="px-4 py-2 bg-red-700 text-white rounded-full hover:bg-orange-600 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isCancellingAll ? (
                <>
                  <PixelSpinner size={16} />
                  Loading
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 text-white" />
                  Cancel All Expired Orders ({expiredCount})
                </>
              )}
            </button>
            {cancelAllError && (
              <div className="text-red-400 text-sm">
                {cancelAllError}
              </div>
            )}
          </div>
        );
      })()}

      {/* Search Bar - hide in landing page mode */}
      {!isLandingPageMode && (
      <div className="mb-6 w-full max-w-[480px]">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-black/40 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-white/30 focus:bg-black/60 transition-colors shadow-sm rounded-lg"
          />
        </div>
      </div>
      )}
      {/* Render separate OrderHistoryTable component for order history */}
      {!isLandingPageMode && statusFilter === 'order-history' ? (
        <div className="overflow-x-auto scrollbar-hide -mx-6 px-6">
          <OrderHistoryTable
            purchaseTransactions={purchaseTransactions}
            allOrders={ordersForHistory.length > 0 ? ordersForHistory : (allOrders || [])}
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
              <div
                className={`grid grid-cols-[minmax(120px,1.5fr)_minmax(120px,1.5fr)_minmax(80px,1fr)_minmax(100px,1.2fr)_minmax(80px,1fr)_minmax(80px,1fr)_minmax(100px,auto)] items-center gap-4 pb-4 border-b border-white/10 ${expandedPositions.size > 0 ? 'opacity-90' : 'opacity-100'
                  }`}
              >
                {/* COLUMN 1: Token For Sale */}
                <button
                  onClick={() => handleSort('sellAmount')}
                  className={`text-sm font-medium text-left hover:text-white transition-colors ${sortField === 'sellAmount' ? 'text-white' : 'text-white/60'
                    }`}
                >
                  {statusFilter === 'completed' ? 'Sold' : 'For sale'} {sortField === 'sellAmount' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
                </button>

                {/* COLUMN 2: Asking For */}
                <button
                  onClick={() => handleSort('askingFor')}
                  className={`text-sm font-medium text-left hover:text-white transition-colors ${sortField === 'askingFor' ? 'text-white' : 'text-white/60'
                    }`}
                >
                  {statusFilter === 'completed' ? 'Bought' : 'Asking for'} {sortField === 'askingFor' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
                </button>

                {/* COLUMN 3: Fill Status % */}
                <button
                  onClick={() => handleSort('progress')}
                  className={`text-sm font-medium text-center hover:text-white transition-colors ${sortField === 'progress' ? 'text-white' : 'text-white/60'
                    }`}
                >
                  Fill status % {sortField === 'progress' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
                </button>

                {/* COLUMN 4: OTC % */}
                <button
                  onClick={() => handleSort('otcVsMarket')}
                  className={`text-sm font-medium text-center hover:text-white transition-colors ${sortField === 'otcVsMarket' ? 'text-white' : 'text-white/60'
                    }`}
                >
                  Limit order position {sortField === 'otcVsMarket' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
                </button>

                {/* COLUMN 5: Status */}
                <button
                  onClick={() => handleSort('status')}
                  className={`text-sm font-medium text-center hover:text-white transition-colors ${sortField === 'status' ? 'text-white' : 'text-white/60'
                    }`}
                >
                  Status {sortField === 'status' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
                </button>

                {/* COLUMN 7: Expires / Expired */}
                <button
                  onClick={() => handleSort('date')}
                  className={`text-sm font-medium text-center hover:text-white transition-colors ${sortField === 'date' ? 'text-white' : 'text-white/60'
                    }`}
                >
                  {statusFilter === 'expired' ? 'Expired' : 'Expires'} {sortField === 'date' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
                </button>

                {/* COLUMN 8: Actions / Order ID */}
                <div className="text-sm font-medium text-center text-white/60">
                  {(statusFilter === 'completed' || statusFilter === 'cancelled') ? 'Order ID' : ''}
                </div>
              </div>

              {/* Table Rows */}
              <div
                className={`space-y-1 ${expandedPositions.size > 0 ? 'pt-0' : ''}`}
              >
                {landingPageOrders.map((order, index) => {
                  const orderId = order.orderDetailsWithID.orderID.toString();
                  const isExpanded = expandedPositions.has(orderId);
                  const hasAnyExpanded = expandedPositions.size > 0;
                  const shouldShow = !hasAnyExpanded || isExpanded;

                  // Don't render at all if shouldn't show
                  if (!shouldShow) return null;

                  // Calculate USD values for percentage calculation
                  const sellTokenAddress = order.orderDetailsWithID.orderDetails.sellToken;
                  const sellTokenInfo = getTokenInfo(sellTokenAddress);
                  const rawRemainingPercentage = getRemainingPercentage(order.orderDetailsWithID);
                  const remainingPercentage = Number(rawRemainingPercentage) / 1e18;
                  const originalSellAmount = order.orderDetailsWithID.orderDetails.sellAmount;

                  // For completed/cancelled orders, use original amounts; for active, use remaining
                  const isCompletedOrCancelled = order.orderDetailsWithID.status === 2 || order.orderDetailsWithID.status === 1;
                  const sellAmountToUse = isCompletedOrCancelled
                    ? originalSellAmount
                    : (originalSellAmount * BigInt(Math.floor(remainingPercentage * 1e18))) / BigInt(1e18);

                  const sellTokenAmount = parseFloat(formatTokenAmount(sellAmountToUse, sellTokenInfo.decimals));
                  const sellTokenPrice = getTokenPrice(sellTokenAddress, tokenPrices);
                  const sellUsdValue = sellTokenAmount * sellTokenPrice;

                  // Calculate minimum asking USD value (buyer can choose any token, so use the cheapest)
                  let askingUsdValue = 0;
                  const buyTokensIndex = order.orderDetailsWithID.orderDetails.buyTokensIndex;
                  const buyAmounts = order.orderDetailsWithID.orderDetails.buyAmounts;

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

                  // Calculate how much below/above market the seller is pricing their token
                  // Matches the form's calculation using USD-based comparison
                  let percentageDifference = null;
                  let isBelowMarket = false;

                  // Calculate the effective price per buy token (first buy token)
                  if (buyTokensIndex && buyAmounts && Array.isArray(buyTokensIndex) && Array.isArray(buyAmounts) && buyTokensIndex.length > 0) {
                    const firstBuyTokenIndex = Number(buyTokensIndex[0]);
                    const firstBuyTokenInfo = getTokenInfoByIndex(firstBuyTokenIndex);
                    const firstBuyAmount = buyAmounts[0];

                    const buyAmountToUse = isCompletedOrCancelled
                      ? firstBuyAmount
                      : (firstBuyAmount * BigInt(Math.floor(remainingPercentage * 1e18))) / BigInt(1e18);

                    const buyTokenAmount = parseFloat(formatTokenAmount(buyAmountToUse, firstBuyTokenInfo.decimals));
                    const buyTokenMarketPrice = getTokenPrice(firstBuyTokenInfo.address, tokenPrices);

                    if (sellUsdValue > 0 && buyTokenAmount > 0 && buyTokenMarketPrice > 0) {
                      const limitBuyTokenPrice = sellUsdValue / buyTokenAmount;
                      const marketBuyTokenPrice = buyTokenMarketPrice;

                      percentageDifference = ((limitBuyTokenPrice - marketBuyTokenPrice) / marketBuyTokenPrice) * 100;
                      isBelowMarket = percentageDifference < 0;
                    }
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
                      className={`grid grid-cols-[minmax(120px,1.5fr)_minmax(120px,1.5fr)_minmax(80px,1fr)_minmax(100px,1.2fr)_minmax(80px,1fr)_minmax(80px,1fr)_minmax(100px,auto)] items-start gap-4 py-8 ${index < displayOrders.length - 1 && !expandedPositions.has(orderId) ? 'border-b border-white/10' : ''
                        }`}
                    >
                      {/* COLUMN 1: Token For Sale Content */}
                      <div className="flex flex-col items-start space-y-1 min-w-0 overflow-hidden">
                        {(() => {
                          const formattedAmount = formatTokenAmount(order.orderDetailsWithID.orderDetails.sellAmount, sellTokenInfo.decimals);
                          // For completed orders, show original amounts; for others, show remaining amounts
                          const isCompleted = statusFilter === 'completed' || order.orderDetailsWithID.status === 1;

                          let tokenAmount: number;
                          if (isCompleted) {
                            // Use original amount for completed orders
                            tokenAmount = parseFloat(formatTokenAmount(order.orderDetailsWithID.orderDetails.sellAmount, sellTokenInfo.decimals));
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
                              <div className="w-1/2 h-px bg-[rgba(255, 255, 255, 1)]/5 my-2"></div>
                              <div className="flex items-center space-x-2">
                                <TokenLogo
                                  src={getTokenInfo(order.orderDetailsWithID.orderDetails.sellToken).logo}
                                  alt={formatTokenTicker(getTokenInfo(order.orderDetailsWithID.orderDetails.sellToken).ticker)}
                                  className="w-6 h-6 "
                                />
                                <div className="flex flex-col">
                                  <span className="text-white text-sm font-medium whitespace-nowrap">
                                    {formatTokenTicker(getTokenInfo(order.orderDetailsWithID.orderDetails.sellToken).ticker)}
                                  </span>
                                  <span className="text-white/60 text-xs whitespace-nowrap">
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
                          const isCompleted = statusFilter === 'completed' || order.orderDetailsWithID.status === 1;
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
                              <div className="w-1/2 h-px bg-[rgba(255, 255, 255, 1)]/5 my-2"></div>
                              {(() => {
                                // For completed and active orders
                                const hasMultipleTokens = buyTokensIndex.length > 1;
                                return buyTokensIndex.map((tokenIndex: bigint, idx: number) => {
                                  const tokenInfo = getTokenInfoByIndex(Number(tokenIndex));
                                  const originalAmount = buyAmounts[idx];
                                  // For completed orders, show original amounts; for others, show remaining amounts
                                  // Check if we're in completed filter section - if so, always use original amounts
                                  const isCompleted = statusFilter === 'completed' || order.orderDetailsWithID.status === 1;
                                  const remainingPercentage = Number(getRemainingPercentage(order.orderDetailsWithID)) / 1e18;

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
                                        className="w-6 h-6 "
                                      />
                                      <div className="flex flex-col">
                                        <span className="text-white text-sm font-medium whitespace-nowrap">
                                          {formatTokenTicker(tokenInfo.ticker)}
                                        </span>
                                        <span className="text-white/60 text-xs whitespace-nowrap">
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
                      <div className="flex flex-col items-center space-y-1  mt-0.5 min-w-0">
                        {(() => {
                          const fillPercentage = 100 - ((Number(getRemainingPercentage(order.orderDetailsWithID)) / 1e18) * 100);

                          return (
                            <span className={`text-xs ${fillPercentage === 0 ? 'text-gray-500' : 'text-white'}`}>
                              {formatPercentage(fillPercentage)}
                            </span>
                          );
                        })()}
                        <div className="w-[60px] h-2 bg-gray-500 rounded-full overflow-hidden relative">
                          {(() => {
                            const fillPercentage = 100 - ((Number(getRemainingPercentage(order.orderDetailsWithID)) / 1e18) * 100);

                            return (
                              <div
                                className={`h-full transition-all duration-300 ${fillPercentage === 0 ? 'bg-gray-500' : 'bg-[rgba(255, 255, 255, 1)]'} rounded-full`}
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
                            <span className={`font-medium ${isBelowMarket
                              ? 'text-red-400'    // Red - below market (discount)
                              : 'text-green-400'  // Green - above market (premium)
                              }`}>
                              {percentageDifference.toLocaleString('en-US', {
                                maximumFractionDigits: 1,
                                minimumFractionDigits: 1,
                                signDisplay: 'always'
                              })}%
                            </span>
                          ) : (
                            <span className="text-gray-500">--</span>
                          )}
                        </div>
                        {percentageDifference !== null && (
                          <div className="text-xs text-gray-400 mt-0">
                            {isBelowMarket ? 'below market' : 'above market'}
                          </div>
                        )}
                        {/* Add backing price stats as second row */}
                        {backingPriceDiscount !== null && (
                          <div className="text-xs text-gray-400 mt-1">
                            {(PAYWALL_ENABLED && !hasTokenAccess) ? (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShowPaywallModal(true);
                                }}
                                className="inline-flex items-center justify-center hover:opacity-80 transition-opacity"
                              >
                                <Lock className="w-4 h-4 text-gray-400 hover:text-white" />
                              </button>
                            ) : (
                              <>
                                {isAboveBackingPrice
                                  ? `+${Math.abs(backingPriceDiscount).toLocaleString('en-US', { maximumFractionDigits: 0 })}%`
                                  : `-${Math.abs(backingPriceDiscount).toLocaleString('en-US', { maximumFractionDigits: 0 })}%`
                                } vs backing
                              </>
                            )}
                          </div>
                        )}
                      </div>

                      {/* COLUMN 5: Status Content */}
                      <div className="text-center min-w-0 mt-1">
                        <span className={`px-3 py-2 rounded-full text-sm font-medium border ${getStatusText(order) === 'Expired'
                          ? 'bg-yellow-500/20 text-yellow-400 border-yellow-400'
                          : order.orderDetailsWithID.status === 0
                            ? 'bg-green-500/20 text-green-400 border-green-400'
                            : order.orderDetailsWithID.status === 1
                              ? 'bg-red-500/20 text-red-400 border-red-400'
                              : 'bg-blue-500/20 text-blue-400 border-blue-400'
                          }`}>
                          {getStatusText(order)}
                        </span>
                      </div>

                      {/* COLUMN 7: Expires Content */}
                      <div className="text-gray-400 text-sm text-center min-w-0 mt-1.5">
                        {formatTimestamp(Number(order.orderDetailsWithID.orderDetails.expirationTime))}
                      </div>

                      {/* COLUMN 8: Actions / Order ID Content */}
                      <div className="text-center min-w-0">
                        {(statusFilter === 'completed' || statusFilter === 'cancelled') ? (
                          <div className="text-gray-400 mt-1.5 text-sm">{order.orderDetailsWithID.orderID.toString()}</div>
                        ) : (
                          <>
                            {ownershipFilter === 'mine' && order.orderDetailsWithID.status === 0 ? (
                              <div className="flex items-center gap-2 justify-center">
                                {/* Collect Proceeds Button - Show if there are proceeds to collect */}
                                {(() => {
                                  const sellAmount = order.orderDetailsWithID.orderDetails.sellAmount;
                                  const filled = sellAmount - order.orderDetailsWithID.remainingSellAmount;
                                  const hasProceeds = filled > order.orderDetailsWithID.redeemedSellAmount;
                                  return hasProceeds && (
                                    <button
                                      onClick={() => handleCollectProceeds(order)}
                                      disabled={collectingOrders.has(order.orderDetailsWithID.orderID.toString())}
                                      className="p-2 -mt-1.5 rounded hover:bg-green-700/50 transition-colors disabled:opacity-50"
                                      title="Collect Proceeds"
                                    >
                                      {collectingOrders.has(order.orderDetailsWithID.orderID.toString()) ? (
                                        <PixelSpinner size={20} className="mx-auto" />
                                      ) : (
                                        <CircleDollarSign className="w-5 h-5 text-green-400 hover:text-green-300 mx-auto" />
                                      )}
                                    </button>
                                  );
                                })()}

                                {/* Edit Expiration Button */}
                                <button
                                  onClick={() => {
                                    const orderId = order.orderDetailsWithID.orderID.toString();
                                    setShowExpirationCalendar(orderId);
                                    // Set current expiration as default
                                    const currentExpiration = Number(order.orderDetailsWithID.orderDetails.expirationTime) * 1000;
                                    setSelectedExpirationDate(new Date(currentExpiration));
                                  }}
                                  disabled={updatingOrders.has(order.orderDetailsWithID.orderID.toString())}
                                  className="p-2 -mt-1.5 rounded hover:bg-blue-700/50 transition-colors disabled:opacity-50"
                                  title="Update Expiration"
                                >
                                  {updatingOrders.has(order.orderDetailsWithID.orderID.toString()) ? (
                                    <PixelSpinner size={20} className="mx-auto" />
                                  ) : (
                                    <CalendarDays className="w-5 h-5 text-blue-400 hover:text-blue-300 mx-auto" />
                                  )}
                                </button>

                                {/* Cancel/Delete Button */}
                                <button
                                  onClick={() => handleCancelOrder(order)}
                                  disabled={cancelingOrders.has(order.orderDetailsWithID.orderID.toString())}
                                  className="p-2 -mt-1.5 rounded hover:bg-gray-700/50 transition-colors disabled:opacity-50"
                                  title="Cancel Order"
                                >
                                  {cancelingOrders.has(order.orderDetailsWithID.orderID.toString()) ? (
                                    <PixelSpinner size={20} className="mx-auto" />
                                  ) : (
                                    <Trash2 className="w-5 h-5 text-red-400 hover:text-red-300 mx-auto" />
                                  )}
                                </button>
                              </div>
                            ) : ownershipFilter === 'non-mine' && order.orderDetailsWithID.status === 0 && statusFilter === 'active' ? (
                              <button
                                onClick={() => togglePositionExpansion(order.orderDetailsWithID.orderID.toString())}
                                className={`flex items-center gap-1 ml-4 px-4 py-2 text-xs rounded-full transition-colors ${expandedPositions.has(order.orderDetailsWithID.orderID.toString())
                                  ? 'bg-transparent border border-white/10 text-white hover:bg-white/10'
                                  : 'bg-white text-black hover:bg-gray-200'
                                  }`}
                              >
                                <span>Buy</span>
                                <ChevronDown
                                  className={`w-3 h-3 transition-transform duration-200 ${expandedPositions.has(order.orderDetailsWithID.orderID.toString()) ? 'rotate-180' : ''
                                    }`}
                                />
                              </button>
                            ) : (
                              // No action button for completed/expired/cancelled orders
                              <div className="w-16 h-8"></div>
                            )}
                          </>
                        )}
                      </div>

                      {/* Expandable Actions Shelf */}
                      {expandedPositions.has(order.orderDetailsWithID.orderID.toString()) && (
                        <div
                          className="col-span-full mt-2 rounded-xl border border-white/20 bg-black/60 backdrop-blur-sm w-full shadow-[0_0_20px_rgba(255,255,255,0.1)]"
                        >
                          <div className="p-3">
                            <div className="flex flex-col space-y-2">
                              <h4 className="text-white font-medium text-xl">Your Trade</h4>

                              {/* Offer Input Fields */}
                              <div className="mt-3 pt-3 border-t border-white/10">
                                <h5 className="text-white font-medium text-sm mb-2">You pay:</h5>
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                  {order.orderDetailsWithID.orderDetails.buyTokensIndex.map((tokenIndex: bigint, idx: number) => {
                                    const tokenInfo = getTokenInfoByIndex(Number(tokenIndex));
                                    const orderId = order.orderDetailsWithID.orderID.toString();
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
                                            className="bg-transparent border border-white/10  px-2 py-1 text-white text-sm w-26 md:w-20 focus:border-white/40 focus:outline-none"
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
                                  const orderId = order.orderDetailsWithID.orderID.toString();
                                  const currentInputs = offerInputs[orderId];
                                  if (!currentInputs) return null;

                                  // Calculate total buy amount (what buyer will pay)
                                  let totalBuyAmount = 0;
                                  let primaryTokenInfo: { ticker: string; name: string; decimals: number; logo: string; address: string; } | null = null;
                                  const buyTokensIndex = order.orderDetailsWithID.orderDetails.buyTokensIndex;
                                  const buyAmounts = order.orderDetailsWithID.orderDetails.buyAmounts;

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
                                    const platformFee = totalBuyAmount * 0.002; // 0.2% fee
                                    const orderOwnerReceives = totalBuyAmount - platformFee;

                                    return (
                                      <div className="mt-4 p-3 bg-white/5 rounded-lg">
                                        <h5 className="text-white font-medium mb-2">Order Breakdown</h5>
                                        <div className="space-y-1 text-sm">
                                          <div className="flex justify-between">
                                            <span className="text-gray-400">Seller Receives:</span>
                                            <div className="flex items-center space-x-1">
                                              <span className="text-white">{orderOwnerReceives.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })}</span>
                                              {primaryTokenInfo !== null && (
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
                                            <span className="text-gray-400">Platform Fee (0.2%):</span>
                                            <div className="flex items-center space-x-1">
                                              <span className="text-white">{platformFee.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })}</span>
                                              {primaryTokenInfo !== null && (
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
                                                <span className="text-white font-bold">{totalBuyAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })}</span>
                                                {primaryTokenInfo !== null && (
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
                                            if (!primaryTokenInfo) return null;

                                            const sellTokenInfo = getTokenInfo(order.orderDetailsWithID.orderDetails.sellToken);
                                            const sellAmount = parseFloat(formatTokenAmount(order.orderDetailsWithID.orderDetails.sellAmount, sellTokenInfo.decimals));
                                            const buyAmount = parseFloat(formatTokenAmount(order.orderDetailsWithID.orderDetails.buyAmounts[0], primaryTokenInfo.decimals));

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
                                {executeErrors[order.orderDetailsWithID.orderID.toString()] && (
                                  <div className="mt-4 p-3 bg-red-900/20 border border-red-500/30 rounded-lg">
                                    <p className="text-red-400 text-sm">{executeErrors[order.orderDetailsWithID.orderID.toString()]}</p>
                                  </div>
                                )}

                                {/* Submit Section */}
                                <div className="mt-4 pt-3 border-t border-white/10">
                                  {(() => {
                                    const orderId = order.orderDetailsWithID.orderID.toString();
                                    const currentInputs = offerInputs[orderId];
                                    const buyTokensIndex = order.orderDetailsWithID.orderDetails.buyTokensIndex;

                                    const hasNativeTokenInput = currentInputs && buyTokensIndex.some((tokenIndex: bigint) => {
                                      const tokenInfo = getTokenInfoByIndex(Number(tokenIndex));
                                      return tokenInfo.address && currentInputs[tokenInfo.address] && parseFloat(removeCommas(currentInputs[tokenInfo.address])) > 0 && isNativeToken(tokenInfo.address);
                                    });

                                    // Show Connect Wallet button if not connected
                                    if (!address) {
                                      return (
                                        <button
                                          onClick={() => {
                                            const hasAccepted = localStorage.getItem('disclaimer-accepted');
                                            if (hasAccepted) {
                                              openWalletModal();
                                            } else {
                                              setShowLandingDisclaimer(true);
                                            }
                                          }}
                                          className="px-6 py-2 bg-white text-black border border-white/20 rounded-lg hover:bg-gray-100 transition-colors text-sm font-medium"
                                        >
                                          Connect Wallet
                                        </button>
                                      );
                                    }

                                    return (
                                      <button
                                        onClick={() => handleExecuteOrder(order)}
                                        disabled={executingOrders.has(orderId) || approvingOrders.has(orderId) || !isWalletConnected}
                                        className="px-6 py-2 bg-white text-black border border-white/20 rounded-lg hover:bg-gray-100 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                      >
                                        {approvingOrders.has(orderId) || executingOrders.has(orderId) ? 'Loading' : (hasNativeTokenInput ? 'Confirm Trade' : 'Approve & Confirm Trade')}
                                      </button>
                                    );
                                  })()}
                                </div>
                              </div>

                              <div className="text-xs text-gray-500 mt-6">
                                Order ID: {order.orderDetailsWithID.orderID.toString()}
                              </div>

                              <div className="text-xs text-gray-500 mt-1">
                                Seller: {order.userDetails.orderOwner}
                              </div>

                              {/* Owner Actions - Only show for user's own orders */}
                              {address && order.userDetails.orderOwner.toLowerCase() === address.toLowerCase() && (
                                <div className="mt-3 pt-3 border-t border-white/10">
                                  <div className="flex gap-2 flex-wrap">
                                    {/* Collect Proceeds Button - Show if order has been filled */}
                                    {(() => {
                                      const sellAmount = order.orderDetailsWithID.orderDetails.sellAmount;
                                      const filled = sellAmount - order.orderDetailsWithID.remainingSellAmount;
                                      const hasProceeds = filled > order.orderDetailsWithID.redeemedSellAmount;
                                      return hasProceeds && (
                                        <button
                                          onClick={() => handleCollectProceeds(order)}
                                          disabled={collectingOrders.has(order.orderDetailsWithID.orderID.toString())}
                                          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                          {collectingOrders.has(order.orderDetailsWithID.orderID.toString()) ? 'Loading' : 'Collect Proceeds'}
                                        </button>
                                      );
                                    })()}

                                    {/* Cancel Button */}
                                    <button
                                      onClick={() => handleCancelOrder(order)}
                                      disabled={cancelingOrders.has(order.orderDetailsWithID.orderID.toString()) ||
                                        order.orderDetailsWithID.status !== 0}
                                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                      {cancelingOrders.has(order.orderDetailsWithID.orderID.toString()) ? 'Loading' : 'Cancel Order'}
                                    </button>

                                    {/* Edit Button */}
                                    <button
                                      onClick={() => handleEditOrder(order)}
                                      disabled={order.orderDetailsWithID.status !== 0}
                                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                      Edit Order
                                    </button>
                                  </div>

                                  {/* Cancel Error Display */}
                                  {cancelErrors[order.orderDetailsWithID.orderID.toString()] && (
                                    <div className="mt-2 p-2 bg-red-900/20 border border-red-500/30 rounded-lg">
                                      <p className="text-red-400 text-xs">{cancelErrors[order.orderDetailsWithID.orderID.toString()]}</p>
                                    </div>
                                  )}

                                  {/* Update Error Display */}
                                  {updateErrors[order.orderDetailsWithID.orderID.toString()] && (
                                    <div className="mt-2 p-2 bg-red-900/20 border border-red-500/30 rounded-lg">
                                      <p className="text-red-400 text-xs">{updateErrors[order.orderDetailsWithID.orderID.toString()]}</p>
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
      )
      }

      {/* Edit Order Modal */}
      {
        editingOrder && (
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
                    const order = allOrders?.find(o => o.orderDetailsWithID.orderID.toString() === editingOrder);
                    if (order) handleSaveOrder(order);
                  }}
                  disabled={updatingOrders.has(editingOrder)}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {updatingOrders.has(editingOrder) ? 'Loading' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* Calendar Popup for Expiration Update */}
      {
        showExpirationCalendar && (
          <div
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-[9999]"
            onClick={() => {
              setShowExpirationCalendar(null);
              setSelectedExpirationDate(undefined);
            }}
          >
            <div
              className="bg-black rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl border border-white/20"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-white">Update Expiration Date</h3>
                <button
                  onClick={() => {
                    setShowExpirationCalendar(null);
                    setSelectedExpirationDate(undefined);
                  }}
                  className="text-white/60 hover:text-white transition-colors p-1"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>

              <div className="mb-6 flex justify-center">
                <Calendar
                  mode="single"
                  selected={selectedExpirationDate}
                  onSelect={setSelectedExpirationDate}
                  disabled={(date) => date < new Date()}
                  className="rounded-lg border border-gray-700 bg-gray-900 p-3"
                  classNames={{
                    months: "flex flex-col sm:flex-row gap-2",
                    month: "flex flex-col gap-4",
                    month_caption: "flex justify-center pt-1 relative items-center w-full",
                    caption_label: "text-sm font-medium text-gray-100",
                    nav: "flex items-center gap-1",
                    button_previous: "size-7 bg-transparent p-0 opacity-70 hover:opacity-100 absolute left-1 text-gray-300 hover:bg-gray-700 rounded",
                    button_next: "size-7 bg-transparent p-0 opacity-70 hover:opacity-100 absolute right-1 text-gray-300 hover:bg-gray-700 rounded",
                    month_grid: "w-full border-collapse",
                    weekdays: "flex",
                    weekday: "text-gray-500 rounded-md w-9 font-normal text-[0.8rem] text-center",
                    week: "flex w-full mt-2",
                    day: "h-9 w-9 text-center text-sm p-0 relative focus-within:relative focus-within:z-20",
                    day_button: "h-9 w-9 p-0 font-normal text-gray-200 hover:bg-gray-700 rounded-md transition-colors aria-selected:opacity-100",
                    selected: "bg-blue-600 text-white hover:bg-blue-500 hover:text-white rounded-md",
                    today: "ring-1 ring-gray-500 text-gray-100",
                    outside: "text-gray-600",
                    disabled: "text-gray-700 cursor-not-allowed hover:bg-transparent",
                    hidden: "invisible",
                  }}
                />
              </div>

              {selectedExpirationDate && (
                <div className="mb-4 p-3 bg-white/5 border border-white/20 rounded-lg">
                  <p className="text-sm text-white/70">
                    New expiration: <span className="font-semibold text-white">{selectedExpirationDate.toLocaleDateString()} at {selectedExpirationDate.toLocaleTimeString()}</span>
                  </p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowExpirationCalendar(null);
                    setSelectedExpirationDate(undefined);
                  }}
                  className="flex-1 px-4 py-2 bg-black text-white rounded-lg hover:bg-white/10 transition-colors border border-white/20"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleQuickExpirationUpdate(showExpirationCalendar)}
                  disabled={!selectedExpirationDate || updatingOrders.has(showExpirationCalendar)}
                  className="flex-1 px-4 py-2 bg-white text-black rounded-lg hover:bg-white/90 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {updatingOrders.has(showExpirationCalendar) ? 'Loading' : 'Update Expiration'}
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* Paywall Modal */}
      <PaywallModal
        isOpen={showPaywallModal}
        onClose={() => setShowPaywallModal(false)}
        title={PAYWALL_TITLE}
        description={PAYWALL_DESCRIPTION}
        price={checkingTokenBalance ? "Loading" : hasTokenAccess ? "Access Granted" : `${REQUIRED_PARTY_TOKENS.toLocaleString()} PARTY or ${REQUIRED_TEAM_TOKENS.toLocaleString()} TEAM`}
        contactUrl="https://x.com/hexgeta"
        partyBalance={partyBalance}
        teamBalance={teamBalance}
        requiredParty={REQUIRED_PARTY_TOKENS}
        requiredTeam={REQUIRED_TEAM_TOKENS}
      />
      </div>


      {/* Disclaimer dialog for landing page connect button */}
      <DisclaimerDialog
        open={showLandingDisclaimer}
        onAccept={() => {
          localStorage.setItem('disclaimer-accepted', 'true');
          setShowLandingDisclaimer(false);
          openWalletModal();
        }}
      />
    </LiquidGlassCard >
  );
});

export default OpenPositionsTable;
