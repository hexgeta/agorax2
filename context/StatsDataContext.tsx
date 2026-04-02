'use client';

import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';

interface DbOrder {
  order_id: number;
  maker_address: string;
  sell_token_address: string;
  sell_token_ticker: string;
  sell_amount_raw: string;
  sell_amount_formatted: number;
  buy_tokens_addresses: string[];
  buy_tokens_tickers: string[];
  buy_amounts_raw: string[];
  buy_amounts_formatted: number[];
  status: number;
  fill_percentage: number;
  remaining_sell_amount: string;
  redeemed_sell_amount: string;
  is_all_or_nothing: boolean;
  expiration: number;
  creation_tx_hash: string;
  creation_block_number: number;
  created_at: string;
}

interface DbFill {
  order_id: number;
  filler_address: string;
  buy_token_index: number;
  buy_token_address: string;
  buy_token_ticker: string;
  buy_amount_raw: string;
  buy_amount_formatted: number;
  tx_hash: string;
  block_number: number;
  filled_at: string;
}

interface StatsDataContextType {
  dbOrders: DbOrder[];
  dbFills: DbFill[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

const StatsDataContext = createContext<StatsDataContextType>({
  dbOrders: [],
  dbFills: [],
  isLoading: true,
  error: null,
  refetch: () => {},
});

export function useStatsData() {
  return useContext(StatsDataContext);
}

export function StatsDataProvider({ children }: { children: React.ReactNode }) {
  const [dbOrders, setDbOrders] = useState<DbOrder[]>([]);
  const [dbFills, setDbFills] = useState<DbFill[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isFirstFetch = useRef(true);

  const fetchData = useCallback(async () => {
    try {
      if (isFirstFetch.current) {
        setIsLoading(true);
        setError(null);
      }
      const res = await fetch('/api/v1/stats/protocol-data');
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.message || 'API returned error');
      setDbOrders(json.data.orders || []);
      setDbFills(json.data.fills || []);
    } catch (err) {
      if (isFirstFetch.current) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      }
    } finally {
      if (isFirstFetch.current) {
        setIsLoading(false);
        isFirstFetch.current = false;
      }
    }
  }, []);

  // Fetch on mount + poll every 60s (matches cron sync interval)
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 300000); // 5 minutes
    return () => clearInterval(interval);
  }, [fetchData]);

  return (
    <StatsDataContext.Provider value={{ dbOrders, dbFills, isLoading, error, refetch: fetchData }}>
      {children}
    </StatsDataContext.Provider>
  );
}
