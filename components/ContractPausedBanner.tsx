'use client'

import { useAccount } from 'wagmi'

export function ContractPausedBanner() {
  const { isConnected } = useAccount()

  if (!isConnected) return null

  return (
    <>
      <div className="fixed top-0 left-0 right-0 z-[300] bg-yellow-500 text-black text-center py-2 px-4 text-sm font-semibold">
        Contract is currently paused. Funds are safe and able to be withdrawn.
      </div>
      <div className="h-9" />
    </>
  )
}
