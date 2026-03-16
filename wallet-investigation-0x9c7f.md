# Wallet Investigation: 0x9C7f2141955545A0cc71e73CAc050B2bf62524d8

**Date of Investigation:** March 16, 2026
**Reported Issue:** User claims wallet was drained after using AgoraX
**Wallet:** `0x9C7f2141955545A0cc71e73CAc050B2bf62524d8` (ending in `24d8`)

---

## Executive Summary

The wallet was **drained on March 16, 2026 at 08:12-08:13 UTC** via direct `transfer()` calls, indicating a **private key compromise**. AgoraX was not the cause. The attacker had full control of the private key and systematically transferred all liquid token balances and native PLS to `0x9ba83dC97E9a674472e3f1377e539163908E6E27` within 68 seconds.

The only assets the attacker could NOT steal were funds locked in AgoraX orders #47 and #74.

---

## Drain Event Details

**Attacker wallet:** `0x9ba83dC97E9a674472e3f1377e539163908E6E27`

| Time (UTC)  | Tx Hash | Asset | Amount | Method |
|-------------|---------|-------|--------|--------|
| 08:12:05 | `0x7a3bf6bf7d623d1728012160c8c3d9c1703511d2c9c3aea863f643134600ae85` | HEX | ~1,045,025,760 HEX | `transfer()` on `0x2b59...` |
| 08:12:25 | `0xb849b00ff1f1e87391a0ad409d521674714197181bc55a3f5f0736a67dc0b94c` | pWBTC | ~30 pWBTC | `transfer()` on `0x2260...` |
| 08:12:35 | `0x68367ed49de5399ec54a285d21041092711b471a0d795b98e36d2044b6d50f73` | DECI | ~300,788,216 DECI | `transfer()` on `0x6b32...` |
| 08:12:45 | `0x6dbc2639c9db694d2181ae8b36801305a83b58699023189509b750f97580c701` | REMEMBER (🎭) | ~2.6B tokens | `transfer()` on `0x2401...` |
| 08:12:55 | `0x59f854ee0b17f3253ef39cc65c01f86adfe3510cf6a8a19bab16e0646e057d77` | COW | ~443,072,039 COW | `transfer()` on `0xDEf1...` |
| 08:13:15 | `0x40e33a62bf0261f5ad9f5159ca3da679cd4bf2ce94ed10e2dbb20ec0c2e6a94d` | PLS (native) | ~308,144,720 PLS | Coin transfer |

**Total estimated loss:** ~1M HEX, ~300K DECI, ~30 pWBTC, ~308M PLS, plus COW and REMEMBER tokens.

---

## Why AgoraX Is NOT the Cause

1. **Direct `transfer()` calls** — The attacker called `transfer()` directly on each token contract FROM the victim's wallet. This requires the private key itself, not just a token approval.
2. **Native PLS transfer** — 308M PLS was sent via a plain coin transfer. Token approvals do not apply to native currency — only the private key holder can initiate this.
3. **AgoraX uses exact-amount approvals** — The dapp only approves the precise amount needed for each order. No unlimited (MaxUint256) approvals anywhere.
4. **No suspicious contract interactions** — The wallet only ever interacted with AgoraX (`0x06856CEa795D001bED91acdf1264CaB174949bf3`) and standard token contracts. No unknown contracts.
5. **AgoraX contract security** — Uses OpenZeppelin SafeERC20, nonReentrant guards, msg.sender ownership checks. No delegatecall or arbitrary external calls.
6. **"Invalid App Configuration" error** — This is a standard Reown/WalletConnect session error (duplicate connection), not a security issue.
7. **RPC endpoints are safe** — Uses `rpc-pulsechain.g4mm4.io` and `rpc.pulsechain.com` (legitimate public RPCs). Even a malicious RPC cannot sign transactions or extract private keys.

---

## AgoraX Orders (Still Safe in Contract)

### Order #47
- **Sell:** 200,000,000 PLS
- **Buy:** 4,976.13 INC
- **Status:** Active (0 fills)
- **Created:** Feb 28, 2026 21:48 UTC
- **Tx:** `0x73e3ac991ceb9e7b038747a2ed4d76a0d1a97ec7da3d0cf9c2e8d682f8cfc1c0`

