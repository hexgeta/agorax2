'use client';

import { useMemo, useState } from 'react';
import { ComposedChart, Scatter, XAxis, YAxis, ReferenceLine, ResponsiveContainer, Tooltip, Cell, CartesianGrid } from 'recharts';
import { formatUSD, formatPriceSigFig, getTokenPrice } from '@/utils/format';
import { getTokenInfo, getTokenInfoByIndex } from '@/utils/tokenUtils';
import { CompleteOrderDetails } from '@/hooks/contracts/useOpenPositions';

interface TokenOrderPricesChartProps {
  orders: CompleteOrderDetails[];
  tokenPrices: Record<string, { price: number }>;
  whitelist: string[];
  selectedToken?: string | null;
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
  owner: string; // Order owner address
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

export default function TokenOrderPricesChart({ orders, tokenPrices, whitelist, selectedToken }: TokenOrderPricesChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

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
          timestamp,
          owner: order.userDetails.orderOwner?.toLowerCase() || ''
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
          timestamp,
          owner: order.userDetails.orderOwner?.toLowerCase() || ''
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

  // Combined weighted average (all orders) for reference line
  const totalWeightedAvg = sortedOrders.length > 0
    ? sortedOrders.reduce((sum, o) => sum + o.impliedPrice * o.valueUSD, 0) / sortedOrders.reduce((sum, o) => sum + o.valueUSD, 0)
    : null;

  // Format time for X axis
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  };

  // Generate nice round tick values for Y axis
  const generateNiceTicks = (min: number, max: number, count: number = 5): { ticks: number[]; domain: [number, number] } => {
    const range = max - min;
    // Find the order of magnitude
    const magnitude = Math.pow(10, Math.floor(Math.log10(range)));
    // Nice step values: 1, 2, 5, 10, 20, 50, etc.
    const niceSteps = [1, 2, 5, 10];
    let step = magnitude;

    // Find a step that gives us approximately the right number of ticks
    for (const mult of niceSteps) {
      const testStep = magnitude * mult / 10;
      const tickCount = Math.ceil(range / testStep);
      if (tickCount <= count + 2 && tickCount >= count - 2) {
        step = testStep;
        break;
      }
    }

    // Round min down and max up to nice values - ensure we cover all data
    const niceMin = Math.floor(min / step) * step;
    // Add one extra step to ensure we have headroom above the highest point
    const niceMax = Math.ceil(max / step) * step + step;

    const ticks: number[] = [];
    for (let v = niceMin; v <= niceMax; v += step) {
      ticks.push(Number(v.toPrecision(4)));
    }

    return {
      ticks,
      domain: [niceMin, niceMax] as [number, number]
    };
  };

  const { ticks: yTicks, domain: yDomain } = generateNiceTicks(yMin, yMax, 6);

  return (
    <div className="mb-6">
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart margin={{ top: 20, right: 30, bottom: 20, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#FFFFFF20" />
            <XAxis
              type="number"
              dataKey="x"
              domain={[xDomainMin, xDomainMax]}
              tickFormatter={formatTime}
              stroke="#FFFFFF20"
              tick={{ fill: '#9CA3AF', fontSize: 12 }}
              tickLine={{ stroke: '#FFFFFF20' }}
              axisLine={{ stroke: '#FFFFFF20' }}
            />
            <YAxis
              type="number"
              dataKey="y"
              domain={yDomain}
              ticks={yTicks}
              tickFormatter={(value) => formatPriceSigFig(value)}
              stroke="#FFFFFF20"
              tick={{ fill: '#9CA3AF', fontSize: 12 }}
              tickLine={{ stroke: '#FFFFFF20' }}
              axisLine={{ stroke: '#FFFFFF20' }}
              width={80}
            />
            <ReferenceLine
              y={displayToken.marketPrice}
              stroke="#00D9FF"
              strokeWidth={2}
              strokeDasharray="5 5"
              label={{
                value: `Market: ${formatPriceSigFig(displayToken.marketPrice)}`,
                position: 'insideLeft',
                fill: '#00D9FF4D',
                fontSize: 48,
                fontWeight: 'bold',
                dy: -20
              }}
            />
            {/* Weighted average line */}
            {totalWeightedAvg && (
              <ReferenceLine
                y={totalWeightedAvg}
                stroke="rgba(255, 215, 0, 0.3)"
                strokeWidth={2}
                label={{
                  value: 'Avg',
                  position: 'right',
                  fill: 'rgba(255, 215, 0, 0.5)',
                  fontSize: 10
                }}
              />
            )}
            {/* Horizontal lines for each price point - with hover zones */}
            {scatterData.map((entry, index) => {
              // Pink for sell orders, green for buy orders (matching orderbook)
              const color = entry.isSelling ? '#EC4899' : '#4ADE80';
              const isHovered = hoveredIndex === index;
              return (
                <ReferenceLine
                  key={`line-${index}`}
                  y={entry.y}
                  stroke={color}
                  strokeWidth={isHovered ? 3 : 1}
                  strokeOpacity={isHovered ? 1 : 0.5}
                  ifOverflow="extendDomain"
                  segment={[{ x: xDomainMin, y: entry.y }, { x: xDomainMax, y: entry.y }]}
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={() => setHoveredIndex(index)}
                  onMouseLeave={() => setHoveredIndex(null)}
                />
              );
            })}
            {/* Invisible wider hit zones for easier line hover */}
            {scatterData.map((entry, index) => (
              <ReferenceLine
                key={`hitzone-${index}`}
                y={entry.y}
                stroke="transparent"
                strokeWidth={20}
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
              />
            ))}
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload || !payload[0]) return null;
                const data = payload[0].payload as OrderPriceLevel & { x: number; y: number };
                // Pink for sell orders, green for buy orders (matching orderbook)
                const color = data.isSelling ? '#EC4899' : '#4ADE80';

                return (
                  <div style={{
                    backgroundColor: 'rgba(0, 0, 0, 0.85)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                    padding: '12px',
                    color: '#fff',
                    backdropFilter: 'blur(8px)',
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
              onMouseLeave={() => setHoveredIndex(null)}
            >
              {scatterData.map((entry, index) => {
                // Pink for sell orders, green for buy orders (matching orderbook)
                const color = entry.isSelling ? '#EC4899' : '#4ADE80';
                const isHovered = hoveredIndex === index;
                return (
                  <Cell
                    key={`cell-${index}`}
                    fill={color}
                    stroke={isHovered ? '#FFFFFF' : 'none'}
                    strokeWidth={isHovered ? 2 : 0}
                    onMouseEnter={() => setHoveredIndex(index)}
                    onMouseLeave={() => setHoveredIndex(null)}
                  />
                );
              })}
            </Scatter>
          </ComposedChart>
        </ResponsiveContainer>
    </div>
  );
}
