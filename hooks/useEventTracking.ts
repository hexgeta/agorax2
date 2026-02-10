'use client';

import { useCallback, useRef } from 'react';
import { useAccount } from 'wagmi';
import type {
  EventType,
  EventData,
  TrackEventResponse,
  OrderCreatedEventData,
  OrderFilledEventData,
  OrderCancelledEventData,
  TradeCompletedEventData,
} from '@/types/events';

// Debounce time for view events (ms)
const VIEW_EVENT_DEBOUNCE = 5000;
const SESSION_STORAGE_KEY = 'agorax-session';

function getSessionToken(): string | null {
  try {
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);
    if (!session.token || Date.now() > session.expiresAt) return null;
    return session.token;
  } catch {
    return null;
  }
}

export function useEventTracking() {
  const { address } = useAccount();
  const lastViewEvents = useRef<Map<string, number>>(new Map());

  // Generic event tracking function
  const trackEvent = useCallback(
    async (eventType: EventType, eventData?: EventData): Promise<TrackEventResponse | null> => {
      if (!address) {
        console.warn('Cannot track event: No wallet connected');
        return null;
      }

      // Include auth token if available (stored by useWalletAuth)
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const token = getSessionToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      try {
        const response = await fetch('/api/events/track', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            wallet_address: address,
            event_type: eventType,
            event_data: eventData || {},
          }),
        });

        const result: TrackEventResponse = await response.json();

        if (!result.success) {
          console.error('Event tracking failed:', result.error);
        } else if (result.challenges_completed && result.challenges_completed.length > 0) {
          // Could trigger a toast notification here for completed challenges
          console.log('Challenges completed:', result.challenges_completed);
        }

        return result;
      } catch (error) {
        console.error('Error tracking event:', error);
        return null;
      }
    },
    [address]
  );

  // Debounced view event (for things like order_viewed, chart_viewed)
  const trackViewEvent = useCallback(
    async (eventType: EventType, eventData?: EventData) => {
      const key = `${eventType}-${JSON.stringify(eventData || {})}`;
      const lastTime = lastViewEvents.current.get(key) || 0;
      const now = Date.now();

      if (now - lastTime < VIEW_EVENT_DEBOUNCE) {
        return null; // Skip if recently tracked
      }

      lastViewEvents.current.set(key, now);
      return trackEvent(eventType, eventData);
    },
    [trackEvent]
  );

  // Specific event tracking functions for type safety

  const trackWalletConnected = useCallback(() => {
    return trackEvent('wallet_connected');
  }, [trackEvent]);

  const trackOrderCreated = useCallback(
    (data: OrderCreatedEventData) => {
      return trackEvent('order_created', data);
    },
    [trackEvent]
  );

  const trackOrderFilled = useCallback(
    (data: OrderFilledEventData) => {
      return trackEvent('order_filled', data);
    },
    [trackEvent]
  );

  const trackOrderCancelled = useCallback(
    (data: OrderCancelledEventData) => {
      return trackEvent('order_cancelled', data);
    },
    [trackEvent]
  );

  const trackTradeCompleted = useCallback(
    (data: TradeCompletedEventData) => {
      return trackEvent('trade_completed', data);
    },
    [trackEvent]
  );

  const trackProceedsClaimed = useCallback(
    (orderId: number, amountUsd?: number) => {
      return trackEvent('proceeds_claimed', { order_id: orderId, amount_usd: amountUsd });
    },
    [trackEvent]
  );

  const trackOrderExpired = useCallback(
    (orderId: number, fillPercentage: number) => {
      return trackEvent('order_expired', { order_id: orderId, fill_percentage: fillPercentage });
    },
    [trackEvent]
  );

  const trackOrderViewed = useCallback(
    (orderId: number, isUnique = false, tokenSymbol?: string) => {
      return trackViewEvent('order_viewed', { order_id: orderId, unique_order: isUnique, token_symbol: tokenSymbol });
    },
    [trackViewEvent]
  );

  const trackChartViewed = useCallback(
    (tokenPair?: string) => {
      return trackViewEvent('chart_viewed', { token_pair: tokenPair });
    },
    [trackViewEvent]
  );

  const trackMarketplaceVisited = useCallback(() => {
    return trackViewEvent('marketplace_visited');
  }, [trackViewEvent]);

  return {
    // Generic
    trackEvent,
    trackViewEvent,

    // Specific events
    trackWalletConnected,
    trackOrderCreated,
    trackOrderFilled,
    trackOrderCancelled,
    trackTradeCompleted,
    trackProceedsClaimed,
    trackOrderExpired,
    trackOrderViewed,
    trackChartViewed,
    trackMarketplaceVisited,

    // Current wallet
    walletAddress: address,
    isConnected: !!address,
  };
}
