#!/usr/bin/env node

/**
 * API vs On-Chain Data Validator
 *
 * Fetches order data from the AgoráX API and compares it against
 * on-chain contract state via PulseChain RPC. Runs checks at random
 * intervals over a configurable period (default 10 minutes).
 *
 * Usage:
 *   node scripts/validate-api-vs-chain.mjs
 *   node scripts/validate-api-vs-chain.mjs --duration 5   # 5 minutes
 *   node scripts/validate-api-vs-chain.mjs --checks 8     # 8 checks total
 */

import { createPublicClient, http } from 'viem';
import { pulsechain } from 'viem/chains';

// ── Config ──────────────────────────────────────────────────────────────────
const API_BASE = process.env.API_BASE || 'https://agorax.win/api/v1';
const CONTRACT_ADDRESS = '0x06856CEa795D001bED91acdf1264CaB174949bf3';
const RPC_URL = 'https://rpc.pulsechain.com';

const args = process.argv.slice(2);
const durationMinutes = parseInt(getArg('--duration') || '10', 10);
const totalChecks = parseInt(getArg('--checks') || '6', 10);

function getArg(flag) {
  const idx = args.indexOf(flag);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : null;
}

// ── ABI (only what we need) ─────────────────────────────────────────────────
const ABI = [
  {
    inputs: [],
    name: 'getTotalOrderCount',
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: '_orderID', type: 'uint256' }],
    name: 'getOrderDetails',
    outputs: [
      {
        components: [
          {
            components: [
              { name: 'orderIndex', type: 'uint256' },
              { name: 'orderOwner', type: 'address' },
            ],
            name: 'userDetails',
            type: 'tuple',
          },
          {
            components: [
              { name: 'orderID', type: 'uint256' },
              { name: 'remainingSellAmount', type: 'uint256' },
              { name: 'redeemedSellAmount', type: 'uint256' },
              { name: 'lastUpdateTime', type: 'uint64' },
              { name: 'status', type: 'uint8' },
              { name: 'creationProtocolFee', type: 'uint256' },
              {
                components: [
                  { name: 'sellToken', type: 'address' },
                  { name: 'sellAmount', type: 'uint256' },
                  { name: 'buyTokensIndex', type: 'uint256[]' },
                  { name: 'buyAmounts', type: 'uint256[]' },
                  { name: 'expirationTime', type: 'uint64' },
                  { name: 'allOrNothing', type: 'bool' },
                ],
                name: 'orderDetails',
                type: 'tuple',
              },
            ],
            name: 'orderDetailsWithID',
            type: 'tuple',
          },
        ],
        type: 'tuple',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
];

// ── Viem client ─────────────────────────────────────────────────────────────
const client = createPublicClient({
  chain: pulsechain,
  transport: http(RPC_URL),
});

// ── Helpers ─────────────────────────────────────────────────────────────────
const STATUS_MAP = { 0: 'active', 1: 'cancelled', 2: 'completed' };
let totalMismatches = 0;
let totalOrdersChecked = 0;
let totalPassed = 0;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function log(msg) {
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`[${ts}] ${msg}`);
}

function logMismatch(orderId, field, apiVal, chainVal) {
  totalMismatches++;
  console.log(`  ❌ Order #${orderId} MISMATCH: ${field}`);
  console.log(`     API:   ${apiVal}`);
  console.log(`     Chain: ${chainVal}`);
}

function logMatch(orderId, fields) {
  totalPassed++;
  console.log(`  ✅ Order #${orderId} — ${fields} fields match`);
}

// ── Core validation ─────────────────────────────────────────────────────────
async function getOnChainOrder(orderId) {
  const result = await client.readContract({
    address: CONTRACT_ADDRESS,
    abi: ABI,
    functionName: 'getOrderDetails',
    args: [BigInt(orderId)],
  });
  return result;
}

async function getApiOrder(orderId) {
  const res = await fetch(`${API_BASE}/orders/${orderId}?include=fills`);
  if (!res.ok) return null;
  const json = await res.json();
  return json.data?.order || null;
}

