'use client';

import { useState, useEffect, use } from 'react';
import { LiquidGlassCard } from '@/components/ui/liquid-glass';
import { TokenLogo } from '@/components/TokenLogo';
import { ExternalLink, Copy, Check, Loader2, ArrowRight, XCircle, ShoppingCart, PlusCircle } from 'lucide-react';

// ---------- Types ----------

interface TxEvent {
  type: 'order_created' | 'order_filled' | 'order_cancelled';
  data: Record<string, unknown>;
}

interface TxResponse {
  tx_hash: string;
  events: TxEvent[];
}

// ---------- Helpers ----------

function truncateHash(hash: string): string {
  return `${hash.slice(0, 6)}...${hash.slice(-4)}`;
}

function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatAmount(formatted: string | number | null | undefined): string {
  if (formatted == null) return '0';
  const num = typeof formatted === 'string' ? parseFloat(formatted) : formatted;
  if (isNaN(num)) return '0';
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 4,
    minimumFractionDigits: 0,
  }).format(num);
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return 'N/A';
  return new Date(iso).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function statusBadge(label: string) {
  const colors: Record<string, string> = {
    active: 'bg-green-500/20 text-green-400 border-green-500/30',
    completed: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    cancelled: 'bg-red-500/20 text-red-400 border-red-500/30',
    expired: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${colors[label] || 'bg-gray-500/20 text-gray-400 border-gray-500/30'}`}>
      {label.charAt(0).toUpperCase() + label.slice(1)}
    </span>
  );
}

// ---------- Sub-components ----------

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="p-1 rounded hover:bg-white/10 transition-colors"
      title="Copy to clipboard"
    >
      {copied ? (
        <Check className="w-4 h-4 text-green-400" />
      ) : (
        <Copy className="w-4 h-4 text-gray-400" />
      )}
    </button>
  );
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 py-2.5 border-b border-white/5 last:border-0">
      <span className="text-gray-500 text-sm min-w-[140px] shrink-0">{label}</span>
      <span className="text-white text-sm break-all">{children}</span>
    </div>
  );
}

function TokenDisplay({ ticker, amount }: { ticker: string; amount: string | number | null | undefined }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <TokenLogo ticker={ticker} className="w-5 h-5 rounded-full" />
      <span className="font-medium">{formatAmount(amount)}</span>
      <span className="text-gray-400">{ticker}</span>
    </span>
  );
}

function AddressLink({ address }: { address: string }) {
  return (
    <a
      href={`https://otter.pulsechain.com/address/${address}`}
      target="_blank"
      rel="noopener noreferrer"
      className="text-blue-400 hover:text-blue-300 transition-colors inline-flex items-center gap-1"
    >
      {truncateAddress(address)}
      <ExternalLink className="w-3 h-3" />
    </a>
  );
}

// ---------- Event Cards ----------

function OrderCreatedCard({ data }: { data: Record<string, unknown> }) {
  const buyTickers = (data.buy_tokens_tickers as string[] | null) || [];
  const buyAmounts = (data.buy_amounts_formatted as (string | number)[] | null) || [];
  const expirationTs = data.expiration as number | null;
  const expirationStr = expirationTs && expirationTs > 0
    ? formatDate(new Date(expirationTs * 1000).toISOString())
    : 'Never';

  return (
    <LiquidGlassCard className="p-5 sm:p-6 rounded-xl">
      <div className="flex items-center gap-2 mb-4">
        <div className="p-2 rounded-lg bg-emerald-500/10">
          <PlusCircle className="w-5 h-5 text-emerald-400" />
        </div>
        <h2 className="text-lg font-semibold text-white">Order Created</h2>
        {typeof data.status_label === 'string' && statusBadge(data.status_label)}
      </div>

      <div className="space-y-0">
        <InfoRow label="Order ID">
          <span className="font-mono">#{String(data.order_id)}</span>
        </InfoRow>

        <InfoRow label="Maker">
          <AddressLink address={data.maker_address as string} />
        </InfoRow>

        <InfoRow label="Selling">
          <TokenDisplay
            ticker={data.sell_token_ticker as string}
            amount={data.sell_amount_formatted as string}
          />
        </InfoRow>

        <InfoRow label="Accepting">
          <div className="flex flex-wrap gap-2">
            {buyTickers.map((ticker, i) => (
              <TokenDisplay key={i} ticker={ticker} amount={buyAmounts[i]} />
            ))}
          </div>
        </InfoRow>

        <InfoRow label="Fill %">
          <div className="flex items-center gap-2">
            <div className="w-24 h-2 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all"
                style={{ width: `${Math.min(Number(data.fill_percentage ?? 0), 100)}%` }}
              />
            </div>
            <span className="text-sm">{Number(data.fill_percentage ?? 0).toFixed(2)}%</span>
          </div>
        </InfoRow>

        <InfoRow label="All or Nothing">
          {data.is_all_or_nothing ? 'Yes' : 'No'}
        </InfoRow>

        <InfoRow label="Expiration">{expirationStr}</InfoRow>

        <InfoRow label="Created">
          {formatDate(data.created_at as string)}
        </InfoRow>

        <InfoRow label="Block">
          <span className="font-mono">{String(data.creation_block_number ?? '')}</span>
        </InfoRow>
      </div>
    </LiquidGlassCard>
  );
}