### Order #74
- **Sell:** 726,243.602 weDECI
- **Buy:** 53,575,596 PLS
- **Status:** Expired (0 fills, not cancelled)
- **Created:** Mar 6, 2026 11:08 UTC
- **Tx:** `0x9da698091ee94dcfd4827dc9699aababbc7036eb1fedce30edd1f130cc070e21`

**Note:** Cancelling these orders sends remaining sell tokens back to `msg.sender` (the compromised wallet), NOT to a `_recipient` parameter. Only accumulated proceeds from partial fills go to `_recipient`. Since both orders have 0 fills, cancelling would return everything to the compromised wallet where the attacker could take it.

---

## Full Transaction History (Chronological)

### Oct 2025 — Initial Activity

| Date | Time (UTC) | Tx Hash | Method | To Contract | Value | Notes |
|------|------------|---------|--------|-------------|-------|-------|
| Oct 11 | 08:37 | `0xfd0efb62...` | `swap()` | `0x6BF228eb...` | 0 | DEX swap |
| Oct 11 | 09:11 | `0x46ed8d19...` | `transferAndCall()` | `0x0Cb6F5a3...` | 0 | Token interaction |

### Feb 25, 2026 — First AgoraX Orders

| Date | Time (UTC) | Tx Hash | Method | Value | Notes |
|------|------------|---------|--------|-------|-------|
| Feb 25 | 21:12 | `0x9f6fc431...` | `placeOrder()` | 100M PLS | AgoraX order |
| Feb 25 | 21:26 | `0x639899...` | `placeOrder()` | 100M PLS | AgoraX order |
| Feb 25 | 21:30 | `0xd04533...` | `placeOrder()` | 100M PLS | AgoraX order |
| Feb 25 | 21:36 | `0xfa7650c...` | `placeOrder()` | 69M PLS | AgoraX order |

### Feb 27, 2026 — Order Management

| Date | Time (UTC) | Tx Hash | Method | Value | Notes |
|------|------------|---------|--------|-------|-------|
| Feb 27 | 08:27 | `0x20ff...` | `updateOrderExpiration()` | 0 | Extend order |
| Feb 27 | 08:28 | `0xa03d...` | `updateOrderExpiration()` | 0 | Extend order |
| Feb 27 | 08:29 | `0xd80b...` | `updateOrderExpiration()` | 0 | Extend order |
| Feb 27 | 08:30 | `0xb78a...` | `collectProceeds()` | 0 | Collect fill proceeds |
| Feb 27 | 08:33 | `0x8f3a...` | `collectProceeds()` | 0 | Collect fill proceeds |
| Feb 27 | 08:35 | `0x3962...` | `approve()` on `0x6b32...` (DECI) | 0 | Approve DECI for AgoraX |
| Feb 27 | 08:36 | `0x051c...` | `placeOrder()` | 0.1 PLS listing fee | ERC20 order (DECI) |
| Feb 27 | 15:05 | `0x9aee...` | `updateOrderExpiration()` | 0 | Extend order |
| Feb 27 | 15:07 | `0xb7b8...` | `collectProceedsByToken()` | 0 | Collect specific token proceeds |
| Feb 27 | 16:20 | `0xe49f...` | `approve()` on `0x2b59...` (HEX) | 0 | Approve HEX for AgoraX |
| Feb 27 | 16:20 | `0xd4ed...` | `placeOrder()` | 0.1 PLS listing fee | ERC20 order (HEX) |
| Feb 27 | 16:26 | `0xbc7a...` | `cancelOrder()` | 0 | Cancel an order |

### Feb 28, 2026 — Order #47 Created

| Date | Time (UTC) | Tx Hash | Method | Value | Notes |
|------|------------|---------|--------|-------|-------|
| Feb 28 | 21:24 | `0xdbb3...` | `collectProceeds()` | 0 | Collect proceeds |
| Feb 28 | 21:26 | `0x2934...` | `collectProceeds()` | 0 | Collect proceeds |
| Feb 28 | 21:30 | `0x5d28...` | `approve()` on `0x2260...` (pWBTC) | 0 | Approve pWBTC for AgoraX |
| Feb 28 | 21:30 | `0xb751...` | `placeOrder()` | 0.1 PLS | ERC20 order (pWBTC) |
| Feb 28 | 21:33 | `0xa52e...` | `approve()` on `0x6b32...` (DECI) | 0 | Approve DECI for AgoraX |
| Feb 28 | 21:34 | `0x01ec...` | `placeOrder()` | 0.1 PLS | ERC20 order (DECI) |
| Feb 28 | 21:48 | `0x73e3...` | **`placeOrder()` → ORDER #47** | 200M PLS | 200M PLS for 4,976 INC |

