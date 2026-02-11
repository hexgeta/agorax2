'use client'

import { useState, useEffect, useRef } from 'react'
import { useAccount } from 'wagmi'
import { PixelSpinner } from './ui/PixelSpinner';
import { useAppKit } from '@reown/appkit/react'
import { useTransaction } from '@/context/TransactionContext'
import { DisclaimerDialog } from './DisclaimerDialog'
import Link from 'next/link'
import { useEventTracking } from '@/hooks/useEventTracking'
import { useWalletAuth } from '@/hooks/useWalletAuth'
// import { PrestigeBadge } from './PrestigeBadge'

interface ConnectButtonProps {
  connectedText?: string;
  connectedHref?: string;
}

export const ConnectButton = ({ connectedText, connectedHref }: ConnectButtonProps = {}) => {
  const { isConnected, address } = useAccount()
  const { trackWalletConnected } = useEventTracking()
  const { isVerified, isVerifying, isInitialized, hasStoredSession, verify } = useWalletAuth()

  // Track wallet connection event (API handles deduplication)
  useEffect(() => {
    if (isConnected && address) {
      trackWalletConnected()
    }
  }, [isConnected, address, trackWalletConnected])

  // Prompt for verification only if this wallet hasn't been verified before
  // Sessions are now stored per-wallet, so switching wallets won't re-prompt
  const hasPromptedForWallet = useRef<string | null>(null)
  useEffect(() => {
    if (!isConnected || !address || !isInitialized) return
    if (isVerifying || isVerified || hasStoredSession) return
    // Don't prompt again for the same wallet in this session
    if (hasPromptedForWallet.current === address) return

    hasPromptedForWallet.current = address
    verify()
  }, [isConnected, address, isInitialized, isVerifying, isVerified, hasStoredSession, verify])

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
    // If custom text and href provided, render as a link
    if (connectedText && connectedHref) {
      return (
        <Link
          href={connectedHref}
          className="px-4 md:px-8 py-2 md:py-3 rounded-full font-semibold transition-colors text-sm md:text-base bg-white text-black hover:bg-white/80"
        >
          {connectedText}
        </Link>
      )
    }

    return (
      <div className="flex items-center gap-2">
        {/* <PrestigeBadge /> */}
        <button
          onClick={() => open()}
          disabled={isTransactionPending}
          className={`px-4 md:px-8 py-2 md:py-3 rounded-full font-semibold transition-colors text-sm md:text-base ${isTransactionPending
            ? 'bg-white border-2 border-white text-white cursor-not-allowed'
            : 'bg-white text-black hover:bg-white/80'
            }`}
        >
          {isTransactionPending ? (
            <div className="flex items-center gap-2">
              <PixelSpinner size={16} />
              <span>Loading</span>
            </div>
          ) : (
            `${address.slice(0, 6)}...${address.slice(-4)}`
          )}
        </button>
      </div>
    )
  }

  return (
    <>
      <button
        onClick={handleConnectClick}
        className="px-4 md:px-8 py-2 md:py-3 bg-white text-black border-2 border-white rounded-full font-semibold hover:bg-black hover:text-white transition-colors text-sm md:text-base"
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
