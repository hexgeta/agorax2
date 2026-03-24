'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { LiquidGlassCard } from '@/components/ui/liquid-glass';
import { TokenLogo } from '@/components/TokenLogo';
import {
  ExternalLink,
  Copy,
  Check,
  Loader2,
  XCircle,
  ShoppingCart,
  Clock,
  ArrowRight,
} from 'lucide-react';

// ---------- Types ----------

interface OrderData {
  order_id: number;
  maker_address: string;
  sell_token_ticker: string;
  sell_token_address: string;
  sell_amount_raw: string;
  sell_amount_formatted: string | number;
  buy_tokens_tickers: string[];
  buy_tokens_addresses: string[];
  buy_amounts_raw: string[];
  buy_amounts_formatted: (string | number)[];
  status: number;
  status_label: string;
  fill_percentage: number;
  remaining_sell_amount: string;
  redeemed_sell_amount: string;
  is_all_or_nothing: boolean;
  expiration: number;
  creation_tx_hash: string;
  creation_block_number: number;
  created_at: string;
  total_fills: number;
  unique_fillers: number;
}

interface FillData {
  filler_address: string;
  buy_token_ticker: string;
  buy_token_address: string;
  buy_amount_raw: string;
  buy_amount_formatted: string | number;
  sell_amount_released_raw: string;
  tx_hash: string;
  block_number: number;
  filled_at: string;
  contribution_pct: number;
}

interface CancellationData {
  cancelled_by: string;
  fill_percentage_at_cancel: number;
  tx_hash: string;
  block_number: number;
  cancelled_at: string;
}

interface OrderResponse {
  order: OrderData;
  fills: FillData[];
  cancellation: CancellationData | null;
}

// ---------- Helpers ----------

function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function truncateHash(hash: string): string {
  return `${hash.slice(0, 6)}...${hash.slice(-4)}`;
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

function formatExpiration(ts: number): string {
  if (!ts || ts === 0) return 'Never';
  const date = new Date(ts * 1000);
  const now = Date.now();
  const isExpired = date.getTime() <= now;
  const label = date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  return isExpired ? `${label} (expired)` : label;
}

// ---------- Sub-components ----------

function StatusBadge({ label }: { label: string }) {
  const colors: Record<string, string> = {
    active: 'bg-green-500/20 text-green-400 border-green-500/30',
    completed: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    cancelled: 'bg-red-500/20 text-red-400 border-red-500/30',
    expired: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  };
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${colors[label] || 'bg-gray-500/20 text-gray-400 border-gray-500/30'}`}
    >
      {label.charAt(0).toUpperCase() + label.slice(1)}
    </span>
  );
}

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

function TokenDisplay({
  ticker,
  amount,
}: {
  ticker: string;
  amount: string | number | null | undefined;
}) {
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
    <span className="inline-flex items-center gap-1">
      <Link
        href={`/address/${address}`}
        className="text-blue-400 hover:text-blue-300 transition-colors"
      >
        {truncateAddress(address)}
      </Link>
      <a
        href={`https://otter.pulsechain.com/address/${address}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-gray-500 hover:text-gray-300 transition-colors"
        title="View on Otterscan"
      >
        <ExternalLink className="w-3 h-3" />
      </a>
      <CopyButton text={address} />
    </span>
  );
}

function TxLink({ hash }: { hash: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <Link
        href={`/tx/${hash}`}
        className="text-blue-400 hover:text-blue-300 transition-colors font-mono"
      >
        {truncateHash(hash)}
      </Link>
      <CopyButton text={hash} />
    </span>
  );
}

// ---------- Progress Bar ----------

