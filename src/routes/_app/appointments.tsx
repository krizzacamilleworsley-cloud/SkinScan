import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase as supabaseTyped } from "@/integrations/supabase/client";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = supabaseTyped as any;
import { useAuth } from "@/lib/auth";
import { Calendar, Clock, MapPin, Plus, X, CheckCircle, Phone, User, ChevronDown } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/appointments")({ component: AppointmentsPage });

export const CLINICS = [
  { id: "omph", name: "Oriental Mindoro Provincial Hospital", department: "Dermatology Department",
    address: "C5 Road, Barangay Sta. Isabel, Calapan City, Oriental Mindoro",
    phone: "(043) 288-5130", hours: "Mon–Fri, 8:00 AM – 5:00 PM",
    note: "Government hospital. Dermatology consultations available on scheduled clinic days. Walk-ins accepted." },
  { id: "megh", name: "Maria Estrella General Hospital", department: "Skin & Dermatology Clinic",
    address: "Rizal St., Calapan City, Oriental Mindoro",
    phone: "(043) 286-7809", hours: "Mon–Sat, 8:00 AM – 5:00 PM",
    note: "Private hospital. Dermatology consultations by appointment. Call ahead to confirm availability." },
] as const;

export type ClinicId = (typeof CLINICS)[number]["id"];
type AppointmentStatus = "pending" | "confirmed" | "cancelled" | "completed";

interface Appointment {
  id: string; user_id: string; title: string; doctor_name: string;
  clinic_id: string | null; location: string | null; notes: string | null;
  scheduled_at: string; status: AppointmentStatus; created_at: string;
}

const STATUS_STYLES: Record<AppointmentStatus, { badge: string; label: string; dot: string }> = {
  pending:   { badge: "bg-amber-50 text-amber-700 border-amber-200",                    label: "Pending",   dot: "bg-amber-400" },
  confirmed: { badge: "bg-emerald-50 text-emerald-700 border-emerald-200",              label: "Confirmed", dot: "bg-emerald-400" },
  cancelled: { badge: "bg-red-50 text-red-600 border-red-200",                          label: "Cancelled", dot: "bg-red-400" },
  completed: { badge: "bg-clinical-blue/10 text-clinical-blue border-clinical-blue/20", label: "Completed", dot: "bg-clinical-blue" },
};

function todayStr() { return new Date().toISOString().slice(0, 16); }
function getClinic(id: string | null) { return CLINICS.find((c) => c.id === id) ?? null; }

function AppointmentsPage() {
  const { user, roles } = useAuth();
  const isDoctor = roles.includes("doctor") || roles.includes("admin");
  if (isDoctor) return <DoctorAppointmentsView />;
  return <PatientAppointmentsView userId={user!.id} />;
}

