'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import NumberFlow from '@number-flow/react';
import { useAccount, useBalance, usePublicClient } from 'wagmi';
import { TOKEN_CONSTANTS } from '@/constants/crypto';
import { useTokenPrices } from '@/hooks/crypto/useTokenPrices';
import { formatEther, parseEther } from 'viem';
import logoManifest from '@/constants/logo-manifest.json';
import { formatTokenTicker, parseTokenAmount, getTokenInfoByIndex, getContractWhitelistIndex } from '@/utils/tokenUtils';
import { useTokenStats } from '@/hooks/crypto/useTokenStats';
import { useTokenAccess } from '@/context/TokenAccessContext';
import { PAYWALL_ENABLED, REQUIRED_PARTY_TOKENS, REQUIRED_TEAM_TOKENS, PAYWALL_TITLE, PAYWALL_DESCRIPTION } from '@/config/paywall';
import PaywallModal from './PaywallModal';
import { TokenLogo } from '@/components/TokenLogo';
import { Lock, ArrowLeftRight, Calendar as CalendarIcon, Loader2 } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { Calendar } from '@/components/ui/calendar';
import { isNativeToken, useTokenApproval } from '@/utils/tokenApproval';
import { useContractWhitelist } from '@/hooks/contracts/useContractWhitelist';
import { useContractWhitelistRead } from '@/hooks/contracts/useContractWhitelistRead';
import { waitForTransactionWithTimeout, TRANSACTION_TIMEOUTS } from '@/utils/transactionTimeout';
import useToast from '@/hooks/use-toast';

