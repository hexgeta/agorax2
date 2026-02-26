'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAccount } from 'wagmi';

export function useFavorites() {
  const { address } = useAccount();
  const [favoriteOrderIds, setFavoriteOrderIds] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const fetchedRef = useRef<string | null>(null);

  // Fetch favorites when wallet connects
  useEffect(() => {
    if (!address) {
      setFavoriteOrderIds(new Set());
      fetchedRef.current = null;
      return;
    }

    // Don't refetch if we already fetched for this address
    if (fetchedRef.current === address.toLowerCase()) return;

    const fetchFavorites = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/favorites?wallet=${address}`);
        if (res.ok) {
          const data = await res.json();
          if (data.success && Array.isArray(data.favorites)) {
            setFavoriteOrderIds(new Set(data.favorites));
          }
        } else {
          console.warn('[Favorites] Failed to fetch favorites:', res.status, await res.text().catch(() => ''));
        }
      } catch (err) {
        console.warn('[Favorites] Error fetching favorites:', err);
      } finally {
        setIsLoading(false);
        fetchedRef.current = address.toLowerCase();
      }
    };

    fetchFavorites();
  }, [address]);

  const isFavorite = useCallback(
    (orderId: number | bigint) => {
      return favoriteOrderIds.has(Number(orderId));
    },
    [favoriteOrderIds]
  );

  const toggleFavorite = useCallback(
    async (orderId: number | bigint) => {
      if (!address) return;

      const id = Number(orderId);
      const wasFavorite = favoriteOrderIds.has(id);

      // Optimistic update
      setFavoriteOrderIds((prev: Set<number>) => {
        const next = new Set(prev);
        if (wasFavorite) {
          next.delete(id);
        } else {
          next.add(id);
        }
        return next;
      });

      try {
        const res = await fetch('/api/favorites', {
          method: wasFavorite ? 'DELETE' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            wallet_address: address,
            order_id: id,
          }),
        });

        if (!res.ok) {
          console.warn('[Favorites] Failed to toggle favorite:', res.status, await res.text().catch(() => ''));
          // Revert optimistic update on failure
          setFavoriteOrderIds((prev: Set<number>) => {
            const next = new Set(prev);
            if (wasFavorite) {
              next.add(id);
            } else {
              next.delete(id);
            }
            return next;
          });
        }
      } catch (err) {
        console.warn('[Favorites] Error toggling favorite:', err);
        // Revert optimistic update on error
        setFavoriteOrderIds((prev: Set<number>) => {
          const next = new Set(prev);
          if (wasFavorite) {
            next.add(id);
          } else {
            next.delete(id);
          }
          return next;
        });
      }
    },
    [address, favoriteOrderIds]
  );

  return {
    favoriteOrderIds,
    isFavorite,
    toggleFavorite,
    isLoading,
    hasFavorites: favoriteOrderIds.size > 0,
  };
}