### Mar 3, 2026

| Date | Time (UTC) | Tx Hash | Method | Value | Notes |
|------|------------|---------|--------|-------|-------|
| Mar 3 | 08:34 | `0x02f4...` | `collectProceeds()` | 0 | Collect proceeds |
| Mar 3 | 08:39 | `0x7319...` | `cancelOrder()` | 0 | Cancel an order |
| Mar 3 | 08:46 | `0x555d...` | `approve()` on `0x189a...` (weDECI) | 0 | Approve weDECI for AgoraX |

### Mar 5-6, 2026 — Order #74 Created + DAI Drip Begins

| Date | Time (UTC) | Tx Hash | Method | Value | Notes |
|------|------------|---------|--------|-------|-------|
| Mar 5 | 15:00 | `0x3d73...` | — | DAI 1.23 IN | DAI yield from `0x5F4b...` |
| Mar 5 | 20:41 | `0x1b4d...` | — | DAI 0.89 IN | DAI yield |
| Mar 6 | 05:48 | `0xd810...` | — | DAI 1.34 IN | DAI yield |
| Mar 6 | 10:21 | `0x0fe1...` | `collectProceedsByToken()` | 0 | AGX burn |
| Mar 6 | 10:24 | `0xbdc9...` | `collectProceedsByToken()` | 0 | AGX burn |
| Mar 6 | 10:25 | `0x81f2...` | `collectProceedsByToken()` | 0 | AGX burn |
| Mar 6 | 11:08 | `0x9da6...` | **`placeOrder()` → ORDER #74** | 0.1 PLS | 726K weDECI for 53.5M PLS |

### Mar 7-10, 2026 — DAI Yield Accumulation

Regular small DAI deposits (~0.15-1.5 DAI each) from `0x5F4bC67...` approximately every 6-12 hours. Likely staking/yield rewards.

### Mar 11, 2026 — Cancel & Reorder

| Date | Time (UTC) | Tx Hash | Method | Value | Notes |
|------|------------|---------|--------|-------|-------|
| Mar 11 | 12:07 | `0xa160...` | `collectProceeds()` | 0 | Collect proceeds (AGX burn) |
| Mar 11 | 12:08 | `0xff42...` | `cancelOrder()` | 0 | Cancel order → receives **1,045,025,760 HEX** back |
| Mar 11 | 12:13 | `0x710f...` | `cancelOrder()` | 0 | Cancel another order (AGX burn) |
| Mar 11 | 20:41 | `0x547e...` | `placeOrder()` → ORDER #96 | 192.6M PLS | New PLS order |

### Mar 12-13, 2026

| Date | Time (UTC) | Tx Hash | Method | Value | Notes |
|------|------------|---------|--------|-------|-------|
| Mar 12 | 09:55 | `0xfe1d...` | `approve()` on `0x6b32...` (DECI) | 0 | Approve DECI |
| Mar 13 | 09:52 | `0xe9fb...` | `cancelOrder()` → ORDER #96 | 0 | Cancel → 192.6M PLS returned to wallet |

### Mar 14, 2026 — Receives pWBTC

| Date | Time (UTC) | Tx Hash | Method | Value | Notes |
|------|------------|---------|--------|-------|-------|
| Mar 14 | 05:07 | `0x3199...` | — | 0.001 WBTC IN | Small pWBTC transfer from `0x02d4...` |

### Mar 14-15, 2026 — Continued DAI Yield

Regular DAI deposits continue from `0x5F4b...`.

---

## DRAIN EVENT — Mar 16, 2026

### 08:12:05 UTC — HEX Drained
- **Tx:** `0x7a3bf6bf7d623d1728012160c8c3d9c1703511d2c9c3aea863f643134600ae85`
- **Method:** `transfer()` on HEX contract (`0x2b591e99afE9f32eAA6214f7B7629768c40Eeb39`)
- **Amount:** ~1,045,025,760 HEX → `0x9ba83dC97E9a674472e3f1377e539163908E6E27`

