'use client';

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAccount, useBalance, useContractWrite, useReadContract, usePublicClient, useSendTransaction } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { LiquidGlassCard } from '@/components/ui/liquid-glass';
import { Switch } from '@/components/ui/switch';
import { TokenLogo } from '@/components/TokenLogo';
import { ConnectButton } from '@/components/ConnectButton';
import { Loader2, ArrowDownUp, ChevronDown, AlertTriangle } from 'lucide-react';
import useToast from '@/hooks/use-toast';
import { getBlockExplorerTxUrl } from '@/utils/blockExplorer';
import { formatNumberWithCommas, removeCommas } from '@/utils/format';
import { TOKEN_CONSTANTS } from '@/constants/crypto';
import { PRIORITY_TOKEN_ADDRESSES, getTokenInfo } from '@/utils/tokenUtils';
import { useContractWhitelistRead } from '@/hooks/contracts/useContractWhitelistRead';
import { getContractAddress } from '@/config/testing';
import { CONTRACT_ABI } from '@/config/abis';
import { useTokenPrices } from '@/hooks/crypto/useTokenPrices';
import { getTokenPrice } from '@/utils/format';

const SWITCH_NATIVE_SENTINEL = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE' as const;
const SWITCH_ROUTER = '0x0305fcb5dA680EA6fd1B01A96C1949175B99d406' as const;
const AGORAX_ADAPTER_INDEX = '14';
const AGORAX_ADAPTER_ADDRESS = '0x79eA0ec76b510D08BF4ca9a4A53A1F9f80Ea1697' as const;

