#!/usr/bin/env node

/**
 * Validates the unfillable (dust) order formula against all on-chain orders.
 *
 * Formula: An order is unfillable when for ALL buy tokens:
 *   remaining * buyAmount < sellAmount
 *
 * This means the remaining sell amount is too small to yield even 1 unit of any buy token.
 */

import { createPublicClient, http } from 'viem';
import { pulsechain } from 'viem/chains';

const CONTRACT_ADDRESS = '0x06856CEa795D001bED91acdf1264CaB174949bf3';
const RPC_URL = 'https://rpc.pulsechain.com';

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
  {
    inputs: [],
    name: 'getWhitelistCount',
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: '_index', type: 'uint256' }],
    name: 'getWhitelistedToken',
    outputs: [
      {
        components: [
          { name: 'tokenAddress', type: 'address' },
          { name: 'decimals', type: 'uint8' },
          { name: 'isActive', type: 'bool' },
        ],
        type: 'tuple',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
];

const STATUS_MAP = { 0: 'active', 1: 'cancelled', 2: 'completed' };

const client = createPublicClient({
  chain: pulsechain,
  transport: http(RPC_URL),
});

function isUnfillable(remaining, sellAmount, buyAmounts) {
  if (remaining === 0n) return true;
  if (sellAmount === 0n || buyAmounts.length === 0) return false;

  for (const buyAmount of buyAmounts) {
    if (buyAmount === 0n) continue;
    // Can this buy token still be filled?
    // remaining * buyAmount >= sellAmount means at least 1 unit can be bought
    if (remaining * buyAmount >= sellAmount) {
      return false; // Still fillable
    }
  }
  return true; // Unfillable for all buy tokens
}

function fillPercentage(sellAmount, remaining) {
  if (sellAmount === 0n) return 0;
  return Number((sellAmount - remaining) * 10000n / sellAmount) / 100;
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║  Unfillable Order Formula Validator                     ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  const totalOrderCount = await client.readContract({
    address: CONTRACT_ADDRESS,
    abi: ABI,
    functionName: 'getTotalOrderCount',
  });
  const total = Number(totalOrderCount);
  console.log(`Total orders on-chain: ${total}\n`);

  const unfillableOrders = [];
  const fillableActiveOrders = [];
  const completedOrders = [];
  const cancelledOrders = [];

  // Fetch all orders in batches
  for (let i = 0; i < total; i += 10) {
    const batch = Array.from({ length: Math.min(10, total - i) }, (_, j) => i + j + 1);
    const results = await Promise.all(
      batch.map(id =>
        client.readContract({
          address: CONTRACT_ADDRESS,
          abi: ABI,
          functionName: 'getOrderDetails',
          args: [BigInt(id)],
        })
      )
    );

    for (let j = 0; j < results.length; j++) {
      const orderId = batch[j];
      const data = results[j];
      const details = data.orderDetailsWithID;
      const orderDetails = details.orderDetails;

      const status = details.status;
      const remaining = details.remainingSellAmount;
      const sellAmount = orderDetails.sellAmount;
      const buyAmounts = orderDetails.buyAmounts;
      const filled = fillPercentage(sellAmount, remaining);
      const unfillable = isUnfillable(remaining, sellAmount, buyAmounts);

      if (status === 2) {
        completedOrders.push({ orderId, filled, remaining, sellAmount });
        continue;
      }
      if (status === 1) {
        cancelledOrders.push({ orderId, filled, remaining, sellAmount });
        continue;
      }

      // Status 0 (active)
      if (unfillable) {
        unfillableOrders.push({ orderId, filled, remaining, sellAmount, buyAmounts });
      } else {
        fillableActiveOrders.push({ orderId, filled, remaining, sellAmount, buyAmounts });
      }
    }
  }

  // Report
  console.log(`━━━ Summary ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`  Completed (status=2): ${completedOrders.length}`);
  console.log(`  Cancelled (status=1): ${cancelledOrders.length}`);
  console.log(`  Active & fillable:    ${fillableActiveOrders.length}`);
  console.log(`  Active & UNFILLABLE:  ${unfillableOrders.length}`);
  console.log('');

  if (unfillableOrders.length > 0) {
    console.log(`━━━ Unfillable (Dust) Orders ━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`  These are status=0 but too small to fill any buy token:\n`);
    for (const o of unfillableOrders) {
      console.log(`  Order #${o.orderId}: ${o.filled.toFixed(4)}% filled`);
      console.log(`    sellAmount:  ${o.sellAmount.toString()}`);
      console.log(`    remaining:   ${o.remaining.toString()}`);
      console.log(`    buyAmounts:  [${o.buyAmounts.map(b => b.toString()).join(', ')}]`);
      // Show the math for each buy token
      for (let i = 0; i < o.buyAmounts.length; i++) {
        const ba = o.buyAmounts[i];
        if (ba === 0n) continue;
        const product = o.remaining * ba;
        console.log(`    buy[${i}]: remaining(${o.remaining}) * buyAmount(${ba}) = ${product} ${product < o.sellAmount ? '<' : '>='} sellAmount(${o.sellAmount}) → ${product < o.sellAmount ? 'UNFILLABLE' : 'fillable'}`);
      }
      console.log('');
    }
  }

  if (fillableActiveOrders.length > 0) {
    console.log(`━━━ Active Fillable Orders ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    for (const o of fillableActiveOrders) {
      const expiry = ''; // not critical for this check
      console.log(`  Order #${o.orderId}: ${o.filled.toFixed(2)}% filled, remaining=${o.remaining.toString()}`);
    }
    console.log('');
  }

  // Specifically check order #80
  console.log(`━━━ Order #80 Specific Check ━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  const order80 = await client.readContract({
    address: CONTRACT_ADDRESS,
    abi: ABI,
    functionName: 'getOrderDetails',
    args: [80n],
  });
  const d80 = order80.orderDetailsWithID;
  const od80 = d80.orderDetails;
  const r80 = d80.remainingSellAmount;
  const s80 = od80.sellAmount;
  const ba80 = od80.buyAmounts;
  const f80 = fillPercentage(s80, r80);
  const u80 = isUnfillable(r80, s80, ba80);

  console.log(`  Status:       ${STATUS_MAP[d80.status]} (${d80.status})`);
  console.log(`  Filled:       ${f80.toFixed(4)}%`);
  console.log(`  sellAmount:   ${s80.toString()}`);
  console.log(`  remaining:    ${r80.toString()}`);
  console.log(`  buyAmounts:   [${ba80.map(b => b.toString()).join(', ')}]`);
  console.log(`  Unfillable?   ${u80 ? '❌ YES (would show Cancel & Claim)' : '✅ NO (still fillable)'}`);
  for (let i = 0; i < ba80.length; i++) {
    const ba = ba80[i];
    if (ba === 0n) continue;
    const product = r80 * ba;
    console.log(`  buy[${i}]: ${r80} * ${ba} = ${product} ${product < s80 ? '<' : '>='} ${s80} → ${product < s80 ? 'UNFILLABLE' : 'fillable'}`);
  }

  console.log('\n✅ Validation complete.');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
