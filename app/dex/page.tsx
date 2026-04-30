'use client';

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAccount, useBalance, useContractWrite, useReadContract, usePublicClient, useSendTransaction } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { LiquidGlassCard } from '@/components/ui/liquid-glass';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { TokenLogo } from '@/components/TokenLogo';
import { ConnectButton } from '@/components/ConnectButton';
import { Loader2, ArrowDownUp, ChevronDown, AlertTriangle, ArrowRight } from 'lucide-react';
import useToast from '@/hooks/use-toast';
import { getBlockExplorerTxUrl } from '@/utils/blockExplorer';
import { formatNumberWithCommas, removeCommas } from '@/utils/format';
import { TOKEN_CONSTANTS } from '@/constants/crypto';
import { PRIORITY_TOKEN_ADDRESSES, getTokenInfo } from '@/utils/tokenUtils';
import { useContractWhitelistRead } from '@/hooks/contracts/useContractWhitelistRead';
import { useTokenPrices } from '@/hooks/crypto/useTokenPrices';
import { getTokenPrice } from '@/utils/format';

const SWITCH_NATIVE_SENTINEL = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE' as const;
const SWITCH_ROUTER = '0x0305fcb5dA680EA6fd1B01A96C1949175B99d406' as const;
const AGORAX_ADAPTER_INDEX = '14';

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

  const fmtPct = (n: number) => {
    const r = Math.round(n * 10) / 10;
    return Number.isInteger(r) ? `${Math.round(r)}%` : `${r.toFixed(1)}%`;
  };

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

  // Price impact based on the USD values of input vs expected output.
  // Negative = user is losing value vs market.
  const priceImpactPct = useMemo(() => {
    if (!amount || !expectedOut) return null;
    const inUsd = parseFloat(amount) * fromUsdPrice;
    const outUsd = parseFloat(expectedOut) * toUsdPrice;
    if (!inUsd || !outUsd) return null;
    return ((outUsd - inUsd) / inUsd) * 100;
  }, [amount, expectedOut, fromUsdPrice, toUsdPrice]);

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
            <div className="flex items-center gap-1 mt-2">
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
                  <span>Max slippage</span>
                  <span className="text-white">{quote.effectiveSlippagePercent}%</span>
                </div>
              )}
              {priceImpactPct !== null && Math.abs(priceImpactPct) >= 0.1 && (
                <div className="flex justify-between">
                  <span>Price impact</span>
                  <span
                    className={
                      priceImpactPct <= -5
                        ? 'text-red-400'
                        : priceImpactPct < 0
                          ? 'text-yellow-400'
                          : 'text-green-400'
                    }
                  >
                    {priceImpactPct > 0 ? '+' : ''}
                    {priceImpactPct.toFixed(2)}%
                  </span>
                </div>
              )}
              {routeSummary && quote.paths && quote.paths.length > 0 && (
                <button
                  onClick={() => setRouteOpen(true)}
                  className="flex items-center gap-1 text-white hover:text-gray-300 transition-colors"
                >
                  See Route
                  <ChevronDown size={12} className="-rotate-90 text-gray-400" />
                </button>
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

      {/* Route detail dialog */}
      <Dialog open={routeOpen} onOpenChange={setRouteOpen}>
        <DialogContent className="bg-black border border-white/10 text-white w-[calc(100vw-1rem)] max-w-2xl max-h-[85vh] overflow-y-auto !p-4 !rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-white text-left pr-8">Route Details</DialogTitle>
          </DialogHeader>
          {quote && quote.paths && quote.paths.length > 0 && (
            <div className="space-y-4 text-xs text-gray-400 min-w-0">
              {quote.paths.map((p, i) => {
                const legs = p.legs && p.legs.length > 0 ? p.legs : null;
                const pct = p.percentage ?? 100;
                return (
                  <div key={i} className="space-y-2 min-w-0">
                    {quote.paths!.length > 1 && (
                      <div className="flex items-center justify-between text-gray-400">
                        <span>Path {i + 1}</span>
                        <span className="text-white">{fmtPct(pct)} of input</span>
                      </div>
                    )}
                    <div className="visible-scrollbar overflow-x-scroll -mx-1 px-1 pb-3 min-w-0">
                      <div className="flex items-stretch gap-2 w-max mx-auto">
                        <div className="flex items-center justify-center flex-shrink-0">
                          <TokenLogo ticker={fromToken.ticker} className="w-9 h-9" />
                        </div>
                        {legs ? (
                          (() => {
                            // Group consecutive legs sharing the same tokenIn→tokenOut into one hop card.
                            type Hop = { tokenIn: string; tokenOut: string; legs: typeof legs };
                            const hops: Hop[] = [];
                            for (const leg of legs) {
                              const last = hops[hops.length - 1];
                              if (
                                last &&
                                last.tokenIn.toLowerCase() === leg.tokenIn.toLowerCase() &&
                                last.tokenOut.toLowerCase() === leg.tokenOut.toLowerCase()
                              ) {
                                last.legs.push(leg);
                              } else {
                                hops.push({
                                  tokenIn: leg.tokenIn,
                                  tokenOut: leg.tokenOut,
                                  legs: [leg],
                                });
                              }
                            }
                            return hops.map((hop, j) => {
                              const tIn = getTokenInfo(hop.tokenIn);
                              const tOut = getTokenInfo(hop.tokenOut);
                              return (
                                <div key={j} className="flex items-center gap-2">
                                  <ArrowRight size={14} className="text-gray-600 flex-shrink-0" />
                                  <div className="bg-white/5 border border-white/10 rounded-md px-3 py-2 flex flex-col gap-0.5">
                                    <div className="flex items-center gap-1 text-white text-sm font-medium">
                                      <span>{tIn.ticker}</span>
                                      <span className="text-gray-500">→</span>
                                      <span>{tOut.ticker}</span>
                                    </div>
                                    {hop.legs.map((leg, k) => (
                                      <div
                                        key={k}
                                        className="flex items-center justify-between gap-3 text-xs"
                                      >
                                        <span className="text-gray-400">{leg.adapter}</span>
                                        <span className="text-white">
                                          {leg.percentage !== undefined
                                            ? fmtPct(leg.percentage)
                                            : ''}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            });
                          })()
                        ) : (
                          <div className="flex items-center gap-2">
                            {p.path.slice(1, -1).map((addr, k) => (
                              <div key={k} className="flex items-center gap-2">
                                <ArrowRight size={14} className="text-gray-600 flex-shrink-0" />
                                <div className="bg-white/5 border border-white/10 rounded-md px-3 py-2 text-white text-sm font-medium">
                                  {getTokenInfo(addr).ticker}
                                </div>
                              </div>
                            ))}
                            <ArrowRight size={14} className="text-gray-600 flex-shrink-0" />
                            <div className="bg-white/5 border border-white/10 rounded-md px-3 py-2 text-xs text-gray-400 self-center">
                              {p.adapter}
                            </div>
                          </div>
                        )}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <ArrowRight size={14} className="text-gray-600" />
                          <TokenLogo ticker={toToken.ticker} className="w-9 h-9" />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
