'use client'

import { useAccount, useConnect, useDisconnect } from 'wagmi'
import { useAppKit } from '@reown/appkit/react'
import { useTransaction } from '@/context/TransactionContext'

export const ConnectButton = () => {
  const { isConnected, address } = useAccount()
  const { open } = useAppKit()
  const { isTransactionPending } = useTransaction()

  if (isConnected && address) {
    return (
      <button
        onClick={() => open()}
        disabled={isTransactionPending}
        className={`px-8 py-3 rounded-full font-semibold transition-colors ${
          isTransactionPending 
            ? 'bg-gray-300 text-gray-600 cursor-not-allowed' 
            : 'bg-white text-black hover:bg-gray-200'
        }`}
      >
        {isTransactionPending ? (
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-gray-600 border-t-transparent rounded-full animate-spin"></div>
            <span>Pending...</span>
          </div>
        ) : (
          `${address.slice(0, 6)}...${address.slice(-4)}`
        )}
      </button>
    )
  }

  return (
    <button
      onClick={() => open()}
      className="px-8 py-3 bg-white text-black rounded-full font-semibold hover:bg-gray-200 transition-colors"
    >
      Connect Wallet
    </button>
  )
}