const AGORAX_ADAPTER_ABI = [
  {
    inputs: [
      { name: '_tokenIn', type: 'address' },
      { name: '_tokenOut', type: 'address' },
    ],
    name: 'getPreferredOrders',
    outputs: [{ type: 'uint256[]' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

const ERC20_ABI = [
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

type TokenOption = {
  address: string;
  ticker: string;
  name: string;
  decimals: number;
  isNative: boolean;
};

const NATIVE_ADDRESSES = new Set([
  '0x000000000000000000000000000000000000dead',
  '0x0000000000000000000000000000000000000000',
  SWITCH_NATIVE_SENTINEL.toLowerCase(),
]);

function buildTokenList(): TokenOption[] {
  const seen = new Set<string>();
  const list: TokenOption[] = [];
  let nativeAdded = false;

  const addToken = (addr: string, ticker: string, name: string, decimals: number) => {
    const lower = addr.toLowerCase();
    const isNative = NATIVE_ADDRESSES.has(lower);
    if (isNative) {
      if (nativeAdded) return;
      nativeAdded = true;
      list.push({
        address: SWITCH_NATIVE_SENTINEL,
        ticker,
        name,
        decimals,
        isNative: true,
      });
      return;
    }
    if (seen.has(lower)) return;
    seen.add(lower);
    list.push({ address: addr, ticker, name, decimals, isNative: false });
  };

  for (const addr of PRIORITY_TOKEN_ADDRESSES) {
    const info = getTokenInfo(addr);
    addToken(addr, info.ticker, info.name, info.decimals);
  }

  for (const t of TOKEN_CONSTANTS) {
    if (t.chain !== 369 || !t.a) continue;
    addToken(t.a, t.ticker, t.name, t.decimals);
  }

  return list;
}

function getSwitchAddress(token: TokenOption): string {
  return token.isNative ? SWITCH_NATIVE_SENTINEL : token.address;
}

type TokenTax = { isTaxToken: boolean; buyTaxBps: number; sellTaxBps: number };
type QuoteLeg = {
  tokenIn: string;
  tokenOut: string;
  adapter: string;
  amountIn: string;
  amountOut: string;
  percentage: number;
};
type QuotePath = {
  adapter: string;
  amountIn: string;
  amountOut: string;
  path: string[];
  adapters?: string[];
  legs?: QuoteLeg[];
  percentage?: number;
};
type Quote = {
  fromToken: string;
  toToken: string;
  totalAmountIn: string;
  totalAmountOut: string;
  expectedOutputAmount: string;
  minAmountOut: string;
  effectiveSlippageBps?: number;
  effectiveSlippagePercent?: string;
  tx?: { to: string; data: string; value: string };
  txFeeOnOutput?: { to: string; data: string; value: string };
  paths?: QuotePath[];
  fromTokenTax?: TokenTax;
  toTokenTax?: TokenTax;
  _fee?: {
    totalBps: number;
    partnerSharedBps: number;
    switchKeepsBps: number;
    partnerActive: boolean;
  };
};

function TokenSelect({
  value,
  onChange,
  tokens,
  disabledAddress,
}: {
  value: TokenOption;
  onChange: (t: TokenOption) => void;
  tokens: TokenOption[];
  disabledAddress?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const updatePos = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    setPos({
      top: rect.bottom + 8,
      right: window.innerWidth - rect.right,
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePos();

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        buttonRef.current?.contains(target) ||
        dropdownRef.current?.contains(target)
      )
        return;
      setOpen(false);
    };
    const handleScrollOrResize = () => updatePos();

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [open, updatePos]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tokens;
    return tokens.filter(
      (t) =>
        t.ticker.toLowerCase().includes(q) ||
        t.name.toLowerCase().includes(q) ||
        t.address.toLowerCase().includes(q)
    );
  }, [search, tokens]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/10 rounded-lg px-3 py-2 transition-colors"
      >
        <TokenLogo ticker={value.ticker} className="w-6 h-6" />
        <span className="text-white text-sm font-medium">{value.ticker}</span>
        <ChevronDown size={14} className="text-gray-400" />
      </button>
      {open &&
        pos &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={dropdownRef}
            style={{ position: 'fixed', top: pos.top, right: pos.right }}
            className="w-72 max-h-80 overflow-y-auto bg-black/95 border border-white/10 rounded-lg shadow-xl z-[100]"
          >
            <div className="sticky top-0 bg-black/95 p-2 border-b border-white/10">
              <input
                type="text"
                autoFocus
                placeholder="Search ticker, name, address"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-white text-sm outline-none placeholder-gray-500"
              />
            </div>
            {filtered.length === 0 ? (
              <div className="p-4 text-center text-sm text-gray-500">No tokens found</div>
            ) : (
              filtered.map((t) => {
                const isDisabled = disabledAddress?.toLowerCase() === t.address.toLowerCase();
                return (
                  <button
                    key={t.address}
                    disabled={isDisabled}
                    onClick={() => {
                      onChange(t);
                      setOpen(false);
                      setSearch('');
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${
                      isDisabled
                        ? 'opacity-30 cursor-not-allowed'
                        : 'hover:bg-white/5'
                    }`}
                  >
                    <TokenLogo ticker={t.ticker} className="w-7 h-7" />
                    <div className="flex-1 min-w-0">
                      <div className="text-white text-sm font-medium">{t.ticker}</div>
                      <div className="text-gray-500 text-xs truncate">{t.name}</div>
                    </div>
                  </button>
                );
              })
            )}
          </div>,
          document.body,
        )}
    </>
  );
}

export default function DexPage() {
  const { address, isConnected, chainId } = useAccount();
  const publicClient = usePublicClient();
  const { toast } = useToast();

  const tokens = useMemo(() => buildTokenList(), []);

  // AgoraX whitelist — used to restrict tokens when AgoraX-only mode is on.
  const { activeTokens: whitelistTokens } = useContractWhitelistRead();
  const whitelistSet = useMemo(() => {
    const s = new Set<string>();
    for (const t of whitelistTokens) s.add(t.tokenAddress.toLowerCase());
    return s;
  }, [whitelistTokens]);

  const isWhitelisted = useCallback(
    (token: TokenOption) =>
      token.isNative
        ? whitelistSet.has(SWITCH_NATIVE_SENTINEL.toLowerCase())
        : whitelistSet.has(token.address.toLowerCase()),
    [whitelistSet]
  );

  const defaultFrom = useMemo(
    () => tokens.find((t) => t.isNative) || tokens[0],
    [tokens]
  );
  const defaultTo = useMemo(
    () => tokens.find((t) => t.ticker === 'PLSX') || tokens[1],
    [tokens]
  );

  // Restore previously selected pair from localStorage synchronously on first render.
  // Reading inside useState's lazy initializer avoids the flash of defaults that a
  // useEffect-based restore would cause.
  const restoredPair = useMemo(() => {
    if (typeof window === 'undefined') return { from: defaultFrom, to: defaultTo };
    try {
      const raw = localStorage.getItem('agorax-dex-pair');
      if (!raw) return { from: defaultFrom, to: defaultTo };
      const saved = JSON.parse(raw) as { from?: string; to?: string };
      const from = saved.from
        ? tokens.find((t) => t.address.toLowerCase() === saved.from!.toLowerCase()) ||
          defaultFrom
        : defaultFrom;
      const to =
        saved.to && saved.to.toLowerCase() !== from.address.toLowerCase()
          ? tokens.find((t) => t.address.toLowerCase() === saved.to!.toLowerCase()) ||
            defaultTo
          : defaultTo;
      return { from, to };
    } catch {
      return { from: defaultFrom, to: defaultTo };
    }
    // We only want this computed once on mount; downstream changes to the tokens
    // list should not stomp the user's selection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [fromToken, setFromToken] = useState<TokenOption>(restoredPair.from);
  const [toToken, setToToken] = useState<TokenOption>(restoredPair.to);
  const [amount, setAmount] = useState('');
  const [agoraxOnly, setAgoraxOnly] = useState(false);

  // Persist pair on change.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(
        'agorax-dex-pair',
        JSON.stringify({ from: fromToken.address, to: toToken.address }),
      );
    } catch {
      /* ignore quota errors */
    }
  }, [fromToken, toToken]);

  const visibleTokens = useMemo(
    () => (agoraxOnly && whitelistSet.size > 0 ? tokens.filter(isWhitelisted) : tokens),
    [tokens, agoraxOnly, whitelistSet, isWhitelisted]
  );

  // When AgoraX-only flips on, force the selected pair to whitelisted tokens.
  useEffect(() => {
    if (!agoraxOnly || whitelistSet.size === 0) return;
    if (!isWhitelisted(fromToken)) {
      const fallback =
        visibleTokens.find((t) => t.isNative) || visibleTokens[0];
      if (fallback && fallback.address.toLowerCase() !== fromToken.address.toLowerCase()) {
        setFromToken(fallback);
      }
    }
    if (!isWhitelisted(toToken)) {
      const fallback =
        visibleTokens.find(
          (t) => t.address.toLowerCase() !== fromToken.address.toLowerCase(),
        ) || visibleTokens[0];
      if (fallback && fallback.address.toLowerCase() !== toToken.address.toLowerCase()) {
        setToToken(fallback);
      }
    }
  }, [agoraxOnly, whitelistSet, fromToken, toToken, isWhitelisted, visibleTokens]);
  const [slippageBps, setSlippageBps] = useState(50);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quoteFetchedAt, setQuoteFetchedAt] = useState<number | null>(null);
  const [txPending, setTxPending] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [routeOpen, setRouteOpen] = useState(false);
  const [recipient, setRecipient] = useState('');

  type AgoraxMatchedOrder = {
    id: bigint;
    owner: string;
    remainingSellAmount: bigint;
    sellAmount: bigint;
    buyAmount: bigint;
    rate: number;
    allOrNothing: boolean;
  };
  const [agoraxOrders, setAgoraxOrders] = useState<AgoraxMatchedOrder[] | null>(null);
  const [agoraxOrdersLoading, setAgoraxOrdersLoading] = useState(false);
  const [agoraxOrdersError, setAgoraxOrdersError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const recipientFormatValid =
    recipient === '' || /^0x[a-fA-F0-9]{40}$/.test(recipient);

  const [recipientIsContract, setRecipientIsContract] = useState(false);
  const [recipientChecking, setRecipientChecking] = useState(false);

  // Bytecode check — block contract addresses to avoid locked funds.
  useEffect(() => {
    setRecipientIsContract(false);
    if (!recipient || !recipientFormatValid || !publicClient) {
      setRecipientChecking(false);
      return;
    }
    setRecipientChecking(true);
    const handle = setTimeout(async () => {
      try {
        const code = await publicClient.getCode({
          address: recipient as `0x${string}`,
        });
        // Empty / undefined / "0x" all indicate an EOA
        const isContract = !!code && code !== '0x' && code.length > 2;
        setRecipientIsContract(isContract);
      } catch {
        setRecipientIsContract(false);
      } finally {
        setRecipientChecking(false);
      }
    }, 400);
    return () => clearTimeout(handle);
  }, [recipient, recipientFormatValid, publicClient]);

  const recipientValid = recipientFormatValid && !recipientIsContract;

  // From token balance
  const { data: nativeBalance, refetch: refetchNative } = useBalance({ address });
  const { data: erc20Balance, refetch: refetchErc20 } = useReadContract({
    address: fromToken.isNative ? undefined : (fromToken.address as `0x${string}`),
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address && !fromToken.isNative },
  });

  // To token balance (for display)
  const { data: toNativeBalance } = useBalance({
    address: toToken.isNative ? address : undefined,
  });
  const { data: toErc20Balance } = useReadContract({
    address: toToken.isNative ? undefined : (toToken.address as `0x${string}`),
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address && !toToken.isNative },
  });

  const fromBalanceFormatted = fromToken.isNative
    ? nativeBalance?.formatted || '0'
    : erc20Balance
      ? formatUnits(erc20Balance as bigint, fromToken.decimals)
      : '0';

  const toBalanceFormatted = toToken.isNative
    ? toNativeBalance?.formatted || '0'
    : toErc20Balance
      ? formatUnits(toErc20Balance as bigint, toToken.decimals)
      : '0';

  // Token prices for USD value display.
  const priceAddresses = useMemo(
    () => [fromToken.address, toToken.address],
    [fromToken.address, toToken.address],
  );
  const { prices: tokenPrices } = useTokenPrices(priceAddresses);
  const fromUsdPrice = getTokenPrice(fromToken.address, tokenPrices);
  const toUsdPrice = getTokenPrice(toToken.address, tokenPrices);

  const formatUsd = (n: number) =>
    n >= 0.01
      ? n.toLocaleString('en-US', {
          style: 'currency',
          currency: 'USD',
          maximumFractionDigits: 2,
        })
      : n > 0
        ? `<$0.01`
        : '$0.00';

  const fetchQuote = useCallback(
    async (silent: boolean) => {
      if (!amount || parseFloat(amount) <= 0) return;
      if (recipient && !recipientValid) return;
      try {
        if (!silent) setQuoteLoading(true);
        const amountWei = parseUnits(amount, fromToken.decimals).toString();
        const params = new URLSearchParams({
          from: getSwitchAddress(fromToken),
          to: getSwitchAddress(toToken),
          amount: amountWei,
          slippage: String(slippageBps),
        });
        if (address) params.set('sender', address);
        if (recipient && recipientValid) params.set('receiver', recipient);
        if (agoraxOnly) params.set('adapters', AGORAX_ADAPTER_INDEX);

        const res = await fetch(`/api/switch-quote?${params.toString()}`);
        const data = await res.json();
        if (!res.ok) {
          setQuoteError(data?.error || data?.message || 'Quote failed');
          if (!silent) setQuote(null);
        } else {
          setQuote(data);
          setQuoteError(null);
          setQuoteFetchedAt(Date.now());
        }
      } catch (err) {
        setQuoteError(err instanceof Error ? err.message : 'Quote failed');
      } finally {
        if (!silent) setQuoteLoading(false);
      }
    },
    [
      amount,
      fromToken,
      toToken,
      agoraxOnly,
      slippageBps,
      address,
      recipient,
      recipientValid,
    ]
  );

  // Initial fetch on input change (debounced)
  useEffect(() => {
    setQuote(null);
    setQuoteError(null);
    setQuoteFetchedAt(null);
    if (!amount || parseFloat(amount) <= 0) return;
    const handle = setTimeout(() => {
      fetchQuote(false);
    }, 400);
    return () => clearTimeout(handle);
  }, [amount, fromToken, toToken, agoraxOnly, slippageBps, address, recipient, recipientValid, fetchQuote]);

  // Auto-refresh quote every 10s while inputs are stable
  useEffect(() => {
    if (!quoteFetchedAt || txPending) return;
    const interval = setInterval(() => {
      fetchQuote(true);
    }, 10_000);
    return () => clearInterval(interval);
  }, [quoteFetchedAt, txPending, fetchQuote]);


  // BigInt math from raw wei — no float artifacts, full precision preserved.
  const getRawBalance = (): bigint => {
    if (fromToken.isNative) return nativeBalance?.value ?? 0n;
    return (erc20Balance as bigint | undefined) ?? 0n;
  };

  // Tracks whether `amount` was programmatically set (percent buttons) or user-typed.
  // Programmatic values are rendered trimmed to 4 decimals while keeping full precision underneath.
  const [amountMode, setAmountMode] = useState<'raw' | 'typed'>('typed');

  const handleMax = () => {
    const balWei = getRawBalance();
    if (balWei <= 0n) return;
    let target = balWei;
    if (fromToken.isNative) {
      const gasReserveWei = parseUnits('100', fromToken.decimals);
      target = balWei > gasReserveWei ? balWei - gasReserveWei : 0n;
    }
    setAmount(target > 0n ? formatUnits(target, fromToken.decimals) : '0');
    setAmountMode('raw');
  };

  const handlePercent = (pct: number) => {
    const balWei = getRawBalance();
    if (balWei <= 0n) return;
    const numerator = BigInt(Math.round(pct * 10_000));
    const target = (balWei * numerator) / 10_000n;
    setAmount(target > 0n ? formatUnits(target, fromToken.decimals) : '0');
    setAmountMode('raw');
  };

  // Display-only formatter for the From input.
  const inputDisplayValue = useMemo(() => {
    if (!amount) return '';
    if (amountMode === 'typed') return formatNumberWithCommas(amount);
    // raw: trim to 4 decimals visually
    const dotIdx = amount.indexOf('.');
    let trimmed = amount;
    if (dotIdx !== -1 && amount.length - dotIdx - 1 > 4) {
      trimmed = amount.slice(0, dotIdx + 5);
    }
    return formatNumberWithCommas(trimmed);
  }, [amount, amountMode]);

  const handleSwapDirection = () => {
    setFromToken(toToken);
    setToToken(fromToken);
    setAmount('');
    setAmountMode('typed');
    setQuote(null);
    setTxHash(null);
    setError(null);
  };

  const { writeContractAsync } = useContractWrite();
  const { sendTransactionAsync } = useSendTransaction();

  const handleSubmit = useCallback(async () => {
    if (!address || !amount || !quote || !publicClient) return;
    if (!quote.tx) {
      setError('Quote missing transaction data — try refetching');
      return;
    }

    setTxPending(true);
    setTxHash(null);
    setError(null);

    try {
      const amountWei = parseUnits(amount, fromToken.decimals);

      // Approve ERC-20 if needed
      if (!fromToken.isNative) {
        const allowance = (await publicClient.readContract({
          address: fromToken.address as `0x${string}`,
          abi: ERC20_ABI,
          functionName: 'allowance',
          args: [address, SWITCH_ROUTER],
        })) as bigint;

        if (allowance < amountWei) {
          const approveToast = toast({
            title: `Approving ${fromToken.ticker}...`,
            description: 'Confirm the approval in your wallet.',
          });
          const approveHash = await writeContractAsync({
            address: fromToken.address as `0x${string}`,
            abi: ERC20_ABI,
            functionName: 'approve',
            args: [SWITCH_ROUTER, amountWei],
          });
          await publicClient.waitForTransactionReceipt({ hash: approveHash as `0x${string}` });
          approveToast.dismiss();
        }
      }

      // Send swap tx
      const pendingToast = toast({
        title: 'Swapping...',
        description: 'Confirm the transaction in your wallet.',
      });

      const swapHash = await sendTransactionAsync({
        to: quote.tx.to as `0x${string}`,
        data: quote.tx.data as `0x${string}`,
        value: BigInt(quote.tx.value || '0'),
        gas: 800_000n,
      });

      await publicClient.waitForTransactionReceipt({ hash: swapHash as `0x${string}` });
      pendingToast.dismiss();
      setTxHash(swapHash);
      setAmount('');
      setAmountMode('typed');
      setQuote(null);
      toast({
        title: 'Swap successful!',
        description: (
          <a href={getBlockExplorerTxUrl(chainId, swapHash)} className="underline">
            View Transaction
          </a>
        ),
        variant: 'success' as never,
      });

      refetchNative();
      refetchErc20();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Swap failed';
      if (message.includes('User rejected') || message.includes('user rejected')) {
        setError('Transaction cancelled');
      } else {
        setError(message.length > 140 ? message.slice(0, 140) + '...' : message);
      }
    } finally {
      setTxPending(false);
    }
  }, [
    address,
    amount,
    quote,
    publicClient,
    fromToken,
    toToken,
    chainId,
    toast,
    writeContractAsync,
    sendTransactionAsync,
    refetchNative,
    refetchErc20,
  ]);

  const isValidAmount =
    amount && parseFloat(amount) > 0 && parseFloat(amount) <= parseFloat(fromBalanceFormatted);

  const expectedOut = quote
    ? formatUnits(BigInt(quote.expectedOutputAmount), toToken.decimals)
    : '';
  const minOut = quote ? formatUnits(BigInt(quote.minAmountOut), toToken.decimals) : '';

  // Rate display: 1 fromToken ≈ X toToken
  const rateText = useMemo(() => {
    if (!quote || !amount || parseFloat(amount) <= 0) return null;
    const out = parseFloat(expectedOut);
    const inAmt = parseFloat(amount);
    if (!out || !inAmt) return null;
    const rate = out / inAmt;
    const formatted = rate.toLocaleString('en-US', {
      maximumFractionDigits: rate < 0.01 ? 8 : rate < 1 ? 6 : 4,
    });
    return `1 ${fromToken.ticker} ≈ ${formatted} ${toToken.ticker}`;
  }, [quote, amount, expectedOut, fromToken.ticker, toToken.ticker]);

  // Route summary: aggregate adapters used with their share of input
  const routeSummary = useMemo(() => {
    if (!quote?.paths || quote.paths.length === 0) return null;
    const totalIn = quote.paths.reduce((s, p) => s + Number(BigInt(p.amountIn) / 1_000_000_000n), 0);
    if (totalIn === 0) return quote.paths.map((p) => p.adapter).join(', ');
    const grouped = quote.paths.reduce<Record<string, number>>((acc, p) => {
      const portion = Number(BigInt(p.amountIn) / 1_000_000_000n);
      acc[p.adapter] = (acc[p.adapter] || 0) + portion;
      return acc;
    }, {});
    const entries = Object.entries(grouped).sort((a, b) => b[1] - a[1]);
    if (entries.length === 1) return entries[0][0];
    return entries
      .map(([name, portion]) => `${Math.round((portion / totalIn) * 100)}% ${name}`)
      .join(' + ');
  }, [quote]);

  // Tax warning
  const taxWarning = useMemo(() => {
    if (!quote) return null;
    const warnings: string[] = [];
    if (quote.fromTokenTax?.isTaxToken) {
      const sell = quote.fromTokenTax.sellTaxBps;
      if (sell > 0) warnings.push(`${fromToken.ticker} has a ${(sell / 100).toFixed(2)}% sell tax`);
    }
    if (quote.toTokenTax?.isTaxToken) {
      const buy = quote.toTokenTax.buyTaxBps;
      if (buy > 0) warnings.push(`${toToken.ticker} has a ${(buy / 100).toFixed(2)}% buy tax`);
    }
    return warnings.length ? warnings.join(' · ') : null;
  }, [quote, fromToken.ticker, toToken.ticker]);

  // AgoraX OTC orders quote at a fixed maker price — tax tokens erode that
  // price below the maker's limit, so we block them in AgoraX-only mode.
  const taxBlocksAgorax =
    agoraxOnly &&
    !!quote &&
    ((quote.fromTokenTax?.isTaxToken && quote.fromTokenTax.sellTaxBps > 0) ||
      (quote.toTokenTax?.isTaxToken && quote.toTokenTax.buyTaxBps > 0));

  const usesAgoraxAdapter = !!quote?.paths?.some(
    (p) => p.adapter === 'AgoraX' || p.adapters?.includes('AgoraX'),
  );

  // Reset cached order list when the quote inputs change.
  useEffect(() => {
    setAgoraxOrders(null);
    setAgoraxOrdersError(null);
    setAgoraxOrdersLoading(false);
  }, [quote, fromToken, toToken, amount]);

  // Lazy-fetch matching AgoraX orders only when the user expands the route.
  useEffect(() => {
    if (!routeOpen || !usesAgoraxAdapter || agoraxOrders) return;
    if (!publicClient || !chainId) return;
    if (!quote) return;

    // Switch's AgoraX adapter has getPreferredOrders(tokenIn, tokenOut) — a curated
    // priority list. When it's empty, the adapter falls back to scanning the order
    // book, so we mirror that fallback by querying findFillableOrders on the core
    // contract. Maker orders sell toToken and accept fromToken as payment.
    const tokenInAddr = (
      fromToken.isNative ? SWITCH_NATIVE_SENTINEL : fromToken.address
    ).toLowerCase() as `0x${string}`;
    const tokenOutAddr = (
      toToken.isNative ? SWITCH_NATIVE_SENTINEL : toToken.address
    ).toLowerCase() as `0x${string}`;
    const makerSellTokenAddr = tokenOutAddr;
    const makerBuyTokenAddrLower = tokenInAddr;
    const contractAddress = getContractAddress(chainId) as `0x${string}` | undefined;
    if (!contractAddress) return;

    let cancelled = false;
    (async () => {
      setAgoraxOrdersLoading(true);
      setAgoraxOrdersError(null);
      try {
        // 1) Try the curated priority list first
        const preferredIds = (await publicClient.readContract({
          address: AGORAX_ADAPTER_ADDRESS,
          abi: AGORAX_ADAPTER_ABI,
          functionName: 'getPreferredOrders',
          args: [tokenInAddr, tokenOutAddr],
        })) as readonly bigint[];
        if (cancelled) return;

        // Fallback: if curated list is empty, scan the order book for fillable orders
        let ids: readonly bigint[] = preferredIds;
        let usingFallback = false;
        if (preferredIds.length === 0) {
          usingFallback = true;
          const fallback = (await publicClient.readContract({
            address: contractAddress,
            abi: CONTRACT_ABI,
            functionName: 'findFillableOrders',
            args: [makerSellTokenAddr, 1n, 0n, 50n],
          })) as readonly [readonly bigint[], bigint];
          if (cancelled) return;
          ids = fallback[0];
        }
        if (ids.length === 0) {
          setAgoraxOrders([]);
          return;
        }

        // 2) Pull full details for each in parallel
        type OrderDetailsResult = {
          userDetails: { orderIndex: bigint; orderOwner: `0x${string}` };
          orderDetailsWithID: {
            orderID: bigint;
            remainingSellAmount: bigint;
            redeemedSellAmount: bigint;
            lastUpdateTime: bigint;
            status: number;
            creationProtocolFee: bigint;
            orderDetails: {
              sellToken: `0x${string}`;
              sellAmount: bigint;
              buyTokensIndex: readonly bigint[];
              buyAmounts: readonly bigint[];
              expirationTime: bigint;
              allOrNothing: boolean;
            };
          };
        };
        const details = (await Promise.all(
          ids.map((id) =>
            publicClient.readContract({
              address: contractAddress,
              abi: CONTRACT_ABI,
              functionName: 'getOrderDetails',
              args: [id],
            }),
          ),
        )) as OrderDetailsResult[];
        if (cancelled) return;

        // 3) Filter to orders accepting the user's input token, and rank by best rate for the buyer.
        //    Maker's sellAmount is in toToken units; buyAmounts[j] for our match is in fromToken units.
        const matched: AgoraxMatchedOrder[] = [];
        for (let i = 0; i < details.length; i++) {
          const d = details[i];
          const od = d.orderDetailsWithID.orderDetails;
          let buyAmount: bigint | null = null;
          for (let j = 0; j < od.buyTokensIndex.length; j++) {
            const idx = Number(od.buyTokensIndex[j]);
            const whitelistAddr = whitelistTokens[idx]?.tokenAddress?.toLowerCase();
            if (whitelistAddr === makerBuyTokenAddrLower) {
              buyAmount = od.buyAmounts[j];
              break;
            }
          }
          if (buyAmount === null) continue;

          // sellAmount is in toToken (what user receives); buyAmount is in fromToken (what user pays)
          const sellNum = Number(od.sellAmount) / 10 ** toToken.decimals;
          const buyNum = Number(buyAmount) / 10 ** fromToken.decimals;
          // rate = how much toToken user gets per unit of fromToken
          const rate = buyNum > 0 ? sellNum / buyNum : 0;
          matched.push({
            id: ids[i],
            owner: d.userDetails.orderOwner,
            remainingSellAmount: d.orderDetailsWithID.remainingSellAmount,
            sellAmount: od.sellAmount,
            buyAmount,
            rate,
            allOrNothing: od.allOrNothing,
          });
        }
        // Curated list is in match order; fallback list needs ranking by best rate.
        if (usingFallback) {
          matched.sort((a, b) => b.rate - a.rate);
        }
        setAgoraxOrders(matched);
      } catch (err) {
        if (!cancelled) {
          setAgoraxOrdersError(err instanceof Error ? err.message : 'Failed to load orders');
        }
      } finally {
        setAgoraxOrdersLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    routeOpen,
    usesAgoraxAdapter,
    agoraxOrders,
    publicClient,
    chainId,
    quote,
    fromToken,
    toToken,
    whitelistTokens,
  ]);

  const canSubmit =
    isValidAmount && quote?.tx && !quoteLoading && !txPending && !taxBlocksAgorax;


  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-bold text-white text-center mb-2">DEX Aggregator</h1>
        <p className="text-gray-400 text-center text-sm mb-6">
          Trade tokens via Switch.win — route through AgoraX OTC or all DEXes
        </p>

        {/* Routing toggle */}
        <div className="flex items-center justify-center gap-3 mb-6 text-sm">
          <span
            className={`transition-colors ${
              !agoraxOnly ? 'text-white' : 'text-gray-500'
            }`}
          >
            All DEXes
          </span>
          <Switch
            checked={agoraxOnly}
            onCheckedChange={(v: boolean) => {
              setAgoraxOnly(v);
              setSlippageBps(v ? 0 : 50);
            }}
            className="data-[state=checked]:bg-white data-[state=unchecked]:bg-white/20 [&>span]:bg-black data-[state=checked]:[&>span]:bg-black data-[state=unchecked]:[&>span]:bg-white"
          />
          <span
            className={`transition-colors ${
              agoraxOnly ? 'text-white' : 'text-gray-500'
            }`}
          >
            AgoraX Only
          </span>
        </div>

        <LiquidGlassCard className="p-6 rounded-2xl">
          {/* From */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs text-gray-500 uppercase tracking-wider">From</span>
              <span className="text-xs text-gray-500">
                Balance:{' '}
                {parseFloat(fromBalanceFormatted).toLocaleString('en-US', {
                  maximumFractionDigits: 4,
                })}
              </span>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-lg px-3 py-3">
              <div className="text-xs text-gray-500 mb-1 h-4">
                {amount && parseFloat(amount) > 0 && fromUsdPrice > 0
                  ? formatUsd(parseFloat(amount) * fromUsdPrice)
                  : ''}
              </div>
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  inputMode="decimal"
                  placeholder="0.0"
                  value={inputDisplayValue}
                  onChange={(e) => {
                    const val = removeCommas(e.target.value).replace(/[^0-9.]/g, '');
                    if (val.split('.').length > 2) return;
                    const parts = val.split('.');
                    if (parts[1] && parts[1].length > fromToken.decimals) return;
                    setAmount(val);
                    setAmountMode('typed');
                  }}
                  className="flex-1 min-w-0 bg-transparent text-white text-xl font-medium outline-none placeholder-gray-600"
                />
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => handlePercent(0.25)}
                    className="text-xs text-gray-400 hover:text-white bg-white/10 px-2 py-1 rounded transition-colors"
                  >
                    25%
                  </button>
                  <button
                    onClick={() => handlePercent(0.5)}
                    className="text-xs text-gray-400 hover:text-white bg-white/10 px-2 py-1 rounded transition-colors"
                  >
                    50%
                  </button>
                  <button
                    onClick={handleMax}
                    className="text-xs text-gray-400 hover:text-white bg-white/10 px-2 py-1 rounded transition-colors"
                  >
                    MAX
                  </button>
                </div>
                <TokenSelect
                  value={fromToken}
                  onChange={(t) => {
                    setFromToken(t);
                    setAmount('');
                    setAmountMode('typed');
                  }}
                  tokens={visibleTokens}
                  disabledAddress={toToken.address}
                />
              </div>
            </div>
          </div>

          {/* Direction */}
          <div className="flex justify-center my-3 relative z-10">
            <button
              onClick={handleSwapDirection}
              className="p-2 rounded-full bg-white/10 border border-white/10 hover:bg-white/20 transition-colors"
            >
              <ArrowDownUp size={18} className="text-gray-400" />
            </button>
          </div>

          {/* To */}
          <div className="mb-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs text-gray-500 uppercase tracking-wider">To (estimate)</span>
              <span className="text-xs text-gray-500">
                Balance:{' '}
                {parseFloat(toBalanceFormatted).toLocaleString('en-US', {
                  maximumFractionDigits: 4,
                })}
              </span>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-lg px-3 py-3">
              <div className="text-xs text-gray-500 mb-1 h-4">
                {expectedOut && parseFloat(expectedOut) > 0 && toUsdPrice > 0
                  ? formatUsd(parseFloat(expectedOut) * toUsdPrice)
                  : ''}
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`flex-1 min-w-0 text-xl font-medium truncate ${
                    expectedOut && parseFloat(expectedOut) > 0 ? 'text-white' : 'text-gray-600'
                  }`}
                >
                  {quoteLoading
                    ? '…'
                    : expectedOut && parseFloat(expectedOut) > 0
                      ? formatNumberWithCommas(
                          parseFloat(expectedOut).toLocaleString('en-US', {
                            maximumFractionDigits: 4,
                            useGrouping: false,
                          })
                        )
                      : '0.0'}
                </span>
                <TokenSelect
                  value={toToken}
                  onChange={setToToken}
                  tokens={visibleTokens}
                  disabledAddress={fromToken.address}
                />
              </div>
            </div>
          </div>

          {/* Quote info */}
          {quote && (
            <div className="mb-4 p-3 bg-white/5 border border-white/10 rounded-lg text-xs text-gray-400 space-y-1">
              {rateText && (
                <div className="flex justify-between">
                  <span>Price</span>
                  <span className="text-white">{rateText}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Min received</span>
                <span className="text-white">
                  {parseFloat(minOut).toLocaleString('en-US', { maximumFractionDigits: 4 })}{' '}
                  {toToken.ticker}
                </span>
              </div>
              {quote.effectiveSlippagePercent && (
                <div className="flex justify-between">
                  <span>Effective slippage</span>
                  <span className="text-white">{quote.effectiveSlippagePercent}%</span>
                </div>
              )}
              {quote._fee && quote._fee.totalBps > 0 && (
                <div className="flex justify-between gap-3">
                  <span className="flex-shrink-0">Fee</span>
                  <span
                    className="text-white text-right"
                    title={
                      quote._fee.partnerActive
                        ? `Switch: ${(quote._fee.switchKeepsBps / 100).toFixed(2)}% · AgoraX: ${(quote._fee.partnerSharedBps / 100).toFixed(2)}%`
                        : `Switch platform fee`
                    }
                  >
                    {(quote._fee.totalBps / 100).toFixed(2)}%
                    {quote._fee.partnerActive && (
                      <span className="text-gray-500 ml-1">
                        (½ Switch · ½ AgoraX)
                      </span>
                    )}
                  </span>
                </div>
              )}
              {routeSummary && quote.paths && quote.paths.length > 0 && (
                <>
                  <button
                    onClick={() => setRouteOpen((v) => !v)}
                    className="flex justify-between gap-3 w-full text-left hover:text-gray-300 transition-colors"
                  >
                    <span className="flex-shrink-0">Route</span>
                    <span className="flex items-center gap-1 min-w-0">
                      <span className="text-white text-right truncate" title={routeSummary}>
                        {routeSummary}
                      </span>
                      <ChevronDown
                        size={12}
                        className={`flex-shrink-0 transition-transform ${
                          routeOpen ? 'rotate-180' : ''
                        }`}
                      />
                    </span>
                  </button>
                  {routeOpen && (
                    <div className="mt-2 pt-2 border-t border-white/5 space-y-2">
                      {quote.paths.map((p, i) => {
                        const legs = p.legs && p.legs.length > 0 ? p.legs : null;
                        const pct = p.percentage ?? 100;
                        return (
                          <div key={i} className="space-y-1">
                            {quote.paths!.length > 1 && (
                              <div className="text-gray-500 text-[11px]">
                                Path {i + 1} · {pct}% of input
                              </div>
                            )}
                            {legs ? (
                              legs.map((leg, j) => {
                                const tIn = getTokenInfo(leg.tokenIn);
                                const tOut = getTokenInfo(leg.tokenOut);
                                return (
                                  <div
                                    key={j}
                                    className="flex items-center justify-between gap-2 pl-2"
                                  >
                                    <div className="flex items-center gap-1 text-white truncate">
                                      <span>{tIn.ticker}</span>
                                      <span className="text-gray-500">→</span>
                                      <span>{tOut.ticker}</span>
                                    </div>
                                    <span className="text-gray-400 flex-shrink-0">
                                      {leg.percentage !== undefined &&
                                        leg.percentage !== 100 && (
                                          <span className="text-gray-500 mr-1">
                                            {leg.percentage}%
                                          </span>
                                        )}
                                      {leg.adapter}
                                    </span>
                                  </div>
                                );
                              })
                            ) : (
                              <div className="flex items-center justify-between gap-2 pl-2">
                                <div className="flex items-center gap-1 text-white truncate">
                                  {p.path.map((addr, k) => (
                                    <span key={k} className="flex items-center gap-1">
                                      {k > 0 && <span className="text-gray-500">→</span>}
                                      <span>{getTokenInfo(addr).ticker}</span>
                                    </span>
                                  ))}
                                </div>
                                <span className="text-gray-400 flex-shrink-0">{p.adapter}</span>
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {/* AgoraX OTC orders being matched */}
                      {usesAgoraxAdapter && (
                        <div className="pt-2 border-t border-white/5">
                          <div className="text-gray-500 text-[11px] mb-1">
                            AgoraX maker orders
                          </div>
                          {agoraxOrdersLoading && (
                            <div className="flex items-center gap-2 text-gray-400 pl-2">
                              <Loader2 size={12} className="animate-spin" />
                              <span className="text-[11px]">Loading matching orders…</span>
                            </div>
                          )}
                          {agoraxOrdersError && !agoraxOrdersLoading && (
                            <div className="text-red-400 text-[11px] pl-2">
                              {agoraxOrdersError}
                            </div>
                          )}
                          {agoraxOrders && !agoraxOrdersLoading && agoraxOrders.length === 0 && (
                            <div className="text-gray-500 text-[11px] pl-2">
                              No active orders match this pair right now.
                            </div>
                          )}
                          {agoraxOrders && agoraxOrders.length > 0 && (
                            <div className="space-y-1">
                              {(() => {
                                // For a user swap A→B: need is in fromToken (A) units.
                                // Each order's capacity to absorb A is:
                                //   remainingBuyForOrder = remainingSellAmount * buyAmount / sellAmount
                                //   (remainingSellAmount is in B units, buyAmount/sellAmount in B per A)
                                let need: bigint;
                                try {
                                  need = BigInt(quote.totalAmountIn);
                                } catch {
                                  need = 0n;
                                }
                                const used: typeof agoraxOrders = [];
                                for (const o of agoraxOrders) {
                                  if (need <= 0n) break;
                                  if (o.sellAmount === 0n) continue;
                                  const remainingBuyForOrder =
                                    (o.remainingSellAmount * o.buyAmount) / o.sellAmount;
                                  if (o.allOrNothing && remainingBuyForOrder > need) continue;
                                  used.push(o);
                                  if (remainingBuyForOrder >= need) {
                                    need = 0n;
                                    break;
                                  }
                                  need -= remainingBuyForOrder;
                                }
                                const display = used.length > 0 ? used : agoraxOrders.slice(0, 3);
                                return display.map((o) => {
                                  // Show how much fromToken this order can absorb
                                  const remainingAcceptable =
                                    o.sellAmount === 0n
                                      ? 0
                                      : Number(
                                          (o.remainingSellAmount * o.buyAmount) / o.sellAmount,
                                        ) / 10 ** fromToken.decimals;
                                  const rateFmt = o.rate.toLocaleString('en-US', {
                                    maximumFractionDigits: o.rate < 0.01 ? 8 : 4,
                                  });
                                  return (
                                    <a
                                      key={o.id.toString()}
                                      href={`/order/${o.id.toString()}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex items-center justify-between gap-2 pl-2 hover:text-white transition-colors"
                                    >
                                      <span className="text-white truncate flex items-center gap-1">
                                        <span>
                                          #{o.id.toString()} · accepts up to{' '}
                                          {remainingAcceptable.toLocaleString('en-US', {
                                            maximumFractionDigits: 4,
                                          })}{' '}
                                          {fromToken.ticker}
                                        </span>
                                        {o.allOrNothing && (
                                          <span
                                            className="text-[10px] text-yellow-400/80 bg-yellow-400/10 px-1 rounded"
                                            title="All-or-nothing: must be filled completely"
                                          >
                                            AON
                                          </span>
                                        )}
                                      </span>
                                      <span className="text-gray-400 flex-shrink-0">
                                        @ {rateFmt} {toToken.ticker}
                                      </span>
                                    </a>
                                  );
                                });
                              })()}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Tax warning */}
          {taxWarning && (
            <div
              className={`mb-4 p-3 border rounded-lg flex items-start gap-2 ${
                taxBlocksAgorax
                  ? 'bg-red-500/10 border-red-500/20'
                  : 'bg-yellow-500/10 border-yellow-500/20'
              }`}
            >
              <AlertTriangle
                size={14}
                className={`flex-shrink-0 mt-0.5 ${
                  taxBlocksAgorax ? 'text-red-400' : 'text-yellow-400'
                }`}
              />
              <div className="space-y-1">
                <p className={`text-xs ${taxBlocksAgorax ? 'text-red-400' : 'text-yellow-400'}`}>
                  {taxWarning}
                </p>
                {taxBlocksAgorax && (
                  <p className="text-xs text-red-400/70">
                    Tax tokens are not supported in AgoraX-only mode. Switch to All DEXes to swap
                    via AMMs that handle the tax.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Advanced */}
          <div className="mb-4">
            <button
              onClick={() => setAdvancedOpen((v) => !v)}
              className="w-full flex items-center justify-between text-xs text-gray-500 hover:text-gray-300 uppercase tracking-wider transition-colors"
            >
              <span>Advanced</span>
              <ChevronDown
                size={14}
                className={`transition-transform ${advancedOpen ? 'rotate-180' : ''}`}
              />
            </button>
            {advancedOpen && (
              <div className="mt-3 space-y-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Slippage</label>
                  {agoraxOnly ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs px-2 py-1 rounded bg-white/5 text-gray-500">
                        0%
                      </span>
                      <span className="text-xs text-gray-500">
                        Locked — OTC orders fill at fixed maker price
                      </span>
                    </div>
                  ) : (
                    <div className="flex gap-1 items-center">
                      {[10, 50, 100, 300].map((bps) => (
                        <button
                          key={bps}
                          onClick={() => setSlippageBps(bps)}
                          className={`text-xs px-2 py-1 rounded transition-colors ${
                            slippageBps === bps
                              ? 'bg-white text-black'
                              : 'bg-white/5 text-gray-400 hover:text-white'
                          }`}
                        >
                          {bps / 100}%
                        </button>
                      ))}
                      <div className="relative">
                        <input
                          type="text"
                          inputMode="decimal"
                          placeholder="Custom"
                          value={
                            [10, 50, 100, 300].includes(slippageBps)
                              ? ''
                              : (slippageBps / 100).toString()
                          }
                          onChange={(e) => {
                            const val = e.target.value.replace(/[^0-9.]/g, '');
                            if (val.split('.').length > 2) return;
                            if (val === '') {
                              setSlippageBps(50);
                              return;
                            }
                            const pct = parseFloat(val);
                            if (isNaN(pct)) return;
                            const bps = Math.round(Math.min(50, Math.max(0, pct)) * 100);
                            setSlippageBps(bps);
                          }}
                          className={`text-xs w-[68px] px-2 py-1 rounded outline-none transition-colors text-right ${
                            [10, 50, 100, 300].includes(slippageBps)
                              ? 'bg-white/5 text-gray-400 placeholder-gray-500 pr-2'
                              : 'bg-white text-black pr-5'
                          }`}
                        />
                        {![10, 50, 100, 300].includes(slippageBps) && (
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs pointer-events-none text-black">
                            %
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">
                    Recipient address (optional)
                  </label>
                  <input
                    type="text"
                    placeholder="0x..."
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value.trim())}
                    className={`w-full bg-white/5 border rounded-lg px-3 py-2 text-white text-sm font-mono outline-none placeholder-gray-600 transition-colors ${
                      recipient && (!recipientFormatValid || recipientIsContract)
                        ? 'border-red-500/50'
                        : 'border-white/10 focus:border-white/20'
                    }`}
                  />
                  {recipient && !recipientFormatValid && (
                    <p className="text-xs text-red-400 mt-1">Invalid address</p>
                  )}
                  {recipient && recipientFormatValid && recipientChecking && (
                    <p className="text-xs text-gray-500 mt-1">Checking address…</p>
                  )}
                  {recipient && recipientFormatValid && !recipientChecking && recipientIsContract && (
                    <p className="text-xs text-red-400 mt-1">
                      Contract addresses are not allowed — funds could be lost
                    </p>
                  )}
                  {recipient && recipientValid && !recipientChecking && (
                    <p className="text-xs text-gray-500 mt-1">
                      Output will be sent to this address instead of your wallet
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Action */}
          {!isConnected ? (
            <ConnectButton />
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="w-full py-3 rounded-xl bg-white hover:bg-gray-200 text-black font-bold text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {txPending ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Swapping...
                </>
              ) : quoteLoading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Fetching quote...
                </>
              ) : !isValidAmount ? (
                amount && parseFloat(amount) > parseFloat(fromBalanceFormatted)
                  ? 'Insufficient balance'
                  : 'Enter an amount'
              ) : taxBlocksAgorax ? (
                'Tax tokens not supported on AgoraX'
              ) : !quote?.tx ? (
                quoteError || 'No route found'
              ) : (
                'Swap'
              )}
            </button>
          )}

          {/* Quote error */}
          {quoteError && !quoteLoading && amount && parseFloat(amount) > 0 && (
            <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-center">
              <p className="text-yellow-400 text-xs">{quoteError}</p>
            </div>
          )}

          {/* Success */}
          {txHash && (
            <div className="mt-4 p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-center">
              <p className="text-green-400 text-sm font-medium">Swap confirmed!</p>
              <a
                href={getBlockExplorerTxUrl(chainId, txHash)}
                className="text-green-400/70 text-xs hover:text-green-400 underline mt-1 inline-block"
              >
                View Transaction
              </a>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-center">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}
        </LiquidGlassCard>

        <div className="mt-6 text-center text-xs text-gray-600">
          <p>
            Powered by{' '}
            <a
              href="https://switch.win"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-500 hover:text-white underline transition-colors"
            >
              Switch.win
            </a>{' '}
            DEX Aggregator
          </p>
        </div>
      </div>
    </div>
  );
}