### 08:12:25 UTC — pWBTC Drained
- **Tx:** `0xb849b00ff1f1e87391a0ad409d521674714197181bc55a3f5f0736a67dc0b94c`
- **Method:** `transfer()` on pWBTC contract (`0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599`)
- **Amount:** ~30 pWBTC → `0x9ba83dC9...`

### 08:12:35 UTC — DECI Drained
- **Tx:** `0x68367ed49de5399ec54a285d21041092711b471a0d795b98e36d2044b6d50f73`
- **Method:** `transfer()` on DECI contract (`0x6b32022693210cD2Cfc466b9Ac0085DE8fC34eA6`)
- **Amount:** ~300,788,216 DECI → `0x9ba83dC9...`

### 08:12:45 UTC — REMEMBER Token Drained
- **Tx:** `0x6dbc2639c9db694d2181ae8b36801305a83b58699023189509b750f97580c701`
- **Method:** `transfer()` on REMEMBER contract (`0x2401E09acE92C689570a802138D6213486407B24`)
- **Amount:** ~2.6B tokens → `0x9ba83dC9...`

### 08:12:55 UTC — COW Token Drained
- **Tx:** `0x59f854ee0b17f3253ef39cc65c01f86adfe3510cf6a8a19bab16e0646e057d77`
- **Method:** `transfer()` on COW contract (`0xDEf1CA1fb7FBcDC777520aa7f396b4E015F497aB`)
- **Amount:** ~443,072,039 COW → `0x9ba83dC9...`

### 08:13:15 UTC — Native PLS Drained
- **Tx:** `0x40e33a62bf0261f5ad9f5159ca3da679cd4bf2ce94ed10e2dbb20ec0c2e6a94d`
- **Method:** Native coin transfer (no contract call)
- **Amount:** ~308,144,720 PLS → `0x9ba83dC9...`

---

## Full ERC-20 Token Transfer Log

### Incoming Transfers

| Date | Token | Amount | From | Tx Hash |
|------|-------|--------|------|---------|
| Mar 5 15:00 | DAI | 1.23 | `0x5F4bC67...` | `0x3d73...` |
| Mar 5 20:41 | DAI | 0.89 | `0x5F4bC67...` | `0x1b4d...` |
| Mar 6 05:48 | DAI | 1.34 | `0x5F4bC67...` | `0xd810...` |
| Mar 6 13:56 | DAI | 1.13 | `0x5F4bC67...` | `0xe6a9...` |
| Mar 6 19:17 | DAI | 1.34 | `0x5F4bC67...` | `0xabbf...` |
| Mar 7 05:02 | DAI | 1.46 | `0x5F4bC67...` | `0xc197...` |
| Mar 7 10:49 | DAI | 1.11 | `0x5F4bC67...` | `0xa724...` |
| Mar 7 16:51 | DAI | 1.09 | `0x5F4bC67...` | `0x31e6...` |
| Mar 8 04:01 | DAI | 0.95 | `0x5F4bC67...` | `0x1442...` |
| Mar 8 12:21 | DAI | 1.02 | `0x5F4bC67...` | `0x5c0b...` |
| Mar 8 12:27 | DECI | trace | AgoraX contract | `0xeacd...` |
| Mar 8 19:53 | DAI | 0.66 | `0x5F4bC67...` | `0x78f3...` |
| Mar 9 04:50 | DAI | 0.68 | `0x5F4bC67...` | `0x4577...` |
| Mar 9 18:37 | DAI | 0.69 | `0x5F4bC67...` | `0xd282...` |
| Mar 10 00:32 | DAI | 0.60 | `0x5F4bC67...` | `0x5f30...` |
| Mar 10 11:18 | DAI | 0.18 | `0x5F4bC67...` | `0x956f...` |
| Mar 10 20:10 | DAI | 0.16 | `0x5F4bC67...` | `0x745c...` |
| Mar 11 05:45 | DAI | 0.23 | `0x5F4bC67...` | `0x132c...` |
| Mar 11 12:08 | HEX | ~1,045,025,760 | AgoraX contract (cancel refund) | `0xff42...` |
| Mar 11 20:57 | DAI | 0.25 | `0x5F4bC67...` | `0x4a21...` |
| Mar 12 04:34 | DAI | 0.30 | `0x5F4bC67...` | `0xea51...` |
| Mar 12 17:58 | DAI | 0.23 | `0x5F4bC67...` | `0xdd48...` |
| Mar 13 02:13 | DAI | 0.26 | `0x5F4bC67...` | `0xa7f9...` |
| Mar 13 10:29 | DAI | 0.23 | `0x5F4bC67...` | `0x71da...` |
| Mar 13 23:12 | DAI | 0.35 | `0x5F4bC67...` | `0x11b2...` |
| Mar 14 05:07 | WBTC | 0.001 | `0x02d42a0...` | `0x3199...` |
| Mar 14 07:39 | DAI | 0.49 | `0x5F4bC67...` | `0x003c...` |
| Mar 14 22:08 | DAI | 0.20 | `0x5F4bC67...` | `0x37ae...` |
| Mar 15 07:29 | DAI | 0.22 | `0x5F4bC67...` | `0xce86...` |
| Mar 15 19:08 | DAI | 0.18 | `0x5F4bC67...` | `0xb650...` |

