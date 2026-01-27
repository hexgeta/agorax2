/**
 * Limit Order Pricing Test Script
 *
 * Tests all user actions from /docs/limit-order-data-flow.md
 * Run with: npx ts-node scripts/test-limit-order-pricing.ts
 *
 * This script simulates the pricing logic without React to verify calculations.
 */

// ============================================================================
// MOCK DATA & HELPERS
// ============================================================================

interface TokenInfo {
  a: string;
  ticker: string;
  decimals: number;
}

interface PricingState {
  sellToken: TokenInfo | null;
  buyToken: TokenInfo | null;
  sellAmount: string;
  buyAmount: string;
  limitPrice: string;
  pricePercentage: number | null;
}

// Mock token prices (USD)
const MOCK_PRICES: Record<string, number> = {
  '0xPLS': 0.00003,      // PLS
  '0xHEX': 0.00225,      // HEX
  '0xMAXI': 0.00264,     // MAXI
  '0xPLSX': 0.00005,     // PLSX
  '0xPARTY': 0.000001,   // PARTY (very small)
  '0xINC': 0.50,         // INC (larger price)
};

const TOKENS: Record<string, TokenInfo> = {
  PLS: { a: '0xPLS', ticker: 'PLS', decimals: 18 },
  HEX: { a: '0xHEX', ticker: 'HEX', decimals: 8 },
  MAXI: { a: '0xMAXI', ticker: 'MAXI', decimals: 8 },
  PLSX: { a: '0xPLSX', ticker: 'PLSX', decimals: 18 },
  PARTY: { a: '0xPARTY', ticker: 'PARTY', decimals: 18 },
  INC: { a: '0xINC', ticker: 'INC', decimals: 18 },
};

const getPrice = (address: string): number => MOCK_PRICES[address] || 0;

// ============================================================================
// PRICING CALCULATIONS (mirrors useLimitOrderPricing.ts)
// ============================================================================

const calculateMarketPrice = (sellTokenAddress: string, buyTokenAddress: string): number => {
  const sellUsd = getPrice(sellTokenAddress);
  const buyUsd = getPrice(buyTokenAddress);
  if (sellUsd <= 0 || buyUsd <= 0) return 0;
  return sellUsd / buyUsd;
};

const calculateLimitPriceFromPercentage = (marketPrice: number, percentage: number | null): number => {
  if (marketPrice <= 0) return 0;
  const pct = percentage ?? 0;
  return marketPrice * (1 + pct / 100);
};

const calculatePercentageFromLimitPrice = (limitPrice: number, marketPrice: number): number => {
  if (marketPrice <= 0 || limitPrice <= 0) return 0;
  return ((limitPrice / marketPrice) - 1) * 100;
};

const calculateBuyAmount = (sellAmount: number, limitPrice: number): number => {
  if (sellAmount <= 0 || limitPrice <= 0) return 0;
  return sellAmount * limitPrice;
};

const calculateLimitPriceFromAmounts = (sellAmount: number, buyAmount: number): number => {
  if (sellAmount <= 0 || buyAmount <= 0) return 0;
  return buyAmount / sellAmount;
};

// ============================================================================
// TEST HELPERS
// ============================================================================

let testsPassed = 0;
let testsFailed = 0;

const formatNumber = (n: number, decimals = 8): string => {
  return n.toFixed(decimals).replace(/\.?0+$/, '');
};

const assertClose = (actual: number, expected: number, tolerance: number, message: string): boolean => {
  const diff = Math.abs(actual - expected);
  const passed = diff <= tolerance;

  if (passed) {
    console.log(`  ✅ ${message}`);
    console.log(`     Expected: ${formatNumber(expected)}, Got: ${formatNumber(actual)}`);
    testsPassed++;
  } else {
    console.log(`  ❌ ${message}`);
    console.log(`     Expected: ${formatNumber(expected)}, Got: ${formatNumber(actual)}, Diff: ${formatNumber(diff)}`);
    testsFailed++;
  }
  return passed;
};

const assertEqual = (actual: any, expected: any, message: string): boolean => {
  const passed = actual === expected;

  if (passed) {
    console.log(`  ✅ ${message}`);
    testsPassed++;
  } else {
    console.log(`  ❌ ${message}`);
    console.log(`     Expected: ${expected}, Got: ${actual}`);
    testsFailed++;
  }
  return passed;
};

