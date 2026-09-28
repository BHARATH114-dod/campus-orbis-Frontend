import { Link } from 'react-router-dom';
import { useNotifications } from '../../context/NotificationContext';

export default function NotificationBell() {
  const { unreadCount } = useNotifications();

  return (
    <Link
      to="/notifications"
      aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
      className="icon-btn-glass relative grid h-9 w-9 place-items-center rounded-lg border border-line text-ink"
    >
      🔔
      {unreadCount > 0 && (
        <span className="absolute -right-1 -top-1 grid h-4 min-w-[16px] place-items-center rounded-full bg-crimson px-1 text-[10px] font-bold text-white">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </Link>
  );
}
