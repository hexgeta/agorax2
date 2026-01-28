'use client';

import { useState, useCallback, useEffect } from 'react';
import { CompleteOrderDetails } from '@/hooks/contracts/useOpenPositions';
import { SavedOrder } from '@/types/discover';

const STORAGE_KEY = 'agorax_saved_orders';

interface UseSavedOrdersResult {
  savedOrderIds: Set<string>;
  saveOrder: (order: CompleteOrderDetails) => void;
  removeOrder: (orderId: string) => void;
  isSaved: (orderId: string) => boolean;
  clearAll: () => void;
  getSavedOrdersList: () => SavedOrder[];
}

export function useSavedOrders(): UseSavedOrdersResult {
  const [savedOrderIds, setSavedOrderIds] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set();

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const parsed: SavedOrder[] = stored ? JSON.parse(stored) : [];
      return new Set(parsed.map(o => o.orderID));
    } catch {
      return new Set();
    }
  });

  // Sync state with localStorage on mount (for SSR hydration)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const parsed: SavedOrder[] = stored ? JSON.parse(stored) : [];
      setSavedOrderIds(new Set(parsed.map(o => o.orderID)));
    } catch {
      // Ignore parse errors
    }
  }, []);

  const persistToStorage = useCallback((ids: Set<string>) => {
    if (typeof window === 'undefined') return;

    try {
      // Get existing data to preserve timestamps
      const existingData: SavedOrder[] = (() => {
        try {
          const stored = localStorage.getItem(STORAGE_KEY);
          return stored ? JSON.parse(stored) : [];
        } catch {
          return [];
        }
      })();

      const existingMap = new Map(existingData.map(o => [o.orderID, o.savedAt]));

      const data: SavedOrder[] = Array.from(ids).map(id => ({
        orderID: id,
        savedAt: existingMap.get(id) ?? Date.now()
      }));

      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // Ignore storage errors
    }
  }, []);

  const saveOrder = useCallback((order: CompleteOrderDetails) => {
    const orderId = order.orderDetailsWithID.orderID.toString();

    setSavedOrderIds(prev => {
      const next = new Set(prev);
      next.add(orderId);
      persistToStorage(next);
      return next;
    });
  }, [persistToStorage]);

  const removeOrder = useCallback((orderId: string) => {
    setSavedOrderIds(prev => {
      const next = new Set(prev);
      next.delete(orderId);
      persistToStorage(next);
      return next;
    });
  }, [persistToStorage]);

  const isSaved = useCallback((orderId: string) => {
    return savedOrderIds.has(orderId);
  }, [savedOrderIds]);

  const clearAll = useCallback(() => {
    setSavedOrderIds(new Set());
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const getSavedOrdersList = useCallback((): SavedOrder[] => {
    if (typeof window === 'undefined') return [];

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }, []);

  return {
    savedOrderIds,
    saveOrder,
    removeOrder,
    isSaved,
    clearAll,
    getSavedOrdersList,
  };
}