const logState = (state: PricingState) => {
  const marketPrice = state.sellToken && state.buyToken
    ? calculateMarketPrice(state.sellToken.a, state.buyToken.a)
    : 0;

  console.log(`  State:`);
  console.log(`    Sell: ${state.sellAmount} ${state.sellToken?.ticker || 'N/A'}`);
  console.log(`    Buy: ${state.buyAmount} ${state.buyToken?.ticker || 'N/A'}`);
  console.log(`    Limit Price: ${state.limitPrice}`);
  console.log(`    Percentage: ${state.pricePercentage !== null ? state.pricePercentage + '%' : 'null'}`);
  console.log(`    Market Price: ${formatNumber(marketPrice)}`);
};

// ============================================================================
// ACTION SIMULATORS
// ============================================================================

/**
 * Action 1 & 2: Change sell or buy token
 * Keeps: sellAmount, percentage
 * Recalculates: marketPrice, limitPrice, buyAmount
 */
const simulateTokenChange = (
  state: PricingState,
  newSellToken: TokenInfo | null,
  newBuyToken: TokenInfo | null
): PricingState => {
  const sellToken = newSellToken || state.sellToken;
  const buyToken = newBuyToken || state.buyToken;

  if (!sellToken || !buyToken) return state;

  const sellAmount = parseFloat(state.sellAmount) || 0;
  if (sellAmount <= 0) return { ...state, sellToken, buyToken };

  const newMarketPrice = calculateMarketPrice(sellToken.a, buyToken.a);
  if (newMarketPrice <= 0) return { ...state, sellToken, buyToken };

  const newLimitPrice = calculateLimitPriceFromPercentage(newMarketPrice, state.pricePercentage);
  const newBuyAmount = calculateBuyAmount(sellAmount, newLimitPrice);

  return {
    sellToken,
    buyToken,
    sellAmount: state.sellAmount,
    buyAmount: formatNumber(newBuyAmount),
    limitPrice: formatNumber(newLimitPrice),
    pricePercentage: state.pricePercentage,
  };
};

/**
 * Action 3: Click percentage button
 * Keeps: sellAmount, tokens
 * Recalculates: percentage, limitPrice, buyAmount
 */
const simulatePercentageClick = (state: PricingState, newPercentage: number): PricingState => {
  if (!state.sellToken || !state.buyToken) return state;

  const sellAmount = parseFloat(state.sellAmount) || 0;
  const marketPrice = calculateMarketPrice(state.sellToken.a, state.buyToken.a);
  if (marketPrice <= 0) return state;

  const newLimitPrice = calculateLimitPriceFromPercentage(marketPrice, newPercentage);
  const newBuyAmount = sellAmount > 0 ? calculateBuyAmount(sellAmount, newLimitPrice) : 0;

  return {
    ...state,
    pricePercentage: newPercentage,
    limitPrice: formatNumber(newLimitPrice),
    buyAmount: newBuyAmount > 0 ? formatNumber(newBuyAmount) : state.buyAmount,
  };
};

/**
 * Action 4 & 5: Drag chart line or type limit price
 * Keeps: sellAmount, tokens
 * Recalculates: limitPrice, percentage, buyAmount
 */
const simulateLimitPriceChange = (state: PricingState, newLimitPrice: number): PricingState => {
  if (!state.sellToken || !state.buyToken || newLimitPrice <= 0) return state;

  const sellAmount = parseFloat(state.sellAmount) || 0;
  const marketPrice = calculateMarketPrice(state.sellToken.a, state.buyToken.a);

  const newPercentage = marketPrice > 0
    ? calculatePercentageFromLimitPrice(newLimitPrice, marketPrice)
    : state.pricePercentage;

  const newBuyAmount = sellAmount > 0 ? calculateBuyAmount(sellAmount, newLimitPrice) : 0;

  return {
    ...state,
    limitPrice: formatNumber(newLimitPrice),
    pricePercentage: newPercentage,
    buyAmount: newBuyAmount > 0 ? formatNumber(newBuyAmount) : state.buyAmount,
  };
};

/**
 * Action 6: Type sell amount
 * Keeps: tokens, limitPrice, percentage
 * Recalculates: sellAmount, buyAmount
 */