function FillProgressBar({ fillPct, fills }: { fillPct: number; fills: FillData[] }) {
  // Stacked segments: each fill gets a segment proportional to its contribution
  const segments: { pct: number; color: string }[] = [];
  const segmentColors = [
    'bg-blue-500',
    'bg-emerald-500',
    'bg-purple-500',
    'bg-amber-500',
    'bg-pink-500',
    'bg-cyan-500',
    'bg-orange-500',
    'bg-teal-500',
  ];

  if (fills.length > 0) {
    const totalContribution = fills.reduce((sum, f) => sum + f.contribution_pct, 0);
    // If contributions add up, use them for stacking
    if (totalContribution > 0) {
      fills.forEach((fill, i) => {
        const scaledPct = (fill.contribution_pct / totalContribution) * fillPct;
        if (scaledPct > 0) {
          segments.push({
            pct: scaledPct,
            color: segmentColors[i % segmentColors.length],
          });
        }
      });
    } else {
      // Fallback: single bar
      segments.push({ pct: fillPct, color: 'bg-blue-500' });
    }
  } else {
    segments.push({ pct: fillPct, color: 'bg-blue-500' });
  }

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm text-gray-400">Fill Progress</span>
        <span className="text-sm font-medium text-white">{fillPct.toFixed(2)}%</span>
      </div>
      <div className="w-full h-4 bg-white/10 rounded-full overflow-hidden flex">
        {segments.map((seg, i) => (
          <div
            key={i}
            className={`h-full ${seg.color} transition-all`}
            style={{ width: `${Math.min(seg.pct, 100)}%` }}
            title={`Fill ${i + 1}: ${seg.pct.toFixed(2)}%`}
          />
        ))}
      </div>
      {fills.length > 1 && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
          {fills.map((fill, i) => (
            <span key={i} className="flex items-center gap-1 text-xs">
              <span
                className={`w-2 h-2 rounded-full ${segmentColors[i % segmentColors.length]} inline-block`}
              />
              <span className="text-gray-400">
                {truncateAddress(fill.filler_address)}: {fill.contribution_pct.toFixed(2)}%
              </span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- Fill History ----------

function FillHistorySection({ fills }: { fills: FillData[] }) {
  if (fills.length === 0) {
    return (
      <LiquidGlassCard className="p-5 sm:p-6 rounded-xl">
        <h2 className="text-lg font-semibold text-white mb-3">Fill History</h2>
        <p className="text-gray-500 text-sm">No fills yet.</p>
      </LiquidGlassCard>
    );
  }

  return (
    <LiquidGlassCard className="p-5 sm:p-6 rounded-xl">
      <div className="flex items-center gap-2 mb-4">
        <div className="p-2 rounded-lg bg-blue-500/10">
          <ShoppingCart className="w-5 h-5 text-blue-400" />
        </div>
        <h2 className="text-lg font-semibold text-white">
          Fill History ({fills.length})
        </h2>
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <th className="text-left text-gray-500 font-medium py-2 pr-3">Filler</th>
              <th className="text-left text-gray-500 font-medium py-2 pr-3">Token</th>
              <th className="text-right text-gray-500 font-medium py-2 pr-3">Amount</th>
              <th className="text-right text-gray-500 font-medium py-2 pr-3">Contribution</th>
              <th className="text-left text-gray-500 font-medium py-2 pr-3">Tx</th>
              <th className="text-right text-gray-500 font-medium py-2">Time</th>
            </tr>
          </thead>
          <tbody>
            {fills.map((fill, i) => (
              <tr key={i} className="border-b border-white/5 last:border-0">
                <td className="py-2.5 pr-3">
                  <AddressLink address={fill.filler_address} />
                </td>
                <td className="py-2.5 pr-3">
                  <span className="inline-flex items-center gap-1">
                    <TokenLogo ticker={fill.buy_token_ticker} className="w-4 h-4 rounded-full" />
                    <span className="text-gray-300">{fill.buy_token_ticker}</span>
                  </span>
                </td>
                <td className="py-2.5 pr-3 text-right text-white font-medium">
                  {formatAmount(fill.buy_amount_formatted)}
                </td>
                <td className="py-2.5 pr-3 text-right text-gray-400">
                  {fill.contribution_pct.toFixed(2)}%
                </td>
                <td className="py-2.5 pr-3">
                  <TxLink hash={fill.tx_hash} />
                </td>
                <td className="py-2.5 text-right text-gray-400 whitespace-nowrap">
                  {formatDate(fill.filled_at)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="sm:hidden space-y-3">
        {fills.map((fill, i) => (
          <div key={i} className="p-3 rounded-lg bg-white/5 space-y-2">
            <div className="flex items-center justify-between">
              <AddressLink address={fill.filler_address} />
              <span className="text-gray-400 text-xs">{fill.contribution_pct.toFixed(2)}%</span>
            </div>
            <div className="flex items-center justify-between">
              <TokenDisplay ticker={fill.buy_token_ticker} amount={fill.buy_amount_formatted} />
            </div>
            <div className="flex items-center justify-between text-xs">
              <TxLink hash={fill.tx_hash} />
              <span className="text-gray-500">{formatDate(fill.filled_at)}</span>
            </div>
          </div>
        ))}
      </div>
    </LiquidGlassCard>
  );
}

// ---------- Cancellation Section ----------

function CancellationSection({ cancellation }: { cancellation: CancellationData }) {
  return (
    <LiquidGlassCard className="p-5 sm:p-6 rounded-xl border-red-500/20">
      <div className="flex items-center gap-2 mb-4">
        <div className="p-2 rounded-lg bg-red-500/10">
          <XCircle className="w-5 h-5 text-red-400" />
        </div>
        <h2 className="text-lg font-semibold text-white">Cancellation</h2>
      </div>

      <div className="space-y-0">
        <InfoRow label="Cancelled By">
          <AddressLink address={cancellation.cancelled_by} />
        </InfoRow>
        <InfoRow label="Fill % at Cancel">
          <div className="flex items-center gap-2">
            <div className="w-24 h-2 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-red-500 rounded-full"
                style={{
                  width: `${Math.min(cancellation.fill_percentage_at_cancel, 100)}%`,
                }}
              />
            </div>
            <span>{cancellation.fill_percentage_at_cancel.toFixed(2)}%</span>
          </div>
        </InfoRow>
        <InfoRow label="Cancellation Tx">
          <TxLink hash={cancellation.tx_hash} />
        </InfoRow>
        <InfoRow label="Cancelled At">
          {formatDate(cancellation.cancelled_at)}
        </InfoRow>
        <InfoRow label="Block">
          <span className="font-mono">{cancellation.block_number}</span>
        </InfoRow>
      </div>
    </LiquidGlassCard>
  );
}

// ---------- Main Page ----------

export default function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<OrderResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchOrder() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/v1/order/${id}`);
        if (res.status === 404) {
          setError('not_found');
          return;
        }
        if (!res.ok) {
          setError('Failed to fetch order data');
          return;
        }
        const json = await res.json();
        setData(json.data ?? json);
      } catch {
        setError('Failed to fetch order data');
      } finally {
        setLoading(false);
      }
    }
    fetchOrder();
  }, [id]);

  return (
    <div className="min-h-screen bg-black">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">Order Details</h1>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-8 h-8 text-white/40 animate-spin" />
            <p className="text-gray-500 text-sm">Loading order...</p>
          </div>
        )}

        {/* Not Found */}
        {error === 'not_found' && !loading && (
          <LiquidGlassCard className="p-8 sm:p-12 rounded-xl text-center">
            <XCircle className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">Order Not Found</h2>
            <p className="text-gray-500 text-sm max-w-md mx-auto mb-6">
              Order #{id} does not exist in the AgoraX records.
            </p>
            <Link
              href="/marketplace"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-white/10 hover:bg-white/5 text-gray-300 text-sm transition-colors"
            >
              Browse Marketplace
              <ArrowRight className="w-4 h-4" />
            </Link>
          </LiquidGlassCard>
        )}

        {/* Generic Error */}
        {error && error !== 'not_found' && !loading && (
          <LiquidGlassCard className="p-8 rounded-xl text-center">
            <XCircle className="w-12 h-12 text-red-500/60 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-white mb-2">Error</h2>
            <p className="text-gray-500 text-sm">{error}</p>
          </LiquidGlassCard>
        )}

        {/* Order Content */}
        {data && !loading && (
          <div className="space-y-4">
            {/* Order ID + Actions Bar */}
            <LiquidGlassCard className="p-4 sm:p-5 rounded-xl">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-white font-mono text-lg font-bold">
                    Order #{data.order.order_id}
                  </span>
                  <StatusBadge label={data.order.status_label} />
                </div>
                <div className="flex items-center gap-2">
                  {data.order.status_label === 'active' && (
                    <Link
                      href={`/marketplace?order-id=${data.order.order_id}`}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-white/10 hover:bg-white/5 text-gray-300 text-sm font-medium transition-colors"
                    >
                      View in Marketplace
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  )}
                  <a
                    href={`https://otter.pulsechain.com/tx/${data.order.creation_tx_hash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white hover:bg-white/80 text-black text-sm font-medium transition-colors shrink-0"
                  >
                    View on Otterscan
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>
            </LiquidGlassCard>

            {/* Order Details + Status side by side */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Left: Order Details */}
              <LiquidGlassCard className="p-5 sm:p-6 rounded-xl">
                <div className="space-y-0">
                  <InfoRow label="Maker">
                    <AddressLink address={data.order.maker_address} />
                  </InfoRow>

                  <InfoRow label="Selling">
                    <TokenDisplay
                      ticker={data.order.sell_token_ticker}
                      amount={data.order.sell_amount_formatted}
                    />
                  </InfoRow>

                  <InfoRow label="Accepting">
                    <div className="flex flex-wrap gap-2">
                      {data.order.buy_tokens_tickers.map((ticker, i) => (
                        <TokenDisplay
                          key={i}
                          ticker={ticker}
                          amount={data.order.buy_amounts_formatted?.[i]}
                        />
                      ))}
                    </div>
                  </InfoRow>

                  <InfoRow label="Fills">
                    <span className="text-white">{data.fills.length}</span>
                  </InfoRow>

                  <InfoRow label="All or Nothing">
                    {data.order.is_all_or_nothing ? (
                      <span className="text-yellow-400">Yes</span>
                    ) : (
                      <span className="text-gray-400">No</span>
                    )}
                  </InfoRow>

                  <InfoRow label="Expiration">
                    <span className="inline-flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-gray-500" />
                      {formatExpiration(data.order.expiration)}
                    </span>
                  </InfoRow>

                  <InfoRow label="Created">
                    {formatDate(data.order.created_at)}
                  </InfoRow>

                  <InfoRow label="Creation Tx">
                    <TxLink hash={data.order.creation_tx_hash} />
                  </InfoRow>

                  <InfoRow label="Block">
                    <span className="font-mono">{data.order.creation_block_number}</span>
                  </InfoRow>
                </div>
              </LiquidGlassCard>

              {/* Right: Status / Cancellation + Fill Progress */}
              <div className="space-y-4">
                {data.cancellation && (
                  <CancellationSection cancellation={data.cancellation} />
                )}

                <LiquidGlassCard className="p-5 sm:p-6 rounded-xl">
                  <FillProgressBar
                    fillPct={data.order.fill_percentage}
                    fills={data.fills}
                  />
                </LiquidGlassCard>
              </div>
            </div>

            {/* Fill History */}
            <FillHistorySection fills={data.fills} />

          </div>
        )}
      </div>
    </div>
  );
}
