'use client';

import { useMemo, useState } from 'react';
import { ComposedChart, Scatter, XAxis, YAxis, ReferenceLine, ResponsiveContainer, Tooltip, Line, Cell } from 'recharts';
import { LiquidGlassCard } from '@/components/ui/liquid-glass';
import { formatUSD, formatPriceSigFig, getTokenPrice } from '@/utils/format';
import { getTokenInfo, getTokenInfoByIndex } from '@/utils/tokenUtils';
import { CoinLogo } from '@/components/ui/CoinLogo';
import { CompleteOrderDetails } from '@/hooks/contracts/useOpenPositions';

interface TokenOrderPricesChartProps {
  orders: CompleteOrderDetails[];
  tokenPrices: Record<string, { price: number }>;
  whitelist: string[];
}

interface OrderPriceLevel {
  orderId: string;
  impliedPrice: number; // Implied price of the selected token in this order (USD)
  marketPrice: number; // Current market price of selected token (USD)
  positionPercent: number; // % difference from market
  valueUSD: number; // USD value involved
  counterToken: string; // The other token in the trade
  isSelling: boolean; // Is the selected token being sold or bought?
  timestamp: number; // Order creation time
}

interface TokenOrderData {
  address: string;
  ticker: string;
  marketPrice: number;
  orders: OrderPriceLevel[];
  minPrice: number;
  maxPrice: number;
  minTime: number;
  maxTime: number;
}

