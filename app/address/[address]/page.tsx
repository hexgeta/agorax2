'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { LiquidGlassCard } from '@/components/ui/liquid-glass';
import { TokenLogo } from '@/components/TokenLogo';
import { PixelSpinner } from '@/components/ui/PixelSpinner';
import {
  ExternalLink,
  Copy,
  Check,
  XCircle,
  ShoppingCart,
  PlusCircle,
  Coins,
  Star,
  Hash,
} from 'lucide-react';

// ---------- Types ----------

interface OrderData {
  order_id: number;
  maker_address: string;
  sell_token_ticker: string;
  sell_amount_formatted: string | number;
  buy_tokens_tickers: string[];
  buy_amounts_formatted: (string | number)[];
  status: number;
  status_label: string;
  fill_percentage: number;
  created_at: string;
}

interface FillData {
  order_id: number;
  buy_token_ticker: string;
  buy_amount_formatted: string | number;
  tx_hash: string;
  filled_at: string;
}

interface SummaryData {
  total_orders_created: number;
  total_fills_made: number;
  unique_tokens: number;
  total_order_volume: number;
  total_fill_volume: number;
  total_xp: number | null;
  current_prestige: number | null;
}

interface AddressResponse {
  address: string;
  orders: OrderData[];
  fills: FillData[];
  user: Record<string, unknown> | null;
  summary: SummaryData;
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
  });
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

