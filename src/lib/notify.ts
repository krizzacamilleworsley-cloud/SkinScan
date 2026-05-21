/**
 * notify.ts — STUB
 *
 * Notifications are now created by PostgreSQL triggers (SECURITY DEFINER)
 * on the messages, appointments, and scans tables.
 * Triggers run as the DB owner and bypass RLS — no client-side insert needed.
 *
 * These functions are kept as no-ops so existing import sites compile,
 * but they do nothing — the triggers handle everything automatically.
 */

export interface NotifyPayload {
  type: "appointment" | "message" | "scan";
  title: string;
  body: string;
  link?: string;
}

/** No-op — handled by DB trigger trg_notify_on_appointment_insert / trg_notify_on_appointment_update */
export async function notifyUser(_recipientId: string, _payload: NotifyPayload): Promise<void> {
  // Trigger handles this
}

/** No-op — handled by DB triggers */
export async function notifyUsers(_recipientIds: string[], _payload: NotifyPayload): Promise<void> {
  // Trigger handles this
}

/** No-op — triggers query user_roles directly */
export async function getDoctorIds(): Promise<string[]> {
  return [];
}