function PatientAppointmentsView({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);

  const { data: appointments, isLoading } = useQuery({
    queryKey: ["appointments", userId],
    queryFn: async () => {
      const { data, error } = await supabase.from("appointments").select("*")
        .eq("user_id", userId).order("scheduled_at", { ascending: true });
      if (error) throw error;
      return data as Appointment[];
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("appointments").update({ status: "cancelled" })
        .eq("id", id).eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["appointments", userId] }); toast.success("Appointment cancelled"); },
    onError: () => toast.error("Failed to cancel appointment"),
  });

  const upcoming = (appointments ?? []).filter((a) => a.status !== "cancelled" && new Date(a.scheduled_at) >= new Date());
  const past     = (appointments ?? []).filter((a) => a.status === "cancelled" || new Date(a.scheduled_at) < new Date());

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-widest text-clinical-blue mb-1">Dermatology care</p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Appointments</h1>
          <p className="text-muted-foreground text-sm mt-1">Book and manage your dermatology consultations in Oriental Mindoro.</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary self-start sm:self-auto">
          <Plus className="size-4" /> Book appointment
        </button>
      </div>

      {/* Clinic cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        {CLINICS.map((c) => (
          <div key={c.id} className="bg-white border border-border rounded-2xl p-4 hover:border-clinical-blue/30 hover:shadow-md hover:shadow-clinical-blue/8 transition-all duration-200">
            <div className="flex items-start gap-3 mb-3">
              <div className="size-9 rounded-xl bg-clinical-blue/8 flex items-center justify-center shrink-0">
                <MapPin className="size-4 text-clinical-blue" />
              </div>
              <div>
                <div className="font-semibold text-sm">{c.name}</div>
                <div className="text-[10px] font-mono text-clinical-blue uppercase tracking-widest mt-0.5">{c.department}</div>
              </div>
            </div>
            <div className="space-y-1.5 text-xs text-muted-foreground">
              <div className="flex items-start gap-2"><MapPin className="size-3 mt-0.5 shrink-0 text-clinical-blue/60" />{c.address}</div>
              <div className="flex items-center gap-2"><Phone className="size-3 shrink-0 text-clinical-blue/60" />{c.phone}</div>
              <div className="flex items-center gap-2"><Clock className="size-3 shrink-0 text-clinical-blue/60" />{c.hours}</div>
            </div>
          </div>
        ))}
      </div>

      {showForm && (
        <BookingForm userId={userId} onClose={() => setShowForm(false)}
          onSaved={() => { qc.invalidateQueries({ queryKey: ["appointments", userId] }); setShowForm(false); }} />
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="size-6 border-2 border-clinical-blue/30 border-t-clinical-blue rounded-full animate-spin" />
        </div>
      ) : (
        <>
          <Section title="Upcoming" count={upcoming.length}>
            {upcoming.length === 0 ? (
              <EmptyState icon={<Calendar className="size-8 text-muted-foreground" />}
                message="No upcoming appointments" sub="Book a consultation at one of the clinics above." />
            ) : upcoming.map((a) => (
              <AppointmentCard key={a.id} appt={a} onCancel={() => cancelMutation.mutate(a.id)} />
            ))}
          </Section>
          {past.length > 0 && (
            <Section title="Past & cancelled" count={past.length} className="mt-8">
              {past.map((a) => <AppointmentCard key={a.id} appt={a} past />)}
            </Section>
          )}
        </>
      )}
    </div>
  );
}

function DoctorAppointmentsView() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: appointments, isLoading } = useQuery({
    queryKey: ["doctor-appointments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("appointments").select("*").order("scheduled_at", { ascending: true });
      if (error) throw error;
      return data as Appointment[];
    },
  });

  const confirmMutation = useMutation({
    mutationFn: async (appt: Appointment) => {
      const { error } = await supabase.from("appointments").update({ status: "confirmed" }).eq("id", appt.id);
      if (error) throw error;
      return appt;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["doctor-appointments"] }); toast.success("Appointment confirmed"); },
    onError: () => toast.error("Failed to confirm"),
  });

  const completeMutation = useMutation({
    mutationFn: async (appt: Appointment) => {
      const { error } = await supabase.from("appointments").update({ status: "completed" }).eq("id", appt.id);
      if (error) throw error;
      return appt;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["doctor-appointments"] }); toast.success("Marked as completed"); },
    onError: () => toast.error("Failed to update"),
  });

  const filtered     = (appointments ?? []).filter((a) => statusFilter === "all" || a.status === statusFilter);
  const pendingCount = (appointments ?? []).filter((a) => a.status === "pending").length;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-widest text-clinical-blue mb-1">Clinician schedule</p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Appointments</h1>
          <p className="text-muted-foreground text-sm mt-1">All patient appointments booked at your clinics.</p>
        </div>
        {pendingCount > 0 && (
          <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl self-start sm:self-auto">
            <div className="size-2 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-sm font-semibold text-amber-700">{pendingCount} pending confirmation</span>
          </div>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-secondary rounded-xl p-1 mb-6 w-full sm:w-fit overflow-x-auto">
        {["all", "pending", "confirmed", "completed", "cancelled"].map((s) => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium capitalize transition-all duration-150 whitespace-nowrap ${
              statusFilter === s ? "bg-white text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}>
            {s}
            {s === "pending" && pendingCount > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center size-4 rounded-full bg-amber-400 text-white text-[9px] font-bold">{pendingCount}</span>
            )}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="size-6 border-2 border-clinical-blue/30 border-t-clinical-blue rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={<Calendar className="size-8 text-muted-foreground" />}
          message="No appointments found" sub="Patient bookings will appear here." />
      ) : (
        <div className="space-y-3">
          {filtered.map((a) => (
            <DoctorAppointmentCard key={a.id} appt={a}
              onConfirm={() => confirmMutation.mutate(a)}
              onComplete={() => completeMutation.mutate(a)} />
          ))}
        </div>
      )}
    </div>
  );
}

function BookingForm({ userId, onClose, onSaved }: { userId: string; onClose: () => void; onSaved: () => void }) {
  const [selectedClinicId, setSelectedClinicId] = useState<string>(CLINICS[0].id);
  const [doctorName, setDoctorName] = useState("");
  const [notes, setNotes]           = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [saving, setSaving]         = useState(false);
  const clinic = getClinic(selectedClinicId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scheduledAt) return toast.error("Please select a date and time");
    if (!clinic) return toast.error("Please select a clinic");
    setSaving(true);
    const { error } = await supabase.from("appointments").insert({
      user_id: userId, title: "Dermatology consultation", clinic_id: clinic.id,
      doctor_name: doctorName.trim() || "Dermatologist on duty", location: clinic.address,
      notes: notes.trim() || null, scheduled_at: new Date(scheduledAt).toISOString(), status: "pending",
    });
    setSaving(false);
    if (error) { toast.error("Failed to book appointment"); }
    else { toast.success("Appointment booked — awaiting confirmation"); onSaved(); }
  };

  return (
    <div className="bg-white border border-border rounded-2xl p-5 sm:p-6 mb-6 shadow-sm fade-in-up">
      <div className="flex justify-between items-center mb-5">
        <div>
          <h2 className="font-bold text-lg">Book appointment</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Select a clinic and preferred time</p>
        </div>
        <button onClick={onClose} className="size-8 flex items-center justify-center rounded-xl text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors">
          <X className="size-4" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-2">Select clinic</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {CLINICS.map((c) => (
              <button key={c.id} type="button" onClick={() => setSelectedClinicId(c.id)}
                className={`text-left p-4 rounded-xl border-2 transition-all duration-150 ${
                  selectedClinicId === c.id
                    ? "border-clinical-blue bg-clinical-blue/5 shadow-sm shadow-clinical-blue/10"
                    : "border-border hover:border-clinical-blue/40 hover:bg-secondary/50"
                }`}>
                <div className="font-semibold text-sm">{c.name}</div>
                <div className="text-[10px] text-clinical-blue font-mono uppercase tracking-widest mt-0.5">{c.department}</div>
                <div className="text-xs text-muted-foreground mt-2 flex items-center gap-1.5">
                  <Clock className="size-3 shrink-0" /> {c.hours}
                </div>
              </button>
            ))}
          </div>
        </div>

        {clinic && (
          <div className="bg-gradient-to-r from-clinical-blue/5 to-clinical-blue/3 border border-clinical-blue/15 rounded-xl p-4 text-xs space-y-2 text-muted-foreground">
            <div className="flex items-start gap-2"><MapPin className="size-3.5 mt-0.5 shrink-0 text-clinical-blue" /><span>{clinic.address}</span></div>
            <div className="flex items-center gap-2"><Phone className="size-3.5 shrink-0 text-clinical-blue" /><span>{clinic.phone}</span></div>
            <p className="text-[11px] italic text-muted-foreground/70 mt-1">{clinic.note}</p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1.5">Preferred doctor (optional)</label>
            <input className="input-base" placeholder="Leave blank for any available" value={doctorName} onChange={(e) => setDoctorName(e.target.value)} />
          </div>
          <div>
            <label className="block text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1.5">Date & time</label>
            <input type="datetime-local" className="input-base" min={todayStr()} value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} required />
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1.5">Notes / reason for visit (optional)</label>
          <textarea className="input-base resize-none" rows={3}
            placeholder="Describe your concern, e.g. mole that changed color, persistent rash…"
            value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        <div className="flex gap-3 pt-1">
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? <><span className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Booking…</> : "Request appointment"}
          </button>
          <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
        </div>
      </form>
    </div>
  );
}

function AppointmentCard({ appt, past, onCancel }: { appt: Appointment; past?: boolean; onCancel?: () => void }) {
  const dt     = new Date(appt.scheduled_at);
  const style  = STATUS_STYLES[appt.status];
  const clinic = getClinic(appt.clinic_id);

  return (
    <div className={`bg-white border border-border rounded-2xl p-4 sm:p-5 flex gap-4 transition-all duration-200 ${
      past ? "opacity-60" : "hover:border-clinical-blue/25 hover:shadow-sm"
    }`}>
      <div className="shrink-0 w-14 text-center bg-gradient-to-br from-clinical-blue/10 to-clinical-blue/5 rounded-xl py-2.5 px-1">
        <div className="text-[9px] font-mono uppercase text-clinical-blue tracking-widest">{dt.toLocaleString("default", { month: "short" })}</div>
        <div className="text-2xl font-bold leading-none mt-0.5">{dt.getDate()}</div>
        <div className="text-[9px] text-muted-foreground mt-0.5">{dt.getFullYear()}</div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div>
            <div className="font-semibold text-sm">{clinic ? clinic.name : appt.title}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{clinic ? clinic.department : appt.doctor_name}</div>
          </div>
          <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-lg border shrink-0 ${style.badge}`}>
            <span className={`size-1.5 rounded-full ${style.dot}`} />{style.label}
          </span>
        </div>
        <div className="flex flex-wrap gap-3 mt-2.5 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><Clock className="size-3 text-clinical-blue/60" />{dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
          {(clinic?.address ?? appt.location) && (
            <span className="flex items-center gap-1.5 truncate max-w-[200px]"><MapPin className="size-3 text-clinical-blue/60 shrink-0" />{clinic?.address ?? appt.location}</span>
          )}
          {appt.doctor_name && appt.doctor_name !== "Dermatologist on duty" && (
            <span className="flex items-center gap-1.5"><User className="size-3 text-clinical-blue/60" />{appt.doctor_name}</span>
          )}
        </div>
        {appt.notes && <p className="text-xs text-muted-foreground mt-2 italic bg-secondary/50 rounded-lg px-2.5 py-1.5">{appt.notes}</p>}
      </div>
      {!past && appt.status !== "cancelled" && onCancel && (
        <button onClick={onCancel} className="shrink-0 self-start text-xs text-muted-foreground hover:text-red-600 flex items-center gap-1 mt-0.5 px-2 py-1 rounded-lg hover:bg-red-50 transition-all">
          <X className="size-3" /> Cancel
        </button>
      )}
    </div>
  );
}

function DoctorAppointmentCard({ appt, onConfirm, onComplete }: { appt: Appointment; onConfirm: () => void; onComplete: () => void }) {
  const dt     = new Date(appt.scheduled_at);
  const style  = STATUS_STYLES[appt.status];
  const clinic = getClinic(appt.clinic_id);
  const isPast = new Date(appt.scheduled_at) < new Date();

  return (
    <div className={`bg-white border rounded-2xl p-4 sm:p-5 flex gap-4 transition-all duration-200 ${
      appt.status === "pending" ? "border-amber-200 bg-amber-50/20 hover:border-amber-300" : "border-border hover:border-clinical-blue/25 hover:shadow-sm"
    }`}>
      <div className="shrink-0 w-14 text-center bg-gradient-to-br from-clinical-blue/10 to-clinical-blue/5 rounded-xl py-2.5 px-1">
        <div className="text-[9px] font-mono uppercase text-clinical-blue tracking-widest">{dt.toLocaleString("default", { month: "short" })}</div>
        <div className="text-2xl font-bold leading-none mt-0.5">{dt.getDate()}</div>
        <div className="text-[9px] text-muted-foreground mt-0.5">{dt.getFullYear()}</div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div>
            <div className="font-semibold text-sm">{clinic ? clinic.name : appt.title}</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Patient <span className="font-mono">{appt.user_id.slice(0, 8)}…</span>
              {appt.doctor_name && appt.doctor_name !== "Dermatologist on duty" && <> · Dr. {appt.doctor_name}</>}
            </div>
          </div>
          <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-lg border shrink-0 ${style.badge}`}>
            <span className={`size-1.5 rounded-full ${style.dot}`} />{style.label}
          </span>
        </div>
        <div className="flex flex-wrap gap-3 mt-2.5 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><Clock className="size-3 text-clinical-blue/60" />{dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
          {clinic && <span className="flex items-center gap-1.5 truncate max-w-[200px]"><MapPin className="size-3 text-clinical-blue/60 shrink-0" />{clinic.address}</span>}
        </div>
        {appt.notes && <p className="text-xs text-muted-foreground mt-2 italic bg-secondary/50 rounded-lg px-2.5 py-1.5">"{appt.notes}"</p>}
      </div>
      <div className="shrink-0 flex flex-col gap-2 self-center">
        {appt.status === "pending" && (
          <button onClick={onConfirm} className="flex items-center gap-1.5 px-3 py-1.5 bg-clinical-blue text-white rounded-xl text-xs font-semibold hover:bg-clinical-blue/90 hover:shadow-sm transition-all">
            <CheckCircle className="size-3" /> Confirm
          </button>
        )}
        {appt.status === "confirmed" && !isPast && (
          <button onClick={onComplete} className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-xl text-xs font-medium hover:bg-secondary transition-all">
            <CheckCircle className="size-3" /> Mark done
          </button>
        )}
      </div>
    </div>
  );
}

function Section({ title, count, children, className = "" }: { title: string; count: number; children: React.ReactNode; className?: string }) {
  return (
    <section className={className}>
      <div className="flex items-center gap-2 mb-4">
        <h2 className="font-bold text-base">{title}</h2>
        <span className="text-[10px] font-mono bg-secondary px-2 py-0.5 rounded-lg text-muted-foreground">{count}</span>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function EmptyState({ icon, message, sub }: { icon: React.ReactNode; message: string; sub: string }) {
  return (
    <div className="bg-white border border-border rounded-2xl p-10 text-center">
      <div className="flex justify-center mb-3 opacity-50">{icon}</div>
      <div className="font-semibold text-sm mb-1">{message}</div>
      <div className="text-xs text-muted-foreground">{sub}</div>
    </div>
  );
}

// Suppress unused import
const _ChevronDown = ChevronDown; void _ChevronDown;
