/**
 * Tax Token Detection v3 — Transfer Simulation via eth_call state overrides
 *
 * For each token:
 * 1. Override sender's balance in storage (tries multiple mapping slots)
 * 2. Deploy a helper contract via code override that does transfer + balanceOf
 * 3. Compare sent vs received amounts to detect fees
 */

import { keccak256, encodeAbiParameters, parseAbiParameters, encodeFunctionData } from 'viem';
import fs from 'fs';
import path from 'path';

const RPC_URL = 'https://rpc.pulsechain.com';
const BATCH_SIZE = 15;
const NATIVE_PLS = '0xA1077a294dDE1B09bB078844df40758a5D0f9a27';
const SENDER = '0x0000000000000000000000000000000000001337';
const RECIPIENT = '0x0000000000000000000000000000000000007331';
const HELPER = '0x0000000000000000000000000000000000009999';

// ── RPC helper ──────────────────────────────────────────────────────────
async function rpcCall(method, params) {
  const resp = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  const data = await resp.json();
  if (data.error) throw new Error(data.error.message);
  return data.result;
}

// Format BigInt as hex WITHOUT leading zeros (PulseChain requires this)
function toHexNoLeading(n) {
  if (n === 0n) return '0x0';
  return '0x' + n.toString(16);
}

// Format as 32-byte padded hex (for storage keys)
function toHex32(n) {
  return '0x' + n.toString(16).padStart(64, '0');
}

// ── Compute balance mapping storage slot ────────────────────────────────
function getBalanceSlot(address, mappingSlot) {
  return keccak256(
    encodeAbiParameters(
      parseAbiParameters('address, uint256'),
      [address, BigInt(mappingSlot)]
    )
  );
}

// ── Parse tokens ────────────────────────────────────────────────────────
function parseTokens() {
  const content = fs.readFileSync(
    path.join(process.cwd(), 'constants', 'crypto.ts'),
    'utf-8'
  );
  const tokens = [];
  const regex = /\{\s*chain:\s*(\d+)\s*,\s*a:\s*"(0x[a-fA-F0-9]+)"\s*,[\s\S]*?ticker:\s*"([^"]+)"[\s\S]*?decimals:\s*(\d+)[\s\S]*?name:\s*"([^"]+)"[\s\S]*?\}/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    tokens.push({
      chain: parseInt(match[1]),
      address: match[2],
      ticker: match[3],
      decimals: parseInt(match[4]),
      name: match[5],
    });
  }
  return tokens.filter(t =>
    t.chain === 369 && t.address.toLowerCase() !== NATIVE_PLS.toLowerCase()
  );
}

// ── Build helper contract bytecode ──────────────────────────────────────
// Runtime code that: calls token.transfer(to, amount), then token.balanceOf(to), returns balance
function buildHelperCode(tokenAddr, recipientAddr, amount) {
  const token = tokenAddr.slice(2).toLowerCase().padStart(40, '0');
  const to = recipientAddr.slice(2).toLowerCase().padStart(40, '0');
  const amt = amount.toString(16).padStart(64, '0');

  // EVM bytecode:
  // 1. MSTORE transfer calldata: selector(a9059cbb) + to + amount
  // 2. CALL token with transfer calldata
  // 3. MSTORE balanceOf calldata: selector(70a08231) + to
  // 4. STATICCALL token with balanceOf calldata
  // 5. Return the 32-byte result

  return '0x' + [
    // --- transfer(to, amount) ---
    // Store selector a9059cbb at memory[0x00] (left-aligned in 32 bytes)
    '7fa9059cbb00000000000000000000000000000000000000000000000000000000',
    '600052',       // MSTORE(0x00)
    // Store 'to' at memory[0x04] (address is right-aligned in 32 bytes)
    '73' + to,
    '600452',       // MSTORE(0x04)
    // Store amount at memory[0x24]
    '7f' + amt,
    '602452',       // MSTORE(0x24)
    // CALL(gas, token, value=0, argsOffset=0, argsLen=0x44, retOff=0x80, retLen=0x20)
    '6020',         // retLen
    '6080',         // retOff
    '6044',         // argsLen
    '6000',         // argsOff
    '6000',         // value
    '73' + token,
    '5a',           // GAS
    'f1',           // CALL
    '50',           // POP success

    // --- balanceOf(to) ---
    '7f70a0823100000000000000000000000000000000000000000000000000000000',
    '600052',       // MSTORE(0x00)
    '73' + to,
    '600452',       // MSTORE(0x04)
    // STATICCALL(gas, token, argsOff=0, argsLen=0x24, retOff=0, retLen=0x20)
    '6020',         // retLen
    '6000',         // retOff
    '6024',         // argsLen
    '6000',         // argsOff
    '73' + token,
    '5a',           // GAS
    'fa',           // STATICCALL
    '50',           // POP success

    // Return 32 bytes from memory[0x00]
    '6020',         // size
    '6000',         // offset
    'f3',           // RETURN
  ].join('');
}

