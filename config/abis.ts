/**
 * Contract ABIs for different contract types
 */

// Bistro/OTC Contract ABI
export const BISTRO_ABI = [
  // Place Order
  {
    "inputs": [
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
            "internalType": "uint256",
            "name": "expirationTime",
            "type": "uint256"
          }
        ],
        "internalType": "struct OTC.OrderDetails",
        "name": "_orderDetails",
        "type": "tuple"
      }
    ],
    "name": "placeOrder",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  // Cancel Order
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "_orderId",
        "type": "uint256"
      }
    ],
    "name": "cancelOrder",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  // Execute Order (Bistro specific)
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "_orderId",
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
    "name": "executeOrder",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  // Redeem Order
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "_orderId",
        "type": "uint256"
      }
    ],
    "name": "redeemOrder",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  // Get Order Counter
  {
    "inputs": [],
    "name": "getOrderCounter",
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
        "name": "_orderId",
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
            "internalType": "struct OTC.UserOrderDetails",
            "name": "userDetails",
            "type": "tuple"
          },
          {
            "components": [
              {
                "internalType": "uint256",
                "name": "orderId",
                "type": "uint256"
              },
              {
                "internalType": "uint256",
                "name": "remainingExecutionPercentage",
                "type": "uint256"
              },
              {
                "internalType": "uint256",
                "name": "redemeedPercentage",
                "type": "uint256"
              },
              {
                "internalType": "uint32",
                "name": "lastUpdateTime",
                "type": "uint32"
              },
              {
                "internalType": "enum OTC.OrderStatus",
                "name": "status",
                "type": "uint8"
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
                    "internalType": "uint256",
                    "name": "expirationTime",
                    "type": "uint256"
                  }
                ],
                "internalType": "struct OTC.OrderDetails",
                "name": "orderDetails",
                "type": "tuple"
              }
            ],
            "internalType": "struct OTC.OrderDetailsWithId",
            "name": "orderDetailsWithId",
            "type": "tuple"
          }
        ],
        "internalType": "struct OTC.CompleteOrderDetails",
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
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
  }
] as const;

