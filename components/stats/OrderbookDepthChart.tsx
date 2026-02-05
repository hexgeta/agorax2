'use client';

import { useMemo } from 'react';
import { LiquidGlassCard } from '@/components/ui/liquid-glass';
import { formatUSD, formatPriceSigFig, getTokenPrice } from '@/utils/format';
import { getTokenInfo, getTokenInfoByIndex } from '@/utils/tokenUtils';
import { CompleteOrderDetails } from '@/hooks/contracts/useOpenPositions';

interface OrderbookDepthChartProps {
  orders: CompleteOrderDetails[];
  tokenPrices: Record<string, { price: number }>;
  whitelist: string[];
  selectedToken: string | null;
}

interface PriceLevel {
  price: number;
  totalValueUSD: number;
  orderCount: number;
  orders: {
    orderId: string;
    valueUSD: number;
    counterToken: string;
  }[];
}

export default function OrderbookDepthChart({ orders, tokenPrices, whitelist, selectedToken }: OrderbookDepthChartProps) {
  // Process orders to get orderbook levels for selected token
  const orderbookData = useMemo(() => {
    if (!selectedToken) return null;

    const askLevels: Record<string, PriceLevel> = {}; // Selling the token (asks)
    const bidLevels: Record<string, PriceLevel> = {}; // Buying the token (bids)
    let marketPrice = 0;
    let tokenTicker = '';

    orders.forEach(order => {
      if (order.orderDetailsWithID.status !== 0) return;

      const remainingSellAmount = order.orderDetailsWithID.remainingSellAmount;
      if (remainingSellAmount <= 0n) return;

      const sellTokenAddr = order.orderDetailsWithID.orderDetails.sellToken.toLowerCase();
      const sellTokenInfo = getTokenInfo(sellTokenAddr);
      const sellAmount = Number(remainingSellAmount) / Math.pow(10, sellTokenInfo.decimals);
      const sellTokenMarketPrice = getTokenPrice(sellTokenAddr, tokenPrices);

      if (sellTokenMarketPrice <= 0 || sellAmount <= 0) return;

      const orderId = order.orderDetailsWithID.orderID.toString();
      const buyTokenIndices = order.orderDetailsWithID.orderDetails.buyTokensIndex;
      const buyAmounts = order.orderDetailsWithID.orderDetails.buyAmounts;
      const originalSellAmount = order.orderDetailsWithID.orderDetails.sellAmount;

      buyTokenIndices.forEach((indexBigInt, i) => {
        const buyTokenIndex = Number(indexBigInt);
        const buyTokenAddr = whitelist[buyTokenIndex]?.toLowerCase();
        if (!buyTokenAddr) return;

        const buyTokenInfo = getTokenInfoByIndex(buyTokenIndex);
        const buyTokenMarketPrice = getTokenPrice(buyTokenAddr, tokenPrices);
        if (buyTokenMarketPrice <= 0) return;

        const fullBuyAmount = buyAmounts[i];
        const remainingRatio = Number(remainingSellAmount) / Number(originalSellAmount);
        const proportionalBuyAmount = Number(fullBuyAmount) * remainingRatio / Math.pow(10, buyTokenInfo.decimals);

        if (proportionalBuyAmount <= 0) return;

        const sellValueUSD = sellAmount * sellTokenMarketPrice;
        const askingValueUSD = proportionalBuyAmount * buyTokenMarketPrice;

        // Check if this order involves the selected token
        if (sellTokenAddr === selectedToken) {
          // This is an ASK (selling the selected token)
          const impliedPrice = askingValueUSD / sellAmount;
          marketPrice = sellTokenMarketPrice;
          tokenTicker = sellTokenInfo.ticker;

          // Round price to create levels (4 significant figures)
          const priceKey = impliedPrice.toPrecision(4);

          if (!askLevels[priceKey]) {
            askLevels[priceKey] = {
              price: parseFloat(priceKey),
              totalValueUSD: 0,
              orderCount: 0,
              orders: []
            };
          }
          askLevels[priceKey].totalValueUSD += sellValueUSD;
          askLevels[priceKey].orderCount += 1;
          askLevels[priceKey].orders.push({
            orderId,
            valueUSD: sellValueUSD,
            counterToken: buyTokenInfo.ticker
          });
        }

        if (buyTokenAddr === selectedToken) {
          // This is a BID (wanting to buy the selected token)
          const impliedPrice = sellValueUSD / proportionalBuyAmount;
          marketPrice = buyTokenMarketPrice;
          tokenTicker = buyTokenInfo.ticker;

          const priceKey = impliedPrice.toPrecision(4);

          if (!bidLevels[priceKey]) {
            bidLevels[priceKey] = {
              price: parseFloat(priceKey),
              totalValueUSD: 0,
              orderCount: 0,
              orders: []
            };
          }
          bidLevels[priceKey].totalValueUSD += askingValueUSD;
          bidLevels[priceKey].orderCount += 1;
          bidLevels[priceKey].orders.push({
            orderId,
            valueUSD: askingValueUSD,
            counterToken: sellTokenInfo.ticker
          });
        }
      });
    });

    // Sort asks ascending (lowest first), bids descending (highest first)
    const sortedAsks = Object.values(askLevels).sort((a, b) => a.price - b.price);
    const sortedBids = Object.values(bidLevels).sort((a, b) => b.price - a.price);

    // Find max value for bar scaling
    const maxValue = Math.max(
      ...sortedAsks.map(l => l.totalValueUSD),
      ...sortedBids.map(l => l.totalValueUSD),
      1
    );

    return {
      asks: sortedAsks,
      bids: sortedBids,
      marketPrice,
      tokenTicker,
      maxValue
    };
  }, [orders, tokenPrices, whitelist, selectedToken]);

  if (!orderbookData || (orderbookData.asks.length === 0 && orderbookData.bids.length === 0)) {
    return null;
  }

  const { asks, bids, marketPrice, maxValue } = orderbookData;

  // Calculate spread
  const lowestAsk = asks[0]?.price;
  const highestBid = bids[0]?.price;
  const spread = lowestAsk && highestBid ? ((lowestAsk - highestBid) / marketPrice) * 100 : null;

  // Take top 10 levels from each side
  const displayAsks = asks.slice(0, 10).reverse(); // Reverse so highest ask is at top
  const displayBids = bids.slice(0, 10);

  return (
    <LiquidGlassCard
      className="p-6 bg-black/40"
      shadowIntensity="none"
      glowIntensity="none"
    >
      <div className="mb-4">
        <h4 className="text-lg font-bold text-white">Order Book</h4>
        <p className="text-gray-400 text-xs">Limit order depth by price level</p>
      </div>

      {/* Spread indicator */}
      {spread !== null && (
        <div className="flex justify-center mb-4">
          <div className="bg-white/10 rounded px-3 py-1 text-center">
            <span className="text-gray-400 text-xs">Spread: </span>
            <span className="text-white font-medium text-sm">{spread.toFixed(2)}%</span>
          </div>
        </div>
      )}

      {/* Orderbook table */}
      <div className="font-mono text-xs">
        {/* Header */}
        <div className="grid grid-cols-3 gap-2 mb-2 px-2 text-gray-500">
          <span className="text-left">Price</span>
          <span className="text-right">Value (USD)</span>
          <span className="text-right">Orders</span>
        </div>

        {/* Asks (sells) - red */}
        <div className="space-y-0.5 mb-2">
          {displayAsks.map((level, index) => {
            const barWidth = (level.totalValueUSD / maxValue) * 100;
            const vsMarket = ((level.price - marketPrice) / marketPrice) * 100;

            return (
              <div
                key={`ask-${index}`}
                className="relative grid grid-cols-3 gap-2 px-2 py-1 hover:bg-white/5 cursor-pointer group"
              >
                {/* Background bar */}
                <div
                  className="absolute right-0 top-0 bottom-0 bg-red-500/20"
                  style={{ width: `${barWidth}%` }}
                />
                {/* Content */}
                <span className="relative text-red-400 text-left">
                  {formatPriceSigFig(level.price)}
                  <span className="text-red-400/60 ml-1">+{vsMarket.toFixed(1)}%</span>
                </span>
                <span className="relative text-white text-right">{formatUSD(level.totalValueUSD)}</span>
                <span className="relative text-gray-400 text-right">{level.orderCount}</span>

                {/* Tooltip */}
                <div className="absolute left-full ml-2 top-0 bg-black border border-white/20 rounded px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity z-20 whitespace-nowrap pointer-events-none">
                  {level.orders.slice(0, 3).map((o, i) => (
                    <div key={i} className="text-gray-300">
                      #{o.orderId}: {formatUSD(o.valueUSD)} → {o.counterToken}
                    </div>
                  ))}
                  {level.orders.length > 3 && (
                    <div className="text-gray-500">+{level.orders.length - 3} more</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Market price divider */}
        <div className="flex items-center gap-2 py-2 px-2 bg-white/5 border-y border-white/10">
          <span className="text-[#00D9FF] font-bold">{formatPriceSigFig(marketPrice)}</span>
          <span className="text-gray-500 text-xs">Market Price</span>
          <div className="flex-1 border-t border-dashed border-[#00D9FF]/30" />
        </div>

        {/* Bids (buys) - green */}
        <div className="space-y-0.5 mt-2">
          {displayBids.map((level, index) => {
            const barWidth = (level.totalValueUSD / maxValue) * 100;
            const vsMarket = ((level.price - marketPrice) / marketPrice) * 100;

            return (
              <div
                key={`bid-${index}`}
                className="relative grid grid-cols-3 gap-2 px-2 py-1 hover:bg-white/5 cursor-pointer group"
              >
                {/* Background bar */}
                <div
                  className="absolute right-0 top-0 bottom-0 bg-green-500/20"
                  style={{ width: `${barWidth}%` }}
                />
                {/* Content */}
                <span className="relative text-green-400 text-left">
                  {formatPriceSigFig(level.price)}
                  <span className="text-green-400/60 ml-1">{vsMarket.toFixed(1)}%</span>
                </span>
                <span className="relative text-white text-right">{formatUSD(level.totalValueUSD)}</span>
                <span className="relative text-gray-400 text-right">{level.orderCount}</span>

                {/* Tooltip */}
                <div className="absolute left-full ml-2 top-0 bg-black border border-white/20 rounded px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity z-20 whitespace-nowrap pointer-events-none">
                  {level.orders.slice(0, 3).map((o, i) => (
                    <div key={i} className="text-gray-300">
                      #{o.orderId}: {formatUSD(o.valueUSD)} ← {o.counterToken}
                    </div>
                  ))}
                  {level.orders.length > 3 && (
                    <div className="text-gray-500">+{level.orders.length - 3} more</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Empty state for either side */}
        {displayAsks.length === 0 && (
          <div className="text-center text-gray-500 py-4 border-b border-white/10">
            No asks
          </div>
        )}
        {displayBids.length === 0 && (
          <div className="text-center text-gray-500 py-4">
            No bids
          </div>
        )}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-white/10">
        <div className="text-center">
          <p className="text-red-400 font-bold">{asks.length}</p>
          <p className="text-gray-500 text-xs">Ask Levels</p>
          <p className="text-gray-400 text-xs">{formatUSD(asks.reduce((sum, l) => sum + l.totalValueUSD, 0))}</p>
        </div>
        <div className="text-center">
          <p className="text-green-400 font-bold">{bids.length}</p>
          <p className="text-gray-500 text-xs">Bid Levels</p>
          <p className="text-gray-400 text-xs">{formatUSD(bids.reduce((sum, l) => sum + l.totalValueUSD, 0))}</p>
        </div>
      </div>
    </LiquidGlassCard>
  );
}
