'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import NumberFlow from '@number-flow/react';
import { useAccount, useBalance, usePublicClient } from 'wagmi';
import { TOKEN_CONSTANTS } from '@/constants/crypto';
import { useTokenPrices } from '@/hooks/crypto/useTokenPrices';
import { formatEther, parseEther } from 'viem';
import logoManifest from '@/constants/logo-manifest.json';
import { formatTokenTicker, parseTokenAmount, getTokenInfoByIndex, getContractWhitelistIndex } from '@/utils/tokenUtils';
import { getBlockExplorerTxUrl } from '@/utils/blockExplorer';
import { useTokenStats } from '@/hooks/crypto/useTokenStats';
import { useTokenAccess } from '@/context/TokenAccessContext';
import { PAYWALL_ENABLED, REQUIRED_PARTY_TOKENS, REQUIRED_TEAM_TOKENS, PAYWALL_TITLE, PAYWALL_DESCRIPTION } from '@/config/paywall';
import PaywallModal from './PaywallModal';
import { TokenLogo } from '@/components/TokenLogo';
import { Lock, ArrowLeftRight, Calendar as CalendarIcon } from 'lucide-react';
import { PixelSpinner } from './ui/PixelSpinner';
import { Slider } from '@/components/ui/slider';
import { Calendar } from '@/components/ui/calendar';
import { LiquidGlassCard } from '@/components/ui/liquid-glass';
import { isNativeToken, useTokenApproval } from '@/utils/tokenApproval';
import { useContractWhitelist } from '@/hooks/contracts/useContractWhitelist';
import { useContractWhitelistRead } from '@/hooks/contracts/useContractWhitelistRead';
import { waitForTransactionWithTimeout, TRANSACTION_TIMEOUTS } from '@/utils/transactionTimeout';
import useToast from '@/hooks/use-toast';

interface LimitOrderFormProps {
  onTokenChange?: (sellToken: string | undefined, buyTokens: (string | undefined)[]) => void;
  onLimitPriceChange?: (price: number | undefined) => void;
  onInvertPriceDisplayChange?: (inverted: boolean) => void;
  onPricesBoundChange?: (bound: boolean) => void;
  onIndividualLimitPricesChange?: (prices: (number | undefined)[]) => void;
  externalLimitPrice?: number;
  externalMarketPrice?: number;
  externalIndividualLimitPrices?: (number | undefined)[];
  isDragging?: boolean;
  onCreateOrderClick?: (sellToken: TokenOption | null, buyTokens: (TokenOption | null)[], sellAmount: string, buyAmounts: string[], expirationDays: number) => void;
  onOrderCreated?: () => void;
}

interface TokenOption {
  a: string;
  ticker: string;
  name: string;
  decimals: number;
}

// Helper to format large numbers with commas
const formatNumberWithCommas = (value: string): string => {
  if (!value) return '';
  const parts = value.split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return parts.join('.');
};

// Helper to remove commas for calculations
const removeCommas = (value: string): string => {
  return value.replace(/,/g, '');
};

