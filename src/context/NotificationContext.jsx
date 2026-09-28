import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import {
  fetchNotifications,
  markNotificationRead,
  markTabRead as markTabReadRequest,
  markAllRead as markAllReadRequest,
  dismissNotification as dismissNotificationRequest,
  clearAllNotifications as clearAllNotificationsRequest,
} from '../services/notificationService';

const NotificationContext = createContext(null);

// Simple poll interval for the unread badge. A real-time solution
// (WebSocket/SSE) would be a backend addition — out of scope for this
// frontend module — so polling is the pragmatic choice here.
const POLL_MS = 30000;

export function NotificationProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(() => {
    if (!isAuthenticated) return;
    setLoading(true);
    fetchNotifications()
      .then(({ notifications, unread_count }) => {
        setNotifications(notifications);
        setUnreadCount(unread_count);
      })
      .catch(() => {
        /* silent — a failed poll shouldn't toast-spam the user every 30s */
      })
      .finally(() => setLoading(false));
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }
    refresh();
    const interval = setInterval(refresh, POLL_MS);
    return () => clearInterval(interval);
  }, [isAuthenticated, refresh]);

  const markRead = useCallback(async (id) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    setUnreadCount((c) => Math.max(0, c - 1));
    try {
      await markNotificationRead(id);
    } catch {
      refresh(); // reconcile with the server if the optimistic update was wrong
    }
  }, [refresh]);

  const markTabRead = useCallback(async (tab) => {
    setNotifications((prev) => prev.map((n) => (n.tab === tab ? { ...n, read: true } : n)));
    try {
      await markTabReadRequest(tab);
      refresh();
    } catch {
      refresh();
    }
  }, [refresh]);

  const markAllRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
    try {
      await markAllReadRequest();
    } catch {
      refresh();
    }
  }, [refresh]);

  // Swipe-to-dismiss (spec item 6/8): removes exactly one notification from
  // local state immediately (so the UI reacts the instant the swipe
  // finishes, no waiting on the network) and from unreadCount if it was
  // unread, then persists the removal server-side. On failure, `refresh()`
  // reconciles local state back with the server — same pattern already
  // used by markRead/markAllRead above — so a dropped request never leaves
  // the frontend permanently out of sync with what's actually stored.
  const dismiss = useCallback(async (id) => {
    let wasUnread = false;
    setNotifications((prev) => {
      const target = prev.find((n) => n.id === id);
      wasUnread = !!target && !target.read;
      return prev.filter((n) => n.id !== id);
    });
    if (wasUnread) setUnreadCount((c) => Math.max(0, c - 1));
    try {
      await dismissNotificationRequest(id);
    } catch {
      refresh();
    }
  }, [refresh]);

  // Clear All (spec item 7/8): empties the panel and zeroes the badge
  // immediately, persists the clear server-side, and — like every other
  // mutation here — is scoped entirely to the signed-in user's own
  // notifications (see the backend route), so it can never touch anyone
  // else's data.
  const clearAll = useCallback(async () => {
    setNotifications([]);
    setUnreadCount(0);
    try {
      await clearAllNotificationsRequest();
    } catch {
      refresh();
    }
  }, [refresh]);

  return (
    <NotificationContext.Provider
      value={{ notifications, unreadCount, loading, refresh, markRead, markTabRead, markAllRead, dismiss, clearAll }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used within a NotificationProvider');
  return ctx;
}
