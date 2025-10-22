'use client'

import { SWRConfig } from 'swr'
import { swrConfig } from '@/utils/swr-config'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { TransactionProvider } from '@/context/TransactionContext'
import { TokenAccessProvider } from '@/context/TokenAccessContext'
import { ContractProvider } from '@/context/ContractContext'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient())

  return (
    <QueryClientProvider client={queryClient}>
      <SWRConfig value={swrConfig}>
        <ContractProvider>
          <TransactionProvider>
            <TokenAccessProvider>
              {children}
            </TokenAccessProvider>
          </TransactionProvider>
        </ContractProvider>
      </SWRConfig>
    </QueryClientProvider>
  )
} 