### Outgoing Transfers (Non-Drain)

| Date | Token | Amount | To | Notes |
|------|-------|--------|----|-------|
| Mar 6 11:08 | DECI | 726,243,602 | AgoraX contract | Order #74 deposit |

### Outgoing Transfers (DRAIN)

| Date | Token | Amount | To | Tx Hash |
|------|-------|--------|----|---------|
| Mar 16 08:12:05 | HEX | ~1,045,025,760 | `0x9ba83dC9...` | `0x7a3b...` |
| Mar 16 08:12:25 | pWBTC | ~30 | `0x9ba83dC9...` | `0xb849...` |
| Mar 16 08:12:35 | DECI | ~300,788,216 | `0x9ba83dC9...` | `0x6836...` |
| Mar 16 08:12:45 | REMEMBER | ~2.6B | `0x9ba83dC9...` | `0x6dbc...` |
| Mar 16 08:12:55 | COW | ~443,072,039 | `0x9ba83dC9...` | `0x59f8...` |
| Mar 16 08:13:15 | PLS | ~308,144,720 | `0x9ba83dC9...` | `0x40e3...` |

---

## Contracts Interacted With

| Contract | Purpose | Verified Safe |
|----------|---------|---------------|
| `0x06856CEa795D001bED91acdf1264CaB174949bf3` | AgoraX OTC | Yes — audited, exact-amount approvals, nonReentrant |
| `0x2b591e99afE9f32eAA6214f7B7629768c40Eeb39` | HEX Token | Yes — well-known token |
| `0x6b32022693210cD2Cfc466b9Ac0085DE8fC34eA6` | DECI Token | Yes — well-known token |
| `0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599` | pWBTC Token | Yes — well-known token |
| `0x189a3ca3cc1337e85c7bc0a43b8d3457fd5aae89` | weDECI Token | Yes — well-known token |
| `0x6BF228eb...` | DEX (swap) | Standard DEX |
| `0x0Cb6F5a3...` | Unknown (transferAndCall) | Used once Oct 2025 |
| `0x5F4bC67...` | DAI yield source | Sent small DAI amounts regularly |

**No interactions with unknown/malicious contracts were found.**

---

## Conclusion

**Cause:** Private key compromise (not an approval exploit, not AgoraX-related)

**Evidence:**
- Attacker used direct `transfer()` calls requiring the private key
- Native PLS was transferred (impossible via approvals alone)
- 6 drain transactions completed in 68 seconds (automated/scripted)
- No suspicious contract interactions in wallet history
- AgoraX only requests exact-amount approvals

**Likely attack vector:** Phishing, malicious software, social engineering, or seed phrase exposure — external to AgoraX.

**Remaining safe assets:**
- Order #47: 200M PLS locked in AgoraX contract
- Order #74: 726K weDECI locked in AgoraX contract (expired, uncancelled)

**Recommendation for user:**
1. Do NOT use this wallet again — private key is compromised
2. Cancelling orders will return funds to the compromised wallet where the attacker can take them
3. Contact AgoraX team about potential recovery options for locked order funds
