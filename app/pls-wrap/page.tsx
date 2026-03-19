'use client';

import { useState, useCallback, useRef } from 'react';
import { useAccount, useBalance, useContractWrite, useReadContract, usePublicClient } from 'wagmi';
import { parseEther, formatEther } from 'viem';
import { LiquidGlassCard } from '@/components/ui/liquid-glass';
import { TokenLogo } from '@/components/TokenLogo';
import { ConnectButton } from '@/components/ConnectButton';
import { Loader2, ArrowDownUp } from 'lucide-react';
import useToast from '@/hooks/use-toast';
import { getBlockExplorerTxUrl } from '@/utils/blockExplorer';
import { formatNumberWithCommas, removeCommas } from '@/utils/format';

// Contract addresses
const WPLS_ADDRESS = '0xA1077a294dDE1B09bB078844df40758a5D0f9a27' as const;
const PWETH_ADDRESS = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2' as const;

// Minimal WETH/WPLS ABI (deposit + withdraw + balanceOf)
const WRAP_ABI = [
  {
    name: 'deposit',
    type: 'function',
    stateMutability: 'payable',
    inputs: [],
    outputs: [],
  },
  {
    name: 'withdraw',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'wad', type: 'uint256' }],
    outputs: [],
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

type WrapToken = 'WPLS' | 'pWETH';

