'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { LiquidGlassCard } from '@/components/ui/liquid-glass';
import PixelBlastBackground from '@/components/ui/PixelBlastBackground';
import { ConnectButton } from '@/components/ConnectButton';
import { motion } from 'framer-motion';

type SubStatus = {
  subscribed: boolean;
  pending: boolean;
  notifyFills: boolean;
  notifyCancellations: boolean;
};

type ErrorState = {
  message: string;
  detail?: string;
};

export default function NotificationsPage() {
  const { address, isConnected } = useAccount();
  const [status, setStatus] = useState<SubStatus | null>(null);
  const [telegramLink, setTelegramLink] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState<ErrorState | null>(null);

  const checkStatus = useCallback(async () => {
    if (!address) return;
    try {
      const res = await fetch(`/api/telegram/status?wallet=${address}`);
      const data = await res.json();
      setStatus(data);
    } catch {
      setStatus(null);
    } finally {
      setChecking(false);
    }
  }, [address]);

  useEffect(() => {
    if (address) {
      setChecking(true);
      checkStatus();
    } else {
      setStatus(null);
      setChecking(false);
    }
  }, [address, checkStatus]);

  // Poll for status changes when pending (user might be clicking the Telegram link)
  useEffect(() => {
    if (!status?.pending) return;
    const interval = setInterval(checkStatus, 3000);
    return () => clearInterval(interval);
  }, [status?.pending, checkStatus]);

  const handleSubscribe = async () => {
    if (!address) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/telegram/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: address }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError({ message: 'Failed to enable notifications', detail: data.error || `Status ${res.status}` });
        return;
      }
      if (data.telegramLink) {
        setTelegramLink(data.telegramLink);
        setStatus({ subscribed: false, pending: true, notifyFills: true, notifyCancellations: false });
      } else {
        setError({ message: 'Unexpected response', detail: 'No Telegram link returned' });
      }
    } catch (err) {
      setError({ message: 'Network error', detail: err instanceof Error ? err.message : 'Could not reach server' });
    } finally {
      setLoading(false);
    }
  };

  const handleUnsubscribe = async () => {
    if (!address) return;
    setLoading(true);
    try {
      await fetch('/api/telegram/subscribe', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: address }),
      });
      setStatus({ subscribed: false, pending: false, notifyFills: false, notifyCancellations: false });
      setTelegramLink(null);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-[calc(100vh-5rem)]">
      <PixelBlastBackground />
      <div className="relative z-10 max-w-xl mx-auto px-4 py-8 md:py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-2xl md:text-3xl font-bold mb-2">Notifications</h1>
          <p className="text-white/60 mb-8 text-sm">
            Get Telegram alerts when your limit orders are filled.
          </p>

          <LiquidGlassCard className="p-6 rounded-xl" glowIntensity="sm">
            {!isConnected ? (
              <div className="text-center py-8">
                <p className="text-white/60 mb-4">Connect your wallet to set up notifications.</p>
                <ConnectButton />
              </div>
            ) : checking ? (
              <div className="text-center py-8">
                <p className="text-white/40">Checking subscription status...</p>
              </div>
            ) : status?.subscribed ? (
              /* Active subscription */
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-emerald-400 font-medium">Telegram notifications active</span>
                </div>

                <div className="space-y-3 text-sm text-white/60">
                  <div className="flex justify-between">
                    <span>Order fills</span>
                    <span className="text-emerald-400">Enabled</span>
                  </div>
                </div>

                <p className="text-xs text-white/40">
                  You&apos;ll receive a Telegram message each time one of your orders gets filled.
                </p>

                <button
                  onClick={handleUnsubscribe}
                  disabled={loading}
                  className="w-full py-3 px-4 rounded-lg border border-white/10 text-white/60 hover:text-white hover:border-white/30 transition-colors text-sm disabled:opacity-50"
                >
                  {loading ? 'Disabling...' : 'Disable notifications'}
                </button>
              </div>
            ) : status?.pending || telegramLink ? (
              /* Pending - waiting for user to click Telegram link */
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-yellow-400 animate-pulse" />
                  <span className="text-yellow-400 font-medium">Waiting for Telegram confirmation</span>
                </div>

                <p className="text-sm text-white/60">
                  Click the button below to open Telegram and activate notifications.
                  Press &quot;Start&quot; in the bot chat to confirm.
                </p>

                <a
                  href={telegramLink || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full py-3 px-4 rounded-lg bg-[#2AABEE] hover:bg-[#229ED9] text-white text-center font-medium transition-colors text-sm"
                >
                  Open Telegram Bot
                </a>

                <p className="text-xs text-white/40 text-center">
                  This page will update automatically once you confirm in Telegram.
                </p>
              </div>
            ) : (
              /* Not subscribed */
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-white/20" />
                  <span className="text-white/60">Notifications disabled</span>
                </div>

                <div className="space-y-3 text-sm text-white/60">
                  <p>
                    Receive instant Telegram alerts when someone fills your limit orders.
                    No email or personal info required.
                  </p>
                  <ul className="space-y-2 text-white/40">
                    <li className="flex items-start gap-2">
                      <span className="text-white/60 mt-0.5">&#8226;</span>
                      <span>Get notified within ~1 minute of a fill</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-white/60 mt-0.5">&#8226;</span>
                      <span>See fill amount, token, and transaction link</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-white/60 mt-0.5">&#8226;</span>
                      <span>Privacy-preserving — Telegram chat IDs are opaque</span>
                    </li>
                  </ul>
                </div>

                <button
                  onClick={handleSubscribe}
                  disabled={loading}
                  className="w-full py-3 px-4 rounded-lg bg-white text-black font-medium hover:bg-white/90 transition-colors text-sm disabled:opacity-50"
                >
                  {loading ? 'Setting up...' : 'Enable Telegram notifications'}
                </button>
              </div>
            )}
          </LiquidGlassCard>

          {error && (
            <div className="mt-4 p-4 rounded-lg bg-red-500/10 border border-red-500/20">
              <p className="text-red-400 text-sm font-medium">{error.message}</p>
              {error.detail && <p className="text-red-400/60 text-xs mt-1">{error.detail}</p>}
            </div>
          )}

          <div className="mt-6 text-center">
            <p className="text-xs text-white/30">
              Your wallet address is stored alongside an opaque Telegram chat ID.
              <br />
              No email, phone number, or personal information is collected.
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
