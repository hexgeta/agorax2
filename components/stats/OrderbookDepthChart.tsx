'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useAccount } from 'wagmi';
import { LiquidGlassCard } from '@/components/ui/liquid-glass';
import { formatUSD, formatPriceSigFig, getTokenPrice } from '@/utils/format';
import { getTokenInfo, getTokenInfoByIndex, formatTokenTicker } from '@/utils/tokenUtils';
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
    sellToken: string;
    buyToken: string;
    owner: string;
  }[];
}

export default function OrderbookDepthChart({ orders, tokenPrices, whitelist, selectedToken }: OrderbookDepthChartProps) {
  const { address: connectedAddress } = useAccount();

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

        const orderOwner = order.userDetails.orderOwner?.toLowerCase() || '';

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
            counterToken: buyTokenInfo.ticker,
            sellToken: sellTokenInfo.ticker,
            buyToken: buyTokenInfo.ticker,
            owner: orderOwner
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
            counterToken: sellTokenInfo.ticker,
            sellToken: sellTokenInfo.ticker,
            buyToken: buyTokenInfo.ticker,
            owner: orderOwner
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

  // Calculate weighted average prices
  const totalAskValue = asks.reduce((sum, l) => sum + l.totalValueUSD, 0);
  const totalBidValue = bids.reduce((sum, l) => sum + l.totalValueUSD, 0);

  // Weighted average ask price: Σ(price × valueUSD) / Σ(valueUSD)
  const weightedAvgAsk = totalAskValue > 0
    ? asks.reduce((sum, l) => sum + l.price * l.totalValueUSD, 0) / totalAskValue
    : null;

  // Weighted average bid price
  const weightedAvgBid = totalBidValue > 0
    ? bids.reduce((sum, l) => sum + l.price * l.totalValueUSD, 0) / totalBidValue
    : null;

  // Combined weighted average (all orders)
  const totalValue = totalAskValue + totalBidValue;
  const weightedAvgAll = totalValue > 0
    ? (asks.reduce((sum, l) => sum + l.price * l.totalValueUSD, 0) + bids.reduce((sum, l) => sum + l.price * l.totalValueUSD, 0)) / totalValue
    : null;

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
        <div className="grid grid-cols-12 gap-2 mb-2 px-2 text-gray-500">
          <span className="col-span-3 text-left">Price</span>
          <span className="col-span-4 text-left">Pair</span>
          <span className="col-span-4 text-right">Value</span>
          <span className="col-span-1 text-right">#</span>
        </div>

        {/* Asks (sells) - red */}
        <div className="space-y-0.5 mb-2">
          {displayAsks.flatMap((level) =>
            level.orders.map((order, orderIndex) => {
              const barWidth = (order.valueUSD / maxValue) * 100;
              const vsMarket = ((level.price - marketPrice) / marketPrice) * 100;
              const isOwnOrder = connectedAddress && order.owner === connectedAddress.toLowerCase();
              const href = isOwnOrder
                ? `/my-orders?orderId=${order.orderId}`
                : `/marketplace?order-id=${order.orderId}`;

              return (
                <Link
                  key={`ask-${order.orderId}-${orderIndex}`}
                  href={href}
                  className="relative grid grid-cols-12 gap-2 px-2 py-1.5 hover:bg-white/5 cursor-pointer"
                >
                  {/* Background bar */}
                  <div
                    className="absolute right-0 top-0 bottom-0 bg-pink-500/20"
                    style={{ width: `${barWidth}%` }}
                  />
                  {/* Content */}
                  <span className="relative col-span-3 text-pink-400">
                    {formatPriceSigFig(level.price)}
                    <span className="text-pink-400/60 ml-1">(+{vsMarket.toFixed(1)}%)</span>
                  </span>
                  <span className="relative col-span-4 text-gray-400">
                    {formatTokenTicker(order.sellToken)} → {formatTokenTicker(order.buyToken)}
                    <span className="text-gray-500 ml-2 text-xs">{isOwnOrder ? 'Manage' : 'Buy'}</span>
                  </span>
                  <span className="relative col-span-4 text-white text-right">{formatUSD(order.valueUSD)}</span>
                  <span className="relative col-span-1 text-gray-400 text-right">{order.orderId}</span>
                </Link>
              );
            })
          )}
        </div>

        {/* Market price divider */}
        <div className="flex items-center gap-2 py-2 px-2 bg-white/5 border-y border-white/10">
          <span className="text-[#00D9FF] font-bold">{formatPriceSigFig(marketPrice)}</span>
          <span className="text-gray-500 text-xs">Market Price</span>
          <div className="flex-1 border-t border-dashed border-[#00D9FF]/30" />
        </div>

        {/* Bids (buys) - green */}
        <div className="space-y-0.5 mt-2">
          {displayBids.flatMap((level) =>
            level.orders.map((order, orderIndex) => {
              const barWidth = (order.valueUSD / maxValue) * 100;
              const vsMarket = ((level.price - marketPrice) / marketPrice) * 100;
              const isOwnOrder = connectedAddress && order.owner === connectedAddress.toLowerCase();
              const href = isOwnOrder
                ? `/my-orders?orderId=${order.orderId}`
                : `/marketplace?order-id=${order.orderId}`;

              return (
                <Link
                  key={`bid-${order.orderId}-${orderIndex}`}
                  href={href}
                  className="relative grid grid-cols-12 gap-2 px-2 py-1.5 hover:bg-white/5 cursor-pointer"
                >
                  {/* Background bar */}
                  <div
                    className="absolute right-0 top-0 bottom-0 bg-green-500/20"
                    style={{ width: `${barWidth}%` }}
                  />
                  {/* Content */}
                  <span className="relative col-span-3 text-green-400">
                    {formatPriceSigFig(level.price)}
                    <span className="text-green-400/60 ml-1">({vsMarket.toFixed(1)}%)</span>
                  </span>
                  <span className="relative col-span-4 text-gray-400">
                    {formatTokenTicker(order.sellToken)} → {formatTokenTicker(order.buyToken)}
                    <span className="text-gray-500 ml-2 text-xs">{isOwnOrder ? 'Manage' : 'Sell'}</span>
                  </span>
                  <span className="relative col-span-4 text-white text-right">{formatUSD(order.valueUSD)}</span>
                  <span className="relative col-span-1 text-gray-400 text-right">{order.orderId}</span>
                </Link>
              );
            })
          )}
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
      <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-white/10">
        <div className="text-center">
          <p className="text-pink-400 font-bold">{asks.length}</p>
          <p className="text-gray-500 text-xs">Ask Levels</p>
          <p className="text-gray-400 text-xs">{formatUSD(totalAskValue)}</p>
          {weightedAvgAsk && (
            <p className="text-pink-400 text-sm font-medium mt-1">
              Avg: {formatPriceSigFig(weightedAvgAsk)}
            </p>
          )}
        </div>
        <div className="text-center">
          {weightedAvgAll ? (
            <>
              <p className="text-white font-bold">{formatPriceSigFig(weightedAvgAll)}</p>
              <p className="text-gray-500 text-xs">Weighted Avg</p>
              <p className="text-gray-400 text-xs">
                {((weightedAvgAll - marketPrice) / marketPrice * 100) > 0 ? '+' : ''}
                {((weightedAvgAll - marketPrice) / marketPrice * 100).toFixed(1)}% vs Market
              </p>
            </>
          ) : (
            <>
              <p className="text-gray-500 font-bold">-</p>
              <p className="text-gray-500 text-xs">Weighted Avg</p>
            </>
          )}
        </div>
        <div className="text-center">
          <p className="text-green-400 font-bold">{bids.length}</p>
          <p className="text-gray-500 text-xs">Bid Levels</p>
          <p className="text-gray-400 text-xs">{formatUSD(totalBidValue)}</p>
          {weightedAvgBid && (
            <p className="text-green-400 text-sm font-medium mt-1">
              Avg: {formatPriceSigFig(weightedAvgBid)}
            </p>
          )}
        </div>
      </div>
    </LiquidGlassCard>
  );
}
