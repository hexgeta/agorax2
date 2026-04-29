'use client';

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useAccount, useBalance, useContractWrite, useReadContract, usePublicClient, useSendTransaction } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { LiquidGlassCard } from '@/components/ui/liquid-glass';
import { TokenLogo } from '@/components/TokenLogo';
import { ConnectButton } from '@/components/ConnectButton';
import { Loader2, ArrowDownUp, ChevronDown } from 'lucide-react';
import useToast from '@/hooks/use-toast';
import { getBlockExplorerTxUrl } from '@/utils/blockExplorer';
import { formatNumberWithCommas, removeCommas } from '@/utils/format';
import { TOKEN_CONSTANTS } from '@/constants/crypto';
import { PRIORITY_TOKEN_ADDRESSES, getTokenInfo } from '@/utils/tokenUtils';

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
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

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
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/10 rounded-lg px-3 py-2 transition-colors"
      >
        <TokenLogo ticker={value.ticker} className="w-6 h-6" />
        <span className="text-white text-sm font-medium">{value.ticker}</span>
        <ChevronDown size={14} className="text-gray-400" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-72 max-h-80 overflow-y-auto bg-black/95 border border-white/10 rounded-lg shadow-xl z-50">
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
        </div>
      )}
    </div>
  );
}

export default function DexPage() {
  const { address, isConnected, chainId } = useAccount();
  const publicClient = usePublicClient();
  const { toast } = useToast();

  const tokens = useMemo(() => buildTokenList(), []);
  const defaultFrom = useMemo(
    () => tokens.find((t) => t.isNative) || tokens[0],
    [tokens]
  );
  const defaultTo = useMemo(
    () => tokens.find((t) => t.ticker === 'PLSX') || tokens[1],
    [tokens]
  );

  const [fromToken, setFromToken] = useState<TokenOption>(defaultFrom);
  const [toToken, setToToken] = useState<TokenOption>(defaultTo);
  const [amount, setAmount] = useState('');
  const [agoraxOnly, setAgoraxOnly] = useState(false);
  const [slippageBps, setSlippageBps] = useState(50);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [txPending, setTxPending] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  // Fetch quote with debounce
  useEffect(() => {
    setQuote(null);
    setQuoteError(null);
    if (!amount || parseFloat(amount) <= 0) return;

    const handle = setTimeout(async () => {
      try {
        setQuoteLoading(true);
        const amountWei = parseUnits(amount, fromToken.decimals).toString();
        const params = new URLSearchParams({
          from: getSwitchAddress(fromToken),
          to: getSwitchAddress(toToken),
          amount: amountWei,
          slippage: String(slippageBps),
        });
        if (address) params.set('sender', address);
        if (agoraxOnly) params.set('adapters', AGORAX_ADAPTER_INDEX);

        const res = await fetch(`/api/switch-quote?${params.toString()}`);
        const data = await res.json();
        if (!res.ok) {
          setQuoteError(data?.error || data?.message || 'Quote failed');
          setQuote(null);
        } else {
          setQuote(data);
        }
      } catch (err) {
        setQuoteError(err instanceof Error ? err.message : 'Quote failed');
      } finally {
        setQuoteLoading(false);
      }
    }, 400);

    return () => clearTimeout(handle);
  }, [amount, fromToken, toToken, agoraxOnly, slippageBps, address]);

  const handleMax = () => {
    if (fromToken.isNative) {
      const bal = parseFloat(nativeBalance?.formatted || '0');
      const max = Math.max(0, bal - 100);
      setAmount(max > 0 ? max.toString() : '0');
    } else {
      setAmount(fromBalanceFormatted);
    }
  };

  const handleSwapDirection = () => {
    setFromToken(toToken);
    setToToken(fromToken);
    setAmount('');
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
  const canSubmit = isValidAmount && quote?.tx && !quoteLoading && !txPending;

  const expectedOut = quote
    ? formatUnits(BigInt(quote.expectedOutputAmount), toToken.decimals)
    : '';
  const minOut = quote ? formatUnits(BigInt(quote.minAmountOut), toToken.decimals) : '';

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-bold text-white text-center mb-2">DEX Aggregator</h1>
        <p className="text-gray-400 text-center text-sm mb-6">
          Trade tokens via Switch.win — route through AgoraX OTC or all DEXes
        </p>

        {/* Routing toggle */}
        <div className="flex gap-2 mb-6 justify-center">
          <button
            onClick={() => setAgoraxOnly(false)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
              !agoraxOnly
                ? 'bg-white text-black border-white'
                : 'bg-white/5 text-gray-400 border-white/10 hover:text-white hover:border-white/20'
            }`}
          >
            All DEXes
          </button>
          <button
            onClick={() => setAgoraxOnly(true)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
              agoraxOnly
                ? 'bg-white text-black border-white'
                : 'bg-white/5 text-gray-400 border-white/10 hover:text-white hover:border-white/20'
            }`}
          >
            AgoraX Only
          </button>
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
            <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-3">
              <input
                ref={inputRef}
                type="text"
                inputMode="decimal"
                placeholder="0.0"
                value={formatNumberWithCommas(amount)}
                onChange={(e) => {
                  const val = removeCommas(e.target.value).replace(/[^0-9.]/g, '');
                  if (val.split('.').length > 2) return;
                  const parts = val.split('.');
                  if (parts[1] && parts[1].length > fromToken.decimals) return;
                  setAmount(val);
                }}
                className="flex-1 min-w-0 bg-transparent text-white text-xl font-medium outline-none placeholder-gray-600"
              />
              <button
                onClick={handleMax}
                className="flex-shrink-0 text-xs text-gray-400 hover:text-white bg-white/10 px-2 py-1 rounded transition-colors"
              >
                MAX
              </button>
              <TokenSelect
                value={fromToken}
                onChange={(t) => {
                  setFromToken(t);
                  setAmount('');
                }}
                tokens={tokens}
                disabledAddress={toToken.address}
              />
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
            <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-3">
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
                          maximumFractionDigits: 8,
                          useGrouping: false,
                        })
                      )
                    : '0.0'}
              </span>
              <TokenSelect
                value={toToken}
                onChange={setToToken}
                tokens={tokens}
                disabledAddress={fromToken.address}
              />
            </div>
          </div>

          {/* Slippage */}
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs text-gray-500 uppercase tracking-wider">Slippage</span>
            <div className="flex gap-1">
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
            </div>
          </div>

          {/* Quote info */}
          {quote && (
            <div className="mb-4 p-3 bg-white/5 border border-white/10 rounded-lg text-xs text-gray-400 space-y-1">
              <div className="flex justify-between">
                <span>Min received</span>
                <span className="text-white">
                  {parseFloat(minOut).toLocaleString('en-US', { maximumFractionDigits: 6 })}{' '}
                  {toToken.ticker}
                </span>
              </div>
              {quote.effectiveSlippagePercent && (
                <div className="flex justify-between">
                  <span>Effective slippage</span>
                  <span className="text-white">{quote.effectiveSlippagePercent}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Route</span>
                <span className="text-white">{agoraxOnly ? 'AgoraX OTC only' : 'All DEXes'}</span>
              </div>
            </div>
          )}

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
              ) : !quote?.tx ? (
                quoteError || 'No route found'
              ) : (
                `Swap ${fromToken.ticker} → ${toToken.ticker}`
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
