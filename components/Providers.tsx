'use client'

import { SWRConfig } from 'swr'
import { swrConfig } from '@/utils/swr-config'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { TransactionProvider } from '@/context/TransactionContext'
import { TokenAccessProvider } from '@/context/TokenAccessContext'
import { TokenBalancesProvider } from '@/context/TokenBalancesContext'
import { StatsDataProvider } from '@/context/StatsDataContext'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient())

  return (
    <QueryClientProvider client={queryClient}>
      <SWRConfig value={swrConfig}>
        <TransactionProvider>
          <TokenAccessProvider>
            <TokenBalancesProvider>
              <StatsDataProvider>
                {children}
              </StatsDataProvider>
            </TokenBalancesProvider>
          </TokenAccessProvider>
        </TransactionProvider>
      </SWRConfig>
    </QueryClientProvider>
  )
} 