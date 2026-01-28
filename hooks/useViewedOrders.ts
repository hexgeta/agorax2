'use client';

import { useState, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'agorax_viewed_orders';
const SETTINGS_KEY = 'agorax_discover_settings';

interface ViewedOrder {
  orderID: string;
  viewedAt: number;
  action: 'passed' | 'saved';
}

interface DiscoverSettings {
  expiryHours: number; // Hours until passed orders can be shown again
  hideViewed: boolean; // Whether to hide viewed orders
}

const DEFAULT_SETTINGS: DiscoverSettings = {
  expiryHours: 24,
  hideViewed: true,
};

interface UseViewedOrdersResult {
  viewedOrderIds: Set<string>;
  markAsViewed: (orderId: string, action: 'passed' | 'saved') => void;
  isViewed: (orderId: string) => boolean;
  clearViewed: () => void;
  settings: DiscoverSettings;
  updateSettings: (settings: Partial<DiscoverSettings>) => void;
  getViewedCount: () => number;
  getPassedCount: () => number;
}

export function useViewedOrders(): UseViewedOrdersResult {
  const [viewedOrders, setViewedOrders] = useState<ViewedOrder[]>([]);
  const [settings, setSettings] = useState<DiscoverSettings>(DEFAULT_SETTINGS);

  // Load from localStorage on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      // Load viewed orders
      const storedOrders = localStorage.getItem(STORAGE_KEY);
      if (storedOrders) {
        setViewedOrders(JSON.parse(storedOrders));
      }

      // Load settings
      const storedSettings = localStorage.getItem(SETTINGS_KEY);
      if (storedSettings) {
        setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(storedSettings) });
      }
    } catch {
      // Ignore parse errors
    }
  }, []);

  // Get non-expired viewed order IDs
  const viewedOrderIds = (() => {
    if (!settings.hideViewed) return new Set<string>();

    const now = Date.now();
    const expiryMs = settings.expiryHours * 60 * 60 * 1000;

    return new Set(
      viewedOrders
        .filter(order => {
          // Saved orders never expire from being hidden
          if (order.action === 'saved') return true;
          // Passed orders expire after expiryHours
          return now - order.viewedAt < expiryMs;
        })
        .map(order => order.orderID)
    );
  })();

  const persistOrders = useCallback((orders: ViewedOrder[]) => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
    } catch {
      // Ignore storage errors
    }
  }, []);

  const persistSettings = useCallback((newSettings: DiscoverSettings) => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(newSettings));
    } catch {
      // Ignore storage errors
    }
  }, []);

  const markAsViewed = useCallback((orderId: string, action: 'passed' | 'saved') => {
    setViewedOrders(prev => {
      // Check if already exists
      const existingIndex = prev.findIndex(o => o.orderID === orderId);

      let next: ViewedOrder[];
      if (existingIndex >= 0) {
        // Update existing
        next = [...prev];
        next[existingIndex] = {
          orderID: orderId,
          viewedAt: Date.now(),
          action,
        };
      } else {
        // Add new
        next = [...prev, {
          orderID: orderId,
          viewedAt: Date.now(),
          action,
        }];
      }

      persistOrders(next);
      return next;
    });
  }, [persistOrders]);

  const isViewed = useCallback((orderId: string) => {
    return viewedOrderIds.has(orderId);
  }, [viewedOrderIds]);

  const clearViewed = useCallback(() => {
    setViewedOrders([]);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const updateSettings = useCallback((newSettings: Partial<DiscoverSettings>) => {
    setSettings(prev => {
      const updated = { ...prev, ...newSettings };
      persistSettings(updated);
      return updated;
    });
  }, [persistSettings]);

  const getViewedCount = useCallback(() => {
    return viewedOrders.length;
  }, [viewedOrders]);

  const getPassedCount = useCallback(() => {
    return viewedOrders.filter(o => o.action === 'passed').length;
  }, [viewedOrders]);

  return {
    viewedOrderIds,
    markAsViewed,
    isViewed,
    clearViewed,
    settings,
    updateSettings,
    getViewedCount,
    getPassedCount,
  };
}
