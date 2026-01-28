'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { LiquidGlassCard } from '@/components/ui/liquid-glass';
import { TokenLogo } from '@/components/TokenLogo';
import { ScoredOrder } from '@/types/discover';
import { getTokenInfo, getTokenInfoByIndex, formatTokenTicker } from '@/utils/tokenUtils';
import { formatUnits } from 'viem';
import { cn } from '@/lib/utils';

interface SavedOrdersDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  orders: ScoredOrder[];
  onFillOrder: (order: ScoredOrder) => void;
  onRemoveOrder: (orderId: string) => void;
}

export function SavedOrdersDrawer({
  isOpen,
  onClose,
  orders,
  onFillOrder,
  onRemoveOrder,
}: SavedOrdersDrawerProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          />

          {/* Drawer */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 max-h-[80vh] overflow-hidden"
          >
            <LiquidGlassCard
              className="rounded-t-3xl"
              glowIntensity="low"
              blurIntensity="xl"
            >
              {/* Handle */}
              <div className="flex justify-center pt-3 pb-2">
                <div className="w-10 h-1 bg-white/20 rounded-full" />
              </div>

              {/* Header */}
              <div className="flex items-center justify-between px-5 pb-4 border-b border-white/10">
                <div>
                  <h2 className="text-lg font-semibold text-white">Saved Orders</h2>
                  <p className="text-sm text-white/40">
                    {orders.length} order{orders.length !== 1 ? 's' : ''} saved
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 rounded-full hover:bg-white/10 transition-colors"
                  aria-label="Close"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                    className="w-5 h-5 text-white/60"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Order list */}
              <div className="overflow-y-auto max-h-[60vh] p-4 space-y-3">
                {orders.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="text-4xl mb-3">💾</div>
                    <p className="text-white/60">No saved orders yet</p>
                    <p className="text-sm text-white/40 mt-1">
                      Swipe right on orders to save them here
                    </p>
                  </div>
                ) : (
                  orders.map(order => (
                    <SavedOrderCard
                      key={order.orderDetailsWithID.orderID.toString()}
                      order={order}
                      onFill={() => onFillOrder(order)}
                      onRemove={() => onRemoveOrder(order.orderDetailsWithID.orderID.toString())}
                    />
                  ))
                )}
              </div>
            </LiquidGlassCard>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

interface SavedOrderCardProps {
  order: ScoredOrder;
  onFill: () => void;
  onRemove: () => void;
}

function SavedOrderCard({ order, onFill, onRemove }: SavedOrderCardProps) {
  const orderDetails = order.orderDetailsWithID.orderDetails;
  const sellTokenInfo = getTokenInfo(orderDetails.sellToken);
  const firstBuyTokenInfo = getTokenInfoByIndex(Number(orderDetails.buyTokensIndex[0]));

  const sellAmount = parseFloat(
    formatUnits(order.orderDetailsWithID.remainingSellAmount, sellTokenInfo.decimals)
  );
  const buyAmount = parseFloat(
    formatUnits(orderDetails.buyAmounts[0], firstBuyTokenInfo.decimals)
  );

  const formatAmount = (amount: number): string => {
    if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M`;
    if (amount >= 1_000) return `${(amount / 1_000).toFixed(1)}K`;
    return amount.toFixed(2);
  };

  return (
    <div className="bg-white/5 rounded-xl p-3 border border-white/10">
      <div className="flex items-center gap-3">
        {/* Token pair */}
        <div className="flex items-center -space-x-2">
          <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center overflow-hidden ring-2 ring-black">
            <TokenLogo ticker={sellTokenInfo.ticker} className="w-6 h-6" />
          </div>
          <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center overflow-hidden ring-2 ring-black">
            <TokenLogo ticker={firstBuyTokenInfo.ticker} className="w-6 h-6" />
          </div>
        </div>

        {/* Trade info */}
        <div className="flex-1 min-w-0">
          <div className="text-sm text-white truncate">
            {formatAmount(sellAmount)} {formatTokenTicker(sellTokenInfo.ticker)} →{' '}
            {formatAmount(buyAmount)} {formatTokenTicker(firstBuyTokenInfo.ticker)}
          </div>
          <div className="flex items-center gap-2 text-xs text-white/40">
            <span
              className={cn(
                order.priceDiscount > 0 ? 'text-green-400' : 'text-white/40'
              )}
            >
              {order.priceDiscount > 0 ? '-' : '+'}{Math.abs(order.priceDiscount).toFixed(1)}%
            </span>
            <span>•</span>
            <span>Score: {order.score}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={onRemove}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            aria-label="Remove"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-4 h-4 text-white/40"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
              />
            </svg>
          </button>
          <button
            onClick={onFill}
            className="px-3 py-1.5 bg-green-500/20 hover:bg-green-500/30 text-green-400 text-sm font-medium rounded-lg transition-colors border border-green-500/30"
          >
            Fill
          </button>
        </div>
      </div>
    </div>
  );
}
