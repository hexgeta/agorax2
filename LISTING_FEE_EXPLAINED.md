# Listing Fee - How It Works

## Contract Implementation

The AgoraX contract has a **listing fee** that is charged when placing a new limit order.

### Contract Variables

```solidity
uint256 public listingFee; // Fixed per order amount in PLS (1 PLS = 10^18)
address public feeAddress; // Collects listingFee and protocolFee
uint256 public immutable LISTING_FEES_LIMIT; // Max fee that can be set
```

### How It Works

1. **Reading the Fee**

   ```solidity
   uint256 public listingFee;
   ```

   - This is a public variable, so Solidity auto-generates a getter: `listingFee()`
   - Returns the fee amount in wei (1 PLS = 10^18 wei)

2. **Enforced on Order Creation**

   ```solidity
   function placeOrder(...) external payable {
     require(msg.value >= listingFee, "AgoraX: Insufficient listing fee");

     // Collect listing fee first
     _sendNativeToFeeAddress(listingFee);

     // ... rest of order logic
   }
   ```

3. **Payment Logic**

   - **Selling ERC20 tokens**: `msg.value = listingFee` (fee paid in PLS)
   - **Selling native PLS**: `msg.value = sellAmount + listingFee` (both paid in PLS)

4. **Owner Can Update**
   ```solidity
   function updateListingFee(uint256 _newFee) external onlyOwner {
     require(_newFee <= LISTING_FEES_LIMIT, "AgoraX: Listing fee exceeds limit");
     emit ListingFeeUpdated(listingFee, _newFee);
     listingFee = _newFee;
   }
   ```

## Frontend Implementation

### Bug That Was Fixed

**Problem**: Frontend was calling wrong function name

```typescript
// ❌ WRONG - function doesn't exist
functionName: "getListingFee";
```

**Solution**: Use correct function name (Solidity public variable auto-generates getter)

```typescript
// ✅ CORRECT
functionName: "listingFee";
```

### How Fee is Fetched

```typescript
const fee = (await publicClient.readContract({
  address: contractAddress,
  abi: [
    {
      name: "listingFee",
      type: "function",
      stateMutability: "view",
      inputs: [],
      outputs: [{ name: "", type: "uint256" }],
    },
  ],
  functionName: "listingFee",
})) as bigint;
```

### How Fee is Displayed

```typescript
// Display in UI (convert from wei to PLS)
{
  parseFloat(formatEther(listingFee));
}
PLS;
```

### How Fee is Paid

```typescript
// Calculate value to send with transaction
const valueToSend = isNativeToken(sellToken.a)
  ? sellAmountForOrder + listingFee // Selling PLS: send both
  : listingFee; // Selling ERC20: send fee only

await placeOrder(
  sellToken,
  sellAmount,
  buyTokenIndices,
  buyAmounts,
  expirationTime,
  allOrNothing,
  { value: valueToSend } // ← Fee paid here in msg.value
);
```

## Examples

### Example 1: Selling 100 PLSX for HEX (Listing Fee = 1000 PLS)

```
Your Offer: 100 PLSX
Listing Fee: +1000 PLS (paid separately in native PLS)

Transaction:
- Transfer 100 PLSX to contract
- Send 1000 PLS as msg.value (listing fee)
```

### Example 2: Selling 5000 PLS for PLSX (Listing Fee = 1000 PLS)

```
Your Offer: 5000 PLS
Listing Fee: +1000 PLS
You Pay: 6000 PLS (offer + fee combined)

Transaction:
- Send 6000 PLS as msg.value (5000 for order + 1000 fee)
```

### Example 3: Zero Listing Fee

```
Your Offer: 100 PLSX
Listing Fee: +0 PLS (if owner set fee to 0)

Transaction:
- Transfer 100 PLSX to contract
- msg.value = 0 (no fee required)
```

## Why Fee Might Show 0 PLS

1. **Contract owner set fee to 0** ✅ (intentional)
2. **Wrong function name** ❌ (was the bug - now fixed)
3. **Contract not deployed** ❌ (connection issue)
4. **Wrong contract address** ❌ (config issue)

## Check Current Fee

You can check the current listing fee directly on the contract:

```bash
# Using cast (Foundry)
cast call 0xc8a47F14b1833310E2aC72e4C397b5b14a9FEf8B "listingFee()" --rpc-url https://rpc.pulsechain.com

# Result in wei - divide by 10^18 to get PLS
```

## Owner Functions

Only the contract owner can:

- `updateListingFee(uint256 _newFee)` - Change the listing fee
- `updateFeeAddress(address _newFeeAddress)` - Change where fees go
- Fee changes are capped by `LISTING_FEES_LIMIT` (set at deployment)

## Fee Destination

All listing fees go to:

```solidity
address public feeAddress;
```

This address also receives protocol fees (percentage of trade proceeds).
