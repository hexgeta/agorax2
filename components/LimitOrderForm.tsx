'use client';

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import NumberFlow from '@number-flow/react';
import { useAccount, useBalance, usePublicClient } from 'wagmi';
import { TOKEN_CONSTANTS, TOKEN_BASKETS, TokenBasket } from '@/constants/crypto';
import { useTokenPrices } from '@/hooks/crypto/useTokenPrices';
import { formatEther, formatUnits, parseEther } from 'viem';
import logoManifest from '@/constants/logo-manifest.json';
import { formatTokenTicker, parseTokenAmount, getTokenInfoByIndex, getContractWhitelistIndex } from '@/utils/tokenUtils';
import { getBlockExplorerTxUrl } from '@/utils/blockExplorer';
import { formatNumberWithCommas, removeCommas } from '@/utils/format';
import { useTokenStats } from '@/hooks/crypto/useTokenStats';
import { useTokenAccess } from '@/context/TokenAccessContext';
import { useTokenBalances } from '@/context/TokenBalancesContext';
import { useTransaction } from '@/context/TransactionContext';
import { PAYWALL_ENABLED, REQUIRED_PARTY_TOKENS, REQUIRED_TEAM_TOKENS, PAYWALL_TITLE, PAYWALL_DESCRIPTION } from '@/config/paywall';
import PaywallModal from './PaywallModal';
import { TokenLogo } from '@/components/TokenLogo';
import { Lock, ArrowLeftRight, Calendar as CalendarIcon, Link, Unlink } from 'lucide-react';
import { PixelSpinner } from './ui/PixelSpinner';
import { Slider } from '@/components/ui/slider';
import { Calendar } from '@/components/ui/calendar';
import { LiquidGlassCard } from '@/components/ui/liquid-glass';
import { isNativeToken, useTokenApproval } from '@/utils/tokenApproval';
import { useContractWhitelist } from '@/hooks/contracts/useContractWhitelist';
import { useContractWhitelistRead } from '@/hooks/contracts/useContractWhitelistRead';
import { waitForTransactionWithTimeout, TRANSACTION_TIMEOUTS } from '@/utils/transactionTimeout';
import useToast from '@/hooks/use-toast';
import { useLimitOrderPricing } from '@/hooks/useLimitOrderPricing';
import { useEventTracking } from '@/hooks/useEventTracking';

interface LimitOrderFormProps {
  onTokenChange?: (sellToken: string | undefined, buyTokens: (string | undefined)[]) => void;
  onLimitPriceChange?: (price: number | undefined) => void;
  onInvertPriceDisplayChange?: (inverted: boolean) => void;
  onPricesBoundChange?: (bound: boolean) => void;
  onIndividualLimitPricesChange?: (prices: (number | undefined)[]) => void;
  // Callback when USD prices are loaded/updated - allows parent to pass to chart for consistency
  onPricesChange?: (sellTokenUsdPrice: number, buyTokenUsdPrices: Record<string, number>) => void;
  externalLimitPrice?: number;
  externalMarketPrice?: number;
  externalIndividualLimitPrices?: (number | undefined)[];
  isDragging?: boolean;
  displayedTokenIndex?: number;
  showUsdPrices?: boolean;
  onDisplayedTokenIndexChange?: (index: number) => void;
  onCreateOrderClick?: (sellToken: TokenOption | null, buyTokens: (TokenOption | null)[], sellAmount: string, buyAmounts: string[], expirationDays: number) => void;
  onOrderCreated?: () => void;
  proStatsContainerRef?: React.RefObject<HTMLDivElement | null>;
}

interface TokenOption {
  a: string;
  ticker: string;
  name: string;
  decimals: number;
}

// Helper to format balance display
const formatBalanceDisplay = (balance: string): string => {
  const num = parseFloat(balance);
  if (num === 0) return '0';
  if (num < 0.000001) return num.toExponential(2);
  if (num < 1) return num.toFixed(6);
  if (num < 1000) return num.toFixed(4);
  return formatNumberWithCommas(num.toFixed(2));
};

// Helper to format limit price for display (handles very small numbers)
const formatLimitPriceDisplay = (price: number): string => {
  if (price === 0) return '';
  // For very small numbers (< 0.0000001), use scientific notation
  if (price < 0.0000001) {
    return price.toPrecision(4);
  }
  // For small numbers, show enough decimal places to see significant figures
  if (price < 0.001) {
    // Find how many decimal places we need to show 4 significant figures
    const magnitude = Math.floor(Math.log10(price));
    const decimals = Math.min(Math.abs(magnitude) + 3, 12); // At least 4 sig figs, max 12 decimals
    return price.toFixed(decimals).replace(/\.?0+$/, '');
  }
  // For normal numbers, use 8 decimal places and strip trailing zeros
  return price.toFixed(8).replace(/\.?0+$/, '');
};

// Helper to format display value with max 4 significant figures
const formatDisplayValue = (value: number): number => {
  if (value === 0) return 0;

  const magnitude = Math.floor(Math.log10(Math.abs(value)));

  if (magnitude >= 0) {
    const rounded = Math.round(value * 10000) / 10000;
    return rounded;
  }

  const precision = 4 - magnitude - 1;
  return parseFloat(value.toPrecision(4));
};

// Helper to format amounts for display in labels (handles small numbers)
const formatAmountForLabel = (value: number): string => {
  if (value === 0) return '0';

  const absValue = Math.abs(value);

  // For large numbers, use compact notation
  if (absValue >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
  if (absValue >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (absValue >= 1_000) return `${(value / 1_000).toFixed(2)}K`;

  // For numbers >= 1, show up to 4 decimal places
  if (absValue >= 1) return formatNumberWithCommas(value.toFixed(4).replace(/\.?0+$/, ''));

  // For small numbers < 1, use toPrecision but ensure we show enough digits
  // toPrecision(4) would show 0.0001200 as "0.0001200" -> we want "0.00012"
  const magnitude = Math.floor(Math.log10(absValue));
  const sigFigs = Math.max(4, Math.abs(magnitude) + 2); // At least 4 sig figs, more for very small
  let result = value.toPrecision(Math.min(sigFigs, 10));

  // Remove trailing zeros after decimal
  if (result.includes('.')) {
    result = result.replace(/\.?0+$/, '');
  }

  return result;
};

// Helper to format calculated values for state (with commas)
const formatCalculatedValue = (value: number): string => {
  if (value === 0) return '';

  // Dynamically determine precision based on magnitude
  // Goal: always show at least 4 significant digits
  const absValue = Math.abs(value);
  const magnitude = Math.floor(Math.log10(absValue));

  let precision: number;
  if (magnitude >= 4) {
    // Large numbers (10000+): no decimal places needed
    precision = 0;
  } else if (magnitude >= 0) {
    // Numbers >= 1: use 4 decimal places
    precision = 4;
  } else {
    // Numbers < 1: ensure we show 4 significant figures
    // e.g., 0.00012 has magnitude -4, needs precision of 8 to show 0.00012000
    precision = Math.min(18, Math.abs(magnitude) + 4);
  }

  const multiplier = Math.pow(10, precision);
  const rounded = Math.round(value * multiplier) / multiplier;

  if (rounded === 0) return '';

  let str = rounded.toFixed(precision);
  // Remove trailing zeros but keep meaningful precision
  str = str.replace(/\.?0+$/, '');

  return formatNumberWithCommas(str);
};

// Helper function to find the highest version of a token in tokenStats
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
        highestKey = key;
      }
    }
  });

  return highestKey;
};

// MAXI tokens with stats data
const MAXI_TOKENS = [
  '0x0d86eb9f43c57f6ff3bc9e23d8f9d82503f0e84b', // pMAXI
  '0x6b32022693210cd2cfc466b9ac0085de8fc34ea6', // pDECI
  '0x6b0956258ff7bd7645aa35369b55b61b8e6d6140', // pLUCKY
  '0xf55cd1e399e1cc3d95303048897a680be3313308', // pTRIO
  '0xe9f84d418b008888a992ff8c6d22389c2c3504e0', // pBASE
  '0x352511c9bc5d47dbc122883ed9353e987d10a3ba', // weMAXI
  '0x189a3ca3cc1337e85c7bc0a43b8d3457fd5aae89', // weDECI
  '0x8924f56df76ca9e7babb53489d7bef4fb7caff19', // weLUCKY
  '0x0f3c6134f4022d85127476bc4d3787860e5c5569', // weTRIO
  '0xda073388422065fe8d3b5921ec2ae475bae57bed', // weBASE
];