export default function TokenOrderPricesChart({ orders, tokenPrices, whitelist }: TokenOrderPricesChartProps) {
  const [selectedToken, setSelectedToken] = useState<string | null>(null);

  // Process orders to get price levels for ALL tokens (both sell and buy sides)
  const tokenOrderData = useMemo(() => {
    const tokenMap: Record<string, TokenOrderData> = {};

    const ensureToken = (addr: string, ticker: string, marketPrice: number) => {
      if (!tokenMap[addr]) {
        tokenMap[addr] = {
          address: addr,
          ticker,
          marketPrice,
          orders: [],
          minPrice: marketPrice,
          maxPrice: marketPrice,
          minTime: Infinity,
          maxTime: 0
        };
      }
    };

    const updateTimeRange = (addr: string, timestamp: number) => {
      if (timestamp < tokenMap[addr].minTime) {
        tokenMap[addr].minTime = timestamp;
      }
      if (timestamp > tokenMap[addr].maxTime) {
        tokenMap[addr].maxTime = timestamp;
      }
    };

    orders.forEach(order => {
      // Only active orders
      if (order.orderDetailsWithID.status !== 0) return;

      const remainingSellAmount = order.orderDetailsWithID.remainingSellAmount;
      if (remainingSellAmount <= 0n) return;

      // Get sell token info
      const sellTokenAddr = order.orderDetailsWithID.orderDetails.sellToken.toLowerCase();
      const sellTokenInfo = getTokenInfo(sellTokenAddr);
      const sellAmount = Number(remainingSellAmount) / Math.pow(10, sellTokenInfo.decimals);
      const sellTokenMarketPrice = getTokenPrice(sellTokenAddr, tokenPrices);

      if (sellTokenMarketPrice <= 0 || sellAmount <= 0) return;

      const orderId = order.orderDetailsWithID.orderID.toString();
      const timestamp = Number(order.orderDetailsWithID.lastUpdateTime) * 1000; // Convert to ms

      // Process each buy token option
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

        // Calculate proportional buy amount based on remaining sell amount
        const fullBuyAmount = buyAmounts[i];
        const remainingRatio = Number(remainingSellAmount) / Number(originalSellAmount);
        const proportionalBuyAmount = Number(fullBuyAmount) * remainingRatio / Math.pow(10, buyTokenInfo.decimals);

        if (proportionalBuyAmount <= 0) return;

        // Calculate USD values
        const sellValueUSD = sellAmount * sellTokenMarketPrice;
        const askingValueUSD = proportionalBuyAmount * buyTokenMarketPrice;

        // === Add price point for SELL TOKEN ===
        // The sell token is being sold - implied price = what seller is asking per token
        const impliedSellTokenPrice = askingValueUSD / sellAmount;
        const sellTokenPositionPercent = ((impliedSellTokenPrice - sellTokenMarketPrice) / sellTokenMarketPrice) * 100;

        ensureToken(sellTokenAddr, sellTokenInfo.ticker, sellTokenMarketPrice);

        const sellTokenOrder: OrderPriceLevel = {
          orderId,
          impliedPrice: impliedSellTokenPrice,
          marketPrice: sellTokenMarketPrice,
          positionPercent: sellTokenPositionPercent,
          valueUSD: sellValueUSD,
          counterToken: buyTokenInfo.ticker,
          isSelling: true,
          timestamp
        };

        tokenMap[sellTokenAddr].orders.push(sellTokenOrder);
        updateTimeRange(sellTokenAddr, timestamp);

        if (impliedSellTokenPrice < tokenMap[sellTokenAddr].minPrice) {
          tokenMap[sellTokenAddr].minPrice = impliedSellTokenPrice;
        }
        if (impliedSellTokenPrice > tokenMap[sellTokenAddr].maxPrice) {
          tokenMap[sellTokenAddr].maxPrice = impliedSellTokenPrice;
        }

        // === Add price point for BUY TOKEN ===
        // The buy token is being bought - implied price = what seller values it at
        const impliedBuyTokenPrice = sellValueUSD / proportionalBuyAmount;
        const buyTokenPositionPercent = ((impliedBuyTokenPrice - buyTokenMarketPrice) / buyTokenMarketPrice) * 100;

        ensureToken(buyTokenAddr, buyTokenInfo.ticker, buyTokenMarketPrice);

        const buyTokenOrder: OrderPriceLevel = {
          orderId,
          impliedPrice: impliedBuyTokenPrice,
          marketPrice: buyTokenMarketPrice,
          positionPercent: buyTokenPositionPercent,
          valueUSD: askingValueUSD,
          counterToken: sellTokenInfo.ticker,
          isSelling: false,
          timestamp
        };

        tokenMap[buyTokenAddr].orders.push(buyTokenOrder);
        updateTimeRange(buyTokenAddr, timestamp);

        if (impliedBuyTokenPrice < tokenMap[buyTokenAddr].minPrice) {
          tokenMap[buyTokenAddr].minPrice = impliedBuyTokenPrice;
        }
        if (impliedBuyTokenPrice > tokenMap[buyTokenAddr].maxPrice) {
          tokenMap[buyTokenAddr].maxPrice = impliedBuyTokenPrice;
        }
      });
    });

    // Sort tokens by number of price points
    return Object.values(tokenMap)
      .filter(t => t.orders.length > 0)
      .sort((a, b) => b.orders.length - a.orders.length);
  }, [orders, tokenPrices, whitelist]);

  // Get selected token data or first token
  const displayToken = useMemo(() => {
    if (selectedToken) {
      return tokenOrderData.find(t => t.address === selectedToken) || tokenOrderData[0];
    }
    return tokenOrderData[0];
  }, [selectedToken, tokenOrderData]);

  if (tokenOrderData.length === 0 || !displayToken) {
    return null;
  }

  // Sort orders by implied price for display (highest first)
  const sortedOrders = [...displayToken.orders].sort((a, b) => b.impliedPrice - a.impliedPrice);

  // Prepare scatter data with x (time) and y (price)
  const scatterData = displayToken.orders.map(order => ({
    x: order.timestamp,
    y: order.impliedPrice,
    ...order
  }));

  // Calculate Y axis range (add 15% padding)
  const priceRange = displayToken.maxPrice - displayToken.minPrice;
  const yPadding = Math.max(priceRange * 0.15, displayToken.marketPrice * 0.1);
  const yMin = Math.max(0, displayToken.minPrice - yPadding);
  const yMax = displayToken.maxPrice + yPadding;

  // Calculate X axis range (time)
  const xMin = displayToken.minTime;
  const xMax = displayToken.maxTime;
  const xPadding = Math.max((xMax - xMin) * 0.05, 86400000); // At least 1 day padding
  const xDomainMin = xMin - xPadding;
  const xDomainMax = xMax + xPadding;

  // Stats
  const ordersAboveMarket = sortedOrders.filter(o => o.positionPercent > 5).length;
  const ordersBelowMarket = sortedOrders.filter(o => o.positionPercent < -5).length;
  const ordersNearMarket = sortedOrders.filter(o => Math.abs(o.positionPercent) <= 5).length;

  // Calculate dollar-weighted average prices (separate for sell and buy sides)
  const sellOrders = sortedOrders.filter(o => o.isSelling);
  const buyOrders = sortedOrders.filter(o => !o.isSelling);

  // Sell-side weighted average: Σ(implied_price × valueUSD) / Σ(valueUSD)
  const sellWeightedAvg = sellOrders.length > 0
    ? sellOrders.reduce((sum, o) => sum + o.impliedPrice * o.valueUSD, 0) / sellOrders.reduce((sum, o) => sum + o.valueUSD, 0)
    : null;

  // Buy-side weighted average
  const buyWeightedAvg = buyOrders.length > 0
    ? buyOrders.reduce((sum, o) => sum + o.impliedPrice * o.valueUSD, 0) / buyOrders.reduce((sum, o) => sum + o.valueUSD, 0)
    : null;

  // Combined weighted average (all orders)
  const totalWeightedAvg = sortedOrders.length > 0
    ? sortedOrders.reduce((sum, o) => sum + o.impliedPrice * o.valueUSD, 0) / sortedOrders.reduce((sum, o) => sum + o.valueUSD, 0)
    : null;

  // Calculate % difference from market for weighted averages
  const sellAvgVsMarket = sellWeightedAvg ? ((sellWeightedAvg - displayToken.marketPrice) / displayToken.marketPrice) * 100 : null;
  const buyAvgVsMarket = buyWeightedAvg ? ((buyWeightedAvg - displayToken.marketPrice) / displayToken.marketPrice) * 100 : null;
  const totalAvgVsMarket = totalWeightedAvg ? ((totalWeightedAvg - displayToken.marketPrice) / displayToken.marketPrice) * 100 : null;

  // Format time for X axis
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <LiquidGlassCard
      className="p-6 bg-black/40"
      shadowIntensity="none"
      glowIntensity="none"
    >
      <div className="mb-6">
        <h3 className="text-2xl font-bold text-white mb-2">Limit Order Price Levels</h3>
        <p className="text-gray-400 text-sm">Implied prices for tokens in active orders</p>
      </div>

      {/* Token selector */}
      <div className="flex flex-wrap gap-2 mb-6">
        {tokenOrderData.slice(0, 10).map(token => (
          <button
            key={token.address}
            onClick={() => setSelectedToken(token.address)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-colors ${
              displayToken.address === token.address
                ? 'bg-white text-black border-white'
                : 'bg-white/5 text-white border-white/20 hover:bg-white/10'
            }`}
          >
            <CoinLogo symbol={token.ticker} size="sm" />
            <span className="text-sm font-medium">{token.ticker}</span>
            <span className="text-xs opacity-60">({token.orders.length})</span>
          </button>
        ))}
      </div>

      {/* Current token info */}
      <div className="flex flex-wrap items-center gap-4 mb-6 p-4 bg-white/5 rounded-lg">
        <CoinLogo symbol={displayToken.ticker} size="lg" />
        <div>
          <p className="text-white font-bold text-lg">{displayToken.ticker}</p>
          <p className="text-gray-400 text-sm">
            Market: <span className="font-medium" style={{ color: '#00D9FF' }}>{formatPriceSigFig(displayToken.marketPrice)}</span>
          </p>
        </div>

        {/* Weighted Average Prices */}
        <div className="flex gap-4 ml-auto">
          {sellWeightedAvg && (
            <div className="text-center px-3 py-1 bg-white/5 rounded">
              <p className="text-gray-400 text-xs">Avg Ask</p>
              <p className="text-white font-medium text-sm">{formatPriceSigFig(sellWeightedAvg)}</p>
              <p className="text-xs" style={{ color: sellAvgVsMarket && sellAvgVsMarket > 0 ? '#4ADE80' : '#FF6B6B' }}>
                {sellAvgVsMarket ? `${sellAvgVsMarket > 0 ? '+' : ''}${sellAvgVsMarket.toFixed(1)}%` : ''}
              </p>
            </div>
          )}
          {buyWeightedAvg && (
            <div className="text-center px-3 py-1 bg-white/5 rounded">
              <p className="text-gray-400 text-xs">Avg Bid</p>
              <p className="text-white font-medium text-sm">{formatPriceSigFig(buyWeightedAvg)}</p>
              <p className="text-xs" style={{ color: buyAvgVsMarket && buyAvgVsMarket > 0 ? '#4ADE80' : '#FF6B6B' }}>
                {buyAvgVsMarket ? `${buyAvgVsMarket > 0 ? '+' : ''}${buyAvgVsMarket.toFixed(1)}%` : ''}
              </p>
            </div>
          )}
          {totalWeightedAvg && (
            <div className="text-center px-3 py-1 bg-white/10 rounded border border-white/20">
              <p className="text-gray-400 text-xs">Weighted Avg</p>
              <p className="text-white font-bold text-sm">{formatPriceSigFig(totalWeightedAvg)}</p>
              <p className="text-xs" style={{ color: totalAvgVsMarket && totalAvgVsMarket > 0 ? '#4ADE80' : '#FF6B6B' }}>
                {totalAvgVsMarket ? `${totalAvgVsMarket > 0 ? '+' : ''}${totalAvgVsMarket.toFixed(1)}%` : ''}
              </p>
            </div>
          )}
        </div>

        <div className="text-right">
          <p className="text-white font-bold">{sortedOrders.length}</p>
          <p className="text-gray-400 text-sm">Price Points</p>
        </div>
      </div>

      {/* Chart with dots and horizontal lines */}
      <div className="mb-6">
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart margin={{ top: 20, right: 30, bottom: 20, left: 20 }}>
            <XAxis
              type="number"
              dataKey="x"
              domain={[xDomainMin, xDomainMax]}
              tickFormatter={formatTime}
              stroke="#FFFFFF"
              tick={{ fill: '#FFFFFF', fontSize: 12 }}
              tickLine={{ stroke: '#FFFFFF' }}
              axisLine={{ stroke: '#FFFFFF40' }}
            />
            <YAxis
              type="number"
              dataKey="y"
              domain={[yMin, yMax]}
              tickFormatter={(value) => formatPriceSigFig(value)}
              stroke="#FFFFFF"
              tick={{ fill: '#FFFFFF', fontSize: 12 }}
              tickLine={{ stroke: '#FFFFFF' }}
              axisLine={{ stroke: '#FFFFFF40' }}
              width={70}
            />
            <ReferenceLine
              y={displayToken.marketPrice}
              stroke="#00D9FF"
              strokeWidth={2}
              strokeDasharray="5 5"
              label={{
                value: 'Market',
                position: 'right',
                fill: '#00D9FF',
                fontSize: 12
              }}
            />
            {/* Weighted average line */}
            {totalWeightedAvg && (
              <ReferenceLine
                y={totalWeightedAvg}
                stroke="#FFD700"
                strokeWidth={2}
                strokeDasharray="3 3"
                label={{
                  value: 'Avg',
                  position: 'right',
                  fill: '#FFD700',
                  fontSize: 10
                }}
              />
            )}
            {/* Horizontal lines for each price point */}
            {scatterData.map((entry, index) => {
              const color = entry.positionPercent > 0 ? '#4ADE80' : '#FF6B6B';
              return (
                <ReferenceLine
                  key={`line-${index}`}
                  y={entry.y}
                  stroke={color}
                  strokeWidth={1}
                  strokeOpacity={0.5}
                />
              );
            })}
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload || !payload[0]) return null;
                const data = payload[0].payload as OrderPriceLevel & { x: number; y: number };
                const color = data.positionPercent > 0 ? '#4ADE80' : '#FF6B6B';

                return (
                  <div style={{
                    backgroundColor: '#1a1a1a',
                    border: '2px solid #FFFFFF',
                    borderRadius: '8px',
                    padding: '12px',
                    color: '#fff',
                  }}>
                    <p style={{ fontWeight: 'bold', marginBottom: '8px' }}>Order #{data.orderId}</p>
                    <p style={{ margin: '4px 0', fontSize: '14px' }}>
                      <span style={{ color: '#999' }}>Price:</span>{' '}
                      <span style={{ fontWeight: 'bold' }}>{formatPriceSigFig(data.impliedPrice)}</span>
                    </p>
                    <p style={{ margin: '4px 0', fontSize: '14px' }}>
                      <span style={{ color: '#999' }}>vs Market:</span>{' '}
                      <span style={{ fontWeight: 'bold', color }}>{data.positionPercent > 0 ? '+' : ''}{data.positionPercent.toFixed(1)}%</span>
                    </p>
                    <p style={{ margin: '4px 0', fontSize: '14px' }}>
                      <span style={{ color: '#999' }}>Value:</span>{' '}
                      <span style={{ fontWeight: 'bold' }}>{formatUSD(data.valueUSD)}</span>
                    </p>
                    <p style={{ margin: '4px 0', fontSize: '14px' }}>
                      <span style={{ color: '#999' }}>{data.isSelling ? 'Selling for' : 'Buying with'}:</span>{' '}
                      <span style={{ fontWeight: 'bold' }}>{data.counterToken}</span>
                    </p>
                    <p style={{ margin: '4px 0', fontSize: '12px', color: '#666' }}>
                      {formatTime(data.timestamp)}
                    </p>
                  </div>
                );
              }}
              cursor={{ strokeDasharray: '3 3' }}
            />
            <Scatter
              data={scatterData}
              fill="#FFFFFF"
              cursor="pointer"
            >
              {scatterData.map((entry, index) => {
                // Above market = green (good deal for sellers), Below market = red (bad deal)
                const color = entry.positionPercent > 0 ? '#4ADE80' : '#FF6B6B';
                return <Cell key={`cell-${index}`} fill={color} />;
              })}
            </Scatter>
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap justify-center gap-4 mb-6">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-[#4ADE80]" />
          <span className="text-gray-400 text-sm">Above Market</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-[#FF6B6B]" />
          <span className="text-gray-400 text-sm">Below Market</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-0.5" style={{ backgroundColor: '#00D9FF' }} />
          <span className="text-gray-400 text-sm">Market Price</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-0.5" style={{ backgroundColor: '#FFD700', borderStyle: 'dashed' }} />
          <span className="text-gray-400 text-sm">$-Weighted Avg</span>
        </div>
      </div>

      {/* Stats summary */}
      <div className="grid grid-cols-3 gap-4 pt-4 border-t border-white/10">
        <div className="text-center">
          <p className="text-2xl font-bold text-[#4ADE80]">{ordersAboveMarket}</p>
          <p className="text-gray-400 text-sm">Above Market</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-white">{ordersNearMarket}</p>
          <p className="text-gray-400 text-sm">Near Market</p>
          <p className="text-gray-500 text-xs">(±5%)</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-[#FF6B6B]">{ordersBelowMarket}</p>
          <p className="text-gray-400 text-sm">Below Market</p>
        </div>
      </div>

      {/* Order list */}
      <div className="mt-6 pt-4 border-t border-white/10">
        <h4 className="text-white font-medium mb-3">Order Details</h4>
        <div className="space-y-2 max-h-[300px] overflow-y-auto">
          {sortedOrders.map((order, index) => {
            // Above market = green, Below market = red
            const color = order.positionPercent > 0 ? '#4ADE80' : '#FF6B6B';
            return (
              <div
                key={`${order.orderId}-${order.counterToken}-${index}`}
                className="flex items-center justify-between p-2 bg-white/5 rounded text-sm"
              >
                <div className="flex items-center gap-3">
                  <span className="text-gray-400">#{order.orderId}</span>
                  <span className="text-white">
                    {order.isSelling
                      ? `${displayToken.ticker} → ${order.counterToken}`
                      : `${order.counterToken} → ${displayToken.ticker}`
                    }
                  </span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${order.isSelling ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
                    {order.isSelling ? 'SELL' : 'BUY'}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-gray-400">{formatUSD(order.valueUSD)}</span>
                  <span className="text-white font-medium">{formatPriceSigFig(order.impliedPrice)}</span>
                  <span
                    className="font-medium min-w-[60px] text-right"
                    style={{ color }}
                  >
                    {order.positionPercent > 0 ? '+' : ''}{order.positionPercent.toFixed(1)}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </LiquidGlassCard>
  );
}
