'use client'

import { useState } from 'react'
import { useAccount, useConnect, useDisconnect } from 'wagmi'
import { useAppKit } from '@reown/appkit/react'
import { useTransaction } from '@/context/TransactionContext'
import { DisclaimerDialog } from './DisclaimerDialog'

export const ConnectButton = () => {
  const { isConnected, address } = useAccount()
  const { open } = useAppKit()
  const { isTransactionPending } = useTransaction()
  const [showDisclaimer, setShowDisclaimer] = useState(false)

  const handleConnectClick = () => {
    // Check if user has already accepted the disclaimer
    const hasAccepted = localStorage.getItem('disclaimer-accepted')
    
    if (!hasAccepted) {
      // Show disclaimer first
      setShowDisclaimer(true)
    } else {
      // Open wallet modal directly
      open()
    }
  }

  const handleDisclaimerAccept = () => {
    localStorage.setItem('disclaimer-accepted', 'true')
    setShowDisclaimer(false)
    // Open wallet modal after accepting
    open()
  }

  if (isConnected && address) {
    return (
      <button
        onClick={() => open()}
        disabled={isTransactionPending}
        className={`px-4 md:px-8 py-2 md:py-3 rounded-none font-semibold transition-colors text-sm md:text-base ${
          isTransactionPending 
            ? 'bg-[#00D9FF] border-2 border-[#00D9FF] text-gray-600 cursor-not-allowed' 
            : 'bg-[#00D9FF] text-black hover:bg-[#00D9FF]/80'
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
    <>
      <button
        onClick={handleConnectClick}
        className="px-4 md:px-8 py-2 md:py-3 bg-black text-[#00D9FF] border-2 border-[#00D9FF] rounded-none font-semibold hover:bg-[#00D9FF] hover:text-black transition-colors text-sm md:text-base"
      >
        Connect Wallet
      </button>
      <DisclaimerDialog 
        open={showDisclaimer}
        onAccept={handleDisclaimerAccept}
      />
    </>
  )
}
