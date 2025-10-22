'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowLeftRight, Lock } from 'lucide-react';
import PaywallModal from './PaywallModal';
import { Slider } from '@/components/ui/slider';
import { getTokenInfo, getTokenInfoByIndex, formatTokenTicker, parseTokenAmount, formatTokenAmount } from '@/utils/tokenUtils';
import { TOKEN_CONSTANTS } from '@/constants/crypto';
import { MORE_COINS } from '@/constants/more-coins';
import { useTokenStats } from '@/hooks/crypto/useTokenStats';
import { useTokenPrices } from '@/hooks/crypto/useTokenPrices';
import { useContractWhitelist } from '@/hooks/contracts/useContractWhitelist';
import { useOTCTrade } from '@/hooks/contracts/useOTCTrade';
import { parseEther, formatEther } from 'viem';
import { useBalance, usePublicClient } from 'wagmi';
import { useTransaction } from '@/context/TransactionContext';
import { useTokenApproval, isNativeToken } from '@/utils/tokenApproval';
import { useTokenAccess } from '@/context/TokenAccessContext';
import { PAYWALL_ENABLED, REQUIRED_PARTY_TOKENS, REQUIRED_TEAM_TOKENS, PAYWALL_TITLE, PAYWALL_DESCRIPTION } from '@/config/paywall';
import { validateAmount, validateAmountStrict, removeCommas, sanitizeAmount } from '@/utils/amountValidation';
import { waitForTransactionWithTimeout, TRANSACTION_TIMEOUTS } from '@/utils/transactionTimeout';

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

// Contract whitelist mapping - index to token address
const CONTRACT_WHITELIST_MAP = {
  0: '0x95b303987a60c71504d99aa1b13b4da07b0790ab', // PLSX - PulseX
  1: '0xefd766ccb38eaf1dfd701853bfce31359239f305', // weDAI - Wrapped DAI from Eth
  2: '0x000000000000000000000000000000000000dead', // PLS - Pulse
  3: '0x2fa878ab3f87cc1c9737fc071108f904c0b0c95d', // INC - Incentive
  4: '0x2b591e99afe9f32eaa6214f7b7629768c40eeb39', // HEX - HEX on Pls
  5: '0x0deed1486bc52aa0d3e6f8849cec5add6598a162', // stPLS (Liquid Loans) - Not added to dropdown
  6: '0x02dcdd04e3f455d838cd1249292c58f3b79e3c3c', // weWETH - Wrapped WETH from Eth
  7: '0x15d38573d2feeb82e7ad5187ab8c1d52810b1f07', // weUSDC - Wrapped USDC from Eth (INACTIVE) Not added to dropdown
  8: '0x0cb6f5a34ad42ec934882a05265a7d5f59b51a2f', // weUSDT - Wrapped USDT from Eth (INACTIVE) Not added to dropdown
  9: '0x115f3fa979a936167f9d208a7b7c4d85081e84bd', // 2PHUX - 2PHUX Governance Token Not added to dropdown
} as const;

// Active tokens only (for trading)
const ACTIVE_CONTRACT_INDICES = [0, 1, 2, 3, 4, 5, 6, 9];

// Inactive tokens
const INACTIVE_CONTRACT_INDICES = [7, 8];

// MAXI tokens (not in contract whitelist but kept for reference)
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

// Custom dropdown order - specify the order you want tokens to appear
const DROPDOWN_ORDER = [
  4, // HEX first
  2, // PLS fourth
  0, // PLSX second
  1, // weDAI third
  3, // INC fifth
  6, // weWETH seventh
  // Inactive tokens
  // 7, // weUSDC
  // 8, // weUSDT
];

// Combined buy side whitelist - ordered by DROPDOWN_ORDER, then MAXI tokens
const BUY_WHITELISTED_TOKENS = [
  // Contract tokens in custom order
  ...DROPDOWN_ORDER.map(index => CONTRACT_WHITELIST_MAP[index as keyof typeof CONTRACT_WHITELIST_MAP]),

  // MAXI tokens at the end
  ...MAXI_TOKENS,
];

// Whitelisted tokens for OTC trading - SELL SIDE (what you can offer)
// Uses the same contract whitelist mapping and dropdown order as buy side
const SELL_WHITELISTED_TOKENS = [
  // Contract tokens in custom order (same as buy side)
  ...DROPDOWN_ORDER.map(index => CONTRACT_WHITELIST_MAP[index as keyof typeof CONTRACT_WHITELIST_MAP]),

  // MAXI tokens at the end
  ...MAXI_TOKENS,
];



interface CreatePositionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTransactionStart?: () => void;
  onTransactionEnd?: () => void;
  onTransactionSuccess?: (message?: string, txHash?: string) => void;
  onTransactionError?: (error?: string) => void;
  onOrderCreated?: (sellToken?: TokenOption, buyToken?: TokenOption) => void; // Callback to refresh data and navigate
}

interface TokenOption {
  address: string;
  ticker: string;
  name: string;
  logo: string;
  decimals: number;
}

