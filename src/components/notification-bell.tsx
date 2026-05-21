import { useState, useRef, useEffect } from "react";
import { Bell, Calendar, MessageSquare, Activity, X, CheckCheck, Trash2 } from "lucide-react";
import { useNotificationStore, type AppNotification } from "@/hooks/use-notification-store";
import { useNotifications } from "@/hooks/use-notifications";

// ─── Icon per notification type ──────────────────────────────────────────────
function NotifIcon({ type }: { type: AppNotification["type"] }) {
  if (type === "appointment")
    return (
      <div className="size-8 rounded-full bg-clinical-blue/10 flex items-center justify-center shrink-0">
        <Calendar className="size-4 text-clinical-blue" />
      </div>
    );
  if (type === "message")
    return (
      <div className="size-8 rounded-full bg-risk-low/10 flex items-center justify-center shrink-0">
        <MessageSquare className="size-4 text-risk-low" />
      </div>
    );
  return (
    <div className="size-8 rounded-full bg-risk-mid/10 flex items-center justify-center shrink-0">
      <Activity className="size-4 text-risk-mid" />
    </div>
  );
}

// ─── Single notification row ──────────────────────────────────────────────────
function NotifRow({
  n,
  onRead,
}: {
  n: AppNotification;
  onRead: (id: string) => void;
}) {
  const handleClick = () => {
    onRead(n.id);
    if (n.link) window.location.href = n.link;
  };

  return (
    <button
      onClick={handleClick}
      className={`w-full text-left px-4 py-3 flex gap-3 items-start hover:bg-secondary/60 transition-colors border-b border-border last:border-0 ${
        !n.read ? "bg-red-50/60" : "bg-white"
      }`}
    >
      <NotifIcon type={n.type} />

      <div className="flex-1 min-w-0">
        <div className={`text-sm leading-snug ${!n.read ? "font-semibold text-foreground" : "font-medium text-foreground/80"}`}>
          {n.title}
        </div>
        <div className="text-xs text-muted-foreground mt-0.5 leading-relaxed line-clamp-2">
          {n.body}
        </div>
        <div className="text-[10px] font-mono text-muted-foreground/70 mt-1">
          {formatRelative(n.createdAt)}
        </div>
      </div>

      {/* Red unread dot */}
      {!n.read && (
        <div className="size-2.5 rounded-full bg-red-500 shrink-0 mt-1" />
      )}
    </button>
  );
}

// ─── Main bell component ──────────────────────────────────────────────────────
export function NotificationBell() {
  // Wire up the realtime subscriptions
  useNotifications();

  const { notifications, unreadCount, markAllRead, markRead, clearAll } =
    useNotificationStore();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="relative">
      {/* Bell button */}
      <button
        ref={buttonRef}
        onClick={() => setOpen((v) => !v)}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
        className={`relative flex items-center justify-center size-9 rounded-md transition-colors ${
          open
            ? "bg-secondary text-foreground"
            : "text-muted-foreground hover:bg-secondary hover:text-foreground"
        }`}
      >
        <Bell className="size-[18px]" />

        {/* Red badge — always visible when there are unread notifications */}
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold leading-none shadow-sm">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel — opens downward, aligned to the right */}
      {open && (
        <div
          ref={panelRef}
          className="absolute right-0 top-full mt-2 w-80 bg-white border border-border rounded-2xl shadow-xl z-50 overflow-hidden"
          style={{ maxHeight: "min(480px, 80vh)" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-white">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm">Notifications</span>
              {unreadCount > 0 && (
                <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-full bg-red-500 text-white text-[10px] font-bold leading-none">
                  {unreadCount}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  title="Mark all as read"
                  className="size-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-clinical-blue hover:bg-secondary transition-colors"
                >
                  <CheckCheck className="size-3.5" />
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  onClick={clearAll}
                  title="Clear all"
                  className="size-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-red-500 hover:bg-secondary transition-colors"
                >
                  <Trash2 className="size-3.5" />
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="size-7 flex items-center justify-center rounded-md text-muted-foreground hover:bg-secondary transition-colors"
              >
                <X className="size-3.5" />
              </button>
            </div>
          </div>

          {/* Notification list */}
          <div className="overflow-y-auto" style={{ maxHeight: "calc(min(480px, 80vh) - 56px)" }}>
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <div className="size-12 rounded-full bg-secondary flex items-center justify-center mb-3">
                  <Bell className="size-5 text-muted-foreground opacity-50" />
                </div>
                <div className="text-sm font-medium text-muted-foreground">No notifications yet</div>
                <div className="text-xs text-muted-foreground mt-1 max-w-[200px]">
                  You'll be notified about appointments, messages, and scan updates.
                </div>
              </div>
            ) : (
              notifications.map((n) => (
                <NotifRow key={n.id} n={n} onRead={markRead} />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatRelative(date: Date): string {
  const diff = Date.now() - date.getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}
