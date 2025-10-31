import { useState, useEffect, useCallback } from 'react';
import { useAccount, usePublicClient } from 'wagmi';
import { parseAbiItem } from 'viem';

const LAST_SEEN_KEY = 'notifications_last_seen';
const READ_NOTIFICATIONS_KEY = 'notifications_read';

export interface OrderNotification {
  orderId: string;
  type: 'filled' | 'updated';
  timestamp: number;
  blockNumber: bigint;
  txHash: string;
  isNew: boolean; // Whether this notification is new since last seen
}

export function useNotifications() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const [notifications, setNotifications] = useState<OrderNotification[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Get OTC contract address from environment
  const OTC_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_OTC_CONTRACT_ADDRESS as `0x${string}`;

  // Get last seen timestamp from localStorage
  const getLastSeenTimestamp = useCallback(() => {
    if (typeof window === 'undefined' || !address) return 0;
    const stored = localStorage.getItem(`${LAST_SEEN_KEY}_${address}`);
    return stored ? parseInt(stored, 10) : 0;
  }, [address]);

  // Get read notification IDs from localStorage
  const getReadNotifications = useCallback((): Set<string> => {
    if (typeof window === 'undefined' || !address) return new Set();
    const stored = localStorage.getItem(`${READ_NOTIFICATIONS_KEY}_${address}`);
    return stored ? new Set(JSON.parse(stored)) : new Set();
  }, [address]);

  // Save read notification IDs to localStorage
  const saveReadNotifications = useCallback((readIds: Set<string>) => {
    if (typeof window === 'undefined' || !address) return;
    localStorage.setItem(`${READ_NOTIFICATIONS_KEY}_${address}`, JSON.stringify(Array.from(readIds)));
  }, [address]);

  // Mark a single notification as read
  const markAsRead = useCallback((notificationId: string) => {
    // Update state and localStorage in a single operation
    setNotifications(prev => {
      const readIds = getReadNotifications();
      readIds.add(notificationId);
      saveReadNotifications(readIds);
      
      return prev.map(notif => {
        if (notif.txHash === notificationId) {
          return { ...notif, isNew: false };
        }
        return notif;
      });
    });
  }, [getReadNotifications, saveReadNotifications]);

  // Toggle read/unread status of a notification
  const toggleReadStatus = useCallback((notificationId: string) => {
    // Update state and localStorage in a single operation
    setNotifications(prev => {
      const notification = prev.find(notif => notif.txHash === notificationId);
      if (!notification) return prev;
      
      const isCurrentlyRead = !notification.isNew;
      const readIds = getReadNotifications();
      
      if (isCurrentlyRead) {
        readIds.delete(notificationId);
      } else {
        readIds.add(notificationId);
      }
      saveReadNotifications(readIds);
      
      return prev.map(notif => {
        if (notif.txHash === notificationId) {
          return { ...notif, isNew: !isCurrentlyRead };
        }
        return notif;
      });
    });
  }, [getReadNotifications, saveReadNotifications]);

  // Mark all current notifications as seen (when opening dropdown)
  const markAsSeen = useCallback(() => {
    if (typeof window === 'undefined' || !address) return;
    const now = Math.floor(Date.now() / 1000);
    localStorage.setItem(`${LAST_SEEN_KEY}_${address}`, now.toString());
  }, [address]);

  // Fetch all order-related events
  const fetchNotifications = useCallback(async () => {
    if (!address || !publicClient || !OTC_CONTRACT_ADDRESS) {
      setNotifications([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const lastSeen = getLastSeenTimestamp();
      const readIds = getReadNotifications();

      // Fetch all user-created orders first to identify sells
      const orderPlacedLogs = await publicClient.getLogs({
        address: OTC_CONTRACT_ADDRESS,
        event: parseAbiItem('event OrderPlaced(address indexed user, uint256 orderId)'),
        args: {
          user: address
        },
        fromBlock: 'earliest'
      });
      
      const userCreatedOrderIds = orderPlacedLogs.map(log => log.args.orderId?.toString()).filter(Boolean);

      // PART 1: OrderExecuted events where the user is the buyer
      const buyerLogs = await publicClient.getLogs({
        address: OTC_CONTRACT_ADDRESS,
        event: parseAbiItem('event OrderExecuted(address indexed user, uint256 orderId)'),
        args: {
          user: address
        },
        fromBlock: 'earliest'
      });

      // PART 2: OrderExecuted events where someone else bought the user's order (sells)
      let sellerLogs: any[] = [];
      if (userCreatedOrderIds.length > 0) {
        const allExecutedLogs = await publicClient.getLogs({
          address: OTC_CONTRACT_ADDRESS,
          event: parseAbiItem('event OrderExecuted(address indexed user, uint256 orderId)'),
          fromBlock: 'earliest'
        });
        
        sellerLogs = allExecutedLogs.filter(log => {
          const orderId = log.args.orderId?.toString();
          const buyer = log.args.user?.toLowerCase();
          return orderId && 
                 userCreatedOrderIds.includes(orderId) && 
                 buyer !== address.toLowerCase();
        });
      }

      // PART 3: OrderUpdated events
      const updatedLogs = await publicClient.getLogs({
        address: OTC_CONTRACT_ADDRESS,
        event: parseAbiItem('event OrderUpdated(uint256 orderId)'),
        fromBlock: 'earliest'
      });
      
      // Filter updated logs to only include user's orders
      const userUpdatedLogs = updatedLogs.filter(log => {
        const orderId = log.args.orderId?.toString();
        return orderId && userCreatedOrderIds.includes(orderId);
      });

      // Combine all logs with their event types (excluding cancelled, placed, redeemed, and user's own buys)
      const allLogs = [
        ...sellerLogs.map(log => ({ ...log, eventType: 'filled' as const })), // Orders filled by others
        ...userUpdatedLogs.map(log => ({ ...log, eventType: 'updated' as const }))
      ];
      
      // Get block details to extract timestamps and mark as new/read
      const logsWithTimestamps = await Promise.all(
        allLogs.map(async (log) => {
          const block = await publicClient.getBlock({ blockNumber: log.blockNumber });
          const timestamp = Number(block.timestamp);
          const orderId = log.args.orderId?.toString() || '';
          const notificationId = `${log.transactionHash}`;
          
          // Mark as new if NOT in read list (ignore lastSeen)
          const isNew = !readIds.has(notificationId);
          
          return {
            orderId,
            type: log.eventType,
            timestamp,
            blockNumber: log.blockNumber,
            txHash: log.transactionHash,
            isNew
          };
        })
      );

      // Sort by timestamp (newest first)
      logsWithTimestamps.sort((a, b) => b.timestamp - a.timestamp);

      setNotifications(logsWithTimestamps);
    } catch (error) {
      setNotifications([]);
    } finally {
      setIsLoading(false);
    }
  }, [address, publicClient, OTC_CONTRACT_ADDRESS, getLastSeenTimestamp, getReadNotifications]);

  // Fetch notifications on mount and when wallet changes
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Poll for new notifications every 30 seconds
  useEffect(() => {
    if (!address) return;

    const interval = setInterval(() => {
      fetchNotifications();
    }, 30000);

    return () => clearInterval(interval);
  }, [address, fetchNotifications]);

  return {
    notifications,
    isLoading,
    markAsSeen,
    markAsRead,
    toggleReadStatus,
    refresh: fetchNotifications
  };
}

