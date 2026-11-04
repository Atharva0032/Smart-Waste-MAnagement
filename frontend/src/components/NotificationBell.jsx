import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import NotificationsIcon from '@mui/icons-material/Notifications';
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone';
import { useAuth } from '../context/AuthContext';
import { getNotifications, markAsRead, markAllAsRead } from '../services/notificationService';
import { timeAgo } from '../utils/format';

const POLL_INTERVAL_MS = 60000;

const normalizeNotifications = (data) => {
  if (Array.isArray(data)) {
    return data;
  }
  if (Array.isArray(data?.notifications)) {
    return data.notifications;
  }
  return [];
};

const NotificationBell = () => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);

  const unreadCount = notifications.filter((item) => !item?.isRead).length;

  const loadNotifications = useCallback(async () => {
    if (!isAuthenticated) {
      return;
    }
    try {
      const data = await getNotifications();
      setNotifications(normalizeNotifications(data));
    } catch (error) {
      // Polling errors are ignored so a transient failure never breaks the header.
    }
  }, [isAuthenticated]);

  // Poll for new notifications, but skip work while the tab is in the background.
  useEffect(() => {
    if (!isAuthenticated) {
      return undefined;
    }

    loadNotifications();

    const intervalId = setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadNotifications();
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [isAuthenticated, loadNotifications]);

  // Close the dropdown when the user clicks anywhere outside of it.
  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const handleMouseDown = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [open]);

  const handleToggle = async () => {
    const nextOpen = !open;
    setOpen(nextOpen);

    if (nextOpen) {
      setLoading(true);
      await loadNotifications();
      setLoading(false);
    }
  };

  const handleItemClick = async (notification) => {
    const id = notification?._id || notification?.id;

    try {
      if (id && !notification?.isRead) {
        await markAsRead(id);
      }
    } catch (error) {
      // Ignore failures; the local state below keeps the UI responsive.
    }

    setNotifications((current) =>
      current.map((item) =>
        (item?._id || item?.id) === id ? { ...item, isRead: true } : item
      )
    );

    const link = notification?.link;
    if (link) {
      setOpen(false);
      navigate(link);
    }
  };

  const handleMarkAll = async () => {
    try {
      await markAllAsRead();
    } catch (error) {
      // Still reflect the change locally.
    }
    setNotifications((current) => current.map((item) => ({ ...item, isRead: true })));
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={handleToggle}
        aria-label="Notifications"
        title="Notifications"
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
      >
        {unreadCount > 0 ? (
          <NotificationsIcon fontSize="small" />
        ) : (
          <NotificationsNoneIcon fontSize="small" />
        )}
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-rose-500 px-1 text-[0.625rem] font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 z-40 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Notifications</h3>
            {unreadCount > 0 ? (
              <button
                type="button"
                onClick={handleMarkAll}
                className="text-xs font-semibold text-teal-600 transition hover:text-teal-700 dark:text-teal-400 dark:hover:text-teal-300"
              >
                Mark all as read
              </button>
            ) : null}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="space-y-3 p-4">
                {[0, 1, 2].map((key) => (
                  <div key={key} className="space-y-2">
                    <div className="h-3 w-1/2 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
                    <div className="h-3 w-3/4 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
                  </div>
                ))}
              </div>
            ) : notifications.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                You have no notifications.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {notifications.map((notification, index) => {
                  const id = notification?._id || notification?.id || index;
                  return (
                    <li key={id}>
                      <button
                        type="button"
                        onClick={() => handleItemClick(notification)}
                        className={`flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/60 ${
                          notification?.isRead ? '' : 'bg-teal-50/40 dark:bg-teal-500/5'
                        }`}
                      >
                        <span
                          className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                            notification?.isRead ? 'bg-transparent' : 'bg-teal-500'
                          }`}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold text-slate-900 dark:text-white">
                            {notification?.title || 'Notification'}
                          </span>
                          {notification?.message ? (
                            <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
                              {notification.message}
                            </span>
                          ) : null}
                          <span className="mt-1 block text-[0.6875rem] text-slate-400 dark:text-slate-500">
                            {timeAgo(notification?.createdAt)}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default NotificationBell;
