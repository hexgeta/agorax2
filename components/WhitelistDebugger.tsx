comu'use client'

import { useContractWhitelistRead } from '@/hooks/contracts/useContractWhitelistRead'
import { getTokenInfo } from '@/utils/tokenUtils'

export function WhitelistDebugger() {
  const { activeTokens, isLoading } = useContractWhitelistRead()

  if (isLoading) {
    return <div className="p-4">Loading whitelist...</div>
  }

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-bold">Contract Whitelist Debugger</h2>
      
      <div className="bg-gray-100 p-4 rounded">
        <h3 className="font-semibold text-black">Summary</h3>
        <p className="text-black">Active tradable tokens: {activeTokens.length}</p>
        <p className="text-xs text-gray-600 mt-1">Fetched directly from contract via viewActiveWhitelisted()</p>
      </div>

      <div className="space-y-2">
        <h3 className="font-semibold">Active Whitelisted Tokens (Available for Trading):</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {activeTokens.map((token, index) => {
            const tokenInfo = getTokenInfo(token.tokenAddress)
            return (
              <div key={index} className="bg-green-50 p-4 border border-green-200 rounded-lg">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm bg-green-200 text-green-800 px-2 py-1 rounded">
                      #{token.index}
                    </span>
                    <span className="font-semibold text-lg">
                      {tokenInfo.ticker}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600">
                    {tokenInfo.name}
                  </div>
                  <div className="text-xs text-gray-500">
                    {tokenInfo.decimals} decimals
                  </div>
                  <div className="font-mono text-xs bg-gray-100 p-1 rounded break-all text-black">
                    {token.tokenAddress}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