function StatCard({
  icon,
  label,
  value,
  iconBg,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  iconBg: string;
}) {
  return (
    <LiquidGlassCard className="p-4 sm:p-5 rounded-xl">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${iconBg}`}>{icon}</div>
        <div>
          <p className="text-gray-500 text-xs">{label}</p>
          <p className="text-white text-lg font-semibold">{value}</p>
        </div>
      </div>
    </LiquidGlassCard>
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

// ---------- Orders Section ----------

function OrdersSection({ orders }: { orders: OrderData[] }) {
  if (orders.length === 0) {
    return (
      <LiquidGlassCard className="p-5 sm:p-6 rounded-xl">
        <div className="flex items-center gap-2 mb-3">
          <div className="p-2 rounded-lg bg-emerald-500/10">
            <PlusCircle className="w-5 h-5 text-emerald-400" />
          </div>
          <h2 className="text-lg font-semibold text-white">Orders Created</h2>
        </div>
        <p className="text-gray-500 text-sm">No orders created by this address.</p>
      </LiquidGlassCard>
    );
  }

  return (
    <LiquidGlassCard className="p-5 sm:p-6 rounded-xl">
      <div className="flex items-center gap-2 mb-4">
        <div className="p-2 rounded-lg bg-emerald-500/10">
          <PlusCircle className="w-5 h-5 text-emerald-400" />
        </div>
        <h2 className="text-lg font-semibold text-white">
          Orders Created ({orders.length})
        </h2>
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <th className="text-left text-gray-500 font-medium py-2 pr-3">Order</th>
              <th className="text-left text-gray-500 font-medium py-2 pr-3">Selling</th>
              <th className="text-left text-gray-500 font-medium py-2 pr-3">Buying</th>
              <th className="text-right text-gray-500 font-medium py-2 pr-3">Fill %</th>
              <th className="text-center text-gray-500 font-medium py-2 pr-3">Status</th>
              <th className="text-right text-gray-500 font-medium py-2">Created</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.order_id} className="border-b border-white/5 last:border-0">
                <td className="py-2.5 pr-3">
                  <Link
                    href={`/order/${order.order_id}`}
                    className="text-blue-400 hover:text-blue-300 transition-colors font-mono"
                  >
                    #{order.order_id}
                  </Link>
                </td>
                <td className="py-2.5 pr-3">
                  <TokenDisplay
                    ticker={order.sell_token_ticker}
                    amount={order.sell_amount_formatted}
                  />
                </td>
                <td className="py-2.5 pr-3">
                  <div className="flex flex-wrap gap-1.5">
                    {order.buy_tokens_tickers.map((ticker, i) => (
                      <span key={i} className="inline-flex items-center gap-1">
                        <TokenLogo ticker={ticker} className="w-4 h-4 rounded-full" />
                        <span className="text-gray-300 text-xs">{ticker}</span>
                      </span>
                    ))}
                  </div>
                </td>
                <td className="py-2.5 pr-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <div className="w-16 h-2 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full transition-all"
                        style={{ width: `${Math.min(Number(order.fill_percentage ?? 0), 100)}%` }}
                      />
                    </div>
                    <span className="text-gray-400 text-xs w-14 text-right">
                      {Number(order.fill_percentage ?? 0).toFixed(1)}%
                    </span>
                  </div>
                </td>
                <td className="py-2.5 pr-3 text-center">
                  <StatusBadge label={order.status_label} />
                </td>
                <td className="py-2.5 text-right text-gray-400 whitespace-nowrap text-xs">
                  {formatDate(order.created_at)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="sm:hidden space-y-3">
        {orders.map((order) => (
          <div key={order.order_id} className="p-3 rounded-lg bg-white/5 space-y-2">
            <div className="flex items-center justify-between">
              <Link
                href={`/order/${order.order_id}`}
                className="text-blue-400 hover:text-blue-300 transition-colors font-mono text-sm"
              >
                #{order.order_id}
              </Link>
              <StatusBadge label={order.status_label} />
            </div>
            <div className="flex items-center justify-between">
              <TokenDisplay
                ticker={order.sell_token_ticker}
                amount={order.sell_amount_formatted}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-20 h-2 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full"
                    style={{ width: `${Math.min(Number(order.fill_percentage ?? 0), 100)}%` }}
                  />
                </div>
                <span className="text-gray-400 text-xs">
                  {Number(order.fill_percentage ?? 0).toFixed(1)}%
                </span>
              </div>
              <span className="text-gray-500 text-xs">{formatDate(order.created_at)}</span>
            </div>
          </div>
        ))}
      </div>
    </LiquidGlassCard>
  );
}

// ---------- Fills Section ----------

function FillsSection({ fills }: { fills: FillData[] }) {
  if (fills.length === 0) {
    return (
      <LiquidGlassCard className="p-5 sm:p-6 rounded-xl">
        <div className="flex items-center gap-2 mb-3">
          <div className="p-2 rounded-lg bg-blue-500/10">
            <ShoppingCart className="w-5 h-5 text-blue-400" />
          </div>
          <h2 className="text-lg font-semibold text-white">Fill Activity</h2>
        </div>
        <p className="text-gray-500 text-sm">No fills made by this address.</p>
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
          Fill Activity ({fills.length})
        </h2>
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <th className="text-left text-gray-500 font-medium py-2 pr-3">Order</th>
              <th className="text-left text-gray-500 font-medium py-2 pr-3">Token</th>
              <th className="text-right text-gray-500 font-medium py-2 pr-3">Amount</th>
              <th className="text-left text-gray-500 font-medium py-2 pr-3">Tx Hash</th>
              <th className="text-right text-gray-500 font-medium py-2">Time</th>
            </tr>
          </thead>
          <tbody>
            {fills.map((fill, i) => (
              <tr key={i} className="border-b border-white/5 last:border-0">
                <td className="py-2.5 pr-3">
                  <Link
                    href={`/order/${fill.order_id}`}
                    className="text-blue-400 hover:text-blue-300 transition-colors font-mono"
                  >
                    #{fill.order_id}
                  </Link>
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
                <td className="py-2.5 pr-3">
                  <Link
                    href={`/tx/${fill.tx_hash}`}
                    className="text-blue-400 hover:text-blue-300 transition-colors font-mono"
                  >
                    {truncateHash(fill.tx_hash)}
                  </Link>
                </td>
                <td className="py-2.5 text-right text-gray-400 whitespace-nowrap text-xs">
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
              <Link
                href={`/order/${fill.order_id}`}
                className="text-blue-400 hover:text-blue-300 transition-colors font-mono text-sm"
              >
                #{fill.order_id}
              </Link>
              <TokenDisplay ticker={fill.buy_token_ticker} amount={fill.buy_amount_formatted} />
            </div>
            <div className="flex items-center justify-between text-xs">
              <Link
                href={`/tx/${fill.tx_hash}`}
                className="text-blue-400 hover:text-blue-300 transition-colors font-mono"
              >
                {truncateHash(fill.tx_hash)}
              </Link>
              <span className="text-gray-500">{formatDate(fill.filled_at)}</span>
            </div>
          </div>
        ))}
      </div>
    </LiquidGlassCard>
  );
}

// ---------- Main Page ----------

export default function AddressPage({ params }: { params: Promise<{ address: string }> }) {
  const { address } = use(params);
  const [data, setData] = useState<AddressResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAddress() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/v1/address/${address}`);
        if (res.status === 400) {
          setError('invalid');
          return;
        }
        if (!res.ok) {
          setError('Failed to fetch address data');
          return;
        }
        const json = await res.json();
        setData(json.data ?? json);
      } catch {
        setError('Failed to fetch address data');
      } finally {
        setLoading(false);
      }
    }
    fetchAddress();
  }, [address]);

  return (
    <div className="min-h-screen bg-black">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">Address Details</h1>
        </div>

        {/* Address Bar */}
        <LiquidGlassCard className="p-4 sm:p-5 rounded-xl mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-gray-500 text-sm shrink-0">Address</span>
              <span className="sm:hidden text-white font-mono text-sm truncate">
                {truncateAddress(address)}
              </span>
              <span className="hidden sm:inline text-white font-mono text-sm truncate">
                {address}
              </span>
              <CopyButton text={address} />
            </div>
            <a
              href={`https://otter.pulsechain.com/address/${address}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white hover:bg-white/80 text-black text-sm font-medium transition-colors shrink-0"
            >
              View on Otterscan
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </LiquidGlassCard>

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <PixelSpinner size={32} />
            <p className="text-gray-500 text-sm">Loading address data...</p>
          </div>
        )}

        {/* Invalid Address */}
        {error === 'invalid' && !loading && (
          <LiquidGlassCard className="p-8 sm:p-12 rounded-xl text-center">
            <XCircle className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">Invalid Address</h2>
            <p className="text-gray-500 text-sm max-w-md mx-auto">
              The provided address is not a valid Ethereum address format.
            </p>
          </LiquidGlassCard>
        )}

        {/* Generic Error */}
        {error && error !== 'invalid' && !loading && (
          <LiquidGlassCard className="p-8 rounded-xl text-center">
            <XCircle className="w-12 h-12 text-red-500/60 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-white mb-2">Error</h2>
            <p className="text-gray-500 text-sm">{error}</p>
          </LiquidGlassCard>
        )}

        {/* Content */}
        {data && !loading && (
          <div className="space-y-4">
            {/* Stats Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard
                icon={<PlusCircle className="w-5 h-5 text-emerald-400" />}
                iconBg="bg-emerald-500/10"
                label="Orders Created"
                value={data.summary.total_orders_created}
              />
              <StatCard
                icon={<ShoppingCart className="w-5 h-5 text-blue-400" />}
                iconBg="bg-blue-500/10"
                label="Fills Made"
                value={data.summary.total_fills_made}
              />
              <StatCard
                icon={<Coins className="w-5 h-5 text-purple-400" />}
                iconBg="bg-purple-500/10"
                label="Unique Tokens"
                value={data.summary.unique_tokens}
              />
              {data.summary.total_xp !== null ? (
                <StatCard
                  icon={<Star className="w-5 h-5 text-amber-400" />}
                  iconBg="bg-amber-500/10"
                  label="XP"
                  value={new Intl.NumberFormat('en-US').format(data.summary.total_xp)}
                />
              ) : (
                <StatCard
                  icon={<Hash className="w-5 h-5 text-gray-400" />}
                  iconBg="bg-gray-500/10"
                  label="XP"
                  value="N/A"
                />
              )}
            </div>

            {/* Orders Section */}
            <OrdersSection orders={data.orders} />

            {/* Fill Activity Section */}
            <FillsSection fills={data.fills} />

            {/* Empty state if no activity at all */}
            {data.orders.length === 0 && data.fills.length === 0 && (
              <p className="text-gray-600 text-xs text-center pt-2">
                No AgoraX activity found for this address.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