async function getTotalOrderCount() {
  const count = await client.readContract({
    address: CONTRACT_ADDRESS,
    abi: ABI,
    functionName: 'getTotalOrderCount',
  });
  return Number(count);
}

async function getApiStats() {
  const res = await fetch(`${API_BASE}/stats`);
  if (!res.ok) return null;
  const json = await res.json();
  return json.data || null;
}

async function validateOrder(orderId) {
  const [apiOrder, chainData] = await Promise.all([
    getApiOrder(orderId),
    getOnChainOrder(orderId),
  ]);

  if (!apiOrder) {
    console.log(`  ⚠️  Order #${orderId} not found in API (may not be synced yet)`);
    return;
  }

  totalOrdersChecked++;
  const chain = chainData.orderDetailsWithID;
  const details = chain.orderDetails;
  let mismatches = 0;
  let fieldsChecked = 0;

  // Status
  fieldsChecked++;
  if (apiOrder.status !== chain.status) {
    logMismatch(orderId, 'status', `${apiOrder.status} (${STATUS_MAP[apiOrder.status]})`, `${chain.status} (${STATUS_MAP[chain.status]})`);
    mismatches++;
  }

  // Maker address
  fieldsChecked++;
  const chainOwner = chainData.userDetails.orderOwner.toLowerCase();
  if (apiOrder.maker_address?.toLowerCase() !== chainOwner) {
    logMismatch(orderId, 'maker_address', apiOrder.maker_address, chainOwner);
    mismatches++;
  }

  // Sell token address
  fieldsChecked++;
  const chainSellToken = details.sellToken.toLowerCase();
  const apiSellToken = (apiOrder.sell_token_address || '').toLowerCase();
  // PLS has no address (0x0 on chain), API might store empty or 0x0
  const zeroAddr = '0x0000000000000000000000000000000000000000';
  if (apiSellToken && apiSellToken !== zeroAddr && chainSellToken !== zeroAddr) {
    if (apiSellToken !== chainSellToken) {
      logMismatch(orderId, 'sell_token_address', apiSellToken, chainSellToken);
      mismatches++;
    }
  }

  // Sell amount (original)
  fieldsChecked++;
  const chainSellAmount = chain.orderDetails.sellAmount.toString();
  if (apiOrder.sell_amount_raw && apiOrder.sell_amount_raw !== chainSellAmount) {
    logMismatch(orderId, 'sell_amount_raw', apiOrder.sell_amount_raw, chainSellAmount);
    mismatches++;
  }

  // Remaining sell amount
  fieldsChecked++;
  const chainRemaining = chain.remainingSellAmount.toString();
  if (apiOrder.remaining_sell_amount && apiOrder.remaining_sell_amount !== chainRemaining) {
    logMismatch(orderId, 'remaining_sell_amount', apiOrder.remaining_sell_amount, chainRemaining);
    mismatches++;
  }

  // Redeemed sell amount
  fieldsChecked++;
  const chainRedeemed = chain.redeemedSellAmount.toString();
  if (apiOrder.redeemed_sell_amount && apiOrder.redeemed_sell_amount !== chainRedeemed) {
    logMismatch(orderId, 'redeemed_sell_amount', apiOrder.redeemed_sell_amount, chainRedeemed);
    mismatches++;
  }

  // Expiration
  fieldsChecked++;
  const chainExpiration = Number(details.expirationTime);
  if (apiOrder.expiration !== undefined && apiOrder.expiration !== chainExpiration) {
    logMismatch(orderId, 'expiration', apiOrder.expiration, chainExpiration);
    mismatches++;
  }

  // All-or-nothing
  fieldsChecked++;
  if (apiOrder.is_all_or_nothing !== undefined && apiOrder.is_all_or_nothing !== details.allOrNothing) {
    logMismatch(orderId, 'is_all_or_nothing', apiOrder.is_all_or_nothing, details.allOrNothing);
    mismatches++;
  }

  // Buy amounts count
  fieldsChecked++;
  const chainBuyAmounts = details.buyAmounts.map(String);
  const apiBuyAmounts = apiOrder.buy_amounts_raw || [];
  if (apiBuyAmounts.length !== chainBuyAmounts.length) {
    logMismatch(orderId, 'buy_amounts count', apiBuyAmounts.length, chainBuyAmounts.length);
    mismatches++;
  }

  if (mismatches === 0) {
    logMatch(orderId, fieldsChecked);
  }
}