interface LimitOrderFormProps {
  onTokenChange?: (sellToken: string | undefined, buyTokens: (string | undefined)[]) => void;
  onLimitPriceChange?: (price: number | undefined) => void;
  onInvertPriceDisplayChange?: (inverted: boolean) => void;
  externalLimitPrice?: number;
  externalMarketPrice?: number;
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

// Helper to format calculated values for state
const formatCalculatedValue = (value: number): string => {
  if (value === 0) return '';
  
  const rounded = Math.round(value * 10000) / 10000;
  
  let str = rounded.toString();
  if (str.includes('.')) {
    str = str.replace(/\.?0+$/, '');
  }
  
  return str;
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
  externalLimitPrice,
  externalMarketPrice,
  isDragging = false,
  onCreateOrderClick,
  onOrderCreated,
}: LimitOrderFormProps) {
  const { isConnected, address, chainId } = useAccount();
  
  // Default tokens: PLS for sell, PLSX for buy
  const getDefaultSellToken = (): TokenOption | null => {
    const pls = TOKEN_CONSTANTS.find(t => t.a === '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE');
    return pls ? { a: pls.a, ticker: pls.ticker, name: pls.name, decimals: pls.decimals } : null;
  };
  
  const getDefaultBuyToken = (): TokenOption | null => {
    const hex = TOKEN_CONSTANTS.find(t => t.a === '0x2b591e99afE9f32eAA6214f7B7629768c40Eeb39');
    return hex ? { a: hex.a, ticker: hex.ticker, name: hex.name, decimals: hex.decimals } : null;
  };
  
  const [sellToken, setSellToken] = useState<TokenOption | null>(getDefaultSellToken());
  const [buyTokens, setBuyTokens] = useState<(TokenOption | null)[]>([getDefaultBuyToken()]); // Array of buy tokens
  const [sellAmount, setSellAmount] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('limitOrderSellAmount') || '';
    }
    return '';
  });
  const [buyAmounts, setBuyAmounts] = useState<string[]>(['']); // Array of buy amounts
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
  
  const sellDropdownRef = useRef<HTMLDivElement>(null);
  const buyDropdownRefs = useRef<(HTMLDivElement | null)[]>([]);
  const sellSearchRef = useRef<HTMLInputElement>(null);
  const buySearchRefs = useRef<(HTMLInputElement | null)[]>([]);
  const buyInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const sellInputRef = useRef<HTMLInputElement>(null);
  const datePickerRef = useRef<HTMLDivElement>(null);
  const isInitialLoadRef = useRef<boolean>(true);
  const limitPriceSetByUserRef = useRef<boolean>(false);
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
              name: 'getListingFee',
              type: 'function',
              stateMutability: 'view',
              inputs: [],
              outputs: [{ name: '', type: 'uint256' }],
            },
          ],
          functionName: 'getListingFee',
        }) as bigint;
        setListingFee(fee);
      } catch (error) {
        
        setListingFee(0n);
      }
    };
    
    fetchListingFee();
  }, [publicClient, contractAddress]);

  // Filter TOKEN_CONSTANTS to only include whitelisted tokens from the contract
  const whitelistedAddresses = new Set(
    activeTokens.map(token => token.tokenAddress.toLowerCase())
  );
  
  const availableTokens = TOKEN_CONSTANTS.filter(t => {
    if (!t.a || !t.dexs) return false;
    // Only include tokens that are in the contract whitelist
    return whitelistedAddresses.has(t.a.toLowerCase());
  });

  // Filter tokens based on search queries and exclude already selected tokens
  const filteredSellTokens = availableTokens.filter(token => {
    if (!token.a) return false;
    
    // Exclude if it's already selected in any buy token
    const isSelectedInBuy = buyTokens.some(buyToken => 
      buyToken && buyToken.a && token.a && buyToken.a.toLowerCase() === token.a.toLowerCase()
    );
    if (isSelectedInBuy) return false;
    
    // Apply search filter
    return token.ticker.toLowerCase().includes(sellSearchQuery.toLowerCase()) ||
           token.name.toLowerCase().includes(sellSearchQuery.toLowerCase());
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
      
      // Apply search filter
      return token.ticker.toLowerCase().includes(searchQuery.toLowerCase()) ||
             token.name.toLowerCase().includes(searchQuery.toLowerCase());
    });
  };

  // Get all token addresses for price fetching
  const tokenAddresses = availableTokens.map(t => t.a).filter(Boolean) as string[];
  
  // Fetch token prices
  const { prices, isLoading: pricesLoading } = useTokenPrices(tokenAddresses);

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

  // Set default tokens
  useEffect(() => {
    const savedSellToken = localStorage.getItem('limitOrderSellToken');
    const savedBuyToken = localStorage.getItem('limitOrderBuyToken');
    
    if (savedSellToken) {
      const token = availableTokens.find(t => t.a?.toLowerCase() === savedSellToken.toLowerCase());
      if (token && token.a) {
        setSellToken({ a: token.a, ticker: token.ticker, name: token.name, decimals: token.decimals });
      }
    } else {
      const defaultSell = availableTokens.find(t => t.a?.toLowerCase() === '0x000000000000000000000000000000000000dead');
      if (defaultSell && defaultSell.a) setSellToken({ a: defaultSell.a, ticker: defaultSell.ticker, name: defaultSell.name, decimals: defaultSell.decimals });
    }
    
    if (savedBuyToken) {
      const token = availableTokens.find(t => t.a?.toLowerCase() === savedBuyToken.toLowerCase());
      if (token && token.a) {
        setBuyTokens([{ a: token.a, ticker: token.ticker, name: token.name, decimals: token.decimals }]);
      }
    } else {
      const defaultBuy = availableTokens.find(t => t.a?.toLowerCase() === '0x2b591e99afe9f32eaa6214f7b7629768c40eeb39');
      if (defaultBuy && defaultBuy.a) setBuyTokens([{ a: defaultBuy.a, ticker: defaultBuy.ticker, name: defaultBuy.name, decimals: defaultBuy.decimals }]);
    }
    
    const savedLimitPrice = localStorage.getItem('limitOrderPrice');
    if (savedLimitPrice && parseFloat(savedLimitPrice) > 0) {
      limitPriceSetByUserRef.current = true;
      isInitialLoadRef.current = false;
    }
  }, []);

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
      setPricePercentage(Math.abs(percentageAboveMarket) > 0.01 ? percentageAboveMarket : null);
    }
  }, [invertPriceDisplay, limitPrice, externalMarketPrice, sellToken, buyTokens, prices]);

  // Notify parent of token changes (pass all buy tokens for chart)
  useEffect(() => {
    if (onTokenChange && (sellToken || buyTokens.some(t => t))) {
      const buyTokenAddresses = buyTokens.map(token => token?.a);
      onTokenChange(sellToken?.a, buyTokenAddresses);
    }
  }, [sellToken, buyTokens, onTokenChange]);

  // Notify parent of loaded invertPriceDisplay on mount
  useEffect(() => {
    if (onInvertPriceDisplayChange) {
      onInvertPriceDisplayChange(invertPriceDisplay);
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
  const sellTokenPrice = sellToken ? prices[sellToken.a]?.price || 0 : 0;
  const firstBuyToken = buyTokens[0];
  const buyTokenPrice = firstBuyToken ? prices[firstBuyToken.a]?.price || 0 : 0;
  
  const sellAmountNum = sellAmount ? parseFloat(removeCommas(sellAmount)) : 0;
  const buyAmountNum = buyAmounts[0] ? parseFloat(removeCommas(buyAmounts[0])) : 0;
  
  const sellUsdValue = sellAmountNum * sellTokenPrice;
  const buyUsdValue = buyAmountNum * buyTokenPrice;

  // Calculate market price (use first buy token for chart)
  const internalMarketPrice = sellTokenPrice && buyTokenPrice ? sellTokenPrice / buyTokenPrice : 0;
  const marketPrice = externalMarketPrice || internalMarketPrice;

  // Sync external limit price changes
  useEffect(() => {
    if (externalLimitPrice !== undefined) {
      limitPriceSetByUserRef.current = true;
      isInitialLoadRef.current = false;
      
      setLimitPrice(externalLimitPrice.toString());
      
      if (sellAmountNum > 0) {
        // Capture current buyTokens to avoid closure issues
        const currentBuyTokens = buyTokens;
        // Update all buy amounts based on the new limit price
        setBuyAmounts((prevAmounts) => prevAmounts.map((_, index) => {
          if (currentBuyTokens[index]) {
            const newBuyAmount = sellAmountNum * externalLimitPrice;
            return formatCalculatedValue(newBuyAmount);
          }
          return '';
        }));
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
        // Capture current buyTokens to avoid closure issues
        const currentBuyTokens = buyTokens;
        // Update all buy amounts based on the new sell amount and limit price
        setBuyAmounts((prevAmounts) => prevAmounts.map((_, index) => {
          if (currentBuyTokens[index]) {
            const newBuyAmount = sellAmountNum * limitPriceNum;
            return formatCalculatedValue(newBuyAmount);
          }
          return '';
        }));
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
        false,                           // _allOrNothing (default to false)
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
            href={`https://scan.v4.testnet.pulsechain.com/tx/${txHash}`}
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
    
    const now = new Date();
    const diffTime = date.getTime() - now.getTime();
    const diffSeconds = diffTime / 1000;
    const MIN_EXPIRATION_SECONDS = 10;
    
    if (diffSeconds < MIN_EXPIRATION_SECONDS) {
      setExpirationError(`Selected date must be at least ${MIN_EXPIRATION_SECONDS} seconds in the future`);
      setShowDatePicker(false);
      return;
    }
    
    setExpirationError(null);
    setSelectedDate(date);
    const diffDays = diffTime / (1000 * 60 * 60 * 24);
    
    if (diffDays > 0) {
      setExpirationDays(diffDays);
      setExpirationInput(diffDays.toString());
    }
    setShowDatePicker(false);
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
  }, [sellToken?.a, buyTokens[0]?.a, prices, invertPriceDisplay, marketPrice, sellAmount, onLimitPriceChange]);

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
    
    // Update all buy amounts based on the new limit price
    const newAmounts = buyAmounts.map((_, index) => {
      if (buyTokens[index]) {
        const newBuyAmount = effectiveSellAmount * newPrice;
        return formatCalculatedValue(newBuyAmount);
      }
      return '';
    });
    setBuyAmounts(newAmounts);
  };

  const handleMaxSellAmount = () => {
    if (!actualBalance) return;
    
    let maxAmount = actualBalance.formatted;
    
    if (sellToken?.a === '0x000000000000000000000000000000000000dead') {
      const balanceNum = parseFloat(maxAmount);
      const reservedGas = 0.1;
      maxAmount = Math.max(0, balanceNum - reservedGas).toString();
    }
    
    setSellAmount(maxAmount);
  };

  const handleSellAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value;
    value = value.replace(/[^0-9.]/g, '');
    
    const parts = value.split('.');
    if (parts.length > 2) {
      value = parts[0] + '.' + parts.slice(1).join('');
    }
    
    lastEditedInputRef.current = 'sell';
    setSellAmount(value);
  };

  const handleBuyAmountChange = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    let value = e.target.value;
    value = value.replace(/[^0-9.]/g, '');
    
    const parts = value.split('.');
    if (parts.length > 2) {
      value = parts[0] + '.' + parts.slice(1).join('');
    }
    
    lastEditedInputRef.current = index;
    const newAmounts = [...buyAmounts];
    newAmounts[index] = value;
    setBuyAmounts(newAmounts);
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
    
    // Auto-calculate buy amount for additional tokens (index > 0) based on limit price
    if (index > 0 && limitPrice && sellAmount && parseFloat(limitPrice) > 0 && parseFloat(removeCommas(sellAmount)) > 0) {
      const newBuyAmounts = [...buyAmounts];
      const sellAmt = parseFloat(removeCommas(sellAmount));
      const price = parseFloat(limitPrice);
      
      // Calculate buy amount based on limit price
      // If inverted: buyAmount = sellAmount * price
      // If not inverted: buyAmount = sellAmount / price
      let calculatedAmount: number;
      if (invertPriceDisplay) {
        calculatedAmount = sellAmt * price;
      } else {
        calculatedAmount = sellAmt / price;
      }
      
      newBuyAmounts[index] = formatCalculatedValue(calculatedAmount);
      setBuyAmounts(newBuyAmounts);
    }
    
    // Note: checkDuplicateTokens is no longer needed since we filter out
    // selected tokens from dropdowns, preventing duplicates at the UI level
  };

  return (
    <>
    <div className="w-full bg-black/80 backdrop-blur-sm border-2 border-[#00D9FF] p-6 h-full shadow-[0_0_30px_rgba(0,217,255,0.3)] overflow-y-auto max-h-[calc(100vh-200px)]">
      {/* Sell Section */}
      <div className="mb-4">
        <label className="text-[#00D9FF] text-sm mb-2 block font-semibold text-left">SELL</label>
        
        {/* Token Selector */}
        <div className="relative mb-3" ref={sellDropdownRef}>
          <button
            onClick={() => setShowSellDropdown(!showSellDropdown)}
            className="w-full bg-black border-2 border-[#00D9FF] p-3 flex items-center justify-between hover:bg-[#00D9FF]/10 transition-all shadow-[0_0_10px_rgba(0,217,255,0.3)]"
          >
            <div className="flex items-center space-x-3">
              {sellToken ? (
                <>
                  <TokenLogo ticker={sellToken.ticker} className="w-6 h-6" />
                  <span className="text-[#00D9FF] font-medium">{formatTokenTicker(sellToken.ticker, chainId)}</span>
                </>
              ) : (
                <span className="text-[#00D9FF]/50">Select token</span>
              )}
            </div>
            <svg className="w-5 h-5 text-[#00D9FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Dropdown */}
          {showSellDropdown && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-black border-2 border-[#00D9FF] z-10 shadow-[0_0_20px_rgba(0,217,255,0.4)]">
              <div className="sticky top-0 p-2 bg-black border-b border-[#00D9FF]/30">
                <input
                  ref={sellSearchRef}
                  type="text"
                  value={sellSearchQuery}
                  onChange={(e) => setSellSearchQuery(e.target.value)}
                  placeholder="Search tokens..."
                  className="w-full bg-black border border-[#00D9FF]/50 p-2 text-[#00D9FF] text-sm placeholder-[#00D9FF]/30 focus:outline-none focus:border-[#00D9FF]"
                />
              </div>
              <div className="max-h-60 overflow-y-auto scrollbar-hide">
                {filteredSellTokens.length === 0 ? (
                  <div className="p-4 text-center text-[#00D9FF]/50 text-sm">No tokens found</div>
                ) : (
                  filteredSellTokens.map((token) => (
                <button
                  key={token.a}
                  onClick={() => {
                    if (token.a) {
                      setSellToken({ a: token.a, ticker: token.ticker, name: token.name, decimals: token.decimals });
                      localStorage.setItem('limitOrderSellToken', token.a);
                      setShowSellDropdown(false);
                      setSellSearchQuery('');
                    }
                  }}
                  className="w-full p-3 flex items-center space-x-3 hover:bg-[#00D9FF]/10 transition-all text-left border-b border-[#00D9FF]/20 last:border-b-0"
                >
                  <TokenLogo ticker={token.ticker} className="w-6 h-6" />
                  <div>
                    <div className="text-[#00D9FF] font-medium">{formatTokenTicker(token.ticker, chainId)}</div>
                    <div className="text-[#00D9FF]/70 text-xs">{token.name}</div>
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
              className="w-full bg-black border-2 border-[#00D9FF] p-3 text-[#00D9FF] text-2xl min-h-[58px] flex items-center cursor-text"
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
              className="w-full bg-black border-2 border-[#00D9FF] p-3 text-[#00D9FF] text-2xl placeholder-[#00D9FF]/30 focus:outline-none focus:border-[#00D9FF] focus:shadow-[0_0_15px_rgba(0,217,255,0.5)] transition-all"
        />
          )}
        </div>
        <div className="flex justify-between items-center mt-2">
          <div className="text-[#00D9FF] text-sm font-semibold">
            {sellUsdValue > 0 ? (
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
              <span className="text-[#00D9FF]/70 text-xs">
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
                  className="text-[#00D9FF] hover:text-white text-xs font-bold transition-colors"
                >
                  MAX
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Swap Button */}
      <div className="flex justify-center items-center my-4">
        <button
          onClick={handleSwapTokens}
          disabled={buyTokens.length > 1}
          className={`p-0 rounded-full transition-all ${
            buyTokens.length > 1 
              ? 'cursor-not-allowed opacity-30' 
              : 'hover:border-[#00D9FF]/10 hover:bg-red cursor-pointer'
          } border-0 border-[#00D9FF]/50 ${
            buyTokens.length === 1 && 'hover:border-[#00D9FF]'
          }`}
          title={buyTokens.length > 1 ? "Cannot swap with multiple tokens" : "Swap tokens and amounts"}
        >
          <ArrowLeftRight className={`w-5 h-5 text-[#00D9FF] rotate-90 ${
            buyTokens.length > 1 
              ? '' 
              : 'group-hover:text-white'
          } transition-colors`} />
        </button>
      </div>

      {/* Buy Section - Multiple Tokens */}
      <div className="mb-4">
        <label className="text-[#00D9FF] text-sm mb-2 block font-semibold text-left">BUY</label>
        
        <div className="space-y-4">
          {buyTokens.map((buyToken, index) => (
            <div key={index}>
              {/* OR Divider */}
              {index > 0 && (
                <div className="flex items-center gap-4 mb-4">
                  <div className="flex-1 h-px bg-[#00D9FF]/20"></div>
                  <span className="text-[#00D9FF]/70 text-sm font-medium px-2">OR</span>
                  <div className="flex-1 h-px bg-[#00D9FF]/20"></div>
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
                        className="flex-1 bg-black border-2 border-[#00D9FF] p-3 flex items-center justify-between hover:bg-[#00D9FF]/10 transition-all shadow-[0_0_10px_rgba(0,217,255,0.3)]"
                      >
                        <div className="flex items-center space-x-3">
                          {buyToken ? (
                            <>
                              <TokenLogo ticker={buyToken.ticker} className="w-6 h-6" />
                              <span className="text-[#00D9FF] font-medium">{formatTokenTicker(buyToken.ticker, chainId)}</span>
                            </>
                          ) : (
                            <span className="text-[#00D9FF]/50">Select token</span>
                          )}
                        </div>
                        <svg className="w-5 h-5 text-[#00D9FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>

                      {/* Delete button */}
                      {index > 0 && (
                        <button
                          onClick={() => handleRemoveBuyToken(index)}
                          className="p-3 h-[52px] bg-red-500/20 hover:bg-red-500/30 border-2 border-red-500/50 transition-colors flex items-center justify-center"
                          title="Remove token"
                        >
                          <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>

                    {/* Dropdown */}
                    {showBuyDropdowns[index] && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-black border-2 border-[#00D9FF] z-10 shadow-[0_0_20px_rgba(0,217,255,0.4)]">
                        <div className="sticky top-0 p-2 bg-black border-b border-[#00D9FF]/30">
                          <input
                            ref={el => { buySearchRefs.current[index] = el; }}
                            type="text"
                            value={buySearchQueries[index] || ''}
                            onChange={(e) => {
                              const newQueries = [...buySearchQueries];
                              newQueries[index] = e.target.value;
                              setBuySearchQueries(newQueries);
                            }}
                            placeholder="Search tokens..."
                            className="w-full bg-black border border-[#00D9FF]/50 p-2 text-[#00D9FF] text-sm placeholder-[#00D9FF]/30 focus:outline-none focus:border-[#00D9FF]"
                          />
                        </div>
                        <div className="max-h-60 overflow-y-auto scrollbar-hide">
                          {getFilteredBuyTokens(index).length === 0 ? (
                            <div className="p-4 text-center text-[#00D9FF]/50 text-sm">No tokens found</div>
                          ) : (
                            getFilteredBuyTokens(index).map((token) => (
                              <button
                                key={token.a}
                                onClick={() => handleBuyTokenSelect(token, index)}
                                className="w-full p-3 flex items-center space-x-3 hover:bg-[#00D9FF]/10 transition-all text-left border-b border-[#00D9FF]/20 last:border-b-0"
                              >
                                <TokenLogo ticker={token.ticker} className="w-6 h-6" />
                                <div>
                                  <div className="text-[#00D9FF] font-medium">{formatTokenTicker(token.ticker, chainId)}</div>
                                  <div className="text-[#00D9FF]/70 text-xs">{token.name}</div>
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
                        className="w-full bg-black border-2 border-[#00D9FF] p-3 text-[#00D9FF] text-2xl min-h-[58px] flex items-center cursor-text"
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
                        className="w-full bg-black border-2 border-[#00D9FF] p-3 text-[#00D9FF] text-2xl placeholder-[#00D9FF]/30 focus:outline-none focus:border-[#00D9FF] focus:shadow-[0_0_15px_rgba(0,217,255,0.5)] transition-all"
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* Add another token button */}
              {index === buyTokens.length - 1 && buyAmounts[index] && buyAmounts[index].trim() !== '' && (
                <>
                  {buyTokens.length < 10 ? (
                    <button
                      onClick={handleAddBuyToken}
                      className="mt-3 w-full py-2 bg-black border-2 border-[#00D9FF]/50 hover:border-[#00D9FF] transition-all flex items-center justify-center space-x-2 opacity-60 hover:opacity-100"
                    >
                      <svg className="w-5 h-5 text-[#00D9FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      <span className="text-[#00D9FF] text-sm">Add alternative token</span>
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
      </div>

      {/* Limit Price Section - Only for first buy token */}
      {buyTokens[0] && (
        <div className="mb-4">
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center gap-2">
              <label className="text-[#FF0080] text-sm font-semibold">LIMIT PRICE</label>
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
            <div className="w-full bg-black border-2 border-[#FF0080] p-3 text-[#FF0080] text-lg min-h-[52px] flex items-center">
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
        </div>
      )}

      {/* Percentage Buttons */}
      {buyTokens[0] && (
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => handlePercentageClick(0, 'above')}
            className="flex-1 py-2 bg-black border-2 border-[#FF0080] text-xs md:text-sm text-[#FF0080] hover:bg-[#FF0080] hover:text-black transition-all font-medium shadow-[0_0_10px_rgba(255,0,128,0.3)]"
          >
            Market
          </button>
          <button
            onClick={() => handlePercentageClick(1, invertPriceDisplay ? 'below' : 'above')}
            className="flex-1 py-2 bg-black border-2 border-[#FF0080] text-xs md:text-sm text-[#FF0080] hover:bg-[#FF0080] hover:text-black transition-all font-medium shadow-[0_0_10px_rgba(255,0,128,0.3)]"
          >
            1% {invertPriceDisplay ? '↓' : '↑'}
          </button>
          <button
            onClick={() => handlePercentageClick(2, invertPriceDisplay ? 'below' : 'above')}
            className="flex-1 py-2 bg-black border-2 border-[#FF0080] text-xs md:text-sm text-[#FF0080] hover:bg-[#FF0080] hover:text-black transition-all font-medium shadow-[0_0_10px_rgba(255,0,128,0.3)]"
          >
            2% {invertPriceDisplay ? '↓' : '↑'}
          </button>
          <button
            onClick={() => handlePercentageClick(5, invertPriceDisplay ? 'below' : 'above')}
            className="flex-1 py-2 bg-black border-2 border-[#FF0080] text-xs md:text-sm text-[#FF0080] hover:bg-[#FF0080] hover:text-black transition-all font-medium shadow-[0_0_10px_rgba(255,0,128,0.3)]"
          >
            5% {invertPriceDisplay ? '↓' : '↑'}
          </button>
          <button
            onClick={() => handlePercentageClick(10, invertPriceDisplay ? 'below' : 'above')}
            className="flex-1 py-2 bg-black border-2 border-[#FF0080] text-xs md:text-sm text-[#FF0080] hover:bg-[#FF0080] hover:text-black transition-all font-medium shadow-[0_0_10px_rgba(255,0,128,0.3)]"
          >
            10% {invertPriceDisplay ? '↓' : '↑'}
          </button>
        </div>
      )}

      {/* Expiration */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <label className="text-[#00D9FF] text-sm font-semibold">EXPIRATION (DAYS)</label>
          {selectedDate && (
            <span className="text-[#00D9FF]/50 text-xs">
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
            className="w-full bg-black border-2 border-[#00D9FF] p-3 text-[#00D9FF] placeholder-[#00D9FF]/30 focus:outline-none focus:border-[#00D9FF] focus:shadow-[0_0_15px_rgba(0,217,255,0.5)] transition-all"
          />
          {expirationDays > 0 && selectedDate && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[#00D9FF]/40 text-xs pointer-events-none">
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
            onClick={() => handleExpirationPreset(1/24)} // 1 hour = 1/24 day
            className={`flex-1 py-1.5 text-xs border transition-all h-[28px] flex items-center justify-center ${
              expirationInput === (1/24).toString() 
                ? 'bg-[#00D9FF]/20 border-[#00D9FF] text-[#00D9FF]'
                : 'bg-[#00D9FF]/10 text-[#00D9FF] border-[#00D9FF]/30 hover:bg-[#00D9FF]/20 hover:border-[#00D9FF]'
            }`}
          >
            1h
          </button>
          <button
            onClick={() => handleExpirationPreset(0.25)} // 6 hours
            className={`flex-1 py-1.5 text-xs border transition-all h-[28px] flex items-center justify-center ${
              expirationInput === '0.25' 
                ? 'bg-[#00D9FF]/20 border-[#00D9FF] text-[#00D9FF]'
                : 'bg-[#00D9FF]/10 text-[#00D9FF] border-[#00D9FF]/30 hover:bg-[#00D9FF]/20 hover:border-[#00D9FF]'
            }`}
          >
            6h
          </button>
          <button
            onClick={() => handleExpirationPreset(0.5)} // 12 hours
            className={`flex-1 py-1.5 text-xs border transition-all h-[28px] flex items-center justify-center ${
              expirationInput === '0.5' 
                ? 'bg-[#00D9FF]/20 border-[#00D9FF] text-[#00D9FF]'
                : 'bg-[#00D9FF]/10 text-[#00D9FF] border-[#00D9FF]/30 hover:bg-[#00D9FF]/20 hover:border-[#00D9FF]'
            }`}
          >
            12h
          </button>
          <button
            onClick={() => handleExpirationPreset(1)} // 24 hours
            className={`flex-1 py-1.5 text-xs border transition-all h-[28px] flex items-center justify-center ${
              expirationInput === '1' 
                ? 'bg-[#00D9FF]/20 border-[#00D9FF] text-[#00D9FF]'
                : 'bg-[#00D9FF]/10 text-[#00D9FF] border-[#00D9FF]/30 hover:bg-[#00D9FF]/20 hover:border-[#00D9FF]'
            }`}
          >
            24h
          </button>
          <button
            onClick={() => handleExpirationPreset(7)}
            className={`flex-1 py-1.5 text-xs border transition-all h-[28px] flex items-center justify-center ${
              expirationInput === '7' 
                ? 'bg-[#00D9FF]/20 border-[#00D9FF] text-[#00D9FF]'
                : 'bg-[#00D9FF]/10 text-[#00D9FF] border-[#00D9FF]/30 hover:bg-[#00D9FF]/20 hover:border-[#00D9FF]'
            }`}
          >
            7d
          </button>
          <button
            onClick={() => handleExpirationPreset(30)}
            className={`flex-1 py-1.5 text-xs border transition-all h-[28px] flex items-center justify-center ${
              expirationInput === '30' 
                ? 'bg-[#00D9FF]/20 border-[#00D9FF] text-[#00D9FF]'
                : 'bg-[#00D9FF]/10 text-[#00D9FF] border-[#00D9FF]/30 hover:bg-[#00D9FF]/20 hover:border-[#00D9FF]'
            }`}
          >
            30d
          </button>
          <button
            onClick={() => handleExpirationPreset(90)}
            className={`flex-1 py-1.5 text-xs border transition-all h-[28px] flex items-center justify-center ${
              expirationInput === '90' 
                ? 'bg-[#00D9FF]/20 border-[#00D9FF] text-[#00D9FF]'
                : 'bg-[#00D9FF]/10 text-[#00D9FF] border-[#00D9FF]/30 hover:bg-[#00D9FF]/20 hover:border-[#00D9FF]'
            }`}
          >
            90d
          </button>
          
          {/* Calendar Date Picker Button */}
          <div ref={datePickerRef} className="relative date-picker-container flex-1">
            <button
              onClick={() => setShowDatePicker(!showDatePicker)}
              className="w-full py-1.5 text-xs bg-[#00D9FF]/10 text-[#00D9FF] border border-[#00D9FF]/30 hover:bg-[#00D9FF]/20 hover:border-[#00D9FF] transition-all h-[28px] flex items-center justify-center"
              title="Select specific date"
            >
              <CalendarIcon className="w-3 h-3" />
            </button>
            
            {/* Calendar Popup */}
            {showDatePicker && (
              <div className="absolute top-full right-0 mt-2 z-[100] w-[440px] bg-black border-2 border-[#00D9FF] rounded-md">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={handleDateSelect}
                  disabled={(date: Date) => date < new Date()}
                  classNames={{
                    caption_label: "text-[#00D9FF]",
                    nav_button: "text-[#00D9FF] border-[#00D9FF]/30 hover:bg-[#00D9FF]/20",
                    head_cell: "text-[#00D9FF]/70",
                    day: "text-[#00D9FF] hover:bg-[#00D9FF]/20",
                    day_selected: "bg-[#00D9FF] text-black font-bold hover:bg-[#00D9FF] hover:text-black",
                    day_today: "bg-[#00D9FF]/20 text-[#00D9FF] font-semibold",
                    day_outside: "text-[#00D9FF]/20 opacity-40",
                    day_disabled: "text-[#00D9FF]/10 opacity-20 cursor-not-allowed",
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Order Summary */}
      {sellAmount && sellToken && parseFloat(removeCommas(sellAmount)) > 0 && !duplicateTokenError && (
        <div className="mb-6">
          <h3 className="text-[#00D9FF] font-semibold mb-3 text-sm text-left">ORDER SUMMARY</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-[#00D9FF]/70">Your Offer:</span>
              <span className="text-[#00D9FF] font-medium">{formatBalanceDisplay(removeCommas(sellAmount))} {formatTokenTicker(sellToken.ticker, chainId)}</span>
            </div>
            
            {/* Listing Fee - always required, paid in native PLS */}
              <div className="flex justify-between items-center">
              <span className="text-[#00D9FF]/70">Listing Fee (in {formatTokenTicker('PLS', chainId)}):</span>
                <span className="text-red-400 font-medium">
                +{parseFloat(formatEther(listingFee)).toString()} {formatTokenTicker('PLS', chainId)}
                </span>
              </div>

            {/* You Pay - only show when selling native PLS */}
            {isNativeToken(sellToken.a) && (
              <div className="flex justify-between items-center pt-0">
                <span className="text-[#00D9FF]">You Pay:</span>
                <span className="text-[#00D9FF] font-medium">
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
              return (
                <div key={`ask-${index}`} className="flex justify-between items-center border-t border-[#00D9FF]/30 pt-2">
                  <span className="text-[#00D9FF]/70">
                    {index === 0 ? `Your Ask${buyTokens.filter((t, idx) => t && buyAmounts[idx] && buyAmounts[idx].trim() !== '').length > 1 ? ' (Either of)' : ''}:` : ''}
                  </span>
                  <span className="text-[#00D9FF] font-medium">
                    {formatBalanceDisplay(removeCommas(amount))} {formatTokenTicker(token.ticker, chainId)}
                  </span>
                </div>
              );
            })}
            
            {/* Fee deducted from buyer */}
            {buyTokens.filter((t, idx) => t && buyAmounts[idx] && buyAmounts[idx].trim() !== '').map((token, index) => {
              const amount = buyAmounts[buyTokens.indexOf(token)];
              if (!token || !amount || amount.trim() === '') return null;
              const feeAmount = parseFloat(removeCommas(amount)) * 0.002;
              return (
                <div key={`fee-${index}`} className="flex justify-between items-center">
                  <span className="text-[#00D9FF]/70">
                    {index === 0 ? 'Their Max Fee (0.2%):' : ''}
                  </span>
                  <span className="text-red-400 font-medium">
                    -{formatBalanceDisplay(feeAmount.toString())} {formatTokenTicker(token.ticker, chainId)}
                  </span>
                </div>
              );
            })}

            <div className="pt-0">
              {buyTokens.filter((t, idx) => t && buyAmounts[idx] && buyAmounts[idx].trim() !== '').map((token, index) => {
                const filteredBuyTokens = buyTokens.filter((t, idx) => t && buyAmounts[idx] && buyAmounts[idx].trim() !== '');
                const amount = buyAmounts[buyTokens.indexOf(token)];
                if (!token || !amount || amount.trim() === '') return null;
                const amountAfterFee = parseFloat(removeCommas(amount)) * 0.998; // Subtract 0.2% fee
                return (
                  <div key={`receive-${index}`} className="flex justify-between items-center">
                    <span className="text-[#00D9FF] font-semibold">
                      {index === 0 ? `You Receive${filteredBuyTokens.length > 1 ? ' (Either of)' : ''}:` : ''}
                    </span>
                    <span className="text-[#00D9FF] font-bold">
                      {formatBalanceDisplay(amountAfterFee.toFixed(6))} {formatTokenTicker(token.ticker, chainId)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Pro Plan - Show token stats when tokens are selected, at least one is eligible for stats, and no duplicates */}
      {sellToken && buyTokens.length > 0 && buyTokens[0] && (showSellStats || showBuyStats || (isTokenEligibleForStats(sellToken) || buyTokens.some(t => isTokenEligibleForStats(t)))) && !duplicateTokenError && 
       !(MAXI_TOKENS.includes(sellToken.a.toLowerCase()) && buyTokens.every(t => t && MAXI_TOKENS.includes(t.a.toLowerCase()))) && (
        <div className="bg-black/80 border-2 border-[#00D9FF]/50 rounded-xl p-6 mb-6 relative overflow-hidden shadow-[0_0_30px_rgba(0,217,255,0.3)]">
          <h3 className="text-[#00D9FF] font-semibold mb-4 text-left">PRO PLAN STATS</h3>
          
          {/* Content with conditional blur */}
          <div className={(PAYWALL_ENABLED && !hasTokenAccess) ? 'blur-md select-none pointer-events-none' : ''}>
            {statsLoading && hasTokenAccess ? (
              <div className="text-[#00D9FF]/60 text-center py-4">Loading token stats...</div>
            ) : statsError && hasTokenAccess ? (
              <div className="text-red-400 text-center py-4">
                <div className="font-semibold mb-2">Failed to load token stats</div>
                <div className="text-xs text-red-300">{statsError.message || 'Unknown error'}</div>
              </div>
            ) : (PAYWALL_ENABLED && !hasTokenAccess) ? (
              // Show placeholder content when no access (for blur effect)
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-[#00D9FF]/70">Progress:</span>
                  <span className="text-[#00D9FF]">22.5%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#00D9FF]/70">Current Market Price:</span>
                  <span className="text-[#00D9FF]">1.1433 HEX</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#00D9FF]/70">Backing per Token:</span>
                  <span className="text-[#00D9FF]">2.1977 HEX</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#00D9FF]/70">Your OTC Price:</span>
                  <span className="text-[#00D9FF]">1.0000 HEX</span>
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
                      <h4 className="text-[#00D9FF] font-medium mb-3 text-left">{formatTokenTicker(sellToken.ticker, chainId)} Stats</h4>
                      <div className="flex justify-between">
                        <span className="text-[#00D9FF]/70">Progress:</span>
                        <span className="text-[#00D9FF]">{(sellStats.dates.progressPercentage * 100).toFixed(1)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#00D9FF]/70">Current Market Price:</span>
                        <span className="text-[#00D9FF]">{sellStats.token.priceHEX.toFixed(4)} {hexDisplayName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#00D9FF]/70">Backing per Token:</span>
                        <span className="text-[#00D9FF]">{sellStats.token.backingPerToken.toFixed(4)} {hexDisplayName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#00D9FF]/70">Market Discount from Backing:</span>
                        <span className={`font-medium ${sellStats.token.discountFromBacking > 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {(sellStats.token.discountFromBacking * 100).toFixed(2)}%
                        </span>
                      </div>
                      {!isBaseToken && (
                        <div className="flex justify-between">
                          <span className="text-[#00D9FF]/70">Market Discount from Mint:</span>
                          <span className={`font-medium ${sellStats.token.discountFromMint > 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {(sellStats.token.discountFromMint * 100).toFixed(2)}%
                          </span>
                        </div>
                      )}
                      <div className="border-t border-[#00D9FF]/30 my-3"></div>
                      <div className="flex justify-between">
                        <span className="text-[#00D9FF]/70">Your OTC Price:</span>
                        <span className="text-[#00D9FF]">{yourPriceInHEX ? yourPriceInHEX.toFixed(4) : 'N/A'} {hexDisplayName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#00D9FF]/70">Your Discount from Backing:</span>
                        <span className={`font-medium ${yourDiscountFromBacking !== null ? (yourDiscountFromBacking > 0 ? 'text-green-400' : 'text-red-400') : 'text-[#00D9FF]/60'}`}>
                          {yourDiscountFromBacking !== null ? (yourDiscountFromBacking * 100).toFixed(2) + '%' : 'N/A'}
                        </span>
                      </div>
                      {!isBaseToken && (
                        <div className="flex justify-between">
                          <span className="text-[#00D9FF]/70">Your Discount from Mint:</span>
                          <span className={`font-medium ${yourDiscountFromMint !== null ? (yourDiscountFromMint > 0 ? 'text-green-400' : 'text-red-400') : 'text-[#00D9FF]/60'}`}>
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
                    <div key={`buy-stats-${buyIndex}`} className="space-y-2 text-sm border-t border-[#00D9FF]/30 pt-4 first:border-t-0 first:pt-0">
                      <h4 className="text-[#00D9FF] font-medium mb-3 text-left">{formatTokenTicker(buyToken.ticker, chainId)} Stats</h4>
                      <div className="flex justify-between">
                        <span className="text-[#00D9FF]/70">Progress:</span>
                        <span className="text-[#00D9FF]">{(buyStats.dates.progressPercentage * 100).toFixed(1)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#00D9FF]/70">Current Market Price:</span>
                        <span className="text-[#00D9FF]">{buyStats.token.priceHEX.toFixed(4)} {hexDisplayName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#00D9FF]/70">Backing per Token:</span>
                        <span className="text-[#00D9FF]">{buyStats.token.backingPerToken.toFixed(4)} {hexDisplayName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#00D9FF]/70">Market Discount from Backing:</span>
                        <span className={`font-medium ${buyStats.token.discountFromBacking > 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {(buyStats.token.discountFromBacking * 100).toFixed(2)}%
                        </span>
                      </div>
                      {!isBaseToken && (
                        <>
                          <div className="flex justify-between">
                            <span className="text-[#00D9FF]/70">Current Mint Price:</span>
                            <span className="text-[#00D9FF]">1 {hexDisplayName}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-[#00D9FF]/70">Market Discount from Mint:</span>
                            <span className={`font-medium ${buyStats.token.discountFromMint > 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {(buyStats.token.discountFromMint * 100).toFixed(2)}%
                            </span>
                          </div>
                        </>
                      )}
                      <div className="border-t border-[#00D9FF]/30 my-3"></div>
                      <div className="flex justify-between">
                        <span className="text-[#00D9FF]/70">Your OTC Price:</span>
                        <span className="text-[#00D9FF]">{yourPriceInHEX ? yourPriceInHEX.toFixed(4) : 'N/A'} {hexDisplayName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#00D9FF]/70">Your Discount from Market:</span>
                        <span className={`font-medium ${yourPriceInHEX !== null && buyStats.token.priceHEX > 0 ?
                          ((yourPriceInHEX - buyStats.token.priceHEX) / buyStats.token.priceHEX > 0 ? 'text-green-400' : 'text-red-400') : 'text-[#00D9FF]/60'}`}>
                          {yourPriceInHEX !== null && buyStats.token.priceHEX > 0 ?
                            ((yourPriceInHEX - buyStats.token.priceHEX) / buyStats.token.priceHEX * 100).toFixed(2) + '%' : 'N/A'}
                        </span>
                      </div>
                      {!isBaseToken && (
                        <div className="flex justify-between">
                          <span className="text-[#00D9FF]/70">Your Discount from Mint:</span>
                          <span className={`font-medium ${yourDiscountFromMint !== null ? (yourDiscountFromMint > 0 ? 'text-green-400' : 'text-red-400') : 'text-[#00D9FF]/60'}`}>
                            {yourDiscountFromMint !== null ? (yourDiscountFromMint * 100).toFixed(2) + '%' : 'N/A'}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-[#00D9FF]/70">Your Discount from Backing:</span>
                        <span className={`font-medium ${yourDiscountFromBacking !== null ? (yourDiscountFromBacking > 0 ? 'text-green-400' : 'text-red-400') : 'text-[#00D9FF]/60'}`}>
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
            <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] rounded-xl flex items-center justify-center z-10">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowPaywallModal(true);
                }}
                className="flex flex-col items-center space-y-3 p-6 rounded-lg bg-black/60 hover:bg-[#00D9FF]/10 transition-all border border-[#00D9FF]/50"
              >
                <Lock className="w-12 h-12 text-[#00D9FF] transition-colors" />
                <div className="text-center">
                  <p className="text-[#00D9FF] font-semibold">Premium Data Access</p>
                  <p className="text-[#00D9FF]/70 text-sm">Click to unlock advanced backing data.</p>
                </div>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Connect/Submit Button */}
      {!isConnected ? (
        <button className="w-full py-4 bg-black text-[#00D9FF] border-0 border-[#00D9FF] font-bold hover:bg-[#00D9FF] hover:text-black transition-all shadow-[0_0_20px_rgba(0,217,255,0.5)] hover:shadow-[0_0_30px_rgba(0,217,255,0.8)] text-lg tracking-wider">
          CONNECT WALLET
        </button>
      ) : (
        <button
          onClick={handleCreateOrder}
          disabled={!sellToken || !sellAmount || buyTokens.some(t => !t) || buyAmounts.some(a => !a || a.trim() === '') || !!duplicateTokenError || !!expirationError || isCreatingOrder || isApproving}
          className="w-full py-4 bg-[#00D9FF] text-black border-2 border-[#00D9FF] font-bold hover:bg-black hover:text-[#00D9FF] text-lg tracking-wider disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isApproving && <Loader2 className="w-5 h-5 animate-spin" />}
          {isCreatingOrder && !isApproving && <Loader2 className="w-5 h-5 animate-spin" />}
          {isApproving ? 'APPROVING...' : isCreatingOrder ? 'CREATING ORDER...' : 'CREATE LIMIT ORDER'}
        </button>
      )}
    </div>
    
    {/* Paywall Modal - Rendered outside form container for full-page overlay */}
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
  </>
  );
}
