import { useEffect, useRef, useState } from 'react';
import { Bell, BellRing, Info, AlertTriangle, CheckCircle2, Mail } from 'lucide-react';
import { useAuth } from '../firebase';
import { api } from '../api';

interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success' | string;
  created_at: string;
  read: number | boolean;
}

const TYPE_STYLES: Record<string, { icon: any; color: string }> = {
  success: { icon: CheckCircle2, color: 'text-accent-emerald' },
  warning: { icon: AlertTriangle, color: 'text-rose-400' },
  info: { icon: Info, color: 'text-accent-cyan' },
};

export default function NotificationBell() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [sentEmails, setSentEmails] = useState<any[]>([]);
  const ref = useRef<HTMLDivElement | null>(null);

  const load = async () => {
    try {
      const [notifs, emails] = await Promise.all([
        api.fetchNotifications(user).catch(() => []),
        api.fetchSentEmails(user).catch(() => []),
      ]);
      setNotifications(notifs || []);
      setSentEmails(emails || []);
    } catch (e) {
      console.error('Failed to load notifications', e);
    }
  };

  useEffect(() => {
    if (user) {
      load();
      const id = setInterval(load, 15000); // poll for new events (new login emails etc.)
      return () => clearInterval(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  // Close on outside click
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleOpen = async () => {
    const next = !open;
    setOpen(next);
    if (next) {
      await load();
      // mark everything read for a clean badge
      try {
        await api.markNotificationsAsRead(user);
        setNotifications(prev => prev.map(n => ({ ...n, read: 1 })));
      } catch { /* best-effort */ }
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={handleOpen}
        aria-label="Notifications"
        className="relative p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700 transition-colors"
      >
        {unreadCount > 0 ? <BellRing size={16} className="text-primary-400" /> : <Bell size={16} />}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[9px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1 border border-zinc-950">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed top-4 right-4 w-[calc(100vw-2rem)] max-w-sm bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl shadow-black/60 overflow-hidden z-[70]">
          <div className="px-4 py-3 border-b border-zinc-900 flex items-center justify-between">
            <h3 className="text-xs font-bold text-white">Notifications</h3>
            <span className="text-[10px] text-zinc-500">{notifications.length} total</span>
          </div>

          <div className="max-h-72 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="text-xs text-zinc-500 text-center py-8">You're all caught up.</p>
            ) : (
              notifications.map(n => {
                const style = TYPE_STYLES[n.type] || TYPE_STYLES.info;
                const Icon = style.icon;
                return (
                  <div key={n.id} className="px-4 py-3 border-b border-zinc-900/60 hover:bg-zinc-900/40 transition-colors flex gap-3">
                    <Icon size={16} className={`${style.color} mt-0.5 shrink-0`} />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-zinc-200">{n.title}</p>
                      <p className="text-[11px] text-zinc-400 mt-0.5 leading-snug">{n.message}</p>
                      <p className="text-[9px] text-zinc-600 mt-1 font-mono">
                        {n.created_at ? new Date(n.created_at).toLocaleString() : ''}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Emails sent to this user (welcome / security alerts) */}
          <div className="px-4 py-3 border-t border-zinc-900 bg-zinc-950/80">
            <div className="flex items-center gap-2 mb-2">
              <Mail size={13} className="text-accent-violet" />
              <h4 className="text-[11px] font-bold text-zinc-300">Email updates sent to you</h4>
              <span className="text-[9px] text-zinc-600 ml-auto">{sentEmails.length}</span>
            </div>
            {sentEmails.length === 0 ? (
              <p className="text-[10px] text-zinc-600">No emails recorded yet.</p>
            ) : (
              <ul className="space-y-1.5 max-h-36 overflow-y-auto">
                {sentEmails.map(e => (
                  <li key={e.id} className="text-[11px] text-zinc-400 flex items-start gap-2">
                    <span className="text-zinc-600">•</span>
                    <div className="min-w-0">
                      <span className="block truncate font-medium text-zinc-300">{e.subject}</span>
                      <span className="text-[9px] text-zinc-600 font-mono">
                        {e.sent_at ? new Date(e.sent_at).toLocaleString() : ''}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