export function LimitOrderForm({
  onTokenChange,
  onLimitPriceChange,
  onInvertPriceDisplayChange,
  onPricesBoundChange,
  onIndividualLimitPricesChange,
  onPricesChange,
  externalLimitPrice,
  externalMarketPrice,
  externalIndividualLimitPrices,
  isDragging = false,
  displayedTokenIndex: externalDisplayedTokenIndex,
  showUsdPrices = false,
  onDisplayedTokenIndexChange,
  onCreateOrderClick,
  onOrderCreated,
  proStatsContainerRef,
}: LimitOrderFormProps) {
  const { isConnected, address, chainId } = useAccount();
  const { trackOrderCreated } = useEventTracking();

  // Default tokens: PLS for sell, HEX for buy
  const getDefaultSellToken = (): TokenOption | null => {
    const pls = TOKEN_CONSTANTS.find(t => t.a === '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE');
    return pls && pls.a ? { a: pls.a, ticker: pls.ticker, name: pls.name, decimals: pls.decimals } : null;
  };

  const getDefaultBuyToken = (): TokenOption | null => {
    const hex = TOKEN_CONSTANTS.find(t => t.a === '0x2b591e99afE9f32eAA6214f7B7629768c40Eeb39');
    return hex && hex.a ? { a: hex.a, ticker: hex.ticker, name: hex.name, decimals: hex.decimals } : null;
  };

  const [sellToken, setSellToken] = useState<TokenOption | null>(getDefaultSellToken());
  const [buyTokens, setBuyTokens] = useState<(TokenOption | null)[]>([getDefaultBuyToken()]); // Array of buy tokens

  // Extract buy token address for stable dependency (must be here before useEffect hooks)
  const firstBuyTokenAddress = buyTokens[0]?.a;

  const [sellAmount, setSellAmount] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('limitOrderSellAmount') || '';
    }
    return '';
  });
  const [buyAmounts, setBuyAmounts] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      // Only restore buy amounts if in unlinked mode (pricesBound = false)
      const pricesBoundSaved = localStorage.getItem('limitOrderPricesBound');
      const isUnlinked = pricesBoundSaved === 'false';
      if (isUnlinked) {
        const saved = localStorage.getItem('limitOrderBuyAmounts');
        if (saved) {
          try {
            return JSON.parse(saved);
          } catch {
            return [''];
          }
        }
      }
    }
    return [''];
  });
  const [expirationDays, setExpirationDays] = useState(() => {
    if (typeof window !== 'undefined') {
      return Number(localStorage.getItem('limitOrderExpirationDays')) || 7;
    }
    return 7;
  });
  const [expirationInput, setExpirationInput] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('limitOrderExpirationDays');
      return saved || '7';
    }
    return '7';
  });

  // Initialize selectedDate based on expirationInput on mount
  useEffect(() => {
    const numValue = parseFloat(expirationInput);
    if (!isNaN(numValue) && numValue > 0) {
      const futureDate = new Date();
      const millisecondsToAdd = numValue * 24 * 60 * 60 * 1000;
      futureDate.setTime(futureDate.getTime() + millisecondsToAdd);
      setSelectedDate(futureDate);
    }
  }, []); // Only run on mount

  const [limitPrice, setLimitPrice] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('limitOrderPrice') || '';
    }
    return '';
  });
  const [pricePercentage, setPricePercentage] = useState<number | null>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('limitOrderPricePercentage');
      return saved ? parseFloat(saved) : null;
    }
    return null;
  });
  const [showSellDropdown, setShowSellDropdown] = useState(false);
  const [showBuyDropdowns, setShowBuyDropdowns] = useState<boolean[]>([false]);
  const [showSellTokenMenu, setShowSellTokenMenu] = useState(false);
  const [showBuyTokenMenus, setShowBuyTokenMenus] = useState<boolean[]>([false]);
  const [sellSearchQuery, setSellSearchQuery] = useState('');
  const [buySearchQueries, setBuySearchQueries] = useState<string[]>(['']);
  const [invertPriceDisplay, setInvertPriceDisplay] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('limitOrderInvertPrice');
      return saved === null ? true : saved === 'true';
    }
    return true;
  });
  const [isBuyInputFocused, setIsBuyInputFocused] = useState<boolean[]>([false]);
  const [isSellInputFocused, setIsSellInputFocused] = useState(false);
  const [duplicateTokenError, setDuplicateTokenError] = useState<string | null>(null);
  const [limitPriceInputValue, setLimitPriceInputValue] = useState<string>('');
  const [isLimitPriceInputFocused, setIsLimitPriceInputFocused] = useState(false);
  const [individualPriceInputValues, setIndividualPriceInputValues] = useState<string[]>([]);
  const [individualPriceInputFocused, setIndividualPriceInputFocused] = useState<boolean[]>([]);
  const [expirationError, setExpirationError] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Basket state - tracks if current buy tokens came from a basket selection
  // Initialize from localStorage to avoid flash of individual tokens before effect runs
  const [selectedBasket, setSelectedBasket] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('limitOrderSelectedBasket');
      if (saved) {
        // Verify the basket still exists
        const basket = TOKEN_BASKETS.find(b => b.id === saved);
        return basket ? saved : null;
      }
    }
    return null;
  });
  // Which buy token's price to display in the ticker (cycles through on click)
  const [internalDisplayedPriceTokenIndex, setInternalDisplayedPriceTokenIndex] = useState(0);

  // Use external index if provided (controlled mode), otherwise use internal state
  const displayedPriceTokenIndex = externalDisplayedTokenIndex ?? internalDisplayedPriceTokenIndex;
  const setDisplayedPriceTokenIndex = (index: number) => {
    setInternalDisplayedPriceTokenIndex(index);
    onDisplayedTokenIndexChange?.(index);
  };

  // Listing fee state
  const [listingFee, setListingFee] = useState<bigint>(0n);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('limitOrderShowAdvanced') === 'true';
    }
    return false;
  });
  const [allOrNothing, setAllOrNothing] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('limitOrderAllOrNothing') === 'true';
    }
    return false;
  });
  const [maxiStats, setMaxiStats] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('limitOrderMaxiStats') === 'true';
    }
    return false;
  });

  // Bind prices toggle - when true (default), all buy tokens have the same % from market
  const [pricesBound, setPricesBound] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('limitOrderPricesBound');
      return saved === null ? true : saved === 'true'; // Default to true (bound)
    }
    return true;
  });

  // Show more tokens toggle - when true, shows all tokens in sell dropdown (not just whitelisted)
  const [showMoreTokens, setShowMoreTokens] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('limitOrderShowMoreTokens') === 'true';
    }
    return false;
  });

  // Accept multiple tokens as buy - when true, shows the "Add alternative token" button
  // Default to true for new users (no localStorage value)
  const [acceptMultipleTokens, setAcceptMultipleTokens] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('limitOrderAcceptMultipleTokens');
      return saved === null ? true : saved === 'true';
    }
    return true;
  });

  // Custom token state for pasted contract addresses (sell only)
  const [customToken, setCustomToken] = useState<TokenOption | null>(null);
  const [isLoadingCustomToken, setIsLoadingCustomToken] = useState(false);
  const [customTokenError, setCustomTokenError] = useState<string | null>(null);

  // Token balances from shared context (fetched in background on app load)
  const { balances: dropdownTokenBalances } = useTokenBalances();

  // Individual limit prices for each buy token (used when pricesBound is false)
  // Persisted to localStorage so they survive page reload
  const [individualLimitPrices, setIndividualLimitPrices] = useState<(number | undefined)[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('limitOrderIndividualPrices');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {
          return [];
        }
      }
    }
    return [];
  });

  const sellDropdownRef = useRef<HTMLDivElement>(null);
  const buyDropdownRefs = useRef<(HTMLDivElement | null)[]>([]);
  const sellSearchRef = useRef<HTMLInputElement>(null);
  const buySearchRefs = useRef<(HTMLInputElement | null)[]>([]);
  const sellTokenMenuRef = useRef<HTMLDivElement>(null);
  const buyTokenMenuRefs = useRef<(HTMLDivElement | null)[]>([]);
  const buyInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const sellInputRef = useRef<HTMLInputElement>(null);
  const limitPriceInputRef = useRef<HTMLInputElement>(null);
  const datePickerRef = useRef<HTMLDivElement>(null);
  const isInitialLoadRef = useRef<boolean>(true);
  const limitPriceSetByUserRef = useRef<boolean>(false);
  const hasInitializedTokensRef = useRef<boolean>(false);
  const [hasCalculatedInitialBuyAmount, setHasCalculatedInitialBuyAmount] = useState(false);
  const lastEditedInputRef = useRef<'sell' | number | null>(null); // 'sell' or buy index
  const isUpdatingFromOtherInputRef = useRef<boolean>(false);
  // Track which input is actively being typed in - prevents feedback loops
  const activeInputRef = useRef<'sell' | 'buy' | null>(null);
  // Track when percentage/backing click is in progress - prevents useEffect from overwriting amounts
  const isPercentageClickInProgressRef = useRef<boolean>(false);

  // Track previous token addresses to detect changes for deferred price recalculation
  // This fixes the race condition where prices aren't ready when token selection happens
  const prevSellTokenAddressRef = useRef<string | undefined>(sellToken?.a);
  const prevBuyTokenAddressRef = useRef<string | undefined>(buyTokens[0]?.a);
  // Track when a token change is pending - blocks other effects from calling onLimitPriceChange
  const tokenChangePendingRef = useRef<boolean>(false);

  // Hooks for contract interaction
  const publicClient = usePublicClient();
  const { toast } = useToast();
  const { placeOrder, contractAddress } = useContractWhitelist();
  const { setTransactionPending } = useTransaction();

  // Get whitelisted tokens from the contract
  const { activeTokens, isLoading: isLoadingWhitelist } = useContractWhitelistRead();

  // Token approval for sell token
  const sellAmountWei = sellToken && sellAmount ? parseTokenAmount(removeCommas(sellAmount), sellToken.decimals) : 0n;
  const needsApproval = Boolean(sellToken && !isNativeToken(sellToken.a) && sellAmountWei > 0n);

  const {
    allowance,
    isApproving: isApprovingToken,
    approveToken,
    refetchAllowance,
  } = useTokenApproval(
    (sellToken?.a || '0x0000000000000000000000000000000000000000') as `0x${string}`,
    (contractAddress || '0x0000000000000000000000000000000000000000') as `0x${string}`,
    sellAmountWei
  );

  // Fetch listing fee from contract
  useEffect(() => {
    const fetchListingFee = async () => {
      if (!publicClient || !contractAddress) return;

      try {
        const fee = await publicClient.readContract({
          address: contractAddress as `0x${string}`,
          abi: [
            {
              name: 'listingFee',
              type: 'function',
              stateMutability: 'view',
              inputs: [],
              outputs: [{ name: '', type: 'uint256' }],
            },
          ],
          functionName: 'listingFee',
        }) as bigint;
        setListingFee(fee);
      } catch (error) {
        console.warn('Could not fetch listing fee:', error);
        setListingFee(0n);
      }
    };

    fetchListingFee();
  }, [publicClient, contractAddress]);

  // Filter TOKEN_CONSTANTS to only include whitelisted tokens from the contract
  const whitelistedAddresses = new Set(
    activeTokens.map(token => token.tokenAddress.toLowerCase())
  );

  // Deduplicate tokens by address (keep the first occurrence)
  const availableTokens = TOKEN_CONSTANTS.filter(t => {
    if (!t.a) return false;
    // Only include tokens that are in the contract whitelist
    return whitelistedAddresses.has(t.a.toLowerCase());
  }).reduce((unique, token) => {
    // Only add if this address hasn't been added yet
    if (!unique.some(t => t.a?.toLowerCase() === token.a?.toLowerCase())) {
      unique.push(token);
    }
    return unique;
  }, [] as typeof TOKEN_CONSTANTS);

  // Get whitelisted tokens that belong to a specific basket
  const getBasketTokens = useCallback((basketId: string): TokenOption[] => {
    return availableTokens
      .filter(token => token.baskets?.includes(basketId))
      .map(token => ({
        a: token.a!,
        ticker: token.ticker,
        name: token.name,
        decimals: token.decimals
      }));
  }, [availableTokens]);

  // Filter baskets to show in dropdown - only show baskets that have at least one whitelisted token
  // and that are not already selected as current buy tokens
  const getAvailableBaskets = useCallback((index: number) => {
    return TOKEN_BASKETS.filter(basket => {
      const basketTokens = getBasketTokens(basket.id);
      if (basketTokens.length === 0) return false;

      // Allow baskets even if they contain the sell token - user may want same token in buy/sell

      return true;
    });
  }, [getBasketTokens, sellToken]);

  // Detect if sell search query is a contract address and fetch token info from DexScreener
  useEffect(() => {
    const isContractAddress = /^0x[a-fA-F0-9]{40}$/.test(sellSearchQuery.trim());

    if (!isContractAddress) {
      setCustomToken(null);
      setCustomTokenError(null);
      setIsLoadingCustomToken(false);
      return;
    }

    const contractAddress = sellSearchQuery.trim().toLowerCase();

    // Check if already in TOKEN_CONSTANTS
    const existingToken = TOKEN_CONSTANTS.find(t =>
      t.a && t.a.toLowerCase() === contractAddress
    );
    if (existingToken) {
      setCustomToken(null);
      setCustomTokenError(null);
      return;
    }

    // Fetch from DexScreener
    const fetchTokenInfo = async () => {
      setIsLoadingCustomToken(true);
      setCustomTokenError(null);

      try {
        const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${contractAddress}`);
        if (!response.ok) {
          throw new Error('Failed to fetch token info');
        }

        const data = await response.json();
        const pairs = data.pairs || [];

        // Filter for PulseChain pairs
        const pulsechainPairs = pairs.filter((pair: any) => pair.chainId === 'pulsechain');

        if (pulsechainPairs.length === 0) {
          setCustomTokenError('Token not found on PulseChain');
          setCustomToken(null);
          return;
        }

        // Get the pair with highest liquidity
        const bestPair = pulsechainPairs.sort((a: any, b: any) => {
          const aLiq = parseFloat(a.liquidity?.usd || '0');
          const bLiq = parseFloat(b.liquidity?.usd || '0');
          return bLiq - aLiq;
        })[0];

        // Determine which token in the pair matches our contract address
        const isBaseToken = bestPair.baseToken.address.toLowerCase() === contractAddress;
        const tokenInfo = isBaseToken ? bestPair.baseToken : bestPair.quoteToken;

        // Get decimals - default to 18 if not available
        const decimals = 18; // DexScreener doesn't always provide decimals, default to 18 for PRC20

        setCustomToken({
          a: contractAddress,
          ticker: tokenInfo.symbol || 'UNKNOWN',
          name: tokenInfo.name || 'Unknown Token',
          decimals: decimals
        });
        setCustomTokenError(null);
      } catch (error) {
        setCustomTokenError('Failed to fetch token info');
        setCustomToken(null);
      } finally {
        setIsLoadingCustomToken(false);
      }
    };

    // Debounce the fetch
    const timeoutId = setTimeout(fetchTokenInfo, 500);
    return () => clearTimeout(timeoutId);
  }, [sellSearchQuery]);

  // Filter tokens based on search queries and exclude already selected tokens
  // When showMoreTokens is true, show ALL tokens from TOKEN_CONSTANTS (not just whitelisted)
  const sellTokenSource = showMoreTokens ? TOKEN_CONSTANTS.filter(t => t.a) : availableTokens;
  const filteredSellTokensUnsorted = sellTokenSource.filter(token => {
    if (!token.a) return false;

    // Exclude the currently selected sell token from the dropdown
    if (sellToken && sellToken.a && token.a.toLowerCase() === sellToken.a.toLowerCase()) {
      return false;
    }

    // Exclude if it's already selected in any buy token
    const isSelectedInBuy = buyTokens.some(buyToken =>
      buyToken && buyToken.a && token.a && buyToken.a.toLowerCase() === token.a.toLowerCase()
    );
    if (isSelectedInBuy) return false;

    // Apply search filter (including address search)
    const searchLower = sellSearchQuery.toLowerCase();
    return token.ticker.toLowerCase().includes(searchLower) ||
      token.name.toLowerCase().includes(searchLower) ||
      (token.a && token.a.toLowerCase().includes(searchLower));
  });

  const getFilteredBuyTokensUnsorted = (index: number) => {
    const searchQuery = buySearchQueries[index] || '';
    const currentBuyToken = buyTokens[index];
    return availableTokens.filter(token => {
      if (!token.a) return false;

      // Tokens are already filtered to be in whitelist via availableTokens

      // Exclude the currently selected buy token at this index from the dropdown
      // BUT: when a basket is selected, allow it so user can click to switch to single token
      if (currentBuyToken && currentBuyToken.a && token.a.toLowerCase() === currentBuyToken.a.toLowerCase()) {
        if (!selectedBasket) return false;
      }

      // Allow same token in buy as sell - user may want to create same-token orders
      // (e.g., for arbitrage or as a way to "park" tokens in an order)

      // Exclude if it's already selected in another buy token slot
      // BUT: when a basket is selected, allow basket tokens to appear so user can switch to single token
      const isSelectedInOtherBuySlot = buyTokens.some((buyToken, idx) =>
        idx !== index && buyToken && buyToken.a && token.a && buyToken.a.toLowerCase() === token.a.toLowerCase()
      );
      if (isSelectedInOtherBuySlot && !selectedBasket) return false;

      // Apply search filter (including address search)
      const searchLower = searchQuery.toLowerCase();
      return token.ticker.toLowerCase().includes(searchLower) ||
        token.name.toLowerCase().includes(searchLower) ||
        (token.a && token.a.toLowerCase().includes(searchLower));
    });
  };

  // Get all token addresses for price fetching
  // Split into priority (selected) and background (whitelisted) for faster updates
  const priorityAddresses = useMemo(() => {
    const addresses = new Set<string>();
    if (sellToken?.a) addresses.add(sellToken.a);
    buyTokens.forEach(t => { if (t?.a) addresses.add(t.a); });
    return Array.from(addresses);
  }, [sellToken, buyTokens]);

  // Only fetch prices for tokens the user has a balance of (for dropdown sorting)
  const backgroundAddresses = useMemo(() => {
    const addresses = new Set<string>();
    // Only include tokens that user has balance > 0
    Object.entries(dropdownTokenBalances).forEach(([addr, balance]) => {
      if (parseFloat(balance) > 0 && !priorityAddresses.includes(addr)) {
        addresses.add(addr);
      }
    });
    return Array.from(addresses);
  }, [dropdownTokenBalances, priorityAddresses]);

  // Build custom tokens array for price fetching (tokens not in TOKEN_CONSTANTS)
  const customTokensForPricing = useMemo(() => {
    if (!sellToken?.a) return [];
    const isInConstants = TOKEN_CONSTANTS.some(t => t.a && t.a.toLowerCase() === sellToken.a.toLowerCase());
    if (isInConstants) return [];
    return [{
      a: sellToken.a,
      ticker: sellToken.ticker,
      name: sellToken.name,
      decimals: sellToken.decimals,
      chain: 369, // PulseChain
      dexs: '', // Will be discovered dynamically
      type: 'token' as const
    }];
  }, [sellToken]);

  // Fetch token prices
  const { prices: priorityPrices, isLoading: priorityPricesLoading } = useTokenPrices(priorityAddresses, { customTokens: customTokensForPricing });
  const { prices: backgroundPrices } = useTokenPrices(backgroundAddresses);

  // Combine prices, with priority taking precedence
  const prices = useMemo(() => ({
    ...backgroundPrices,
    ...priorityPrices
  }), [backgroundPrices, priorityPrices]);

  const pricesLoading = priorityPricesLoading;

  // Helper to get price with case-insensitive lookup and weDAI hardcoded override
  const getPrice = useCallback((address: string | undefined) => {
    if (!address) return 0;

    // Override: weDAI always returns $1 (no DEX pair configured)
    if (address.toLowerCase() === '0xefd766ccb38eaf1dfd701853bfce31359239f305') {
      return 1;
    }

    // Try exact match first
    const data = prices[address];
    if (data && data.price !== undefined && data.price > 0) return data.price;

    // Fallback to case-insensitive
    const lowerAddr = address.toLowerCase();
    const entry = Object.entries(prices).find(([addr]) => addr.toLowerCase() === lowerAddr);
    return entry && entry[1].price > 0 ? entry[1].price : 0;
  }, [prices]);

  // Emit prices to parent for chart synchronization
  // This ensures the chart uses the same prices as the form for consistent percentage calculations
  useEffect(() => {
    if (!onPricesChange || !sellToken) return;

    const sellTokenUsdPrice = getPrice(sellToken.a);
    if (sellTokenUsdPrice <= 0) return;

    // Build buy token prices map
    const buyTokenUsdPrices: Record<string, number> = {};
    buyTokens.forEach(token => {
      if (token?.a) {
        const price = getPrice(token.a);
        if (price > 0) {
          buyTokenUsdPrices[token.a.toLowerCase()] = price;
        }
      }
    });

    // Only emit if we have at least one buy token price
    if (Object.keys(buyTokenUsdPrices).length > 0) {
      onPricesChange(sellTokenUsdPrice, buyTokenUsdPrices);
    }
  }, [onPricesChange, sellToken, buyTokens, getPrice]);

  // ============================================================================
  // CENTRALIZED PRICING LOGIC - See /docs/limit-order-data-flow.md
  // ============================================================================
  const pricing = useLimitOrderPricing(
    { sellAmount, buyAmounts, limitPrice, pricePercentage, individualLimitPrices, pricesBound },
    {
      setSellAmount,
      setBuyAmounts,
      setLimitPrice,
      setPricePercentage,
      setIndividualLimitPrices,
      onLimitPriceChange: onLimitPriceChange ? (price) => onLimitPriceChange(price) : undefined,
      onIndividualLimitPricesChange: onIndividualLimitPricesChange ? (prices) => onIndividualLimitPricesChange(prices) : undefined
    },
    { getPrice }
  );

  // ============================================================================
  // DEFERRED TOKEN CHANGE HANDLER
  // ============================================================================
  // This effect handles the price recalculation when tokens change.
  // It fixes the race condition where the synchronous handler was called before
  // prices were available for the new token, causing the limit price to "go crazy"
  // before snapping back when prices eventually loaded.
  //
  // How it works:
  // 1. Detect when sell or buy token address changes (via refs tracking previous values)
  // 2. Only recalculate if BOTH tokens have valid prices (> 0)
  // 3. Update the refs after processing to avoid re-triggering
  useEffect(() => {
    const currentSellAddress = sellToken?.a;
    const currentBuyAddress = buyTokens[0]?.a;

    // Check if either token changed
    const sellTokenChanged = currentSellAddress !== prevSellTokenAddressRef.current;
    const buyTokenChanged = currentBuyAddress !== prevBuyTokenAddressRef.current;

    // Only process if a token actually changed
    if (!sellTokenChanged && !buyTokenChanged) {
      tokenChangePendingRef.current = false;
      return;
    }

    // Mark that a token change is pending - this blocks other effects from
    // calling onLimitPriceChange with stale values
    tokenChangePendingRef.current = true;

    // Ensure we have both tokens
    if (!currentSellAddress || !currentBuyAddress) {
      // Update refs even if we can't process (token was cleared)
      prevSellTokenAddressRef.current = currentSellAddress;
      prevBuyTokenAddressRef.current = currentBuyAddress;
      tokenChangePendingRef.current = false;
      return;
    }

    // Check if we have valid prices for BOTH tokens
    const sellPrice = getPrice(currentSellAddress);
    const buyPrice = getPrice(currentBuyAddress);

    if (sellPrice <= 0 || buyPrice <= 0) {
      // Prices not ready yet - don't update refs, so we'll retry on next price update
      // Keep tokenChangePendingRef true to block other effects
      return;
    }

    // Prices are ready - update refs to prevent re-triggering
    prevSellTokenAddressRef.current = currentSellAddress;
    prevBuyTokenAddressRef.current = currentBuyAddress;

    // Get sell amount
    const sellAmt = sellAmount ? parseFloat(removeCommas(sellAmount)) : 0;
    if (sellAmt <= 0) {
      tokenChangePendingRef.current = false;
      return;
    }

    // Calculate new market price and derived values
    const newMarketPrice = sellPrice / buyPrice;
    if (newMarketPrice <= 0) {
      tokenChangePendingRef.current = false;
      return;
    }

    // Apply existing percentage to get new limit price
    const pct = pricePercentage ?? 0;
    const newLimitPrice = newMarketPrice * (1 + pct / 100);

    // Update limit price
    setLimitPrice(newLimitPrice.toFixed(8));
    onLimitPriceChange?.(newLimitPrice);

    // Calculate new buy amount
    const newBuyAmount = sellAmt * newLimitPrice;
    setBuyAmounts(prev => {
      const newAmounts = [...prev];
      newAmounts[0] = pricing.formatCalculatedValue(newBuyAmount);
      return newAmounts;
    });

    // Clear the pending flag after successful update
    tokenChangePendingRef.current = false;
  }, [sellToken?.a, buyTokens, getPrice, sellAmount, pricePercentage, onLimitPriceChange, pricing]);

  // Sorted filtered sell tokens (sorted by USD value)
  const filteredSellTokens = useMemo(() => {
    // Helper to get price with case-insensitive lookup (inside useMemo to capture prices)
    // Returns 0 for tokens with no price data (price is -1 or 0 or undefined)
    const getPriceForSort = (address: string | undefined) => {
      if (!address) return 0;
      const data = prices[address];
      if (data && data.price !== undefined && data.price > 0) return data.price;
      const lowerAddr = address.toLowerCase();
      const entry = Object.entries(prices).find(([addr]) => addr.toLowerCase() === lowerAddr);
      if (entry && entry[1].price > 0) return entry[1].price;
      return 0;
    };

    return [...filteredSellTokensUnsorted].sort((a, b) => {
      const searchLower = sellSearchQuery.toLowerCase();
      const aLower = a.ticker.toLowerCase();
      const bLower = b.ticker.toLowerCase();
      const aTickerMatches = aLower.includes(searchLower);
      const bTickerMatches = bLower.includes(searchLower);

      // Get balances and prices
      const aBalance = parseFloat(dropdownTokenBalances[a.a?.toLowerCase() || ''] || '0');
      const bBalance = parseFloat(dropdownTokenBalances[b.a?.toLowerCase() || ''] || '0');
      const aPrice = getPriceForSort(a.a);
      const bPrice = getPriceForSort(b.a);
      const aUsdValue = aBalance * aPrice;
      const bUsdValue = bBalance * bPrice;

      // 1. First: tokens with balance come before tokens without balance
      const aHasBalance = aBalance > 0;
      const bHasBalance = bBalance > 0;
      if (aHasBalance && !bHasBalance) return -1;
      if (bHasBalance && !aHasBalance) return 1;

      // 2. Among tokens with balance, sort by USD value (highest first)
      if (aHasBalance && bHasBalance) {
        // If both have USD values, sort by USD
        if (aUsdValue > 0 || bUsdValue > 0) {
          if (aUsdValue !== bUsdValue) {
            return bUsdValue - aUsdValue;
          }
        }
        // If USD values are both 0 (no price data), sort by raw balance
        if (aBalance !== bBalance) {
          return bBalance - aBalance;
        }
      }

      // 3. If searching, prioritize search matches
      if (searchLower) {
        // Exact ticker match goes first
        const aExact = aLower === searchLower;
        const bExact = bLower === searchLower;
        if (aExact && !bExact) return -1;
        if (bExact && !aExact) return 1;

        // Tokens with prefix (e, p, st, we) + search term come next
        const prefixes = ['e', 'p', 'st', 'we'];
        const aIsPrefixed = prefixes.some(prefix => aLower === prefix + searchLower);
        const bIsPrefixed = prefixes.some(prefix => bLower === prefix + searchLower);
        if (aIsPrefixed && !bIsPrefixed) return -1;
        if (bIsPrefixed && !aIsPrefixed) return 1;

        // Ticker contains search term comes before name-only matches
        if (aTickerMatches && !bTickerMatches) return -1;
        if (bTickerMatches && !aTickerMatches) return 1;
      }

      // 4. Then alphabetically
      return a.ticker.localeCompare(b.ticker);
    });
  }, [filteredSellTokensUnsorted, sellSearchQuery, dropdownTokenBalances, prices, Object.keys(prices).length]);

  // Get sorted filtered buy tokens
  const getFilteredBuyTokens = (index: number) => {
    const searchQuery = buySearchQueries[index] || '';

    // Helper to get price with case-insensitive lookup
    // Returns 0 for tokens with no price data (price is -1 or 0 or undefined)
    const getPriceForSort = (address: string | undefined) => {
      if (!address) return 0;
      const data = prices[address];
      if (data && data.price !== undefined && data.price > 0) return data.price;
      const lowerAddr = address.toLowerCase();
      const entry = Object.entries(prices).find(([addr]) => addr.toLowerCase() === lowerAddr);
      if (entry && entry[1].price > 0) return entry[1].price;
      return 0;
    };

    return [...getFilteredBuyTokensUnsorted(index)].sort((a, b) => {
      const searchLower = searchQuery.toLowerCase();
      const aLower = a.ticker.toLowerCase();
      const bLower = b.ticker.toLowerCase();
      const aTickerMatches = aLower.includes(searchLower);
      const bTickerMatches = bLower.includes(searchLower);

      // Get balances and prices
      const aBalance = parseFloat(dropdownTokenBalances[a.a?.toLowerCase() || ''] || '0');
      const bBalance = parseFloat(dropdownTokenBalances[b.a?.toLowerCase() || ''] || '0');
      const aPrice = getPriceForSort(a.a);
      const bPrice = getPriceForSort(b.a);
      const aUsdValue = aBalance * aPrice;
      const bUsdValue = bBalance * bPrice;

      // 1. First: tokens with balance come before tokens without balance
      const aHasBalance = aBalance > 0;
      const bHasBalance = bBalance > 0;
      if (aHasBalance && !bHasBalance) return -1;
      if (bHasBalance && !aHasBalance) return 1;

      // 2. Among tokens with balance, sort by USD value (highest first)
      if (aHasBalance && bHasBalance) {
        // If both have USD values, sort by USD
        if (aUsdValue > 0 || bUsdValue > 0) {
          if (aUsdValue !== bUsdValue) {
            return bUsdValue - aUsdValue;
          }
        }
        // If USD values are both 0 (no price data), sort by raw balance
        if (aBalance !== bBalance) {
          return bBalance - aBalance;
        }
      }

      // 3. If searching, prioritize search matches
      if (searchLower) {
        // Exact ticker match goes first
        const aExact = aLower === searchLower;
        const bExact = bLower === searchLower;
        if (aExact && !bExact) return -1;
        if (bExact && !aExact) return 1;

        // Tokens with prefix (e, p, st, we) + search term come next
        const prefixes = ['e', 'p', 'st', 'we'];
        const aIsPrefixed = prefixes.some(prefix => aLower === prefix + searchLower);
        const bIsPrefixed = prefixes.some(prefix => bLower === prefix + searchLower);
        if (aIsPrefixed && !bIsPrefixed) return -1;
        if (bIsPrefixed && !aIsPrefixed) return 1;

        // Ticker contains search term comes before name-only matches
        if (aTickerMatches && !bTickerMatches) return -1;
        if (bTickerMatches && !aTickerMatches) return 1;
      }

      // 3. Then alphabetically
      return a.ticker.localeCompare(b.ticker);
    });
  };

  // Token-gating - use centralized validation
  const { hasTokenAccess, partyBalance, teamBalance, isChecking: checkingTokenBalance } = useTokenAccess();

  // Fetch token stats from LookIntoMaxi API - only if user has access
  const { tokenStats, isLoading: statsLoading, error: statsError } = useTokenStats({
    enabled: PAYWALL_ENABLED ? hasTokenAccess : true
  });

  // State for paywall modal
  const [showPaywallModal, setShowPaywallModal] = useState(false);

  // Fetch sell token balance
  // For native tokens (PLS), don't pass the token address
  // For ERC20 tokens, pass the token address
  const { data: sellTokenBalance, isLoading: sellBalanceLoading } = useBalance({
    address: address,
    token: sellToken && !isNativeToken(sellToken.a) ? sellToken.a as `0x${string}` : undefined,
    query: {
      enabled: !!address && !!sellToken,
    }
  });

  // Check for duplicate tokens
  const checkDuplicateTokens = (tokens: (TokenOption | null)[]) => {
    const addresses = tokens
      .filter(token => token !== null)
      .map(token => token!.a.toLowerCase());

    const duplicates = addresses.filter((addr, index) => addresses.indexOf(addr) !== index);

    if (duplicates.length > 0) {
      const token = tokens.find(t => t && t.a.toLowerCase() === duplicates[0]);
      setDuplicateTokenError(`You cannot select ${token?.ticker} multiple times`);
      return true;
    }

    setDuplicateTokenError(null);
    return false;
  };

  // Helper to check if token is eligible for stats (MAXI tokens only)
  const isTokenEligibleForStats = (token: TokenOption | null) => {
    if (!token) return false;
    return MAXI_TOKENS.includes(token.a.toLowerCase());
  };

  // Helper to determine if a token should show stats
  const shouldShowTokenStats = (token: TokenOption | null) => {
    if (!token) return false;
    const tokensWithVersions = ['DECI', 'LUCKY', 'TRIO', 'BASE'];
    let tokenKey: string;

    if (token.ticker.startsWith('we')) {
      const baseTicker = token.ticker.slice(2);
      if (tokensWithVersions.includes(baseTicker)) {
        tokenKey = getHighestTokenVersion(tokenStats, 'e', baseTicker);
      } else {
        tokenKey = `e${baseTicker}`;
      }
    } else if (token.ticker.startsWith('e')) {
      const baseTicker = token.ticker.slice(1);
      if (tokensWithVersions.includes(baseTicker)) {
        tokenKey = getHighestTokenVersion(tokenStats, 'e', baseTicker);
      } else {
        tokenKey = token.ticker;
      }
    } else {
      if (tokensWithVersions.includes(token.ticker)) {
        tokenKey = getHighestTokenVersion(tokenStats, 'p', token.ticker);
      } else {
        tokenKey = `p${token.ticker}`;
      }
    }
    return tokenStats[tokenKey] && token.ticker !== 'HEX';
  };

  // Check if combination is pHEX + PulseChain MAXI tokens (p* variants)
  const isValidPulseChainCombo = () => {
    if (!sellToken || buyTokens.length === 0 || !buyTokens[0]) return false;

    const isPulseChainMaxi = (token: TokenOption) => {
      // Check if it's a PulseChain MAXI token (pMAXI, pDECI, pLUCKY, pTRIO, pBASE)
      return token.ticker === 'MAXI' || token.ticker === 'DECI' ||
        token.ticker === 'LUCKY' || token.ticker === 'TRIO' || token.ticker === 'BASE';
    };

    const isPHex = (token: TokenOption) => {
      return token.ticker === 'HEX'; // PulseChain HEX
    };

    // Check if one token is pHEX and the other is a PulseChain MAXI token
    const sellIsPHex = isPHex(sellToken);
    const buyIsPHex = buyTokens.some(token => token && isPHex(token));
    const sellIsMaxi = isPulseChainMaxi(sellToken);
    const buyIsMaxi = buyTokens.some(token => token && isPulseChainMaxi(token));

    return (sellIsPHex && buyIsMaxi) || (buyIsPHex && sellIsMaxi);
  };

  const showSellStats = isValidPulseChainCombo() && shouldShowTokenStats(sellToken);
  const showBuyStats = isValidPulseChainCombo() && buyTokens.some(token => shouldShowTokenStats(token));

  // Helper function to get token price in HEX terms
  const getTokenPriceInHex = (tokenAddress: string): number | null => {
    if (!prices) return null;

    const hexAddress = '0x2b591e99afe9f32eaa6214f7b7629768c40eeb39';
    const tokenUsdPrice = prices[tokenAddress]?.price;
    const hexUsdPrice = prices[hexAddress]?.price;

    if (!tokenUsdPrice || !hexUsdPrice || hexUsdPrice === 0) return null;

    const priceInHex = tokenUsdPrice / hexUsdPrice;
    return priceInHex;
  };

  // Calculate OTC price in HEX terms for any token pair (uses first buy token)
  const calculateOtcPriceInHex = useMemo(() => {
    const buyToken = buyTokens[0];
    const buyAmount = buyAmounts[0];

    if (!sellToken || !buyToken || !sellAmount || !buyAmount) {
      return null;
    }
    if (parseFloat(removeCommas(sellAmount)) <= 0 || parseFloat(removeCommas(buyAmount)) <= 0) {
      return null;
    }

    // Helper to check if a token is a HEX variant (HEX, eHEX, pHEX, weHEX)
    const isHexVariant = (ticker: string) => {
      return ticker === 'HEX' || ticker === 'eHEX' || ticker === 'pHEX' || ticker === 'weHEX';
    };

    if (isHexVariant(buyToken.ticker)) {
      const price = parseFloat(removeCommas(buyAmount)) / parseFloat(removeCommas(sellAmount));
      return price;
    } else if (isHexVariant(sellToken.ticker)) {
      const price = parseFloat(removeCommas(sellAmount)) / parseFloat(removeCommas(buyAmount));
      return price;
    } else {
      const buyTokenPriceInHex = getTokenPriceInHex(buyToken.a);
      if (buyTokenPriceInHex) {
        const buyAmountInHex = parseFloat(removeCommas(buyAmount)) * buyTokenPriceInHex;
        const pricePerSellToken = buyAmountInHex / parseFloat(removeCommas(sellAmount));
        return pricePerSellToken;
      }
    }
    return null;
  }, [sellToken, buyTokens, sellAmount, buyAmounts, prices]);

  // Helper to get backing price per token in HEX terms for a given token
  const getBackingPriceForToken = (token: TokenOption | null): number | null => {
    if (!token || !hasTokenAccess || !tokenStats) return null;

    const tokensWithVersions = ['DECI', 'LUCKY', 'TRIO', 'BASE'];
    let tokenKey: string;

    if (token.ticker.startsWith('we')) {
      const baseTicker = token.ticker.slice(2);
      if (tokensWithVersions.includes(baseTicker)) {
        tokenKey = getHighestTokenVersion(tokenStats, 'e', baseTicker);
      } else {
        tokenKey = `e${baseTicker}`;
      }
    } else if (token.ticker.startsWith('e')) {
      const baseTicker = token.ticker.slice(1);
      if (tokensWithVersions.includes(baseTicker)) {
        tokenKey = getHighestTokenVersion(tokenStats, 'e', baseTicker);
      } else {
        tokenKey = token.ticker;
      }
    } else {
      if (tokensWithVersions.includes(token.ticker)) {
        tokenKey = getHighestTokenVersion(tokenStats, 'p', token.ticker);
      } else {
        tokenKey = `p${token.ticker}`;
      }
    }

    const stats = tokenStats[tokenKey];
    if (!stats?.token?.backingPerToken || stats.token.backingPerToken <= 0) return null;

    return stats.token.backingPerToken;
  };

  // Check if we can show backing button for the primary limit price
  // Backing button shows when either:
  // 1. Sell token has backing AND buy token is HEX variant (selling MAXI for HEX)
  // 2. Sell token is HEX AND buy token has backing (buying MAXI with HEX)
  // Also requires maxiStats toggle to be enabled
  const canShowBackingButton = useMemo(() => {
    if (!maxiStats || !hasTokenAccess || !sellToken || !buyTokens[0]) return false;

    const isHexVariant = (ticker: string) => {
      return ticker === 'HEX' || ticker === 'eHEX' || ticker === 'pHEX' || ticker === 'weHEX';
    };

    // Case 1: Sell token has backing, buy token is HEX (selling MAXI for HEX)
    const sellTokenBacking = getBackingPriceForToken(sellToken);
    if (sellTokenBacking && isHexVariant(buyTokens[0].ticker)) {
      return true;
    }

    // Case 2: Sell token is HEX, buy token has backing (buying MAXI with HEX)
    const buyTokenBacking = getBackingPriceForToken(buyTokens[0]);
    if (isHexVariant(sellToken.ticker) && buyTokenBacking) {
      return true;
    }

    return false;
  }, [maxiStats, hasTokenAccess, sellToken, buyTokens, tokenStats]);

  // Get the backing price to set as limit price
  // The limit price is always "buy tokens per sell token"
  // Case 1: Selling MAXI for HEX -> limit price = backing (HEX per MAXI)
  // Case 2: Selling HEX for MAXI -> limit price = 1/backing (MAXI per HEX)
  const getBackingLimitPrice = (): number | null => {
    if (!hasTokenAccess || !sellToken || !buyTokens[0]) return null;

    const isHexVariant = (ticker: string) => {
      return ticker === 'HEX' || ticker === 'eHEX' || ticker === 'pHEX' || ticker === 'weHEX';
    };

    // Case 1: Selling MAXI for HEX
    const sellTokenBacking = getBackingPriceForToken(sellToken);
    if (sellTokenBacking && isHexVariant(buyTokens[0].ticker)) {
      return sellTokenBacking;
    }

    // Case 2: Selling HEX for MAXI
    const buyTokenBacking = getBackingPriceForToken(buyTokens[0]);
    if (isHexVariant(sellToken.ticker) && buyTokenBacking) {
      // Limit price is "MAXI per HEX", backing is "HEX per MAXI"
      // So we need to invert: 1 / backing
      return 1 / buyTokenBacking;
    }

    return null;
  };

  // Set default tokens
  useEffect(() => {
    // Only run if availableTokens is populated and we haven't initialized yet
    if (availableTokens.length === 0 || hasInitializedTokensRef.current) return;

    const savedSellToken = localStorage.getItem('limitOrderSellToken');
    const savedCustomSellToken = localStorage.getItem('limitOrderCustomSellToken'); // Custom token with full object
    const savedBuyTokens = localStorage.getItem('limitOrderBuyTokens'); // Array of buy tokens
    const savedBuyToken = localStorage.getItem('limitOrderBuyToken'); // Legacy: single buy token
    // Note: buy amounts are NOT restored - they recalculate based on fresh prices

    // Default tokens
    const defaultSellAddress = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'; // PLS
    const defaultBuyAddress = '0x2b591e99afe9f32eaa6214f7b7629768c40eeb39'; // HEX

    // Helper to check if two addresses are the same token
    const isSameToken = (addr1: string | undefined | null, addr2: string | undefined | null): boolean => {
      if (!addr1 || !addr2) return false;
      return addr1.toLowerCase() === addr2.toLowerCase();
    };

    // First, determine what the sell token should be
    let resolvedSellToken: TokenOption | null = null;

    if (savedSellToken) {
      const token = availableTokens.find(t => t.a?.toLowerCase() === savedSellToken.toLowerCase());
      if (token && token.a) {
        resolvedSellToken = { a: token.a, ticker: token.ticker, name: token.name, decimals: token.decimals };
      } else if (savedCustomSellToken) {
        try {
          const customTokenData = JSON.parse(savedCustomSellToken) as TokenOption;
          if (customTokenData.a && customTokenData.ticker && customTokenData.name && customTokenData.decimals !== undefined) {
            resolvedSellToken = customTokenData;
          }
        } catch { /* ignore parse errors */ }
      }
    }

    // Fall back to default PLS if no valid sell token found
    if (!resolvedSellToken) {
      const defaultSell = availableTokens.find(t => t.a?.toLowerCase() === defaultSellAddress);
      if (defaultSell && defaultSell.a) {
        resolvedSellToken = { a: defaultSell.a, ticker: defaultSell.ticker, name: defaultSell.name, decimals: defaultSell.decimals };
      }
    }

    // Now determine buy tokens
    let resolvedBuyTokens: TokenOption[] = [];

    if (savedBuyTokens) {
      try {
        const tokenAddresses = JSON.parse(savedBuyTokens) as string[];
        resolvedBuyTokens = tokenAddresses
          .map(addr => availableTokens.find(t => t.a?.toLowerCase() === addr.toLowerCase()))
          .filter(t => t && t.a)
          .map(t => ({ a: t!.a, ticker: t!.ticker, name: t!.name, decimals: t!.decimals }));
      } catch { /* ignore parse errors */ }
    } else if (savedBuyToken) {
      const token = availableTokens.find(t => t.a?.toLowerCase() === savedBuyToken.toLowerCase());
      if (token && token.a) {
        resolvedBuyTokens = [{ a: token.a, ticker: token.ticker, name: token.name, decimals: token.decimals }];
      }
    }

    // Fall back to default HEX if no valid buy tokens found
    if (resolvedBuyTokens.length === 0) {
      const defaultBuy = availableTokens.find(t => t.a?.toLowerCase() === defaultBuyAddress);
      if (defaultBuy && defaultBuy.a) {
        resolvedBuyTokens = [{ a: defaultBuy.a, ticker: defaultBuy.ticker, name: defaultBuy.name, decimals: defaultBuy.decimals }];
      }
    }

    // CRITICAL: Validate that sell token is not the same as any buy token
    // Filter out any buy tokens that match the sell token
    if (resolvedSellToken) {
      resolvedBuyTokens = resolvedBuyTokens.filter(bt => !isSameToken(bt.a, resolvedSellToken!.a));
    }

    // If all buy tokens were filtered out (same as sell), use default buy token
    if (resolvedBuyTokens.length === 0 && resolvedSellToken) {
      // Try HEX first
      let fallbackBuy = availableTokens.find(t => t.a?.toLowerCase() === defaultBuyAddress);

      // If HEX is the sell token, use PLS instead
      if (isSameToken(fallbackBuy?.a, resolvedSellToken.a)) {
        fallbackBuy = availableTokens.find(t => t.a?.toLowerCase() === defaultSellAddress);
      }

      // If still same (shouldn't happen), pick any different token
      if (isSameToken(fallbackBuy?.a, resolvedSellToken.a)) {
        fallbackBuy = availableTokens.find(t => t.a && !isSameToken(t.a, resolvedSellToken!.a));
      }

      if (fallbackBuy && fallbackBuy.a) {
        resolvedBuyTokens = [{ a: fallbackBuy.a, ticker: fallbackBuy.ticker, name: fallbackBuy.name, decimals: fallbackBuy.decimals }];
      }
    }

    // Apply the resolved tokens
    if (resolvedSellToken) {
      setSellToken(resolvedSellToken);
      localStorage.setItem('limitOrderSellToken', resolvedSellToken.a);
    }

    if (resolvedBuyTokens.length > 0) {
      setBuyTokens(resolvedBuyTokens);

      // In unlinked mode, restore saved buy amounts if they exist and match the token count
      const pricesBoundSaved = localStorage.getItem('limitOrderPricesBound');
      const isUnlinked = pricesBoundSaved === 'false';
      let restoredAmounts: string[] | null = null;

      if (isUnlinked) {
        const savedAmounts = localStorage.getItem('limitOrderBuyAmounts');
        if (savedAmounts) {
          try {
            const parsed = JSON.parse(savedAmounts) as string[];
            // Only use saved amounts if the array length matches (same tokens)
            if (parsed.length === resolvedBuyTokens.length) {
              restoredAmounts = parsed;
            }
          } catch { /* ignore parse errors */ }
        }
      }

      setBuyAmounts(restoredAmounts || Array(resolvedBuyTokens.length).fill(''));
      localStorage.setItem('limitOrderBuyToken', resolvedBuyTokens[0].a);
    }

    // Restore selected basket if it was saved
    const savedBasket = localStorage.getItem('limitOrderSelectedBasket');
    if (savedBasket) {
      // Verify the basket still exists
      const basket = TOKEN_BASKETS.find(b => b.id === savedBasket);
      if (basket && resolvedBuyTokens.length > 1) {
        // If we have multiple buy tokens and a saved basket, restore it
        // The tokens were already restored from localStorage, so they should match
        setSelectedBasket(savedBasket);
      } else {
        // Basket no longer exists or only one token, clear it
        localStorage.removeItem('limitOrderSelectedBasket');
      }
    }

    const savedLimitPrice = localStorage.getItem('limitOrderPrice');
    if (savedLimitPrice && parseFloat(savedLimitPrice) > 0) {
      limitPriceSetByUserRef.current = true;
      isInitialLoadRef.current = false;
    }

    // Mark that we've initialized
    hasInitializedTokensRef.current = true;
  }, [availableTokens]);

  // Calculate buy amounts on page load based on saved sell amount and limit price
  // Only applies when prices are bound (linked mode)
  useEffect(() => {
    // Only run once after tokens are initialized and we have the required data
    if (hasCalculatedInitialBuyAmount) return;
    if (!hasInitializedTokensRef.current) return;
    if (!sellAmount || !limitPrice) return;
    // Don't recalculate in unlinked mode - user has set custom amounts
    if (!pricesBound) {
      setHasCalculatedInitialBuyAmount(true);
      return;
    }

    const sellAmt = parseFloat(removeCommas(sellAmount));
    const limitPriceNum = parseFloat(limitPrice);

    if (sellAmt > 0 && limitPriceNum > 0) {
      // limitPrice is always stored as buyToken per sellToken (canonical format)
      // invertPriceDisplay only affects the UI display, not the calculation
      const newBuyAmount = sellAmt * limitPriceNum;
      const newAmounts = [...buyAmounts];
      newAmounts[0] = formatCalculatedValue(newBuyAmount);
      setBuyAmounts(newAmounts);
      setHasCalculatedInitialBuyAmount(true);
    }
  }, [sellAmount, limitPrice, hasCalculatedInitialBuyAmount, pricesBound]);

  // Save form values to localStorage
  useEffect(() => {
    if (sellAmount) {
      localStorage.setItem('limitOrderSellAmount', sellAmount);
    } else {
      localStorage.removeItem('limitOrderSellAmount');
    }
  }, [sellAmount]);

  useEffect(() => {
    if (expirationInput) {
      localStorage.setItem('limitOrderExpirationDays', expirationInput);
    }
  }, [expirationInput]);

  useEffect(() => {
    if (limitPrice) {
      localStorage.setItem('limitOrderPrice', limitPrice);
    } else {
      localStorage.removeItem('limitOrderPrice');
    }
  }, [limitPrice]);

  // Save buy tokens to localStorage
  useEffect(() => {
    const tokenAddresses = buyTokens
      .filter(t => t && t.a)
      .map(t => t!.a);
    if (tokenAddresses.length > 0) {
      localStorage.setItem('limitOrderBuyTokens', JSON.stringify(tokenAddresses));
      // Also update legacy single token for backwards compatibility
      localStorage.setItem('limitOrderBuyToken', tokenAddresses[0]);
    }
  }, [buyTokens]);

  // Save selected basket to localStorage
  useEffect(() => {
    if (selectedBasket) {
      localStorage.setItem('limitOrderSelectedBasket', selectedBasket);
    } else {
      localStorage.removeItem('limitOrderSelectedBasket');
    }
  }, [selectedBasket]);

  // Same token allowed in both sell and buy - removed the safeguard that prevented this

  // Note: buy amounts are NOT saved to localStorage - they recalculate on reload based on fresh prices

  useEffect(() => {
    if (pricePercentage !== null) {
      localStorage.setItem('limitOrderPricePercentage', pricePercentage.toString());
    } else {
      localStorage.removeItem('limitOrderPricePercentage');
    }
  }, [pricePercentage]);

  useEffect(() => {
    localStorage.setItem('limitOrderInvertPrice', invertPriceDisplay.toString());
  }, [invertPriceDisplay]);

  // Save advanced options state to localStorage
  useEffect(() => {
    localStorage.setItem('limitOrderShowAdvanced', showAdvancedOptions.toString());
  }, [showAdvancedOptions]);

  useEffect(() => {
    localStorage.setItem('limitOrderAllOrNothing', allOrNothing.toString());
  }, [allOrNothing]);

  useEffect(() => {
    localStorage.setItem('limitOrderMaxiStats', maxiStats.toString());
  }, [maxiStats]);

  useEffect(() => {
    localStorage.setItem('limitOrderShowMoreTokens', showMoreTokens.toString());
  }, [showMoreTokens]);

  useEffect(() => {
    localStorage.setItem('limitOrderAcceptMultipleTokens', acceptMultipleTokens.toString());
  }, [acceptMultipleTokens]);

  // Save pricesBound to localStorage and notify parent
  useEffect(() => {
    localStorage.setItem('limitOrderPricesBound', pricesBound.toString());
    if (onPricesBoundChange) {
      onPricesBoundChange(pricesBound);
    }
  }, [pricesBound, onPricesBoundChange]);

  // Save individual limit prices to localStorage
  useEffect(() => {
    // Only save if we have actual prices (not all undefined)
    if (individualLimitPrices.some(p => p !== undefined)) {
      localStorage.setItem('limitOrderIndividualPrices', JSON.stringify(individualLimitPrices));
    }
  }, [individualLimitPrices]);

  // Save buy amounts to localStorage when in unlinked mode
  useEffect(() => {
    if (!pricesBound) {
      // Only save if we have actual amounts (not all empty)
      if (buyAmounts.some(a => a && a.trim() !== '')) {
        localStorage.setItem('limitOrderBuyAmounts', JSON.stringify(buyAmounts));
      }
    } else {
      // Clear saved buy amounts when switching to linked mode
      localStorage.removeItem('limitOrderBuyAmounts');
    }
  }, [buyAmounts, pricesBound]);

  // Track if we're receiving updates from chart drag to avoid circular updates
  const isReceivingExternalIndividualPriceRef = useRef(false);

  // Notify parent of individual limit prices changes
  // Skip notification when receiving external updates to avoid circular loop
  useEffect(() => {
    if (onIndividualLimitPricesChange && !pricesBound && !isReceivingExternalIndividualPriceRef.current) {
      onIndividualLimitPricesChange(individualLimitPrices);
    }
  }, [individualLimitPrices, pricesBound, onIndividualLimitPricesChange]);

  // Track previous pricesBound state to detect bound->unbound transitions
  const prevPricesBoundRef = useRef(pricesBound);
  const prevBuyTokensLengthRef = useRef(buyTokens.length);

  // Initialize individual limit prices ONLY when:
  // 1. Switching from bound to unbound (not when limitPrice changes while unbound)
  // 2. When new tokens are added while unbound (only initialize the new token, not all)
  // IMPORTANT: This effect must NOT depend on priorityPrices or it will cause race conditions
  // where prices are reset when the API refreshes prices (~every 30 seconds)
  useEffect(() => {
    if (!pricesBound && buyTokens.length > 0) {
      const wasBound = prevPricesBoundRef.current;
      const prevLength = prevBuyTokensLengthRef.current;
      const tokenCountIncreased = buyTokens.length > prevLength;

      const limitPriceNum = parseFloat(limitPrice) || 0;

      // Only proceed if we have valid limit price
      if (limitPriceNum > 0) {
        // Case 1: Just switched from bound to unbound - use the hook to initialize
        if (wasBound) {
          pricing.initializeIndividualPrices(sellToken, buyTokens);
        }
        // Case 2: New token added while already unbound - only initialize the new token at market price
        else if (tokenCountIncreased) {
          const sellTokenUsdPrice = sellToken ? getPrice(sellToken.a) : 0;
          setIndividualLimitPrices(prev => {
            const newPrices = [...prev];
            // Initialize new tokens at market price (not first token's premium)
            for (let i = prevLength; i < buyTokens.length; i++) {
              const token = buyTokens[i];
              if (token) {
                const tokenUsdPrice = getPrice(token.a);
                if (sellTokenUsdPrice > 0 && tokenUsdPrice > 0) {
                  // Use market price for new tokens (premiumMultiplier = 1)
                  newPrices[i] = sellTokenUsdPrice / tokenUsdPrice;
                }
              }
            }
            return newPrices;
          });
        }
        // Case 3: Already unbound but individualLimitPrices needs initialization
        // This triggers on page reload when prices are unbound and:
        // - Array is empty, or
        // - All values are undefined, or
        // - Array length doesn't match token count (tokens changed between sessions)
        else if (
          individualLimitPrices.length === 0 ||
          individualLimitPrices.every(p => p === undefined) ||
          individualLimitPrices.length !== buyTokens.length
        ) {
          pricing.initializeIndividualPrices(sellToken, buyTokens);
        }
      }
    }

    // Update refs for next render
    prevPricesBoundRef.current = pricesBound;
    prevBuyTokensLengthRef.current = buyTokens.length;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pricesBound, buyTokens.length, sellToken?.a]);

  // Recalculate percentage when invert display changes
  useEffect(() => {
    // Skip recalculation if a percentage button click is in progress
    // This prevents floating point precision issues from overwriting the exact percentage
    if (isPercentageClickInProgressRef.current) return;

    const sellTokenPrice = sellToken ? getPrice(sellToken.a) : 0;
    const buyToken = buyTokens[0];
    const buyTokenPrice = buyToken ? getPrice(buyToken.a) : 0;
    // Market price = sell tokens per buy token (e.g., how many PLS for 1 HEX)
    const internalMarketPrice = sellTokenPrice && buyTokenPrice ? buyTokenPrice / sellTokenPrice : 0;
    const marketPrice = externalMarketPrice || internalMarketPrice;

    if (limitPrice && marketPrice > 0 && limitPriceSetByUserRef.current) {
      const storedLimitPrice = parseFloat(limitPrice);
      // storedLimitPrice is in buy/sell format
      // marketPrice is in sell/buy format
      // Convert marketPrice to buy/sell for comparison
      const marketPriceBuyPerSell = 1 / marketPrice;
      const percentageAboveMarket = ((storedLimitPrice - marketPriceBuyPerSell) / marketPriceBuyPerSell) * 100;
      setPricePercentage(Math.abs(percentageAboveMarket) > 0.01 ? Number(percentageAboveMarket.toFixed(4)) : null);
    }
  }, [limitPrice, externalMarketPrice, sellToken?.a, firstBuyTokenAddress, getPrice]);

  // Create a stable string key for all buy token addresses to use in dependency
  const buyTokenAddressesKey = buyTokens.map(t => t?.a || '').join(',');

  // Notify parent of token changes (pass all buy tokens for chart)
  useEffect(() => {
    if (onTokenChange && (sellToken || buyTokens.some(t => t))) {
      const buyTokenAddresses = buyTokens.map(token => token?.a);
      onTokenChange(sellToken?.a, buyTokenAddresses);
    }
    // Note: onTokenChange intentionally excluded to prevent infinite loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sellToken?.a, buyTokenAddressesKey]);

  // Notify parent of loaded invertPriceDisplay on mount
  useEffect(() => {
    if (onInvertPriceDisplayChange) {
      onInvertPriceDisplayChange(invertPriceDisplay);
    }
  }, []);

  // Notify parent of loaded pricesBound on mount
  useEffect(() => {
    if (onPricesBoundChange) {
      onPricesBoundChange(pricesBound);
    }
  }, []);

  // Notify parent of loaded limit price on mount
  useEffect(() => {
    const savedLimitPrice = localStorage.getItem('limitOrderPrice');
    if (savedLimitPrice && parseFloat(savedLimitPrice) > 0 && onLimitPriceChange) {
      onLimitPriceChange(parseFloat(savedLimitPrice));
    }
  }, []);

  // Close dropdowns and date picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (sellDropdownRef.current && !sellDropdownRef.current.contains(event.target as Node)) {
        setShowSellDropdown(false);
        setSellSearchQuery('');
      }
      buyDropdownRefs.current.forEach((ref, index) => {
        if (ref && !ref.contains(event.target as Node)) {
          const newDropdowns = [...showBuyDropdowns];
          newDropdowns[index] = false;
          setShowBuyDropdowns(newDropdowns);
        }
      });

      // Close date picker if clicking outside
      if (datePickerRef.current && !datePickerRef.current.contains(event.target as Node)) {
        setShowDatePicker(false);
      }

      // Close token menus if clicking outside
      if (sellTokenMenuRef.current && !sellTokenMenuRef.current.contains(event.target as Node)) {
        setShowSellTokenMenu(false);
      }
      buyTokenMenuRefs.current.forEach((ref, index) => {
        if (ref && !ref.contains(event.target as Node)) {
          setShowBuyTokenMenus(prev => {
            const newMenus = [...prev];
            newMenus[index] = false;
            return newMenus;
          });
        }
      });
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showBuyDropdowns]);

  const getTokenLogo = (ticker: string) => {
    const format = (logoManifest as Record<string, string>)[ticker];
    return format ? `/coin-logos/${ticker}.${format}` : '/coin-logos/default.svg';
  };

  // Get balance - now consolidated for both native and ERC20 tokens
  const actualBalance = sellTokenBalance;
  const isBalanceLoading = sellBalanceLoading;

  // Calculate USD values
  const sellTokenPrice = sellToken ? getPrice(sellToken.a) : 0;
  const firstBuyToken = buyTokens[0];
  const buyTokenPrice = firstBuyToken ? getPrice(firstBuyToken.a) : 0;

  const sellAmountNum = sellAmount ? parseFloat(removeCommas(sellAmount)) : 0;
  const buyAmountNum = buyAmounts[0] ? parseFloat(removeCommas(buyAmounts[0])) : 0;

  // Use Math.max(0, ...) to prevent negative values if price is -1
  const sellUsdValue = sellAmountNum * Math.max(0, sellTokenPrice);
  const buyUsdValue = buyAmountNum * Math.max(0, buyTokenPrice);

  // Calculate market price (use first buy token for chart)
  // Market price = sell tokens per buy token (e.g., how many PLS for 1 HEX)
  const internalMarketPrice = sellTokenPrice > 0 && buyTokenPrice > 0 ? buyTokenPrice / sellTokenPrice : 0;
  const marketPrice = externalMarketPrice || internalMarketPrice;

  // Initialize limit price to market price on first visit (when no saved price exists)
  useEffect(() => {
    const savedLimitPrice = localStorage.getItem('limitOrderPrice');
    const hasExistingPrice = savedLimitPrice && parseFloat(savedLimitPrice) > 0;

    // Only set to market price if:
    // 1. No saved limit price exists
    // 2. We have a valid market price
    // 3. We haven't already set the limit price
    if (!hasExistingPrice && marketPrice > 0 && !limitPriceSetByUserRef.current) {
      // marketPrice is in sell/buy format (inverted)
      // limitPrice is always stored in buy/sell format (non-inverted)
      // So we always convert: priceToStore = 1/marketPrice
      const priceToStore = 1 / marketPrice;
      setLimitPrice(priceToStore.toFixed(8));
      limitPriceSetByUserRef.current = true;
      isInitialLoadRef.current = false;

      // onLimitPriceChange expects non-inverted price (buy/sell)
      // Skip if a token change is pending to avoid sending stale values to chart
      if (onLimitPriceChange && !tokenChangePendingRef.current) {
        onLimitPriceChange(1 / marketPrice);
      }
    }
  }, [marketPrice, onLimitPriceChange]);

  // Sync external limit price changes (from chart)
  useEffect(() => {
    // Skip if user is actively typing in sell or buy input
    if (activeInputRef.current !== null) return;
    // Skip if a percentage/backing click is in progress
    if (isPercentageClickInProgressRef.current) return;
    // Skip if a token change is pending
    if (tokenChangePendingRef.current) return;
    // Skip if user is focused on limit price input
    if (isLimitPriceInputFocused) return;

    if (externalLimitPrice !== undefined) {
      limitPriceSetByUserRef.current = true;
      isInitialLoadRef.current = false;

      setLimitPrice(externalLimitPrice.toString());

      // Update buy amounts based on external price
      if (sellAmountNum > 0) {
        setBuyAmounts((prevAmounts) => {
          const newAmounts = [...prevAmounts];
          if (buyTokens[0]) {
            const newBuyAmount = sellAmountNum * externalLimitPrice;
            newAmounts[0] = formatCalculatedValue(newBuyAmount);
          }

          // Only update additional tokens if prices are BOUND
          if (pricesBound) {
            const sellTokenUsdPrice = sellToken ? getPrice(sellToken.a) : 0;
            if (sellTokenUsdPrice > 0) {
              const firstBuyTokenUsdPrice = buyTokens[0] ? getPrice(buyTokens[0].a) : 0;
              const marketPriceForFirst = firstBuyTokenUsdPrice > 0 ? sellTokenUsdPrice / firstBuyTokenUsdPrice : 0;
              const premiumMultiplier = marketPriceForFirst > 0 ? externalLimitPrice / marketPriceForFirst : 1;

              for (let i = 1; i < buyTokens.length; i++) {
                if (buyTokens[i]) {
                  const tokenUsdPrice = getPrice(buyTokens[i]!.a);
                  if (tokenUsdPrice > 0) {
                    const marketPriceForThis = sellTokenUsdPrice / tokenUsdPrice;
                    const adjustedPrice = marketPriceForThis * premiumMultiplier;
                    const adjustedAmount = sellAmountNum * adjustedPrice;
                    newAmounts[i] = formatCalculatedValue(adjustedAmount);
                  }
                }
              }
            }
          }
          return newAmounts;
        });
      }

      // Update individual limit price for first token when unbound
      // Set flag to prevent feedback loop back to parent
      if (!pricesBound) {
        isReceivingExternalIndividualPriceRef.current = true;
        setIndividualLimitPrices(prev => {
          const newPrices = [...prev];
          newPrices[0] = externalLimitPrice;
          return newPrices;
        });
        setTimeout(() => {
          isReceivingExternalIndividualPriceRef.current = false;
        }, 50);
      }

      if (marketPrice > 0) {
        const marketPriceBuyPerSell = 1 / marketPrice;
        const percentageAboveMarket = ((externalLimitPrice - marketPriceBuyPerSell) / marketPriceBuyPerSell) * 100;
        setPricePercentage(percentageAboveMarket);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalLimitPrice, sellAmountNum, marketPrice, invertPriceDisplay, pricesBound, buyTokens, prices]);

  // Sync external individual limit price changes (from chart dragging individual token lines)
  useEffect(() => {
    if (!externalIndividualLimitPrices) return;
    // Skip when user is typing in any individual price input
    if (individualPriceInputFocused.some(focused => focused)) return;

    // Set flag to block the notify effect from sending stale data back
    isReceivingExternalIndividualPriceRef.current = true;

    // Use the hook's sync function for centralized logic
    pricing.syncExternalIndividualPrices(externalIndividualLimitPrices, sellToken, buyTokens);

    // Reset flag after React batching completes
    setTimeout(() => {
      isReceivingExternalIndividualPriceRef.current = false;
    }, 300);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalIndividualLimitPrices]);

  // When sell amount changes, update buy amount based on limit price
  // Only runs when user is typing in SELL - never when typing in buy
  useEffect(() => {
    if (limitPriceSetByUserRef.current &&
      activeInputRef.current === 'sell' &&
      !isInitialLoadRef.current &&
      sellAmountNum > 0) {

      const storedLimitPrice = parseFloat(limitPrice);
      if (storedLimitPrice > 0) {
        // Update all buy token amounts based on their respective USD prices
        setBuyAmounts((prevAmounts) => {
          const newAmounts = [...prevAmounts];
          // First buy token uses the limit price directly
          // limitPrice is always stored in buy/sell format (buy tokens per sell token)
          if (buyTokens[0]) {
            const newBuyAmount = sellAmountNum * storedLimitPrice;
            newAmounts[0] = formatCalculatedValue(newBuyAmount);
          }
          // Additional buy tokens: calculate based on their limit prices
          if (pricesBound) {
            // Bound mode: use USD value with same premium
            const sellTokenUsdPrice = sellToken ? getPrice(sellToken.a) : 0;
            if (sellTokenUsdPrice > 0) {
              // Calculate the market price for first token in buy/sell format
              const firstBuyTokenUsdPrice = buyTokens[0] ? getPrice(buyTokens[0].a) : 0;
              const marketPriceForFirst = firstBuyTokenUsdPrice > 0 ? sellTokenUsdPrice / firstBuyTokenUsdPrice : 0;

              // storedLimitPrice is in buy/sell format, same as marketPriceForFirst
              const premiumMultiplier = marketPriceForFirst > 0 ? storedLimitPrice / marketPriceForFirst : 1;

              for (let i = 1; i < buyTokens.length; i++) {
                if (buyTokens[i]) {
                  const tokenUsdPrice = getPrice(buyTokens[i]!.a);
                  if (tokenUsdPrice > 0) {
                    // Calculate market price for this token (buy tokens per sell token)
                    const marketPriceForThis = sellTokenUsdPrice / tokenUsdPrice;
                    // Apply same premium/discount ratio
                    const adjustedPrice = marketPriceForThis * premiumMultiplier;
                    // buyAmount = sellAmount * adjustedPrice
                    const newAmount = sellAmountNum * adjustedPrice;
                    newAmounts[i] = formatCalculatedValue(newAmount);
                  }
                }
              }
            }
          } else {
            // Unbound mode: use each token's individual limit price
            for (let i = 1; i < buyTokens.length; i++) {
              const tokenLimitPrice = individualLimitPrices[i];
              if (tokenLimitPrice && tokenLimitPrice > 0) {
                const newAmount = sellAmountNum * tokenLimitPrice;
                newAmounts[i] = formatCalculatedValue(newAmount);
              }
            }
          }
          return newAmounts;
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sellAmountNum, limitPrice, pricesBound, individualLimitPrices]);

  // When first buy amount changes, update limit price and percentage
  // RULE: Sell amount stays the same, limit price and percentage recalculate
  // Only runs when user is typing in BUY - never when typing in sell
  useEffect(() => {
    if (activeInputRef.current === 'buy' &&
      !isInitialLoadRef.current &&
      buyAmountNum > 0 &&
      sellAmountNum > 0) {

      // Recalculate limit price: limitPrice = buyAmount / sellAmount
      const newLimitPrice = buyAmountNum / sellAmountNum;
      setLimitPrice(newLimitPrice.toString());
      onLimitPriceChange?.(newLimitPrice);

      // Recalculate percentage from new limit price vs market
      if (marketPrice > 0) {
        // marketPrice is sell/buy format, newLimitPrice is buy/sell format
        // Convert to same format for comparison
        const marketPriceBuyPerSell = 1 / marketPrice;
        const percentageAboveMarket = ((newLimitPrice - marketPriceBuyPerSell) / marketPriceBuyPerSell) * 100;
        setPricePercentage(Math.abs(percentageAboveMarket) > 0.01 ? percentageAboveMarket : null);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buyAmountNum]);

  // When an alt buy amount changes in UNLINKED mode, update that token's individual limit price
  // This ensures the limit price reflects the user's desired exchange rate
  // Only runs for the specific token being edited (tracked by lastEditedInputRef)
  useEffect(() => {
    // Only for unlinked mode
    if (pricesBound) return;
    // Only when user is typing in a buy input (not primary - that's handled above)
    if (activeInputRef.current !== 'buy') return;
    // Only process alt tokens (index > 0) - primary is handled by the buyAmountNum effect
    const editedIndex = lastEditedInputRef.current;
    if (typeof editedIndex !== 'number' || editedIndex === 0) return;
    if (sellAmountNum <= 0) return;

    const amount = buyAmounts[editedIndex];
    if (!amount) return;
    const amountNum = parseFloat(removeCommas(amount));
    if (amountNum <= 0) return;

    // Calculate limit price: limitPrice = buyAmount / sellAmount
    const newLimitPrice = amountNum / sellAmountNum;

    // Update individual limit price for this token only
    setIndividualLimitPrices(prev => {
      if (prev[editedIndex] === newLimitPrice) return prev;
      const newPrices = [...prev];
      newPrices[editedIndex] = newLimitPrice;
      return newPrices;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buyAmounts, sellAmountNum, pricesBound]);

  // Recalculate additional buy token amounts when prices change or new tokens are added
  // Only applies when prices are BOUND - when unlinked, each token keeps its own price
  useEffect(() => {
    if (buyTokens.length <= 1 || !sellAmount || sellAmountNum <= 0) return;
    // Don't auto-sync prices when unlinked
    if (!pricesBound) return;
    // Skip if a percentage click is in progress - it will set the amounts directly
    if (isPercentageClickInProgressRef.current) return;

    const sellTokenUsdPrice = sellToken ? getPrice(sellToken.a) : 0;
    if (sellTokenUsdPrice <= 0) return;

    const firstBuyTokenUsdPrice = buyTokens[0] ? getPrice(buyTokens[0].a) : 0;
    const storedLimitPrice = parseFloat(limitPrice) || 0;
    // Both marketPriceForFirst and storedLimitPrice are in buy/sell format
    const marketPriceForFirst = firstBuyTokenUsdPrice > 0 ? sellTokenUsdPrice / firstBuyTokenUsdPrice : 0;
    const premiumMultiplier = marketPriceForFirst > 0 && storedLimitPrice > 0 ? storedLimitPrice / marketPriceForFirst : 1;

    let hasUpdates = false;
    const newBuyAmounts = [...buyAmounts];

    for (let i = 1; i < buyTokens.length; i++) {
      const token = buyTokens[i];
      if (!token) continue;

      const tokenUsdPrice = getPrice(token.a);
      // Only auto-calculate if amount is empty/zero and we have valid price
      const currentAmount = buyAmounts[i] ? parseFloat(removeCommas(buyAmounts[i])) : 0;
      if (currentAmount === 0 && tokenUsdPrice > 0) {
        // Calculate market price for this token (buy tokens per sell token)
        const marketPriceForThis = sellTokenUsdPrice / tokenUsdPrice;
        // Apply same premium/discount ratio
        const adjustedPrice = marketPriceForThis * premiumMultiplier;
        // buyAmount = sellAmount * adjustedPrice
        const newAmount = sellAmountNum * adjustedPrice;
        newBuyAmounts[i] = formatCalculatedValue(newAmount);
        hasUpdates = true;
      }
    }

    if (hasUpdates) {
      setBuyAmounts(newBuyAmounts);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buyTokens.length, prices, sellAmountNum, limitPrice, pricesBound, invertPriceDisplay]);

  const handleCreateOrder = async () => {
    // Smooth scroll to top when confirming order
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Capture address early to avoid closure issues
    const userAddress = address;

    if (!sellToken || !sellAmount || !buyTokens[0] || !buyAmounts[0] || !userAddress || !publicClient) {
      toast({
        title: "Error",
        description: "Please fill in all required fields. Make sure your wallet is connected.",
        variant: "destructive",
      });
      return;
    }

    if (!isConnected) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet to create an order",
        variant: "destructive",
      });
      return;
    }

    if (!contractAddress) {
      toast({
        title: "Contract Not Available",
        description: "Contract address not found for this network",
        variant: "destructive",
      });
      return;
    }

    // Check expiration error
    if (expirationError) {
      toast({
        title: "Error",
        description: expirationError,
        variant: "destructive",
      });
      return;
    }

    try {
      setIsCreatingOrder(true);
      setTransactionPending(true);

      // Handle token approval if needed
      if (needsApproval && allowance !== undefined && allowance < sellAmountWei) {
        setIsApproving(true);
        toast({
          title: "Approval Required",
          description: `Approving ${sellToken.ticker} for trading...`,
        });

        const approvalResult = await approveToken();

        if (!approvalResult) {
          throw new Error('Token approval failed');
        }

        toast({
          title: "Approval Successful",
          description: `${sellToken.ticker} approved for trading`,
          variant: "success",
        });

        await refetchAllowance();
        setIsApproving(false);
      }

      // Prepare order parameters - Get whitelist indices
      const buyTokenIndices = buyTokens.map((token) => {
        if (!token) throw new Error('Buy token is null');

        const whitelistIndex = getContractWhitelistIndex(token.a);
        if (whitelistIndex === -1) {
          throw new Error(`Token ${token.ticker} is not whitelisted`);
        }

        return BigInt(whitelistIndex);
      });

      const buyAmountsWei = buyAmounts.map((amount, i) => {
        const token = buyTokens[i];
        if (!token) throw new Error('Buy token is null');
        return parseTokenAmount(removeCommas(amount), token.decimals);
      });

      const sellAmountForOrder = parseTokenAmount(removeCommas(sellAmount), sellToken.decimals);
      const expirationTime = BigInt(Math.floor(Date.now() / 1000 + expirationDays * 24 * 60 * 60));

      toast({
        title: "Creating Order",
        description: "Please confirm the transaction in your wallet...",
      });

      // Get listing fee from contract
      let listingFee = 0n;
      try {
        listingFee = await publicClient.readContract({
          address: contractAddress as `0x${string}`,
          abi: [
            {
              name: 'listingFee',
              type: 'function',
              stateMutability: 'view',
              inputs: [],
              outputs: [{ name: '', type: 'uint256' }],
            },
          ],
          functionName: 'listingFee',
        }) as bigint;
      } catch (error) {
        // Silently fail - will use 0n as fallback
      }

      // Calculate total value to send
      // - If selling native PLS: msg.value = sellAmount + listingFee
      // - If selling ERC20: msg.value = listingFee only (token transferred separately)
      const valueToSend = isNativeToken(sellToken.a)
        ? sellAmountForOrder + listingFee
        : listingFee;

      // Order details prepared for submission

      // Place the order with individual parameters (AgoraX_final.sol format)
      const txHash = await placeOrder(
        sellToken.a as `0x${string}`,  // _sellToken
        sellAmountForOrder,              // _sellAmount
        buyTokenIndices,                 // _buyTokensIndex
        buyAmountsWei,                   // _buyAmounts
        expirationTime,                  // _expirationTime
        allOrNothing,                    // _allOrNothing
        valueToSend                      // msg.value
      );



      if (!txHash) {
        throw new Error('Transaction failed');
      }

      toast({
        title: "Transaction Submitted",
        description: "Waiting for confirmation...",
      });

      // Wait for transaction confirmation
      await waitForTransactionWithTimeout(
        publicClient,
        txHash,
        TRANSACTION_TIMEOUTS.TRANSACTION
      );

      toast({
        title: "Order Created!",
        description: `Successfully created limit order`,
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

      // Track order creation event
      // Note: We don't have the exact order ID from the contract (no event emitted)
      // so we'll fetch the latest order count to estimate it
      let orderId: number | undefined;
      try {
        const totalOrders = await publicClient.readContract({
          address: AGORAX_CONTRACT_ADDRESS,
          abi: AGORAX_ABI,
          functionName: 'getTotalOrderCount',
        }) as bigint;
        orderId = Number(totalOrders);
      } catch {
        // If we can't get the order ID, continue without it
      }

      const sellAmountNum = parseFloat(removeCommas(sellAmount));
      const sellTokenPrice = prices[sellToken.a]?.price || 0;
      const sellValueUsd = sellAmountNum * sellTokenPrice;

      // Calculate total buy value in USD
      let totalBuyValueUsd = 0;
      buyTokens.forEach((token, i) => {
        if (token && buyAmounts[i]) {
          const buyAmountNum = parseFloat(removeCommas(buyAmounts[i]));
          const buyTokenPrice = prices[token.a]?.price || 0;
          totalBuyValueUsd += buyAmountNum * buyTokenPrice;
        }
      });

      // Calculate price vs market (positive = above market, negative = below)
      // If sellValueUsd > totalBuyValueUsd, seller is asking less than market value (good deal for buyer)
      // Formula: ((sellValue - buyValue) / sellValue) * 100 gives the discount/premium
      const priceVsMarketPercent = sellValueUsd > 0
        ? ((sellValueUsd - totalBuyValueUsd) / sellValueUsd) * 100
        : 0;

      trackOrderCreated({
        order_id: orderId || 0,
        sell_token: sellToken.ticker,
        sell_amount: removeCommas(sellAmount),
        buy_tokens: buyTokens.filter(Boolean).map(t => t!.ticker),
        buy_amounts: buyAmounts.filter((_, i) => buyTokens[i]).map(a => removeCommas(a)),
        volume_usd: sellValueUsd,
        is_all_or_nothing: allOrNothing,
        expiration: expirationDays,
        price_vs_market_percent: priceVsMarketPercent,
      });

      // Clear form
      setSellAmount('');
      setBuyAmounts(['']);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('limitOrderSellAmount');
        localStorage.removeItem('limitOrderBuyAmount');
        localStorage.removeItem('limitOrderBuyAmounts');
      }

      // Trigger table refresh
      if (onOrderCreated) {
        onOrderCreated();
      }

      // Reset confirmation step
      setShowConfirmation(false);

    } catch (error: any) {
      // Check if this is a timeout error (transaction submitted but confirmation pending)
      const isTimeout = error?.isTimeout ||
        error?.message?.includes('confirmation is taking') ||
        error?.message?.includes('Check Otterscan');

      if (isTimeout) {
        // Extract tx hash from error message if present
        const txHashMatch = error?.message?.match(/0x[a-fA-F0-9]{64}/);
        const txHash = txHashMatch ? txHashMatch[0] : null;

        // Show a non-destructive pending toast instead of error
        toast({
          title: "Order Pending",
          description: "Your order was submitted but is taking longer to confirm. It may still succeed - check the block explorer.",
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

        // Still clear form and trigger refresh since tx was submitted
        setShowConfirmation(false);
        if (onOrderCreated) {
          setTimeout(() => onOrderCreated(), 3000); // Delayed refresh
        }
        return;
      }

      // Extract detailed error information
      let errorMessage = "Failed to create order. Please try again.";
      let errorDetails = "";

      // Helper function to extract AgoraX error message from various error formats
      const extractContractError = (err: any): string | null => {
        // Check error.message for AgoraX errors
        if (err?.message) {
          const agoraMatch = err.message.match(/AgoraX: ([^"]+)/);
          if (agoraMatch) return `AgoraX: ${agoraMatch[1].trim()}`;
        }

        // Check error.reason (ethers.js format)
        if (err?.reason) {
          if (err.reason.includes('AgoraX:')) return err.reason;
          return err.reason;
        }

        // Check error.data.message (some providers)
        if (err?.data?.message) {
          const agoraMatch = err.data.message.match(/AgoraX: ([^"]+)/);
          if (agoraMatch) return `AgoraX: ${agoraMatch[1].trim()}`;
        }

        // Check error.error.message (nested error format)
        if (err?.error?.message) {
          const agoraMatch = err.error.message.match(/AgoraX: ([^"]+)/);
          if (agoraMatch) return `AgoraX: ${agoraMatch[1].trim()}`;
        }

        // Check shortMessage (viem format)
        if (err?.shortMessage) {
          const agoraMatch = err.shortMessage.match(/AgoraX: ([^"]+)/);
          if (agoraMatch) return `AgoraX: ${agoraMatch[1].trim()}`;
        }

        // Check cause (nested errors)
        if (err?.cause) {
          return extractContractError(err.cause);
        }

        return null;
      };

      // First try to extract the actual contract error message
      const contractError = extractContractError(error);

      if (contractError) {
        errorMessage = "Contract Error";
        errorDetails = contractError;
      } else if (error?.message) {
        errorMessage = error.message;

        // Check for contract revert first (most important)
        if (error.message.includes('reverted on-chain') || error.message.includes('Transaction reverted')) {
          errorMessage = "Contract Error: Transaction Reverted";
          errorDetails = "The smart contract rejected this transaction. This could be due to: insufficient token balance, tokens not whitelisted on testnet, or invalid order parameters.";
        }
        // Extract revert reason if available
        else if (error.message.includes('execution reverted:')) {
          const revertMatch = error.message.match(/execution reverted: (.+?)(?:\n|$)/);
          if (revertMatch) {
            errorMessage = "Contract Reverted";
            errorDetails = `Reason: ${revertMatch[1]}`;
          }
        }
        // Check for common errors
        else if (error.message.includes('insufficient funds')) {
          errorMessage = "Insufficient Funds";
          errorDetails = "You don't have enough balance to cover the amount + gas fees";
        } else if (error.message.includes('user rejected') || error.message.includes('User rejected')) {
          errorMessage = "Transaction Cancelled";
          errorDetails = "You rejected the transaction in your wallet";
        } else if (error.message.includes('nonce')) {
          errorMessage = "Transaction Nonce Error";
          errorDetails = "Try resetting your wallet or waiting a moment";
        } else if (error.message.includes('gas')) {
          errorMessage = "Gas Estimation Failed";
          errorDetails = "The transaction may fail. Check token approvals and contract state";
        }
      }

      // Log full error details for debugging


      toast({
        title: errorMessage,
        description: errorDetails,
        variant: "destructive",
      });
    } finally {
      setIsCreatingOrder(false);
      setIsApproving(false);
      setTransactionPending(false);
    }
  };

  const handleExpirationPreset = (days: number) => {
    const MIN_EXPIRATION_DAYS = 10 / 86400; // 10 seconds in days

    if (days < MIN_EXPIRATION_DAYS) {
      setExpirationError(`Minimum expiration is 10 seconds (${MIN_EXPIRATION_DAYS.toFixed(8)} days)`);
      return;
    }

    setExpirationError(null);
    setExpirationDays(days);
    setExpirationInput(days.toString());
    // Calculate and set the date using milliseconds for accurate hour-based calculation
    const futureDate = new Date();
    const millisecondsToAdd = days * 24 * 60 * 60 * 1000; // Convert days to milliseconds
    futureDate.setTime(futureDate.getTime() + millisecondsToAdd);
    setSelectedDate(futureDate);
  };

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) return;

    // Preserve the current time from selectedDate if it exists
    if (selectedDate) {
      date.setHours(selectedDate.getHours(), selectedDate.getMinutes(), selectedDate.getSeconds());
    } else {
      // For new selection, default to 1 hour from now if selecting today
      const now = new Date();
      const isToday = date.toDateString() === now.toDateString();
      if (isToday) {
        const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);
        date.setHours(oneHourLater.getHours(), oneHourLater.getMinutes(), oneHourLater.getSeconds());
      } else {
        // For future dates, default to noon
        date.setHours(12, 0, 0);
      }
    }

    const now = new Date();
    const diffTime = date.getTime() - now.getTime();
    const diffSeconds = diffTime / 1000;
    const MIN_EXPIRATION_SECONDS = 10;

    if (diffSeconds < MIN_EXPIRATION_SECONDS) {
      setExpirationError(`Selected date must be at least ${MIN_EXPIRATION_SECONDS} seconds in the future`);
      return;
    }

    setExpirationError(null);
    setSelectedDate(date);
    const diffDays = diffTime / (1000 * 60 * 60 * 24);

    if (diffDays > 0) {
      setExpirationDays(diffDays);
      setExpirationInput(diffDays.toString());
    }
  };

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const timeValue = e.target.value;
    if (!timeValue) return;

    const [hours, minutes, seconds] = timeValue.split(':').map(Number);

    // Use selectedDate if exists, otherwise use today
    const newDate = selectedDate ? new Date(selectedDate) : new Date();
    newDate.setHours(hours, minutes, seconds || 0);

    const now = new Date();
    const diffTime = newDate.getTime() - now.getTime();
    const diffSeconds = diffTime / 1000;
    const MIN_EXPIRATION_SECONDS = 10;

    // Always update the selected date, but show warning if in past
    setSelectedDate(newDate);

    if (diffSeconds < MIN_EXPIRATION_SECONDS) {
      setExpirationError(`Selected time must be at least ${MIN_EXPIRATION_SECONDS} seconds in the future`);
    } else {
      setExpirationError(null);
    }

    const diffDays = diffTime / (1000 * 60 * 60 * 24);
    if (diffDays > 0) {
      setExpirationDays(diffDays);
      setExpirationInput(diffDays.toString());
    }
  };

  const handlePercentageClick = (percentage: number, direction: 'above' | 'below' = 'above') => {
    if (!marketPrice) return;

    // Mark that we're in a percentage click to prevent useEffect from overwriting
    isPercentageClickInProgressRef.current = true;

    let effectiveSellAmount = sellAmountNum;
    if (!sellAmountNum || sellAmountNum === 0) {
      effectiveSellAmount = 1;
      setSellAmount('1');
    }

    limitPriceSetByUserRef.current = true;
    isInitialLoadRef.current = false;

    const adjustedPercentage = direction === 'above' ? percentage : -percentage;
    setPricePercentage(percentage === 0 ? null : adjustedPercentage);

    // marketPrice is in sell/buy format (inverted)
    // Convert to buy/sell format and apply percentage
    const buyPerSellAtMarket = 1 / marketPrice;
    const priceToStore = buyPerSellAtMarket * (1 + adjustedPercentage / 100);

    setLimitPrice(priceToStore.toFixed(8));

    // onLimitPriceChange expects non-inverted price (buy/sell)
    if (onLimitPriceChange) {
      onLimitPriceChange(priceToStore);
    }

    // Update buy token amounts based on their respective USD prices
    setBuyAmounts((prevAmounts) => {
      const newAmounts = [...prevAmounts];
      // First buy token uses the non-inverted limit price (buy/sell)
      // buyAmount = sellAmount * (buy tokens per sell token)
      if (buyTokens[0]) {
        const newBuyAmount = effectiveSellAmount * priceToStore;
        newAmounts[0] = formatCalculatedValue(newBuyAmount);
      }

      // Only update additional tokens if prices are BOUND
      // When unlinked, each token has its own independent price
      if (pricesBound) {
        const sellTokenUsdPrice = sellToken ? getPrice(sellToken.a) : 0;
        if (sellTokenUsdPrice > 0) {
          const sellUsdValue = effectiveSellAmount * sellTokenUsdPrice;
          // The premium multiplier is based on the percentage adjustment
          const premiumMultiplier = 1 + adjustedPercentage / 100;

          for (let i = 1; i < buyTokens.length; i++) {
            if (buyTokens[i]) {
              const tokenUsdPrice = getPrice(buyTokens[i]!.a);
              if (tokenUsdPrice > 0) {
                // Apply same premium/discount to this token's market rate
                const marketAmount = sellUsdValue / tokenUsdPrice;
                const adjustedAmount = marketAmount * premiumMultiplier;
                newAmounts[i] = formatCalculatedValue(adjustedAmount);
              }
            }
          }
        }
      }
      return newAmounts;
    });

    // Update individual limit prices for first token when unbound
    if (!pricesBound) {
      setIndividualLimitPrices(prev => {
        const newPrices = [...prev];
        newPrices[0] = priceToStore;
        return newPrices;
      });
    }

    // Reset the flag after React has processed the state updates
    // Use longer timeout to ensure all effects have run with the updated state
    setTimeout(() => {
      isPercentageClickInProgressRef.current = false;
    }, 100);
  };

  // Handler for setting limit price to backing value
  const handleBackingPriceClick = () => {
    const backingPrice = getBackingLimitPrice();
    if (!backingPrice || !sellToken) return;

    // Mark that we're in a backing click to prevent useEffect from overwriting
    isPercentageClickInProgressRef.current = true;

    let effectiveSellAmount = sellAmountNum;
    if (!sellAmountNum || sellAmountNum === 0) {
      effectiveSellAmount = 1;
      setSellAmount('1');
    }

    limitPriceSetByUserRef.current = true;
    isInitialLoadRef.current = false;

    // Calculate what percentage the backing is from market
    // marketPrice is in sell/buy format, backingPrice is in buy/sell format
    // Convert marketPrice to buy/sell for comparison
    if (marketPrice && marketPrice > 0) {
      const marketPriceBuyPerSell = 1 / marketPrice;
      const percentFromMarket = ((backingPrice - marketPriceBuyPerSell) / marketPriceBuyPerSell) * 100;
      setPricePercentage(percentFromMarket);
    } else {
      setPricePercentage(null);
    }

    // backingPrice is in buy/sell format (buy tokens per sell token)
    // limitPrice is always stored in buy/sell format
    setLimitPrice(backingPrice.toFixed(8));

    // onLimitPriceChange expects buy/sell format
    if (onLimitPriceChange) {
      onLimitPriceChange(backingPrice);
    }

    // Update buy token amounts using buy/sell price
    setBuyAmounts((prevAmounts) => {
      const newAmounts = [...prevAmounts];
      if (buyTokens[0]) {
        const newBuyAmount = effectiveSellAmount * backingPrice;
        newAmounts[0] = formatCalculatedValue(newBuyAmount);
      }

      // Update additional tokens if prices are bound
      if (pricesBound && marketPrice && marketPrice > 0) {
        const sellTokenUsdPrice = sellToken ? getPrice(sellToken.a) : 0;
        if (sellTokenUsdPrice > 0) {
          const sellUsdValue = effectiveSellAmount * sellTokenUsdPrice;
          // Convert marketPrice to buy/sell for comparison
          const marketPriceBuyPerSell = 1 / marketPrice;
          const premiumMultiplier = backingPrice / marketPriceBuyPerSell;

          for (let i = 1; i < buyTokens.length; i++) {
            if (buyTokens[i]) {
              const tokenUsdPrice = getPrice(buyTokens[i]!.a);
              if (tokenUsdPrice > 0) {
                const marketAmount = sellUsdValue / tokenUsdPrice;
                const adjustedAmount = marketAmount * premiumMultiplier;
                newAmounts[i] = formatCalculatedValue(adjustedAmount);
              }
            }
          }
        }
      }
      return newAmounts;
    });

    // Update individual limit prices for first token when unbound
    if (!pricesBound) {
      setIndividualLimitPrices(prev => {
        const newPrices = [...prev];
        newPrices[0] = backingPrice;
        return newPrices;
      });
    }

    // Reset the flag after React has processed the state updates
    // Use longer timeout to ensure all effects have run with the updated state
    setTimeout(() => {
      isPercentageClickInProgressRef.current = false;
    }, 100);
  };

  // Handler for individual token percentage clicks (when prices are unbound)
  // Uses centralized pricing hook for clean one-way data flow
  const handleIndividualPercentageClick = (tokenIndex: number, percentage: number, direction: 'above' | 'below' = 'above') => {
    const token = buyTokens[tokenIndex];
    if (!token || !sellToken) return;

    // Use centralized hook handler - handles limit price, buy amount, and parent notifications
    pricing.handleIndividualPercentageClick(
      tokenIndex,
      percentage,
      direction,
      sellToken,
      token,
      invertPriceDisplay
    );
  };

  // Handler for setting individual token limit price to backing value
  const handleIndividualBackingPriceClick = (tokenIndex: number) => {
    const token = buyTokens[tokenIndex];
    if (!token || !sellToken) return;

    const isHexVariant = (ticker: string) => {
      return ticker === 'HEX' || ticker === 'eHEX' || ticker === 'pHEX' || ticker === 'weHEX';
    };

    let limitPrice: number | null = null;

    // Case 1: Selling MAXI for HEX - limit price = backing (HEX per MAXI)
    const sellTokenBacking = getBackingPriceForToken(sellToken);
    if (sellTokenBacking && isHexVariant(token.ticker)) {
      limitPrice = sellTokenBacking;
    }

    // Case 2: Selling HEX for MAXI - limit price = 1/backing (MAXI per HEX)
    const buyTokenBacking = getBackingPriceForToken(token);
    if (isHexVariant(sellToken.ticker) && buyTokenBacking) {
      limitPrice = 1 / buyTokenBacking;
    }

    if (!limitPrice) return;

    // Update individual limit prices and notify parent
    const newPrices = [...individualLimitPrices];
    newPrices[tokenIndex] = limitPrice;
    setIndividualLimitPrices(newPrices);
    onIndividualLimitPricesChange?.(newPrices);

    // Update the buy amount for this token
    const effectiveSellAmount = sellAmountNum > 0 ? sellAmountNum : 1;
    const newBuyAmount = effectiveSellAmount * limitPrice;

    const newAmounts = [...buyAmounts];
    newAmounts[tokenIndex] = formatCalculatedValue(newBuyAmount);
    setBuyAmounts(newAmounts);
  };

  // Check if we can show backing button for a specific additional token
  // Also requires maxiStats toggle to be enabled
  const canShowIndividualBackingButton = (tokenIndex: number): boolean => {
    if (!maxiStats || !hasTokenAccess || !sellToken) return false;

    const token = buyTokens[tokenIndex];
    if (!token) return false;

    const isHexVariant = (ticker: string) => {
      return ticker === 'HEX' || ticker === 'eHEX' || ticker === 'pHEX' || ticker === 'weHEX';
    };

    // Case 1: Sell token has backing, buy token is HEX
    const sellTokenBacking = getBackingPriceForToken(sellToken);
    if (sellTokenBacking && isHexVariant(token.ticker)) {
      return true;
    }

    // Case 2: Sell token is HEX, buy token has backing
    const buyTokenBacking = getBackingPriceForToken(token);
    if (isHexVariant(sellToken.ticker) && buyTokenBacking) {
      return true;
    }

    return false;
  };

  const handleMaxSellAmount = () => {
    if (!actualBalance) return;

    let maxAmount = actualBalance.formatted;

    if (sellToken?.a === '0x000000000000000000000000000000000000dead') {
      const balanceNum = parseFloat(maxAmount);
      const reservedGas = 0.1;
      maxAmount = Math.max(0, balanceNum - reservedGas).toString();
    }

    setSellAmount(formatNumberWithCommas(maxAmount));
  };

  const handleSellAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const cursorPos = input.selectionStart || 0;
    const oldValue = input.value;

    let value = e.target.value;
    // Remove commas first, then filter to only numbers and decimal
    value = removeCommas(value).replace(/[^0-9.]/g, '');

    const parts = value.split('.');
    if (parts.length > 2) {
      value = parts[0] + '.' + parts.slice(1).join('');
    }

    // Handle leading zeros - preserve trailing zeros for easier editing
    // e.g., "10000" → delete "1" → "0000" should stay so user can type "2" → "20000"
    if (parts[0]) {
      // Only strip leading zeros if there are non-zero digits after them
      // This allows "0000" to stay as "0000" for editing convenience
      const hasNonZero = /[1-9]/.test(parts[0]);
      if (hasNonZero) {
        parts[0] = parts[0].replace(/^0+/, '');
      }
      // Keep at least one zero if the whole thing is zeros
      if (parts[0] === '' || /^0+$/.test(parts[0])) {
        parts[0] = parts[0] || '0';
      }
      if (parts.length > 1) {
        value = parts[0] + '.' + parts.slice(1).join('');
      } else {
        value = parts[0];
      }
    }

    // Mark that we're typing in sell - this ensures one-way flow (sell→buy only)
    activeInputRef.current = 'sell';
    lastEditedInputRef.current = 'sell';
    const newValue = formatNumberWithCommas(value);
    // Store with commas for display
    setSellAmount(newValue);

    // Calculate new cursor position
    // Count digits before cursor in old value
    const digitsBeforeCursor = removeCommas(oldValue.slice(0, cursorPos)).length;

    // Find position in new value that has same number of digits before it
    let newCursorPos = 0;
    let digitCount = 0;
    for (let i = 0; i < newValue.length; i++) {
      if (digitCount >= digitsBeforeCursor) {
        newCursorPos = i;
        break;
      }
      if (newValue[i] !== ',') {
        digitCount++;
      }
      newCursorPos = i + 1;
    }

    requestAnimationFrame(() => {
      if (sellInputRef.current) {
        sellInputRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    });
  };

  const handleBuyAmountChange = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const input = e.target;
    const cursorPos = input.selectionStart || 0;
    const oldValue = input.value;

    let value = e.target.value;
    // Remove commas first, then filter to only numbers and decimal
    value = removeCommas(value).replace(/[^0-9.]/g, '');

    const parts = value.split('.');
    if (parts.length > 2) {
      value = parts[0] + '.' + parts.slice(1).join('');
    }

    // Handle leading zeros - preserve trailing zeros for easier editing
    // e.g., "10000" → delete "1" → "0000" should stay so user can type "2" → "20000"
    if (parts[0]) {
      // Only strip leading zeros if there are non-zero digits after them
      const hasNonZero = /[1-9]/.test(parts[0]);
      if (hasNonZero) {
        parts[0] = parts[0].replace(/^0+/, '');
      }
      // Keep at least one zero if the whole thing is zeros
      if (parts[0] === '' || /^0+$/.test(parts[0])) {
        parts[0] = parts[0] || '0';
      }
      if (parts.length > 1) {
        value = parts[0] + '.' + parts.slice(1).join('');
      } else {
        value = parts[0];
      }
    }

    // Mark that we're typing in buy - this ensures one-way flow (buy→sell only)
    activeInputRef.current = 'buy';
    lastEditedInputRef.current = index;
    const newAmounts = [...buyAmounts];
    const newValue = formatNumberWithCommas(value);
    // Store with commas for display
    newAmounts[index] = newValue;

    // When prices are linked and we have multiple buy tokens, update all other amounts proportionally
    // Use the limit prices to maintain the same sell token value across all buy tokens
    // Note: We DON'T update sell amount here - that's handled by the useEffect when lastEditedInput is set
    if (pricesBound && buyTokens.length > 1 && value && parseFloat(value) > 0) {
      const changedToken = buyTokens[index];
      const changedAmount = parseFloat(value);

      if (changedToken && sellToken) {
        // Get the limit price for the changed token (in sell token per buy token)
        // For index 0, use the main limitPrice; for others, calculate from USD prices
        let changedTokenLimitPrice: number | undefined;

        if (index === 0 && limitPrice) {
          changedTokenLimitPrice = parseFloat(limitPrice);
        } else {
          // Calculate the derived limit price for this token
          // If token is more valuable in USD, its limit price (PLS per token) should be proportionally higher
          const firstBuyTokenUsdPrice = buyTokens[0] ? getPrice(buyTokens[0].a) : 0;
          const thisTokenUsdPrice = getPrice(changedToken.a);

          if (firstBuyTokenUsdPrice > 0 && thisTokenUsdPrice > 0 && limitPrice) {
            const mainPrice = parseFloat(limitPrice);
            // derivedPrice = mainPrice * (thisTokenUsdPrice / firstBuyTokenUsdPrice)
            changedTokenLimitPrice = mainPrice * (thisTokenUsdPrice / firstBuyTokenUsdPrice);
          }
        }

        if (changedTokenLimitPrice && changedTokenLimitPrice > 0) {
          // Calculate the sell token value: buyAmount * limitPrice = sellAmount equivalent
          const sellTokenValue = changedAmount * changedTokenLimitPrice;

          // Update all other token amounts based on their limit prices
          buyTokens.forEach((token, i) => {
            if (i !== index && token) {
              let tokenLimitPrice: number | undefined;

              if (i === 0 && limitPrice) {
                tokenLimitPrice = parseFloat(limitPrice);
              } else {
                // Calculate derived limit price for this token
                // If token is more valuable in USD, its limit price (PLS per token) should be proportionally higher
                const firstBuyTokenUsdPrice = buyTokens[0] ? getPrice(buyTokens[0].a) : 0;
                const thisTokenUsdPrice = getPrice(token.a);

                if (firstBuyTokenUsdPrice > 0 && thisTokenUsdPrice > 0 && limitPrice) {
                  const mainPrice = parseFloat(limitPrice);
                  tokenLimitPrice = mainPrice * (thisTokenUsdPrice / firstBuyTokenUsdPrice);
                }
              }

              if (tokenLimitPrice && tokenLimitPrice > 0) {
                // buyAmount = sellTokenValue / limitPrice
                const newAmount = sellTokenValue / tokenLimitPrice;
                newAmounts[i] = formatNumberWithCommas(formatCalculatedValue(newAmount));
              }
            }
          });
        }
      }
    }

    setBuyAmounts(newAmounts);

    // Calculate new cursor position
    // Count digits before cursor in old value
    const digitsBeforeCursor = removeCommas(oldValue.slice(0, cursorPos)).length;

    // Find position in new value that has same number of digits before it
    let newCursorPos = 0;
    let digitCount = 0;
    for (let i = 0; i < newValue.length; i++) {
      if (digitCount >= digitsBeforeCursor) {
        newCursorPos = i;
        break;
      }
      if (newValue[i] !== ',') {
        digitCount++;
      }
      newCursorPos = i + 1;
    }

    requestAnimationFrame(() => {
      const buyInput = buyInputRefs.current[index];
      if (buyInput) {
        buyInput.setSelectionRange(newCursorPos, newCursorPos);
      }
    });
  };

  // Handle keydown for backspace on comma - delete the digit before the comma
  const handleSellKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      const input = e.currentTarget;
      const cursorPos = input.selectionStart || 0;
      const value = input.value;

      // If cursor is right after a comma, delete the digit before the comma
      if (cursorPos > 0 && value[cursorPos - 1] === ',') {
        e.preventDefault();
        // Find the digit before the comma and remove it
        const beforeComma = value.slice(0, cursorPos - 1);
        const afterComma = value.slice(cursorPos);
        const lastDigitIndex = beforeComma.length - 1;

        if (lastDigitIndex >= 0) {
          const newValue = beforeComma.slice(0, lastDigitIndex) + afterComma;
          const cleanValue = removeCommas(newValue).replace(/[^0-9.]/g, '');
          const formattedValue = formatNumberWithCommas(cleanValue);
          setSellAmount(formattedValue);

          // Set cursor position
          const digitsBeforeCursor = removeCommas(beforeComma.slice(0, lastDigitIndex)).length;
          let newCursorPos = 0;
          let digitCount = 0;
          for (let i = 0; i < formattedValue.length; i++) {
            if (digitCount >= digitsBeforeCursor) {
              newCursorPos = i;
              break;
            }
            if (formattedValue[i] !== ',') {
              digitCount++;
            }
            newCursorPos = i + 1;
          }

          requestAnimationFrame(() => {
            if (sellInputRef.current) {
              sellInputRef.current.setSelectionRange(newCursorPos, newCursorPos);
            }
          });
        }
      }
    }
  };

  const handleBuyKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Backspace') {
      const input = e.currentTarget;
      const cursorPos = input.selectionStart || 0;
      const value = input.value;

      // If cursor is right after a comma, delete the digit before the comma
      if (cursorPos > 0 && value[cursorPos - 1] === ',') {
        e.preventDefault();
        // Find the digit before the comma and remove it
        const beforeComma = value.slice(0, cursorPos - 1);
        const afterComma = value.slice(cursorPos);
        const lastDigitIndex = beforeComma.length - 1;

        if (lastDigitIndex >= 0) {
          const newValue = beforeComma.slice(0, lastDigitIndex) + afterComma;
          const cleanValue = removeCommas(newValue).replace(/[^0-9.]/g, '');
          const formattedValue = formatNumberWithCommas(cleanValue);

          const newAmounts = [...buyAmounts];
          newAmounts[index] = formattedValue;
          setBuyAmounts(newAmounts);

          // Set cursor position
          const digitsBeforeCursor = removeCommas(beforeComma.slice(0, lastDigitIndex)).length;
          let newCursorPos = 0;
          let digitCount = 0;
          for (let i = 0; i < formattedValue.length; i++) {
            if (digitCount >= digitsBeforeCursor) {
              newCursorPos = i;
              break;
            }
            if (formattedValue[i] !== ',') {
              digitCount++;
            }
            newCursorPos = i + 1;
          }

          requestAnimationFrame(() => {
            const buyInput = buyInputRefs.current[index];
            if (buyInput) {
              buyInput.setSelectionRange(newCursorPos, newCursorPos);
            }
          });
        }
      }
    }
  };

  const handleAddBuyToken = () => {
    if (buyTokens.length >= 10) return;

    setBuyTokens([...buyTokens, null]);
    setBuyAmounts([...buyAmounts, '']);
    setShowBuyDropdowns([...showBuyDropdowns, false]);
    setBuySearchQueries([...buySearchQueries, '']);
    setIsBuyInputFocused([...isBuyInputFocused, false]);
  };

  const handleRemoveBuyToken = (index: number) => {
    if (buyTokens.length > 1) {
      setBuyTokens(buyTokens.filter((_, i) => i !== index));
      setBuyAmounts(buyAmounts.filter((_, i) => i !== index));
      setShowBuyDropdowns(showBuyDropdowns.filter((_, i) => i !== index));
      setBuySearchQueries(buySearchQueries.filter((_, i) => i !== index));
      setIsBuyInputFocused(isBuyInputFocused.filter((_, i) => i !== index));
      setDuplicateTokenError(null);
      // Clear basket selection when manually removing tokens
      setSelectedBasket(null);
    }
  };

  // Function to swap sell and buy tokens/amounts
  const handleSwapTokens = () => {
    // Can only swap if there's exactly one buy token
    if (buyTokens.length === 1 && sellToken && buyTokens[0]) {
      // Calculate the percentage difference from market price before swap
      // limitPrice is stored in buy/sell format
      // marketPrice (from line 1595) is in sell/buy format
      let percentageDiff: number | null = null;
      if (limitPrice && marketPrice && parseFloat(limitPrice) > 0 && marketPrice > 0) {
        const storedLimitPrice = parseFloat(limitPrice);
        const marketPriceBuyPerSell = 1 / marketPrice;
        percentageDiff = ((storedLimitPrice - marketPriceBuyPerSell) / marketPriceBuyPerSell) * 100;
      }

      // Swap tokens
      const tempToken = sellToken;
      setSellToken(buyTokens[0]);
      setBuyTokens([tempToken]);

      // Swap amounts
      const tempAmount = sellAmount;
      setSellAmount(buyAmounts[0]);
      setBuyAmounts([tempAmount]);

      // After swapping, the market price relationship inverts
      // New market price in buy/sell format = 1 / old market price in sell/buy format
      // But since old market price was sell/buy, new = old (since it's the reciprocal of the swap)
      // Actually: old marketPrice = buyTokenPrice / sellTokenPrice (sell/buy)
      // After swap: new marketPrice = sellTokenPrice / buyTokenPrice = 1/marketPrice (also sell/buy for new tokens)
      // So new limit price in buy/sell = 1 / (1/marketPrice) * (1+pct) = marketPrice * (1+pct)
      // Wait, let me think again...
      // After swap, the new market price in buy/sell format for the NEW pair:
      // newBuyPerSell = newSellTokenPrice / newBuyTokenPrice = oldBuyTokenPrice / oldSellTokenPrice
      // = 1 / (oldSellTokenPrice / oldBuyTokenPrice) = 1 / (1/marketPrice) = marketPrice
      // So newMarketPriceBuyPerSell = marketPrice (which was in sell/buy format, but now represents buy/sell for swapped pair)

      // Apply the same percentage difference to the new market price
      if (percentageDiff !== null && marketPrice > 0) {
        // After swap, marketPrice value becomes the buy/sell rate for new pair
        const newLimitPrice = marketPrice * (1 + percentageDiff / 100);
        setLimitPrice(newLimitPrice.toFixed(8));

        // Notify parent of the new limit price
        if (onLimitPriceChange) {
          onLimitPriceChange(newLimitPrice);
        }

        // Update price percentage display
        setPricePercentage(percentageDiff);
      }
    }
  };

  // Handle buy token selection - uses centralized pricing hook
  // See /docs/limit-order-data-flow.md for data flow rules
  const handleBuyTokenSelect = (tokenFromList: any, index: number) => {
    const token: TokenOption = {
      a: tokenFromList.a,
      ticker: tokenFromList.ticker,
      name: tokenFromList.name,
      decimals: tokenFromList.decimals
    };

    // Mark token change as pending IMMEDIATELY to prevent other effects from
    // triggering with stale values before the deferred handler runs
    if (index === 0 || selectedBasket) {
      tokenChangePendingRef.current = true;
    }

    // If a basket is selected, replace all tokens with just the selected one
    // This allows user to switch from basket to single token
    if (selectedBasket) {
      setBuyTokens([token]);
      setBuyAmounts(['']);
    } else {
      const newBuyTokens = [...buyTokens];
      newBuyTokens[index] = token;
      setBuyTokens(newBuyTokens);
    }

    const newDropdowns = [...showBuyDropdowns];
    newDropdowns[index] = false;
    setShowBuyDropdowns(newDropdowns);

    const newSearchQueries = [...buySearchQueries];
    newSearchQueries[index] = '';
    setBuySearchQueries(newSearchQueries);

    // Clear basket selection when manually selecting a token
    setSelectedBasket(null);

    // Save first buy token to localStorage for chart
    if (index === 0) {
      localStorage.setItem('limitOrderBuyToken', token.a);
      // Note: Price recalculation is handled by the deferred useEffect above
      // (search for "DEFERRED TOKEN CHANGE HANDLER") to avoid race conditions
      // where prices aren't ready when this handler runs
    }

    // Auto-calculate buy amount for additional tokens (index > 0)
    if (index > 0) {
      pricing.handleAdditionalBuyTokenChange(token, index, sellToken, newBuyTokens[0], pricesBound);

      // Always set the individual limit price to market when a new token is selected
      // This ensures the price is initialized correctly (both bound and unbound modes)
      if (sellToken) {
        const tokenUsdPrice = getPrice(token.a);
        const sellTokenUsdPrice = getPrice(sellToken.a);
        if (tokenUsdPrice > 0 && sellTokenUsdPrice > 0) {
          const marketPrice = sellTokenUsdPrice / tokenUsdPrice;
          setIndividualLimitPrices(prev => {
            const newPrices = [...prev];
            newPrices[index] = marketPrice;
            return newPrices;
          });
        }
      }
    }
  };

  // Handle sell token selection
  // See /docs/limit-order-data-flow.md for data flow rules
  const handleSellTokenSelect = (token: { a: string; ticker: string; name: string; decimals: number }) => {
    // Mark token change as pending IMMEDIATELY to prevent other effects from
    // triggering with stale values before the deferred handler runs
    tokenChangePendingRef.current = true;

    const tokenOption: TokenOption = { a: token.a, ticker: token.ticker, name: token.name, decimals: token.decimals };
    setSellToken(tokenOption);
    localStorage.setItem('limitOrderSellToken', token.a);
    localStorage.removeItem('limitOrderCustomSellToken');
    setShowSellDropdown(false);
    setSellSearchQuery('');

    // Note: Price recalculation is handled by the deferred useEffect above
    // (search for "DEFERRED TOKEN CHANGE HANDLER") to avoid race conditions
    // where prices aren't ready when this handler runs
  };

  // Handle basket selection - expands basket into multiple buy tokens
  const handleBasketSelect = (basket: TokenBasket, index: number) => {
    const basketTokens = getBasketTokens(basket.id);

    // Allow all basket tokens including sell token - user may want same token in buy/sell
    const validTokens = basketTokens;

    if (validTokens.length === 0) return;

    // Replace current buy tokens with all basket tokens
    setBuyTokens(validTokens);
    setSelectedBasket(basket.id);
    setDisplayedPriceTokenIndex(0); // Reset to first token when selecting a basket

    // Close dropdown
    const newDropdowns = [...showBuyDropdowns];
    newDropdowns[index] = false;
    setShowBuyDropdowns(newDropdowns);

    // Reset search
    const newSearchQueries = validTokens.map(() => '');
    setBuySearchQueries(newSearchQueries);

    // Initialize buy amounts array for each token (empty)
    const newBuyAmounts = validTokens.map(() => '');
    setBuyAmounts(newBuyAmounts);

    // Initialize individual prices array
    setIndividualLimitPrices(validTokens.map(() => undefined));

    // Save first buy token to localStorage for chart
    if (validTokens[0]) {
      localStorage.setItem('limitOrderBuyToken', validTokens[0].a);
    }

    // Auto-calculate buy amounts if we have sell amount and prices
    if (sellAmount && parseFloat(removeCommas(sellAmount)) > 0 && sellToken) {
      const sellAmt = parseFloat(removeCommas(sellAmount));
      const sellTokenUsdPrice = getPrice(sellToken.a);

      if (sellTokenUsdPrice > 0) {
        // Get the first token's market price to calculate premium multiplier
        const firstBuyTokenUsdPrice = validTokens[0] ? getPrice(validTokens[0].a) : 0;
        // Market price is always in "buy tokens per sell token" (non-inverted form)
        const marketPriceForFirst = firstBuyTokenUsdPrice > 0 ? sellTokenUsdPrice / firstBuyTokenUsdPrice : 0;

        // When selecting a basket, update the limit price to the new token's market price
        // preserving any existing percentage premium/discount
        let newLimitPrice = marketPriceForFirst;
        let premiumMultiplier = 1;

        if (pricePercentage !== null && marketPriceForFirst > 0) {
          // Apply existing percentage to new market price
          premiumMultiplier = 1 + pricePercentage / 100;
          newLimitPrice = marketPriceForFirst * premiumMultiplier;
        }

        // Update the limit price state for the new token pair
        if (newLimitPrice > 0) {
          setLimitPrice(newLimitPrice.toFixed(8));
          if (onLimitPriceChange) {
            onLimitPriceChange(newLimitPrice);
          }
        }

        const calculatedAmounts = validTokens.map((token) => {
          const tokenUsdPrice = getPrice(token.a);
          if (tokenUsdPrice > 0) {
            // Each token shows the FULL amount (not split), with same premium applied
            const marketPriceForThis = sellTokenUsdPrice / tokenUsdPrice;
            const adjustedPrice = marketPriceForThis * premiumMultiplier;
            const amount = sellAmt * adjustedPrice;
            return formatCalculatedValue(amount);
          }
          return '';
        });
        setBuyAmounts(calculatedAmounts);
      }
    }
  };

  return (
    <>
      <LiquidGlassCard className="w-full p-6" shadowIntensity="sm" glowIntensity="sm" blurIntensity="xl">
        {showConfirmation ? (
          /* Step 2: Order Confirmation */
          <div className="space-y-6">
            {/* Header */}
            <div className="text-center">
              <h2 className="text-xl font-bold text-white mb-1">Confirm Your Order</h2>
              <p className="text-white/60 text-sm">Review your limit order details before submitting</p>
            </div>

            {/* Order Details Card */}
            <LiquidGlassCard
              className="p-5 bg-white/5 border-white/10"
              borderRadius="16px"
              shadowIntensity="xs"
              glowIntensity="none"
            >
              {/* You're Selling */}
              <div className="mb-5">
                <span className="text-white/50 text-xs uppercase tracking-wider">You're Selling</span>
                <div className="flex items-center gap-3 mt-2">
                  {sellToken && <TokenLogo ticker={sellToken.ticker} className="w-10 h-10" />}
                  <div>
                    <div className="text-2xl font-bold text-white">
                      {sellToken && formatBalanceDisplay(removeCommas(sellAmount))}
                    </div>
                    <div className="text-white/60 text-sm">{sellToken && formatTokenTicker(sellToken.ticker, chainId)}</div>
                  </div>
                </div>
              </div>

              {/* Arrow Divider */}
              <div className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px bg-white/10"></div>
                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                  <svg className="w-4 h-4 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                </div>
                <div className="flex-1 h-px bg-white/10"></div>
              </div>

              {/* You're Receiving */}
              <div>
                <span className="text-white/50 text-xs uppercase tracking-wider">
                  You'll Receive{buyTokens.filter((t, idx) => t && buyAmounts[idx] && buyAmounts[idx].trim() !== '').length > 1 ? ' (One of)' : ''}
                </span>
                <div className="space-y-3 mt-2">
                  {buyTokens.map((token, index) => {
                    const amount = buyAmounts[index];
                    if (!token || !amount || amount.trim() === '') return null;
                    const amountAfterFee = parseFloat(removeCommas(amount)) * 0.998;

                    // Calculate percentage from market for this token
                    let pctFromMarket: number | null = null;
                    if (sellToken) {
                      const sellUsd = getPrice(sellToken.a);
                      const buyUsd = getPrice(token.a);
                      if (sellUsd > 0 && buyUsd > 0) {
                        const sellAmountNum = parseFloat(removeCommas(sellAmount)) || 0;
                        const buyAmountNum = parseFloat(removeCommas(amount)) || 0;
                        if (sellAmountNum > 0 && buyAmountNum > 0) {
                          const sellValueUsd = sellAmountNum * sellUsd;
                          const buyValueUsd = buyAmountNum * buyUsd;
                          // Positive = asking more than market (good for seller)
                          // Negative = asking less than market (bad for seller, discount)
                          pctFromMarket = ((buyValueUsd - sellValueUsd) / sellValueUsd) * 100;
                        }
                      }
                    }

                    return (
                      <div key={`confirm-receive-${index}`} className="flex items-center gap-3">
                        <TokenLogo ticker={token.ticker} className="w-10 h-10" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-2xl font-bold text-white">
                              {formatBalanceDisplay(amountAfterFee.toFixed(6))}
                            </span>
                            {pctFromMarket !== null && pctFromMarket < 0 && (
                              <span className="text-xs px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 rounded border border-yellow-500/30 select-none flex items-center gap-1">
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                                Caution
                              </span>
                            )}
                          </div>
                          <div className="text-white/60 text-sm">{formatTokenTicker(token.ticker, chainId)}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </LiquidGlassCard>

            {/* Fee Breakdown */}
            <LiquidGlassCard
              className="p-4 bg-white/5 border-white/10"
              borderRadius="12px"
              shadowIntensity="xs"
              glowIntensity="none"
            >
              <div className="space-y-3 text-sm">
                {/* Listing Fee */}
                <div className="flex justify-between items-center">
                  <span className="text-white/60">Listing Fee</span>
                  <span className="text-white">
                    {parseFloat(formatEther(listingFee)).toString()} {formatTokenTicker('PLS', chainId)}
                  </span>
                </div>

                {/* Platform Fee */}
                <div className="flex justify-between items-center">
                  <span className="text-white/60">Platform Fee (0.2%)</span>
                  <span className="text-white/60 text-xs">Deducted from received amount</span>
                </div>

                {/* Expiration */}
                <div className="flex justify-between items-center border-t border-white/10 pt-3">
                  <span className="text-white/60">Expires In</span>
                  <span className="text-white">
                    {expirationDays < 1
                      ? `${Math.round(expirationDays * 24)} hours`
                      : expirationDays === 1
                        ? '1 day'
                        : `${Math.round(expirationDays)} days`}
                  </span>
                </div>

                {/* All or Nothing */}
                {allOrNothing && (
                  <div className="flex justify-between items-center border-t border-white/10 pt-3">
                    <span className="text-white/60">Order Type</span>
                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-purple-500/20 text-purple-400 border border-purple-500/30">
                      All or Nothing
                    </span>
                  </div>
                )}

                {/* Total You Pay */}
                {sellToken && isNativeToken(sellToken.a) && (
                  <div className="flex justify-between items-center border-t border-white/10 pt-3">
                    <span className="text-white font-medium">Total You Pay</span>
                    <span className="text-white font-bold">
                      {(parseFloat(removeCommas(sellAmount)) + parseFloat(formatEther(listingFee))).toLocaleString('en-US', {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 8
                      })} {formatTokenTicker(sellToken.ticker, chainId)}
                    </span>
                  </div>
                )}
              </div>
            </LiquidGlassCard>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmation(false)}
                disabled={isCreatingOrder || isApproving}
                className="flex-1 py-4 bg-transparent text-white border border-white/30 font-bold hover:bg-white/10 text-lg tracking-wider disabled:opacity-50 disabled:cursor-not-allowed rounded-full transition-all"
              >
                BACK
              </button>
              <button
                onClick={handleCreateOrder}
                disabled={isCreatingOrder || isApproving}
                className="flex-1 py-4 bg-white text-black border border-white font-bold hover:bg-white/80 text-lg tracking-wider disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 rounded-full transition-all"
              >
                {isApproving && <PixelSpinner size={20} />}
                {isCreatingOrder && !isApproving && <PixelSpinner size={20} />}
                {isApproving ? 'APPROVING...' : isCreatingOrder ? 'SUBMITTING...' : 'CONFIRM ORDER'}
              </button>
            </div>
          </div>
        ) : (
          /* Step 1: Order Form */
          <>
        {/* Sell Section */}
        <LiquidGlassCard
          className="mb-4 p-4 bg-white/5 border-white/10 overflow-visible relative z-30"
          borderRadius="12px"
          shadowIntensity="xs"
          glowIntensity="none"
        >
          <label className="text-white/80 text-sm mb-2 flex items-center gap-2 font-semibold text-left">
            SELL
            {sellToken && customToken && sellToken.a.toLowerCase() === customToken.a.toLowerCase() && (
              <span className="text-xs px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 rounded border border-yellow-500/30">Custom</span>
            )}
          </label>

          {/* Token Selector and Amount Input Row */}
          <div className="relative flex items-stretch gap-2" ref={sellDropdownRef}>
            <button
              onClick={() => {
                // Close all buy dropdowns when opening sell dropdown
                if (!showSellDropdown) {
                  setShowBuyDropdowns(showBuyDropdowns.map(() => false));
                }
                setShowSellDropdown(!showSellDropdown);
              }}
              className="min-w-[120px] shrink-0 bg-black/40 border border-white/10 p-3 flex items-center justify-between hover:bg-white/5 transition-all shadow-sm rounded-lg"
            >
              <div className="flex items-center space-x-2">
                {sellToken ? (
                  <>
                    <TokenLogo ticker={sellToken.ticker} className="w-6 h-6" />
                    <span className="text-white font-medium">{formatTokenTicker(sellToken.ticker, chainId)}</span>
                  </>
                ) : (
                  <span className="text-white/50">Select</span>
                )}
              </div>
              <svg className="w-4 h-4 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Amount Input - inline */}
            <div className="flex-1 min-w-0">
              <input
                ref={sellInputRef}
                type="text"
                value={sellAmount}
                onChange={handleSellAmountChange}
                onKeyDown={handleSellKeyDown}
                onFocus={() => setIsSellInputFocused(true)}
                onBlur={() => {
                  setIsSellInputFocused(false);
                  activeInputRef.current = null;
                }}
                placeholder="0.00"
                className="w-full h-full bg-black/40 border border-white/10 p-3 text-white text-base placeholder-white/30 focus:outline-none rounded-lg"
              />
            </div>

            {/* 3-dot menu for sell token - hide for native PLS */}
            {sellToken && sellToken.a.toLowerCase() !== '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' && (
              <div className="relative self-stretch" ref={sellTokenMenuRef}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowSellTokenMenu(!showSellTokenMenu);
                  }}
                  className="h-full px-2 bg-black/40 border border-white/10 hover:bg-white/5 transition-all rounded-lg flex items-center justify-center"
                  title="Token options"
                >
                  <svg className="w-4 h-4 text-white/50" fill="currentColor" viewBox="0 0 24 24">
                    <circle cx="12" cy="6" r="2" />
                    <circle cx="12" cy="12" r="2" />
                    <circle cx="12" cy="18" r="2" />
                  </svg>
                </button>

                {showSellTokenMenu && (
                  <div className="absolute top-full right-0 mt-1 bg-black/95 border border-white/10 z-50 shadow-xl backdrop-blur-md rounded-lg overflow-hidden min-w-[180px]">
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(sellToken.a);
                        toast({ title: "Address copied", description: sellToken.a.slice(0, 10) + '...' + sellToken.a.slice(-8) });
                        setShowSellTokenMenu(false);
                      }}
                      className="w-full px-4 py-3 flex items-center gap-3 hover:bg-white/10 transition-colors text-left"
                    >
                      <svg className="w-4 h-4 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" strokeWidth={2} />
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" strokeWidth={2} />
                      </svg>
                      <span className="text-white text-sm">Copy Address</span>
                    </button>
                    <button
                      onClick={() => {
                        window.open(`https://midgard.wtf/address/${sellToken.a}`, '_blank');
                        setShowSellTokenMenu(false);
                      }}
                      className="w-full px-4 py-3 flex items-center gap-3 hover:bg-white/10 transition-colors text-left"
                    >
                      <svg className="w-4 h-4 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                      <span className="text-white text-sm">View on Explorer</span>
                    </button>
                    <button
                      onClick={() => {
                        window.open(`https://dexscreener.com/pulsechain/${sellToken.a}`, '_blank');
                        setShowSellTokenMenu(false);
                      }}
                      className="w-full px-4 py-3 flex items-center gap-3 hover:bg-white/10 transition-colors text-left"
                    >
                      <svg className="w-4 h-4 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                      <span className="text-white text-sm">View on DexScreener</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Dropdown */}
            {showSellDropdown && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-black/90 border border-white/10 z-10 shadow-xl backdrop-blur-md rounded-lg overflow-hidden">
                <div className="sticky top-0 p-2 bg-black/50 border-b border-white/10">
                  <input
                    ref={sellSearchRef}
                    type="text"
                    value={sellSearchQuery}
                    onChange={(e) => setSellSearchQuery(e.target.value)}
                    placeholder={`Search or paste address... (${filteredSellTokens.length})`}
                    className="w-full bg-transparent border border-white/10 p-2 text-white text-sm placeholder-white/30 focus:outline-none rounded"
                  />
                </div>
                <div className="max-h-60 overflow-y-auto modern-scrollbar">
                  {/* Loading state for custom token lookup */}
                  {isLoadingCustomToken && (
                    <div className="p-4 flex items-center justify-center space-x-2">
                      <PixelSpinner size={16} color="#00D9FF" />
                      <span className="text-white/50 text-sm">Looking up token...</span>
                    </div>
                  )}

                  {/* Error state for custom token lookup */}
                  {customTokenError && !isLoadingCustomToken && (
                    <div className="p-4 text-center text-red-400 text-sm">{customTokenError}</div>
                  )}

                  {/* Custom token from contract address */}
                  {customToken && !isLoadingCustomToken && (
                    <button
                      onClick={() => {
                        // Validate custom token is not already selected as a buy token
                        const isAlreadyBuyToken = buyTokens.some(bt =>
                          bt && bt.a && customToken.a.toLowerCase() === bt.a.toLowerCase()
                        );
                        if (isAlreadyBuyToken) {
                          toast({ title: "Token already selected", description: "This token is already selected as a buy token", variant: "destructive" });
                          return;
                        }
                        handleSellTokenSelect(customToken);
                        // Save full custom token object for restoration after reload
                        localStorage.setItem('limitOrderCustomSellToken', JSON.stringify(customToken));
                        setCustomToken(null);
                      }}
                      className="w-full p-3 flex items-center space-x-3 hover:bg-white/5 transition-all text-left border-b border-white/5 bg-cyan-900/20"
                    >
                      <img src="/coin-logos/default.svg" alt="Token" className="w-6 h-6" />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-white font-medium">{customToken.ticker}</div>
                            <div className="text-white/50 text-xs">{customToken.name}</div>
                          </div>
                          <span className="text-xs px-2 py-0.5 bg-cyan-900/30 border border-cyan-500/30 text-cyan-400 rounded ml-2">
                            Custom
                          </span>
                        </div>
                      </div>
                    </button>
                  )}

                  {/* Regular token list */}
                  {filteredSellTokens.length === 0 && !customToken && !isLoadingCustomToken && !customTokenError ? (
                    <div className="p-4 text-center text-white/50 text-sm">No tokens found</div>
                  ) : (
                    filteredSellTokens.map((token) => {
                      const tokenBalance = parseFloat(dropdownTokenBalances[token.a?.toLowerCase() || ''] || '0');
                      const tokenPrice = getPrice(token.a);
                      const tokenUsdValue = tokenBalance * (tokenPrice > 0 ? tokenPrice : 0);
                      return (
                        <button
                          key={token.a}
                          onClick={() => {
                            if (token.a) {
                              handleSellTokenSelect({ a: token.a, ticker: token.ticker, name: token.name, decimals: token.decimals });
                            }
                          }}
                          className="w-full p-3 flex items-center space-x-3 hover:bg-white/5 transition-all text-left border-b border-white/5 last:border-b-0"
                        >
                          <TokenLogo ticker={token.ticker} className="w-6 h-6" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <div className="min-w-0 flex-1">
                                <div className="text-white font-medium">{formatTokenTicker(token.ticker, chainId)}</div>
                                <div className="text-white/50 text-xs truncate">{token.name}</div>
                              </div>
                              <div className="text-right ml-2 flex-shrink-0">
                                {tokenBalance > 0 && (
                                  <>
                                    <div className="text-white text-sm">{tokenBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                                    <div className="text-white/50 text-xs">
                                      ${tokenUsdValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-stretch gap-2 mt-2">
            {/* Placeholder to align with token selector */}
            <div className="min-w-[120px] shrink-0 text-white/50 text-sm font-semibold flex items-center">
              {pricesLoading && sellTokenPrice === 0 && sellAmountNum > 0 ? (
                <div className="flex items-center gap-1.5 animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-white/30" />
                  <span>Loading price...</span>
                </div>
              ) : sellUsdValue > 0 ? (
                `$${formatNumberWithCommas(sellUsdValue.toFixed(2))}`
              ) : '$0.00'}
            </div>
            {/* Balance aligned with input */}
            <div className="flex-1 flex items-center gap-2">
              {sellToken && isConnected && (
                <>
                  <span className="text-white/50 text-xs">
                    {isBalanceLoading ? (
                      'Loading balance...'
                    ) : actualBalance ? (
                      `Balance: ${formatBalanceDisplay(actualBalance.formatted)}`
                    ) : (
                      'Balance: 0'
                    )}
                  </span>
                  {actualBalance && !isBalanceLoading && (
                    <button
                      type="button"
                      onClick={handleMaxSellAmount}
                      className="text-white hover:text-white text-xs font-bold transition-colors"
                    >
                      MAX
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Swap Button Divider */}
          <div className="flex items-center gap-4 my-4">
            <div className="flex-1 h-px bg-white/10"></div>
            <button
              onClick={handleSwapTokens}
              disabled={buyTokens.length > 1}
              className={`p-2 rounded-full transition-all bg-black/40 border border-white/10 ${buyTokens.length > 1
                ? 'cursor-not-allowed opacity-30'
                : 'hover:border-white/30 hover:bg-white/5 cursor-pointer'
                }`}
              title={buyTokens.length > 1 ? "Cannot swap with multiple tokens" : "Swap tokens and amounts"}
            >
              <ArrowLeftRight className={`w-4 h-4 text-white/60 rotate-90 ${buyTokens.length > 1
                ? ''
                : 'group-hover:text-white'
                } transition-colors`} />
            </button>
            <div className="flex-1 h-px bg-white/10"></div>
          </div>

          {/* Buy Section - Multiple Tokens */}
          <div className="flex items-center justify-between mb-2">
            <label className="text-white/80 text-sm font-semibold text-left">BUY</label>

            <div className="flex items-center gap-2">
              {/* All or Nothing Toggle Button */}
              <button
                type="button"
                onClick={() => setAllOrNothing(!allOrNothing)}
                className={`flex items-center gap-1.5 px-2 py-1 text-xs rounded-full transition-all ${
                  allOrNothing
                    ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                    : 'bg-white/5 text-white/60 border border-white/10 hover:bg-white/10'
                }`}
                title={allOrNothing ? 'All or Nothing: Order must be filled completely' : 'Partial fills allowed'}
              >
                <span>AON: {allOrNothing ? 'On' : 'Off'}</span>
              </button>

              {/* Bind Prices Toggle - Only show when there are multiple buy tokens or basket selected */}
              {(buyTokens.length > 1 || selectedBasket) && (
              <button
                type="button"
                onClick={() => {
                  const newBound = !pricesBound;

                  // When trying to link prices, validate requirements
                  if (newBound) {
                    // Remove any undefined/empty token slots before linking
                    const hasMissingToken = buyTokens.some((token) => !token);

                    if (hasMissingToken) {
                      // Filter out undefined tokens and their amounts
                      const validTokens = buyTokens.filter((token) => token !== null && token !== undefined);
                      const validAmounts = buyAmounts.filter((_, i) => buyTokens[i] !== null && buyTokens[i] !== undefined);

                      // If no valid tokens remain, can't link
                      if (validTokens.length === 0) {
                        toast({
                          title: 'Cannot link prices',
                          description: 'Select at least one token first',
                          variant: 'destructive',
                        });
                        return;
                      }

                      // Update state with only valid tokens
                      setBuyTokens(validTokens as TokenInfo[]);
                      setBuyAmounts(validAmounts);
                      setShowBuyDropdowns(validTokens.map(() => false));
                    }

                    // Need limit price to calculate amounts
                    if (!limitPrice || parseFloat(limitPrice) <= 0) {
                      toast({
                        title: 'Cannot link prices',
                        description: 'Set a limit price first before linking',
                        variant: 'destructive',
                      });
                      return;
                    }

                    // Need sell amount to calculate buy amounts
                    if (sellAmountNum <= 0) {
                      toast({
                        title: 'Cannot link prices',
                        description: 'Set a sell amount first before linking',
                        variant: 'destructive',
                      });
                      return;
                    }
                  }

                  setPricesBound(newBound);

                  // When unlinking, preserve the same % from market for each token
                  if (!newBound && limitPrice) {
                    const storedPrice = parseFloat(limitPrice);
                    if (storedPrice > 0) {
                      const sellTokenUsdPrice = sellToken ? getPrice(sellToken.a) : 0;
                      const firstBuyTokenUsdPrice = buyTokens[0] ? getPrice(buyTokens[0].a) : 0;

                      // Market price is always "buyTokens per sellToken" (non-inverted form)
                      const firstTokenMarketPrice = sellTokenUsdPrice > 0 && firstBuyTokenUsdPrice > 0
                        ? sellTokenUsdPrice / firstBuyTokenUsdPrice
                        : 0;

                      // limitPrice is always stored in buy/sell format (buy tokens per sell token)
                      // regardless of invertPriceDisplay setting
                      const mainPriceNonInverted = storedPrice;

                      const percentFromMarket = firstTokenMarketPrice > 0
                        ? (mainPriceNonInverted - firstTokenMarketPrice) / firstTokenMarketPrice
                        : 0;

                      setIndividualLimitPrices(buyTokens.map((token) => {
                        if (!token) return storedPrice;
                        const thisTokenUsdPrice = getPrice(token.a);
                        // Calculate this token's market price and apply the same % offset
                        if (sellTokenUsdPrice > 0 && thisTokenUsdPrice > 0) {
                          const thisTokenMarketPrice = sellTokenUsdPrice / thisTokenUsdPrice;
                          const newPriceNonInverted = thisTokenMarketPrice * (1 + percentFromMarket);
                          // Store in buy/sell format (same as main limitPrice)
                          return newPriceNonInverted;
                        }
                        return storedPrice;
                      }));
                    }
                  }

                  // When re-linking, recalculate all buy amounts based on the main limit price
                  if (newBound && limitPrice) {
                    const storedPrice = parseFloat(limitPrice);
                    if (storedPrice > 0 && sellAmountNum > 0) {
                      const sellTokenUsdPrice = sellToken ? getPrice(sellToken.a) : 0;
                      const firstBuyTokenUsdPrice = buyTokens[0] ? getPrice(buyTokens[0].a) : 0;
                      const marketPriceForFirst = sellTokenUsdPrice > 0 && firstBuyTokenUsdPrice > 0
                        ? sellTokenUsdPrice / firstBuyTokenUsdPrice
                        : 0;
                      const premiumMultiplier = marketPriceForFirst > 0 ? storedPrice / marketPriceForFirst : 1;

                      const newAmounts = buyTokens.map((token, i) => {
                        if (i === 0) {
                          // First token uses limit price directly
                          return formatCalculatedValue(sellAmountNum * storedPrice);
                        }
                        if (!token) return buyAmounts[i] || '';
                        const tokenUsdPrice = getPrice(token.a);
                        if (sellTokenUsdPrice > 0 && tokenUsdPrice > 0) {
                          const marketPriceForThis = sellTokenUsdPrice / tokenUsdPrice;
                          const adjustedPrice = marketPriceForThis * premiumMultiplier;
                          return formatCalculatedValue(sellAmountNum * adjustedPrice);
                        }
                        return buyAmounts[i] || '';
                      });
                      setBuyAmounts(newAmounts);

                      // Reset individual limit prices to match the primary token's price ratio
                      // This ensures alt tokens don't remember old unlinked prices
                      setIndividualLimitPrices(buyTokens.map((token, i) => {
                        if (i === 0 || !token) return storedPrice;
                        const tokenUsdPrice = getPrice(token.a);
                        if (sellTokenUsdPrice > 0 && tokenUsdPrice > 0) {
                          const marketPriceForThis = sellTokenUsdPrice / tokenUsdPrice;
                          return marketPriceForThis * premiumMultiplier;
                        }
                        return storedPrice;
                      }));
                    }

                    // Also check if all buyTokens belong to a common basket and restore it
                    if (buyTokens.length > 1 && !selectedBasket) {
                      // Find which basket (if any) all current tokens belong to
                      const buyTokenAddresses = buyTokens.filter(t => t).map(t => t!.a.toLowerCase());
                      for (const basket of TOKEN_BASKETS) {
                        const basketTokenAddresses = getBasketTokens(basket.id)
                          .map(t => t.a.toLowerCase());
                        // Check if all buyTokens are in this basket
                        const allInBasket = buyTokenAddresses.every(addr => basketTokenAddresses.includes(addr));
                        // Check if basket contains all buyTokens (they selected the full basket)
                        const isFullBasket = allInBasket && buyTokenAddresses.length === basketTokenAddresses.length;
                        if (isFullBasket) {
                          setSelectedBasket(basket.id);
                          break;
                        }
                      }
                    }
                  }
                }}
                className={`flex items-center gap-1.5 px-2 py-1 text-xs rounded-full transition-all ${
                  pricesBound
                    ? 'bg-[#FF0080]/20 text-[#FF0080] border border-[#FF0080]/30'
                    : 'bg-white/5 text-white/60 border border-white/10 hover:bg-white/10'
                }`}
                title={pricesBound ? 'Prices linked: same % from market for all tokens' : 'Prices unlinked: set individual prices'}
              >
                {pricesBound ? (
                  <Link className="w-3.5 h-3.5" />
                ) : (
                  <Unlink className="w-3.5 h-3.5" />
                )}
                <span>{pricesBound ? 'Linked Price' : 'Unlinked Price'}</span>
              </button>
              )}
            </div>
          </div>

          <div className="space-y-4">
            {/* Unified Basket View - when basket selected and prices linked */}
            {selectedBasket && pricesBound ? (
              <div>
                {/* Basket Token Selector and Amount Input Row */}
                <div className="relative" ref={el => { buyDropdownRefs.current[0] = el; }}>
                  <div className="flex items-stretch gap-2">
                    <button
                      onClick={() => {
                        // Close sell dropdown and other buy dropdowns when opening this one
                        const isOpening = !showBuyDropdowns[0];
                        if (isOpening) {
                          setShowSellDropdown(false);
                        }
                        const newDropdowns = showBuyDropdowns.map((_, i) => i === 0 ? !showBuyDropdowns[0] : false);
                        setShowBuyDropdowns(newDropdowns);
                      }}
                      className="min-w-[120px] shrink-0 bg-black/40 border border-white/10 p-3 flex items-center justify-between hover:bg-white/5 transition-all shadow-sm rounded-lg"
                    >
                      <div className="flex items-center space-x-2">
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#FF0080]/30 to-[#00BFFF]/30 flex items-center justify-center">
                          <svg className="w-3.5 h-3.5 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                          </svg>
                        </div>
                        <span className="text-white font-medium text-sm">{TOKEN_BASKETS.find(b => b.id === selectedBasket)?.name || 'Basket'}</span>
                      </div>
                      <svg className="w-4 h-4 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {/* Amount Input - uses first buy amount */}
                    <div className="flex-1 min-w-0 relative">
                      <input
                        ref={el => { buyInputRefs.current[0] = el; }}
                        type="text"
                        value={buyAmounts[0] || ''}
                        onChange={(e) => handleBuyAmountChange(e, 0)}
                        onKeyDown={(e) => handleBuyKeyDown(e, 0)}
                        onFocus={() => {
                          const newFocused = [...isBuyInputFocused];
                          newFocused[0] = true;
                          setIsBuyInputFocused(newFocused);
                        }}
                        onBlur={() => {
                          const newFocused = [...isBuyInputFocused];
                          newFocused[0] = false;
                          setIsBuyInputFocused(newFocused);
                          activeInputRef.current = null;
                        }}
                        placeholder="0.00"
                        className="w-full h-full bg-black/40 border border-white/10 p-3 pr-16 text-white text-base placeholder-white/30 focus:outline-none rounded-lg"
                      />
                      {buyTokens[0] && (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 text-sm font-medium">
                          {formatTokenTicker(buyTokens[0].ticker, chainId)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Basket Dropdown */}
                  {showBuyDropdowns[0] && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-black/90 border border-white/10 z-10 shadow-xl backdrop-blur-md rounded-lg overflow-hidden">
                      <div className="sticky top-0 p-2 bg-black/50 border-b border-white/10">
                        <input
                          ref={el => { buySearchRefs.current[0] = el; }}
                          type="text"
                          value={buySearchQueries[0] || ''}
                          onChange={(e) => {
                            const newQueries = [...buySearchQueries];
                            newQueries[0] = e.target.value;
                            setBuySearchQueries(newQueries);
                          }}
                          placeholder="Search baskets or tokens..."
                          className="w-full bg-transparent border border-white/10 p-2 text-white text-sm placeholder-white/30 focus:outline-none rounded"
                        />
                      </div>
                      <div className="max-h-60 overflow-y-auto modern-scrollbar">
                        {/* Token Baskets */}
                        {!(buySearchQueries[0] || '').trim() && getAvailableBaskets(0).filter(b => b.id !== selectedBasket).length > 0 && (
                          <>
                            <div className="px-3 py-2 text-xs text-white/40 uppercase tracking-wider bg-black/30 border-b border-white/10">
                              Token Baskets
                            </div>
                            {getAvailableBaskets(0).filter(b => b.id !== selectedBasket).map((basket) => {
                              const basketTokens = getBasketTokens(basket.id);
                              return (
                                <button
                                  key={basket.id}
                                  onClick={() => handleBasketSelect(basket, 0)}
                                  className="w-full p-3 flex items-center space-x-3 hover:bg-white/5 transition-all text-left border-b border-white/5"
                                >
                                  <div className="flex items-center -space-x-1.5">
                                    {basketTokens.slice(0, 5).map((token, idx) => (
                                      <div
                                        key={token.a}
                                        className="w-6 h-6 rounded-full bg-black ring-2 ring-black flex items-center justify-center"
                                        style={{ zIndex: 5 - idx }}
                                      >
                                        <TokenLogo
                                          ticker={token.ticker}
                                          className="w-5 h-5 rounded-full"
                                        />
                                      </div>
                                    ))}
                                    {basketTokens.length > 5 && (
                                      <div className="w-6 h-6 rounded-full bg-black ring-2 ring-black flex items-center justify-center text-[10px] text-white/60">
                                        +{basketTokens.length - 5}
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="text-white font-medium">{basket.name}</div>
                                    <div className="text-white/50 text-xs truncate">{basket.description}</div>
                                  </div>
                                </button>
                              );
                            })}
                            <div className="px-3 py-2 text-xs text-white/40 uppercase tracking-wider bg-black/30 border-b border-white/10">
                              Individual Tokens
                            </div>
                          </>
                        )}
                        {getFilteredBuyTokens(0).length === 0 ? (
                          <div className="p-4 text-center text-white/50 text-sm">No tokens found</div>
                        ) : (
                          getFilteredBuyTokens(0).map((token) => {
                            const tokenBalance = parseFloat(dropdownTokenBalances[token.a?.toLowerCase() || ''] || '0');
                            const tokenPrice = getPrice(token.a);
                            const tokenUsdValue = tokenBalance * (tokenPrice > 0 ? tokenPrice : 0);
                            return (
                              <button
                                key={token.a}
                                onClick={() => {
                                  handleBuyTokenSelect(token, 0);
                                  // Clear basket and set single token
                                  setSelectedBasket(null);
                                  setBuyTokens([{
                                    a: token.a!,
                                    ticker: token.ticker,
                                    name: token.name,
                                    decimals: token.decimals
                                  }]);
                                }}
                                className="w-full p-3 flex items-center space-x-3 hover:bg-white/5 transition-all text-left border-b border-white/5 last:border-b-0"
                              >
                                <TokenLogo ticker={token.ticker} className="w-6 h-6" />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between">
                                    <div className="min-w-0 flex-1">
                                      <div className="text-white font-medium">{formatTokenTicker(token.ticker, chainId)}</div>
                                      <div className="text-white/50 text-xs truncate">{token.name}</div>
                                    </div>
                                    <div className="text-right ml-2 flex-shrink-0">
                                      {tokenBalance > 0 && (
                                        <>
                                          <div className="text-white text-sm">{tokenBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                                          <div className="text-white/50 text-xs">
                                            ${tokenUsdValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                          </div>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Buy Token USD Value for Basket - show minimum (conservative) since it's "one of" */}
                <div className="flex items-center gap-2 mt-2">
                  <div className="w-[140px] shrink-0 text-white/50 text-sm font-semibold">
                    {(() => {
                      // Find the minimum USD value across all basket tokens (conservative estimate)
                      // Since the order accepts "one of" these tokens, we show the lowest value
                      const usdValues: number[] = [];
                      let hasAnyPrice = false;
                      let hasAnyAmount = false;

                      buyTokens.forEach((token, idx) => {
                        if (token) {
                          const buyAmtNum = buyAmounts[idx] ? parseFloat(removeCommas(buyAmounts[idx])) : 0;
                          if (buyAmtNum > 0) hasAnyAmount = true;
                          const tokenPrice = getPrice(token.a);
                          if (tokenPrice > 0) {
                            hasAnyPrice = true;
                            usdValues.push(buyAmtNum * tokenPrice);
                          }
                        }
                      });

                      if (pricesLoading && !hasAnyPrice && hasAnyAmount) {
                        return (
                          <div className="flex items-center gap-1.5 animate-pulse">
                            <span className="w-1.5 h-1.5 rounded-full bg-white/30" />
                            <span>Loading price...</span>
                          </div>
                        );
                      }
                      const minUsdValue = usdValues.length > 0 ? Math.min(...usdValues) : 0;
                      return minUsdValue > 0 ? `$${formatNumberWithCommas(minUsdValue.toFixed(2))}` : '$0.00';
                    })()}
                  </div>
                </div>

                {/* Basket Tokens Preview - show which tokens are in the basket */}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {buyTokens.map((token, index) => token && (
                    <div
                      key={token.a}
                      className="group relative flex items-center gap-1 px-2 py-1 bg-white/5 hover:bg-white/10 rounded-full border border-white/10 hover:border-white/20 whitespace-nowrap transition-colors cursor-pointer"
                      onClick={() => {
                        if (buyTokens.length > 1) {
                          // Remove this token from the basket
                          const newBuyTokens = buyTokens.filter((_, i) => i !== index);
                          const newBuyAmounts = buyAmounts.filter((_, i) => i !== index);
                          setBuyTokens(newBuyTokens);
                          setBuyAmounts(newBuyAmounts);
                        }
                      }}
                      title={buyTokens.length > 1 ? `Click to remove ${formatTokenTicker(token.ticker, chainId)}` : 'Cannot remove last token'}
                    >
                      <TokenLogo ticker={token.ticker} className="w-4 h-4 flex-shrink-0" />
                      <span className="text-white/70 text-xs group-hover:text-white/90 transition-colors">
                        {buyAmounts[index] && parseFloat(removeCommas(buyAmounts[index])) > 0
                          ? `${formatAmountForLabel(parseFloat(removeCommas(buyAmounts[index])))} `
                          : ''}
                        {formatTokenTicker(token.ticker, chainId)}
                      </span>
                      {buyTokens.length > 1 && (
                        <span className="ml-0.5 opacity-0 group-hover:opacity-100 transition-opacity text-white/50 hover:text-white">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </span>
                      )}
                    </div>
                  ))}
                </div>

                {/* Limit Price Section for Basket */}
                {buyTokens[0] && (
                  <div className="mt-4">
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center gap-2">
                        {showUsdPrices ? (
                          <label className="text-[#FF0080]/90 text-sm font-semibold">
                            Limit Price: ($)
                          </label>
                        ) : invertPriceDisplay && buyTokens.length > 1 ? (
                          <button
                            type="button"
                            onClick={() => {
                              const nextIndex = (displayedPriceTokenIndex + 1) % buyTokens.length;
                              setDisplayedPriceTokenIndex(nextIndex);
                            }}
                            className="text-[#FF0080]/90 text-sm font-semibold hover:text-[#FF0080] transition-colors flex items-center gap-1"
                            title="Click to cycle through tokens"
                          >
                            Limit Price: ({formatTokenTicker(buyTokens[displayedPriceTokenIndex % buyTokens.length]?.ticker || buyTokens[0].ticker, chainId)})
                            <span className="text-xs text-[#FF0080]/50">({(displayedPriceTokenIndex % buyTokens.length) + 1}/{buyTokens.length})</span>
                          </button>
                        ) : (
                          <label className="text-[#FF0080]/90 text-sm font-semibold">
                            Limit Price: ({invertPriceDisplay
                              ? formatTokenTicker(buyTokens[displayedPriceTokenIndex % buyTokens.length]?.ticker || buyTokens[0].ticker, chainId)
                              : formatTokenTicker(sellToken?.ticker || '', chainId)})
                          </label>
                        )}
                        {sellToken && (
                          <button
                            type="button"
                            onClick={() => {
                              const newInverted = !invertPriceDisplay;
                              setInvertPriceDisplay(newInverted);
                              onInvertPriceDisplayChange?.(newInverted);
                            }}
                            className="p-1 text-[#FF0080] hover:text-white transition-colors"
                            title={`Show price in ${invertPriceDisplay ? formatTokenTicker(sellToken.ticker, chainId) : formatTokenTicker(buyTokens[0].ticker, chainId)}`}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                            </svg>
                          </button>
                        )}
                      </div>
                      {/* Percentage indicator */}
                      {(() => {
                        if (!sellToken || !buyTokens[0]) return null;
                        const sellUsd = getPrice(sellToken.a);
                        const buyUsd = getPrice(buyTokens[0].a);
                        if (sellUsd <= 0 || buyUsd <= 0) return null;
                        const marketPrice = sellUsd / buyUsd;
                        const currentLimitPrice = parseFloat(limitPrice) || 0;
                        if (marketPrice <= 0 || currentLimitPrice <= 0) return null;
                        const pctDiff = ((currentLimitPrice / marketPrice) - 1) * 100;
                        const isPositive = pctDiff >= 0;
                        return (
                          <span className={`text-sm font-semibold select-none ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                            {isPositive ? '+' : ''}{pctDiff.toFixed(1)}%
                          </span>
                        );
                      })()}
                    </div>
                    <div className="relative">
                      <input
                        ref={limitPriceInputRef}
                        type="text"
                        inputMode="decimal"
                        className="w-full bg-black/40 border border-[#FF0080]/30 p-3 text-[#FF0080] text-lg min-h-[52px] rounded-lg focus:outline-none focus:border-[#FF0080]/60 transition-colors"
                        placeholder="0.00000000"
                        value={isLimitPriceInputFocused ? limitPriceInputValue : (() => {
                          if (!limitPrice || parseFloat(limitPrice) <= 0) return '';
                          const basePrice = parseFloat(limitPrice);

                          // When showing USD, always use the base token (index 0) since USD is universal
                          // When showing token units, use the displayed token index
                          const tokenIndex = showUsdPrices ? 0 : (displayedPriceTokenIndex % buyTokens.length);
                          let displayPrice = basePrice;

                          // When showing a different token's price (not in USD mode), use external individual prices as source of truth
                          if (!showUsdPrices && tokenIndex > 0 && buyTokens[tokenIndex]) {
                            // Use external individual limit price from chart if available
                            const externalPrice = externalIndividualLimitPrices?.[tokenIndex];
                            if (externalPrice !== undefined && externalPrice > 0) {
                              displayPrice = externalPrice;
                            } else {
                              // Fallback: use internal individual limit price
                              const internalPrice = individualLimitPrices[tokenIndex];
                              if (internalPrice !== undefined && internalPrice > 0) {
                                displayPrice = internalPrice;
                              }
                            }
                          }

                          // Calculate final display value
                          let finalDisplayPrice = displayPrice;
                          if (invertPriceDisplay && displayPrice > 0) {
                            finalDisplayPrice = 1 / displayPrice;
                          }

                          // If showing USD prices, convert to USD
                          if (showUsdPrices && finalDisplayPrice > 0) {
                            // Get USD price of the unit token (what the price is denominated in)
                            // Always use sell token when inverted, first buy token otherwise
                            const unitToken = invertPriceDisplay ? sellToken : buyTokens[0];
                            const unitTokenUsdPrice = unitToken ? getPrice(unitToken.a) : 0;
                            if (unitTokenUsdPrice > 0) {
                              const usdValue = finalDisplayPrice * unitTokenUsdPrice;
                              return '$' + formatNumberWithCommas(usdValue.toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: usdValue < 0.01 ? 6 : usdValue < 1 ? 4 : 2
                              }));
                            }
                          }

                          return formatNumberWithCommas(formatLimitPriceDisplay(finalDisplayPrice));
                        })()}
                        onChange={(e) => {
                          const input = e.target;
                          const cursorPos = input.selectionStart || 0;
                          const oldValue = input.value;

                          // Remove commas first, then filter to only numbers and decimal
                          const rawValue = removeCommas(e.target.value).replace(/[^0-9.]/g, '');
                          // Format with commas for display
                          const formattedValue = formatNumberWithCommas(rawValue);
                          setLimitPriceInputValue(formattedValue);

                          // Calculate new cursor position
                          const digitsBeforeCursor = removeCommas(oldValue.slice(0, cursorPos)).length;
                          let newCursorPos = 0;
                          let digitCount = 0;
                          for (let i = 0; i < formattedValue.length; i++) {
                            if (digitCount >= digitsBeforeCursor) {
                              newCursorPos = i;
                              break;
                            }
                            if (formattedValue[i] !== ',') {
                              digitCount++;
                            }
                            newCursorPos = i + 1;
                          }

                          requestAnimationFrame(() => {
                            if (limitPriceInputRef.current) {
                              limitPriceInputRef.current.setSelectionRange(newCursorPos, newCursorPos);
                            }
                          });

                          if (rawValue === '' || rawValue === '.') {
                            setLimitPrice('');
                            setPricePercentage(null);
                            setIndividualLimitPrices(prev => {
                              const newPrices = [...prev];
                              newPrices[0] = undefined;
                              return newPrices;
                            });
                            if (onLimitPriceChange) {
                              onLimitPriceChange(undefined);
                            }
                            return;
                          }
                          const displayPrice = parseFloat(rawValue);
                          if (!isNaN(displayPrice) && displayPrice > 0) {
                            const basePrice = invertPriceDisplay ? 1 / displayPrice : displayPrice;
                            setLimitPrice(basePrice.toString());
                            setIndividualLimitPrices(prev => {
                              const newPrices = [...prev];
                              newPrices[0] = basePrice;
                              return newPrices;
                            });
                            if (marketPrice > 0) {
                              // marketPrice is sell/buy format, basePrice is buy/sell format
                              // Convert to same format for comparison
                              const marketPriceBuyPerSell = 1 / marketPrice;
                              const percentageAboveMarket = ((basePrice - marketPriceBuyPerSell) / marketPriceBuyPerSell) * 100;
                              setPricePercentage(Math.abs(percentageAboveMarket) > 0.01 ? percentageAboveMarket : null);
                            }
                            // Recalculate buy amount: buyAmount = sellAmount * limitPrice
                            const sellAmt = sellAmount ? parseFloat(removeCommas(sellAmount)) : 0;
                            if (sellAmt > 0) {
                              const newBuyAmount = sellAmt * basePrice;
                              setBuyAmounts(prev => {
                                const newAmounts = [...prev];
                                newAmounts[0] = formatCalculatedValue(newBuyAmount);
                                return newAmounts;
                              });
                            }
                            if (onLimitPriceChange) {
                              onLimitPriceChange(basePrice);
                            }
                          }
                        }}
                        onFocus={() => {
                          setIsLimitPriceInputFocused(true);
                          if (limitPrice && parseFloat(limitPrice) > 0) {
                            const price = parseFloat(limitPrice);
                            const displayValue = invertPriceDisplay && price > 0
                              ? (1 / price).toFixed(8).replace(/\.?0+$/, '')
                              : price.toFixed(8).replace(/\.?0+$/, '');
                            setLimitPriceInputValue(formatNumberWithCommas(displayValue));
                          } else {
                            setLimitPriceInputValue('');
                          }
                        }}
                        onBlur={() => setIsLimitPriceInputFocused(false)}
                      />
                      {sellToken && !showUsdPrices && (
                        <button
                          type="button"
                          onClick={() => {
                            if (buyTokens.length > 1) {
                              const nextIndex = (displayedPriceTokenIndex + 1) % buyTokens.length;
                              setDisplayedPriceTokenIndex(nextIndex);
                            }
                          }}
                          className={`absolute right-3 top-1/2 -translate-y-1/2 text-[#FF0080]/70 text-sm font-medium flex items-center gap-1 ${buyTokens.length > 1 ? 'cursor-pointer hover:text-[#FF0080] transition-colors' : 'pointer-events-none'}`}
                          title={buyTokens.length > 1 ? 'Click to cycle through tokens' : undefined}
                        >
                          {invertPriceDisplay
                            ? formatTokenTicker(sellToken.ticker, chainId)
                            : formatTokenTicker(buyTokens[displayedPriceTokenIndex % buyTokens.length]?.ticker || buyTokens[0].ticker, chainId)}
                          {buyTokens.length > 1 && !invertPriceDisplay && (
                            <span className="text-xs text-[#FF0080]/50">({(displayedPriceTokenIndex % buyTokens.length) + 1}/{buyTokens.length})</span>
                          )}
                        </button>
                      )}
                    </div>

                    {/* Percentage Buttons for Basket */}
                    {marketPrice > 0 && (
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={() => handlePercentageClick(0, 'above')}
                          className={`flex-1 py-2 border-accent-pink text-xs transition-all font-medium rounded-full ${pricePercentage === null || Math.abs(pricePercentage) < 0.01
                            ? 'bg-[#FF0080]/20 text-white'
                            : 'bg-black/40 text-[#FF0080] hover:bg-[#FF0080]/20 hover:text-white'
                            }`}
                        >
                          Market
                        </button>
                        <button
                          onClick={() => handlePercentageClick(1, invertPriceDisplay ? 'below' : 'above')}
                          className={`flex-1 py-2 border-accent-pink text-xs transition-all font-medium rounded-full ${pricePercentage !== null && Math.abs(Math.abs(pricePercentage) - 1) < 0.1 && (invertPriceDisplay ? pricePercentage < 0 : pricePercentage > 0)
                            ? 'bg-[#FF0080]/20 text-white'
                            : 'bg-black/40 text-[#FF0080] hover:bg-[#FF0080]/20 hover:text-white'
                            }`}
                        >
                          {invertPriceDisplay ? '-1%' : '+1%'} {invertPriceDisplay ? '↓' : '↑'}
                        </button>
                        <button
                          onClick={() => handlePercentageClick(2, invertPriceDisplay ? 'below' : 'above')}
                          className={`flex-1 py-2 border-accent-pink text-xs transition-all font-medium rounded-full ${pricePercentage !== null && Math.abs(Math.abs(pricePercentage) - 2) < 0.1 && (invertPriceDisplay ? pricePercentage < 0 : pricePercentage > 0)
                            ? 'bg-[#FF0080]/20 text-white'
                            : 'bg-black/40 text-[#FF0080] hover:bg-[#FF0080]/20 hover:text-white'
                            }`}
                        >
                          {invertPriceDisplay ? '-2%' : '+2%'} {invertPriceDisplay ? '↓' : '↑'}
                        </button>
                        <button
                          onClick={() => handlePercentageClick(5, invertPriceDisplay ? 'below' : 'above')}
                          className={`flex-1 py-2 border-accent-pink text-xs transition-all font-medium rounded-full ${pricePercentage !== null && Math.abs(Math.abs(pricePercentage) - 5) < 0.1 && (invertPriceDisplay ? pricePercentage < 0 : pricePercentage > 0)
                            ? 'bg-[#FF0080]/20 text-white'
                            : 'bg-black/40 text-[#FF0080] hover:bg-[#FF0080]/20 hover:text-white'
                            }`}
                        >
                          {invertPriceDisplay ? '-5%' : '+5%'} {invertPriceDisplay ? '↓' : '↑'}
                        </button>
                        {(() => {
                          // Check if current percentage is a custom value (not a preset button)
                          const presetValues = [0, 1, 2, 5];
                          const isCustomActive = pricePercentage !== null &&
                            !presetValues.some(p => Math.abs(Math.abs(pricePercentage) - p) < 0.1) &&
                            (invertPriceDisplay ? pricePercentage < 0 : pricePercentage > 0);
                          const isWholeNumber = (n: number) => Math.abs(n - Math.round(n)) < 0.1;
                          // Format: show sign, absolute value, no .0 suffix, includes %
                          const formatPct = (n: number) => {
                            const sign = n < 0 ? '-' : '+';
                            const absVal = isWholeNumber(n) ? String(Math.round(Math.abs(n))) : Math.abs(n).toFixed(1).replace(/\.0$/, '');
                            return sign + absVal + '%';
                          };
                          // Cap display at ±999% to prevent UI overflow
                          const cappedPct = pricePercentage !== null ? Math.max(-999, Math.min(999, pricePercentage)) : 0;
                          const displayValue = isCustomActive ? formatPct(cappedPct) : '';

                          return (
                            <div className="flex-1 relative">
                              <input
                                key={isCustomActive ? `active-${displayValue}` : 'inactive'}
                                type="text"
                                inputMode="decimal"
                                defaultValue={displayValue}
                                maxLength={7}
                                className={`peer w-full py-2 px-2 border text-xs font-medium rounded-full text-center focus:outline-none focus:border-[#FF0080] focus:bg-[#FF0080]/20 focus:text-white ${
                                  isCustomActive
                                    ? 'bg-[#FF0080]/20 border-[#FF0080]/40 text-white'
                                    : 'bg-black/40 border-[#FF0080]/40 text-[#FF0080] placeholder-transparent'
                                }`}
                                onFocus={(e) => {
                                  // Store original value to restore if nothing typed
                                  e.target.dataset.originalValue = e.target.value;
                                  // When focused, show the sign prefix for the direction
                                  e.target.value = invertPriceDisplay ? '-' : '+';
                                  // Move cursor to end (after the sign)
                                  setTimeout(() => {
                                    e.target.setSelectionRange(1, 1);
                                  }, 0);
                                }}
                                onSelect={(e) => {
                                  // Prevent cursor from being placed before the sign
                                  const input = e.target as HTMLInputElement;
                                  if (input.selectionStart !== null && input.selectionStart < 1) {
                                    e.preventDefault();
                                    input.setSelectionRange(1, Math.max(1, input.selectionEnd || 1));
                                  }
                                }}
                                onMouseUp={(e) => {
                                  // Block cursor placement before sign on click
                                  const input = e.target as HTMLInputElement;
                                  requestAnimationFrame(() => {
                                    if (input.selectionStart !== null && input.selectionStart < 1) {
                                      input.setSelectionRange(1, Math.max(1, input.selectionEnd || 1));
                                    }
                                  });
                                }}
                                onKeyDown={(e) => {
                                  // Block arrow keys and home from moving cursor before sign
                                  const input = e.target as HTMLInputElement;
                                  if (e.key === 'ArrowLeft' || e.key === 'Home') {
                                    if (input.selectionStart !== null && input.selectionStart <= 1) {
                                      e.preventDefault();
                                    }
                                  }
                                  if (e.key === 'Enter') {
                                    const val = input.value;
                                    const isNegative = val.startsWith('-');
                                    const numStr = val.replace(/[^0-9.]/g, '');
                                    const value = parseFloat(numStr);
                                    if (!isNaN(value) && value !== 0) {
                                      const capped = Math.min(999, value);
                                      handlePercentageClick(capped, isNegative ? 'below' : 'above');
                                      input.blur();
                                    }
                                  }
                                }}
                                onInput={(e) => {
                                  const input = e.target as HTMLInputElement;
                                  const prevValue = input.dataset.prevValue || '';
                                  // Keep the sign at the start, only allow digits and one decimal point after
                                  let val = input.value;
                                  const sign = val.startsWith('-') ? '-' : (val.startsWith('+') ? '+' : (invertPriceDisplay ? '-' : '+'));
                                  let cleaned = val.replace(/[^0-9.]/g, '');
                                  // Only one decimal point
                                  const parts = cleaned.split('.');
                                  if (parts.length > 2) cleaned = parts[0] + '.' + parts.slice(1).join('');
                                  // Block if would exceed 999
                                  const num = parseFloat(cleaned);
                                  if (!isNaN(num) && num > 999) {
                                    cleaned = prevValue.replace(/[^0-9.]/g, ''); // Revert to previous value
                                  }
                                  input.value = sign + cleaned;
                                  input.dataset.prevValue = input.value;
                                }}
                                onBlur={(e) => {
                                  const val = e.target.value;
                                  const isNegative = val.startsWith('-');
                                  const numStr = val.replace(/[^0-9.%]/g, '');
                                  const value = parseFloat(numStr);
                                  if (!isNaN(value) && value !== 0) {
                                    const capped = Math.min(999, value);
                                    handlePercentageClick(capped, isNegative ? 'below' : 'above');
                                    // Show value with % sign
                                    e.target.value = (isNegative ? '-' : '+') + capped + '%';
                                  } else {
                                    // Restore original value if nothing was typed (or clear if original was empty)
                                    e.target.value = e.target.dataset.originalValue || '';
                                  }
                                }}
                              />
                              {/* Placeholder ? when no custom value is active */}
                              {!isCustomActive && (
                                <span className="absolute inset-0 flex items-center justify-center text-xs font-medium text-[#FF0080]/60 pointer-events-none peer-focus:hidden">
                                  ?%
                                </span>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
            /* Individual Token Views - when no basket or prices unlinked */
            /* When pricesBound is true, only show the first token */
            buyTokens.map((buyToken, index) => (
              // Skip rendering tokens at index > 0 when prices are linked
              (pricesBound && index > 0) ? null : (
              <div key={index}>
                {/* OR Divider - only show when prices are unlinked */}
                {index > 0 && !pricesBound && (
                  <div className="flex items-center gap-4 mb-4">
                    <div className="flex-1 h-px bg-white/10"></div>
                    <span className="text-white/70 text-sm font-medium px-2">OR</span>
                    <div className="flex-1 h-px bg-white/10"></div>
                  </div>
                )}

                {/* Token Selector and Amount Input Row */}
                <div className="relative" ref={el => { buyDropdownRefs.current[index] = el; }}>
                  <div className="flex items-stretch gap-2">
                    <button
                      onClick={() => {
                        // Close sell dropdown and other buy dropdowns when opening this one
                        const isOpening = !showBuyDropdowns[index];
                        if (isOpening) {
                          setShowSellDropdown(false);
                        }
                        const newDropdowns = showBuyDropdowns.map((_, i) => i === index ? !showBuyDropdowns[index] : false);
                        setShowBuyDropdowns(newDropdowns);
                      }}
                      className="min-w-[120px] shrink-0 bg-black/40 border border-white/10 p-3 flex items-center justify-between hover:bg-white/5 transition-all shadow-sm rounded-lg"
                    >
                      <div className="flex items-center space-x-2">
                        {buyToken ? (
                          <>
                            <TokenLogo ticker={buyToken.ticker} className="w-6 h-6" />
                            <span className="text-white font-medium">{formatTokenTicker(buyToken.ticker, chainId)}</span>
                          </>
                        ) : (
                          <span className="text-white/50">Select</span>
                        )}
                      </div>
                      <svg className="w-4 h-4 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {/* Amount Input - inline */}
                    <div className="flex-1 min-w-0">
                      <input
                        ref={el => { buyInputRefs.current[index] = el; }}
                        type="text"
                        value={buyAmounts[index] || ''}
                        onChange={(e) => handleBuyAmountChange(e, index)}
                        onKeyDown={(e) => handleBuyKeyDown(e, index)}
                        onFocus={() => {
                          const newFocused = [...isBuyInputFocused];
                          newFocused[index] = true;
                          setIsBuyInputFocused(newFocused);
                        }}
                        onBlur={() => {
                          const newFocused = [...isBuyInputFocused];
                          newFocused[index] = false;
                          setIsBuyInputFocused(newFocused);
                          activeInputRef.current = null;
                        }}
                        placeholder="0.00"
                        className="w-full h-full bg-black/40 border border-white/10 p-3 text-white text-base placeholder-white/30 focus:outline-none rounded-lg"
                      />
                    </div>

                    {/* 3-dot menu for buy token - hide for native PLS */}
                    {buyToken && buyToken.a.toLowerCase() !== '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' && (
                      <div className="relative self-stretch" ref={el => { buyTokenMenuRefs.current[index] = el; }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowBuyTokenMenus(prev => {
                              const newMenus = [...prev];
                              newMenus[index] = !newMenus[index];
                              return newMenus;
                            });
                          }}
                          className="h-full px-2 bg-black/40 border border-white/10 hover:bg-white/5 transition-all rounded-lg flex items-center justify-center"
                          title="Token options"
                        >
                          <svg className="w-4 h-4 text-white/50" fill="currentColor" viewBox="0 0 24 24">
                            <circle cx="12" cy="6" r="2" />
                            <circle cx="12" cy="12" r="2" />
                            <circle cx="12" cy="18" r="2" />
                          </svg>
                        </button>

                        {showBuyTokenMenus[index] && (
                          <div className="absolute top-full right-0 mt-1 bg-black/95 border border-white/10 z-50 shadow-xl backdrop-blur-md rounded-lg overflow-hidden min-w-[180px]">
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(buyToken.a);
                                toast({ title: "Address copied", description: buyToken.a.slice(0, 10) + '...' + buyToken.a.slice(-8) });
                                setShowBuyTokenMenus(prev => {
                                  const newMenus = [...prev];
                                  newMenus[index] = false;
                                  return newMenus;
                                });
                              }}
                              className="w-full px-4 py-3 flex items-center gap-3 hover:bg-white/10 transition-colors text-left"
                            >
                              <svg className="w-4 h-4 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" strokeWidth={2} />
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" strokeWidth={2} />
                              </svg>
                              <span className="text-white text-sm">Copy Address</span>
                            </button>
                            <button
                              onClick={() => {
                                window.open(`https://midgard.wtf/address/${buyToken.a}`, '_blank');
                                setShowBuyTokenMenus(prev => {
                                  const newMenus = [...prev];
                                  newMenus[index] = false;
                                  return newMenus;
                                });
                              }}
                              className="w-full px-4 py-3 flex items-center gap-3 hover:bg-white/10 transition-colors text-left"
                            >
                              <svg className="w-4 h-4 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                              </svg>
                              <span className="text-white text-sm">View on Explorer</span>
                            </button>
                            <button
                              onClick={() => {
                                window.open(`https://dexscreener.com/pulsechain/${buyToken.a}`, '_blank');
                                setShowBuyTokenMenus(prev => {
                                  const newMenus = [...prev];
                                  newMenus[index] = false;
                                  return newMenus;
                                });
                              }}
                              className="w-full px-4 py-3 flex items-center gap-3 hover:bg-white/10 transition-colors text-left"
                            >
                              <svg className="w-4 h-4 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                              </svg>
                              <span className="text-white text-sm">View on DexScreener</span>
                            </button>
                            {/* Remove All option - only for first token when there are multiple tokens */}
                            {index === 0 && buyTokens.length > 1 && (
                              <>
                                <div className="border-t border-white/10 my-1" />
                                <button
                                  onClick={() => {
                                    // Keep only the first token, remove all others
                                    setBuyTokens([buyTokens[0]]);
                                    setBuyAmounts([buyAmounts[0]]);
                                    setShowBuyDropdowns([showBuyDropdowns[0]]);
                                    setBuySearchQueries([buySearchQueries[0]]);
                                    setIsBuyInputFocused([isBuyInputFocused[0]]);
                                    setIndividualLimitPrices([individualLimitPrices[0]]);
                                    setSelectedBasket(null);
                                    setShowBuyTokenMenus(prev => {
                                      const newMenus = [...prev];
                                      newMenus[0] = false;
                                      return newMenus;
                                    });
                                  }}
                                  className="w-full px-4 py-3 flex items-center gap-3 hover:bg-red-500/20 transition-colors text-left"
                                >
                                  <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                  <span className="text-red-400 text-sm">Remove All Alternative Tokens</span>
                                </button>
                              </>
                            )}
                            {/* Delete option - only for additional tokens (index > 0) */}
                            {index > 0 && (
                              <>
                                <div className="border-t border-white/10 my-1" />
                                <button
                                  onClick={() => {
                                    handleRemoveBuyToken(index);
                                    setShowBuyTokenMenus(prev => {
                                      const newMenus = [...prev];
                                      newMenus[index] = false;
                                      return newMenus;
                                    });
                                  }}
                                  className="w-full px-4 py-3 flex items-center gap-3 hover:bg-red-500/20 transition-colors text-left"
                                >
                                  <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                  <span className="text-red-400 text-sm">Remove Token</span>
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Dropdown */}
                  {showBuyDropdowns[index] && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-black/90 border border-white/10 z-10 shadow-xl backdrop-blur-md rounded-lg overflow-hidden">
                      <div className="sticky top-0 p-2 bg-black/50 border-b border-white/10">
                        <input
                          ref={el => { buySearchRefs.current[index] = el; }}
                          type="text"
                          value={buySearchQueries[index] || ''}
                          onChange={(e) => {
                            const newQueries = [...buySearchQueries];
                            newQueries[index] = e.target.value;
                            setBuySearchQueries(newQueries);
                          }}
                          placeholder={`Search tokens... (${getFilteredBuyTokens(index).length})`}
                          className="w-full bg-transparent border border-white/10 p-2 text-white text-sm placeholder-white/30 focus:outline-none rounded"
                        />
                      </div>
                      <div className="max-h-60 overflow-y-auto modern-scrollbar">
                        {/* Token Baskets - only show on first slot when no search query */}
                        {index === 0 && !(buySearchQueries[index] || '').trim() && getAvailableBaskets(index).length > 0 && (
                          <>
                            <div className="px-3 py-2 text-xs text-white/40 uppercase tracking-wider bg-black/30 border-b border-white/10">
                              Token Baskets
                            </div>
                            {getAvailableBaskets(index).map((basket) => {
                              const basketTokens = getBasketTokens(basket.id);
                              return (
                                <button
                                  key={basket.id}
                                  onClick={() => handleBasketSelect(basket, index)}
                                  className="w-full p-3 flex items-center space-x-3 hover:bg-white/5 transition-all text-left border-b border-white/5"
                                >
                                  <div className="flex items-center -space-x-1.5">
                                    {basketTokens.slice(0, 5).map((token, idx) => (
                                      <div
                                        key={token.a}
                                        className="w-6 h-6 rounded-full bg-black ring-2 ring-black flex items-center justify-center"
                                        style={{ zIndex: 5 - idx }}
                                      >
                                        <TokenLogo
                                          ticker={token.ticker}
                                          className="w-5 h-5 rounded-full"
                                        />
                                      </div>
                                    ))}
                                    {basketTokens.length > 5 && (
                                      <div className="w-6 h-6 rounded-full bg-black ring-2 ring-black flex items-center justify-center text-[10px] text-white/60">
                                        +{basketTokens.length - 5}
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="text-white font-medium">{basket.name}</div>
                                    <div className="text-white/50 text-xs truncate">{basket.description}</div>
                                  </div>
                                </button>
                              );
                            })}
                            <div className="px-3 py-2 text-xs text-white/40 uppercase tracking-wider bg-black/30 border-b border-white/10">
                              Individual Tokens
                            </div>
                          </>
                        )}
                        {getFilteredBuyTokens(index).length === 0 ? (
                          <div className="p-4 text-center text-white/50 text-sm">No tokens found</div>
                        ) : (
                          getFilteredBuyTokens(index).map((token) => {
                            const tokenBalance = parseFloat(dropdownTokenBalances[token.a?.toLowerCase() || ''] || '0');
                            const tokenPrice = getPrice(token.a);
                            const tokenUsdValue = tokenBalance * (tokenPrice > 0 ? tokenPrice : 0);
                            return (
                              <button
                                key={token.a}
                                onClick={() => handleBuyTokenSelect(token, index)}
                                className="w-full p-3 flex items-center space-x-3 hover:bg-white/5 transition-all text-left border-b border-white/5 last:border-b-0"
                              >
                                <TokenLogo ticker={token.ticker} className="w-6 h-6" />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between">
                                    <div className="min-w-0 flex-1">
                                      <div className="text-white font-medium">{formatTokenTicker(token.ticker, chainId)}</div>
                                      <div className="text-white/50 text-xs truncate">{token.name}</div>
                                    </div>
                                    <div className="text-right ml-2 flex-shrink-0">
                                      {tokenBalance > 0 && (
                                        <>
                                          <div className="text-white text-sm">{tokenBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                                          <div className="text-white/50 text-xs">
                                            ${tokenUsdValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                          </div>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Buy Token USD Value */}
                {buyToken && (
                  <div className="flex items-center gap-2 mt-2">
                    <div className="w-[140px] shrink-0 text-white/50 text-sm font-semibold">
                      {(() => {
                        const buyAmtNum = buyAmounts[index] ? parseFloat(removeCommas(buyAmounts[index])) : 0;
                        const tokenPrice = getPrice(buyToken.a);
                        const usdValue = buyAmtNum * Math.max(0, tokenPrice);
                        if (pricesLoading && tokenPrice === 0 && buyAmtNum > 0) {
                          return (
                            <div className="flex items-center gap-1.5 animate-pulse">
                              <span className="w-1.5 h-1.5 rounded-full bg-white/30" />
                              <span>Loading price...</span>
                            </div>
                          );
                        }
                        return usdValue > 0 ? `$${formatNumberWithCommas(usdValue.toFixed(2))}` : '$0.00';
                      })()}
                    </div>
                  </div>
                )}

                {/* Linked Tokens Preview - show when prices linked with multiple tokens (not via basket) */}
                {index === 0 && pricesBound && !selectedBasket && buyTokens.length > 1 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {buyTokens.map((token, tokenIndex) => token && (
                      <div
                        key={token.a}
                        className="group relative flex items-center gap-1 px-2 py-1 bg-white/5 hover:bg-white/10 rounded-full border border-white/10 hover:border-white/20 whitespace-nowrap transition-colors cursor-pointer"
                        onClick={() => {
                          if (buyTokens.length > 1) {
                            // Remove this token from the list
                            const newBuyTokens = buyTokens.filter((_, i) => i !== tokenIndex);
                            const newBuyAmounts = buyAmounts.filter((_, i) => i !== tokenIndex);
                            setBuyTokens(newBuyTokens);
                            setBuyAmounts(newBuyAmounts);
                          }
                        }}
                        title={buyTokens.length > 1 ? `Click to remove ${formatTokenTicker(token.ticker, chainId)}` : 'Cannot remove last token'}
                      >
                        <TokenLogo ticker={token.ticker} className="w-4 h-4 flex-shrink-0" />
                        <span className="text-white/70 text-xs group-hover:text-white/90 transition-colors">
                          {buyAmounts[tokenIndex] && parseFloat(removeCommas(buyAmounts[tokenIndex])) > 0
                            ? `${formatAmountForLabel(parseFloat(removeCommas(buyAmounts[tokenIndex])))} `
                            : ''}
                          {formatTokenTicker(token.ticker, chainId)}
                        </span>
                        {buyTokens.length > 1 && (
                          <span className="ml-0.5 opacity-0 group-hover:opacity-100 transition-opacity text-white/50 hover:text-white">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Limit Price Section - inline for each buy token */}
                {buyToken && (
                  index === 0 ? (
                    // First token - main limit price (pink)
                    <div className="mt-4">
                      <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center gap-2">
                          <label className="text-[#FF0080]/90 text-sm font-semibold">
                            Limit Price: ({showUsdPrices ? '$' : (invertPriceDisplay ? formatTokenTicker(buyToken.ticker, chainId) : formatTokenTicker(sellToken?.ticker || '', chainId))})
                          </label>
                          {sellToken && (
                            <button
                              type="button"
                              onClick={() => {
                                const newInverted = !invertPriceDisplay;
                                setInvertPriceDisplay(newInverted);
                                onInvertPriceDisplayChange?.(newInverted);
                              }}
                              className="p-1 text-[#FF0080] hover:text-white transition-colors"
                              title={`Show price in ${invertPriceDisplay ? formatTokenTicker(sellToken.ticker, chainId) : formatTokenTicker(buyToken.ticker, chainId)}`}
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                              </svg>
                            </button>
                          )}
                        </div>
                        {/* Percentage indicator */}
                        {(() => {
                          if (!sellToken || !buyToken) return null;
                          const sellUsd = getPrice(sellToken.a);
                          const buyUsd = getPrice(buyToken.a);
                          if (sellUsd <= 0 || buyUsd <= 0) return null;
                          const marketPrice = sellUsd / buyUsd;
                          const currentLimitPrice = parseFloat(limitPrice) || 0;
                          if (marketPrice <= 0 || currentLimitPrice <= 0) return null;
                          const pctDiff = ((currentLimitPrice / marketPrice) - 1) * 100;
                          const isPositive = pctDiff >= 0;
                          return (
                            <span className={`text-sm font-semibold select-none ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                              {isPositive ? '+' : ''}{pctDiff.toFixed(1)}%
                            </span>
                          );
                        })()}
                      </div>
                      <div className="relative">
                        <input
                          ref={limitPriceInputRef}
                          type="text"
                          inputMode="decimal"
                          className="w-full bg-black/40 border border-[#FF0080]/30 p-3 text-[#FF0080] text-lg min-h-[52px] rounded-lg focus:outline-none focus:border-[#FF0080]/60 transition-colors"
                          placeholder="0.00000000"
                          value={isLimitPriceInputFocused ? limitPriceInputValue : (() => {
                            if (!limitPrice || parseFloat(limitPrice) <= 0) return '';
                            const price = parseFloat(limitPrice);
                            let displayPrice = price;
                            if (invertPriceDisplay && price > 0) {
                              displayPrice = 1 / price;
                            }
                            // If showing USD prices, convert to USD
                            if (showUsdPrices && displayPrice > 0) {
                              const unitToken = invertPriceDisplay ? sellToken : buyToken;
                              const unitTokenUsdPrice = unitToken ? getPrice(unitToken.a) : 0;
                              if (unitTokenUsdPrice > 0) {
                                const usdValue = displayPrice * unitTokenUsdPrice;
                                return '$' + formatNumberWithCommas(usdValue.toLocaleString(undefined, {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: usdValue < 0.01 ? 6 : usdValue < 1 ? 4 : 2
                                }));
                              }
                            }
                            return formatNumberWithCommas(formatLimitPriceDisplay(displayPrice));
                          })()}
                          onChange={(e) => {
                            const input = e.target;
                            const cursorPos = input.selectionStart || 0;
                            const oldValue = input.value;

                            // Remove commas first, then filter to only numbers and decimal
                            const rawValue = removeCommas(e.target.value).replace(/[^0-9.]/g, '');
                            // Format with commas for display
                            const formattedValue = formatNumberWithCommas(rawValue);
                            setLimitPriceInputValue(formattedValue);

                            // Calculate new cursor position
                            const digitsBeforeCursor = removeCommas(oldValue.slice(0, cursorPos)).length;
                            let newCursorPos = 0;
                            let digitCount = 0;
                            for (let i = 0; i < formattedValue.length; i++) {
                              if (digitCount >= digitsBeforeCursor) {
                                newCursorPos = i;
                                break;
                              }
                              if (formattedValue[i] !== ',') {
                                digitCount++;
                              }
                              newCursorPos = i + 1;
                            }

                            requestAnimationFrame(() => {
                              if (limitPriceInputRef.current) {
                                limitPriceInputRef.current.setSelectionRange(newCursorPos, newCursorPos);
                              }
                            });

                            if (rawValue === '' || rawValue === '.') {
                              setLimitPrice('');
                              setPricePercentage(null);
                              setIndividualLimitPrices(prev => {
                                const newPrices = [...prev];
                                newPrices[0] = undefined;
                                return newPrices;
                              });
                              if (onLimitPriceChange) {
                                onLimitPriceChange(undefined);
                              }
                              return;
                            }
                            const displayPrice = parseFloat(rawValue);
                            if (!isNaN(displayPrice) && displayPrice > 0) {
                              const basePrice = invertPriceDisplay ? 1 / displayPrice : displayPrice;
                              setLimitPrice(basePrice.toString());
                              setIndividualLimitPrices(prev => {
                                const newPrices = [...prev];
                                newPrices[0] = basePrice;
                                return newPrices;
                              });
                              if (marketPrice > 0) {
                                // marketPrice is sell/buy format, basePrice is buy/sell format
                                // Convert to same format for comparison
                                const marketPriceBuyPerSell = 1 / marketPrice;
                                const percentageAboveMarket = ((basePrice - marketPriceBuyPerSell) / marketPriceBuyPerSell) * 100;
                                setPricePercentage(Math.abs(percentageAboveMarket) > 0.01 ? percentageAboveMarket : null);
                              }
                              // Recalculate buy amount: buyAmount = sellAmount * limitPrice
                              const sellAmt = sellAmount ? parseFloat(removeCommas(sellAmount)) : 0;
                              if (sellAmt > 0) {
                                const newBuyAmount = sellAmt * basePrice;
                                setBuyAmounts(prev => {
                                  const newAmounts = [...prev];
                                  newAmounts[0] = formatCalculatedValue(newBuyAmount);
                                  return newAmounts;
                                });
                              }
                              if (onLimitPriceChange) {
                                onLimitPriceChange(basePrice);
                              }
                            }
                          }}
                          onFocus={() => {
                            setIsLimitPriceInputFocused(true);
                            if (limitPrice && parseFloat(limitPrice) > 0) {
                              const price = parseFloat(limitPrice);
                              const displayValue = invertPriceDisplay && price > 0
                                ? (1 / price).toFixed(8).replace(/\.?0+$/, '')
                                : price.toFixed(8).replace(/\.?0+$/, '');
                              setLimitPriceInputValue(formatNumberWithCommas(displayValue));
                            } else {
                              setLimitPriceInputValue('');
                            }
                          }}
                          onBlur={() => setIsLimitPriceInputFocused(false)}
                        />
                        {sellToken && !showUsdPrices && (
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[#FF0080]/70 text-sm font-medium pointer-events-none">
                            {invertPriceDisplay ? formatTokenTicker(sellToken.ticker, chainId) : formatTokenTicker(buyToken.ticker, chainId)}
                          </div>
                        )}
                      </div>

                      {/* Price Warning for tokens without price data */}
                      {sellToken && (
                        (prices[sellToken.a]?.price === -1) || (prices[buyToken.a]?.price === -1)
                      ) && (
                        <div className="mt-2 p-3 bg-yellow-900/20 border border-yellow-500/30 rounded-lg">
                          <div className="flex items-start gap-2">
                            <svg className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            <div className="text-sm">
                              <p className="text-yellow-500 font-medium">No Market Price Available</p>
                              <p className="text-yellow-400/80 mt-1">
                                {prices[sellToken.a]?.price === -1 && prices[buyToken.a]?.price === -1
                                  ? `Neither ${formatTokenTicker(sellToken.ticker, chainId)} nor ${formatTokenTicker(buyToken.ticker, chainId)} have market prices.`
                                  : prices[sellToken.a]?.price === -1
                                    ? `${formatTokenTicker(sellToken.ticker, chainId)} has no market price data.`
                                    : `${formatTokenTicker(buyToken.ticker, chainId)} has no market price data.`
                                } You'll need to manually set your desired price.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Percentage Buttons */}
                      {marketPrice > 0 && (
                        <div className="flex gap-2 mt-3">
                          <button
                            onClick={() => handlePercentageClick(0, 'above')}
                            className={`flex-1 py-2 border-accent-pink text-xs transition-all font-medium rounded-full ${pricePercentage === null || Math.abs(pricePercentage) < 0.01
                              ? 'bg-[#FF0080]/20 text-white'
                              : 'bg-black/40 text-[#FF0080] hover:bg-[#FF0080]/20 hover:text-white'
                              }`}
                          >
                            Market
                          </button>
                          {canShowBackingButton ? (
                            <button
                              onClick={handleBackingPriceClick}
                              className={`flex-1 py-2 border-accent-pink text-xs transition-all font-medium rounded-full ${(() => {
                                const backingPrice = getBackingLimitPrice();
                                if (!backingPrice || !marketPrice) return false;
                                const backingPercent = ((backingPrice - marketPrice) / marketPrice) * 100;
                                return pricePercentage !== null && Math.abs(pricePercentage - backingPercent) < 0.5;
                              })()
                                ? 'bg-[#FF0080]/20 text-white'
                                : 'bg-black/40 text-[#FF0080] hover:bg-[#FF0080]/20 hover:text-white'
                                }`}
                              title={`Set price to backing value: ${getBackingLimitPrice()?.toFixed(4)} HEX`}
                            >
                              Backing
                            </button>
                          ) : (
                            <button
                              onClick={() => handlePercentageClick(1, invertPriceDisplay ? 'below' : 'above')}
                              className={`flex-1 py-2 border-accent-pink text-xs transition-all font-medium rounded-full ${pricePercentage !== null && Math.abs(Math.abs(pricePercentage) - 1) < 0.1 && (invertPriceDisplay ? pricePercentage < 0 : pricePercentage > 0)
                                ? 'bg-[#FF0080]/20 text-white'
                                : 'bg-black/40 text-[#FF0080] hover:bg-[#FF0080]/20 hover:text-white'
                                }`}
                            >
                              {invertPriceDisplay ? '-1%' : '+1%'} {invertPriceDisplay ? '↓' : '↑'}
                            </button>
                          )}
                          <button
                            onClick={() => handlePercentageClick(2, invertPriceDisplay ? 'below' : 'above')}
                            className={`flex-1 py-2 border-accent-pink text-xs transition-all font-medium rounded-full ${pricePercentage !== null && Math.abs(Math.abs(pricePercentage) - 2) < 0.1 && (invertPriceDisplay ? pricePercentage < 0 : pricePercentage > 0)
                              ? 'bg-[#FF0080]/20 text-white'
                              : 'bg-black/40 text-[#FF0080] hover:bg-[#FF0080]/20 hover:text-white'
                              }`}
                          >
                            {invertPriceDisplay ? '-2%' : '+2%'} {invertPriceDisplay ? '↓' : '↑'}
                          </button>
                          <button
                            onClick={() => handlePercentageClick(5, invertPriceDisplay ? 'below' : 'above')}
                            className={`flex-1 py-2 border-accent-pink text-xs transition-all font-medium rounded-full ${pricePercentage !== null && Math.abs(Math.abs(pricePercentage) - 5) < 0.1 && (invertPriceDisplay ? pricePercentage < 0 : pricePercentage > 0)
                              ? 'bg-[#FF0080]/20 text-white'
                              : 'bg-black/40 text-[#FF0080] hover:bg-[#FF0080]/20 hover:text-white'
                              }`}
                          >
                            {invertPriceDisplay ? '-5%' : '+5%'} {invertPriceDisplay ? '↓' : '↑'}
                          </button>
                          {(() => {
                            // Check if current percentage is a custom value (not a preset button)
                            const presetValues = [0, 1, 2, 5];
                            const isCustomActive = pricePercentage !== null &&
                              !presetValues.some(p => Math.abs(Math.abs(pricePercentage) - p) < 0.1) &&
                              (invertPriceDisplay ? pricePercentage < 0 : pricePercentage > 0);
                            const isWholeNumber = (n: number) => Math.abs(n - Math.round(n)) < 0.1;
                            // Format: show sign, absolute value, no .0 suffix, includes %
                            const formatPct = (n: number) => {
                              const sign = n < 0 ? '-' : '+';
                              const absVal = isWholeNumber(n) ? String(Math.round(Math.abs(n))) : Math.abs(n).toFixed(1).replace(/\.0$/, '');
                              return sign + absVal + '%';
                            };
                            // Cap display at ±999% to prevent UI overflow
                            const cappedPct = pricePercentage !== null ? Math.max(-999, Math.min(999, pricePercentage)) : 0;
                            const displayValue = isCustomActive ? formatPct(cappedPct) : '';

                            return (
                              <div className="flex-1 relative">
                                <input
                                  key={isCustomActive ? `active-${displayValue}` : 'inactive'}
                                  type="text"
                                  inputMode="decimal"
                                  defaultValue={displayValue}
                                  maxLength={7}
                                  className={`peer w-full py-2 px-2 border text-xs font-medium rounded-full text-center focus:outline-none focus:border-[#FF0080] focus:bg-[#FF0080]/20 focus:text-white ${
                                    isCustomActive
                                      ? 'bg-[#FF0080]/20 border-[#FF0080]/40 text-white'
                                      : 'bg-black/40 border-[#FF0080]/40 text-[#FF0080] placeholder-transparent'
                                  }`}
                                  onFocus={(e) => {
                                    // Store original value to restore if nothing typed
                                    e.target.dataset.originalValue = e.target.value;
                                    // When focused, show the sign prefix for the direction
                                    e.target.value = invertPriceDisplay ? '-' : '+';
                                    // Move cursor to end (after the sign)
                                    setTimeout(() => {
                                      e.target.setSelectionRange(1, 1);
                                    }, 0);
                                  }}
                                  onSelect={(e) => {
                                    // Prevent cursor from being placed before the sign
                                    const input = e.target as HTMLInputElement;
                                    if (input.selectionStart !== null && input.selectionStart < 1) {
                                      e.preventDefault();
                                      input.setSelectionRange(1, Math.max(1, input.selectionEnd || 1));
                                    }
                                  }}
                                  onMouseUp={(e) => {
                                    // Block cursor placement before sign on click
                                    const input = e.target as HTMLInputElement;
                                    requestAnimationFrame(() => {
                                      if (input.selectionStart !== null && input.selectionStart < 1) {
                                        input.setSelectionRange(1, Math.max(1, input.selectionEnd || 1));
                                      }
                                    });
                                  }}
                                  onKeyDown={(e) => {
                                    // Block arrow keys and home from moving cursor before sign
                                    const input = e.target as HTMLInputElement;
                                    if (e.key === 'ArrowLeft' || e.key === 'Home') {
                                      if (input.selectionStart !== null && input.selectionStart <= 1) {
                                        e.preventDefault();
                                      }
                                    }
                                    if (e.key === 'Enter') {
                                      const val = input.value;
                                      const isNegative = val.startsWith('-');
                                      const numStr = val.replace(/[^0-9.]/g, '');
                                      const value = parseFloat(numStr);
                                      if (!isNaN(value) && value !== 0) {
                                        const capped = Math.min(999, value);
                                        handlePercentageClick(capped, isNegative ? 'below' : 'above');
                                        input.blur();
                                      }
                                    }
                                  }}
                                  onInput={(e) => {
                                    const input = e.target as HTMLInputElement;
                                    const prevValue = input.dataset.prevValue || '';
                                    // Keep the sign at the start, only allow digits and one decimal point after
                                    let val = input.value;
                                    const sign = val.startsWith('-') ? '-' : (val.startsWith('+') ? '+' : (invertPriceDisplay ? '-' : '+'));
                                    let cleaned = val.replace(/[^0-9.]/g, '');
                                    // Only one decimal point
                                    const parts = cleaned.split('.');
                                    if (parts.length > 2) cleaned = parts[0] + '.' + parts.slice(1).join('');
                                    // Block if would exceed 999
                                    const num = parseFloat(cleaned);
                                    if (!isNaN(num) && num > 999) {
                                      cleaned = prevValue.replace(/[^0-9.]/g, ''); // Revert to previous value
                                    }
                                    input.value = sign + cleaned;
                                    input.dataset.prevValue = input.value;
                                  }}
                                  onBlur={(e) => {
                                    const val = e.target.value;
                                    const isNegative = val.startsWith('-');
                                    const numStr = val.replace(/[^0-9.%]/g, '');
                                    const value = parseFloat(numStr);
                                    if (!isNaN(value) && value !== 0) {
                                      const capped = Math.min(999, value);
                                      handlePercentageClick(capped, isNegative ? 'below' : 'above');
                                      // Show value with % sign
                                      e.target.value = (isNegative ? '-' : '+') + capped + '%';
                                    } else {
                                      // Restore original value if nothing was typed (or clear if original was empty)
                                      e.target.value = e.target.dataset.originalValue || '';
                                    }
                                  }}
                                />
                                {/* Placeholder ? when no custom value is active */}
                                {!isCustomActive && (
                                  <span className="absolute inset-0 flex items-center justify-center text-xs font-medium text-[#FF0080]/60 pointer-events-none peer-focus:hidden">
                                    ?%
                                  </span>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  ) : !pricesBound ? (
                    // Additional tokens - individual limit prices (colored) - only show when unlinked
                    (() => {
                      const tokenColors = [
                        { accent: '#8B5CF6', bg: 'bg-purple-500/10', border: 'border-purple-500/30', text: 'text-purple-400' },
                        { accent: '#F59E0B', bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-400' },
                        { accent: '#10B981', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400' },
                        { accent: '#EF4444', bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-400' },
                        { accent: '#3B82F6', bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-400' },
                        { accent: '#EC4899', bg: 'bg-fuchsia-500/10', border: 'border-fuchsia-500/30', text: 'text-fuchsia-400' },
                        { accent: '#14B8A6', bg: 'bg-teal-500/10', border: 'border-teal-500/30', text: 'text-teal-400' },
                        { accent: '#F97316', bg: 'bg-orange-500/10', border: 'border-orange-500/30', text: 'text-orange-400' },
                        { accent: '#6366F1', bg: 'bg-indigo-500/10', border: 'border-indigo-500/30', text: 'text-indigo-400' },
                      ];
                      const colors = tokenColors[(index - 1) % tokenColors.length];
                      const accentColor = colors.accent;
                      const tokenLimitPrice = individualLimitPrices[index];
                      const sellTokenUsdPrice = sellToken ? getPrice(sellToken.a) : 0;
                      const tokenUsdPrice = getPrice(buyToken.a);
                      const tokenMarketPrice = sellTokenUsdPrice > 0 && tokenUsdPrice > 0
                        ? sellTokenUsdPrice / tokenUsdPrice
                        : 0;
                      let tokenPricePercentage: number | null = null;
                      if (tokenMarketPrice > 0 && tokenLimitPrice) {
                        if (invertPriceDisplay) {
                          const invertedLimitPrice = 1 / tokenLimitPrice;
                          const invertedMarketPrice = 1 / tokenMarketPrice;
                          tokenPricePercentage = ((invertedLimitPrice - invertedMarketPrice) / invertedMarketPrice) * 100;
                        } else {
                          tokenPricePercentage = ((tokenLimitPrice - tokenMarketPrice) / tokenMarketPrice) * 100;
                        }
                      }

                      return (
                        <div className="mt-4">
                          <div className="flex justify-between items-center mb-2">
                            <div className="flex items-center gap-2">
                              <label className="text-sm font-semibold" style={{ color: accentColor }}>
                                Limit Price: ({showUsdPrices ? '$' : (invertPriceDisplay ? formatTokenTicker(buyToken.ticker, chainId) : formatTokenTicker(sellToken?.ticker || '', chainId))})
                              </label>
                              {sellToken && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const newInverted = !invertPriceDisplay;
                                    setInvertPriceDisplay(newInverted);
                                    onInvertPriceDisplayChange?.(newInverted);
                                  }}
                                  className="p-1 hover:text-white transition-colors"
                                  style={{ color: accentColor }}
                                  title={`Show price in ${invertPriceDisplay ? formatTokenTicker(sellToken.ticker, chainId) : formatTokenTicker(buyToken.ticker, chainId)}`}
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                                  </svg>
                                </button>
                              )}
                            </div>
                            {/* Percentage indicator */}
                            {tokenPricePercentage !== null && (
                              <span className={`text-sm font-semibold select-none ${tokenPricePercentage >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {tokenPricePercentage >= 0 ? '+' : ''}{tokenPricePercentage.toFixed(1)}%
                              </span>
                            )}
                          </div>
                          <div className="relative">
                            <input
                              type="text"
                              inputMode="decimal"
                              readOnly={pricesBound}
                              className={`w-full bg-black/40 p-3 text-lg min-h-[52px] rounded-lg focus:outline-none transition-colors ${pricesBound ? 'cursor-not-allowed opacity-60' : ''}`}
                              style={{
                                borderColor: `${accentColor}40`,
                                color: accentColor,
                                border: `1px solid ${accentColor}40`
                              }}
                              placeholder="0.00000000"
                              value={pricesBound ? (() => {
                                // When bound, show the derived price from the main limit price
                                if (!limitPrice || parseFloat(limitPrice) <= 0) return '';
                                const mainPrice = parseFloat(limitPrice);
                                // Convert from sell/buyToken[0] ratio to sell/thisToken ratio
                                const sellTokenUsdPriceLocal = sellToken ? getPrice(sellToken.a) : 0;
                                const firstBuyTokenUsdPrice = buyTokens[0] ? getPrice(buyTokens[0].a) : 0;
                                const thisTokenUsdPriceLocal = getPrice(buyToken.a);
                                if (sellTokenUsdPriceLocal > 0 && firstBuyTokenUsdPrice > 0 && thisTokenUsdPriceLocal > 0) {
                                  // mainPrice is in terms of buyTokens[0] per sellToken
                                  // We need to convert to thisToken per sellToken
                                  const derivedPrice = mainPrice * (firstBuyTokenUsdPrice / thisTokenUsdPriceLocal);
                                  let displayPrice = derivedPrice;
                                  if (invertPriceDisplay && derivedPrice > 0) {
                                    displayPrice = 1 / derivedPrice;
                                  }
                                  // If showing USD prices, convert to USD
                                  if (showUsdPrices && displayPrice > 0) {
                                    const unitToken = invertPriceDisplay ? sellToken : buyToken;
                                    const unitTokenUsdPriceLocal = unitToken ? getPrice(unitToken.a) : 0;
                                    if (unitTokenUsdPriceLocal > 0) {
                                      const usdValue = displayPrice * unitTokenUsdPriceLocal;
                                      return '$' + formatNumberWithCommas(usdValue.toLocaleString(undefined, {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: usdValue < 0.01 ? 6 : usdValue < 1 ? 4 : 2
                                      }));
                                    }
                                  }
                                  return formatNumberWithCommas(formatLimitPriceDisplay(displayPrice));
                                }
                                return '';
                              })() : (individualPriceInputFocused[index] ? (individualPriceInputValues[index] || '') : (() => {
                                if (!tokenLimitPrice || tokenLimitPrice <= 0) return '';
                                let displayPrice = tokenLimitPrice;
                                if (invertPriceDisplay && tokenLimitPrice > 0) {
                                  displayPrice = 1 / tokenLimitPrice;
                                }
                                // If showing USD prices, convert to USD
                                if (showUsdPrices && displayPrice > 0) {
                                  const unitToken = invertPriceDisplay ? sellToken : buyToken;
                                  const unitTokenUsdPriceLocal = unitToken ? getPrice(unitToken.a) : 0;
                                  if (unitTokenUsdPriceLocal > 0) {
                                    const usdValue = displayPrice * unitTokenUsdPriceLocal;
                                    return '$' + formatNumberWithCommas(usdValue.toLocaleString(undefined, {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: usdValue < 0.01 ? 6 : usdValue < 1 ? 4 : 2
                                    }));
                                  }
                                }
                                return formatNumberWithCommas(formatLimitPriceDisplay(displayPrice));
                              })())}
                              onChange={(e) => {
                                if (pricesBound) return;
                                const input = e.target;
                                const cursorPos = input.selectionStart || 0;
                                const oldValue = input.value;

                                // Remove commas first, then filter to only numbers and decimal
                                const rawValue = removeCommas(e.target.value).replace(/[^0-9.]/g, '');
                                // Format with commas for display
                                const formattedValue = formatNumberWithCommas(rawValue);
                                setIndividualPriceInputValues(prev => {
                                  const newValues = [...prev];
                                  newValues[index] = formattedValue;
                                  return newValues;
                                });

                                // Calculate new cursor position
                                const digitsBeforeCursor = removeCommas(oldValue.slice(0, cursorPos)).length;
                                let newCursorPos = 0;
                                let digitCount = 0;
                                for (let i = 0; i < formattedValue.length; i++) {
                                  if (digitCount >= digitsBeforeCursor) {
                                    newCursorPos = i;
                                    break;
                                  }
                                  if (formattedValue[i] !== ',') {
                                    digitCount++;
                                  }
                                  newCursorPos = i + 1;
                                }

                                requestAnimationFrame(() => {
                                  input.setSelectionRange(newCursorPos, newCursorPos);
                                });

                                if (rawValue === '' || rawValue === '.') {
                                  setIndividualLimitPrices(prev => {
                                    const newPrices = [...prev];
                                    newPrices[index] = undefined;
                                    return newPrices;
                                  });
                                  return;
                                }
                                const displayPrice = parseFloat(rawValue);
                                if (!isNaN(displayPrice) && displayPrice > 0) {
                                  const basePrice = invertPriceDisplay ? 1 / displayPrice : displayPrice;
                                  setIndividualLimitPrices(prev => {
                                    const newPrices = [...prev];
                                    newPrices[index] = basePrice;
                                    return newPrices;
                                  });
                                  // Also update the buy amount for this token
                                  if (sellAmountNum > 0) {
                                    const newBuyAmount = sellAmountNum * basePrice;
                                    setBuyAmounts(prev => {
                                      const newAmounts = [...prev];
                                      newAmounts[index] = formatCalculatedValue(newBuyAmount);
                                      return newAmounts;
                                    });
                                  }
                                }
                              }}
                              onFocus={(e) => {
                                if (pricesBound) return;
                                e.target.style.borderColor = `${accentColor}80`;
                                setIndividualPriceInputFocused(prev => {
                                  const newFocused = [...prev];
                                  newFocused[index] = true;
                                  return newFocused;
                                });
                                if (tokenLimitPrice && tokenLimitPrice > 0) {
                                  const displayValue = invertPriceDisplay
                                    ? (1 / tokenLimitPrice).toFixed(8).replace(/\.?0+$/, '')
                                    : tokenLimitPrice.toFixed(8).replace(/\.?0+$/, '');
                                  setIndividualPriceInputValues(prev => {
                                    const newValues = [...prev];
                                    newValues[index] = formatNumberWithCommas(displayValue);
                                    return newValues;
                                  });
                                } else {
                                  setIndividualPriceInputValues(prev => {
                                    const newValues = [...prev];
                                    newValues[index] = '';
                                    return newValues;
                                  });
                                }
                              }}
                              onBlur={(e) => {
                                if (pricesBound) return;
                                e.target.style.borderColor = `${accentColor}40`;
                                setIndividualPriceInputFocused(prev => {
                                  const newFocused = [...prev];
                                  newFocused[index] = false;
                                  return newFocused;
                                });
                              }}
                            />
                            {sellToken && !showUsdPrices && (
                              <div
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium pointer-events-none"
                                style={{ color: `${accentColor}B3` }}
                              >
                                {invertPriceDisplay ? formatTokenTicker(sellToken.ticker, chainId) : formatTokenTicker(buyToken.ticker, chainId)}
                              </div>
                            )}
                          </div>

                          {/* Percentage Buttons for this token - only show when unlinked */}
                          {!pricesBound && (
                            tokenMarketPrice > 0 ? (
                              <div className="flex gap-2 mt-3">
                                <button
                                  onClick={() => handleIndividualPercentageClick(index, 0, 'above')}
                                  className="flex-1 py-2 text-xs transition-all font-medium rounded-full"
                                  style={{
                                    backgroundColor: tokenPricePercentage === null || Math.abs(tokenPricePercentage) < 0.01 ? `${accentColor}33` : 'rgba(0,0,0,0.4)',
                                    color: tokenPricePercentage === null || Math.abs(tokenPricePercentage) < 0.01 ? 'white' : accentColor,
                                    border: `1px solid ${accentColor}40`
                                  }}
                                >
                                  Market
                                </button>
                                {canShowIndividualBackingButton(index) ? (
                                  <button
                                    onClick={() => handleIndividualBackingPriceClick(index)}
                                    className="flex-1 py-2 text-xs transition-all font-medium rounded-full"
                                    style={{
                                      backgroundColor: (() => {
                                        const backingPrice = getBackingPriceForToken(sellToken);
                                        if (!backingPrice || !tokenMarketPrice) return false;
                                        const backingPercent = ((backingPrice - tokenMarketPrice) / tokenMarketPrice) * 100;
                                        return tokenPricePercentage !== null && Math.abs(tokenPricePercentage - backingPercent) < 0.5;
                                      })() ? `${accentColor}33` : 'rgba(0,0,0,0.4)',
                                      color: (() => {
                                        const backingPrice = getBackingPriceForToken(sellToken);
                                        if (!backingPrice || !tokenMarketPrice) return accentColor;
                                        const backingPercent = ((backingPrice - tokenMarketPrice) / tokenMarketPrice) * 100;
                                        return tokenPricePercentage !== null && Math.abs(tokenPricePercentage - backingPercent) < 0.5 ? 'white' : accentColor;
                                      })(),
                                      border: `1px solid ${accentColor}40`
                                    }}
                                    title={`Set price to backing value: ${getBackingPriceForToken(sellToken)?.toFixed(4)} HEX`}
                                  >
                                    Backing
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleIndividualPercentageClick(index, 1, invertPriceDisplay ? 'below' : 'above')}
                                    className="flex-1 py-2 text-xs transition-all font-medium rounded-full"
                                    style={{
                                      backgroundColor: tokenPricePercentage !== null && Math.abs(Math.abs(tokenPricePercentage) - 1) < 0.1 ? `${accentColor}33` : 'rgba(0,0,0,0.4)',
                                      color: tokenPricePercentage !== null && Math.abs(Math.abs(tokenPricePercentage) - 1) < 0.1 ? 'white' : accentColor,
                                      border: `1px solid ${accentColor}40`
                                    }}
                                  >
                                    {invertPriceDisplay ? '-1%' : '+1%'} {invertPriceDisplay ? '↓' : '↑'}
                                  </button>
                                )}
                                <button
                                  onClick={() => handleIndividualPercentageClick(index, 2, invertPriceDisplay ? 'below' : 'above')}
                                  className="flex-1 py-2 text-xs transition-all font-medium rounded-full"
                                  style={{
                                    backgroundColor: tokenPricePercentage !== null && Math.abs(Math.abs(tokenPricePercentage) - 2) < 0.1 && (invertPriceDisplay ? tokenPricePercentage < 0 : tokenPricePercentage > 0) ? `${accentColor}33` : 'rgba(0,0,0,0.4)',
                                    color: tokenPricePercentage !== null && Math.abs(Math.abs(tokenPricePercentage) - 2) < 0.1 && (invertPriceDisplay ? tokenPricePercentage < 0 : tokenPricePercentage > 0) ? 'white' : accentColor,
                                    border: `1px solid ${accentColor}40`
                                  }}
                                >
                                  {invertPriceDisplay ? '-2%' : '+2%'} {invertPriceDisplay ? '↓' : '↑'}
                                </button>
                                <button
                                  onClick={() => handleIndividualPercentageClick(index, 5, invertPriceDisplay ? 'below' : 'above')}
                                  className="flex-1 py-2 text-xs transition-all font-medium rounded-full"
                                  style={{
                                    backgroundColor: tokenPricePercentage !== null && Math.abs(Math.abs(tokenPricePercentage) - 5) < 0.1 && (invertPriceDisplay ? tokenPricePercentage < 0 : tokenPricePercentage > 0) ? `${accentColor}33` : 'rgba(0,0,0,0.4)',
                                    color: tokenPricePercentage !== null && Math.abs(Math.abs(tokenPricePercentage) - 5) < 0.1 && (invertPriceDisplay ? tokenPricePercentage < 0 : tokenPricePercentage > 0) ? 'white' : accentColor,
                                    border: `1px solid ${accentColor}40`
                                  }}
                                >
                                  {invertPriceDisplay ? '-5%' : '+5%'} {invertPriceDisplay ? '↓' : '↑'}
                                </button>
                                {(() => {
                                  // Check if current percentage is a custom value (not a preset button)
                                  const presetValues = [0, 1, 2, 5];
                                  const isCustomActive = tokenPricePercentage !== null &&
                                    !presetValues.some(p => Math.abs(Math.abs(tokenPricePercentage) - p) < 0.1) &&
                                    (invertPriceDisplay ? tokenPricePercentage < 0 : tokenPricePercentage > 0);
                                  const isWholeNumber = (n: number) => Math.abs(n - Math.round(n)) < 0.01;
                                  // Format: show sign, absolute value, no .0 suffix, includes %
                                  const formatPct = (n: number) => {
                                    const sign = n < 0 ? '-' : '+';
                                    const absVal = isWholeNumber(n) ? String(Math.round(Math.abs(n))) : Math.abs(n).toFixed(1).replace(/\.0$/, '');
                                    return sign + absVal + '%';
                                  };
                                  // Cap display at ±999% to prevent UI overflow
                                  const cappedPct = tokenPricePercentage !== null ? Math.max(-999, Math.min(999, tokenPricePercentage)) : 0;
                                  const displayValue = isCustomActive ? formatPct(cappedPct) : '';

                                  return (
                                    <div className="flex-1 relative">
                                      <input
                                        key={isCustomActive ? `active-${displayValue}` : 'inactive'}
                                        type="text"
                                        inputMode="decimal"
                                        defaultValue={displayValue}
                                        maxLength={7}
                                        className="peer w-full py-2 px-2 text-xs font-medium rounded-full text-center focus:outline-none"
                                        style={{
                                          backgroundColor: isCustomActive ? `${accentColor}33` : 'rgba(0,0,0,0.4)',
                                          color: isCustomActive ? 'white' : accentColor,
                                          border: `1px solid ${isCustomActive ? accentColor : accentColor + '40'}`,
                                        }}
                                        onFocus={(e) => {
                                          e.target.style.backgroundColor = `${accentColor}33`;
                                          e.target.style.borderColor = accentColor;
                                          e.target.style.color = 'white';
                                          // Store original value to restore if nothing typed
                                          e.target.dataset.originalValue = e.target.value;
                                          // When focused, show the sign prefix for the direction
                                          e.target.value = invertPriceDisplay ? '-' : '+';
                                          // Move cursor to end (after the sign)
                                          setTimeout(() => {
                                            e.target.setSelectionRange(1, 1);
                                          }, 0);
                                        }}
                                        onSelect={(e) => {
                                          // Prevent cursor from being placed before the sign
                                          const input = e.target as HTMLInputElement;
                                          if (input.selectionStart !== null && input.selectionStart < 1) {
                                            e.preventDefault();
                                            input.setSelectionRange(1, Math.max(1, input.selectionEnd || 1));
                                          }
                                        }}
                                        onMouseUp={(e) => {
                                          // Block cursor placement before sign on click
                                          const input = e.target as HTMLInputElement;
                                          requestAnimationFrame(() => {
                                            if (input.selectionStart !== null && input.selectionStart < 1) {
                                              input.setSelectionRange(1, Math.max(1, input.selectionEnd || 1));
                                            }
                                          });
                                        }}
                                        onKeyDown={(e) => {
                                          // Block arrow keys and home from moving cursor before sign
                                          const input = e.target as HTMLInputElement;
                                          if (e.key === 'ArrowLeft' || e.key === 'Home') {
                                            if (input.selectionStart !== null && input.selectionStart <= 1) {
                                              e.preventDefault();
                                            }
                                          }
                                          if (e.key === 'Enter') {
                                            const val = input.value;
                                            const isNegative = val.startsWith('-');
                                            const numStr = val.replace(/[^0-9.]/g, '');
                                            const value = parseFloat(numStr);
                                            if (!isNaN(value) && value !== 0) {
                                              const capped = Math.min(999, value);
                                              handleIndividualPercentageClick(index, capped, isNegative ? 'below' : 'above');
                                              input.blur();
                                            }
                                          }
                                        }}
                                        onInput={(e) => {
                                          const input = e.target as HTMLInputElement;
                                          const prevValue = input.dataset.prevValue || '';
                                          // Keep the sign at the start, only allow digits and one decimal point after
                                          let val = input.value;
                                          const sign = val.startsWith('-') ? '-' : (val.startsWith('+') ? '+' : (invertPriceDisplay ? '-' : '+'));
                                          let cleaned = val.replace(/[^0-9.]/g, '');
                                          // Only one decimal point
                                          const parts = cleaned.split('.');
                                          if (parts.length > 2) cleaned = parts[0] + '.' + parts.slice(1).join('');
                                          // Block if would exceed 999
                                          const num = parseFloat(cleaned);
                                          if (!isNaN(num) && num > 999) {
                                            cleaned = prevValue.replace(/[^0-9.]/g, ''); // Revert to previous value
                                          }
                                          input.value = sign + cleaned;
                                          input.dataset.prevValue = input.value;
                                        }}
                                        onBlur={(e) => {
                                          const val = e.target.value;
                                          const isNegative = val.startsWith('-');
                                          const numStr = val.replace(/[^0-9.%]/g, '');
                                          const value = parseFloat(numStr);
                                          if (!isNaN(value) && value !== 0) {
                                            const capped = Math.min(999, value);
                                            handleIndividualPercentageClick(index, capped, isNegative ? 'below' : 'above');
                                            // Show value with % sign
                                            e.target.value = (isNegative ? '-' : '+') + capped + '%';
                                          } else if (e.target.dataset.originalValue) {
                                            // Restore original value if nothing was typed
                                            e.target.value = e.target.dataset.originalValue;
                                          }
                                          // Reset styles if not active
                                          if (!isCustomActive) {
                                            e.target.style.backgroundColor = 'rgba(0,0,0,0.4)';
                                            e.target.style.borderColor = `${accentColor}40`;
                                            e.target.style.color = accentColor;
                                          }
                                        }}
                                      />
                                      {/* Placeholder ? when no custom value is active */}
                                      {!isCustomActive && (
                                        <span className="absolute inset-0 flex items-center justify-center text-xs font-medium pointer-events-none peer-focus:hidden" style={{ color: `${accentColor}99` }}>
                                          ?%
                                        </span>
                                      )}
                                    </div>
                                  );
                                })()}
                              </div>
                            ) : (
                              <div className="mt-3 text-center text-xs text-white/40 py-2">
                                No market price data available - enter price manually
                              </div>
                            )
                          )}
                        </div>
                      );
                    })()
                  ) : null
                )}

              </div>
              )
            ))
            )}
          </div>

          {/* Duplicate token error */}
          {duplicateTokenError && (
            <div className="mt-3 p-2 bg-red-900/20 border border-red-500/30 rounded">
              <p className="text-red-400 text-xs">⚠️ {duplicateTokenError}</p>
            </div>
          )}

          {/* Advanced Options */}
          <div className="border-t border-white/10 mt-4 pt-3">
            <button
              type="button"
              onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
              className="flex items-center gap-2 text-white/60 hover:text-white/80 transition-colors text-sm"
            >
              <span>Advanced Options</span>
              <svg
                className={`w-4 h-4 transition-transform duration-200 ${showAdvancedOptions ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
            </button>

            {showAdvancedOptions && (
              <div className="mt-3 space-y-3">
                {/* Accept Multiple Tokens Toggle */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex flex-col min-w-0">
                    <span className="text-white/70 text-sm">Accept multiple buy tokens</span>
                    <span className="text-white/40 text-xs">Allow buyers to pay with different tokens</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const newValue = !acceptMultipleTokens;
                      setAcceptMultipleTokens(newValue);
                      // If turning off, remove all extra buy tokens (keep only the first one)
                      if (!newValue && buyTokens.length > 1) {
                        setBuyTokens([buyTokens[0]]);
                        setBuyAmounts([buyAmounts[0]]);
                        setIndividualLimitPrices([individualLimitPrices[0]]);
                      }
                    }}
                    className={`relative w-11 h-6 flex-shrink-0 rounded-full transition-colors duration-200 ${
                      acceptMultipleTokens ? 'bg-green-500' : 'bg-white/20'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform duration-200 ${
                        acceptMultipleTokens ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Show More Tokens Toggle */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex flex-col min-w-0">
                    <span className="text-white/70 text-sm">Show more tokens</span>
                    <span className="text-white/40 text-xs">Display more sell tokens & enable custom tokens</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowMoreTokens(!showMoreTokens)}
                    className={`relative w-11 h-6 flex-shrink-0 rounded-full transition-colors duration-200 ${
                      showMoreTokens ? 'bg-green-500' : 'bg-white/20'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform duration-200 ${
                        showMoreTokens ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Maxi Stats Toggle */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex flex-col min-w-0">
                    <span className="text-white/70 text-sm">Maxi stats</span>
                    <span className="text-white/40 text-xs">Show pro stats and backing data for MAXI tokens</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMaxiStats(!maxiStats)}
                    className={`relative w-11 h-6 flex-shrink-0 rounded-full transition-colors duration-200 ${
                      maxiStats ? 'bg-green-500' : 'bg-white/20'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform duration-200 ${
                        maxiStats ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>
            )}
          </div>
        </LiquidGlassCard>

        {/* Add another token button - show when acceptMultipleTokens is enabled */}
        {acceptMultipleTokens && buyAmounts[buyTokens.length - 1] && buyAmounts[buyTokens.length - 1].trim() !== '' && (
          <>
            {buyTokens.length < 10 ? (
              <button
                onClick={() => {
                  // If prices are linked, unlink them first before adding a new token
                  if (pricesBound) {
                    setPricesBound(false);
                    // Clear selected basket since we're going to individual token mode
                    setSelectedBasket(null);
                  }
                  handleAddBuyToken();
                }}
                className="mb-4 w-full py-2.5 bg-white/5 border border-white/20 hover:border-white/40 hover:bg-white/10 transition-all flex items-center justify-center space-x-2 rounded-full"
              >
                <svg className="w-5 h-5 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span className="text-white/70 text-sm">Add alternative token</span>
              </button>
            ) : (
              <div className="mb-4 w-full py-2 text-center text-gray-500 text-sm">
                Maximum of 10 tokens reached
              </div>
            )}
          </>
        )}

        {/* Expiration */}
        <LiquidGlassCard
          className="mb-4 p-4 bg-white/5 border-white/10 !overflow-visible relative z-10"
          borderRadius="12px"
          shadowIntensity="xs"
          glowIntensity="none"
        >
          <div className="flex items-center justify-between mb-3">
            <label className="text-white text-sm font-semibold">EXPIRATION</label>
            {selectedDate && (
              <span className="text-white/50 text-xs">
                {expirationDays <= 1 ? (
                  // Show UTC time and date for hour-based presets (1 day or less)
                  (() => {
                    const hours = selectedDate.getUTCHours();
                    const minutes = selectedDate.getUTCMinutes();
                    const ampm = hours >= 12 ? 'pm' : 'am';
                    const displayHours = hours % 12 || 12;
                    const displayMinutes = minutes.toString().padStart(2, '0');
                    const month = selectedDate.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
                    return `${displayHours}:${displayMinutes}${ampm} UTC ${selectedDate.getUTCDate()} ${month} ${selectedDate.getUTCFullYear()}`;
                  })()
                ) : (
                  // Show regular date for day-based presets
                  selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                )}
              </span>
            )}
          </div>

          {/* Expiration Preset Buttons */}
          <div className="flex gap-2 w-full">
            <button
              onClick={() => handleExpirationPreset(1 / 24)} // 1 hour = 1/24 day
              className={`flex-1 py-1.5 text-xs text-white transition-all h-[32px] flex items-center justify-center rounded-full border ${Math.abs(expirationDays - (1 / 24)) < 0.0001
                ? 'bg-white/20 text-white border-white/50'
                : 'bg-black/40 text-gray-300 border-white/10 hover:bg-white/10 hover:text-white'
                }`}
            >
              1h
            </button>
            <button
              onClick={() => handleExpirationPreset(0.25)} // 6 hours
              className={`flex-1 py-1.5 text-xs text-white transition-all h-[32px] flex items-center justify-center rounded-full border ${Math.abs(expirationDays - 0.25) < 0.0001
                ? 'bg-white/20 text-white border-white/50'
                : 'bg-black/40 text-gray-300 border-white/10 hover:bg-white/10 hover:text-white'
                }`}
            >
              6h
            </button>
            <button
              onClick={() => handleExpirationPreset(0.5)} // 12 hours
              className={`flex-1 py-1.5 text-xs text-white transition-all h-[32px] flex items-center justify-center rounded-full border ${Math.abs(expirationDays - 0.5) < 0.0001
                ? 'bg-white/20 text-white border-white/50'
                : 'bg-black/40 text-gray-300 border-white/10 hover:bg-white/10 hover:text-white'
                }`}
            >
              12h
            </button>
            <button
              onClick={() => handleExpirationPreset(1)} // 24 hours
              className={`flex-1 py-1.5 text-xs text-white transition-all h-[32px] flex items-center justify-center rounded-full border ${Math.abs(expirationDays - 1) < 0.0001
                ? 'bg-white/20 text-white border-white/50'
                : 'bg-black/40 text-gray-300 border-white/10 hover:bg-white/10 hover:text-white'
                }`}
            >
              24h
            </button>
            <button
              onClick={() => handleExpirationPreset(7)}
              className={`flex-1 py-1.5 text-xs text-white transition-all h-[32px] flex items-center justify-center rounded-full border ${Math.abs(expirationDays - 7) < 0.0001
                ? 'bg-white/20 text-white border-white/50'
                : 'bg-black/40 text-gray-300 border-white/10 hover:bg-white/10 hover:text-white'
                }`}
            >
              7d
            </button>
            <button
              onClick={() => handleExpirationPreset(30)}
              className={`flex-1 py-1.5 text-xs text-white transition-all h-[32px] flex items-center justify-center rounded-full border ${Math.abs(expirationDays - 30) < 0.0001
                ? 'bg-white/20 text-white border-white/50'
                : 'bg-black/40 text-gray-300 border-white/10 hover:bg-white/10 hover:text-white'
                }`}
            >
              30d
            </button>
            <button
              onClick={() => handleExpirationPreset(90)}
              className={`flex-1 py-1.5 text-xs text-white transition-all h-[32px] flex items-center justify-center rounded-full border ${Math.abs(expirationDays - 90) < 0.0001
                ? 'bg-white/20 text-white border-white/50'
                : 'bg-black/40 text-gray-300 border-white/10 hover:bg-white/10 hover:text-white'
                }`}
            >
              90d
            </button>

            {/* Calendar Date Picker Button */}
            <div ref={datePickerRef} className="relative date-picker-container flex-1">
              <button
                onClick={() => {
                  const opening = !showDatePicker;
                  setShowDatePicker(opening);
                  // Default to today + 10 minutes when opening if no date selected
                  if (opening && !selectedDate) {
                    const defaultDate = new Date(Date.now() + 10 * 60 * 1000);
                    setSelectedDate(defaultDate);
                  }
                }}
                className="w-full py-1.5 text-xs bg-black/40 text-white border border-white/10 hover:bg-white/10 hover:border-white/30 transition-all h-[32px] flex items-center justify-center rounded-full"
                title="Select specific date"
              >
                <CalendarIcon className="w-3 h-3" />
              </button>

              {/* Calendar Popup - positioned absolutely like dropdowns */}
              {showDatePicker && (
                <div
                  className="absolute top-full right-0 mt-2 w-[340px] bg-black border border-white/30 rounded-lg shadow-xl overflow-hidden animate-in fade-in duration-150 z-[100]"
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={handleDateSelect}
                    captionLayout="dropdown"
                    defaultMonth={selectedDate || new Date()}
                    disabled={(date: Date) => {
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      return date < today;
                    }}
                  />
                  <div className="px-3 pb-3 border-t border-white/10 pt-3">
                    <label className="text-white/60 text-xs mb-2 block">Time (UTC)</label>
                    <input
                      type="time"
                      step="1"
                      value={selectedDate ? `${String(selectedDate.getHours()).padStart(2, '0')}:${String(selectedDate.getMinutes()).padStart(2, '0')}:${String(selectedDate.getSeconds()).padStart(2, '0')}` : ''}
                      onChange={handleTimeChange}
                      className="w-full bg-black text-white border border-white/20 rounded-md px-3 py-2 text-sm appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none focus:outline-none focus:border-white/50 selection:bg-white/30 selection:text-white [&::-webkit-datetime-edit-hour-field:focus]:bg-white/30 [&::-webkit-datetime-edit-minute-field:focus]:bg-white/30 [&::-webkit-datetime-edit-second-field:focus]:bg-white/30 [&::-webkit-datetime-edit-hour-field:focus]:text-white [&::-webkit-datetime-edit-minute-field:focus]:text-white [&::-webkit-datetime-edit-second-field:focus]:text-white"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </LiquidGlassCard>


        {/* Pro Plan - Moved to render outside showConfirmation ternary - see below */}
        {false && (
          proStatsContainerRef?.current ? createPortal(
            <LiquidGlassCard
              className="p-4 bg-white/5 border-white/10"
              borderRadius="12px"
              shadowIntensity="xs"
              glowIntensity="none"
            >
              <h3 className="text-[#FF0080]/90 text-sm font-semibold mb-4 text-left">PRO PLAN STATS</h3>

              {/* Content with conditional blur */}
              <div className={(PAYWALL_ENABLED && !hasTokenAccess) ? 'blur-md select-none pointer-events-none' : ''}>
                {statsLoading && hasTokenAccess ? (
                  <div className="text-white/60 text-center py-4">Loading token stats...</div>
                ) : statsError && hasTokenAccess ? (
                  <div className="text-red-400 text-center py-4">
                    <div className="font-semibold mb-2">Failed to load token stats</div>
                    <div className="text-xs text-red-300">{statsError.message || 'Unknown error'}</div>
                  </div>
                ) : (PAYWALL_ENABLED && !hasTokenAccess) ? (
                  // Show placeholder content when no access (for blur effect)
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-white/70">Progress:</span>
                      <span className="text-white">22.5%</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-white/70">Current Market Price:</span>
                      <span className="text-white">1.1433 HEX</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-white/70">Backing per Token:</span>
                      <span className="text-white">2.1977 HEX</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-white/70">Your OTC Price:</span>
                      <span className="text-white">1.0000 HEX</span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Sell Token Stats */}
                    {showSellStats && sellToken && (() => {
                      const tokensWithVersions = ['DECI', 'LUCKY', 'TRIO', 'BASE'];
                      let sellTokenKey: string;

                      if (sellToken.ticker.startsWith('we')) {
                        const baseTicker = sellToken.ticker.slice(2);
                        if (tokensWithVersions.includes(baseTicker)) {
                          sellTokenKey = getHighestTokenVersion(tokenStats, 'e', baseTicker);
                        } else {
                          sellTokenKey = `e${baseTicker}`;
                        }
                      } else if (sellToken.ticker.startsWith('e')) {
                        const baseTicker = sellToken.ticker.slice(1);
                        if (tokensWithVersions.includes(baseTicker)) {
                          sellTokenKey = getHighestTokenVersion(tokenStats, 'e', baseTicker);
                        } else {
                          sellTokenKey = sellToken.ticker;
                        }
                      } else {
                        if (tokensWithVersions.includes(sellToken.ticker)) {
                          sellTokenKey = getHighestTokenVersion(tokenStats, 'p', sellToken.ticker);
                        } else {
                          sellTokenKey = `p${sellToken.ticker}`;
                        }
                      }
                      const sellStats = tokenStats[sellTokenKey];

                      if (!sellStats) return null;

                      const yourPriceInHEX = calculateOtcPriceInHex;
                      const hexDisplayName = (buyTokens[0]?.ticker === 'eHEX' || buyTokens[0]?.ticker === 'weHEX') ? 'eHEX' :
                        (buyTokens[0]?.ticker === 'pHEX') ? 'pHEX' : 'HEX';
                      const isBaseToken = sellToken.ticker === 'BASE' || sellToken.ticker === 'eBASE' ||
                        sellToken.ticker === 'pBASE' || sellToken.ticker === 'weBASE';

                      let yourDiscountFromBacking: number | null = null;
                      let yourDiscountFromMint: number | null = null;

                      if (yourPriceInHEX !== null && sellStats.token.backingPerToken > 0) {
                        yourDiscountFromBacking = (yourPriceInHEX - sellStats.token.backingPerToken) / sellStats.token.backingPerToken;
                      }

                      if (yourPriceInHEX !== null && sellStats.token.priceHEX > 0) {
                        const mintPriceHEX = sellStats.token.priceHEX / (1 + sellStats.token.discountFromMint);
                        yourDiscountFromMint = (yourPriceInHEX - mintPriceHEX) / mintPriceHEX;
                      }

                      return (
                        <div key="sell-stats" className="space-y-2 text-sm">
                          <h4 className="text-white font-medium mb-3 text-left">{formatTokenTicker(sellToken.ticker, chainId)} Stats</h4>
                          <div className="flex justify-between">
                            <span className="text-white/70">Progress:</span>
                            <span className="text-white">{(sellStats.dates.progressPercentage * 100).toFixed(1)}%</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-white/70">Current Market Price:</span>
                            <span className="text-white">{sellStats.token.priceHEX.toFixed(4)} {hexDisplayName}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-white/70">Backing per Token:</span>
                            <span className="text-white">{sellStats.token.backingPerToken.toFixed(4)} {hexDisplayName}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-white/70">Market Discount from Backing:</span>
                            <span className={`font-medium ${sellStats.token.discountFromBacking > 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {(sellStats.token.discountFromBacking * 100).toFixed(2)}%
                            </span>
                          </div>
                          {!isBaseToken && (
                            <div className="flex justify-between">
                              <span className="text-white/70">Market Discount from Mint:</span>
                              <span className={`font-medium ${sellStats.token.discountFromMint > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {(sellStats.token.discountFromMint * 100).toFixed(2)}%
                              </span>
                            </div>
                          )}
                          <div className="border-t border-white/20 my-3"></div>
                          <div className="flex justify-between">
                            <span className="text-white/70">Your OTC Price:</span>
                            <span className="text-white">{yourPriceInHEX ? yourPriceInHEX.toFixed(4) : 'N/A'} {hexDisplayName}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-white/70">Your Discount from Backing:</span>
                            <span className={`font-medium ${yourDiscountFromBacking !== null ? (yourDiscountFromBacking > 0 ? 'text-green-400' : 'text-red-400') : 'text-white/60'}`}>
                              {yourDiscountFromBacking !== null ? (yourDiscountFromBacking * 100).toFixed(2) + '%' : 'N/A'}
                            </span>
                          </div>
                          {!isBaseToken && (
                            <div className="flex justify-between">
                              <span className="text-white/70">Your Discount from Mint:</span>
                              <span className={`font-medium ${yourDiscountFromMint !== null ? (yourDiscountFromMint > 0 ? 'text-green-400' : 'text-red-400') : 'text-white/60'}`}>
                                {yourDiscountFromMint !== null ? (yourDiscountFromMint * 100).toFixed(2) + '%' : 'N/A'}
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* Buy Token Stats */}
                    {buyTokens.map((buyToken, buyIndex) => {
                      if (!buyToken || !shouldShowTokenStats(buyToken)) return null;

                      const tokensWithVersions = ['DECI', 'LUCKY', 'TRIO', 'BASE'];
                      let buyTokenKey: string;

                      if (buyToken.ticker.startsWith('we')) {
                        const baseTicker = buyToken.ticker.slice(2);
                        if (tokensWithVersions.includes(baseTicker)) {
                          buyTokenKey = getHighestTokenVersion(tokenStats, 'e', baseTicker);
                        } else {
                          buyTokenKey = `e${baseTicker}`;
                        }
                      } else if (buyToken.ticker.startsWith('e')) {
                        const baseTicker = buyToken.ticker.slice(1);
                        if (tokensWithVersions.includes(baseTicker)) {
                          buyTokenKey = getHighestTokenVersion(tokenStats, 'e', baseTicker);
                        } else {
                          buyTokenKey = buyToken.ticker;
                        }
                      } else {
                        if (tokensWithVersions.includes(buyToken.ticker)) {
                          buyTokenKey = getHighestTokenVersion(tokenStats, 'p', buyToken.ticker);
                        } else {
                          buyTokenKey = `p${buyToken.ticker}`;
                        }
                      }
                      const buyStats = tokenStats[buyTokenKey];

                      if (!buyStats) return null;

                      const buyAmount = buyAmounts[buyIndex];
                      let yourPriceInHEX: number | null = null;

                      if (sellToken && buyToken && sellAmount && buyAmount &&
                        parseFloat(removeCommas(sellAmount)) > 0 && parseFloat(removeCommas(buyAmount)) > 0) {
                        const isHexVariant = (ticker: string) => {
                          return ticker === 'HEX' || ticker === 'eHEX' || ticker === 'pHEX' || ticker === 'weHEX';
                        };

                        if (isHexVariant(buyToken.ticker)) {
                          yourPriceInHEX = parseFloat(removeCommas(buyAmount)) / parseFloat(removeCommas(sellAmount));
                        } else if (isHexVariant(sellToken.ticker)) {
                          yourPriceInHEX = parseFloat(removeCommas(sellAmount)) / parseFloat(removeCommas(buyAmount));
                        } else {
                          const buyTokenPriceInHex = getTokenPriceInHex(buyToken.a);
                          if (buyTokenPriceInHex) {
                            const buyAmountInHex = parseFloat(removeCommas(buyAmount)) * buyTokenPriceInHex;
                            yourPriceInHEX = buyAmountInHex / parseFloat(removeCommas(sellAmount));
                          }
                        }
                      }

                      const hexDisplayName = sellToken.ticker === 'eHEX' || sellToken.ticker === 'weHEX' ? 'eHEX' :
                        sellToken.ticker === 'pHEX' ? 'pHEX' : 'HEX';
                      const isBaseToken = buyToken.ticker === 'BASE' || buyToken.ticker === 'eBASE' ||
                        buyToken.ticker === 'pBASE' || buyToken.ticker === 'weBASE';

                      let yourDiscountFromBacking: number | null = null;
                      let yourDiscountFromMint: number | null = null;

                      if (yourPriceInHEX !== null && buyStats.token.backingPerToken > 0) {
                        yourDiscountFromBacking = (yourPriceInHEX - buyStats.token.backingPerToken) / buyStats.token.backingPerToken;
                      }

                      if (yourPriceInHEX !== null && buyStats.token.priceHEX > 0) {
                        const mintPriceHEX = buyStats.token.priceHEX / (1 + buyStats.token.discountFromMint);
                        yourDiscountFromMint = (yourPriceInHEX - mintPriceHEX) / mintPriceHEX;
                      }

                      return (
                        <div key={`buy-stats-${buyIndex}`} className="space-y-2 text-sm border-t border-white/20 pt-4 first:border-t-0 first:pt-0">
                          <h4 className="text-white font-medium mb-3 text-left">{formatTokenTicker(buyToken.ticker, chainId)} Stats</h4>
                          <div className="flex justify-between">
                            <span className="text-white/70">Progress:</span>
                            <span className="text-white">{(buyStats.dates.progressPercentage * 100).toFixed(1)}%</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-white/70">Current Market Price:</span>
                            <span className="text-white">{buyStats.token.priceHEX.toFixed(4)} {hexDisplayName}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-white/70">Backing per Token:</span>
                            <span className="text-white">{buyStats.token.backingPerToken.toFixed(4)} {hexDisplayName}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-white/70">Market Discount from Backing:</span>
                            <span className={`font-medium ${buyStats.token.discountFromBacking > 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {(buyStats.token.discountFromBacking * 100).toFixed(2)}%
                            </span>
                          </div>
                          {!isBaseToken && (
                            <>
                              <div className="flex justify-between">
                                <span className="text-white/70">Current Mint Price:</span>
                                <span className="text-white">1 {hexDisplayName}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-white/70">Market Discount from Mint:</span>
                                <span className={`font-medium ${buyStats.token.discountFromMint > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                  {(buyStats.token.discountFromMint * 100).toFixed(2)}%
                                </span>
                              </div>
                            </>
                          )}
                          <div className="border-t border-white/10 my-3"></div>
                          <div className="flex justify-between">
                            <span className="text-white/70">Your OTC Price:</span>
                            <span className="text-white">{yourPriceInHEX ? yourPriceInHEX.toFixed(4) : 'N/A'} {hexDisplayName}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-white/70">Your Discount from Market:</span>
                            <span className={`font-medium ${yourPriceInHEX !== null && buyStats.token.priceHEX > 0 ?
                              ((yourPriceInHEX - buyStats.token.priceHEX) / buyStats.token.priceHEX > 0 ? 'text-green-400' : 'text-red-400') : 'text-white/60'}`}>
                              {yourPriceInHEX !== null && buyStats.token.priceHEX > 0 ?
                                ((yourPriceInHEX - buyStats.token.priceHEX) / buyStats.token.priceHEX * 100).toFixed(2) + '%' : 'N/A'}
                            </span>
                          </div>
                          {!isBaseToken && (
                            <div className="flex justify-between">
                              <span className="text-white/70">Your Discount from Mint:</span>
                              <span className={`font-medium ${yourDiscountFromMint !== null ? (yourDiscountFromMint > 0 ? 'text-green-400' : 'text-red-400') : 'text-white/60'}`}>
                                {yourDiscountFromMint !== null ? (yourDiscountFromMint * 100).toFixed(2) + '%' : 'N/A'}
                              </span>
                            </div>
                          )}
                          <div className="flex justify-between">
                            <span className="text-white/70">Your Discount from Backing:</span>
                            <span className={`font-medium ${yourDiscountFromBacking !== null ? (yourDiscountFromBacking > 0 ? 'text-green-400' : 'text-red-400') : 'text-white/60'}`}>
                              {yourDiscountFromBacking !== null ? (yourDiscountFromBacking * 100).toFixed(2) + '%' : 'N/A'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Paywall Overlay with Lock Button */}
              {(PAYWALL_ENABLED && !hasTokenAccess) && (
                <div
                  className="absolute inset-0 bg-black/40 backdrop-blur-[2px] rounded-xl flex items-center justify-center z-10"
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      setShowPaywallModal(true);
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                    className="flex flex-col items-center space-y-3 p-6 rounded-lg bg-black/60 hover:bg-white/5 transition-all border border-white/10"
                  >
                    <Lock className="w-12 h-12 text-white transition-colors" />
                    <div className="text-center">
                      <p className="text-white font-semibold">Premium Data Access</p>
                      <p className="text-white/70 text-sm">Click to unlock advanced backing data.</p>
                    </div>
                  </button>
                </div>
              )}
            </LiquidGlassCard>,
            proStatsContainerRef.current
          ) : null
          )}

        {/* Below Market Price Warning - Show for each buy token that's below market */}
        {sellToken && (() => {
          const sellUsdPrice = getPrice(sellToken.a);
          if (sellUsdPrice <= 0) return null;

          // Calculate warnings for each buy token
          const warnings = buyTokens.map((buyToken, index) => {
            if (!buyToken) return null;

            const buyUsdPrice = getPrice(buyToken.a);
            if (buyUsdPrice <= 0) return null;

            const marketPrice = sellUsdPrice / buyUsdPrice;
            if (marketPrice <= 0) return null;

            // Get the limit price for this token
            // When unbound, use individualLimitPrices for all tokens
            // When bound, use main limitPrice for first token and derive others
            let tokenLimitPrice: number;
            if (!pricesBound && individualLimitPrices[index] !== undefined) {
              // Unbound mode: each token has its own independent price
              tokenLimitPrice = individualLimitPrices[index]!;
            } else if (index === 0) {
              // Bound mode or unbound with no individual price set: use main limitPrice
              tokenLimitPrice = parseFloat(limitPrice) || 0;
            } else {
              // In bound mode, all tokens share the same percentage
              // So calculate their limit price from the shared percentage
              const baseLimitPrice = parseFloat(limitPrice) || 0;
              const firstBuyToken = buyTokens[0];
              if (firstBuyToken && baseLimitPrice > 0) {
                const firstBuyUsdPrice = getPrice(firstBuyToken.a);
                if (firstBuyUsdPrice > 0) {
                  const firstMarketPrice = sellUsdPrice / firstBuyUsdPrice;
                  const sharedPercentage = ((baseLimitPrice / firstMarketPrice) - 1) * 100;
                  tokenLimitPrice = marketPrice * (1 + sharedPercentage / 100);
                } else {
                  tokenLimitPrice = 0;
                }
              } else {
                tokenLimitPrice = 0;
              }
            }

            if (tokenLimitPrice <= 0) return null;

            // Calculate percentage difference from market
            const tokenPercentage = ((tokenLimitPrice / marketPrice) - 1) * 100;

            // Only show warning if below market by more than 1%
            if (tokenPercentage >= -1) return null;

            return {
              token: buyToken,
              percentage: tokenPercentage
            };
          }).filter(Boolean) as { token: TokenOption; percentage: number }[];

          if (warnings.length === 0) return null;

          // Find the largest discount percentage
          const maxDiscount = Math.max(...warnings.map(w => Math.abs(w.percentage)));

          return (
            <div className="mb-4 p-3 bg-yellow-900/20 border border-yellow-500/30 rounded-lg">
              <div className="flex items-start gap-2">
                <svg className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div className="text-sm">
                  <p className="text-yellow-500 font-medium">Listing Below Estimated Market Price</p>
                  {warnings.length === 1 ? (
                    <p className="text-yellow-400/80 mt-1">
                      Your {formatTokenTicker(sellToken.ticker, chainId)}/{formatTokenTicker(warnings[0].token.ticker, chainId)} limit price is an estimated {Math.abs(warnings[0].percentage).toFixed(1)}% below market. You may be offering {formatTokenTicker(sellToken.ticker, chainId)} at a discount in exchange for quicker order execution. Proceed with caution.
                    </p>
                  ) : (
                    <p className="text-yellow-400/80 mt-1">
                      Your limit prices for {warnings.map(w => formatTokenTicker(w.token.ticker, chainId)).join(', ')} are up to {maxDiscount.toFixed(1)}% below market. You may be offering {formatTokenTicker(sellToken.ticker, chainId)} at a discount in exchange for quicker order execution. Proceed with caution.
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

        {/* Connect/Submit Button */}
        {!isConnected ? (
          <button className="w-full py-4 bg-black text-white border border-white/30 font-bold hover:bg-white hover:text-black transition-all shadow-lg hover:shadow-white/30 text-lg tracking-wider rounded-lg">
            CONNECT WALLET
          </button>
        ) : (
          <button
            onClick={() => setShowConfirmation(true)}
            disabled={!sellToken || !sellAmount || buyTokens.some(t => !t) || buyAmounts.some(a => !a || a.trim() === '') || !!duplicateTokenError || !!expirationError}
            className="w-full py-4 bg-white text-black border border-white font-bold hover:bg-white/80 hover:text-black text-lg tracking-wider disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 rounded-full"
          >
            CREATE LIMIT ORDER
          </button>
        )}
          </>
        )}
      </LiquidGlassCard >

      {/* Pro Plan - Show when maxiStats is enabled (outside showConfirmation ternary so it persists):
          - If user has NO access: always show (blurred) to tease the feature
          - If user HAS access: only show when MAXI tokens are in buy or sell */}
      {maxiStats && (
        // Show if user doesn't have access (blurred teaser) OR if user has access and MAXI tokens are involved
        (PAYWALL_ENABLED && !hasTokenAccess) ||
        (hasTokenAccess && sellToken && buyTokens.length > 0 && buyTokens[0] && (showSellStats || showBuyStats || (isTokenEligibleForStats(sellToken) || buyTokens.some(t => isTokenEligibleForStats(t)))) && !duplicateTokenError &&
          !(MAXI_TOKENS.includes(sellToken.a.toLowerCase()) && buyTokens.every(t => t && MAXI_TOKENS.includes(t.a.toLowerCase()))))
      ) && proStatsContainerRef?.current && createPortal(
        <LiquidGlassCard
          className="p-4 bg-white/5 border-white/10"
          borderRadius="12px"
          shadowIntensity="xs"
          glowIntensity="none"
        >
          <h3 className="text-[#FF0080]/90 text-sm font-semibold mb-4 text-left">PRO PLAN STATS</h3>

          {/* Content with conditional blur */}
          <div className={(PAYWALL_ENABLED && !hasTokenAccess) ? 'blur-md select-none pointer-events-none' : ''}>
            {statsLoading && hasTokenAccess ? (
              <div className="text-white/60 text-center py-4">Loading token stats...</div>
            ) : statsError && hasTokenAccess ? (
              <div className="text-red-400 text-center py-4">
                <div className="font-semibold mb-2">Failed to load token stats</div>
                <div className="text-xs text-red-300">{statsError.message || 'Unknown error'}</div>
              </div>
            ) : (PAYWALL_ENABLED && !hasTokenAccess) ? (
              // Show placeholder content when no access (for blur effect)
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-white/70">Progress:</span>
                  <span className="text-white">22.5%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-white/70">Current Market Price:</span>
                  <span className="text-white">1.1433 HEX</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-white/70">Backing per Token:</span>
                  <span className="text-white">2.1977 HEX</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-white/70">Your OTC Price:</span>
                  <span className="text-white">1.0000 HEX</span>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Sell Token Stats */}
                {showSellStats && sellToken && (() => {
                  const tokensWithVersions = ['DECI', 'LUCKY', 'TRIO', 'BASE'];
                  let sellTokenKey: string;

                  if (sellToken.ticker.startsWith('we')) {
                    const baseTicker = sellToken.ticker.slice(2);
                    if (tokensWithVersions.includes(baseTicker)) {
                      sellTokenKey = getHighestTokenVersion(tokenStats, 'e', baseTicker);
                    } else {
                      sellTokenKey = `e${baseTicker}`;
                    }
                  } else if (sellToken.ticker.startsWith('e')) {
                    const baseTicker = sellToken.ticker.slice(1);
                    if (tokensWithVersions.includes(baseTicker)) {
                      sellTokenKey = getHighestTokenVersion(tokenStats, 'e', baseTicker);
                    } else {
                      sellTokenKey = sellToken.ticker;
                    }
                  } else {
                    if (tokensWithVersions.includes(sellToken.ticker)) {
                      sellTokenKey = getHighestTokenVersion(tokenStats, 'p', sellToken.ticker);
                    } else {
                      sellTokenKey = `p${sellToken.ticker}`;
                    }
                  }
                  const sellStats = tokenStats[sellTokenKey];

                  if (!sellStats) return null;

                  const yourPriceInHEX = calculateOtcPriceInHex;
                  const hexDisplayName = (buyTokens[0]?.ticker === 'eHEX' || buyTokens[0]?.ticker === 'weHEX') ? 'eHEX' :
                    (buyTokens[0]?.ticker === 'pHEX') ? 'pHEX' : 'HEX';
                  const isBaseToken = sellToken.ticker === 'BASE' || sellToken.ticker === 'eBASE' ||
                    sellToken.ticker === 'pBASE' || sellToken.ticker === 'weBASE';

                  let yourDiscountFromBacking: number | null = null;
                  let yourDiscountFromMint: number | null = null;

                  if (yourPriceInHEX !== null && sellStats.token.backingPerToken > 0) {
                    yourDiscountFromBacking = (yourPriceInHEX - sellStats.token.backingPerToken) / sellStats.token.backingPerToken;
                  }

                  if (yourPriceInHEX !== null && sellStats.token.priceHEX > 0) {
                    const mintPriceHEX = sellStats.token.priceHEX / (1 + sellStats.token.discountFromMint);
                    yourDiscountFromMint = (yourPriceInHEX - mintPriceHEX) / mintPriceHEX;
                  }

                  return (
                    <div key="sell-stats" className="space-y-2 text-sm">
                      <h4 className="text-white font-medium mb-3 text-left">{formatTokenTicker(sellToken.ticker, chainId)} Stats</h4>
                      <div className="flex justify-between">
                        <span className="text-white/70">Progress:</span>
                        <span className="text-white">{(sellStats.dates.progressPercentage * 100).toFixed(1)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-white/70">Current Market Price:</span>
                        <span className="text-white">{sellStats.token.priceHEX.toFixed(4)} {hexDisplayName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-white/70">Backing per Token:</span>
                        <span className="text-white">{sellStats.token.backingPerToken.toFixed(4)} {hexDisplayName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-white/70">Market Discount from Backing:</span>
                        <span className={`font-medium ${sellStats.token.discountFromBacking > 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {(sellStats.token.discountFromBacking * 100).toFixed(2)}%
                        </span>
                      </div>
                      {!isBaseToken && (
                        <div className="flex justify-between">
                          <span className="text-white/70">Market Discount from Mint:</span>
                          <span className={`font-medium ${sellStats.token.discountFromMint > 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {(sellStats.token.discountFromMint * 100).toFixed(2)}%
                          </span>
                        </div>
                      )}
                      <div className="border-t border-white/20 my-3"></div>
                      <div className="flex justify-between">
                        <span className="text-white/70">Your OTC Price:</span>
                        <span className="text-white">{yourPriceInHEX ? yourPriceInHEX.toFixed(4) : 'N/A'} {hexDisplayName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-white/70">Your Discount from Backing:</span>
                        <span className={`font-medium ${yourDiscountFromBacking !== null ? (yourDiscountFromBacking > 0 ? 'text-green-400' : 'text-red-400') : 'text-white/60'}`}>
                          {yourDiscountFromBacking !== null ? (yourDiscountFromBacking * 100).toFixed(2) + '%' : 'N/A'}
                        </span>
                      </div>
                      {!isBaseToken && (
                        <div className="flex justify-between">
                          <span className="text-white/70">Your Discount from Mint:</span>
                          <span className={`font-medium ${yourDiscountFromMint !== null ? (yourDiscountFromMint > 0 ? 'text-green-400' : 'text-red-400') : 'text-white/60'}`}>
                            {yourDiscountFromMint !== null ? (yourDiscountFromMint * 100).toFixed(2) + '%' : 'N/A'}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Buy Token Stats */}
                {buyTokens.map((buyToken, buyIndex) => {
                  if (!buyToken || !shouldShowTokenStats(buyToken)) return null;

                  const tokensWithVersions = ['DECI', 'LUCKY', 'TRIO', 'BASE'];
                  let buyTokenKey: string;

                  if (buyToken.ticker.startsWith('we')) {
                    const baseTicker = buyToken.ticker.slice(2);
                    if (tokensWithVersions.includes(baseTicker)) {
                      buyTokenKey = getHighestTokenVersion(tokenStats, 'e', baseTicker);
                    } else {
                      buyTokenKey = `e${baseTicker}`;
                    }
                  } else if (buyToken.ticker.startsWith('e')) {
                    const baseTicker = buyToken.ticker.slice(1);
                    if (tokensWithVersions.includes(baseTicker)) {
                      buyTokenKey = getHighestTokenVersion(tokenStats, 'e', baseTicker);
                    } else {
                      buyTokenKey = buyToken.ticker;
                    }
                  } else {
                    if (tokensWithVersions.includes(buyToken.ticker)) {
                      buyTokenKey = getHighestTokenVersion(tokenStats, 'p', buyToken.ticker);
                    } else {
                      buyTokenKey = `p${buyToken.ticker}`;
                    }
                  }
                  const buyStats = tokenStats[buyTokenKey];

                  if (!buyStats) return null;

                  const buyAmount = buyAmounts[buyIndex];
                  let yourPriceInHEX: number | null = null;

                  if (sellToken && buyToken && sellAmount && buyAmount &&
                    parseFloat(removeCommas(sellAmount)) > 0 && parseFloat(removeCommas(buyAmount)) > 0) {
                    const isHexVariant = (ticker: string) => {
                      return ticker === 'HEX' || ticker === 'eHEX' || ticker === 'pHEX' || ticker === 'weHEX';
                    };

                    if (isHexVariant(buyToken.ticker)) {
                      yourPriceInHEX = parseFloat(removeCommas(buyAmount)) / parseFloat(removeCommas(sellAmount));
                    } else if (isHexVariant(sellToken.ticker)) {
                      yourPriceInHEX = parseFloat(removeCommas(sellAmount)) / parseFloat(removeCommas(buyAmount));
                    } else {
                      const buyTokenPriceInHex = getTokenPriceInHex(buyToken.a);
                      if (buyTokenPriceInHex) {
                        const buyAmountInHex = parseFloat(removeCommas(buyAmount)) * buyTokenPriceInHex;
                        yourPriceInHEX = buyAmountInHex / parseFloat(removeCommas(sellAmount));
                      }
                    }
                  }

                  const hexDisplayName = sellToken.ticker === 'eHEX' || sellToken.ticker === 'weHEX' ? 'eHEX' :
                    sellToken.ticker === 'pHEX' ? 'pHEX' : 'HEX';
                  const isBaseToken = buyToken.ticker === 'BASE' || buyToken.ticker === 'eBASE' ||
                    buyToken.ticker === 'pBASE' || buyToken.ticker === 'weBASE';

                  let yourDiscountFromBacking: number | null = null;
                  let yourDiscountFromMint: number | null = null;

                  if (yourPriceInHEX !== null && buyStats.token.backingPerToken > 0) {
                    yourDiscountFromBacking = (yourPriceInHEX - buyStats.token.backingPerToken) / buyStats.token.backingPerToken;
                  }

                  if (yourPriceInHEX !== null && buyStats.token.priceHEX > 0) {
                    const mintPriceHEX = buyStats.token.priceHEX / (1 + buyStats.token.discountFromMint);
                    yourDiscountFromMint = (yourPriceInHEX - mintPriceHEX) / mintPriceHEX;
                  }

                  return (
                    <div key={`buy-stats-${buyIndex}`} className="space-y-2 text-sm border-t border-white/20 pt-4 first:border-t-0 first:pt-0">
                      <h4 className="text-white font-medium mb-3 text-left">{formatTokenTicker(buyToken.ticker, chainId)} Stats</h4>
                      <div className="flex justify-between">
                        <span className="text-white/70">Progress:</span>
                        <span className="text-white">{(buyStats.dates.progressPercentage * 100).toFixed(1)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-white/70">Current Market Price:</span>
                        <span className="text-white">{buyStats.token.priceHEX.toFixed(4)} {hexDisplayName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-white/70">Backing per Token:</span>
                        <span className="text-white">{buyStats.token.backingPerToken.toFixed(4)} {hexDisplayName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-white/70">Market Discount from Backing:</span>
                        <span className={`font-medium ${buyStats.token.discountFromBacking > 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {(buyStats.token.discountFromBacking * 100).toFixed(2)}%
                        </span>
                      </div>
                      {!isBaseToken && (
                        <>
                          <div className="flex justify-between">
                            <span className="text-white/70">Current Mint Price:</span>
                            <span className="text-white">1 {hexDisplayName}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-white/70">Market Discount from Mint:</span>
                            <span className={`font-medium ${buyStats.token.discountFromMint > 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {(buyStats.token.discountFromMint * 100).toFixed(2)}%
                            </span>
                          </div>
                        </>
                      )}
                      <div className="border-t border-white/10 my-3"></div>
                      <div className="flex justify-between">
                        <span className="text-white/70">Your OTC Price:</span>
                        <span className="text-white">{yourPriceInHEX ? yourPriceInHEX.toFixed(4) : 'N/A'} {hexDisplayName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-white/70">Your Discount from Market:</span>
                        <span className={`font-medium ${yourPriceInHEX !== null && buyStats.token.priceHEX > 0 ?
                          ((yourPriceInHEX - buyStats.token.priceHEX) / buyStats.token.priceHEX > 0 ? 'text-green-400' : 'text-red-400') : 'text-white/60'}`}>
                          {yourPriceInHEX !== null && buyStats.token.priceHEX > 0 ?
                            ((yourPriceInHEX - buyStats.token.priceHEX) / buyStats.token.priceHEX * 100).toFixed(2) + '%' : 'N/A'}
                        </span>
                      </div>
                      {!isBaseToken && (
                        <div className="flex justify-between">
                          <span className="text-white/70">Your Discount from Mint:</span>
                          <span className={`font-medium ${yourDiscountFromMint !== null ? (yourDiscountFromMint > 0 ? 'text-green-400' : 'text-red-400') : 'text-white/60'}`}>
                            {yourDiscountFromMint !== null ? (yourDiscountFromMint * 100).toFixed(2) + '%' : 'N/A'}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-white/70">Your Discount from Backing:</span>
                        <span className={`font-medium ${yourDiscountFromBacking !== null ? (yourDiscountFromBacking > 0 ? 'text-green-400' : 'text-red-400') : 'text-white/60'}`}>
                          {yourDiscountFromBacking !== null ? (yourDiscountFromBacking * 100).toFixed(2) + '%' : 'N/A'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Paywall Overlay with Lock Button */}
          {(PAYWALL_ENABLED && !hasTokenAccess) && (
            <div
              className="absolute inset-0 bg-black/40 backdrop-blur-[2px] rounded-xl flex items-center justify-center z-10"
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  setShowPaywallModal(true);
                }}
                onPointerDown={(e) => e.stopPropagation()}
                className="flex flex-col items-center space-y-3 p-6 rounded-lg bg-black/60 hover:bg-white/5 transition-all border border-white/10"
              >
                <Lock className="w-12 h-12 text-white transition-colors" />
                <div className="text-center">
                  <p className="text-white font-semibold">Premium Data Access</p>
                  <p className="text-white/70 text-sm">Click to unlock advanced backing data.</p>
                </div>
              </button>
            </div>
          )}
        </LiquidGlassCard>,
        proStatsContainerRef.current
      )}

      {/* Paywall Modal - Rendered outside form container for full-page overlay */}
      < PaywallModal
        isOpen={showPaywallModal}
        onClose={() => setShowPaywallModal(false)
        }
        title={PAYWALL_TITLE}
        description={PAYWALL_DESCRIPTION}
        price={checkingTokenBalance ? "Checking..." : hasTokenAccess ? "Access Granted" : `${REQUIRED_PARTY_TOKENS.toLocaleString()} PARTY or ${REQUIRED_TEAM_TOKENS.toLocaleString()} TEAM`}
        contactUrl="https://x.com/hexgeta"
        partyBalance={partyBalance}
        teamBalance={teamBalance}
        requiredParty={REQUIRED_PARTY_TOKENS}
        requiredTeam={REQUIRED_TEAM_TOKENS}
      />
    </>
  );
}