const simulateSellAmountChange = (state: PricingState, newSellAmount: string): PricingState => {
  const sellAmt = parseFloat(newSellAmount) || 0;
  const limitPriceNum = parseFloat(state.limitPrice) || 0;

  const newBuyAmount = (sellAmt > 0 && limitPriceNum > 0)
    ? calculateBuyAmount(sellAmt, limitPriceNum)
    : 0;

  return {
    ...state,
    sellAmount: newSellAmount,
    buyAmount: newBuyAmount > 0 ? formatNumber(newBuyAmount) : '',
  };
};

/**
 * Action 7: Type buy amount
 * Keeps: tokens, sellAmount
 * Recalculates: buyAmount, limitPrice, percentage
 */
const simulateBuyAmountChange = (state: PricingState, newBuyAmount: string): PricingState => {
  if (!state.sellToken || !state.buyToken) return state;

  const sellAmt = parseFloat(state.sellAmount) || 0;
  const buyAmt = parseFloat(newBuyAmount) || 0;

  if (sellAmt <= 0 || buyAmt <= 0) {
    return { ...state, buyAmount: newBuyAmount };
  }

  const newLimitPrice = calculateLimitPriceFromAmounts(sellAmt, buyAmt);
  const marketPrice = calculateMarketPrice(state.sellToken.a, state.buyToken.a);
  const newPercentage = marketPrice > 0
    ? calculatePercentageFromLimitPrice(newLimitPrice, marketPrice)
    : state.pricePercentage;

  return {
    ...state,
    buyAmount: newBuyAmount,
    limitPrice: formatNumber(newLimitPrice),
    pricePercentage: newPercentage,
  };
};

// ============================================================================
// TESTS
// ============================================================================

