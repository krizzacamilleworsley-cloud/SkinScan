/**
 * useUnreadCounts
 *
 * Shows red dots on Messages and Appointments nav items.
 *
 * Uses a hybrid approach:
 * - Realtime subscriptions for instant updates (when they work)
 * - Polling every 8s as a guaranteed fallback
 * - localStorage to track last-visited timestamps
 *
 * For messages: checks if any message exists with created_at > last visit
 *   that was NOT sent by the current user.
 * For appointments (doctor): checks if any appointment with status='pending'
 *   was created after last visit.
 * For appointments (patient): checks if any appointment status changed
 *   after last visit.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase as supabaseTyped } from "@/integrations/supabase/client";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = supabaseTyped as any;
import { useAuth } from "@/lib/auth";
import { useRouterState } from "@tanstack/react-router";

const LS_MSG_VISITED  = "skinscan_msg_visited_at";
const LS_APPT_VISITED = "skinscan_appt_visited_at";

export interface UnreadCounts {
  messages:          boolean;
  appointments:      boolean;
  clearMessages:     () => void;
  clearAppointments: () => void;
}

export function useUnreadCounts(): UnreadCounts {
  const { user, roles } = useAuth();
  const isDoctor = roles.includes("doctor") || roles.includes("admin");
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const [hasNewMessage,     setHasNewMessage]     = useState(false);
  const [hasNewAppointment, setHasNewAppointment] = useState(false);

  const pathnameRef = useRef(pathname);
  useEffect(() => { pathnameRef.current = pathname; }, [pathname]);

  // ── Clear helpers ─────────────────────────────────────────────────────────
  const clearMessages = useCallback(() => {
    setHasNewMessage(false);
    localStorage.setItem(LS_MSG_VISITED, new Date().toISOString());
  }, []);

  const clearAppointments = useCallback(() => {
    setHasNewAppointment(false);
    localStorage.setItem(LS_APPT_VISITED, new Date().toISOString());
  }, []);

  // Auto-clear when navigating to the page
  useEffect(() => {
    if (pathname.startsWith("/messages"))     clearMessages();
    if (pathname.startsWith("/appointments")) clearAppointments();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // ── Poll for new messages ─────────────────────────────────────────────────
  const checkMessages = useCallback(async () => {
    if (!user) return;
    if (pathnameRef.current.startsWith("/messages")) return;

    const since = localStorage.getItem(LS_MSG_VISITED) ?? new Date(0).toISOString();

    if (isDoctor) {
      // Doctor: any message sent after last visit that wasn't sent by a doctor
      // We check conversations updated after last visit, then look at latest message
      const { data } = await supabase
        .from("conversations")
        .select("id")
        .gt("last_message_at", since)
        .limit(1);
      if (data && data.length > 0) {
        // Check if the latest message in any of these convs is from a patient
        const convId = data[0].id;
        const { data: msgs } = await supabase
          .from("messages")
          .select("sender_id")
          .eq("conversation_id", convId)
          .gt("created_at", since)
          .neq("sender_id", user.id)
          .limit(1);
        if (msgs && msgs.length > 0) {
          setHasNewMessage(true);
        }
      }
    } else {
      // Patient: any message in their conversations sent after last visit
      // that wasn't sent by themselves
      const { data: convs } = await supabase
        .from("conversations")
        .select("id")
        .eq("user_id", user.id)
        .gt("last_message_at", since)
        .limit(1);
      if (convs && convs.length > 0) {
        const { data: msgs } = await supabase
          .from("messages")
          .select("sender_id")
          .eq("conversation_id", convs[0].id)
          .gt("created_at", since)
          .neq("sender_id", user.id)
          .limit(1);
        if (msgs && msgs.length > 0) {
          setHasNewMessage(true);
        }
      }
    }
  }, [user, isDoctor]);

  // ── Poll for new appointments ─────────────────────────────────────────────
  const checkAppointments = useCallback(async () => {
    if (!user) return;
    if (pathnameRef.current.startsWith("/appointments")) return;

    const since = localStorage.getItem(LS_APPT_VISITED) ?? new Date(0).toISOString();

    if (isDoctor) {
      // Doctor: any new pending appointment created after last visit
      const { data } = await supabase
        .from("appointments")
        .select("id")
        .eq("status", "pending")
        .gt("created_at", since)
        .limit(1);
      if (data && data.length > 0) setHasNewAppointment(true);
    } else {
      // Patient: any appointment updated after last visit (status change)
      const { data } = await supabase
        .from("appointments")
        .select("id")
        .eq("user_id", user.id)
        .gt("updated_at", since)
        .limit(1);
      if (data && data.length > 0) setHasNewAppointment(true);
    }
  }, [user, isDoctor]);

  // ── Initial check + polling ───────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;

    // Run immediately on mount
    checkMessages();
    checkAppointments();

    // Poll every 8 seconds
    const interval = setInterval(() => {
      checkMessages();
      checkAppointments();
    }, 8000);

    return () => clearInterval(interval);
  }, [user, checkMessages, checkAppointments]);

  // ── Realtime for instant updates (best-effort on top of polling) ──────────
  useEffect(() => {
    if (!user) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const channels: any[] = [];

    // conversations UPDATE — fires when last_message_at is bumped
    // Simple RLS: patients have user_id=auth.uid(), doctors have subquery
    // but REPLICA IDENTITY FULL means the event may still arrive
    const convChannel = supabase
      .channel(`unread-conv-${user.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "conversations" },
        () => { checkMessages(); },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "conversations" },
        () => { checkMessages(); },
      )
      .subscribe();
    channels.push(convChannel);

    // appointments INSERT/UPDATE
    if (isDoctor) {
      const apptCh = supabase
        .channel(`unread-appt-${user.id}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "appointments" },
          () => { checkAppointments(); },
        )
        .subscribe();
      channels.push(apptCh);
    } else {
      const apptCh = supabase
        .channel(`unread-appt-${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "appointments",
            filter: `user_id=eq.${user.id}`,
          },
          () => { checkAppointments(); },
        )
        .subscribe();
      channels.push(apptCh);
    }

    return () => {
      channels.forEach((ch) => supabase.removeChannel(ch));
    };
  }, [user, isDoctor, checkMessages, checkAppointments]);

  return {
    messages:          hasNewMessage,
    appointments:      hasNewAppointment,
    clearMessages,
    clearAppointments,
  };
}