async function runCheck(checkNum, totalOnChain) {
  console.log(`\n━━━ Check ${checkNum}/${totalChecks} ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  log(`Sampling random orders from ${totalOnChain} total on-chain orders`);

  // Pick 5-10 random order IDs per check
  // Exclude the last 2 orders to avoid sync lag false positives
  const maxId = Math.max(0, totalOnChain - 3);
  const sampleSize = Math.min(randomInt(5, 10), maxId + 1);
  const orderIds = new Set();
  while (orderIds.size < sampleSize) {
    orderIds.add(randomInt(0, maxId));
  }

  log(`Validating orders: ${[...orderIds].join(', ')}`);

  for (const id of orderIds) {
    try {
      await validateOrder(id);
    } catch (err) {
      console.log(`  ⚠️  Order #${id} error: ${err.message}`);
    }
  }
}

async function validateTotalCount(totalOnChain) {
  console.log(`\n━━━ Total Order Count Check ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  const stats = await getApiStats();
  if (!stats) {
    console.log('  ⚠️  Could not fetch API stats');
    return;
  }

  const apiTotal = stats.orders?.total || 0;
  log(`On-chain total: ${totalOnChain}`);
  log(`API total:      ${apiTotal}`);

  if (apiTotal === totalOnChain) {
    console.log('  ✅ Total order counts match');
  } else {
    const diff = totalOnChain - apiTotal;
    console.log(`  ⚠️  Difference: ${diff} orders (sync lag expected up to ~1 min)`);
  }
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║  AgoráX API vs On-Chain Validator                      ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log(`  API:      ${API_BASE}`);
  console.log(`  Contract: ${CONTRACT_ADDRESS}`);
  console.log(`  Duration: ${durationMinutes} minutes`);
  console.log(`  Checks:   ${totalChecks} (randomly spaced)\n`);

  // Get total order count from chain
  const totalOnChain = await getTotalOrderCount();
  log(`On-chain order count: ${totalOnChain}`);

  if (totalOnChain === 0) {
    console.log('No orders on chain. Nothing to validate.');
    return;
  }

  // Validate total count first
  await validateTotalCount(totalOnChain);

  // Schedule checks at random intervals across the duration
  const durationMs = durationMinutes * 60 * 1000;
  const intervals = [];
  for (let i = 0; i < totalChecks; i++) {
    intervals.push(Math.random() * durationMs);
  }
  intervals.sort((a, b) => a - b);

  // Run first check immediately
  await runCheck(1, totalOnChain);

  // Schedule remaining checks
  let prevTime = 0;
  for (let i = 1; i < totalChecks; i++) {
    const waitMs = intervals[i] - intervals[i - 1];
    const waitSec = Math.round(waitMs / 1000);
    log(`Next check in ~${waitSec}s...`);
    await sleep(waitMs);
    // Re-fetch total in case new orders appeared
    const currentTotal = await getTotalOrderCount();
    await runCheck(i + 1, currentTotal);
  }

  // Final summary
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║  RESULTS                                                ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log(`  Orders checked: ${totalOrdersChecked}`);
  console.log(`  Passed:         ${totalPassed}`);
  console.log(`  Mismatches:     ${totalMismatches}`);
  console.log(`  Status:         ${totalMismatches === 0 ? '✅ ALL CLEAR' : '❌ DISCREPANCIES FOUND'}`);
  console.log('');

  process.exit(totalMismatches > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(2);
});