const runTests = () => {
  console.log('\n' + '='.repeat(80));
  console.log('LIMIT ORDER PRICING TESTS');
  console.log('='.repeat(80) + '\n');

  // -------------------------------------------------------------------------
  // TEST 1: Basic market price calculation
  // -------------------------------------------------------------------------
  console.log('TEST 1: Basic Market Price Calculation');
  console.log('-'.repeat(40));

  const maxi_hex_market = calculateMarketPrice(TOKENS.MAXI.a, TOKENS.HEX.a);
  // MAXI = $0.00264, HEX = $0.00225
  // Market price = 0.00264 / 0.00225 = 1.1733...
  assertClose(maxi_hex_market, 1.1733, 0.01, 'MAXI/HEX market price');

  const pls_hex_market = calculateMarketPrice(TOKENS.PLS.a, TOKENS.HEX.a);
  // PLS = $0.00003, HEX = $0.00225
  // Market price = 0.00003 / 0.00225 = 0.01333...
  assertClose(pls_hex_market, 0.01333, 0.001, 'PLS/HEX market price');

  console.log('');

  // -------------------------------------------------------------------------
  // TEST 2: Limit price from percentage
  // -------------------------------------------------------------------------
  console.log('TEST 2: Limit Price from Percentage');
  console.log('-'.repeat(40));

  const marketPrice = 1.17;

  assertClose(
    calculateLimitPriceFromPercentage(marketPrice, 0),
    1.17, 0.001,
    'Market (0%) should equal market price'
  );

  assertClose(
    calculateLimitPriceFromPercentage(marketPrice, 5),
    1.2285, 0.001,
    '+5% above market'
  );

  assertClose(
    calculateLimitPriceFromPercentage(marketPrice, -10),
    1.053, 0.001,
    '-10% below market'
  );

  console.log('');

  // -------------------------------------------------------------------------
  // TEST 3: Percentage from limit price
  // -------------------------------------------------------------------------
  console.log('TEST 3: Percentage from Limit Price');
  console.log('-'.repeat(40));

  assertClose(
    calculatePercentageFromLimitPrice(1.17, 1.17),
    0, 0.1,
    'Same as market = 0%'
  );

  assertClose(
    calculatePercentageFromLimitPrice(1.2285, 1.17),
    5, 0.1,
    'Limit 1.2285 with market 1.17 = ~5%'
  );

  assertClose(
    calculatePercentageFromLimitPrice(1.053, 1.17),
    -10, 0.1,
    'Limit 1.053 with market 1.17 = ~-10%'
  );

  console.log('');

  // -------------------------------------------------------------------------
  // TEST 4: Action 1 - Change SELL token
  // -------------------------------------------------------------------------
  console.log('TEST 4: Action 1 - Change SELL Token');
  console.log('-'.repeat(40));

  let state: PricingState = {
    sellToken: TOKENS.MAXI,
    buyToken: TOKENS.HEX,
    sellAmount: '1000',
    buyAmount: '1230',  // Approximate at +5%
    limitPrice: '1.23',
    pricePercentage: 5, // +5%
  };

  console.log('Before (MAXI → HEX at +5%):');
  logState(state);

  // Change sell token from MAXI to PLS
  state = simulateTokenChange(state, TOKENS.PLS, null);

  console.log('\nAfter (PLS → HEX at +5%):');
  logState(state);

  // Verify: percentage should stay at 5%
  assertEqual(state.pricePercentage, 5, 'Percentage stays at 5%');
  assertEqual(state.sellAmount, '1000', 'Sell amount stays at 1000');

  // New market price for PLS/HEX = 0.00003 / 0.00225 = 0.01333
  // New limit price = 0.01333 * 1.05 = 0.014
  const expectedLimitPrice = calculateMarketPrice(TOKENS.PLS.a, TOKENS.HEX.a) * 1.05;
  assertClose(parseFloat(state.limitPrice), expectedLimitPrice, 0.001, 'Limit price recalculated');

  // New buy amount = 1000 * 0.014 = 14
  const expectedBuyAmount = 1000 * expectedLimitPrice;
  assertClose(parseFloat(state.buyAmount), expectedBuyAmount, 0.1, 'Buy amount recalculated');

  console.log('');

  // -------------------------------------------------------------------------
  // TEST 5: Action 2 - Change BUY token
  // -------------------------------------------------------------------------
  console.log('TEST 5: Action 2 - Change BUY Token');
  console.log('-'.repeat(40));

  state = {
    sellToken: TOKENS.MAXI,
    buyToken: TOKENS.HEX,
    sellAmount: '1000',
    buyAmount: '1230',
    limitPrice: '1.23',
    pricePercentage: 5,
  };

  console.log('Before (MAXI → HEX at +5%):');
  logState(state);

  // Change buy token from HEX to PARTY
  state = simulateTokenChange(state, null, TOKENS.PARTY);

  console.log('\nAfter (MAXI → PARTY at +5%):');
  logState(state);

  assertEqual(state.pricePercentage, 5, 'Percentage stays at 5%');
  assertEqual(state.sellAmount, '1000', 'Sell amount stays at 1000');

  // MAXI = $0.00264, PARTY = $0.000001
  // Market = 0.00264 / 0.000001 = 2640
  const maxi_party_market = calculateMarketPrice(TOKENS.MAXI.a, TOKENS.PARTY.a);
  assertClose(maxi_party_market, 2640, 1, 'MAXI/PARTY market price');

  const expectedLimitPriceParty = maxi_party_market * 1.05;
  assertClose(parseFloat(state.limitPrice), expectedLimitPriceParty, 10, 'Limit price recalculated for PARTY');

  console.log('');

  // -------------------------------------------------------------------------
  // TEST 6: Action 3 - Click percentage button
  // -------------------------------------------------------------------------
  console.log('TEST 6: Action 3 - Click Percentage Button');
  console.log('-'.repeat(40));

  state = {
    sellToken: TOKENS.MAXI,
    buyToken: TOKENS.HEX,
    sellAmount: '1000',
    buyAmount: '1170',
    limitPrice: '1.17',
    pricePercentage: 0, // At market
  };

  console.log('Before (at market 0%):');
  logState(state);

  // Click +10% button
  state = simulatePercentageClick(state, 10);

  console.log('\nAfter (clicked +10%):');
  logState(state);

  assertEqual(state.pricePercentage, 10, 'Percentage changed to 10%');
  assertEqual(state.sellAmount, '1000', 'Sell amount unchanged');

  const expectedLimitAt10 = maxi_hex_market * 1.10;
  assertClose(parseFloat(state.limitPrice), expectedLimitAt10, 0.01, 'Limit price at +10%');

  const expectedBuyAt10 = 1000 * expectedLimitAt10;
  assertClose(parseFloat(state.buyAmount), expectedBuyAt10, 1, 'Buy amount at +10%');

  console.log('');

  // -------------------------------------------------------------------------
  // TEST 7: Action 4/5 - Change limit price (drag or type)
  // -------------------------------------------------------------------------
  console.log('TEST 7: Action 4/5 - Change Limit Price');
  console.log('-'.repeat(40));

  state = {
    sellToken: TOKENS.MAXI,
    buyToken: TOKENS.HEX,
    sellAmount: '1000',
    buyAmount: '1170',
    limitPrice: '1.17',
    pricePercentage: 0,
  };

  console.log('Before (at market):');
  logState(state);

  // User drags to limit price of 1.5 (well above market)
  state = simulateLimitPriceChange(state, 1.5);

  console.log('\nAfter (limit price set to 1.5):');
  logState(state);

  assertEqual(state.sellAmount, '1000', 'Sell amount unchanged');
  assertClose(parseFloat(state.limitPrice), 1.5, 0.001, 'Limit price set to 1.5');

  // Percentage should be recalculated: (1.5 / 1.1733 - 1) * 100 = ~27.8%
  const expectedPercentage = calculatePercentageFromLimitPrice(1.5, maxi_hex_market);
  assertClose(state.pricePercentage!, expectedPercentage, 0.5, 'Percentage recalculated');

  // Buy amount = 1000 * 1.5 = 1500
  assertClose(parseFloat(state.buyAmount), 1500, 1, 'Buy amount = sellAmount * limitPrice');

  console.log('');

  // -------------------------------------------------------------------------
  // TEST 8: Action 6 - Type sell amount
  // -------------------------------------------------------------------------
  console.log('TEST 8: Action 6 - Type Sell Amount');
  console.log('-'.repeat(40));

  state = {
    sellToken: TOKENS.MAXI,
    buyToken: TOKENS.HEX,
    sellAmount: '1000',
    buyAmount: '1230',
    limitPrice: '1.23',
    pricePercentage: 5,
  };

  console.log('Before:');
  logState(state);

  // User types new sell amount
  state = simulateSellAmountChange(state, '5000');

  console.log('\nAfter (sell amount changed to 5000):');
  logState(state);

  assertEqual(state.sellAmount, '5000', 'Sell amount changed to 5000');
  assertEqual(state.limitPrice, '1.23', 'Limit price unchanged');
  assertEqual(state.pricePercentage, 5, 'Percentage unchanged');

  // Buy amount = 5000 * 1.23 = 6150
  assertClose(parseFloat(state.buyAmount), 6150, 1, 'Buy amount recalculated');

  console.log('');

  // -------------------------------------------------------------------------
  // TEST 9: Action 7 - Type buy amount
  // -------------------------------------------------------------------------
  console.log('TEST 9: Action 7 - Type Buy Amount');
  console.log('-'.repeat(40));

  state = {
    sellToken: TOKENS.MAXI,
    buyToken: TOKENS.HEX,
    sellAmount: '1000',
    buyAmount: '1170',
    limitPrice: '1.17',
    pricePercentage: 0,
  };

  console.log('Before (at market):');
  logState(state);

  // User types buy amount of 2000 (wants more HEX)
  state = simulateBuyAmountChange(state, '2000');

  console.log('\nAfter (buy amount changed to 2000):');
  logState(state);

  assertEqual(state.sellAmount, '1000', 'Sell amount unchanged');
  assertEqual(state.buyAmount, '2000', 'Buy amount changed to 2000');

  // Limit price = 2000 / 1000 = 2.0
  assertClose(parseFloat(state.limitPrice), 2.0, 0.001, 'Limit price = buyAmount / sellAmount');

  // Percentage = (2.0 / 1.1733 - 1) * 100 = ~70%
  const expectedPctFromBuy = calculatePercentageFromLimitPrice(2.0, maxi_hex_market);
  assertClose(state.pricePercentage!, expectedPctFromBuy, 1, 'Percentage recalculated from new limit');

  console.log('');

  // -------------------------------------------------------------------------
  // TEST 10: Token change with prices not ready (race condition scenario)
  // -------------------------------------------------------------------------
  console.log('TEST 10: Token Change - Prices Not Ready');
  console.log('-'.repeat(40));

  // Simulate a token that has no price yet
  const UNKNOWN_TOKEN: TokenInfo = { a: '0xUNKNOWN', ticker: 'UNK', decimals: 18 };

  state = {
    sellToken: TOKENS.MAXI,
    buyToken: TOKENS.HEX,
    sellAmount: '1000',
    buyAmount: '1230',
    limitPrice: '1.23',
    pricePercentage: 5,
  };

  console.log('Before:');
  logState(state);

  // Try to change to unknown token (no price)
  const newState = simulateTokenChange(state, null, UNKNOWN_TOKEN);

  console.log('\nAfter (tried to change to token with no price):');
  logState(newState);

  // Market price should be 0 (no price for unknown token)
  const unknownMarket = calculateMarketPrice(TOKENS.MAXI.a, UNKNOWN_TOKEN.a);
  assertEqual(unknownMarket, 0, 'Market price is 0 for unknown token');

  // State should preserve old values when prices aren't ready
  assertEqual(newState.limitPrice, state.limitPrice, 'Limit price preserved when no price');
  assertEqual(newState.buyAmount, state.buyAmount, 'Buy amount preserved when no price');

  console.log('');

  // -------------------------------------------------------------------------
  // TEST 11: Extreme values
  // -------------------------------------------------------------------------
  console.log('TEST 11: Extreme Values');
  console.log('-'.repeat(40));

  // Very large sell amount
  state = {
    sellToken: TOKENS.MAXI,
    buyToken: TOKENS.HEX,
    sellAmount: '1000000000', // 1 billion
    buyAmount: '',
    limitPrice: '1.17',
    pricePercentage: 0,
  };

  state = simulateSellAmountChange(state, '1000000000');
  console.log('Large sell amount (1 billion):');
  logState(state);

  const expectedLargeBuy = 1000000000 * 1.17;
  assertClose(parseFloat(state.buyAmount), expectedLargeBuy, 10000, 'Buy amount for 1B sell');

  // Very small sell amount
  state.sellAmount = '0.00001';
  state = simulateSellAmountChange(state, '0.00001');
  console.log('\nSmall sell amount (0.00001):');
  logState(state);

  const expectedSmallBuy = 0.00001 * 1.17;
  assertClose(parseFloat(state.buyAmount), expectedSmallBuy, 0.000001, 'Buy amount for tiny sell');

  console.log('');

  // -------------------------------------------------------------------------
  // TEST 12: Sequence of actions (realistic user flow)
  // -------------------------------------------------------------------------
  console.log('TEST 12: Realistic User Flow');
  console.log('-'.repeat(40));

  // User starts fresh
  state = {
    sellToken: TOKENS.MAXI,
    buyToken: TOKENS.HEX,
    sellAmount: '',
    buyAmount: '',
    limitPrice: '',
    pricePercentage: null,
  };

  console.log('Step 1: Initial state');
  logState(state);

  // User clicks +5% button (sets percentage, calculates limit price)
  state = simulatePercentageClick(state, 5);
  console.log('\nStep 2: Click +5% button');
  logState(state);
  assertClose(parseFloat(state.limitPrice), maxi_hex_market * 1.05, 0.01, 'Limit price set at +5%');

  // User enters sell amount
  state = simulateSellAmountChange(state, '45086');
  console.log('\nStep 3: Enter sell amount 45086');
  logState(state);
  assertEqual(state.sellAmount, '45086', 'Sell amount set');

  // User changes buy token to PARTY
  state = simulateTokenChange(state, null, TOKENS.PARTY);
  console.log('\nStep 4: Change buy token to PARTY');
  logState(state);
  assertEqual(state.pricePercentage, 5, 'Percentage still 5%');

  // User adjusts buy amount directly
  state = simulateBuyAmountChange(state, '150000000');
  console.log('\nStep 5: Manually set buy amount to 150,000,000');
  logState(state);
  assertEqual(state.buyAmount, '150000000', 'Buy amount set');

  // Limit price should be: 150000000 / 45086 = 3326.77
  const expectedManualLimit = 150000000 / 45086;
  assertClose(parseFloat(state.limitPrice), expectedManualLimit, 1, 'Limit price from manual buy');

  console.log('');

  // -------------------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------------------
  console.log('='.repeat(80));
  console.log('TEST SUMMARY');
  console.log('='.repeat(80));
  console.log(`✅ Passed: ${testsPassed}`);
  console.log(`❌ Failed: ${testsFailed}`);
  console.log(`Total: ${testsPassed + testsFailed}`);
  console.log('='.repeat(80) + '\n');

  if (testsFailed > 0) {
    process.exit(1);
  }
};