function OrderFilledCard({ data }: { data: Record<string, unknown> }) {
  const parentOrder = data.parent_order as Record<string, unknown> | null;

  return (
    <LiquidGlassCard className="p-5 sm:p-6 rounded-xl">
      <div className="flex items-center gap-2 mb-4">
        <div className="p-2 rounded-lg bg-blue-500/10">
          <ShoppingCart className="w-5 h-5 text-blue-400" />
        </div>
        <h2 className="text-lg font-semibold text-white">Order Filled</h2>
      </div>

      <div className="space-y-0">
        <InfoRow label="Order ID">
          <span className="font-mono">#{String(data.order_id)}</span>
        </InfoRow>

        <InfoRow label="Filler">
          <AddressLink address={data.filler_address as string} />
        </InfoRow>

        <InfoRow label="Fill Token">
          <TokenDisplay
            ticker={data.buy_token_ticker as string}
            amount={data.buy_amount_formatted as string}
          />
        </InfoRow>

        {parentOrder && (
          <InfoRow label="Order Selling">
            <TokenDisplay
              ticker={parentOrder.sell_token_ticker as string}
              amount={parentOrder.sell_amount_formatted as string}
            />
          </InfoRow>
        )}

        {parentOrder && (
          <InfoRow label="Order Fill %">
            <div className="flex items-center gap-2">
              <div className="w-24 h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all"
                  style={{ width: `${Math.min(Number(parentOrder.fill_percentage ?? 0), 100)}%` }}
                />
              </div>
              <span className="text-sm">{Number(parentOrder.fill_percentage ?? 0).toFixed(2)}%</span>
            </div>
          </InfoRow>
        )}

        <InfoRow label="Filled At">
          {formatDate(data.filled_at as string)}
        </InfoRow>

        <InfoRow label="Block">
          <span className="font-mono">{String(data.block_number ?? '')}</span>
        </InfoRow>
      </div>
    </LiquidGlassCard>
  );
}

