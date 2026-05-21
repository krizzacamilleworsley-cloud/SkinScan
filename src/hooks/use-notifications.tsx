/**
 * useNotifications
 *
 * Subscribes to INSERT events on the `notifications` table filtered by
 * recipient_id = current user's id.
 *
 * Notifications are created by PostgreSQL SECURITY DEFINER triggers:
 *   - trg_notify_on_message          (messages table INSERT)
 *   - trg_notify_on_appointment_insert (appointments table INSERT)
 *   - trg_notify_on_appointment_update (appointments table UPDATE)
 *   - trg_notify_on_scan_update       (scans table UPDATE)
 *
 * The trigger runs as the DB owner so it bypasses RLS and can insert
 * notifications for any recipient regardless of who triggered the action.
 *
 * The realtime filter `recipient_id=eq.{userId}` is a simple equality check
 * that Supabase Realtime evaluates reliably server-side.
 */

import { useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import { supabase as supabaseTyped } from "@/integrations/supabase/client";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = supabaseTyped as any;
import { useAuth } from "@/lib/auth";
import { useNotificationStore } from "./use-notification-store";

interface NotificationRow {
  id: string;
  recipient_id: string;
  type: "appointment" | "message" | "scan";
  title: string;
  body: string;
  link: string | null;
  read: boolean;
  created_at: string;
}

export function useNotifications() {
  const { user } = useAuth();
  const { addNotification } = useNotificationStore();
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const notify = useCallback(
    (row: NotificationRow) => {
      if (!mountedRef.current) return;
      addNotification({
        type: row.type,
        title: row.title,
        body: row.body,
        link: row.link ?? undefined,
      });
      toast(row.title, {
        description: row.body,
        duration: 6000,
        action: row.link
          ? { label: "View", onClick: () => { window.location.href = row.link!; } }
          : undefined,
      });
    },
    [addNotification],
  );

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`user-notifications-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `recipient_id=eq.${user.id}`,
        },
        (payload: { new: NotificationRow }) => {
          notify(payload.new);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, notify]);
}
