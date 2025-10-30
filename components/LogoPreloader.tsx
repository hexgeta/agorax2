'use client';

import { useEffect } from 'react';
import { TOKEN_CONSTANTS } from '@/constants/crypto';
import { PRIORITY_TOKEN_ADDRESSES } from '@/utils/tokenUtils';

/**
 * LogoPreloader - Preloads all token logos in the background after page load
 * This component runs after the page is fully loaded to avoid blocking the UI
 * 
 * Features:
 * - Priority loading: Most important tokens load first (HEX, PLS, PLSX, stablecoins, MAXI tokens)
 * - Batched loading (50 logos at a time) to prevent overwhelming the browser
 * - 2-second delay after page load to ensure UI is interactive
 * - Progress logging: Shows when priority tokens are done, then every 100 logos
 * - Works with browser cache (30-day TTL set in next.config.js)
 * - Optional service worker support for offline caching
 * 
 * Priority tokens (~29 total) are loaded in the first batch, matching PRIORITY_TOKEN_ORDER
 * from CreatePositionModal.tsx for optimal user experience.
 */

// Set to true to enable service worker for offline logo caching
const ENABLE_SERVICE_WORKER = false;

export function LogoPreloader() {
  useEffect(() => {
    // Wait for the page to fully load before preloading logos
    if (typeof window === 'undefined') return;

    // Optional: Register service worker for offline caching
    const registerServiceWorker = async () => {
      if (!ENABLE_SERVICE_WORKER || !('serviceWorker' in navigator)) return;
      
      try {
        const registration = await navigator.serviceWorker.register('/sw-logo-cache.js');
        console.log('[LogoPreloader] Service worker registered for logo caching');
      } catch (error) {
        console.error('[LogoPreloader] Service worker registration failed:', error);
      }
    };

    registerServiceWorker();

    const preloadLogos = () => {
      // Get priority token tickers (using shared constant from utils/tokenUtils.ts)
      const priorityTickers: string[] = [];
      const otherTickers: string[] = [];
      
      // Create a map of address to ticker
      const addressToTickerMap = new Map<string, string>();
      TOKEN_CONSTANTS.forEach(token => {
        if (token.a && token.ticker && token.ticker.trim() !== '') {
          addressToTickerMap.set(token.a.toLowerCase(), token.ticker);
        }
      });
      
      // Get priority tickers
      PRIORITY_TOKEN_ADDRESSES.forEach(address => {
        const ticker = addressToTickerMap.get(address.toLowerCase());
        if (ticker && !priorityTickers.includes(ticker)) {
          priorityTickers.push(ticker);
        }
      });
      
      // Get remaining tickers
      TOKEN_CONSTANTS.forEach(token => {
        if (token.ticker && token.ticker.trim() !== '' && !priorityTickers.includes(token.ticker)) {
          otherTickers.push(token.ticker);
        }
      });
      
      // Remove duplicates from otherTickers
      const uniqueOtherTickers = Array.from(new Set(otherTickers));
      
      // Combine: priority first, then the rest
      const tickers = [...priorityTickers, ...uniqueOtherTickers];
      
      console.log(`[LogoPreloader] Starting to preload ${tickers.length} token logos (${priorityTickers.length} priority tokens first)...`);
      
      // Batch preload: load logos in chunks to avoid overwhelming the browser
      const BATCH_SIZE = 50; // Load 50 logos at a time
      const BATCH_DELAY = 100; // Wait 100ms between batches
      
      let loadedCount = 0;
      let priorityLoaded = false;
      
      const preloadBatch = (startIndex: number) => {
        const endIndex = Math.min(startIndex + BATCH_SIZE, tickers.length);
        const batch = tickers.slice(startIndex, endIndex);
        
        batch.forEach(ticker => {
          const img = new Image();
          img.src = `/coin-logos/${ticker}.svg`;
          
          // Track loaded count
          img.onload = () => {
            loadedCount++;
            
            // Log when priority tokens are done
            if (!priorityLoaded && loadedCount >= priorityTickers.length) {
              priorityLoaded = true;
              console.log(`[LogoPreloader] ✓ Priority tokens loaded (${priorityTickers.length}/${tickers.length})`);
            }
            
            // Log progress every 100 logos
            if (loadedCount % 100 === 0) {
              console.log(`[LogoPreloader] Loaded ${loadedCount}/${tickers.length} logos`);
            }
          };
          
          // Silently fail for missing logos (they'll use default.svg)
          img.onerror = () => {
            loadedCount++;
          };
        });
        
        // Schedule next batch
        if (endIndex < tickers.length) {
          setTimeout(() => preloadBatch(endIndex), BATCH_DELAY);
        } else {
          console.log(`[LogoPreloader] ✓ Finished preloading all ${tickers.length} logos`);
        }
      };
      
      // Start preloading after a short delay to ensure page is interactive
      setTimeout(() => preloadBatch(0), 2000); // Wait 2 seconds after page load
    };

    // Start preloading when page is fully loaded
    if (document.readyState === 'complete') {
      preloadLogos();
    } else {
      window.addEventListener('load', preloadLogos);
      return () => window.removeEventListener('load', preloadLogos);
    }
  }, []);

  // This component doesn't render anything
  return null;
}