function OrderCancelledCard({ data }: { data: Record<string, unknown> }) {
  const parentOrder = data.parent_order as Record<string, unknown> | null;

  return (
    <LiquidGlassCard className="p-5 sm:p-6 rounded-xl">
      <div className="flex items-center gap-2 mb-4">
        <div className="p-2 rounded-lg bg-red-500/10">
          <XCircle className="w-5 h-5 text-red-400" />
        </div>
        <h2 className="text-lg font-semibold text-white">Order Cancelled</h2>
      </div>

      <div className="space-y-0">
        <InfoRow label="Order ID">
          <span className="font-mono">#{String(data.order_id)}</span>
        </InfoRow>

        <InfoRow label="Cancelled By">
          <AddressLink address={data.cancelled_by as string} />
        </InfoRow>

        <InfoRow label="Fill % at Cancel">
          <div className="flex items-center gap-2">
            <div className="w-24 h-2 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-red-500 rounded-full transition-all"
                style={{ width: `${Math.min(Number(data.fill_percentage_at_cancel ?? 0), 100)}%` }}
              />
            </div>
            <span className="text-sm">{Number(data.fill_percentage_at_cancel ?? 0).toFixed(2)}%</span>
          </div>
        </InfoRow>

        {parentOrder && (
          <InfoRow label="Order Was Selling">
            <TokenDisplay
              ticker={parentOrder.sell_token_ticker as string}
              amount={parentOrder.sell_amount_formatted as string}
            />
          </InfoRow>
        )}

        <InfoRow label="Cancelled At">
          {formatDate(data.cancelled_at as string)}
        </InfoRow>

        <InfoRow label="Block">
          <span className="font-mono">{String(data.block_number ?? '')}</span>
        </InfoRow>
      </div>
    </LiquidGlassCard>
  );
}

// ---------- Main Page ----------

export default function TransactionPage({ params }: { params: Promise<{ hash: string }> }) {
  const { hash } = use(params);
  const [data, setData] = useState<TxResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTx() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/v1/tx/${hash}`);
        if (res.status === 404) {
          setError('not_found');
          return;
        }
        if (!res.ok) {
          setError('Failed to fetch transaction data');
          return;
        }
        const json = await res.json();
        setData(json.data ?? json);
      } catch {
        setError('Failed to fetch transaction data');
      } finally {
        setLoading(false);
      }
    }
    fetchTx();
  }, [hash]);

  return (
    <div className="min-h-screen bg-black">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">Transaction Details</h1>
          <p className="text-gray-500 text-sm">AgoraX on-chain activity</p>
        </div>

        {/* Tx Hash Bar */}
        <LiquidGlassCard className="p-4 sm:p-5 rounded-xl mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-gray-500 text-sm shrink-0">Tx Hash</span>
              <span className="text-white font-mono text-sm truncate">{truncateHash(hash)}</span>
              <span className="hidden sm:inline text-white font-mono text-sm truncate">{hash}</span>
              <CopyButton text={hash} />
            </div>
            <a
              href={`https://otter.pulsechain.com/tx/${hash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors shrink-0"
            >
              View on Otterscan
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </LiquidGlassCard>

        {/* Content */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-8 h-8 text-white/40 animate-spin" />
            <p className="text-gray-500 text-sm">Loading transaction...</p>
          </div>
        )}

        {error === 'not_found' && !loading && (
          <LiquidGlassCard className="p-8 sm:p-12 rounded-xl text-center">
            <XCircle className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">Transaction Not Found</h2>
            <p className="text-gray-500 text-sm max-w-md mx-auto mb-6">
              This transaction hash does not match any known AgoraX order creation, fill, or cancellation.
            </p>
            <a
              href={`https://otter.pulsechain.com/tx/${hash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-white/10 hover:bg-white/5 text-gray-300 text-sm transition-colors"
            >
              View on Otterscan anyway
              <ExternalLink className="w-4 h-4" />
            </a>
          </LiquidGlassCard>
        )}

        {error && error !== 'not_found' && !loading && (
          <LiquidGlassCard className="p-8 rounded-xl text-center">
            <XCircle className="w-12 h-12 text-red-500/60 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-white mb-2">Error</h2>
            <p className="text-gray-500 text-sm">{error}</p>
          </LiquidGlassCard>
        )}

        {data && !loading && (
          <div className="space-y-4">
            {data.events.map((event, i) => {
              switch (event.type) {
                case 'order_created':
                  return <OrderCreatedCard key={i} data={event.data as Record<string, unknown>} />;
                case 'order_filled':
                  return <OrderFilledCard key={i} data={event.data as Record<string, unknown>} />;
                case 'order_cancelled':
                  return <OrderCancelledCard key={i} data={event.data as Record<string, unknown>} />;
                default:
                  return null;
              }
            })}

            {data.events.length > 1 && (
              <p className="text-gray-600 text-xs text-center pt-2">
                This transaction contains {data.events.length} AgoraX events
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