// AgoraX Contract ABI
export const AGORAX_ABI = [
  // Place Order (same signature)
  {
    "inputs": [
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
            "internalType": "uint256",
            "name": "expirationTime",
            "type": "uint256"
          }
        ],
        "internalType": "struct AgoraX.OrderDetails",
        "name": "_orderDetails",
        "type": "tuple"
      }
    ],
    "name": "placeOrder",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  // Cancel Order (same signature)
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "_orderId",
        "type": "uint256"
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
        "name": "_orderId",
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
  // Redeem Order (same signature)
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "_orderId",
        "type": "uint256"
      }
    ],
    "name": "redeemOrder",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  // Get Order Counter (same signature)
  {
    "inputs": [],
    "name": "getOrderCounter",
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
  // Get Order Details (different structure than Bistro)
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "_orderId",
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
                "name": "orderId",
                "type": "uint256"
              },
              {
                "internalType": "uint256",
                "name": "remainingFillPercentage",
                "type": "uint256"
              },
              {
                "internalType": "uint256",
                "name": "redeemedPercentage",
                "type": "uint256"
              },
              {
                "internalType": "uint32",
                "name": "lastUpdateTime",
                "type": "uint32"
              },
              {
                "internalType": "enum AgoraX.OrderStatus",
                "name": "status",
                "type": "uint8"
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
                    "internalType": "uint256",
                    "name": "expirationTime",
                    "type": "uint256"
                  }
                ],
                "internalType": "struct AgoraX.OrderDetails",
                "name": "orderDetails",
                "type": "tuple"
              }
            ],
            "internalType": "struct AgoraX.OrderDetailsWithId",
            "name": "orderDetailsWithId",
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
          { "internalType": "uint256", "name": "orderId", "type": "uint256" },
          { "internalType": "uint256", "name": "remainingFillPercentage", "type": "uint256" },
          { "internalType": "uint256", "name": "redeemedPercentage", "type": "uint256" },
          { "internalType": "uint32", "name": "lastUpdateTime", "type": "uint32" },
          { "internalType": "enum AgoraX.OrderStatus", "name": "status", "type": "uint8" },
          {
            "components": [
              { "internalType": "address", "name": "sellToken", "type": "address" },
              { "internalType": "uint256", "name": "sellAmount", "type": "uint256" },
              { "internalType": "uint256[]", "name": "buyTokensIndex", "type": "uint256[]" },
              { "internalType": "uint256[]", "name": "buyAmounts", "type": "uint256[]" },
              { "internalType": "uint256", "name": "expirationTime", "type": "uint256" }
            ],
            "internalType": "struct AgoraX.OrderDetails",
            "name": "orderDetails",
            "type": "tuple"
          }
        ],
        "internalType": "struct AgoraX.OrderDetailsWithId[]",
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
          { "internalType": "uint256", "name": "orderId", "type": "uint256" },
          { "internalType": "uint256", "name": "remainingFillPercentage", "type": "uint256" },
          { "internalType": "uint256", "name": "redeemedPercentage", "type": "uint256" },
          { "internalType": "uint32", "name": "lastUpdateTime", "type": "uint32" },
          { "internalType": "enum AgoraX.OrderStatus", "name": "status", "type": "uint8" },
          {
            "components": [
              { "internalType": "address", "name": "sellToken", "type": "address" },
              { "internalType": "uint256", "name": "sellAmount", "type": "uint256" },
              { "internalType": "uint256[]", "name": "buyTokensIndex", "type": "uint256[]" },
              { "internalType": "uint256[]", "name": "buyAmounts", "type": "uint256[]" },
              { "internalType": "uint256", "name": "expirationTime", "type": "uint256" }
            ],
            "internalType": "struct AgoraX.OrderDetails",
            "name": "orderDetails",
            "type": "tuple"
          }
        ],
        "internalType": "struct AgoraX.OrderDetailsWithId[]",
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
          { "internalType": "uint256", "name": "orderId", "type": "uint256" },
          { "internalType": "uint256", "name": "remainingFillPercentage", "type": "uint256" },
          { "internalType": "uint256", "name": "redeemedPercentage", "type": "uint256" },
          { "internalType": "uint32", "name": "lastUpdateTime", "type": "uint32" },
          { "internalType": "enum AgoraX.OrderStatus", "name": "status", "type": "uint8" },
          {
            "components": [
              { "internalType": "address", "name": "sellToken", "type": "address" },
              { "internalType": "uint256", "name": "sellAmount", "type": "uint256" },
              { "internalType": "uint256[]", "name": "buyTokensIndex", "type": "uint256[]" },
              { "internalType": "uint256[]", "name": "buyAmounts", "type": "uint256[]" },
              { "internalType": "uint256", "name": "expirationTime", "type": "uint256" }
            ],
            "internalType": "struct AgoraX.OrderDetails",
            "name": "orderDetails",
            "type": "tuple"
          }
        ],
        "internalType": "struct AgoraX.OrderDetailsWithId[]",
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
          { "internalType": "uint256", "name": "orderId", "type": "uint256" },
          { "internalType": "uint256", "name": "remainingFillPercentage", "type": "uint256" },
          { "internalType": "uint256", "name": "redeemedPercentage", "type": "uint256" },
          { "internalType": "uint32", "name": "lastUpdateTime", "type": "uint32" },
          { "internalType": "enum AgoraX.OrderStatus", "name": "status", "type": "uint8" },
          {
            "components": [
              { "internalType": "address", "name": "sellToken", "type": "address" },
              { "internalType": "uint256", "name": "sellAmount", "type": "uint256" },
              { "internalType": "uint256[]", "name": "buyTokensIndex", "type": "uint256[]" },
              { "internalType": "uint256[]", "name": "buyAmounts", "type": "uint256[]" },
              { "internalType": "uint256", "name": "expirationTime", "type": "uint256" }
            ],
            "internalType": "struct AgoraX.OrderDetails",
            "name": "orderDetails",
            "type": "tuple"
          }
        ],
        "internalType": "struct AgoraX.OrderDetailsWithId[]",
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
  // Cancel All Expired Orders
  {
    "inputs": [],
    "name": "cancelAllExpiredOrders",
    "outputs": [
      { "internalType": "uint256[]", "name": "cancelledOrderIds", "type": "uint256[]" }
    ],
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

// Helper to get the correct ABI based on contract type
export function getContractABI(contractType: 'BISTRO' | 'AGORAX') {
  return contractType === 'BISTRO' ? BISTRO_ABI : AGORAX_ABI;
}

