'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';
import { parseEther, formatEther, Address } from 'viem';
import { useOTCTrade } from '../hooks/contracts/useOTCTrade';

// Import the contract ABI
const OTC_ABI = [
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
  }
] as const;

export function OTCTrading() {
  const { isConnected } = useAccount();
  const [activeTab, setActiveTab] = useState<'buy' | 'sell'>('buy');
  const [formData, setFormData] = useState({
    tokenAddress: '',
    amount: '',
    price: '',
    expirationDays: '30'
  });

  const { placeOrder, ordersCount } = useOTCTrade();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // Calculate expiration time (current time + days)
      const expirationTime = Math.floor(Date.now() / 1000) + (parseInt(formData.expirationDays) * 24 * 60 * 60);
      
      const sellToken = activeTab === 'sell' ? formData.tokenAddress as Address : '0x000000000000000000000000000000000000dEaD' as Address;
      const sellAmount = activeTab === 'sell' ? parseEther(formData.amount) : parseEther(formData.price);
      
      // For buy orders, we're selling ETH for tokens
      // For sell orders, we're selling tokens for ETH
      const buyTokensIndex = activeTab === 'buy' ? [0n] : [0n]; // Assuming index 0 is ETH
      const buyAmounts = activeTab === 'buy' ? [parseEther(formData.price)] : [parseEther(formData.amount)];

      await placeOrder({
        sellToken,
        sellAmount,
        buyTokensIndex,
        buyAmounts,
        expirationTime: BigInt(expirationTime)
      }, activeTab === 'buy' ? sellAmount : undefined);

      // Reset form
      setFormData({
        tokenAddress: '',
        amount: '',
        price: '',
        expirationDays: '30'
      });
    } catch (error) {
    }
  };

  if (!isConnected) {
    return <p className="text-gray-500  text-black p-4 rounded-lg">Connect wallet to trade</p>;
  }

  return (
    <div className="w-full max-w-2xl">
      <div className="flex gap-4 mb-4">
        <button
          onClick={() => setActiveTab('buy')}
          className={`py-2 px-4 rounded ${
            activeTab === 'buy'
              ? 'bg-green-500 text-white'
              : 'bg-gray-200 text-gray-700'
          }`}
        >
          Buy
        </button>
        <button
          onClick={() => setActiveTab('sell')}
          className={`py-2 px-4 rounded ${
            activeTab === 'sell'
              ? 'bg-red-500 text-white'
              : 'bg-gray-200 text-gray-700'
          }`}
        >
          Sell
        </button>
      </div>

      <div className="bg-white/5 p-6 rounded-lg border-2 border-white/10">
        <h2 className="text-xl font-bold mb-4">
          {activeTab === 'buy' ? 'Buy Orders' : 'Sell Orders'}
        </h2>
        
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Token to {activeTab === 'buy' ? 'Buy' : 'Sell'}
            </label>
            <input
              type="text"
              placeholder="Token Address (0x...)"
              value={formData.tokenAddress}
              onChange={(e) => setFormData(prev => ({ ...prev, tokenAddress: e.target.value }))}
              className="w-full p-2 rounded bg-white/10 border border-white/20"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">Amount</label>
            <input
              type="text"
              placeholder="0.0"
              value={formData.amount}
              onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
              className="w-full p-2 rounded bg-white/10 border border-white/20"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Price in {activeTab === 'buy' ? 'PLS' : 'Token'}
            </label>
            <input
              type="text"
              placeholder="0.0"
              value={formData.price}
              onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
              className="w-full p-2 rounded bg-white/10 border border-white/20"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Expiration (Days)</label>
            <input
              type="number"
              placeholder="30"
              value={formData.expirationDays}
              onChange={(e) => setFormData(prev => ({ ...prev, expirationDays: e.target.value }))}
              className="w-full p-2 rounded bg-white/10 border border-white/20"
              min="1"
              max="365"
            />
          </div>

          <button
            type="submit"
            className={`py-2 px-4 rounded font-bold ${
              activeTab === 'buy'
                ? 'bg-green-500 hover:bg-green-600'
                : 'bg-red-500 hover:bg-red-600'
            } text-white`}
          >
            Place {activeTab === 'buy' ? 'Buy' : 'Sell'} Order
          </button>
        </form>

        <div className="mt-8">
          <h3 className="text-lg font-semibold mb-4">Order Statistics</h3>
          <div className="space-y-4">
            {ordersCount ? (
              <p>Total Orders: {ordersCount.toString()}</p>
            ) : (
              <p className="text-gray-500">No orders found</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