// ── Check a single token ────────────────────────────────────────────────
async function checkToken(token) {
  const testAmount = 10n ** BigInt(token.decimals); // 1 whole token
  const hugeBalance = testAmount * 1000000n;         // 1M tokens

  const result = {
    ticker: token.ticker,
    address: token.address,
    name: token.name,
    isTaxToken: false,
    taxPercent: null,
    sent: null,
    received: null,
    error: null,
    method: null,
  };

  // balanceOf(SENDER) calldata
  const balanceOfCalldata = '0x70a08231' + SENDER.slice(2).padStart(64, '0');

  // Try mapping slots 0-5 (covers most ERC20 implementations)
  const slotsToTry = [0, 1, 2, 3, 4, 5];

  for (const slot of slotsToTry) {
    try {
      const senderSlot = getBalanceSlot(SENDER, slot);
      const recipientSlot = getBalanceSlot(RECIPIENT, slot);
      const helperSlot = getBalanceSlot(HELPER, slot);

      // First: verify the slot by checking if overriding it changes balanceOf
      const overrideValue = toHexNoLeading(hugeBalance);

      const balanceResult = await rpcCall('eth_call', [
        { to: token.address, data: balanceOfCalldata },
        'latest',
        {
          [token.address]: {
            stateDiff: {
              [senderSlot]: overrideValue,
            },
          },
        },
      ]);

      const reportedBalance = BigInt(balanceResult);
      if (reportedBalance !== hugeBalance) continue; // wrong slot

      // Correct slot found! Now run the transfer simulation via helper contract
      const helperCode = buildHelperCode(token.address, RECIPIENT, testAmount);

      const simResult = await rpcCall('eth_call', [
        { to: HELPER, data: '0x' },
        'latest',
        {
          [token.address]: {
            stateDiff: {
              [helperSlot]: overrideValue,      // give helper tokens
              [recipientSlot]: '0x0',            // zero recipient balance
            },
          },
          [HELPER]: {
            code: helperCode,
          },
        },
      ]);

      if (simResult && simResult.length >= 66) {
        const received = BigInt(simResult.slice(0, 66));
        result.sent = testAmount.toString();
        result.received = received.toString();
        result.method = `slot ${slot}`;

        if (received < testAmount && received > 0n) {
          result.isTaxToken = true;
          const diff = testAmount - received;
          result.taxPercent = Number((diff * 10000n) / testAmount) / 100;
        } else if (received === 0n) {
          // Transfer might have failed (reverted) — could be a tax token that blocks
          // transfers from non-excluded addresses, or the helper approach failed
          result.method = `slot ${slot} (transfer returned 0)`;
        }
        return result;
      }
    } catch {
      continue;
    }
  }

  // No slot worked — couldn't simulate
  result.method = 'simulation-failed';
  result.error = 'Could not find balance storage slot';
  return result;
}

// ── Main ────────────────────────────────────────────────────────────────
async function main() {
  console.log('Tax Token Detection v3 — Transfer Simulation\n');
  const tokens = parseTokens();
  console.log(`Found ${tokens.length} ERC20 tokens on PulseChain\n`);

  const results = [];
  for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
    const batch = tokens.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(batch.map(checkToken));
    results.push(...batchResults);
    process.stdout.write(`\r  Progress: ${Math.min(i + BATCH_SIZE, tokens.length)}/${tokens.length}`);
  }
  console.log('\n');

  // ── Results ─────────────────────────────────────────────────────────
  const taxTokens = results.filter(r => r.isTaxToken);
  const cleanTokens = results.filter(r => !r.isTaxToken && !r.error && r.received !== null);
  const zeroReceived = results.filter(r => !r.isTaxToken && r.received === '0');
  const failed = results.filter(r => r.error);

  taxTokens.sort((a, b) => (b.taxPercent || 0) - (a.taxPercent || 0));

  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  TAX TOKENS (confirmed via transfer simulation): ${taxTokens.length}`);
  console.log('═══════════════════════════════════════════════════════════════\n');

  for (const t of taxTokens) {
    console.log(`  ${t.ticker.padEnd(20)} Tax: ${t.taxPercent}%`);
    console.log(`  ${''.padEnd(20)} Sent: ${t.sent}  Received: ${t.received}`);
    console.log(`  ${''.padEnd(20)} Address: ${t.address}\n`);
  }

  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  CLEAN TOKENS (full amount received): ${cleanTokens.length}`);
  console.log('═══════════════════════════════════════════════════════════════\n');

  for (const t of cleanTokens) {
    process.stdout.write(`  ${t.ticker}  `);
  }
  console.log('\n');

  if (zeroReceived.length > 0) {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`  TRANSFER BLOCKED / ZERO RECEIVED: ${zeroReceived.length}`);
    console.log('  (May be tax tokens that block non-excluded transfers)');
    console.log('═══════════════════════════════════════════════════════════════\n');
    for (const t of zeroReceived) {
      console.log(`  ${t.ticker.padEnd(20)} ${t.address}`);
    }
    console.log('');
  }

  if (failed.length > 0) {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`  COULD NOT SIMULATE: ${failed.length}`);
    console.log('  (Non-standard storage layout — balance slot not found)');
    console.log('═══════════════════════════════════════════════════════════════\n');
    for (const t of failed) {
      console.log(`  ${t.ticker.padEnd(20)} ${t.address}`);
    }
    console.log('');
  }

  console.log(`  Summary: ${taxTokens.length} tax, ${cleanTokens.length} clean, ${zeroReceived.length} blocked, ${failed.length} unknown`);
}

main().catch(console.error);
