/**
 * AgoraX Contract ABI
 * 
 * This file contains the ABI for the AgoraX smart contract.
 * AgoraX is a decentralized limit order platform with simplified fee structure.
 */

// AgoraX Contract ABI
export const AGORAX_ABI = [
  // Place Order - AgoraX_final.sol version (individual parameters)
  {
    "inputs": [
          {
            "internalType": "address",
        "name": "_sellToken",
            "type": "address"
          },
          {
            "internalType": "uint256",
        "name": "_sellAmount",
            "type": "uint256"
          },
          {
            "internalType": "uint256[]",
        "name": "_buyTokensIndex",
            "type": "uint256[]"
          },
          {
            "internalType": "uint256[]",
        "name": "_buyAmounts",
            "type": "uint256[]"
          },
          {
        "internalType": "uint64",
        "name": "_expirationTime",
        "type": "uint64"
      },
      {
        "internalType": "bool",
        "name": "_allOrNothing",
        "type": "bool"
      }
    ],
    "name": "placeOrder",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  // Cancel Order (updated to require recipient)
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "_orderID",
        "type": "uint256"
      },
      {
        "internalType": "address",
        "name": "_recipient",
        "type": "address"
      }
    ],
    "name": "cancelOrder",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  // Fill Order (AgoraX specific - replaces executeOrder)
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "_orderID",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "_buyTokenIndexInOrder",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "_buyAmount",
        "type": "uint256"
      }
    ],
    "name": "fillOrder",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  // Collect Proceeds (renamed from redeemOrder, now requires recipient)
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "_orderID",
        "type": "uint256"
      },
      {
        "internalType": "address",
        "name": "_recipient",
        "type": "address"
      }
    ],
    "name": "collectProceeds",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  // View Collectable Proceeds (NEW in AgoraX_final.sol)
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "_orderID",
        "type": "uint256"
      }
    ],
    "name": "viewCollectableProceeds",
    "outputs": [
      {
        "internalType": "address[]",
        "name": "buyTokens",
        "type": "address[]"
      },
      {
        "internalType": "uint256[]",
        "name": "buyAmounts",
        "type": "uint256[]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  // Get Total Order Count (renamed from getOrderCounter)
  {
    "inputs": [],
    "name": "getTotalOrderCount",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  // Get Order Details
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "_orderID",
        "type": "uint256"
      }
    ],
    "name": "getOrderDetails",
    "outputs": [
      {
        "components": [
          {
            "components": [
              {
                "internalType": "uint256",
                "name": "orderIndex",
                "type": "uint256"
              },
              {
                "internalType": "address",
                "name": "orderOwner",
                "type": "address"
              }
            ],
            "internalType": "struct AgoraX.UserOrderDetails",
            "name": "userDetails",
            "type": "tuple"
          },
          {
            "components": [
              {
                "internalType": "uint256",
                "name": "orderID",
                "type": "uint256"
              },
              {
                "internalType": "uint256",
                "name": "remainingSellAmount",
                "type": "uint256"
              },
              {
                "internalType": "uint256",
                "name": "redeemedSellAmount",
                "type": "uint256"
              },
              {
                "internalType": "uint64",
                "name": "lastUpdateTime",
                "type": "uint64"
              },
              {
                "internalType": "enum AgoraX.OrderStatus",
                "name": "status",
                "type": "uint8"
              },
              {
                "internalType": "uint256",
                "name": "creationProtocolFee",
                "type": "uint256"
              },
              {
                "components": [
                  {
                    "internalType": "address",
                    "name": "sellToken",
                    "type": "address"
                  },
                  {
                    "internalType": "uint256",
                    "name": "sellAmount",
                    "type": "uint256"
                  },
                  {
                    "internalType": "uint256[]",
                    "name": "buyTokensIndex",
                    "type": "uint256[]"
                  },
                  {
                    "internalType": "uint256[]",
                    "name": "buyAmounts",
                    "type": "uint256[]"
                  },
                  {
                    "internalType": "uint64",
                    "name": "expirationTime",
                    "type": "uint64"
                  },
                  {
                    "internalType": "bool",
                    "name": "allOrNothing",
                    "type": "bool"
                  }
                ],
                "internalType": "struct AgoraX.OrderDetails",
                "name": "orderDetails",
                "type": "tuple"
              }
            ],
            "internalType": "struct AgoraX.OrderDetailsWithID",
            "name": "orderDetailsWithID",
            "type": "tuple"
          }
        ],
        "internalType": "struct AgoraX.CompleteOrderDetails",
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  // View User Open Orders
  {
    "inputs": [
      { "internalType": "address", "name": "_user", "type": "address" },
      { "internalType": "uint256", "name": "_cursor", "type": "uint256" },
      { "internalType": "uint256", "name": "_size", "type": "uint256" }
    ],
    "name": "viewUserOpenOrders",
    "outputs": [
      {
        "components": [
          { "internalType": "uint256", "name": "orderID", "type": "uint256" },
          { "internalType": "uint256", "name": "remainingSellAmount", "type": "uint256" },
          { "internalType": "uint256", "name": "redeemedSellAmount", "type": "uint256" },
          { "internalType": "uint64", "name": "lastUpdateTime", "type": "uint64" },
          { "internalType": "enum AgoraX.OrderStatus", "name": "status", "type": "uint8" },
          { "internalType": "uint256", "name": "creationProtocolFee", "type": "uint256" },
          {
            "components": [
              { "internalType": "address", "name": "sellToken", "type": "address" },
              { "internalType": "uint256", "name": "sellAmount", "type": "uint256" },
              { "internalType": "uint256[]", "name": "buyTokensIndex", "type": "uint256[]" },
              { "internalType": "uint256[]", "name": "buyAmounts", "type": "uint256[]" },
              { "internalType": "uint64", "name": "expirationTime", "type": "uint64" },
              { "internalType": "bool", "name": "allOrNothing", "type": "bool" }
            ],
            "internalType": "struct AgoraX.OrderDetails",
            "name": "orderDetails",
            "type": "tuple"
          }
        ],
        "internalType": "struct AgoraX.OrderDetailsWithID[]",
        "name": "",
        "type": "tuple[]"
      },
      { "internalType": "uint256", "name": "", "type": "uint256" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  // View User Expired Orders
  {
    "inputs": [
      { "internalType": "address", "name": "_user", "type": "address" },
      { "internalType": "uint256", "name": "_cursor", "type": "uint256" },
      { "internalType": "uint256", "name": "_size", "type": "uint256" }
    ],
    "name": "viewUserExpiredOrders",
    "outputs": [
      {
        "components": [
          { "internalType": "uint256", "name": "orderID", "type": "uint256" },
          { "internalType": "uint256", "name": "remainingSellAmount", "type": "uint256" },
          { "internalType": "uint256", "name": "redeemedSellAmount", "type": "uint256" },
          { "internalType": "uint64", "name": "lastUpdateTime", "type": "uint64" },
          { "internalType": "enum AgoraX.OrderStatus", "name": "status", "type": "uint8" },
          { "internalType": "uint256", "name": "creationProtocolFee", "type": "uint256" },
          {
            "components": [
              { "internalType": "address", "name": "sellToken", "type": "address" },
              { "internalType": "uint256", "name": "sellAmount", "type": "uint256" },
              { "internalType": "uint256[]", "name": "buyTokensIndex", "type": "uint256[]" },
              { "internalType": "uint256[]", "name": "buyAmounts", "type": "uint256[]" },
              { "internalType": "uint64", "name": "expirationTime", "type": "uint64" },
              { "internalType": "bool", "name": "allOrNothing", "type": "bool" }
            ],
            "internalType": "struct AgoraX.OrderDetails",
            "name": "orderDetails",
            "type": "tuple"
          }
        ],
        "internalType": "struct AgoraX.OrderDetailsWithID[]",
        "name": "",
        "type": "tuple[]"
      },
      { "internalType": "uint256", "name": "", "type": "uint256" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  // View User Completed Orders
  {
    "inputs": [
      { "internalType": "address", "name": "_user", "type": "address" },
      { "internalType": "uint256", "name": "_cursor", "type": "uint256" },
      { "internalType": "uint256", "name": "_size", "type": "uint256" }
    ],
    "name": "viewUserCompletedOrders",
    "outputs": [
      {
        "components": [
          { "internalType": "uint256", "name": "orderID", "type": "uint256" },
          { "internalType": "uint256", "name": "remainingSellAmount", "type": "uint256" },
          { "internalType": "uint256", "name": "redeemedSellAmount", "type": "uint256" },
          { "internalType": "uint64", "name": "lastUpdateTime", "type": "uint64" },
          { "internalType": "enum AgoraX.OrderStatus", "name": "status", "type": "uint8" },
          { "internalType": "uint256", "name": "creationProtocolFee", "type": "uint256" },
          {
            "components": [
              { "internalType": "address", "name": "sellToken", "type": "address" },
              { "internalType": "uint256", "name": "sellAmount", "type": "uint256" },
              { "internalType": "uint256[]", "name": "buyTokensIndex", "type": "uint256[]" },
              { "internalType": "uint256[]", "name": "buyAmounts", "type": "uint256[]" },
              { "internalType": "uint64", "name": "expirationTime", "type": "uint64" },
              { "internalType": "bool", "name": "allOrNothing", "type": "bool" }
            ],
            "internalType": "struct AgoraX.OrderDetails",
            "name": "orderDetails",
            "type": "tuple"
          }
        ],
        "internalType": "struct AgoraX.OrderDetailsWithID[]",
        "name": "",
        "type": "tuple[]"
      },
      { "internalType": "uint256", "name": "", "type": "uint256" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  // View User Cancelled Orders
  {
    "inputs": [
      { "internalType": "address", "name": "_user", "type": "address" },
      { "internalType": "uint256", "name": "_cursor", "type": "uint256" },
      { "internalType": "uint256", "name": "_size", "type": "uint256" }
    ],
    "name": "viewUserCancelledOrders",
    "outputs": [
      {
        "components": [
          { "internalType": "uint256", "name": "orderID", "type": "uint256" },
          { "internalType": "uint256", "name": "remainingSellAmount", "type": "uint256" },
          { "internalType": "uint256", "name": "redeemedSellAmount", "type": "uint256" },
          { "internalType": "uint64", "name": "lastUpdateTime", "type": "uint64" },
          { "internalType": "enum AgoraX.OrderStatus", "name": "status", "type": "uint8" },
          { "internalType": "uint256", "name": "creationProtocolFee", "type": "uint256" },
          {
            "components": [
              { "internalType": "address", "name": "sellToken", "type": "address" },
              { "internalType": "uint256", "name": "sellAmount", "type": "uint256" },
              { "internalType": "uint256[]", "name": "buyTokensIndex", "type": "uint256[]" },
              { "internalType": "uint256[]", "name": "buyAmounts", "type": "uint256[]" },
              { "internalType": "uint64", "name": "expirationTime", "type": "uint64" },
              { "internalType": "bool", "name": "allOrNothing", "type": "bool" }
            ],
            "internalType": "struct AgoraX.OrderDetails",
            "name": "orderDetails",
            "type": "tuple"
          }
        ],
        "internalType": "struct AgoraX.OrderDetailsWithID[]",
        "name": "",
        "type": "tuple[]"
      },
      { "internalType": "uint256", "name": "", "type": "uint256" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  // Get User Orders Length
  {
    "inputs": [
      { "internalType": "address", "name": "_user", "type": "address" }
    ],
    "name": "getUserOrdersLength",
    "outputs": [
      { "internalType": "uint256", "name": "", "type": "uint256" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  // Get User Expired Orders Count
  {
    "inputs": [
      { "internalType": "address", "name": "_user", "type": "address" }
    ],
    "name": "getUserExpiredOrdersCount",
    "outputs": [
      { "internalType": "uint256", "name": "", "type": "uint256" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  // Cancel All Expired Orders (updated to require recipient)
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "_recipient",
        "type": "address"
      }
    ],
    "name": "cancelAllExpiredOrders",
    "outputs": [
      { "internalType": "uint256[]", "name": "cancelledOrderIds", "type": "uint256[]" }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  // Update Order Expiration
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "_orderID",
        "type": "uint256"
      },
      {
        "internalType": "uint64",
        "name": "_newExpiration",
        "type": "uint64"
      }
    ],
    "name": "updateOrderExpiration",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  // View functions
  {
    "inputs": [],
    "name": "name",
    "outputs": [{ "internalType": "string", "name": "", "type": "string" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "symbol",
    "outputs": [{ "internalType": "string", "name": "", "type": "string" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "totalSupply",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "owner",
    "outputs": [{ "internalType": "address", "name": "", "type": "address" }],
    "stateMutability": "view",
    "type": "function"
  },
  // Get listing fee
  {
    "inputs": [],
    "name": "listingFee",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  // Get protocol fee
  {
    "inputs": [],
    "name": "protocolFee",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  // Whitelist functions
  {
    "inputs": [{ "internalType": "address", "name": "_address", "type": "address" }],
    "name": "isWhitelisted",
    "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "viewCountWhitelisted",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "_index", "type": "uint256" }],
    "name": "getTokenInfoAt",
    "outputs": [
      { "internalType": "address", "name": "", "type": "address" },
      { "internalType": "bool", "name": "", "type": "bool" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "cursor", "type": "uint256" },
      { "internalType": "uint256", "name": "size", "type": "uint256" }
    ],
    "name": "viewWhitelisted",
    "outputs": [
      {
        "components": [
          { "internalType": "address", "name": "tokenAddress", "type": "address" },
          { "internalType": "bool", "name": "isActive", "type": "bool" }
        ],
        "internalType": "struct AgoraX.TokenInfo[]",
        "name": "",
        "type": "tuple[]"
      },
      { "internalType": "uint256", "name": "", "type": "uint256" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "cursor", "type": "uint256" },
      { "internalType": "uint256", "name": "size", "type": "uint256" }
    ],
    "name": "viewActiveWhitelisted",
    "outputs": [
      { "internalType": "address[]", "name": "", "type": "address[]" },
      { "internalType": "uint256", "name": "", "type": "uint256" }
    ],
    "stateMutability": "view",
    "type": "function"
  }
] as const;

// Export the AgoraX ABI as the default contract ABI
export const CONTRACT_ABI = AGORAX_ABI;

// Helper function for backwards compatibility
export function getContractABI() {
  return AGORAX_ABI;
}