export default function PLSWrapPage() {
  const { address, isConnected, chainId } = useAccount();
  const publicClient = usePublicClient();
  const { toast } = useToast();
  const [selectedToken, setSelectedToken] = useState<WrapToken>('WPLS');
  const [isWrapping, setIsWrapping] = useState(true); // true = wrap, false = unwrap
  const [amount, setAmount] = useState('');
  const [txPending, setTxPending] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const contractAddress = selectedToken === 'WPLS' ? WPLS_ADDRESS : PWETH_ADDRESS;

  // Native PLS balance
  const { data: plsBalance, refetch: refetchPls } = useBalance({
    address,
  });

  // Wrapped token balance
  const { data: wrappedBalance, refetch: refetchWrapped } = useReadContract({
    address: contractAddress,
    abi: WRAP_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const { writeContractAsync } = useContractWrite();

  const fromBalance = isWrapping
    ? plsBalance?.formatted || '0'
    : wrappedBalance ? formatEther(wrappedBalance as bigint) : '0';

  const toBalance = isWrapping
    ? wrappedBalance ? formatEther(wrappedBalance as bigint) : '0'
    : plsBalance?.formatted || '0';

  const handleMax = () => {
    if (isWrapping) {
      // Leave some PLS for gas
      const bal = parseFloat(plsBalance?.formatted || '0');
      const max = Math.max(0, bal - 100);
      setAmount(max > 0 ? max.toString() : '0');
    } else {
      const bal = wrappedBalance ? formatEther(wrappedBalance as bigint) : '0';
      setAmount(bal);
    }
  };

  const handleSwapDirection = () => {
    setIsWrapping(!isWrapping);
    setAmount('');
    setTxHash(null);
    setError(null);
  };

  const handleSubmit = useCallback(async () => {
    if (!address || !amount || parseFloat(amount) <= 0 || !publicClient) return;
    setTxPending(true);
    setTxHash(null);
    setError(null);

    const action = isWrapping ? 'Wrapping' : 'Unwrapping';

    try {
      const parsedAmount = parseEther(amount);

      let hash: string;
      if (isWrapping) {
        hash = await writeContractAsync({
          address: contractAddress,
          abi: WRAP_ABI,
          functionName: 'deposit',
          value: parsedAmount,
        });
      } else {
        hash = await writeContractAsync({
          address: contractAddress,
          abi: WRAP_ABI,
          functionName: 'withdraw',
          args: [parsedAmount],
        });
      }

      setAmount('');

      // Show pending toast
      const { dismiss } = toast({
        title: `${action}...`,
        description: 'Waiting for confirmation on-chain.',
      });

      // Wait for receipt
      try {
        await publicClient.waitForTransactionReceipt({ hash: hash as `0x${string}` });
        dismiss();
        setTxHash(hash);
        toast({
          title: `${isWrapping ? 'Wrapped' : 'Unwrapped'} successfully!`,
          description: (
            <a
              href={getBlockExplorerTxUrl(chainId, hash)}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              View on Otterscan
            </a>
          ),
          variant: 'success' as never,
        });
      } catch {
        dismiss();
        toast({
          title: 'Transaction may have failed',
          description: 'Check the block explorer to verify.',
          variant: 'destructive',
        });
      }

      refetchPls();
      refetchWrapped();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Transaction failed';
      if (message.includes('User rejected') || message.includes('user rejected')) {
        setError('Transaction cancelled');
      } else {
        setError(message.length > 100 ? message.slice(0, 100) + '...' : message);
      }
    } finally {
      setTxPending(false);
    }
  }, [address, amount, isWrapping, contractAddress, writeContractAsync, publicClient, chainId, toast, refetchPls, refetchWrapped]);

  const isValidAmount = amount && parseFloat(amount) > 0 && parseFloat(amount) <= parseFloat(fromBalance);

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-bold text-white text-center mb-2">Wrap & Unwrap PLS</h1>
        <p className="text-gray-400 text-center text-sm mb-8">Convert between native PLS and wrapped tokens</p>

        {/* Token selector */}
        <div className="flex gap-2 mb-6 justify-center">
          {(['WPLS', 'pWETH'] as const).map((token) => (
            <button
              key={token}
              onClick={() => { setSelectedToken(token); setAmount(''); setTxHash(null); setError(null); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                selectedToken === token
                  ? 'bg-white text-black border-white'
                  : 'bg-white/5 text-gray-400 border-white/10 hover:text-white hover:border-white/20'
              }`}
            >
              <TokenLogo ticker={token} className="w-5 h-5" />
              {token}
            </button>
          ))}
        </div>

        <LiquidGlassCard className="p-6 rounded-2xl">
          {/* From section */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs text-gray-500 uppercase tracking-wider">
                {isWrapping ? 'From (PLS)' : `From (${selectedToken})`}
              </span>
              <span className="text-xs text-gray-500">
                Balance: {parseFloat(fromBalance).toLocaleString('en-US', { maximumFractionDigits: 4 })}
              </span>
            </div>
            <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-4 py-3">
              <TokenLogo ticker={isWrapping ? 'PLS' : selectedToken} className="w-8 h-8" />
              <input
                ref={inputRef}
                type="text"
                inputMode="decimal"
                placeholder="0.0"
                value={formatNumberWithCommas(amount)}
                onChange={(e) => {
                  const input = e.target;
                  const cursorPos = input.selectionStart || 0;
                  const oldValue = input.value;

                  const val = removeCommas(e.target.value).replace(/[^0-9.]/g, '');
                  if (val.split('.').length > 2) return;
                  const parts = val.split('.');
                  if (parts[1] && parts[1].length > 18) return;
                  setAmount(val);

                  // Restore cursor position accounting for comma changes
                  const newValue = formatNumberWithCommas(val);
                  const digitsBeforeCursor = removeCommas(oldValue.slice(0, cursorPos)).length;
                  let newCursorPos = 0;
                  let digitCount = 0;
                  for (let i = 0; i < newValue.length; i++) {
                    if (digitCount >= digitsBeforeCursor) { newCursorPos = i; break; }
                    if (newValue[i] !== ',') digitCount++;
                    newCursorPos = i + 1;
                  }
                  requestAnimationFrame(() => {
                    inputRef.current?.setSelectionRange(newCursorPos, newCursorPos);
                  });
                }}
                className="flex-1 bg-transparent text-white text-xl font-medium outline-none placeholder-gray-600"
              />
              <button
                onClick={handleMax}
                className="text-xs text-gray-400 hover:text-white bg-white/10 px-2 py-1 rounded transition-colors"
              >
                MAX
              </button>
            </div>
          </div>

          {/* Swap direction button */}
          <div className="flex justify-center my-3 relative z-10">
            <button
              onClick={handleSwapDirection}
              className="p-2 rounded-full bg-white/10 border border-white/10 hover:bg-white/20 transition-colors"
            >
              <ArrowDownUp size={18} className="text-gray-400" />
            </button>
          </div>

          {/* To section */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs text-gray-500 uppercase tracking-wider">
                {isWrapping ? `To (${selectedToken})` : 'To (PLS)'}
              </span>
              <span className="text-xs text-gray-500">
                Balance: {parseFloat(toBalance).toLocaleString('en-US', { maximumFractionDigits: 4 })}
              </span>
            </div>
            <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-4 py-3">
              <TokenLogo ticker={isWrapping ? selectedToken : 'PLS'} className="w-8 h-8" />
              <span className={`flex-1 text-xl font-medium ${amount && parseFloat(amount) > 0 ? 'text-white' : 'text-gray-600'}`}>
                {amount && parseFloat(amount) > 0 ? formatNumberWithCommas(amount) : '0.0'}
              </span>
            </div>
          </div>

          {/* Info */}
          <div className="text-xs text-gray-500 mb-4 text-center">
            1 PLS = 1 {selectedToken} (wrapping is always 1:1)
          </div>

          {/* Action button */}
          {!isConnected ? (
            <ConnectButton />
          ) : (
            <button
              onClick={handleSubmit}
              disabled={txPending || !isValidAmount}
              className="w-full py-3 rounded-xl bg-white hover:bg-gray-200 text-black font-bold text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {txPending ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  {isWrapping ? 'Wrapping...' : 'Unwrapping...'}
                </>
              ) : (
                isWrapping ? `Wrap PLS → ${selectedToken}` : `Unwrap ${selectedToken} → PLS`
              )}
            </button>
          )}

          {/* Success */}
          {txHash && (
            <div className="mt-4 p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-center">
              <p className="text-green-400 text-sm font-medium">Transaction confirmed!</p>
              <a
                href={getBlockExplorerTxUrl(chainId, txHash)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-green-400/70 text-xs hover:text-green-400 underline mt-1 inline-block"
              >
                View on Otterscan
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

        {/* Contract info */}
        <div className="mt-6 text-center text-xs text-gray-600">
          <p>{selectedToken} Contract:</p>
          <p
            className="font-mono text-gray-500 mt-1 break-all cursor-pointer hover:text-white transition-colors"
            onClick={() => { navigator.clipboard.writeText(contractAddress); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
          >
            {contractAddress}
            {copied && <span className="ml-2 text-green-400 font-sans">Copied!</span>}
          </p>
        </div>
      </div>
    </div>
  );
}