export function CreatePositionModal({
  isOpen,
  onClose,
  onTransactionStart,
  onTransactionEnd,
  onTransactionSuccess,
  onTransactionError,
  onOrderCreated
}: CreatePositionModalProps) {
  const [showPaywallModal, setShowPaywallModal] = useState(false);

  // Token-gating - use centralized validation
  const { hasTokenAccess, partyBalance, teamBalance, isChecking: checkingTokenBalance } = useTokenAccess();

  // Default initial tokens
  const DEFAULT_SELL_TOKEN = '0x2b591e99afe9f32eaa6214f7b7629768c40eeb39'; // HEX
  const DEFAULT_BUY_TOKEN = '0x0d86eb9f43c57f6ff3bc9e23d8f9d82503f0e84b'; // MAXI

  // Fetch token stats from LookIntoMaxi API - only if user has access
  const { tokenStats, isLoading: statsLoading, error: statsError } = useTokenStats({ 
    enabled: PAYWALL_ENABLED ? hasTokenAccess : true 
  });


  // Contract functions
  const { placeOrder, isWalletConnected, address } = useContractWhitelist();
  const { setTransactionPending } = useTransaction();

  // Public client for manual balance checks
  const publicClient = usePublicClient();

  // Contract address for token approvals
  // Get contract address and chain from hooks
  const { contractAddress: OTC_CONTRACT_ADDRESS, chainId: currentChainId } = useOTCTrade();

  // Handle close - let AnimatePresence handle the timing
  const handleClose = () => {
    setOrderError(null); // Clear any error messages when closing
    setApprovalError(null);
    onClose();
  };

  const handleApproveToken = async () => {
    if (!needsApproval || !sellToken) {
      setApprovalError('No token approval needed');
      return;
    }

    setApprovalError(null);
    setIsLocalApproving(true); // Set local approving state
    setTransactionPending(true);
    onTransactionStart?.();

    try {

      const txHash = await approveToken();

      // Wait for the approval transaction to be confirmed

      // Wait for the allowance to be updated (this indicates approval is complete)
      let attempts = 0;
      const maxAttempts = 90; // 90 seconds max wait (matches APPROVAL_VERIFICATION timeout)

      const waitForApproval = async () => {
        const startTime = Date.now();
        const APPROVAL_TIMEOUT_MS = TRANSACTION_TIMEOUTS.APPROVAL_VERIFICATION;
        
        try {
          while (attempts < maxAttempts) {
            // Check if we've exceeded the timeout
            if (Date.now() - startTime > APPROVAL_TIMEOUT_MS) {
              throw new Error('Approval verification timed out. Please check your wallet and try again.');
            }

            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
            attempts++;

            // Check if approval is now complete
            if (tokenNeedsApproval === false || isApproved === true) {
              handleCreateDeal();
              return;
            }

          }

          // If we get here, approval didn't complete in time
          throw new Error('Approval verification timed out after 90 seconds. Transaction may still be pending.');
        } catch (error: any) {
          setApprovalError(error.message || 'Approval verification failed');
          setOrderError(error.message || 'Approval verification failed');
        } finally {
          // Clear approval loading state after the entire process
          setIsLocalApproving(false);
          setTransactionPending(false);
          onTransactionEnd?.();
        }
      };

      waitForApproval();
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to approve token. Please try again.';
      setApprovalError(errorMessage);
      onTransactionError?.(errorMessage);
      setIsLocalApproving(false); // Clear approval loading state on error
      setTransactionPending(false);
      onTransactionEnd?.();
    }
  };

  const [sellToken, setSellToken] = useState<TokenOption | null>(() => {
    if (typeof window !== 'undefined') {
      const stored = sessionStorage.getItem('sellToken');
      if (stored) {
        const tokenInfo = getTokenInfo(stored);
        return {
          address: stored,
          ticker: tokenInfo.ticker,
          name: tokenInfo.name,
          logo: tokenInfo.logo,
          decimals: tokenInfo.decimals
        };
      }
    }
    const tokenInfo = getTokenInfo(DEFAULT_SELL_TOKEN);
    return {
      address: DEFAULT_SELL_TOKEN,
      ticker: tokenInfo.ticker,
      name: tokenInfo.name,
      logo: tokenInfo.logo,
      decimals: tokenInfo.decimals
    };
  });

  const [buyTokens, setBuyTokens] = useState<(TokenOption | null)[]>(() => {
    if (typeof window !== 'undefined') {
      const stored = sessionStorage.getItem('buyTokens');
      if (stored) {
        try {
          const addresses = JSON.parse(stored);
          return addresses.map((addr: string) => {
            const tokenInfo = getTokenInfo(addr);
        return {
              address: addr,
          ticker: tokenInfo.ticker,
          name: tokenInfo.name,
          logo: tokenInfo.logo,
          decimals: tokenInfo.decimals
        };
          });
        } catch (e) {
          // Fall through to default
        }
      }
    }
    const tokenInfo = getTokenInfo(DEFAULT_BUY_TOKEN);
    return [{
      address: DEFAULT_BUY_TOKEN,
      ticker: tokenInfo.ticker,
      name: tokenInfo.name,
      logo: tokenInfo.logo,
      decimals: tokenInfo.decimals
    }];
  });

  const [sellAmount, setSellAmount] = useState(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('sellAmount') || '';
    }
    return '';
  });

  const [buyAmounts, setBuyAmounts] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      const stored = sessionStorage.getItem('buyAmounts');
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch (e) {
          // Fall through to default
        }
      }
    }
    return [''];
  });

  const [expirationDays, setExpirationDays] = useState(() => {
    if (typeof window !== 'undefined') {
      return Number(sessionStorage.getItem('expirationDays')) || 7;
    }
    return 7;
  });

  // Get token prices for conversion to HEX terms (after tokens are initialized)
  const tokenAddresses = useMemo(() => {
    const addresses = [
      '0x2b591e99afe9f32eaa6214f7b7629768c40eeb39', // HEX
    ];
    if (sellToken?.address) addresses.push(sellToken.address);
    buyTokens.forEach(token => {
      if (token?.address) addresses.push(token.address);
    });
    return addresses;
  }, [sellToken?.address, buyTokens]);
  
  const { prices: tokenPrices } = useTokenPrices(tokenAddresses);
  
  // Debug tokenPrices
  useEffect(() => {
  }, [tokenPrices, tokenAddresses]);

  // Lock scrolling when modal is open
  useEffect(() => {
    if (isOpen) {
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
  }, [isOpen]);

  // Token approval state
  const [approvalError, setApprovalError] = useState<string | null>(null);

  // Helper function to remove commas for calculations
  // Validation error states
  const [sellAmountError, setSellAmountError] = useState<string | null>(null);
  const [buyAmountErrors, setBuyAmountErrors] = useState<(string | null)[]>(['']);
  const [duplicateTokenError, setDuplicateTokenError] = useState<string | null>(null);
  const [maxiTokenError, setMaxiTokenError] = useState<string | null>(null);

  // Token approval hook - only for ERC20 tokens (not native PLS)
  const sellAmountWei = sellToken && sellAmount ? parseTokenAmount(removeCommas(sellAmount), sellToken.decimals) : 0n;
  const needsApproval = Boolean(sellToken && !isNativeToken(sellToken.address) && sellAmountWei > 0n);

  // Debug logging for approval

  const {
    allowance,
    needsApproval: tokenNeedsApproval,
    isApproved,
    isApproving,
    approveToken
  } = useTokenApproval(
    needsApproval && sellToken ? sellToken.address as `0x${string}` : '0x0000000000000000000000000000000000000000' as `0x${string}`,
    (OTC_CONTRACT_ADDRESS || '0x0000000000000000000000000000000000000000') as `0x${string}`,
    sellAmountWei
  );

  // State for order creation
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  
  // Local state for approval process (to maintain spinner throughout entire approval + creation flow)
  const [isLocalApproving, setIsLocalApproving] = useState(false);

  // Get wallet balances for selected tokens
  const { data: sellTokenBalance, isLoading: sellBalanceLoading, error: sellBalanceError } = useBalance({
    address: address,
    token: isNativeToken(sellToken?.address || '') ? undefined : sellToken?.address as `0x${string}`,
    chainId: currentChainId,
    query: {
      enabled: !!address && !!sellToken,
      retry: 3,
    }
  });

  // Removed buyTokenBalance - not needed for ask side

  // Debug logging for balance issues

  // UI Debug logging

  // Helper function to format numbers with commas
  const formatNumberWithCommas = (value: string): string => {
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

  // Helper function to format balance display with limited precision
  const formatBalanceDisplay = (balance: string): string => {
    if (!balance) return '';
    
    const num = parseFloat(balance);
    if (isNaN(num)) return balance;
    
    // If the number is 0 or very small, show up to 8 decimals
    if (num === 0) return '0';
    if (num < 0.0001) {
      return num.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 8
      });
    }
    
    // For larger numbers, show up to 4 decimal places
    return num.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 4
    });
  };

  // Helper function to convert any token price to HEX terms
  const getTokenPriceInHex = (tokenAddress: string): number | null => {
    if (!tokenPrices) {
      return null;
    }
    
    const hexAddress = '0x2b591e99afe9f32eaa6214f7b7629768c40eeb39';
    const tokenUsdPrice = tokenPrices[tokenAddress]?.price;
    const hexUsdPrice = tokenPrices[hexAddress]?.price;
    
    
    if (!tokenUsdPrice || !hexUsdPrice || hexUsdPrice === 0) return null;
    
    // Convert: 1 token unit -> USD -> HEX equivalent
    const priceInHex = tokenUsdPrice / hexUsdPrice;
    return priceInHex;
  };

  // Helper function to preserve cursor position during formatting with validation
  const handleAmountChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (value: string) => void,
    inputRef: React.RefObject<HTMLInputElement>,
    token: TokenOption | null,
    setError: (error: string | null) => void
  ) => {
    const input = e.target;
    const rawValue = removeCommas(input.value);

    // Sanitize input first
    const sanitized = sanitizeAmount(rawValue);

    // Only update if value is valid or empty
    if (sanitized === '' || /^\d*\.?\d*$/.test(sanitized)) {
      setter(sanitized);

      // Validate the amount if we have a token
      if (token && sanitized !== '') {
        const validation = validateAmount(sanitized, token.decimals);
        if (!validation.valid) {
          setError(validation.error || 'Invalid amount');
        } else {
          setError(null);
        }
      } else {
        setError(null);
      }

      // Use a more reliable approach with double requestAnimationFrame
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (inputRef.current) {
            // Calculate cursor position more intelligently
            const formattedValue = formatNumberWithCommas(sanitized);
            const originalCursorPos = input.selectionStart || 0;
            const originalValue = input.value;

            // If the user is typing at the end, keep cursor at the end
            if (originalCursorPos >= originalValue.length - 1) {
              inputRef.current.setSelectionRange(formattedValue.length, formattedValue.length);
            } else {
              // For middle positions, try to maintain relative position
              const digitsBeforeCursor = originalValue.substring(0, originalCursorPos).replace(/,/g, '').length;
              const newCursorPos = Math.min(digitsBeforeCursor, formattedValue.length);
              inputRef.current.setSelectionRange(newCursorPos, newCursorPos);
            }
          }
        });
      });
    }
  };

  // Function to swap offer and buy tokens/amounts
  const handleSwapTokens = () => {
    // Can only swap if there's exactly one buy token
    if (buyTokens.length === 1) {
    const tempToken = sellToken;
      setSellToken(buyTokens[0]);
      setBuyTokens([tempToken]);

    // Swap amounts
    const tempAmount = sellAmount;
      setSellAmount(buyAmounts[0]);
      setBuyAmounts([tempAmount]);
    }
  };
  const [showSellDropdown, setShowSellDropdown] = useState(false);
  const [showBuyDropdowns, setShowBuyDropdowns] = useState<boolean[]>([false]);

  // Refs for dropdown containers
  const sellDropdownRef = useRef<HTMLDivElement>(null);
  const buyDropdownRefs = useRef<(HTMLDivElement | null)[]>([]);
  const sellAmountRef = useRef<HTMLInputElement>(null);
  const buyAmountRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Helper to check if token is eligible for stats (MAXI tokens only, regardless of data availability)
  const isTokenEligibleForStats = (token: TokenOption | null) => {
    if (!token) return false;
    return MAXI_TOKENS.includes(token.address.toLowerCase());
  };

  // Helper to determine if a token should show stats (exclude HEX and other non-backed tokens)
  const shouldShowTokenStats = (token: TokenOption | null) => {
    if (!token) return false;
    // Map wrapped tokens (we*) to their ethereum versions (e*) for stats lookup
    // For tokens with multiple versions (DECI, LUCKY, TRIO, BASE), find the highest version
    const tokensWithVersions = ['DECI', 'LUCKY', 'TRIO', 'BASE'];
    let tokenKey: string;
    
    if (token.ticker.startsWith('we')) {
      const baseTicker = token.ticker.slice(2); // Remove 'we' prefix
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

  // Check for chain mismatch between sell and buy tokens
  const hasChainMismatch = () => {
    if (!sellToken || buyTokens.length === 0) return false;
    
    const isEthereumWrappedSell = sellToken.ticker.startsWith('we') || sellToken.ticker.startsWith('e');
    
    // Check if ANY buy token has a chain mismatch
    return buyTokens.some(buyToken => {
      if (!buyToken) return false;
      const isEthereumWrappedBuy = buyToken.ticker.startsWith('we') || buyToken.ticker.startsWith('e');
    return (isEthereumWrappedSell && !isEthereumWrappedBuy) || (!isEthereumWrappedSell && isEthereumWrappedBuy);
    });
  };
  
  const showSellStats = !hasChainMismatch() && shouldShowTokenStats(sellToken);
  const showBuyStats = !hasChainMismatch() && buyTokens.some(token => shouldShowTokenStats(token));
  const gridColsClass = (showSellStats && showBuyStats) ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1';

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
      // If buying HEX (or variant), your price is buyAmount/sellAmount HEX per sellToken
      const price = parseFloat(removeCommas(buyAmount)) / parseFloat(removeCommas(sellAmount));
      return price;
    } else if (isHexVariant(sellToken.ticker)) {
      // If selling HEX (or variant), your price is sellAmount/buyAmount HEX per buyToken
      const price = parseFloat(removeCommas(sellAmount)) / parseFloat(removeCommas(buyAmount));
      return price;
    } else {
      // For any other token pair, convert using DexScreener prices
      const buyTokenPriceInHex = getTokenPriceInHex(buyToken.address);
      if (buyTokenPriceInHex) {
        // Convert: buyAmount of buyToken -> HEX equivalent, then divide by sellAmount
        const buyAmountInHex = parseFloat(removeCommas(buyAmount)) * buyTokenPriceInHex;
        const pricePerSellToken = buyAmountInHex / parseFloat(removeCommas(sellAmount));
        return pricePerSellToken;
      } else {
      }
    }
    return null;
  }, [sellToken, buyTokens, sellAmount, buyAmounts, tokenPrices]);

  // Get whitelisted token options for sell side
  const sellTokenOptions: TokenOption[] = SELL_WHITELISTED_TOKENS.map(address => {
    const tokenInfo = getTokenInfo(address);
    return {
      address,
      ticker: tokenInfo.ticker,
      name: tokenInfo.name,
      logo: tokenInfo.logo,
      decimals: tokenInfo.decimals
    };
  }).filter(token => token.ticker); // Filter out any invalid tokens

  // Get whitelisted token options for buy side
  const buyTokenOptions: TokenOption[] = BUY_WHITELISTED_TOKENS.map(address => {
    const tokenInfo = getTokenInfo(address);
    return {
      address,
      ticker: tokenInfo.ticker,
      name: tokenInfo.name,
      logo: tokenInfo.logo,
      decimals: tokenInfo.decimals
    };
  }).filter(token => token.ticker); // Filter out any invalid tokens

  // Helper function to get token index from address (for sell tokens)
  const getSellTokenIndex = (address: string): number => {
    const index = SELL_WHITELISTED_TOKENS.findIndex(tokenAddress =>
      tokenAddress.toLowerCase() === address.toLowerCase()
    );
    return index;
  };

  // Helper function to get token index from address (for buy tokens)
  const getBuyTokenIndex = (address: string): number => {
    // Find the contract index, not the position in BUY_WHITELISTED_TOKENS
    for (const [index, tokenAddress] of Object.entries(CONTRACT_WHITELIST_MAP)) {
      if (tokenAddress.toLowerCase() === address.toLowerCase()) {
        return parseInt(index);
      }
    }
    return -1;
  };

  // Handle MAX button clicks
  const handleMaxSellAmount = () => {
    if (sellTokenBalance) {
      const balance = sellTokenBalance.formatted;
      setSellAmount(balance);
    }
  };

  // Add a new buy token field
  const handleAddBuyToken = () => {
    if (buyTokens.length >= 10) {
      setOrderError('Maximum of 10 buy tokens allowed');
      return;
    }
    setBuyTokens([...buyTokens, null]);
    setBuyAmounts([...buyAmounts, '']);
    setBuyAmountErrors([...buyAmountErrors, null]);
    setShowBuyDropdowns([...showBuyDropdowns, false]);
  };

  // Remove a buy token field
  const handleRemoveBuyToken = (index: number) => {
    if (buyTokens.length > 1) {
      setBuyTokens(buyTokens.filter((_, i) => i !== index));
      setBuyAmounts(buyAmounts.filter((_, i) => i !== index));
      setBuyAmountErrors(buyAmountErrors.filter((_, i) => i !== index));
      setShowBuyDropdowns(showBuyDropdowns.filter((_, i) => i !== index));
      setDuplicateTokenError(null); // Clear duplicate error when removing
    }
  };

  // Check for duplicate tokens
  const checkDuplicateTokens = (tokens: (TokenOption | null)[]) => {
    const addresses = tokens
      .filter(token => token !== null)
      .map(token => token!.address.toLowerCase());
    
    const duplicates = addresses.filter((addr, index) => addresses.indexOf(addr) !== index);
    
    if (duplicates.length > 0) {
      const token = tokens.find(t => t && t.address.toLowerCase() === duplicates[0]);
      setDuplicateTokenError(`You cannot select ${token?.ticker} multiple times`);
      return true;
    }
    
    setDuplicateTokenError(null);
    return false;
  };

  // Check for MAXI token presence - runs whenever tokens change
  useEffect(() => {
    if (!sellToken || buyTokens.length === 0 || !buyTokens[0]) {
      setMaxiTokenError(null);
      return;
    }

    const isMaxiToken = (address: string) => {
      return MAXI_TOKENS.some(
        maxiAddress => maxiAddress.toLowerCase() === address.toLowerCase()
      );
    };

    const sellIsMaxiToken = isMaxiToken(sellToken.address);
    const anyBuyIsMaxiToken = buyTokens.some(token => token && isMaxiToken(token.address));

    if (!sellIsMaxiToken && !anyBuyIsMaxiToken) {
      setMaxiTokenError('At least one token must be a MAXI token (MAXI, DECI, LUCKY, TRIO, BASE, or their wrapped versions)');
    } else {
      setMaxiTokenError(null);
    }
  }, [sellToken, buyTokens]);

  // Manual balance check for debugging
  const checkBalanceManually = async () => {
    if (!address || !sellToken || !publicClient) return;

    try {
      if (sellToken.address === '0x0') {
        // Native PLS balance
        const balance = await publicClient.getBalance({ address: address as `0x${string}` });
      } else {
        // ERC20/PRC20 balance
        const balance = await publicClient.readContract({
          address: sellToken.address as `0x${string}`,
          abi: [
            {
              name: 'balanceOf',
              type: 'function',
              stateMutability: 'view',
              inputs: [{ name: 'account', type: 'address' }],
              outputs: [{ name: '', type: 'uint256' }],
            },
          ],
          functionName: 'balanceOf',
          args: [address as `0x${string}`],
        });
      }
    } catch (error) {
    }
  };

  const handleCreateDeal = async () => {
    if (!isWalletConnected) {
      setOrderError('Please connect your wallet to create an order');
      return;
    }

    // Check all buy tokens are filled
    const hasEmptyBuyToken = buyTokens.some(token => !token);
    const hasEmptyBuyAmount = buyAmounts.some(amount => !amount);
    
    if (!sellToken || hasEmptyBuyToken || !sellAmount || hasEmptyBuyAmount) {
      setOrderError('Please fill in all required fields');
      return;
    }

    // Check for duplicate buy tokens
    if (checkDuplicateTokens(buyTokens)) {
      setOrderError(duplicateTokenError || 'Duplicate tokens detected');
      return;
    }

    // Check if the sell token matches any buy token
    for (const buyToken of buyTokens) {
      if (buyToken && sellToken.address === buyToken.address) {
      setOrderError(`Cannot trade ${sellToken.ticker} for ${buyToken.ticker}. Please select different tokens for your offer and ask.`);
      return;
      }
    }

    // MAXI token check (already validated in real-time, but check again for safety)
    if (maxiTokenError) {
      setOrderError(maxiTokenError);
      return;
    }

    // Strict validation before submission
    const sellValidation = validateAmountStrict(sellAmount, sellToken.decimals);
    if (!sellValidation.valid) {
      setSellAmountError(sellValidation.error || 'Invalid sell amount');
      setOrderError(`Sell amount error: ${sellValidation.error}`);
      return;
    }

    // Validate all buy amounts
    for (let i = 0; i < buyTokens.length; i++) {
      const buyToken = buyTokens[i];
      const buyAmount = buyAmounts[i];
      if (buyToken && buyAmount) {
    const buyValidation = validateAmountStrict(buyAmount, buyToken.decimals);
    if (!buyValidation.valid) {
          const errors = [...buyAmountErrors];
          errors[i] = buyValidation.error || 'Invalid buy amount';
          setBuyAmountErrors(errors);
          setOrderError(`Buy amount error for ${buyToken.ticker}: ${buyValidation.error}`);
      return;
        }
      }
    }

    setIsCreatingOrder(true);
    setIsLocalApproving(false); // Clear approval loading state when starting order creation
    setOrderError(null);
    setApprovalError(null);
    setTransactionPending(true);
    onTransactionStart?.();

    try {
      // Convert amounts to wei using correct token decimals
      const sellAmountWei = parseTokenAmount(removeCommas(sellAmount), sellToken.decimals);

      // Convert all buy amounts and get indices
      const buyTokensIndexes: number[] = [];
      const buyAmountsWei: bigint[] = [];

      for (let i = 0; i < buyTokens.length; i++) {
        const buyToken = buyTokens[i];
        const buyAmount = buyAmounts[i];

        if (buyToken && buyAmount) {
          const buyAmountWei = parseTokenAmount(removeCommas(buyAmount), buyToken.decimals);
      const buyTokenIndex = getBuyTokenIndex(buyToken.address);
          
      if (buyTokenIndex === -1) {
            throw new Error(`Invalid buy token selected: ${buyToken.ticker}`);
          }
          
          buyTokensIndexes.push(buyTokenIndex);
          buyAmountsWei.push(buyAmountWei);
        }
      }

      // Calculate expiration time (current time + expiration days)
      const expirationTime = BigInt(Math.floor(Date.now() / 1000) + (expirationDays * 24 * 60 * 60));

      // Prepare order details
      const orderDetails = {
        sellToken: sellToken.address as `0x${string}`,
        sellAmount: sellAmountWei,
        buyTokensIndex: buyTokensIndexes,
        buyAmounts: buyAmountsWei,
        expirationTime: expirationTime
      };


      // Call the contract function - only send value if selling native PLS
      const value = sellToken.address === '0x000000000000000000000000000000000000dead' ? sellAmountWei : undefined;
      const txHash = await placeOrder(orderDetails, value);


      // Wait for transaction confirmation with proper timeout handling
      if (publicClient) {
      const receipt = await waitForTransactionWithTimeout(
        publicClient,
        txHash as `0x${string}`,
        TRANSACTION_TIMEOUTS.TRANSACTION
      );
      }


      // Refresh data and navigate to show the new order
      onOrderCreated?.(sellToken, buyTokens[0] || undefined);

      // Show success toast with transaction link
      onTransactionSuccess?.('Order created successfully! Your deal is now live on the marketplace.', txHash);

      handleClose();

    } catch (error: any) {
      const errorMessage = error.message || 'Failed to create order. Please try again.';
      setOrderError(errorMessage);
      onTransactionError?.(errorMessage);
    } finally {
      setIsCreatingOrder(false);
      setTransactionPending(false);
      onTransactionEnd?.();
    }
  };

  const handleSellTokenSelect = (token: TokenOption) => {
    setSellToken(token);
    setShowSellDropdown(false);
  };

  const handleBuyTokenSelect = (token: TokenOption, index: number) => {
    const newBuyTokens = [...buyTokens];
    newBuyTokens[index] = token;
    setBuyTokens(newBuyTokens);
    
    const newDropdowns = [...showBuyDropdowns];
    newDropdowns[index] = false;
    setShowBuyDropdowns(newDropdowns);
    
    // Check for duplicates
    checkDuplicateTokens(newBuyTokens);
  };

  const handleSellDropdownToggle = () => {
    setShowSellDropdown(!showSellDropdown);
    setShowBuyDropdowns(showBuyDropdowns.map(() => false)); // Close all buy dropdowns
  };

  const handleBuyDropdownToggle = (index: number) => {
    const newDropdowns = [...showBuyDropdowns];
    newDropdowns[index] = !newDropdowns[index];
    setShowBuyDropdowns(newDropdowns);
    setShowSellDropdown(false); // Close sell dropdown
    
    // Close other buy dropdowns
    for (let i = 0; i < newDropdowns.length; i++) {
      if (i !== index) {
        newDropdowns[i] = false;
      }
    }
    setShowBuyDropdowns(newDropdowns);
  };

  // Block body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    // Cleanup on unmount
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // Handle click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (sellDropdownRef.current && !sellDropdownRef.current.contains(event.target as Node)) {
        setShowSellDropdown(false);
      }
      
      // Check all buy dropdown refs
      buyDropdownRefs.current.forEach((ref, index) => {
        if (ref && !ref.contains(event.target as Node)) {
          const newDropdowns = [...showBuyDropdowns];
          newDropdowns[index] = false;
          setShowBuyDropdowns(newDropdowns);
        }
      });
    };

    if (showSellDropdown || showBuyDropdowns.some(show => show)) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSellDropdown, showBuyDropdowns]);

  // Save state to sessionStorage whenever it changes
  useEffect(() => {
    if (sellToken) {
      sessionStorage.setItem('sellToken', sellToken.address);
    }
  }, [sellToken]);

  useEffect(() => {
    const addresses = buyTokens.filter(t => t !== null).map(t => t!.address);
    sessionStorage.setItem('buyTokens', JSON.stringify(addresses));
  }, [buyTokens]);

  useEffect(() => {
    sessionStorage.setItem('sellAmount', sellAmount);
  }, [sellAmount]);

  useEffect(() => {
    sessionStorage.setItem('buyAmounts', JSON.stringify(buyAmounts));
  }, [buyAmounts]);

  useEffect(() => {
    sessionStorage.setItem('expirationDays', expirationDays.toString());
  }, [expirationDays]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="create-position-modal"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onAnimationComplete={() => {
            // Animation completed
          }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-2"
          onClick={handleClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            onAnimationComplete={() => {
              // Animation completed
            }}
            className="bg-black border-2 border-white/10 rounded-2xl p-8 w-full max-w-2xl h-[calc(100vh-3rem)] max-h-[900px] relative flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={handleClose}
              className="absolute top-4 right-4 text-gray-400/80 hover:text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>

            {/* Header */}
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-white mb-2">Create OTC Deal</h2>
            </div>

            {/* Trade Form */}
            <div className="flex-1 overflow-y-auto scrollbar-hide">
              {/* Side by Side Trade Sections */}
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-2 items-start">
                {/* You Offer Section */}
                <div className="bg-white/5 rounded-xl p-6">
                  <h3 className="text-white font-semibold mb-4">Your Offer</h3>

                  {/* Token Selector */}
                  <div className="relative mb-4" ref={sellDropdownRef}>
                    <button
                      onClick={handleSellDropdownToggle}
                      className="w-full bg-black border border-gray-600 rounded-lg p-3 flex items-center justify-between hover:bg-white/5 transition-colors"
                    >
                      <div className="flex items-center space-x-3">
                        {sellToken ? (
                          <>
                            <img
                              src={sellToken.logo}
                              alt={sellToken.ticker}
                              className="w-6 h-6 rounded-full"
                              onError={(e) => {
                                e.currentTarget.src = '/coin-logos/default.svg';
                              }}
                            />
                            <span className="text-white font-medium">{formatTokenTicker(sellToken.ticker)}</span>
                          </>
                        ) : (
                          <span className="text-gray-400">Select token</span>
                        )}
                      </div>
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {/* Dropdown */}
                    {showSellDropdown && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-black border border-gray-600 rounded-lg max-h-60 overflow-y-auto scrollbar-hide z-10">
                        {sellTokenOptions.map((token) => (
                          <button
                            key={token.address}
                            onClick={() => handleSellTokenSelect(token)}
                            className="w-full p-3 flex items-center space-x-3 hover:bg-white/5 transition-colors text-left"
                          >
                            <img
                              src={token.logo}
                              alt={token.ticker}
                              className="w-6 h-6 rounded-full"
                              onError={(e) => {
                                e.currentTarget.src = '/coin-logos/default.svg';
                              }}
                            />
                            <div>
                              <div className="text-white font-medium">{formatTokenTicker(token.ticker)}</div>
                              <div className="text-gray-400 text-xs">{token.name}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Amount Input */}
                  <input
                    ref={sellAmountRef}
                    type="text"
                    placeholder="Enter amount"
                    value={formatNumberWithCommas(sellAmount)}
                    onChange={(e) => handleAmountChange(e, setSellAmount, sellAmountRef, sellToken, setSellAmountError)}
                    className={`w-full bg-black border ${sellAmountError ? 'border-red-500' : 'border-gray-600'} rounded-lg p-3 text-white placeholder-gray-400 focus:outline-none`}
                  />
                  
                  {/* Validation Error */}
                  {sellAmountError && (
                    <div className="mt-1 text-xs text-red-400">
                      {sellAmountError}
                    </div>
                  )}

                  {/* Balance and MAX button */}
                  {sellToken && (
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-gray-400 text-xs">
                        {sellBalanceLoading ? (
                          'Loading balance...'
                        ) : sellBalanceError ? (
                          'Error loading balance'
                        ) : sellTokenBalance ? (
                          `Balance: ${formatBalanceDisplay(sellTokenBalance.formatted)} ${formatTokenTicker(sellToken.ticker)}`
                        ) : (
                          'Balance: --'
                        )}
                      </span>
                      <div className="flex space-x-2">
                        {sellTokenBalance && !sellBalanceLoading && !sellBalanceError && (
                          <button
                            type="button"
                            onClick={handleMaxSellAmount}
                            className="text-blue-400 hover:text-white text-xs font-medium transition-colors"
                          >
                            MAX
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Price conversion display - show all buy tokens */}
                  {sellAmount && sellToken && parseFloat(removeCommas(sellAmount)) > 0 && (
                    <div className="mt-2 space-y-1">
                      {buyTokens.map((buyToken, index) => {
                        const buyAmount = buyAmounts[index];
                        if (!buyToken || !buyAmount || buyAmount.trim() === '' || parseFloat(removeCommas(buyAmount)) <= 0) return null;
                        return (
                          <div key={index} className="text-xs text-gray-400">
                      1 {formatTokenTicker(sellToken.ticker)} = {(() => {
                        const ratio = parseFloat(removeCommas(buyAmount)) / parseFloat(removeCommas(sellAmount));
                        return formatNumberWithCommas(parseFloat(ratio.toPrecision(4)).toString());
                      })()} {formatTokenTicker(buyToken.ticker)}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Swap Button - Middle Column */}
                <div className="flex justify-center items-center w-fit mx-auto self-center">
                  <button
                    onClick={handleSwapTokens}
                    disabled={buyTokens.length > 1}
                    className={`p-2 rounded-full transition-colors ${
                      buyTokens.length > 1 
                        ? 'cursor-not-allowed opacity-100' 
                        : 'hover:bg-white/10 cursor-pointer'
                    }`}
                    title={buyTokens.length > 1 ? "Cannot swap with multiple tokens" : "Swap tokens and amounts"}
                  >
                    <ArrowLeftRight className={`w-5 h-5 text-gray-400 ${
                      buyTokens.length > 1 
                        ? '' 
                        : 'hover:text-white'
                    } transition-colors`} />
                  </button>
                </div>

                {/* You Want Section */}
                <div className="bg-white/5 rounded-xl p-6">
                  <h3 className="text-white font-semibold mb-4">Your Ask</h3>

                  <div className="space-y-4">
                    {buyTokens.map((buyToken, index) => (
                      <div key={index} className="relative">
                        {/* OR Divider - show before each token except the first */}
                        {index > 0 && (
                          <div className="flex items-center gap-4 mb-4">
                            <div className="flex-1 h-px bg-white/20"></div>
                            <span className="text-gray-400 text-sm font-medium px-2">OR</span>
                            <div className="flex-1 h-px bg-white/20"></div>
                          </div>
                        )}
                        
                        <div className="flex items-start space-x-2">
                          <div className="flex-1">
                  {/* Token Selector */}
                            <div className="relative mb-4" ref={el => { buyDropdownRefs.current[index] = el; }}>
                              <div className="flex items-center space-x-2">
                    <button
                                  onClick={() => handleBuyDropdownToggle(index)}
                                  className="flex-1 bg-black border border-gray-600 rounded-lg p-3 flex items-center justify-between hover:bg-white/5 transition-colors"
                    >
                      <div className="flex items-center space-x-3">
                        {buyToken ? (
                          <>
                            <img
                              src={buyToken.logo}
                              alt={buyToken.ticker}
                              className="w-6 h-6 rounded-full"
                              onError={(e) => {
                                e.currentTarget.src = '/coin-logos/default.svg';
                              }}
                            />
                            <span className="text-white font-medium">{formatTokenTicker(buyToken.ticker)}</span>
                          </>
                        ) : (
                          <span className="text-gray-400">Select token</span>
                        )}
                      </div>
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                                
                                {/* Delete button - only show for 2nd token onwards */}
                                {index > 0 && (
                                  <button
                                    onClick={() => handleRemoveBuyToken(index)}
                                    className="p-3 bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 rounded-lg transition-colors"
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
                      <div className="absolute top-full left-0 right-0 mt-1 bg-black border border-gray-600 rounded-lg max-h-60 overflow-y-auto scrollbar-hide z-10">
                        {buyTokenOptions.map((token) => (
                          <button
                            key={token.address}
                                      onClick={() => handleBuyTokenSelect(token, index)}
                            className="w-full p-3 flex items-center space-x-3 hover:bg-white/5 transition-colors text-left"
                          >
                            <img
                              src={token.logo}
                              alt={token.ticker}
                              className="w-6 h-6 rounded-full"
                              onError={(e) => {
                                e.currentTarget.src = '/coin-logos/default.svg';
                              }}
                            />
                            <div>
                              <div className="text-white font-medium">{formatTokenTicker(token.ticker)}</div>
                              <div className="text-gray-400 text-xs">{token.name}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Amount Input */}
                  <input
                              ref={el => { buyAmountRefs.current[index] = el; }}
                    type="text"
                    placeholder="Enter amount"
                              value={formatNumberWithCommas(buyAmounts[index] || '')}
                              onChange={(e) => {
                                const input = e.target;
                                const rawValue = removeCommas(input.value);
                                const sanitized = sanitizeAmount(rawValue);

                                if (sanitized === '' || /^\d*\.?\d*$/.test(sanitized)) {
                                  const newAmounts = [...buyAmounts];
                                  newAmounts[index] = sanitized;
                                  setBuyAmounts(newAmounts);

                                  // Validate
                                  if (buyToken && sanitized !== '') {
                                    const validation = validateAmount(sanitized, buyToken.decimals);
                                    const newErrors = [...buyAmountErrors];
                                    newErrors[index] = validation.valid ? null : (validation.error || 'Invalid amount');
                                    setBuyAmountErrors(newErrors);
                                  } else {
                                    const newErrors = [...buyAmountErrors];
                                    newErrors[index] = null;
                                    setBuyAmountErrors(newErrors);
                                  }
                                }
                              }}
                              className={`w-full bg-black border ${buyAmountErrors[index] ? 'border-red-500' : 'border-gray-600'} rounded-lg p-3 text-white placeholder-gray-400 focus:outline-none`}
                  />
                  
                  {/* Validation Error */}
                            {buyAmountErrors[index] && (
                    <div className="mt-1 text-xs text-red-400">
                                {buyAmountErrors[index]}
                    </div>
                  )}

                            {/* Price conversion display - show for each token */}
                            {sellAmount && buyAmounts[index] && sellToken && buyToken && parseFloat(removeCommas(sellAmount)) > 0 && parseFloat(removeCommas(buyAmounts[index])) > 0 && (
                    <div className="mt-2 text-xs text-gray-400">
                      1 {formatTokenTicker(buyToken.ticker)} = {(() => {
                                  const ratio = parseFloat(removeCommas(sellAmount)) / parseFloat(removeCommas(buyAmounts[index]));
                        return formatNumberWithCommas(parseFloat(ratio.toPrecision(4)).toString());
                      })()} {formatTokenTicker(sellToken.ticker)}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Add button - only show if this is the last token and it has an amount and limit not reached */}
                        {index === buyTokens.length - 1 && buyAmounts[index] && buyAmounts[index].trim() !== '' && (
                          <>
                            {buyTokens.length < 10 ? (
                              <button
                                onClick={handleAddBuyToken}
                                className="mt-3 w-full py-2 bg-white/5 hover:bg-white/10 border border-white/20 rounded-lg transition-colors flex items-center justify-center space-x-2 opacity-60 hover:opacity-100"
                              >
                                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                <span className="text-white text-sm">Add another token</span>
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
                    <div className="mt-3 p-2 bg-red-900/20 border border-red-500/30 rounded-lg">
                      <p className="text-red-400 text-xs">⚠️ {duplicateTokenError}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Expiration */}
              <div className="bg-white/5 rounded-xl p-6 mt-6">
                <h3 className="text-white font-semibold mb-4">Expiration (Days)</h3>
                <input
                  type="number"
                  value={expirationDays === 0 ? '' : expirationDays}
                  onChange={(e) => {
                    const value = e.target.value;
                    // Allow empty string or positive integers, no leading zeros
                    if (value === '') {
                      setExpirationDays(0);
                    } else if (value.match(/^[1-9]\d*$/) && parseInt(value) > 0) {
                      setExpirationDays(Number(value));
                    }
                  }}
                  placeholder="Enter days"
                  min="1"
                  className="w-full bg-black border border-gray-600 rounded-lg p-3 text-white placeholder-gray-400 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>

              {/* Deal Summary - Only show when offer amount is entered and no duplicate tokens */}
              {sellAmount && sellToken && parseFloat(removeCommas(sellAmount)) > 0 && !duplicateTokenError && (
                <div className="bg-white/5 rounded-xl p-6 mt-6">
                  <h3 className="text-white font-semibold mb-4">Deal Summary</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Your Offer:</span>
                      <span className="text-white font-medium">{formatBalanceDisplay(removeCommas(sellAmount))} {formatTokenTicker(sellToken.ticker)}</span>
                    </div>
                    {buyTokens.map((token, index) => {
                      const amount = buyAmounts[index];
                      if (!token || !amount || amount.trim() === '') return null;
                      return (
                        <div key={`ask-${index}`} className="flex justify-between items-center">
                          <span className="text-gray-400">
                            {index === 0 ? `Your Ask${buyTokens.filter((t, idx) => t && buyAmounts[idx] && buyAmounts[idx].trim() !== '').length > 1 ? ' (Either of)' : ''}:` : ''}
                          </span>
                          <span className="text-white font-medium">
                            {formatBalanceDisplay(removeCommas(amount))} {formatTokenTicker(token.ticker)}
                          </span>
                    </div>
                      );
                    })}
                    
                    {/* Show fees for each token */}
                    {buyTokens.some((token, index) => token && buyAmounts[index] && buyAmounts[index].trim() !== '') && (
                      <>
                        {buyTokens.map((token, index) => {
                          const amount = buyAmounts[index];
                          if (!token || !amount || amount.trim() === '') return null;
                          return (
                            <div key={`fee-${index}`} className="flex justify-between items-center">
                              <span className="text-gray-400">
                                {index === 0 ? (
                                  <>
                                    MAX Fee{buyTokens.filter((t, idx) => t && buyAmounts[idx] && buyAmounts[idx].trim() !== '').length > 1 ? ' (Either of)' : ''}:
                        <div className="text-xs text-gray-500 mt-1">Max 1% fee deducted from buyer at sale (0.5% with NFT)</div>
                                  </>
                                ) : ''}
                              </span>
                              <span className="text-red-400 font-medium">
                                -{formatBalanceDisplay((parseFloat(removeCommas(amount)) * 0.01).toFixed(4))} {formatTokenTicker(token.ticker)}
                              </span>
                      </div>
                          );
                        })}
                      </>
                    )}

                    <div className="border-t border-white/10 pt-3 space-y-3">
                      {buyTokens.map((token, index) => {
                        const amount = buyAmounts[index];
                        if (!token || !amount || amount.trim() === '') return null;
                        return (
                          <div key={`receive-${index}`} className="flex justify-between items-center">
                            <span className="text-white font-semibold">
                              {index === 0 ? `You Receive${buyTokens.filter((t, idx) => t && buyAmounts[idx] && buyAmounts[idx].trim() !== '').length > 1 ? ' (Either of)' : ''}:` : ''}
                            </span>
                            <span className="text-white font-bold">
                              {formatBalanceDisplay((parseFloat(removeCommas(amount)) * 0.99).toFixed(4))} {formatTokenTicker(token.ticker)}
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
               !(MAXI_TOKENS.includes(sellToken.address.toLowerCase()) && buyTokens.every(t => t && MAXI_TOKENS.includes(t.address.toLowerCase()))) && (
                <div className="bg-white/5 rounded-xl p-6 mt-6 relative overflow-hidden">
                  <h3 className="text-white font-semibold mb-4">Pro Plan</h3>
                  
                  {/* Content with conditional blur */}
                  <div className={(PAYWALL_ENABLED && !hasTokenAccess) ? 'blur-md select-none pointer-events-none' : ''}>
                    {statsLoading && hasTokenAccess ? (
                      <div className="text-gray-400 text-center py-4">Loading token stats...</div>
                    ) : statsError && hasTokenAccess ? (
                      <div className="text-red-400 text-center py-4">
                        <div className="font-semibold mb-2">Failed to load token stats</div>
                        <div className="text-xs text-red-300">{statsError.message || 'Unknown error'}</div>
                      </div>
                    ) : (PAYWALL_ENABLED && !hasTokenAccess) ? (
                      // Show placeholder content when no access (for blur effect)
                      <div className={`grid ${gridColsClass} gap-6`}>
                        {(showSellStats || !hasTokenAccess) && (
                          <div className="space-y-3">
                            <h4 className="text-white font-medium flex items-center space-x-2">
                              <div className="w-5 h-5 rounded-full bg-gray-600"></div>
                              <span>MAXI Stats</span>
                            </h4>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-gray-400">Progress:</span>
                                <span className="text-blue-400">22.5%</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-400">Backing per Token:</span>
                                <span className="text-white">2.1977 HEX</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-400">Current Market Price:</span>
                                <span className="text-white">1.1433 HEX</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-400">Market Discount / Premium from Backing:</span>
                                <span className="text-red-400">-47.98%</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-400">Current Mint Price:</span>
                                <span className="text-white">1 HEX</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-400">Market Discount / Premium from Mint:</span>
                                <span className="text-green-400">14.33%</span>
                              </div>
                              <div className="mt-4 pt-3 border-t border-white/10">
                                <div className="flex justify-between">
                                  <span className="text-gray-400">Your OTC Price:</span>
                                  <span className="text-white">1.0000 HEX</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-400">Your Discount / Premium from Market Price:</span>
                                  <span className="text-red-400">-12.53%</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-400">Your Discount / Premium from Mint:</span>
                                  <span className="text-gray-400">0.00%</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-400">Your Discount / Premium from Backing:</span>
                                  <span className="text-red-400">-54.50%</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className={`grid ${gridColsClass} gap-6`}>
                      {/* Sell Token Stats */}
                      {showSellStats && (
                        <div className="space-y-3">
                          <h4 className="text-white font-medium flex items-center space-x-2">
                            <img
                              src={sellToken.logo}
                              alt={sellToken.ticker}
                              className="w-5 h-5 rounded-full"
                              onError={(e) => {
                                e.currentTarget.src = '/coin-logos/default.svg';
                              }}
                            />
                            <span>{formatTokenTicker(sellToken.ticker)} Stats</span>
                          </h4>
                          {(() => {
                            // Map wrapped tokens (we*) to their ethereum versions (e*) for stats lookup
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

                            if (!sellStats) {
                              return <div className="text-gray-400 text-sm">Stats not available</div>;
                            }

                            // Use the calculated OTC price
                            const yourPriceInHEX = calculateOtcPriceInHex;
                            
                            // Determine which HEX variant to display based on what's being used
                            const hexDisplayName = (buyTokens[0]?.ticker === 'eHEX' || buyTokens[0]?.ticker === 'weHEX') ? 'eHEX' : 
                                                   (buyTokens[0]?.ticker === 'pHEX') ? 'pHEX' : 'HEX';
                            
                            // Check if token is BASE variant (hide mint stats for BASE)
                            const isBaseToken = sellToken.ticker === 'BASE' || sellToken.ticker === 'eBASE' || 
                                                sellToken.ticker === 'pBASE' || sellToken.ticker === 'weBASE';

                            // Calculate discounts based on your price
                            let yourDiscountFromBacking: number | null = null;
                            let yourDiscountFromMint: number | null = null;

                            if (yourPriceInHEX !== null && sellStats.token.backingPerToken > 0) {
                              yourDiscountFromBacking = (yourPriceInHEX - sellStats.token.backingPerToken) / sellStats.token.backingPerToken;
                            }

                            if (yourPriceInHEX !== null && sellStats.token.priceHEX > 0) {
                              // Calculate mint price from API data
                              const mintPriceHEX = sellStats.token.priceHEX / (1 + sellStats.token.discountFromMint);
                              yourDiscountFromMint = (yourPriceInHEX - mintPriceHEX) / mintPriceHEX;
                            }

                            return (
                              <div className="space-y-2 text-sm">
                                                                <div className="flex justify-between">
                                  <span className="text-gray-400">Progress:</span>
                                  <span className="text-blue-400">{(sellStats.dates.progressPercentage * 100).toFixed(1)}%</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-400">Backing per Token:</span>
                                  <span className="text-white">{sellStats.token.backingPerToken.toFixed(4)} {hexDisplayName}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-400">Current Market Price:</span>
                                  <span className="text-white">{sellStats.token.priceHEX.toFixed(4)} {hexDisplayName}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-400">Current Discount / Premium from Backing:</span>
                                  <span className={`font-medium ${sellStats.token.discountFromBacking > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    {(sellStats.token.discountFromBacking * 100).toFixed(2)}%
                                  </span>
                                </div>
                                {!isBaseToken && (
                                  <div className="flex justify-between">
                                    <span className="text-gray-400">Current Discount / Premium from Mint:</span>
                                    <span className={`font-medium ${sellStats.token.discountFromMint > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                      {(sellStats.token.discountFromMint * 100).toFixed(2)}%
                                    </span>
                                  </div>
                                )}

                                {/* Subtle divider */}
                                <div className="border-t border-white/10 my-3"></div>

                                <div className="flex justify-between">
                                  <span className="text-gray-400">Your OTC Price:</span>
                                  <span className="text-white">{yourPriceInHEX ? yourPriceInHEX.toFixed(4) : 'N/A'} {hexDisplayName}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-400">Your Discount / Premium from Backing:</span>
                                  <span className={`font-medium ${yourDiscountFromBacking !== null ? (yourDiscountFromBacking > 0 ? 'text-green-400' : 'text-red-400') : 'text-gray-400'}`}>
                                    {yourDiscountFromBacking !== null ? (yourDiscountFromBacking * 100).toFixed(2) + '%' : 'N/A'}
                                  </span>
                                </div>
                                {!isBaseToken && (
                                  <div className="flex justify-between">
                                    <span className="text-gray-400">Your Discount / Premium from Mint:</span>
                                    <span className={`font-medium ${yourDiscountFromMint !== null ? (yourDiscountFromMint > 0 ? 'text-green-400' : 'text-red-400') : 'text-gray-400'}`}>
                                      {yourDiscountFromMint !== null ? (yourDiscountFromMint * 100).toFixed(2) + '%' : 'N/A'}
                                    </span>
                                  </div>
                                )}
                                <div className="flex justify-between">
                                  <span className="text-gray-400">Your Discount / Premium from Market Price:</span>
                                  <span className={`font-medium ${yourPriceInHEX !== null && sellStats.token.priceHEX > 0 ?
                                    ((yourPriceInHEX - sellStats.token.priceHEX) / sellStats.token.priceHEX > 0 ? 'text-green-400' : 'text-red-400') : 'text-gray-400'}`}>
                                    {yourPriceInHEX !== null && sellStats.token.priceHEX > 0 ?
                                      (() => {
                                        const marketDiff = (yourPriceInHEX - sellStats.token.priceHEX) / sellStats.token.priceHEX;
                                        return marketDiff > 0 ?
                                          `${(marketDiff * 100).toFixed(2)}%` :
                                          `${Math.abs(marketDiff * 100).toFixed(2)}%`;
                                      })() : 'N/A'}
                                  </span>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      )}

                      {/* Buy Token Stats - Show for all buy tokens */}
                      {buyTokens.map((buyToken, buyIndex) => {
                        if (!buyToken || !shouldShowTokenStats(buyToken)) return null;
                        
                        return (
                          <div key={`buy-stats-${buyIndex}`} className="space-y-3">
                          <h4 className="text-white font-medium flex items-center space-x-2">
                            <img
                              src={buyToken.logo}
                              alt={buyToken.ticker}
                              className="w-5 h-5 rounded-full"
                              onError={(e) => {
                                e.currentTarget.src = '/coin-logos/default.svg';
                              }}
                            />
                            <span>{formatTokenTicker(buyToken.ticker)} Stats</span>
                          </h4>
                          {(() => {
                            // Map wrapped tokens (we*) to their ethereum versions (e*) for stats lookup
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

                            if (!buyStats) {
                              return <div className="text-gray-400 text-sm">Stats not available</div>;
                            }

                            // Calculate OTC price for THIS specific buy token
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
                                const buyTokenPriceInHex = getTokenPriceInHex(buyToken.address);
                                if (buyTokenPriceInHex) {
                                  const buyAmountInHex = parseFloat(removeCommas(buyAmount)) * buyTokenPriceInHex;
                                  yourPriceInHEX = buyAmountInHex / parseFloat(removeCommas(sellAmount));
                                }
                              }
                            }
                            
                            // Determine which HEX variant to display based on what's being used
                            const hexDisplayName = sellToken.ticker === 'eHEX' || sellToken.ticker === 'weHEX' ? 'eHEX' : 
                                                   sellToken.ticker === 'pHEX' ? 'pHEX' : 'HEX';
                            
                            // Check if token is BASE variant (hide mint stats for BASE)
                            const isBaseToken = buyToken.ticker === 'BASE' || buyToken.ticker === 'eBASE' || 
                                                buyToken.ticker === 'pBASE' || buyToken.ticker === 'weBASE';

                            // Calculate discounts based on your price
                            let yourDiscountFromBacking: number | null = null;
                            let yourDiscountFromMint: number | null = null;

                            if (yourPriceInHEX !== null && buyStats.token.backingPerToken > 0) {
                              yourDiscountFromBacking = (yourPriceInHEX - buyStats.token.backingPerToken) / buyStats.token.backingPerToken;
                            }

                            if (yourPriceInHEX !== null && buyStats.token.priceHEX > 0) {
                              // Calculate mint price from API data
                              const mintPriceHEX = buyStats.token.priceHEX / (1 + buyStats.token.discountFromMint);
                              yourDiscountFromMint = (yourPriceInHEX - mintPriceHEX) / mintPriceHEX;
                            }

                            return (
                              <div className="space-y-2 text-sm">
                                                                <div className="flex justify-between">
                                  <span className="text-gray-400">Progress:</span>
                                  <span className="text-white">{(buyStats.dates.progressPercentage * 100).toFixed(1)}%</span>
                                </div>
                                                                <div className="flex justify-between">
                                                                  
                                  <span className="text-gray-400">Current Market Price:</span>
                                  <span className="text-white">{buyStats.token.priceHEX.toFixed(4)} {hexDisplayName}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-400">Backing per Token:</span>
                                  <span className="text-white">{buyStats.token.backingPerToken.toFixed(4)} {hexDisplayName}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-400">Market Discount / Premium from Backing:</span>
                                  <span className={`font-medium ${buyStats.token.discountFromBacking > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    {(buyStats.token.discountFromBacking * 100).toFixed(2)}%
                                  </span>
                                </div>
                                {!isBaseToken && (
                                  <>
                                    <div className="flex justify-between">
                                      <span className="text-gray-400">Current Mint Price:</span>
                                      <span className="text-white">1 {hexDisplayName}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-gray-400">Market Discount / Premium from Mint:</span>
                                      <span className={`font-medium ${buyStats.token.discountFromMint > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                        {(buyStats.token.discountFromMint * 100).toFixed(2)}%
                                      </span>
                                    </div>
                                  </>
                                )}


                                {/* Subtle divider */}
                                <div className="border-t border-white/10 my-3"></div>

                                <div className="flex justify-between">
                                  <span className="text-gray-400">Your OTC Price:</span>
                                  <span className="text-white">{yourPriceInHEX ? yourPriceInHEX.toFixed(4) : 'N/A'} {hexDisplayName}</span>
                                </div>
                                {/* Single OTC Price Slider */}
                                {buyStats.token.priceHEX > 0 && (
                                  <div className="mt-3 mb-4 py-2">
                                    <Slider
                                      min={0}
                                      max={200}
                                      step={0.5}
                                      value={[yourPriceInHEX !== null && buyStats.token.priceHEX > 0 ? (yourPriceInHEX / buyStats.token.priceHEX) * 100 : 100]}
                                      onValueChange={(value: number[]) => {
                                        const percentOfMarket = value[0] / 100;
                                        const targetPrice = buyStats.token.priceHEX * percentOfMarket;
                                        if (sellAmount && parseFloat(removeCommas(sellAmount)) > 0) {
                                          const newBuyAmount = (parseFloat(removeCommas(sellAmount)) / targetPrice).toFixed(6);
                                          const newAmounts = [...buyAmounts];
                                          newAmounts[buyIndex] = newBuyAmount;
                                          setBuyAmounts(newAmounts);
                                        }
                                      }}
                                      className="w-full px-1"
                                    />
                                  </div>
                                )}
                                <div className="flex justify-between">
                                  <span className="text-gray-400">Your Discount / Premium from Market Price:</span>
                                  <span className={`font-medium ${yourPriceInHEX !== null && buyStats.token.priceHEX > 0 ?
                                    ((yourPriceInHEX - buyStats.token.priceHEX) / buyStats.token.priceHEX > 0 ? 'text-green-400' : 'text-red-400') : 'text-gray-400'}`}>
                                    {yourPriceInHEX !== null && buyStats.token.priceHEX > 0 ?
                                      (() => {
                                        const marketDiff = (yourPriceInHEX - buyStats.token.priceHEX) / buyStats.token.priceHEX;
                                        return (marketDiff * 100).toFixed(2) + '%';
                                      })() : 'N/A'}
                                  </span>
                                </div>
                                {!isBaseToken && (
                                  <div className="flex justify-between">
                                    <span className="text-gray-400">Your Discount / Premium from Mint:</span>
                                    <span className={`font-medium ${yourDiscountFromMint !== null ? (yourDiscountFromMint > 0 ? 'text-green-400' : 'text-red-400') : 'text-gray-400'}`}>
                                      {yourDiscountFromMint !== null ? (yourDiscountFromMint * 100).toFixed(2) + '%' : 'N/A'}
                                    </span>
                                  </div>
                                )}
                                <div className="flex justify-between">
                                  <span className="text-gray-400">Your Discount / Premium from Backing:</span>
                                  <span className={`font-medium ${yourDiscountFromBacking !== null ? (yourDiscountFromBacking > 0 ? 'text-green-400' : 'text-red-400') : 'text-gray-400'}`}>
                                    {yourDiscountFromBacking !== null ? (yourDiscountFromBacking * 100).toFixed(2) + '%' : 'N/A'}
                                  </span>
                                </div>


                              </div>
                            );
                          })()}
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
                        className="flex flex-col items-center space-y-3 p-6 rounded-lg bg-black/60 hover:bg-white/10 transition-all border border-white/10"
                      >
                        <Lock className="w-12 h-12 text-gray-300 group-hover:text-white transition-colors" />
                        <div className="text-center">
                          <p className="text-white font-semibold">Premium Data Access</p>
                          <p className="text-gray-400 text-sm">Click to unlock advanced backing data for this trade.</p>
                        </div>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Error Display */}
            {orderError && (
              <div className="mt-4 p-3 bg-red-900/20 border border-red-500/30 rounded-lg max-h-32 overflow-y-auto">
                <p className="text-red-400 text-sm break-words whitespace-pre-wrap overflow-wrap-anywhere">{orderError}</p>
              </div>
            )}

            {/* Same Token Warning */}
            {sellToken && buyTokens.some(buyToken => buyToken && sellToken.address === buyToken.address) && (
              <div className="mt-4 p-3 bg-yellow-900/20 border border-yellow-500/30 rounded-lg">
                <p className="text-yellow-400 text-sm">
                  ⚠️ Cannot trade {sellToken.ticker} for {sellToken.ticker}. Please select different tokens for your offer and ask.
                </p>
              </div>
            )}

            {/* MAXI Token Warning */}
            {maxiTokenError && (
              <div className="mt-4 p-3 bg-yellow-900/20 border border-yellow-500/30 rounded-lg">
                <p className="text-yellow-400 text-sm">
                  ⚠️ {maxiTokenError}
                </p>
              </div>
            )}

            {/* Approval Error Display */}
            {approvalError && (
              <div className="mt-4 p-3 bg-red-900/20 border border-red-500/30 rounded-lg max-h-32 overflow-y-auto">
                <p className="text-red-400 text-sm break-words whitespace-pre-wrap overflow-wrap-anywhere">{approvalError}</p>
              </div>
            )}



            {/* Approval Status Info */}

            {/* Error Display */}
            {orderError && (
              <div className="mt-4 p-3 bg-red-500/10 border border-red-500/50 rounded-lg">
                <p className="text-red-400 text-sm">{orderError}</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-end space-x-4 mt-6">
              <button
                onClick={handleClose}
                disabled={isCreatingOrder}
                className="px-6 py-3 bg-gray-800 text-white rounded-lg hover:bg-gray-800/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={needsApproval && tokenNeedsApproval ? handleApproveToken : handleCreateDeal}
                disabled={
                  !sellToken || 
                  !sellAmount || 
                  buyTokens.some(token => !token) || 
                  buyTokens.some((token, i) => token && (!buyAmounts[i] || buyAmounts[i].trim() === '')) || 
                  !!isCreatingOrder || 
                  !!isLocalApproving || 
                  !isWalletConnected || 
                  !!duplicateTokenError ||
                  !!maxiTokenError ||
                  (sellToken && buyTokens.some(buyToken => buyToken && sellToken.address === buyToken.address))
                }
                className={`px-6 py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${needsApproval && tokenNeedsApproval
                    ? isLocalApproving
                      ? 'bg-gray-600 text-gray-300 cursor-not-allowed'
                      : 'bg-white text-black hover:bg-white/80'
                    : 'bg-white text-black hover:bg-gray-200'
                  }`}
              >
                {isCreatingOrder ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-gray-600 border-t-transparent rounded-full animate-spin"></div>
                    <span>Creating Order...</span>
                  </div>
                ) : isLocalApproving ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-gray-300 border-t-transparent rounded-full animate-spin"></div>
                    <span>APPROVING & CREATING DEAL...</span>
                  </div>
                ) : needsApproval && tokenNeedsApproval ? (
                  `APPROVE & CREATE DEAL`
                ) : (
                  'CREATE DEAL'
                )}
              </button>
            </div>
          </motion.div>
        </motion.div>
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
    </AnimatePresence>
  );
}