// Helper to format balance display
const formatBalanceDisplay = (balance: string): string => {
  const num = parseFloat(balance);
  if (num === 0) return '0';
  if (num < 0.000001) return num.toExponential(2);
  if (num < 1) return num.toFixed(6);
  if (num < 1000) return num.toFixed(4);
  return formatNumberWithCommas(num.toFixed(2));
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

// Helper to format calculated values for state (with commas)
const formatCalculatedValue = (value: number): string => {
  if (value === 0) return '';

  const rounded = Math.round(value * 10000) / 10000;

  let str = rounded.toString();
  if (str.includes('.')) {
    str = str.replace(/\.?0+$/, '');
  }

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
  externalLimitPrice,
  externalMarketPrice,
  externalIndividualLimitPrices,
  isDragging = false,
  onCreateOrderClick,
  onOrderCreated,
}: LimitOrderFormProps) {
  const { isConnected, address, chainId } = useAccount();

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
  const [buyAmounts, setBuyAmounts] = useState<string[]>(['']);
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
  const [expirationError, setExpirationError] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Listing fee state
  const [listingFee, setListingFee] = useState<bigint>(0n);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
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
  const [acceptMultipleTokens, setAcceptMultipleTokens] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('limitOrderAcceptMultipleTokens') === 'true';
    }
    return false;
  });

  // Custom token state for pasted contract addresses (sell only)
  const [customToken, setCustomToken] = useState<TokenOption | null>(null);
  const [isLoadingCustomToken, setIsLoadingCustomToken] = useState(false);
  const [customTokenError, setCustomTokenError] = useState<string | null>(null);

  // Individual limit prices for each buy token (used when pricesBound is false)
  const [individualLimitPrices, setIndividualLimitPrices] = useState<(number | undefined)[]>([]);

  const sellDropdownRef = useRef<HTMLDivElement>(null);
  const buyDropdownRefs = useRef<(HTMLDivElement | null)[]>([]);
  const sellSearchRef = useRef<HTMLInputElement>(null);
  const buySearchRefs = useRef<(HTMLInputElement | null)[]>([]);
  const buyInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const sellInputRef = useRef<HTMLInputElement>(null);
  const datePickerRef = useRef<HTMLDivElement>(null);
  const isInitialLoadRef = useRef<boolean>(true);
  const limitPriceSetByUserRef = useRef<boolean>(false);
  const hasInitializedTokensRef = useRef<boolean>(false);
  const [hasCalculatedInitialBuyAmount, setHasCalculatedInitialBuyAmount] = useState(false);
  const lastEditedInputRef = useRef<'sell' | number | null>(null); // 'sell' or buy index
  const isUpdatingFromOtherInputRef = useRef<boolean>(false);
  const previousSellTokenRef = useRef<TokenOption | null>(null);
  const previousBuyTokenRef = useRef<TokenOption | null>(null);
  const isTokenChangingRef = useRef<boolean>(false);

  // Hooks for contract interaction
  const publicClient = usePublicClient();
  const { toast } = useToast();
  const { placeOrder, contractAddress } = useContractWhitelist();

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

  // Log token counts for debugging
  useEffect(() => {
    if (availableTokens.length > 0) {
      console.log('🔢 Token Counts:', {
        'Contract Whitelist': activeTokens.length,
        'Available after filtering': availableTokens.length
      });
    }
  }, [availableTokens.length, activeTokens.length]);

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
  const filteredSellTokens = sellTokenSource.filter(token => {
    if (!token.a) return false;

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
  }).sort((a, b) => {
    const searchLower = sellSearchQuery.toLowerCase();
    const aLower = a.ticker.toLowerCase();
    const bLower = b.ticker.toLowerCase();
    const aTickerMatches = aLower.includes(searchLower);
    const bTickerMatches = bLower.includes(searchLower);

    // 1. Exact ticker match goes first
    const aExact = aLower === searchLower;
    const bExact = bLower === searchLower;
    if (aExact && !bExact) return -1;
    if (bExact && !aExact) return 1;

    // 2. Tokens with prefix (e, p, st, we) + search term come next (e.g., eHEX, pHEX for "hex")
    const prefixes = ['e', 'p', 'st', 'we'];
    const aIsPrefixed = prefixes.some(prefix => aLower === prefix + searchLower);
    const bIsPrefixed = prefixes.some(prefix => bLower === prefix + searchLower);
    if (aIsPrefixed && !bIsPrefixed) return -1;
    if (bIsPrefixed && !aIsPrefixed) return 1;

    // 3. Ticker contains search term comes before name-only matches
    if (aTickerMatches && !bTickerMatches) return -1;
    if (bTickerMatches && !aTickerMatches) return 1;

    // 4. Then alphabetically
    return a.ticker.localeCompare(b.ticker);
  });

  const getFilteredBuyTokens = (index: number) => {
    const searchQuery = buySearchQueries[index] || '';
    return availableTokens.filter(token => {
      if (!token.a) return false;

      // Tokens are already filtered to be in whitelist via availableTokens

      // Exclude if it's the sell token
      if (sellToken && sellToken.a && token.a.toLowerCase() === sellToken.a.toLowerCase()) {
        return false;
      }

      // Exclude if it's already selected in another buy token slot
      const isSelectedInOtherBuySlot = buyTokens.some((buyToken, idx) =>
        idx !== index && buyToken && buyToken.a && token.a && buyToken.a.toLowerCase() === token.a.toLowerCase()
      );
      if (isSelectedInOtherBuySlot) return false;

      // Apply search filter (including address search)
      const searchLower = searchQuery.toLowerCase();
      return token.ticker.toLowerCase().includes(searchLower) ||
        token.name.toLowerCase().includes(searchLower) ||
        (token.a && token.a.toLowerCase().includes(searchLower));
    }).sort((a, b) => {
      const searchLower = searchQuery.toLowerCase();
      const aLower = a.ticker.toLowerCase();
      const bLower = b.ticker.toLowerCase();
      const aTickerMatches = aLower.includes(searchLower);
      const bTickerMatches = bLower.includes(searchLower);

      // 1. Exact ticker match goes first
      const aExact = aLower === searchLower;
      const bExact = bLower === searchLower;
      if (aExact && !bExact) return -1;
      if (bExact && !aExact) return 1;

      // 2. Tokens with prefix (e, p, st, we) + search term come next (e.g., eHEX, pHEX for "hex")
      const prefixes = ['e', 'p', 'st', 'we'];
      const aIsPrefixed = prefixes.some(prefix => aLower === prefix + searchLower);
      const bIsPrefixed = prefixes.some(prefix => bLower === prefix + searchLower);
      if (aIsPrefixed && !bIsPrefixed) return -1;
      if (bIsPrefixed && !aIsPrefixed) return 1;

      // 3. Ticker contains search term comes before name-only matches
      if (aTickerMatches && !bTickerMatches) return -1;
      if (bTickerMatches && !aTickerMatches) return 1;

      // 4. Then alphabetically
      return a.ticker.localeCompare(b.ticker);
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

  const backgroundAddresses = useMemo(() => {
    const addresses = new Set<string>();
    availableTokens.forEach(t => {
      if (t.a && !priorityAddresses.includes(t.a)) {
        addresses.add(t.a);
      }
    });
    return Array.from(addresses);
  }, [availableTokens, priorityAddresses]);

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

  // Helper to get price with case-insensitive lookup
  const getPrice = (address: string | undefined) => {
    if (!address) return 0;
    // Try exact match first
    const data = prices[address];
    if (data && data.price !== undefined) return data.price;

    // Fallback to case-insensitive
    const lowerAddr = address.toLowerCase();
    const entry = Object.entries(prices).find(([addr]) => addr.toLowerCase() === lowerAddr);
    return entry ? entry[1].price : 0;
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

    // Handle sell token
    if (savedSellToken) {
      // First, check if it's in availableTokens (regular tokens)
      const token = availableTokens.find(t => t.a?.toLowerCase() === savedSellToken.toLowerCase());
      if (token && token.a) {
        setSellToken({ a: token.a, ticker: token.ticker, name: token.name, decimals: token.decimals });
      } else if (savedCustomSellToken) {
        // Not in available tokens, check if we have a saved custom token object
        try {
          const customTokenData = JSON.parse(savedCustomSellToken) as TokenOption;
          if (customTokenData.a && customTokenData.ticker && customTokenData.name && customTokenData.decimals !== undefined) {
            setSellToken(customTokenData);
          }
        } catch { /* ignore parse errors */ }
      }
    } else if (!sellToken || !sellToken.a) {
      // Set default sell token (PLS) only if no token is selected
      const defaultSell = availableTokens.find(t => t.a?.toLowerCase() === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee');
      if (defaultSell && defaultSell.a) {
        setSellToken({ a: defaultSell.a, ticker: defaultSell.ticker, name: defaultSell.name, decimals: defaultSell.decimals });
        localStorage.setItem('limitOrderSellToken', defaultSell.a);
      }
    }

    // Handle buy tokens (support multiple)
    if (savedBuyTokens) {
      try {
        const tokenAddresses = JSON.parse(savedBuyTokens) as string[];
        const loadedTokens = tokenAddresses
          .map(addr => availableTokens.find(t => t.a?.toLowerCase() === addr.toLowerCase()))
          .filter(t => t && t.a)
          .map(t => ({ a: t!.a, ticker: t!.ticker, name: t!.name, decimals: t!.decimals }));
        if (loadedTokens.length > 0) {
          setBuyTokens(loadedTokens as (TokenOption | null)[]);
          // Don't restore buy amounts - let them recalculate based on fresh prices
          setBuyAmounts(Array(loadedTokens.length).fill(''));
        }
      } catch { /* ignore parse errors */ }
    } else if (savedBuyToken) {
      // Legacy: single buy token
      const token = availableTokens.find(t => t.a?.toLowerCase() === savedBuyToken.toLowerCase());
      if (token && token.a) {
        setBuyTokens([{ a: token.a, ticker: token.ticker, name: token.name, decimals: token.decimals }]);
      }
    } else if (!buyTokens[0] || !buyTokens[0].a) {
      // Set default buy token (HEX) only if no token is selected
      const defaultBuy = availableTokens.find(t => t.a?.toLowerCase() === '0x2b591e99afe9f32eaa6214f7b7629768c40eeb39');
      if (defaultBuy && defaultBuy.a) {
        setBuyTokens([{ a: defaultBuy.a, ticker: defaultBuy.ticker, name: defaultBuy.name, decimals: defaultBuy.decimals }]);
        localStorage.setItem('limitOrderBuyToken', defaultBuy.a);
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
  useEffect(() => {
    // Only run once after tokens are initialized and we have the required data
    if (hasCalculatedInitialBuyAmount) return;
    if (!hasInitializedTokensRef.current) return;
    if (!sellAmount || !limitPrice) return;

    const sellAmt = parseFloat(removeCommas(sellAmount));
    const limitPriceNum = parseFloat(limitPrice);

    if (sellAmt > 0 && limitPriceNum > 0) {
      const newBuyAmount = sellAmt * limitPriceNum;
      const newAmounts = [...buyAmounts];
      newAmounts[0] = formatCalculatedValue(newBuyAmount);
      setBuyAmounts(newAmounts);
      setHasCalculatedInitialBuyAmount(true);
    }
  }, [sellAmount, limitPrice, hasCalculatedInitialBuyAmount]);

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
  useEffect(() => {
    if (!pricesBound && buyTokens.length > 0) {
      const wasBound = prevPricesBoundRef.current;
      const prevLength = prevBuyTokensLengthRef.current;
      const tokenCountIncreased = buyTokens.length > prevLength;

      const sellTokenUsdPrice = sellToken ? getPrice(sellToken.a) : 0;
      const limitPriceNum = parseFloat(limitPrice) || 0;

      // Only proceed if we have valid prices
      if (limitPriceNum > 0) {
        // Case 1: Just switched from bound to unbound - initialize all prices
        if (wasBound) {
          const newIndividualPrices: (number | undefined)[] = buyTokens.map((token, index) => {
            if (!token) return undefined;

            // First token always uses the main limit price
            if (index === 0) {
              return limitPriceNum;
            }

            // For additional tokens, calculate based on USD if possible
            const firstBuyTokenUsdPrice = buyTokens[0] ? getPrice(buyTokens[0].a) : 0;
            const tokenUsdPrice = getPrice(token.a);

            if (sellTokenUsdPrice > 0 && firstBuyTokenUsdPrice > 0 && tokenUsdPrice > 0) {
              const marketPriceForFirst = sellTokenUsdPrice / firstBuyTokenUsdPrice;
              const premiumMultiplier = limitPriceNum / marketPriceForFirst;
              const marketPriceForThis = sellTokenUsdPrice / tokenUsdPrice;
              return marketPriceForThis * premiumMultiplier;
            }

            // Fallback: use the same limit price as first token (will be different units but at least visible)
            return limitPriceNum;
          });

          setIndividualLimitPrices(newIndividualPrices);
          if (onIndividualLimitPricesChange) {
            onIndividualLimitPricesChange(newIndividualPrices);
          }
        }
        // Case 2: New token added while already unbound - only initialize the new token at market price
        else if (tokenCountIncreased) {
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
            if (onIndividualLimitPricesChange) {
              onIndividualLimitPricesChange(newPrices);
            }
            return newPrices;
          });
        }
        // Case 3: Already unbound but individualLimitPrices is empty (e.g., page reload with unbound state)
        else if (individualLimitPrices.length === 0 || individualLimitPrices.every(p => p === undefined)) {
          const newIndividualPrices: (number | undefined)[] = buyTokens.map((token, index) => {
            if (!token) return undefined;

            // First token uses the main limit price
            if (index === 0) {
              return limitPriceNum;
            }

            // For additional tokens, calculate based on USD if possible
            const firstBuyTokenUsdPrice = buyTokens[0] ? getPrice(buyTokens[0].a) : 0;
            const tokenUsdPrice = getPrice(token.a);

            if (sellTokenUsdPrice > 0 && firstBuyTokenUsdPrice > 0 && tokenUsdPrice > 0) {
              const marketPriceForFirst = sellTokenUsdPrice / firstBuyTokenUsdPrice;
              const premiumMultiplier = limitPriceNum / marketPriceForFirst;
              const marketPriceForThis = sellTokenUsdPrice / tokenUsdPrice;
              return marketPriceForThis * premiumMultiplier;
            }

            return limitPriceNum;
          });

          setIndividualLimitPrices(newIndividualPrices);
          if (onIndividualLimitPricesChange) {
            onIndividualLimitPricesChange(newIndividualPrices);
          }
        }
      }
    }

    // Update refs for next render
    prevPricesBoundRef.current = pricesBound;
    prevBuyTokensLengthRef.current = buyTokens.length;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pricesBound, buyTokens.length, priorityPrices, sellToken?.a, individualLimitPrices.length]);

  // Recalculate percentage when invert display changes
  useEffect(() => {
    const sellTokenPrice = sellToken ? prices[sellToken.a]?.price || 0 : 0;
    const buyToken = buyTokens[0];
    const buyTokenPrice = buyToken ? prices[buyToken.a]?.price || 0 : 0;
    const internalMarketPrice = sellTokenPrice && buyTokenPrice ? sellTokenPrice / buyTokenPrice : 0;
    const marketPrice = externalMarketPrice || internalMarketPrice;

    if (limitPrice && marketPrice > 0 && limitPriceSetByUserRef.current) {
      const limitPriceNum = parseFloat(limitPrice);
      let percentageAboveMarket;
      if (invertPriceDisplay) {
        const invertedLimitPrice = 1 / limitPriceNum;
        const invertedMarketPrice = 1 / marketPrice;
        percentageAboveMarket = ((invertedLimitPrice - invertedMarketPrice) / invertedMarketPrice) * 100;
      } else {
        percentageAboveMarket = ((limitPriceNum - marketPrice) / marketPrice) * 100;
      }
      setPricePercentage(Math.abs(percentageAboveMarket) > 0.01 ? Number(percentageAboveMarket.toFixed(4)) : null);
    }
  }, [invertPriceDisplay, limitPrice, externalMarketPrice, sellToken?.a, firstBuyTokenAddress, prices]);

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
  const internalMarketPrice = sellTokenPrice > 0 && buyTokenPrice > 0 ? sellTokenPrice / buyTokenPrice : 0;
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
      setLimitPrice(marketPrice.toFixed(8));
      limitPriceSetByUserRef.current = true;
      isInitialLoadRef.current = false;

      if (onLimitPriceChange) {
        onLimitPriceChange(marketPrice);
      }
    }
  }, [marketPrice, onLimitPriceChange]);

  // Sync external limit price changes (from chart dragging)
  useEffect(() => {
    if (externalLimitPrice !== undefined) {
      limitPriceSetByUserRef.current = true;
      isInitialLoadRef.current = false;

      setLimitPrice(externalLimitPrice.toString());

      if (sellAmountNum > 0) {
        // Update buy token amounts
        setBuyAmounts((prevAmounts) => {
          const newAmounts = [...prevAmounts];
          // First buy token uses the limit price directly
          if (buyTokens[0]) {
            const newBuyAmount = sellAmountNum * externalLimitPrice;
            newAmounts[0] = formatCalculatedValue(newBuyAmount);
          }

          // Only update additional tokens if prices are BOUND
          // When unlinked, each token has its own independent price
          if (pricesBound) {
            const sellTokenUsdPrice = sellToken ? getPrice(sellToken.a) : 0;
            if (sellTokenUsdPrice > 0) {
              const sellUsdValue = sellAmountNum * sellTokenUsdPrice;
              // Calculate the premium/discount from market for the first token
              const firstBuyTokenUsdPrice = buyTokens[0] ? getPrice(buyTokens[0].a) : 0;
              const marketPriceForFirst = firstBuyTokenUsdPrice > 0 ? sellTokenUsdPrice / firstBuyTokenUsdPrice : 0;
              const premiumMultiplier = marketPriceForFirst > 0 ? externalLimitPrice / marketPriceForFirst : 1;

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
      }

      // Update individual limit price for first token when unbound
      if (!pricesBound) {
        setIndividualLimitPrices(prev => {
          const newPrices = [...prev];
          newPrices[0] = externalLimitPrice;
          if (onIndividualLimitPricesChange) {
            onIndividualLimitPricesChange(newPrices);
          }
          return newPrices;
        });
      }

      if (marketPrice > 0) {
        let percentageAboveMarket;
        if (invertPriceDisplay) {
          const invertedLimitPrice = 1 / externalLimitPrice;
          const invertedMarketPrice = 1 / marketPrice;
          percentageAboveMarket = ((invertedLimitPrice - invertedMarketPrice) / invertedMarketPrice) * 100;
        } else {
          percentageAboveMarket = ((externalLimitPrice - marketPrice) / marketPrice) * 100;
        }
        setPricePercentage(percentageAboveMarket);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalLimitPrice, sellAmountNum, marketPrice, invertPriceDisplay]);

  // Sync external individual limit price changes (from chart dragging individual token lines)
  useEffect(() => {
    if (!externalIndividualLimitPrices) return;
    // Only sync when dragging from chart (isDragging is true)
    if (!isDragging) return;

    isReceivingExternalIndividualPriceRef.current = true;

    // Batch all updates to avoid multiple re-renders
    let hasLimitPriceChanges = false;
    let hasBuyAmountChanges = false;
    const newLimitPrices = [...individualLimitPrices];
    const newBuyAmounts = [...buyAmounts];

    const sellTokenUsdPrice = sellToken ? getPrice(sellToken.a) : 0;

    externalIndividualLimitPrices.forEach((newPrice, index) => {
      if (newPrice === undefined || index === 0) return; // Skip first token (handled by main limit price)

      const token = buyTokens[index];
      if (!token) return;

      // Check if price actually changed
      if (newLimitPrices[index] !== newPrice) {
        newLimitPrices[index] = newPrice;
        hasLimitPriceChanges = true;

        // Calculate new buy amount for this token
        const tokenUsdPrice = getPrice(token.a);
        if (sellTokenUsdPrice > 0 && tokenUsdPrice > 0 && sellAmountNum > 0) {
          const sellUsdValue = sellAmountNum * sellTokenUsdPrice;
          const tokenMarketPrice = sellTokenUsdPrice / tokenUsdPrice;
          const premiumMultiplier = newPrice / tokenMarketPrice;
          const marketAmount = sellUsdValue / tokenUsdPrice;
          const adjustedAmount = marketAmount * premiumMultiplier;
          newBuyAmounts[index] = formatCalculatedValue(adjustedAmount);
          hasBuyAmountChanges = true;
        }
      }
    });

    // Apply batched updates
    if (hasLimitPriceChanges) {
      setIndividualLimitPrices(newLimitPrices);
    }
    if (hasBuyAmountChanges) {
      setBuyAmounts(newBuyAmounts);
    }

    // Reset flag after a short delay
    setTimeout(() => {
      isReceivingExternalIndividualPriceRef.current = false;
    }, 100);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalIndividualLimitPrices, isDragging]);

  // When sell amount changes, update buy amount based on limit price
  useEffect(() => {
    if (limitPriceSetByUserRef.current &&
      lastEditedInputRef.current === 'sell' &&
      !isInitialLoadRef.current &&
      !isUpdatingFromOtherInputRef.current &&
      sellAmountNum > 0) {

      const limitPriceNum = parseFloat(limitPrice);
      if (limitPriceNum > 0) {
        isUpdatingFromOtherInputRef.current = true;
        // Update all buy token amounts based on their respective USD prices
        setBuyAmounts((prevAmounts) => {
          const newAmounts = [...prevAmounts];
          // First buy token uses the limit price directly
          if (buyTokens[0]) {
            const newBuyAmount = sellAmountNum * limitPriceNum;
            newAmounts[0] = formatCalculatedValue(newBuyAmount);
          }
          // Additional buy tokens: calculate based on USD value with same premium
          // Only sync additional tokens if prices are BOUND
          if (pricesBound) {
            const sellTokenUsdPrice = sellToken ? getPrice(sellToken.a) : 0;
            if (sellTokenUsdPrice > 0) {
              const sellUsdValue = sellAmountNum * sellTokenUsdPrice;
              // Calculate the premium/discount from market for the first token
              const firstBuyTokenUsdPrice = buyTokens[0] ? getPrice(buyTokens[0].a) : 0;
              const marketPriceForFirst = firstBuyTokenUsdPrice > 0 ? sellTokenUsdPrice / firstBuyTokenUsdPrice : 0;
              const premiumMultiplier = marketPriceForFirst > 0 ? limitPriceNum / marketPriceForFirst : 1;

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
        isUpdatingFromOtherInputRef.current = false;
      }

      lastEditedInputRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sellAmountNum, limitPrice]);

  // When first buy amount changes, update sell amount based on limit price
  useEffect(() => {
    if (limitPriceSetByUserRef.current &&
      lastEditedInputRef.current === 0 &&
      !isInitialLoadRef.current &&
      !isUpdatingFromOtherInputRef.current &&
      buyAmountNum > 0) {

      const limitPriceNum = parseFloat(limitPrice);
      if (limitPriceNum > 0) {
        isUpdatingFromOtherInputRef.current = true;
        const newSellAmount = buyAmountNum / limitPriceNum;
        setSellAmount(formatCalculatedValue(newSellAmount));
        isUpdatingFromOtherInputRef.current = false;
      }

      lastEditedInputRef.current = null;
    }
  }, [buyAmountNum, limitPrice]);

  // Recalculate additional buy token amounts when prices change or new tokens are added
  // Only applies when prices are BOUND - when unlinked, each token keeps its own price
  useEffect(() => {
    if (buyTokens.length <= 1 || !sellAmount || sellAmountNum <= 0) return;
    // Don't auto-sync prices when unlinked
    if (!pricesBound) return;

    const sellTokenUsdPrice = sellToken ? getPrice(sellToken.a) : 0;
    if (sellTokenUsdPrice <= 0) return;

    const firstBuyTokenUsdPrice = buyTokens[0] ? getPrice(buyTokens[0].a) : 0;
    const limitPriceNum = parseFloat(limitPrice) || 0;
    const marketPriceForFirst = firstBuyTokenUsdPrice > 0 ? sellTokenUsdPrice / firstBuyTokenUsdPrice : 0;
    const premiumMultiplier = marketPriceForFirst > 0 && limitPriceNum > 0 ? limitPriceNum / marketPriceForFirst : 1;
    const sellUsdValue = sellAmountNum * sellTokenUsdPrice;

    let hasUpdates = false;
    const newBuyAmounts = [...buyAmounts];

    for (let i = 1; i < buyTokens.length; i++) {
      const token = buyTokens[i];
      if (!token) continue;

      const tokenUsdPrice = getPrice(token.a);
      // Only auto-calculate if amount is empty/zero and we have valid price
      const currentAmount = buyAmounts[i] ? parseFloat(removeCommas(buyAmounts[i])) : 0;
      if (currentAmount === 0 && tokenUsdPrice > 0) {
        const marketAmount = sellUsdValue / tokenUsdPrice;
        const adjustedAmount = marketAmount * premiumMultiplier;
        newBuyAmounts[i] = formatCalculatedValue(adjustedAmount);
        hasUpdates = true;
      }
    }

    if (hasUpdates) {
      setBuyAmounts(newBuyAmounts);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buyTokens.length, prices, sellAmountNum, limitPrice, pricesBound]);

  const handleCreateOrder = async () => {
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
      const expirationTime = BigInt(Math.floor(Date.now() / 1000) + (expirationDays * 24 * 60 * 60));

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

      // Clear form
      setSellAmount('');
      setBuyAmounts(['']);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('limitOrderSellAmount');
        localStorage.removeItem('limitOrderBuyAmount');
      }

      // Trigger table refresh
      if (onOrderCreated) {
        onOrderCreated();
      }

    } catch (error: any) {


      // Extract detailed error information
      let errorMessage = "Failed to create order. Please try again.";
      let errorDetails = "";

      if (error?.message) {
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

  // Handle token changes and maintain price relationship
  useEffect(() => {
    // Skip on initial load or if we're already in the middle of updating
    if (isInitialLoadRef.current || isTokenChangingRef.current || !limitPriceSetByUserRef.current) {
      // Update refs for next time
      previousSellTokenRef.current = sellToken;
      previousBuyTokenRef.current = buyTokens[0];
      return;
    }

    const previousSellToken = previousSellTokenRef.current;
    const previousBuyToken = previousBuyTokenRef.current;
    const currentBuyToken = buyTokens[0];

    // Check if either sell or buy token changed
    const sellTokenChanged = previousSellToken?.a !== sellToken?.a;
    const buyTokenChanged = previousBuyToken?.a !== currentBuyToken?.a;

    if ((sellTokenChanged || buyTokenChanged) && sellToken && currentBuyToken) {
      isTokenChangingRef.current = true;

      // Get current and new market prices
      const currentSellPrice = sellToken ? prices[sellToken.a]?.price || 0 : 0;
      const currentBuyPrice = currentBuyToken ? prices[currentBuyToken.a]?.price || 0 : 0;

      if (currentSellPrice > 0 && currentBuyPrice > 0) {
        // Calculate new market price
        const newMarketPrice = currentSellPrice / currentBuyPrice;

        // If we have a stored price percentage, use it to calculate new amounts
        if (pricePercentage !== null && pricePercentage !== undefined) {
          // Calculate new limit price based on the percentage relationship
          let newLimitPrice;
          if (invertPriceDisplay) {
            const invertedMarketPrice = 1 / newMarketPrice;
            const newInvertedPrice = invertedMarketPrice * (1 + pricePercentage / 100);
            newLimitPrice = 1 / newInvertedPrice;
          } else {
            newLimitPrice = newMarketPrice * (1 + pricePercentage / 100);
          }

          setLimitPrice(newLimitPrice.toFixed(8));

          if (onLimitPriceChange) {
            onLimitPriceChange(newLimitPrice);
          }

          // Recalculate buy amount based on new limit price and current sell amount
          const sellAmt = sellAmount ? parseFloat(removeCommas(sellAmount)) : 0;
          if (sellAmt > 0) {
            const newBuyAmount = sellAmt * newLimitPrice;
            const newAmounts = [...buyAmounts];
            newAmounts[0] = formatCalculatedValue(newBuyAmount);
            setBuyAmounts(newAmounts);

            // Save to localStorage
            if (newAmounts[0]) {
              localStorage.setItem('limitOrderBuyAmount', newAmounts[0]);
            }
          }
        } else if (marketPrice > 0) {
          // If no percentage stored, calculate current percentage from existing limit price
          const currentLimitPriceNum = parseFloat(limitPrice);
          if (currentLimitPriceNum > 0) {
            let calculatedPercentage;
            if (invertPriceDisplay) {
              const invertedLimitPrice = 1 / currentLimitPriceNum;
              const invertedMarketPrice = 1 / marketPrice;
              calculatedPercentage = ((invertedLimitPrice - invertedMarketPrice) / invertedMarketPrice) * 100;
            } else {
              calculatedPercentage = ((currentLimitPriceNum - marketPrice) / marketPrice) * 100;
            }

            // Apply same percentage to new market price
            let newLimitPrice;
            if (invertPriceDisplay) {
              const invertedNewMarketPrice = 1 / newMarketPrice;
              const newInvertedPrice = invertedNewMarketPrice * (1 + calculatedPercentage / 100);
              newLimitPrice = 1 / newInvertedPrice;
            } else {
              newLimitPrice = newMarketPrice * (1 + calculatedPercentage / 100);
            }

            setLimitPrice(newLimitPrice.toFixed(8));
            setPricePercentage(calculatedPercentage);

            if (onLimitPriceChange) {
              onLimitPriceChange(newLimitPrice);
            }

            // Recalculate buy amount
            const sellAmt = sellAmount ? parseFloat(removeCommas(sellAmount)) : 0;
            if (sellAmt > 0) {
              const newBuyAmount = sellAmt * newLimitPrice;
              const newAmounts = [...buyAmounts];
              newAmounts[0] = formatCalculatedValue(newBuyAmount);
              setBuyAmounts(newAmounts);

              // Save to localStorage
              if (newAmounts[0]) {
                localStorage.setItem('limitOrderBuyAmount', newAmounts[0]);
              }
            }
          }
        }
      }

      isTokenChangingRef.current = false;
    }

    // Update refs for next comparison
    previousSellTokenRef.current = sellToken;
    previousBuyTokenRef.current = currentBuyToken;
  }, [sellToken?.a, firstBuyTokenAddress, prices, invertPriceDisplay, marketPrice, sellAmount]);
  // Note: onLimitPriceChange intentionally excluded to prevent infinite loops

  const handlePercentageClick = (percentage: number, direction: 'above' | 'below' = 'above') => {
    if (!marketPrice) return;

    let effectiveSellAmount = sellAmountNum;
    if (!sellAmountNum || sellAmountNum === 0) {
      effectiveSellAmount = 1;
      setSellAmount('1');
    }

    limitPriceSetByUserRef.current = true;
    isInitialLoadRef.current = false;

    const adjustedPercentage = direction === 'above' ? percentage : -percentage;
    setPricePercentage(percentage === 0 ? null : adjustedPercentage);

    let newPrice;
    if (invertPriceDisplay) {
      const invertedMarketPrice = 1 / marketPrice;
      const newInvertedPrice = invertedMarketPrice * (1 + adjustedPercentage / 100);
      newPrice = 1 / newInvertedPrice;
    } else {
      newPrice = marketPrice * (1 + adjustedPercentage / 100);
    }

    setLimitPrice(newPrice.toFixed(8));

    if (onLimitPriceChange) {
      onLimitPriceChange(newPrice);
    }

    // Update buy token amounts based on their respective USD prices
    setBuyAmounts((prevAmounts) => {
      const newAmounts = [...prevAmounts];
      // First buy token uses the limit price directly
      if (buyTokens[0]) {
        const newBuyAmount = effectiveSellAmount * newPrice;
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
        newPrices[0] = newPrice;
        if (onIndividualLimitPricesChange) {
          onIndividualLimitPricesChange(newPrices);
        }
        return newPrices;
      });
    }
  };

  // Handler for setting limit price to backing value
  const handleBackingPriceClick = () => {
    const backingPrice = getBackingLimitPrice();
    if (!backingPrice || !sellToken) return;

    let effectiveSellAmount = sellAmountNum;
    if (!sellAmountNum || sellAmountNum === 0) {
      effectiveSellAmount = 1;
      setSellAmount('1');
    }

    limitPriceSetByUserRef.current = true;
    isInitialLoadRef.current = false;

    // Calculate what percentage the backing is from market
    if (marketPrice && marketPrice > 0) {
      const percentFromMarket = ((backingPrice - marketPrice) / marketPrice) * 100;
      setPricePercentage(percentFromMarket);
    } else {
      setPricePercentage(null);
    }

    setLimitPrice(backingPrice.toFixed(8));

    if (onLimitPriceChange) {
      onLimitPriceChange(backingPrice);
    }

    // Update buy token amounts
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
          const premiumMultiplier = backingPrice / marketPrice;

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
        if (onIndividualLimitPricesChange) {
          onIndividualLimitPricesChange(newPrices);
        }
        return newPrices;
      });
    }
  };

  // Handler for individual token percentage clicks (when prices are unbound)
  const handleIndividualPercentageClick = (tokenIndex: number, percentage: number, direction: 'above' | 'below' = 'above') => {
    const token = buyTokens[tokenIndex];
    if (!token || !sellToken) return;

    const sellTokenUsdPrice = getPrice(sellToken.a);
    const tokenUsdPrice = getPrice(token.a);

    if (sellTokenUsdPrice <= 0 || tokenUsdPrice <= 0) return;

    const tokenMarketPrice = sellTokenUsdPrice / tokenUsdPrice;
    const adjustedPercentage = direction === 'above' ? percentage : -percentage;

    // When invertPriceDisplay is true, the percentage is applied to the inverted price
    // So we need to calculate: invertedLimit = invertedMarket * (1 + adjustedPercentage/100)
    // Then: newPrice = 1 / invertedLimit
    let newPrice: number;
    if (invertPriceDisplay) {
      const invertedMarketPrice = 1 / tokenMarketPrice;
      const invertedLimitPrice = invertedMarketPrice * (1 + adjustedPercentage / 100);
      newPrice = 1 / invertedLimitPrice;
    } else {
      newPrice = tokenMarketPrice * (1 + adjustedPercentage / 100);
    }

    // Update individual limit prices and notify parent
    setIndividualLimitPrices(prev => {
      const newPrices = [...prev];
      newPrices[tokenIndex] = newPrice;
      // Immediately notify parent
      if (onIndividualLimitPricesChange) {
        onIndividualLimitPricesChange(newPrices);
      }
      return newPrices;
    });

    // Update the buy amount for this token
    // buyAmount = sellAmount * limitPrice (where limitPrice is in "buy tokens per sell token")
    const effectiveSellAmount = sellAmountNum > 0 ? sellAmountNum : 1;
    const newBuyAmount = effectiveSellAmount * newPrice;

    setBuyAmounts(prev => {
      const newAmounts = [...prev];
      newAmounts[tokenIndex] = formatCalculatedValue(newBuyAmount);
      return newAmounts;
    });
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
    setIndividualLimitPrices(prev => {
      const newPrices = [...prev];
      newPrices[tokenIndex] = limitPrice!;
      if (onIndividualLimitPricesChange) {
        onIndividualLimitPricesChange(newPrices);
      }
      return newPrices;
    });

    // Update the buy amount for this token
    const effectiveSellAmount = sellAmountNum > 0 ? sellAmountNum : 1;
    const newBuyAmount = effectiveSellAmount * limitPrice;

    setBuyAmounts(prev => {
      const newAmounts = [...prev];
      newAmounts[tokenIndex] = formatCalculatedValue(newBuyAmount);
      return newAmounts;
    });
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

    lastEditedInputRef.current = 'sell';
    const newValue = formatNumberWithCommas(value);
    // Store with commas for display
    setSellAmount(newValue);

    // Calculate new cursor position based on comma difference
    requestAnimationFrame(() => {
      if (sellInputRef.current) {
        const commasBefore = (oldValue.slice(0, cursorPos).match(/,/g) || []).length;
        const commasAfter = (newValue.slice(0, cursorPos + (newValue.length - oldValue.length)).match(/,/g) || []).length;
        const newCursorPos = Math.max(0, cursorPos + (commasAfter - commasBefore));
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

    lastEditedInputRef.current = index;
    const newAmounts = [...buyAmounts];
    const newValue = formatNumberWithCommas(value);
    // Store with commas for display
    newAmounts[index] = newValue;
    setBuyAmounts(newAmounts);

    // Calculate new cursor position based on comma difference
    requestAnimationFrame(() => {
      const buyInput = buyInputRefs.current[index];
      if (buyInput) {
        const commasBefore = (oldValue.slice(0, cursorPos).match(/,/g) || []).length;
        const commasAfter = (newValue.slice(0, cursorPos + (newValue.length - oldValue.length)).match(/,/g) || []).length;
        const newCursorPos = Math.max(0, cursorPos + (commasAfter - commasBefore));
        buyInput.setSelectionRange(newCursorPos, newCursorPos);
      }
    });
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
    }
  };

  // Function to swap sell and buy tokens/amounts
  const handleSwapTokens = () => {
    // Can only swap if there's exactly one buy token
    if (buyTokens.length === 1 && sellToken && buyTokens[0]) {
      // Calculate the percentage difference from market price before swap
      let percentageDiff: number | null = null;
      if (limitPrice && marketPrice && parseFloat(limitPrice) > 0 && marketPrice > 0) {
        if (invertPriceDisplay) {
          const invertedLimitPrice = 1 / parseFloat(limitPrice);
          const invertedMarketPrice = 1 / marketPrice;
          percentageDiff = ((invertedLimitPrice - invertedMarketPrice) / invertedMarketPrice) * 100;
        } else {
          percentageDiff = ((parseFloat(limitPrice) - marketPrice) / marketPrice) * 100;
        }
      }

      // Swap tokens
      const tempToken = sellToken;
      setSellToken(buyTokens[0]);
      setBuyTokens([tempToken]);

      // Swap amounts
      const tempAmount = sellAmount;
      setSellAmount(buyAmounts[0]);
      setBuyAmounts([tempAmount]);

      // Calculate new market price (it will be inverted)
      const newMarketPrice = marketPrice && marketPrice > 0 ? 1 / marketPrice : null;

      // Apply the same percentage difference to the new market price
      if (percentageDiff !== null && newMarketPrice) {
        const newLimitPrice = newMarketPrice * (1 + percentageDiff / 100);
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

  const handleBuyTokenSelect = (tokenFromList: any, index: number) => {
    const token: TokenOption = {
      a: tokenFromList.a,
      ticker: tokenFromList.ticker,
      name: tokenFromList.name,
      decimals: tokenFromList.decimals
    };

    const newBuyTokens = [...buyTokens];
    newBuyTokens[index] = token;
    setBuyTokens(newBuyTokens);

    const newDropdowns = [...showBuyDropdowns];
    newDropdowns[index] = false;
    setShowBuyDropdowns(newDropdowns);

    const newSearchQueries = [...buySearchQueries];
    newSearchQueries[index] = '';
    setBuySearchQueries(newSearchQueries);

    // Save first buy token to localStorage for chart
    if (index === 0) {
      localStorage.setItem('limitOrderBuyToken', token.a);
    }

    // Auto-calculate buy amount for additional tokens based on USD prices
    if (index > 0 && sellAmount && parseFloat(removeCommas(sellAmount)) > 0) {
      const sellAmt = parseFloat(removeCommas(sellAmount));
      const sellTokenUsdPrice = sellToken ? getPrice(sellToken.a) : 0;
      const tokenUsdPrice = getPrice(token.a);

      // Only calculate if we have valid prices (> 0, not -1 which means no price)
      if (sellTokenUsdPrice > 0 && tokenUsdPrice > 0) {
        const sellUsdValue = sellAmt * sellTokenUsdPrice;

        let premiumMultiplier = 1; // Default to market price

        // Only apply first token's premium if prices are BOUND
        if (pricesBound) {
          // Calculate the premium/discount from market for the first token
          // Use newBuyTokens[0] since buyTokens hasn't updated yet (async state)
          const firstBuyToken = newBuyTokens[0];
          const firstBuyTokenUsdPrice = firstBuyToken ? getPrice(firstBuyToken.a) : 0;
          const limitPriceNum = parseFloat(limitPrice) || 0;
          const marketPriceForFirst = firstBuyTokenUsdPrice > 0 ? sellTokenUsdPrice / firstBuyTokenUsdPrice : 0;
          premiumMultiplier = marketPriceForFirst > 0 && limitPriceNum > 0 ? limitPriceNum / marketPriceForFirst : 1;
        }

        // Apply premium/discount to this token's market rate
        const marketAmount = sellUsdValue / tokenUsdPrice;
        const adjustedAmount = marketAmount * premiumMultiplier;

        const newBuyAmounts = [...buyAmounts];
        newBuyAmounts[index] = formatCalculatedValue(adjustedAmount);
        setBuyAmounts(newBuyAmounts);

        // When unbound, also set the individual limit price for the new token at market
        if (!pricesBound) {
          const marketPrice = sellTokenUsdPrice / tokenUsdPrice;
          setIndividualLimitPrices(prev => {
            const newPrices = [...prev];
            newPrices[index] = marketPrice;
            if (onIndividualLimitPricesChange) {
              onIndividualLimitPricesChange(newPrices);
            }
            return newPrices;
          });
        }
      }
      // If token has no price data, leave the amount empty for user to fill manually
    }

    // Note: checkDuplicateTokens is no longer needed since we filter out
    // selected tokens from dropdowns, preventing duplicates at the UI level
  };

  return (
    <>
      <LiquidGlassCard className="w-full h-full p-6 overflow-y-scroll max-h-[calc(100vh-200px)] scrollbar-hide" shadowIntensity="sm" glowIntensity="sm" blurIntensity="xl">
        {/* Sell Section */}
        <LiquidGlassCard
          className="mb-4 p-4 bg-white/5 border-white/10 overflow-visible relative z-30"
          borderRadius="12px"
          shadowIntensity="xs"
          glowIntensity="none"
        >
          <label className="text-white/80 text-sm mb-2 block font-semibold text-left">SELL</label>

          {/* Token Selector */}
          <div className="relative mb-3" ref={sellDropdownRef}>
            <button
              onClick={() => setShowSellDropdown(!showSellDropdown)}
              className="w-full bg-black/40 border border-white/10 p-3 flex items-center justify-between hover:bg-white/5 transition-all shadow-sm rounded-lg"
            >
              <div className="flex items-center space-x-3">
                {sellToken ? (
                  <>
                    <TokenLogo ticker={sellToken.ticker} className="w-6 h-6" />
                    <span className="text-white font-medium">{formatTokenTicker(sellToken.ticker, chainId)}</span>
                  </>
                ) : (
                  <span className="text-white/50">Select token</span>
                )}
              </div>
              <svg className="w-5 h-5 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

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
                        setSellToken(customToken);
                        localStorage.setItem('limitOrderSellToken', customToken.a);
                        // Save full custom token object for restoration after reload
                        localStorage.setItem('limitOrderCustomSellToken', JSON.stringify(customToken));
                        setShowSellDropdown(false);
                        setSellSearchQuery('');
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
                    filteredSellTokens.map((token) => (
                      <button
                        key={token.a}
                        onClick={() => {
                          if (token.a) {
                            setSellToken({ a: token.a, ticker: token.ticker, name: token.name, decimals: token.decimals });
                            localStorage.setItem('limitOrderSellToken', token.a);
                            // Clear custom token storage when selecting a regular token
                            localStorage.removeItem('limitOrderCustomSellToken');
                            setShowSellDropdown(false);
                            setSellSearchQuery('');
                          }
                        }}
                        className="w-full p-3 flex items-center space-x-3 hover:bg-white/5 transition-all text-left border-b border-white/5 last:border-b-0"
                      >
                        <TokenLogo ticker={token.ticker} className="w-6 h-6" />
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="text-white font-medium">{formatTokenTicker(token.ticker, chainId)}</div>
                              <div className="text-white/50 text-xs">{token.name}</div>
                            </div>
                            {token.a && prices[token.a]?.price === -1 && (
                              <span className="text-xs px-2 py-0.5 bg-yellow-900/30 border border-yellow-500/30 text-yellow-500 rounded ml-2">
                                No Price
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Amount Input */}
          <div className="relative">
            {!isSellInputFocused && sellAmountNum > 0 ? (
              <div
                onClick={() => {
                  setIsSellInputFocused(true);
                  setTimeout(() => sellInputRef.current?.focus(), 0);
                }}
                className="w-full bg-black/40 border border-white/10 p-3 text-white text-2xl min-h-[58px] flex items-center cursor-text rounded-lg"
              >
                <NumberFlow
                  value={formatDisplayValue(sellAmountNum)}
                  format={{
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 4
                  }}
                  animated={!isDragging}
                />
              </div>
            ) : (
              <input
                ref={sellInputRef}
                type="text"
                value={sellAmount}
                onChange={handleSellAmountChange}
                onFocus={() => setIsSellInputFocused(true)}
                onBlur={() => setIsSellInputFocused(false)}
                placeholder="0.00"
                className="w-full bg-transparent border border-white/10 p-3 text-white text-2xl placeholder-white/30 focus:outline-none rounded-lg"
              />
            )}
          </div>
          <div className="flex justify-between items-center mt-2">
            <div className="text-white/50 text-sm font-semibold">
              {(pricesLoading || sellTokenPrice === 0) && sellAmountNum > 0 ? (
                <div className="flex items-center gap-1.5 animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-white/30" />
                  <span>Loading price...</span>
                </div>
              ) : sellUsdValue > 0 ? (
                <NumberFlow
                  value={sellUsdValue}
                  format={{
                    style: 'currency',
                    currency: 'USD',
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  }}
                  animated={!isDragging}
                />
              ) : '$0.00'}
            </div>
            {sellToken && isConnected && (
              <div className="flex items-center gap-2">
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
              </div>
            )}
          </div>

          {/* Advanced Options */}
          <div className="border-t border-white/10 mt-3 pt-3">
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

                {/* All or Nothing Toggle */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex flex-col min-w-0">
                    <span className="text-white/70 text-sm">All or Nothing?</span>
                    <span className="text-white/40 text-xs">Order must be filled completely in one transaction</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAllOrNothing(!allOrNothing)}
                    className={`relative w-11 h-6 flex-shrink-0 rounded-full transition-colors duration-200 ${
                      allOrNothing ? 'bg-green-500' : 'bg-white/20'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform duration-200 ${
                        allOrNothing ? 'translate-x-5' : 'translate-x-0'
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

        {/* Swap Button */}
        <div className="flex justify-center items-center my-4">
          <button
            onClick={handleSwapTokens}
            disabled={buyTokens.length > 1}
            className={`p-0 rounded-full transition-all ${buyTokens.length > 1
              ? 'cursor-not-allowed opacity-30'
              : 'hover:border-white/10 hover:bg-white/5 cursor-pointer'
              } border-0 border-white/30 ${buyTokens.length === 1 && 'hover:border-white/50'
              }`}
            title={buyTokens.length > 1 ? "Cannot swap with multiple tokens" : "Swap tokens and amounts"}
          >
            <ArrowLeftRight className={`w-5 h-5 text-white rotate-90 ${buyTokens.length > 1
              ? ''
              : 'group-hover:text-white'
              } transition-colors`} />
          </button>
        </div>

        {/* Buy Section - Multiple Tokens */}
        <LiquidGlassCard
          className="mb-4 p-4 bg-white/5 border-white/10 overflow-visible relative z-20"
          borderRadius="12px"
          shadowIntensity="xs"
          glowIntensity="none"
        >
          <div className="flex items-center justify-between mb-2">
            <label className="text-white/80 text-sm font-semibold text-left">BUY</label>

            {/* Bind Prices Toggle - Only show when there are multiple buy tokens */}
            {buyTokens.length > 1 && (
              <button
                type="button"
                onClick={() => setPricesBound(!pricesBound)}
                className={`flex items-center gap-1.5 px-2 py-1 text-xs rounded-full transition-all ${
                  pricesBound
                    ? 'bg-[#FF0080]/20 text-[#FF0080] border border-[#FF0080]/30'
                    : 'bg-white/5 text-white/60 border border-white/10 hover:bg-white/10'
                }`}
                title={pricesBound ? 'Prices linked: same % from market for all tokens' : 'Prices unlinked: set individual prices'}
              >
                {pricesBound ? (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                ) : (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1M18 6L6 18" />
                  </svg>
                )}
                <span>{pricesBound ? 'Linked Price' : 'Unlinked Price'}</span>
              </button>
            )}
          </div>

          <div className="space-y-4">
            {buyTokens.map((buyToken, index) => (
              <div key={index}>
                {/* OR Divider */}
                {index > 0 && (
                  <div className="flex items-center gap-4 mb-4">
                    <div className="flex-1 h-px bg-white/10"></div>
                    <span className="text-white/70 text-sm font-medium px-2">OR</span>
                    <div className="flex-1 h-px bg-white/10"></div>
                  </div>
                )}

                <div className="flex items-start space-x-2">
                  <div className="flex-1">
                    {/* Token Selector */}
                    <div className="relative mb-3" ref={el => { buyDropdownRefs.current[index] = el; }}>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => {
                            const newDropdowns = [...showBuyDropdowns];
                            newDropdowns[index] = !newDropdowns[index];
                            setShowBuyDropdowns(newDropdowns);
                          }}
                          className="flex-1 bg-black/40 border border-white/10 p-3 flex items-center justify-between hover:bg-white/5 transition-all shadow-sm rounded-lg"
                        >
                          <div className="flex items-center space-x-3">
                            {buyToken ? (
                              <>
                                <TokenLogo ticker={buyToken.ticker} className="w-6 h-6" />
                                <span className="text-white font-medium">{formatTokenTicker(buyToken.ticker, chainId)}</span>
                              </>
                            ) : (
                              <span className="text-white/50">Select token</span>
                            )}
                          </div>
                          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>

                        {/* Delete button */}
                        {index > 0 && (
                          <button
                            onClick={() => handleRemoveBuyToken(index)}
                            className="p-3 h-[52px] hover:bg-white/10 transition-colors flex items-center justify-center rounded-lg"
                            title="Remove token"
                          >
                            <svg className="w-5 h-5 text-red-400 hover:text-red-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
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
                            {getFilteredBuyTokens(index).length === 0 ? (
                              <div className="p-4 text-center text-white/50 text-sm">No tokens found</div>
                            ) : (
                              getFilteredBuyTokens(index).map((token) => (
                                <button
                                  key={token.a}
                                  onClick={() => handleBuyTokenSelect(token, index)}
                                  className="w-full p-3 flex items-center space-x-3 hover:bg-white/5 transition-all text-left border-b border-white/5 last:border-b-0"
                                >
                                  <TokenLogo ticker={token.ticker} className="w-6 h-6" />
                                  <div className="flex-1">
                                    <div className="flex items-center justify-between">
                                      <div>
                                        <div className="text-white font-medium">{formatTokenTicker(token.ticker, chainId)}</div>
                                        <div className="text-white/70 text-xs">{token.name}</div>
                                      </div>
                                      {token.a && prices[token.a]?.price === -1 && (
                                        <span className="text-xs px-2 py-0.5 bg-yellow-900/30 border border-yellow-500/30 text-yellow-500 rounded ml-2">
                                          No Price
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </button>
                              ))
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Amount Input */}
                    <div className="relative">
                      {!isBuyInputFocused[index] && buyAmounts[index] && parseFloat(removeCommas(buyAmounts[index])) > 0 ? (
                        <div
                          onClick={() => {
                            const newFocused = [...isBuyInputFocused];
                            newFocused[index] = true;
                            setIsBuyInputFocused(newFocused);
                            setTimeout(() => buyInputRefs.current[index]?.focus(), 0);
                          }}
                          className="w-full bg-black/40 border border-white/10 p-3 text-white text-2xl min-h-[58px] flex items-center cursor-text rounded-lg"
                        >
                          <NumberFlow
                            value={formatDisplayValue(parseFloat(removeCommas(buyAmounts[index])))}
                            format={{
                              minimumFractionDigits: 0,
                              maximumFractionDigits: 4
                            }}
                            animated={!isDragging}
                          />
                        </div>
                      ) : (
                        <input
                          ref={el => { buyInputRefs.current[index] = el; }}
                          type="text"
                          value={buyAmounts[index] || ''}
                          onChange={(e) => handleBuyAmountChange(e, index)}
                          onFocus={() => {
                            const newFocused = [...isBuyInputFocused];
                            newFocused[index] = true;
                            setIsBuyInputFocused(newFocused);
                          }}
                          onBlur={() => {
                            const newFocused = [...isBuyInputFocused];
                            newFocused[index] = false;
                            setIsBuyInputFocused(newFocused);
                          }}
                          placeholder="0.00"
                          className="w-full bg-transparent border border-white/10 p-3 text-white text-2xl placeholder-white/30 focus:outline-none rounded-lg"
                        />
                      )}
                    </div>
                  </div>
                </div>

                {/* Add another token button - only show when acceptMultipleTokens is enabled */}
                {acceptMultipleTokens && index === buyTokens.length - 1 && buyAmounts[index] && buyAmounts[index].trim() !== '' && (
                  <>
                    {buyTokens.length < 10 ? (
                      <button
                        onClick={handleAddBuyToken}
                        className="mt-3 w-full py-2 bg-black/40 border border-white/10 hover:border-white/30 transition-all flex items-center justify-center space-x-2 opacity-60 hover:opacity-100 rounded-full"
                      >
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        <span className="text-white text-sm">Add alternative token</span>
                      </button>
                    ) : (
                      <div className="mt-3 w-full py-2 text-center text-gray-500 text-sm">
                        Maximum of 10 tokens reached
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>

          {/* Duplicate token error */}
          {duplicateTokenError && (
            <div className="mt-3 p-2 bg-red-900/20 border border-red-500/30 rounded">
              <p className="text-red-400 text-xs">⚠️ {duplicateTokenError}</p>
            </div>
          )}
        </LiquidGlassCard>

        {/* Limit Price Section - Only for first buy token */}
        {buyTokens[0] && (
          <LiquidGlassCard
            className="mb-4 p-4 bg-white/5 border-white/10"
            borderRadius="12px"
            shadowIntensity="xs"
            glowIntensity="none"
          >
            <div className="flex justify-between items-center mb-2">
              <div className="flex items-center gap-2">
                <label className="text-[#FF0080]/90 text-sm font-semibold">LIMIT PRICE</label>
                {sellToken && buyTokens[0] && (
                  <button
                    type="button"
                    onClick={() => {
                      const newInverted = !invertPriceDisplay;
                      setInvertPriceDisplay(newInverted);
                      onInvertPriceDisplayChange?.(newInverted);
                    }}
                    className="p-1 text-[#FF0080] hover:text-white transition-colors"
                    title={`Show price in ${invertPriceDisplay ? formatTokenTicker(buyTokens[0].ticker, chainId) : formatTokenTicker(sellToken.ticker, chainId)}`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                    </svg>
                  </button>
                )}
              </div>
              {pricePercentage !== null && Math.abs(pricePercentage) > 0.01 && (
                <span className="text-sm font-bold text-[#FF0080]">
                  <NumberFlow
                    value={pricePercentage}
                    format={{
                      signDisplay: 'always',
                      minimumFractionDigits: 0,
                      maximumFractionDigits: Math.abs(pricePercentage) >= 10 ? 1 : 2
                    }}
                    suffix="%"
                    animated={!isDragging}
                  />
                </span>
              )}
            </div>
            <div className="relative">
              <div className="w-full bg-black/40 border-accent-pink p-3 text-[#FF0080] text-lg min-h-[52px] flex items-center rounded-lg">
                {limitPrice && parseFloat(limitPrice) > 0 ? (
                  <NumberFlow
                    value={(() => {
                      const price = parseFloat(limitPrice);
                      if (invertPriceDisplay && price > 0) {
                        return 1 / price;
                      }
                      return price;
                    })()}
                    format={{
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 8
                    }}
                    animated={!isDragging}
                  />
                ) : (
                  <span className="text-[#FF0080]/30">0.00000000</span>
                )}
              </div>
              {sellToken && buyTokens[0] && limitPrice && parseFloat(limitPrice) > 0 && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[#FF0080]/70 text-sm font-medium pointer-events-none">
                  {invertPriceDisplay ? formatTokenTicker(sellToken.ticker, chainId) : formatTokenTicker(buyTokens[0].ticker, chainId)}
                </div>
              )}
            </div>

            {/* Price Warning for tokens without price data */}
            {sellToken && buyTokens[0] && (
              (sellToken && prices[sellToken.a]?.price === -1) || (buyTokens[0] && prices[buyTokens[0].a]?.price === -1)
            ) && (
                <div className="mt-2 p-3 bg-yellow-900/20 border border-yellow-500/30 rounded-lg">
                  <div className="flex items-start gap-2">
                    <svg className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div className="text-sm">
                      <p className="text-yellow-500 font-medium">⚠️ No Market Price Available</p>
                      <p className="text-yellow-400/80 mt-1">
                        {sellToken && prices[sellToken.a]?.price === -1 && buyTokens[0] && prices[buyTokens[0].a]?.price === -1
                          ? `Neither ${formatTokenTicker(sellToken.ticker, chainId)} nor ${formatTokenTicker(buyTokens[0].ticker, chainId)} have market prices.`
                          : sellToken && prices[sellToken.a]?.price === -1
                            ? `${formatTokenTicker(sellToken.ticker, chainId)} has no market price data.`
                            : `${formatTokenTicker(buyTokens[0].ticker, chainId)} has no market price data.`
                        } You'll need to manually set your desired price.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            {/* Percentage Buttons */}
            {marketPrice > 0 && (
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => handlePercentageClick(0, 'above')}
                  className={`flex-1 py-2 border-accent-pink text-xs transition-all font-medium rounded-full ${pricePercentage === null || Math.abs(pricePercentage) < 0.01
                    ? 'bg-[#FF0080]/20 text-white'
                    : 'bg-black/40 text-[#FF0080] hover:bg-[#FF0080]/20 hover:text-white'
                    }`}
                >
                  Market
                </button>
                {/* Show Backing button if available, otherwise show -1%/+1% */}
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
                    className={`flex-1 py-2 border-accent-pink text-xs transition-all font-medium rounded-full ${pricePercentage !== null && Math.abs(Math.abs(pricePercentage) - 1) < 0.01
                      ? 'bg-[#FF0080]/20 text-white'
                      : 'bg-black/40 text-[#FF0080] hover:bg-[#FF0080]/20 hover:text-white'
                      }`}
                  >
                    {invertPriceDisplay ? '-1%' : '+1%'} {invertPriceDisplay ? '↓' : '↑'}
                  </button>
                )}
                <button
                  onClick={() => handlePercentageClick(2, invertPriceDisplay ? 'below' : 'above')}
                  className={`flex-1 py-2 border-accent-pink text-xs transition-all font-medium rounded-full ${pricePercentage !== null && Math.abs(Math.abs(pricePercentage) - 2) < 0.01
                    ? 'bg-[#FF0080]/20 text-white'
                    : 'bg-black/40 text-[#FF0080] hover:bg-[#FF0080]/20 hover:text-white'
                    }`}
                >
                  {invertPriceDisplay ? '-2%' : '+2%'} {invertPriceDisplay ? '↓' : '↑'}
                </button>
                <button
                  onClick={() => handlePercentageClick(5, invertPriceDisplay ? 'below' : 'above')}
                  className={`flex-1 py-2 border-accent-pink text-xs transition-all font-medium rounded-full ${pricePercentage !== null && Math.abs(Math.abs(pricePercentage) - 5) < 0.01
                    ? 'bg-[#FF0080]/20 text-white'
                    : 'bg-black/40 text-[#FF0080] hover:bg-[#FF0080]/20 hover:text-white'
                    }`}
                >
                  {invertPriceDisplay ? '-5%' : '+5%'} {invertPriceDisplay ? '↓' : '↑'}
                </button>
                <button
                  onClick={() => handlePercentageClick(10, invertPriceDisplay ? 'below' : 'above')}
                  className={`flex-1 py-2 border-accent-pink text-xs transition-all font-medium rounded-full ${pricePercentage !== null && Math.abs(Math.abs(pricePercentage) - 10) < 0.01
                    ? 'bg-[#FF0080]/20 text-white'
                    : 'bg-black/40 text-[#FF0080] hover:bg-[#FF0080]/20 hover:text-white'
                    }`}
                >
                  {invertPriceDisplay ? '-10%' : '+10%'} {invertPriceDisplay ? '↓' : '↑'}
                </button>
              </div>
            )}
          </LiquidGlassCard>
        )}

        {/* Individual Limit Price Sections for additional buy tokens when unlinked */}
        {!pricesBound && buyTokens.length > 1 && buyTokens.slice(1).map((token, idx) => {
          const index = idx + 1; // actual index in buyTokens array
          if (!token) return null;

          // Colors for each additional token
          const tokenColors = [
            { accent: '#8B5CF6', bg: 'bg-purple-500/10', border: 'border-purple-500/30', text: 'text-purple-400' }, // Purple
            { accent: '#F59E0B', bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-400' }, // Amber
            { accent: '#10B981', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400' }, // Emerald
            { accent: '#EF4444', bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-400' }, // Red
            { accent: '#3B82F6', bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-400' }, // Blue
            { accent: '#EC4899', bg: 'bg-fuchsia-500/10', border: 'border-fuchsia-500/30', text: 'text-fuchsia-400' }, // Fuchsia
            { accent: '#14B8A6', bg: 'bg-teal-500/10', border: 'border-teal-500/30', text: 'text-teal-400' }, // Teal
            { accent: '#F97316', bg: 'bg-orange-500/10', border: 'border-orange-500/30', text: 'text-orange-400' }, // Orange
            { accent: '#6366F1', bg: 'bg-indigo-500/10', border: 'border-indigo-500/30', text: 'text-indigo-400' }, // Indigo
          ];
          const colors = tokenColors[idx % tokenColors.length];

          // Get the individual limit price for this token
          const tokenLimitPrice = individualLimitPrices[index];

          // Calculate percentage from market for this token
          const sellTokenUsdPrice = sellToken ? getPrice(sellToken.a) : 0;
          const tokenUsdPrice = getPrice(token.a);
          const tokenMarketPrice = sellTokenUsdPrice > 0 && tokenUsdPrice > 0
            ? sellTokenUsdPrice / tokenUsdPrice
            : 0;
          // Calculate percentage - account for invertPriceDisplay like the main limit price
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
            <LiquidGlassCard
              key={`limit-price-${token.a}`}
              className={`mb-4 p-4 ${colors.bg} ${colors.border}`}
              borderRadius="12px"
              shadowIntensity="xs"
              glowIntensity="none"
            >
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-semibold" style={{ color: colors.accent }}>
                    LIMIT PRICE ({formatTokenTicker(token.ticker, chainId)})
                  </label>
                </div>
                {tokenPricePercentage !== null && Math.abs(tokenPricePercentage) > 0.01 && (
                  <span className="text-sm font-bold" style={{ color: colors.accent }}>
                    {tokenPricePercentage > 0 ? '+' : ''}{tokenPricePercentage.toFixed(2)}%
                  </span>
                )}
              </div>
              <div className="relative">
                <div
                  className="w-full bg-black/40 p-3 text-lg min-h-[52px] flex items-center rounded-lg border"
                  style={{ borderColor: `${colors.accent}40`, color: colors.accent }}
                >
                  {tokenLimitPrice && tokenLimitPrice > 0 ? (
                    <NumberFlow
                      value={invertPriceDisplay && tokenLimitPrice > 0 ? 1 / tokenLimitPrice : tokenLimitPrice}
                      format={{
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 8
                      }}
                      animated={!isDragging}
                    />
                  ) : (
                    <span style={{ color: `${colors.accent}50` }}>0.00000000</span>
                  )}
                </div>
                {sellToken && token && tokenLimitPrice && tokenLimitPrice > 0 && (
                  <div
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium pointer-events-none"
                    style={{ color: `${colors.accent}B3` }}
                  >
                    {invertPriceDisplay ? formatTokenTicker(sellToken.ticker, chainId) : formatTokenTicker(token.ticker, chainId)}
                  </div>
                )}
              </div>

              {/* Percentage Buttons for this token */}
              {tokenMarketPrice > 0 && (
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => handleIndividualPercentageClick(index, 0, 'above')}
                    className="flex-1 py-2 text-xs transition-all font-medium rounded-full"
                    style={{
                      backgroundColor: tokenPricePercentage === null || Math.abs(tokenPricePercentage) < 0.01 ? `${colors.accent}33` : 'rgba(0,0,0,0.4)',
                      color: tokenPricePercentage === null || Math.abs(tokenPricePercentage) < 0.01 ? 'white' : colors.accent,
                      border: `1px solid ${colors.accent}40`
                    }}
                  >
                    Market
                  </button>
                  {/* Show Backing button if available, otherwise show -1%/+1% */}
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
                        })() ? `${colors.accent}33` : 'rgba(0,0,0,0.4)',
                        color: (() => {
                          const backingPrice = getBackingPriceForToken(sellToken);
                          if (!backingPrice || !tokenMarketPrice) return colors.accent;
                          const backingPercent = ((backingPrice - tokenMarketPrice) / tokenMarketPrice) * 100;
                          return tokenPricePercentage !== null && Math.abs(tokenPricePercentage - backingPercent) < 0.5 ? 'white' : colors.accent;
                        })(),
                        border: `1px solid ${colors.accent}40`
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
                        backgroundColor: tokenPricePercentage !== null && Math.abs(Math.abs(tokenPricePercentage) - 1) < 0.1 ? `${colors.accent}33` : 'rgba(0,0,0,0.4)',
                        color: tokenPricePercentage !== null && Math.abs(Math.abs(tokenPricePercentage) - 1) < 0.1 ? 'white' : colors.accent,
                        border: `1px solid ${colors.accent}40`
                      }}
                    >
                      {invertPriceDisplay ? '-1%' : '+1%'} {invertPriceDisplay ? '↓' : '↑'}
                    </button>
                  )}
                  <button
                    onClick={() => handleIndividualPercentageClick(index, 2, invertPriceDisplay ? 'below' : 'above')}
                    className="flex-1 py-2 text-xs transition-all font-medium rounded-full"
                    style={{
                      backgroundColor: tokenPricePercentage !== null && Math.abs(Math.abs(tokenPricePercentage) - 2) < 0.1 ? `${colors.accent}33` : 'rgba(0,0,0,0.4)',
                      color: tokenPricePercentage !== null && Math.abs(Math.abs(tokenPricePercentage) - 2) < 0.1 ? 'white' : colors.accent,
                      border: `1px solid ${colors.accent}40`
                    }}
                  >
                    {invertPriceDisplay ? '-2%' : '+2%'} {invertPriceDisplay ? '↓' : '↑'}
                  </button>
                  <button
                    onClick={() => handleIndividualPercentageClick(index, 5, invertPriceDisplay ? 'below' : 'above')}
                    className="flex-1 py-2 text-xs transition-all font-medium rounded-full"
                    style={{
                      backgroundColor: tokenPricePercentage !== null && Math.abs(Math.abs(tokenPricePercentage) - 5) < 0.1 ? `${colors.accent}33` : 'rgba(0,0,0,0.4)',
                      color: tokenPricePercentage !== null && Math.abs(Math.abs(tokenPricePercentage) - 5) < 0.1 ? 'white' : colors.accent,
                      border: `1px solid ${colors.accent}40`
                    }}
                  >
                    {invertPriceDisplay ? '-5%' : '+5%'} {invertPriceDisplay ? '↓' : '↑'}
                  </button>
                  <button
                    onClick={() => handleIndividualPercentageClick(index, 10, invertPriceDisplay ? 'below' : 'above')}
                    className="flex-1 py-2 text-xs transition-all font-medium rounded-full"
                    style={{
                      backgroundColor: tokenPricePercentage !== null && Math.abs(Math.abs(tokenPricePercentage) - 10) < 0.1 ? `${colors.accent}33` : 'rgba(0,0,0,0.4)',
                      color: tokenPricePercentage !== null && Math.abs(Math.abs(tokenPricePercentage) - 10) < 0.1 ? 'white' : colors.accent,
                      border: `1px solid ${colors.accent}40`
                    }}
                  >
                    {invertPriceDisplay ? '-10%' : '+10%'} {invertPriceDisplay ? '↓' : '↑'}
                  </button>
                </div>
              )}
            </LiquidGlassCard>
          );
        })}

        {/* Expiration */}
        <LiquidGlassCard
          className="mb-4 p-4 bg-white/5 border-white/10 overflow-visible relative z-10"
          borderRadius="12px"
          shadowIntensity="xs"
          glowIntensity="none"
        >
          <div className="flex items-center justify-between mb-2">
            <label className="text-white text-sm font-semibold">EXPIRATION (DAYS)</label>
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
          <div className="relative">
            <input
              type="text"
              inputMode="decimal"
              value={expirationInput}
              onChange={(e) => {
                const value = e.target.value;
                const MIN_EXPIRATION_SECONDS = 10;
                const MIN_EXPIRATION_DAYS = MIN_EXPIRATION_SECONDS / 86400; // 10 seconds in days

                // Allow empty input
                if (value === '') {
                  setExpirationInput('');
                  setExpirationDays(0);
                  setSelectedDate(undefined);
                  setExpirationError(null);
                  return;
                }

                // Only allow valid decimal patterns
                if (!value.match(/^\d*\.?\d*$/)) {
                  return; // Reject invalid input
                }

                // Always update the input string to allow typing
                setExpirationInput(value);

                // Try to parse and update the numeric value
                const numValue = parseFloat(value);
                if (!isNaN(numValue) && numValue > 0) {
                  // Check minimum expiration
                  if (numValue < MIN_EXPIRATION_DAYS) {
                    setExpirationError(`Minimum expiration is ${MIN_EXPIRATION_SECONDS} seconds (${MIN_EXPIRATION_DAYS.toFixed(8)} days)`);
                    setExpirationDays(0);
                    setSelectedDate(undefined);
                  } else {
                    setExpirationError(null);
                    setExpirationDays(numValue);
                    // Calculate and set the date using milliseconds for accurate calculation
                    const futureDate = new Date();
                    const millisecondsToAdd = numValue * 24 * 60 * 60 * 1000;
                    futureDate.setTime(futureDate.getTime() + millisecondsToAdd);
                    setSelectedDate(futureDate);
                  }
                } else {
                  // For partial entries like "0." keep the numeric value at 0
                  setExpirationError(null);
                  setExpirationDays(0);
                  setSelectedDate(undefined);
                }
              }}
              placeholder="Enter days"
              className="w-full bg-black/40 border-white/20 p-3 text-white placeholder-white/30 focus:outline-none rounded-lg"
            />
            {expirationDays > 0 && selectedDate && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 text-xs pointer-events-none">
                {(() => {
                  const now = new Date();
                  const diffMs = selectedDate.getTime() - now.getTime();
                  const hoursLeft = Math.floor(diffMs / (1000 * 60 * 60));
                  const minutesLeft = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

                  if (hoursLeft < 24) {
                    return `${hoursLeft}h ${minutesLeft}m left`;
                  } else {
                    const daysLeft = Math.floor(hoursLeft / 24);
                    const remainingHours = hoursLeft % 24;
                    return `${daysLeft}d ${remainingHours}h left`;
                  }
                })()}
              </div>
            )}
          </div>

          {/* Expiration Error Message */}
          {expirationError && (
            <div className="mt-2 text-red-400 text-xs">
              {expirationError}
            </div>
          )}

          {/* Expiration Preset Buttons */}
          <div className="mt-3 flex gap-2 w-full">
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

        {/* Order Summary */}
        {sellAmount && sellToken && parseFloat(removeCommas(sellAmount)) > 0 && !duplicateTokenError && (
          <LiquidGlassCard
            className="mb-6 p-4 bg-white/5 border-white/10"
            borderRadius="12px"
            shadowIntensity="xs"
            glowIntensity="none"
          >
            <h3 className="text-white font-semibold mb-3 text-sm text-left">ORDER SUMMARY</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-white/70">Your Offer:</span>
                <span className="text-white font-medium">{formatBalanceDisplay(removeCommas(sellAmount))} {formatTokenTicker(sellToken.ticker, chainId)}</span>
              </div>

              {/* Listing Fee - always required, paid in native PLS */}
              <div className="flex justify-between items-center">
                <span className="text-white/70">Flat listing fee:</span>
                <span className="text-red-400 font-medium">
                  -{parseFloat(formatEther(listingFee)).toString()} {formatTokenTicker('PLS', chainId)}
                </span>
              </div>

              {/* You Pay - only show when selling native PLS */}
              {isNativeToken(sellToken.a) && (
                <div className="flex justify-between items-center pt-0">
                  <span className="text-white">You Pay:</span>
                  <span className="text-white font-medium">
                    {(parseFloat(removeCommas(sellAmount)) + parseFloat(formatEther(listingFee))).toLocaleString('en-US', {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 8
                    })} {formatTokenTicker(sellToken.ticker, chainId)}
                  </span>
                </div>
              )}

              {buyTokens.map((token, index) => {
                const amount = buyAmounts[index];
                if (!token || !amount || amount.trim() === '') return null;
                const filteredBuyTokens = buyTokens.filter((t, idx) => t && buyAmounts[idx] && buyAmounts[idx].trim() !== '');
                const isFirst = filteredBuyTokens[0] === token;
                return (
                  <div key={`ask-${index}`} className={`flex justify-between items-center ${isFirst ? 'border-t border-white/20 pt-2' : ''}`}>
                    <span className="text-white/70">
                      {isFirst ? `Your Ask${filteredBuyTokens.length > 1 ? ' (Either of)' : ''}:` : ''}
                    </span>
                    <span className="text-white font-medium">
                      {formatBalanceDisplay(removeCommas(amount))} {formatTokenTicker(token.ticker, chainId)}
                    </span>
                  </div>
                );
              })}

              {/* Fee deducted from buyer */}
              {buyTokens.filter((t, idx) => t && buyAmounts[idx] && buyAmounts[idx].trim() !== '').map((token, index) => {
                const filteredBuyTokens = buyTokens.filter((t, idx) => t && buyAmounts[idx] && buyAmounts[idx].trim() !== '');
                const amount = buyAmounts[buyTokens.indexOf(token)];
                if (!token || !amount || amount.trim() === '') return null;
                const feeAmount = parseFloat(removeCommas(amount)) * 0.002;
                return (
                  <div key={`fee-${index}`} className="flex justify-between items-center">
                    <span className="text-white/70">
                      {index === 0 ? `Platform Fee (0.2%)${filteredBuyTokens.length > 1 ? ' (Either of)' : ''}:` : ''}
                    </span>
                    <span className="text-red-400 font-medium">
                      -{formatBalanceDisplay(feeAmount.toString())} {formatTokenTicker(token.ticker, chainId)}
                    </span>
                  </div>
                );
              })}

              <div className="border-t border-white/20 pt-2 mt-2">
                {buyTokens.filter((t, idx) => t && buyAmounts[idx] && buyAmounts[idx].trim() !== '').map((token, index) => {
                  const filteredBuyTokens = buyTokens.filter((t, idx) => t && buyAmounts[idx] && buyAmounts[idx].trim() !== '');
                  const amount = buyAmounts[buyTokens.indexOf(token)];
                  if (!token || !amount || amount.trim() === '') return null;
                  const amountAfterFee = parseFloat(removeCommas(amount)) * 0.998; // Subtract 0.2% fee
                  return (
                    <div key={`receive-${index}`} className="flex justify-between items-center">
                      <span className="text-white font-semibold">
                        {index === 0 ? `You Receive${filteredBuyTokens.length > 1 ? ' (Either of)' : ''}:` : ''}
                      </span>
                      <span className="text-white font-bold">
                        {formatBalanceDisplay(amountAfterFee.toFixed(6))} {formatTokenTicker(token.ticker, chainId)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </LiquidGlassCard>
        )}

        {/* Pro Plan - Show when maxiStats is enabled:
            - If user has NO access: always show (blurred) to tease the feature
            - If user HAS access: only show when MAXI tokens are in buy or sell */}
        {maxiStats && (
          // Show if user doesn't have access (blurred teaser) OR if user has access and MAXI tokens are involved
          (PAYWALL_ENABLED && !hasTokenAccess) ||
          (hasTokenAccess && sellToken && buyTokens.length > 0 && buyTokens[0] && (showSellStats || showBuyStats || (isTokenEligibleForStats(sellToken) || buyTokens.some(t => isTokenEligibleForStats(t)))) && !duplicateTokenError &&
            !(MAXI_TOKENS.includes(sellToken.a.toLowerCase()) && buyTokens.every(t => t && MAXI_TOKENS.includes(t.a.toLowerCase()))))
        ) && (
            <LiquidGlassCard
              className="mb-4 p-4 bg-white/5 border-white/10"
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
            </LiquidGlassCard>
          )}

        {/* Connect/Submit Button */}
        {!isConnected ? (
          <button className="w-full py-4 bg-black text-white border border-white/30 font-bold hover:bg-white hover:text-black transition-all shadow-lg hover:shadow-white/30 text-lg tracking-wider rounded-lg">
            CONNECT WALLET
          </button>
        ) : (
          <button
            onClick={handleCreateOrder}
            disabled={!sellToken || !sellAmount || buyTokens.some(t => !t) || buyAmounts.some(a => !a || a.trim() === '') || !!duplicateTokenError || !!expirationError || isCreatingOrder || isApproving}
            className="w-full py-4 bg-white text-black border border-white font-bold hover:bg-white/80 hover:text-black text-lg tracking-wider disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 rounded-full"
          >
            {isApproving && <PixelSpinner size={20} />}
            {isCreatingOrder && !isApproving && <PixelSpinner size={20} />}
            {isApproving ? 'APPROVING...' : isCreatingOrder ? 'CREATING ORDER...' : 'CREATE LIMIT ORDER'}
          </button>
        )}
      </LiquidGlassCard >

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