// ============================================================================
// INTERACTIVE SCENARIO RUNNER
// ============================================================================

const runScenario = (name: string, steps: Array<{ action: string; fn: () => PricingState }>, initialState: PricingState) => {
  console.log('\n' + '='.repeat(80));
  console.log(`SCENARIO: ${name}`);
  console.log('='.repeat(80));

  let state = { ...initialState };
  console.log('\nInitial State:');
  logState(state);

  steps.forEach((step, i) => {
    console.log(`\n--- Step ${i + 1}: ${step.action} ---`);
    state = step.fn();
    logState(state);
  });

  return state;
};

// ============================================================================
// SPECIFIC BUG REPRODUCTION TESTS
// ============================================================================

const runBugReproductionTests = () => {
  console.log('\n' + '='.repeat(80));
  console.log('BUG REPRODUCTION TESTS');
  console.log('='.repeat(80));

  // -------------------------------------------------------------------------
  // BUG 1: "Crazy limit price" when changing tokens
  // This was the race condition bug - price goes wild then snaps back
  // -------------------------------------------------------------------------
  console.log('\n' + '-'.repeat(40));
  console.log('BUG 1: Token change race condition');
  console.log('-'.repeat(40));

  let state: PricingState = {
    sellToken: TOKENS.MAXI,
    buyToken: TOKENS.HEX,
    sellAmount: '45086.1239',
    buyAmount: '123259.3815',
    limitPrice: '2.7340',  // Some premium
    pricePercentage: 133.04, // ~133% above market (high premium)
  };

  console.log('Initial (MAXI → HEX with high premium):');
  logState(state);

  // The bug was: when changing to PARTY, the old HEX price was used momentarily
  // Let's verify what SHOULD happen:
  console.log('\nChanging buy token to PARTY...');
  state = simulateTokenChange(state, null, TOKENS.PARTY);
  logState(state);

  // Verify the percentage stayed
  assertClose(state.pricePercentage!, 133.04, 0.1, 'Premium percentage preserved');

  // Calculate expected values
  const maxi_party_market = calculateMarketPrice(TOKENS.MAXI.a, TOKENS.PARTY.a);
  const expectedLimit = maxi_party_market * (1 + 133.04 / 100);
  assertClose(parseFloat(state.limitPrice), expectedLimit, 10, 'Limit price correctly calculated for PARTY');

  // -------------------------------------------------------------------------
  // BUG 2: Verify percentage calculation is correct after token change
  // -------------------------------------------------------------------------
  console.log('\n' + '-'.repeat(40));
  console.log('BUG 2: Percentage accuracy after changes');
  console.log('-'.repeat(40));

  state = {
    sellToken: TOKENS.MAXI,
    buyToken: TOKENS.PARTY,
    sellAmount: '45086',
    buyAmount: '',
    limitPrice: '',
    pricePercentage: null,
  };

  // Set to market (0%)
  state = simulatePercentageClick(state, 0);
  console.log('At market (0%):');
  logState(state);

  const marketAtZero = calculateMarketPrice(TOKENS.MAXI.a, TOKENS.PARTY.a);
  assertClose(parseFloat(state.limitPrice), marketAtZero, 1, 'Limit = market at 0%');

  // Now type a specific buy amount and verify percentage
  const desiredBuy = 150000000;
  state = simulateBuyAmountChange(state, desiredBuy.toString());
  console.log('\nAfter setting buy to 150M:');
  logState(state);

  const actualLimit = desiredBuy / 45086;
  const expectedPct = ((actualLimit / marketAtZero) - 1) * 100;
  assertClose(state.pricePercentage!, expectedPct, 0.5, 'Percentage correctly calculated from buy amount');

  // -------------------------------------------------------------------------
  // BUG 3: Very small prices (like PARTY at $0.000001)
  // -------------------------------------------------------------------------
  console.log('\n' + '-'.repeat(40));
  console.log('BUG 3: Very small token prices');
  console.log('-'.repeat(40));

  state = {
    sellToken: TOKENS.PLS,   // $0.00003
    buyToken: TOKENS.PARTY,  // $0.000001
    sellAmount: '1000000',   // 1M PLS
    buyAmount: '',
    limitPrice: '',
    pricePercentage: 5,
  };

  const pls_party_market = calculateMarketPrice(TOKENS.PLS.a, TOKENS.PARTY.a);
  console.log(`Market price PLS/PARTY: ${pls_party_market}`);
  // PLS = $0.00003, PARTY = $0.000001
  // Market = 0.00003 / 0.000001 = 30

  state = simulatePercentageClick(state, 5);
  console.log('At +5%:');
  logState(state);

  assertClose(pls_party_market, 30, 0.1, 'PLS/PARTY market = 30');
  assertClose(parseFloat(state.limitPrice), 31.5, 0.1, 'Limit at +5% = 31.5');

  // Buy amount = 1M * 31.5 = 31.5M
  assertClose(parseFloat(state.buyAmount), 31500000, 1000, 'Buy amount = 31.5M PARTY');

  // -------------------------------------------------------------------------
  // BUG 4: Percentage calculation with very small buy token (COM bug)
  // The percentage was showing 145,858,105,010,880,950,000% instead of ~4.5%
  // This was caused by comparing limitPrice (buy/sell) with marketPrice (sell/buy)
  // -------------------------------------------------------------------------
  console.log('\n' + '-'.repeat(40));
  console.log('BUG 4: COM percentage calculation');
  console.log('-'.repeat(40));

  // Add COM token with very small price
  const COM_TOKEN: TokenInfo = { a: '0xCOM', ticker: 'COM', decimals: 18 };
  MOCK_PRICES['0xCOM'] = 0.000002; // $0.000002 (very tiny)

  state = {
    sellToken: TOKENS.MAXI,  // $0.00264
    buyToken: COM_TOKEN,     // $0.000002
    sellAmount: '63.7512',
    buyAmount: '',
    limitPrice: '',
    pricePercentage: null,
  };

  // Market price in buy/sell format (COM per MAXI)
  // = sellPrice / buyPrice = 0.00264 / 0.000002 = 1,320
  const maxi_com_market = calculateMarketPrice(TOKENS.MAXI.a, COM_TOKEN.a);
  console.log(`Market price MAXI/COM: ${maxi_com_market.toLocaleString()}`);

  assertClose(maxi_com_market, 1320, 10, 'MAXI/COM market = 1320');

  // Set at market (0%)
  state = simulatePercentageClick(state, 0);
  console.log('At market (0%):');
  logState(state);

  // Now simulate user setting limit price slightly above market (+5%)
  const targetLimitPrice = 1386; // ~5% above market (1320 * 1.05 = 1386)
  state = simulateLimitPriceChange(state, targetLimitPrice);
  console.log(`\nAfter setting limit price to ${targetLimitPrice.toLocaleString()}:`);
  logState(state);

  // Percentage should be ~5%
  // Formula: ((1386 / 1320) - 1) * 100 = 5%
  const expectedPctCom = ((targetLimitPrice / maxi_com_market) - 1) * 100;
  console.log(`Expected percentage: ${expectedPctCom.toFixed(2)}%`);

  assertClose(state.pricePercentage!, expectedPctCom, 0.5, 'Percentage is ~5% (correct)');

  // Verify it's NOT the buggy astronomical value
  const isBuggy = Math.abs(state.pricePercentage!) > 100;
  assertEqual(!isBuggy, true, 'Percentage is NOT astronomical (bug fixed)');

  // -------------------------------------------------------------------------
  // BUG 5: Large prices (like INC at $0.50)
  // -------------------------------------------------------------------------
  console.log('\n' + '-'.repeat(40));
  console.log('BUG 4: Larger token prices');
  console.log('-'.repeat(40));

  state = {
    sellToken: TOKENS.INC,   // $0.50
    buyToken: TOKENS.HEX,    // $0.00225
    sellAmount: '100',
    buyAmount: '',
    limitPrice: '',
    pricePercentage: 0,
  };

  const inc_hex_market = calculateMarketPrice(TOKENS.INC.a, TOKENS.HEX.a);
  console.log(`Market price INC/HEX: ${inc_hex_market}`);
  // INC = $0.50, HEX = $0.00225
  // Market = 0.50 / 0.00225 = 222.22

  state = simulatePercentageClick(state, 0);
  console.log('At market:');
  logState(state);

  assertClose(inc_hex_market, 222.22, 1, 'INC/HEX market = 222.22');

  // Buy amount = 100 * 222.22 = 22222
  assertClose(parseFloat(state.buyAmount), 22222, 10, 'Buy amount = 22222 HEX');
};

// ============================================================================
// MAIN
// ============================================================================

const args = process.argv.slice(2);

if (args.includes('--bugs')) {
  // Run bug reproduction tests only
  runBugReproductionTests();
} else if (args.includes('--all')) {
  // Run everything
  runTests();
  runBugReproductionTests();
} else {
  // Default: run main tests
  runTests();
}

console.log('\n📋 To run specific tests:');
console.log('   npx ts-node scripts/test-limit-order-pricing.ts          # Main tests');
console.log('   npx ts-node scripts/test-limit-order-pricing.ts --bugs   # Bug reproduction');
console.log('   npx ts-node scripts/test-limit-order-pricing.ts --all    # Everything\n');
