'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useAccount } from 'wagmi';
import { LiquidGlassCard } from '@/components/ui/liquid-glass';
import { formatUSD, formatPriceSigFig, getTokenPrice } from '@/utils/format';
import { getTokenInfo, getTokenInfoByIndex } from '@/utils/tokenUtils';
import { CoinLogo } from '@/components/ui/CoinLogo';
import { CompleteOrderDetails } from '@/hooks/contracts/useOpenPositions';

interface OrderbookChartProps {
  orders: CompleteOrderDetails[];
  tokenPrices: Record<string, { price: number }>;
  whitelist: string[];
}

interface OrderEntry {
  orderId: string;
  valueUSD: number;
  counterToken: string;
  sellToken: string;
  buyToken: string;
  owner: string;
  uniqueKey: string; // orderId + action + counterToken for deduplication
  isSelling: boolean; // true if selling the selected token, false if buying
}

interface PriceLevel {
  price: number;
  totalValueUSD: number;
  orderCount: number;
  orders: OrderEntry[];
}

interface TokenData {
  address: string;
  ticker: string;
  marketPrice: number;
  orderCount: number;
}

export default function OrderbookChart({ orders, tokenPrices, whitelist }: OrderbookChartProps) {
  const { address: connectedAddress } = useAccount();
  const [selectedToken, setSelectedToken] = useState<string | null>(null);

  // Get list of tokens with orders
  const tokenList = useMemo(() => {
    const tokenMap: Record<string, TokenData> = {};

    orders.forEach(order => {
      if (order.orderDetailsWithID.status !== 0) return;
      const remainingSellAmount = order.orderDetailsWithID.remainingSellAmount;
      if (remainingSellAmount <= 0n) return;

      const sellTokenAddr = order.orderDetailsWithID.orderDetails.sellToken.toLowerCase();
      const sellTokenInfo = getTokenInfo(sellTokenAddr);
      const sellTokenMarketPrice = getTokenPrice(sellTokenAddr, tokenPrices);

      if (sellTokenMarketPrice > 0) {
        if (!tokenMap[sellTokenAddr]) {
          tokenMap[sellTokenAddr] = {
            address: sellTokenAddr,
            ticker: sellTokenInfo.ticker,
            marketPrice: sellTokenMarketPrice,
            orderCount: 0
          };
        }
        tokenMap[sellTokenAddr].orderCount += 1;
      }

      // Also count buy tokens
      const buyTokenIndices = order.orderDetailsWithID.orderDetails.buyTokensIndex;
      buyTokenIndices.forEach((indexBigInt) => {
        const buyTokenIndex = Number(indexBigInt);
        const buyTokenAddr = whitelist[buyTokenIndex]?.toLowerCase();
        if (!buyTokenAddr) return;

        const buyTokenInfo = getTokenInfoByIndex(buyTokenIndex);
        const buyTokenMarketPrice = getTokenPrice(buyTokenAddr, tokenPrices);

        if (buyTokenMarketPrice > 0) {
          if (!tokenMap[buyTokenAddr]) {
            tokenMap[buyTokenAddr] = {
              address: buyTokenAddr,
              ticker: buyTokenInfo.ticker,
              marketPrice: buyTokenMarketPrice,
              orderCount: 0
            };
          }
          tokenMap[buyTokenAddr].orderCount += 1;
        }
      });
    });

    return Object.values(tokenMap).sort((a, b) => b.orderCount - a.orderCount);
  }, [orders, tokenPrices, whitelist]);

  // Set default selected token
  const effectiveSelectedToken = selectedToken || tokenList[0]?.address || null;

  // Process orders to get orderbook levels for selected token
  const orderbookData = useMemo(() => {
    if (!effectiveSelectedToken) return null;

    const askLevels: Record<string, PriceLevel> = {};
    const bidLevels: Record<string, PriceLevel> = {};
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

        // Check if this order involves the selected token (either selling or buying it)
        const isSellingSelectedToken = sellTokenAddr === effectiveSelectedToken;
        const isBuyingSelectedToken = buyTokenAddr === effectiveSelectedToken;

        if (isSellingSelectedToken || isBuyingSelectedToken) {
          // Calculate implied price of the selected token
          let impliedPrice: number;
          let valueUSD: number;
          let uniqueKey: string;
          let counterToken: string;

          if (isSellingSelectedToken) {
            // Order is selling the selected token - implied price = what they want / what they're selling
            impliedPrice = askingValueUSD / sellAmount;
            marketPrice = sellTokenMarketPrice;
            tokenTicker = sellTokenInfo.ticker;
            valueUSD = sellValueUSD;
            uniqueKey = `${orderId}-sell-${buyTokenInfo.ticker}`;
            counterToken = buyTokenInfo.ticker;
          } else {
            // Order is buying the selected token - implied price = what they're offering / what they want
            impliedPrice = sellValueUSD / proportionalBuyAmount;
            marketPrice = buyTokenMarketPrice;
            tokenTicker = buyTokenInfo.ticker;
            valueUSD = askingValueUSD;
            uniqueKey = `${orderId}-buy-${sellTokenInfo.ticker}`;
            counterToken = sellTokenInfo.ticker;
          }

          const priceKey = impliedPrice.toPrecision(4);

          // Place order based on price relative to market (above = asks, below = bids)
          // Regardless of whether it's a sell or buy order
          const targetLevels = impliedPrice >= marketPrice ? askLevels : bidLevels;

          if (!targetLevels[priceKey]) {
            targetLevels[priceKey] = {
              price: parseFloat(priceKey),
              totalValueUSD: 0,
              orderCount: 0,
              orders: []
            };
          }

          // Check if this order combo already exists
          const existingOrder = targetLevels[priceKey].orders.find(o => o.uniqueKey === uniqueKey);
          if (!existingOrder) {
            targetLevels[priceKey].totalValueUSD += valueUSD;
            targetLevels[priceKey].orderCount += 1;
            targetLevels[priceKey].orders.push({
              orderId,
              valueUSD,
              counterToken,
              sellToken: sellTokenInfo.ticker,
              buyToken: buyTokenInfo.ticker,
              owner: orderOwner,
              uniqueKey,
              isSelling: isSellingSelectedToken // Track if this order is selling the selected token
            });
          }
        }
      });
    });

    const sortedAsks = Object.values(askLevels).sort((a, b) => a.price - b.price);
    const sortedBids = Object.values(bidLevels).sort((a, b) => b.price - a.price);

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
  }, [orders, tokenPrices, whitelist, effectiveSelectedToken]);

  if (tokenList.length === 0 || !orderbookData) {
    return null;
  }

  const { asks, bids, marketPrice, maxValue } = orderbookData;

  // Calculate spread
  const lowestAsk = asks[0]?.price;
  const highestBid = bids[0]?.price;
  const spread = lowestAsk && highestBid ? ((lowestAsk - highestBid) / marketPrice) * 100 : null;

  // Calculate weighted averages
  const totalAskValue = asks.reduce((sum, l) => sum + l.totalValueUSD, 0);
  const totalBidValue = bids.reduce((sum, l) => sum + l.totalValueUSD, 0);

  const weightedAvgAsk = totalAskValue > 0
    ? asks.reduce((sum, l) => sum + l.price * l.totalValueUSD, 0) / totalAskValue
    : null;

  const weightedAvgBid = totalBidValue > 0
    ? bids.reduce((sum, l) => sum + l.price * l.totalValueUSD, 0) / totalBidValue
    : null;

  const totalValue = totalAskValue + totalBidValue;
  const weightedAvgAll = totalValue > 0
    ? (asks.reduce((sum, l) => sum + l.price * l.totalValueUSD, 0) + bids.reduce((sum, l) => sum + l.price * l.totalValueUSD, 0)) / totalValue
    : null;

  const displayAsks = asks.slice(0, 10).reverse();
  const displayBids = bids.slice(0, 10);

  const selectedTokenData = tokenList.find(t => t.address === effectiveSelectedToken);

  return (
    <LiquidGlassCard
      className="p-6 bg-black/40"
      shadowIntensity="none"
      glowIntensity="none"
    >
      <div className="mb-6">
        <h3 className="text-2xl font-bold text-white mb-2">Order Book</h3>
        <p className="text-gray-400 text-sm">Limit order depth by price level</p>
      </div>

      {/* Token selector */}
      <div className="flex flex-wrap gap-2 mb-6">
        {tokenList.slice(0, 10).map(token => (
          <button
            key={token.address}
            onClick={() => setSelectedToken(token.address)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-colors ${
              effectiveSelectedToken === token.address
                ? 'bg-white text-black border-white'
                : 'bg-white/5 text-white border-white/20 hover:bg-white/10'
            }`}
          >
            <CoinLogo symbol={token.ticker} size="sm" />
            <span className="text-sm font-medium">{token.ticker}</span>
            <span className="text-xs opacity-60">({token.orderCount})</span>
          </button>
        ))}
      </div>

      {/* Current token info */}
      {selectedTokenData && (
        <div className="flex flex-wrap items-center gap-4 mb-6 p-4 bg-white/5 rounded-lg">
          <CoinLogo symbol={selectedTokenData.ticker} size="lg" />
          <div>
            <p className="text-white font-bold text-lg">{selectedTokenData.ticker}</p>
            <p className="text-gray-400 text-sm">
              Market: <span className="font-medium" style={{ color: '#00D9FF' }}>{formatPriceSigFig(selectedTokenData.marketPrice)}</span>
            </p>
          </div>

          {/* Spread */}
          {spread !== null && (
            <div className="ml-auto bg-white/10 rounded px-3 py-1 text-center">
              <span className="text-gray-400 text-xs">Spread: </span>
              <span className="text-white font-medium text-sm">{spread.toFixed(2)}%</span>
            </div>
          )}
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

        {/* Orders above market price */}
        <div className="space-y-0.5 mb-2">
          {displayAsks.flatMap((level) =>
            level.orders.map((order, orderIndex) => {
              const barWidth = (order.valueUSD / maxValue) * 100;
              const vsMarket = ((level.price - marketPrice) / marketPrice) * 100;
              const isOwnOrder = connectedAddress && order.owner === connectedAddress.toLowerCase();
              const href = isOwnOrder
                ? `/my-orders?orderId=${order.orderId}`
                : `/marketplace?order-id=${order.orderId}`;
              const actionLabel = order.isSelling ? 'Buy' : 'Sell';

              return (
                <Link
                  key={`ask-${order.uniqueKey}`}
                  href={href}
                  className="relative grid grid-cols-12 gap-2 px-2 py-1.5 hover:bg-white/5 cursor-pointer"
                >
                  <div
                    className={`absolute left-0 top-0 bottom-0 ${order.isSelling ? 'bg-pink-500/20' : 'bg-green-500/20'}`}
                    style={{ width: `${barWidth}%` }}
                  />
                  <span className={`relative col-span-3 ${order.isSelling ? 'text-pink-400' : 'text-green-400'}`}>
                    {formatPriceSigFig(level.price)}
                    <span className={`ml-1 ${order.isSelling ? 'text-pink-400/60' : 'text-green-400/60'}`}>({vsMarket > 0 ? '+' : ''}{vsMarket.toFixed(1)}%)</span>
                  </span>
                  <span className="relative col-span-4 text-gray-400">
                    {order.isSelling ? `${order.sellToken} → ${order.buyToken}` : `${order.buyToken} → ${order.sellToken}`}
                    <span className={`ml-2 text-xs ${isOwnOrder ? 'text-gray-500' : 'text-white'}`}>{isOwnOrder ? 'Manage' : actionLabel}</span>
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

        {/* Orders below market price */}
        <div className="space-y-0.5 mt-2">
          {displayBids.flatMap((level) =>
            level.orders.map((order, orderIndex) => {
              const barWidth = (order.valueUSD / maxValue) * 100;
              const vsMarket = ((level.price - marketPrice) / marketPrice) * 100;
              const isOwnOrder = connectedAddress && order.owner === connectedAddress.toLowerCase();
              const href = isOwnOrder
                ? `/my-orders?orderId=${order.orderId}`
                : `/marketplace?order-id=${order.orderId}`;
              const actionLabel = order.isSelling ? 'Buy' : 'Sell';

              return (
                <Link
                  key={`bid-${order.uniqueKey}`}
                  href={href}
                  className="relative grid grid-cols-12 gap-2 px-2 py-1.5 hover:bg-white/5 cursor-pointer"
                >
                  <div
                    className={`absolute left-0 top-0 bottom-0 ${order.isSelling ? 'bg-pink-500/20' : 'bg-green-500/20'}`}
                    style={{ width: `${barWidth}%` }}
                  />
                  <span className={`relative col-span-3 ${order.isSelling ? 'text-pink-400' : 'text-green-400'}`}>
                    {formatPriceSigFig(level.price)}
                    <span className={`ml-1 ${order.isSelling ? 'text-pink-400/60' : 'text-green-400/60'}`}>({vsMarket > 0 ? '+' : ''}{vsMarket.toFixed(1)}%)</span>
                  </span>
                  <span className="relative col-span-4 text-gray-400">
                    {order.isSelling ? `${order.sellToken} → ${order.buyToken}` : `${order.buyToken} → ${order.sellToken}`}
                    <span className={`ml-2 text-xs ${isOwnOrder ? 'text-gray-500' : 'text-white'}`}>{isOwnOrder ? 'Manage' : actionLabel}</span>
                  </span>
                  <span className="relative col-span-4 text-white text-right">{formatUSD(order.valueUSD)}</span>
                  <span className="relative col-span-1 text-gray-400 text-right">{order.orderId}</span>
                </Link>
              );
            })
          )}
        </div>

        {/* Empty states */}
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
