import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Disclaimer, RiskBadge } from "@/components/scan-ui";
import {
  Plus, AlertCircle, Calendar, MessageSquare, Clock, CheckCircle,
  AlertTriangle, Users, Activity, ShieldCheck, Stethoscope, BarChart2,
  ArrowRight, TrendingUp,
} from "lucide-react";

export const Route = createFileRoute("/_app/dashboard")({ component: Dashboard });

function Dashboard() {
  const { roles } = useAuth();
  if (roles.includes("admin"))  return <AdminDashboard />;
  if (roles.includes("doctor")) return <DoctorDashboard />;
  return <PatientDashboard />;
}

// ─── PATIENT DASHBOARD ────────────────────────────────────────────────────────
function PatientDashboard() {
  const { user } = useAuth();
  const { data: scans } = useQuery({
    queryKey: ["patient-scans", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("scans")
        .select("id, prediction, confidence, risk_level, status, created_at, body_location")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(6);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
  const { data: appointments } = useQuery({
    queryKey: ["patient-appointments", user?.id],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("appointments")
        .select("id, title, doctor_name, scheduled_at, status")
        .eq("user_id", user!.id)
        .gte("scheduled_at", new Date().toISOString())
        .neq("status", "cancelled")
        .order("scheduled_at", { ascending: true })
        .limit(3);
      if (error) throw error;
      return data as Array<{ id: string; title: string; doctor_name: string; scheduled_at: string; status: string }>;
    },
    enabled: !!user,
  });

  const completed = (scans ?? []).filter((s) => s.status === "completed" || s.status === "reviewed");
  const highRisk  = completed.filter((s) => s.risk_level === "high").length;
  const avgConf   = completed.length
    ? Math.round(completed.reduce((a, s) => a + Number(s.confidence ?? 0), 0) / completed.length) : 0;
  const pending   = (scans ?? []).filter((s) => s.status === "pending" || s.status === "analyzing").length;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-widest text-clinical-blue mb-1">Your health overview</p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">Track your skin health and upcoming appointments.</p>
        </div>
        <Link to="/scans/new" className="btn-primary self-start sm:self-auto">
          <Plus className="size-4" /> New scan
        </Link>
      </div>

      <Disclaimer className="mb-6" />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <StatCard label="Total scans"        value={(scans ?? []).length} icon={<Activity className="size-4" />} gradient="blue" />
        <StatCard label="Avg. confidence"    value={`${avgConf}%`}        icon={<BarChart2 className="size-4" />} gradient="green" />
        <StatCard label="High-risk findings" value={highRisk}             icon={<AlertTriangle className="size-4" />} gradient={highRisk > 0 ? "red" : "blue"} accent={highRisk > 0} />
        <StatCard label="In progress"        value={pending}              icon={<Clock className="size-4" />} gradient="amber" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Recent scans */}
        <div className="lg:col-span-2">
          <SectionHeader title="Recent scans" linkTo="/scans" linkLabel="View all" />
          {scans && scans.length > 0 ? (
            <div className="space-y-2.5">
              {scans.map((s) => (
                <Link key={s.id} to="/scans/$scanId" params={{ scanId: s.id }}
                  className="flex items-center gap-3 sm:gap-4 bg-white border border-border rounded-2xl p-3 sm:p-4 hover:border-clinical-blue/40 hover:shadow-md hover:shadow-clinical-blue/8 transition-all duration-200 group">
                  <div className="size-10 rounded-xl bg-gradient-to-br from-clinical-blue/10 to-clinical-blue/5 flex items-center justify-center shrink-0">
                    <Activity className="size-4 text-clinical-blue" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate">{s.prediction ?? "Analyzing…"}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {s.body_location ?? "Unknown location"} · {new Date(s.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <RiskBadge level={s.risk_level as "low" | "medium" | "high" | null} />
                    <StatusPill status={s.status} />
                    <ArrowRight className="size-3.5 text-muted-foreground/40 group-hover:text-clinical-blue group-hover:translate-x-0.5 transition-all hidden sm:block" />
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyCard icon={<AlertCircle className="size-8 text-muted-foreground" />} title="No scans yet"
              body="Upload your first skin image to get an AI analysis."
              action={<Link to="/scans/new" className="btn-primary inline-flex"><Plus className="size-4" />Start first scan</Link>} />
          )}
        </div>

        {/* Right column */}
        <div className="space-y-5">
          <div>
            <SectionHeader title="Upcoming appointments" linkTo="/appointments" linkLabel="View all" />
            {appointments && appointments.length > 0 ? (
              <div className="space-y-2.5">
                {appointments.map((a) => (
                  <div key={a.id} className="bg-white border border-border rounded-2xl p-4 hover:border-clinical-blue/30 hover:shadow-sm transition-all duration-200">
                    <div className="font-semibold text-sm">{a.title}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{a.doctor_name}</div>
                    <div className="flex items-center gap-1.5 text-xs text-clinical-blue mt-2 font-medium">
                      <Calendar className="size-3" />
                      {new Date(a.scheduled_at).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}
                      {" · "}
                      {new Date(a.scheduled_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white border border-border rounded-2xl p-5 text-center">
                <div className="size-10 rounded-xl bg-clinical-blue/8 flex items-center justify-center mx-auto mb-2">
                  <Calendar className="size-5 text-clinical-blue" />
                </div>
                <p className="text-xs text-muted-foreground mb-2">No upcoming appointments.</p>
                <Link to="/appointments" className="text-xs text-clinical-blue font-semibold hover:underline">Book one →</Link>
              </div>
            )}
          </div>
          <div>
            <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-3">Quick actions</p>
            <div className="space-y-2">
              <QuickAction to="/scans/new"    icon={<Plus className="size-4" />}           label="New skin scan" />
              <QuickAction to="/appointments" icon={<Calendar className="size-4" />}       label="Book appointment" />
              <QuickAction to="/messages"     icon={<MessageSquare className="size-4" />}  label="Message clinician" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── DOCTOR DASHBOARD ─────────────────────────────────────────────────────────
function DoctorDashboard() {
  const { data: queue } = useQuery({
    queryKey: ["doctor-queue"],
    queryFn: async () => {
      const { data, error } = await supabase.from("scans")
        .select("id, prediction, confidence, risk_level, status, created_at, user_id, body_location")
        .in("status", ["completed", "reviewed"])
        .order("created_at", { ascending: false }).limit(50);
      if (error) throw error;
      return data;
    },
  });
  const { data: stats } = useQuery({
    queryKey: ["doctor-stats"],
    queryFn: async () => {
      const [allRes, reviewedRes, highRes] = await Promise.all([
        supabase.from("scans").select("id", { count: "exact", head: true }),
        supabase.from("scans").select("id", { count: "exact", head: true }).eq("status", "reviewed"),
        supabase.from("scans").select("id", { count: "exact", head: true }).eq("risk_level", "high"),
      ]);
      return { total: allRes.count ?? 0, reviewed: reviewedRes.count ?? 0, highRisk: highRes.count ?? 0,
        pending: (allRes.count ?? 0) - (reviewedRes.count ?? 0) };
    },
  });
  const { data: pendingAppointments } = useQuery({
    queryKey: ["doctor-pending-appointments"],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).from("appointments")
        .select("id, user_id, clinic_id, scheduled_at, status, notes, doctor_name")
        .in("status", ["pending", "confirmed"])
        .gte("scheduled_at", new Date().toISOString())
        .order("scheduled_at", { ascending: true }).limit(5);
      if (error) throw error;
      return data as Array<{ id: string; user_id: string; clinic_id: string | null; scheduled_at: string; status: string; notes: string | null; doctor_name: string }>;
    },
  });

  const needsReview = (queue ?? []).filter((s) => s.status === "completed");
  const reviewed    = (queue ?? []).filter((s) => s.status === "reviewed");

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-widest text-clinical-blue mb-1">Clinician workspace</p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Doctor Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">Review AI-analysed scans and provide clinical assessments.</p>
        </div>
        <Link to="/doctor" className="btn-primary self-start sm:self-auto">
          <Stethoscope className="size-4" /> Full review queue
        </Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <StatCard label="Total scans"     value={stats?.total    ?? 0} icon={<Activity className="size-4" />} gradient="blue" />
        <StatCard label="Awaiting review" value={stats?.pending  ?? 0} icon={<Clock className="size-4" />} gradient="amber" accent={(stats?.pending ?? 0) > 0} />
        <StatCard label="Reviewed"        value={stats?.reviewed ?? 0} icon={<CheckCircle className="size-4" />} gradient="green" positive />
        <StatCard label="High-risk cases" value={stats?.highRisk ?? 0} icon={<AlertTriangle className="size-4" />} gradient="red" accent={(stats?.highRisk ?? 0) > 0} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <div>
            <SectionHeader title="Needs your review" badge={needsReview.length} linkTo="/doctor" linkLabel="See all" />
            {needsReview.length > 0 ? (
              <div className="bg-white border border-border rounded-2xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[500px]">
                    <thead className="bg-gradient-to-r from-secondary to-secondary/60 text-[10px] uppercase tracking-widest text-muted-foreground">
                      <tr>
                        <th className="text-left px-4 py-3 font-semibold">Date</th>
                        <th className="text-left px-4 py-3 font-semibold">Patient</th>
                        <th className="text-left px-4 py-3 font-semibold">AI prediction</th>
                        <th className="text-left px-4 py-3 font-semibold">Conf.</th>
                        <th className="text-left px-4 py-3 font-semibold">Risk</th>
                        <th className="px-4 py-3" />
                      </tr>
                    </thead>
                    <tbody>
                      {needsReview.slice(0, 8).map((s) => (
                        <tr key={s.id} className="border-t border-border hover:bg-clinical-blue/3 transition-colors">
                          <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{new Date(s.created_at).toLocaleDateString()}</td>
                          <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{s.user_id.slice(0, 8)}…</td>
                          <td className="px-4 py-3 font-medium text-sm">{s.prediction ?? "—"}</td>
                          <td className="px-4 py-3 font-mono text-xs">{s.confidence ? `${Number(s.confidence).toFixed(0)}%` : "—"}</td>
                          <td className="px-4 py-3"><RiskBadge level={s.risk_level as "low" | "medium" | "high" | null} /></td>
                          <td className="px-4 py-3 text-right">
                            <Link to="/scans/$scanId" params={{ scanId: s.id }}
                              className="inline-flex items-center gap-1 text-xs text-clinical-blue font-semibold hover:underline">
                              Review <ArrowRight className="size-3" />
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <EmptyCard icon={<CheckCircle className="size-8 text-risk-low" />} title="All caught up"
                body="No scans are waiting for your review right now." />
            )}
          </div>
          {reviewed.length > 0 && (
            <div>
              <SectionHeader title="Recently reviewed" />
              <div className="bg-white border border-border rounded-2xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[400px]">
                    <thead className="bg-secondary/60 text-[10px] uppercase tracking-widest text-muted-foreground">
                      <tr>
                        <th className="text-left px-4 py-3 font-semibold">Date</th>
                        <th className="text-left px-4 py-3 font-semibold">Patient</th>
                        <th className="text-left px-4 py-3 font-semibold">Prediction</th>
                        <th className="text-left px-4 py-3 font-semibold">Risk</th>
                        <th className="px-4 py-3" />
                      </tr>
                    </thead>
                    <tbody>
                      {reviewed.slice(0, 5).map((s) => (
                        <tr key={s.id} className="border-t border-border hover:bg-secondary/40 opacity-70 transition-colors">
                          <td className="px-4 py-3 font-mono text-xs">{new Date(s.created_at).toLocaleDateString()}</td>
                          <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{s.user_id.slice(0, 8)}…</td>
                          <td className="px-4 py-3 font-medium">{s.prediction ?? "—"}</td>
                          <td className="px-4 py-3"><RiskBadge level={s.risk_level as "low" | "medium" | "high" | null} /></td>
                          <td className="px-4 py-3 text-right">
                            <Link to="/scans/$scanId" params={{ scanId: s.id }}
                              className="text-xs text-muted-foreground hover:text-clinical-blue transition-colors">View →</Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-5">
          <div>
            <SectionHeader title="Upcoming appointments" linkTo="/appointments" linkLabel="Manage all" />
            {pendingAppointments && pendingAppointments.length > 0 ? (
              <div className="space-y-2">
                {pendingAppointments.map((a) => {
                  const dt = new Date(a.scheduled_at);
                  const isPending = a.status === "pending";
                  return (
                    <Link key={a.id} to="/appointments"
                      className={`flex items-center gap-3 bg-white border rounded-2xl p-3 hover:shadow-sm transition-all duration-200 ${
                        isPending ? "border-amber-200 bg-amber-50/40 hover:border-amber-300" : "border-border hover:border-clinical-blue/30"
                      }`}>
                      <div className="shrink-0 w-11 text-center bg-clinical-blue/8 rounded-xl py-1.5">
                        <div className="text-[9px] font-mono uppercase text-clinical-blue">{dt.toLocaleString("default", { month: "short" })}</div>
                        <div className="text-base font-bold leading-none">{dt.getDate()}</div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold truncate">Patient {(a.user_id as string).slice(0, 6)}…</div>
                        <div className="text-[10px] text-muted-foreground">{dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border shrink-0 ${
                        isPending ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-green-50 text-green-700 border-green-200"
                      }`}>{isPending ? "Pending" : "Confirmed"}</span>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="bg-white border border-border rounded-2xl p-4 text-center">
                <Calendar className="size-5 text-muted-foreground mx-auto mb-1.5" />
                <p className="text-xs text-muted-foreground">No upcoming appointments.</p>
              </div>
            )}
          </div>
          <div className="bg-white border border-border rounded-2xl p-5 shadow-sm">
            <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-4">Workload</p>
            <WorkloadBar label="Reviewed"  value={stats?.reviewed ?? 0} total={stats?.total ?? 1} color="bg-risk-low" />
            <WorkloadBar label="Pending"   value={stats?.pending  ?? 0} total={stats?.total ?? 1} color="bg-risk-mid" />
            <WorkloadBar label="High risk" value={stats?.highRisk ?? 0} total={stats?.total ?? 1} color="bg-risk-high" />
          </div>
          <div>
            <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-3">Quick actions</p>
            <div className="space-y-2">
              <QuickAction to="/doctor"       icon={<Stethoscope className="size-4" />}   label="Open review queue" />
              <QuickAction to="/appointments" icon={<Calendar className="size-4" />}      label="Manage appointments" />
              <QuickAction to="/messages"     icon={<MessageSquare className="size-4" />} label="Patient messages" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── ADMIN DASHBOARD ──────────────────────────────────────────────────────────
function AdminDashboard() {
  const { data: stats } = useQuery({
    queryKey: ["admin-dashboard-stats"],
    queryFn: async () => {
      const [scansRes, profilesRes, roleRows, riskRows, statusRows] = await Promise.all([
        supabase.from("scans").select("id", { count: "exact", head: true }),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("user_roles").select("role"),
        supabase.from("scans").select("risk_level").not("risk_level", "is", null),
        supabase.from("scans").select("status"),
      ]);
      const byRole   = (roleRows.data ?? []).reduce<Record<string, number>>((a, r) => { a[r.role] = (a[r.role] ?? 0) + 1; return a; }, {});
      const byRisk   = (riskRows.data ?? []).reduce<Record<string, number>>((a, r) => { if (r.risk_level) a[r.risk_level] = (a[r.risk_level] ?? 0) + 1; return a; }, {});
      const byStatus = (statusRows.data ?? []).reduce<Record<string, number>>((a, r) => { a[r.status] = (a[r.status] ?? 0) + 1; return a; }, {});
      return { totalUsers: profilesRes.count ?? 0, totalScans: scansRes.count ?? 0,
        doctors: byRole.doctor ?? 0, admins: byRole.admin ?? 0, patients: byRole.patient ?? 0,
        highRisk: byRisk.high ?? 0, medRisk: byRisk.medium ?? 0, lowRisk: byRisk.low ?? 0,
        completed: byStatus.completed ?? 0, reviewed: byStatus.reviewed ?? 0,
        analyzing: byStatus.analyzing ?? 0, failed: byStatus.failed ?? 0, pending: byStatus.pending ?? 0 };
    },
  });
  const { data: recentScans } = useQuery({
    queryKey: ["admin-recent-scans"],
    queryFn: async () => {
      const { data, error } = await supabase.from("scans")
        .select("id, prediction, risk_level, status, created_at, user_id")
        .order("created_at", { ascending: false }).limit(8);
      if (error) throw error;
      return data;
    },
  });
  const { data: recentUsers } = useQuery({
    queryKey: ["admin-recent-users"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles")
        .select("id, full_name, created_at").order("created_at", { ascending: false }).limit(5);
      if (error) throw error;
      return data;
    },
  });
  const totalScans = stats?.totalScans ?? 1;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-widest text-clinical-blue mb-1">System administration</p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Admin Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">Platform-wide metrics, user management, and system health.</p>
        </div>
        <Link to="/admin" className="btn-primary self-start sm:self-auto">
          <ShieldCheck className="size-4" /> Admin panel
        </Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <StatCard label="Total users"  value={stats?.totalUsers ?? 0} icon={<Users className="size-4" />} gradient="blue" />
        <StatCard label="Total scans"  value={stats?.totalScans ?? 0} icon={<Activity className="size-4" />} gradient="green" />
        <StatCard label="Doctors"      value={stats?.doctors    ?? 0} icon={<Stethoscope className="size-4" />} gradient="amber" />
        <StatCard label="High-risk"    value={stats?.highRisk   ?? 0} icon={<AlertTriangle className="size-4" />} gradient="red" accent={(stats?.highRisk ?? 0) > 0} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <div className="bg-white border border-border rounded-2xl p-5 shadow-sm">
            <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-4">Scan status breakdown</p>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
              {[
                { label: "Completed", value: stats?.completed ?? 0, color: "text-risk-low",       bg: "bg-risk-low/8" },
                { label: "Reviewed",  value: stats?.reviewed  ?? 0, color: "text-clinical-blue",  bg: "bg-clinical-blue/8" },
                { label: "Pending",   value: stats?.pending   ?? 0, color: "text-muted-foreground", bg: "bg-secondary" },
                { label: "Analyzing", value: stats?.analyzing ?? 0, color: "text-risk-mid",        bg: "bg-risk-mid/8" },
                { label: "Failed",    value: stats?.failed    ?? 0, color: "text-risk-high",       bg: "bg-risk-high/8" },
              ].map((item) => (
                <div key={item.label} className={`text-center p-3 ${item.bg} rounded-xl`}>
                  <div className={`text-2xl font-bold ${item.color}`}>{item.value}</div>
                  <div className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground mt-1">{item.label}</div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <SectionHeader title="Recent scans (all patients)" linkTo="/admin" linkLabel="Full admin panel" />
            <div className="bg-white border border-border rounded-2xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[500px]">
                  <thead className="bg-secondary/60 text-[10px] uppercase tracking-widest text-muted-foreground">
                    <tr>
                      <th className="text-left px-4 py-3 font-semibold">Date</th>
                      <th className="text-left px-4 py-3 font-semibold">User</th>
                      <th className="text-left px-4 py-3 font-semibold">Prediction</th>
                      <th className="text-left px-4 py-3 font-semibold">Risk</th>
                      <th className="text-left px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {(recentScans ?? []).map((s) => (
                      <tr key={s.id} className="border-t border-border hover:bg-clinical-blue/3 transition-colors">
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{new Date(s.created_at).toLocaleDateString()}</td>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{s.user_id.slice(0, 8)}…</td>
                        <td className="px-4 py-3 font-medium">{s.prediction ?? "—"}</td>
                        <td className="px-4 py-3"><RiskBadge level={s.risk_level as "low" | "medium" | "high" | null} /></td>
                        <td className="px-4 py-3"><StatusPill status={s.status} /></td>
                        <td className="px-4 py-3 text-right">
                          <Link to="/scans/$scanId" params={{ scanId: s.id }}
                            className="inline-flex items-center gap-1 text-xs text-clinical-blue font-semibold hover:underline">
                            View <ArrowRight className="size-3" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <div className="bg-white border border-border rounded-2xl p-5 shadow-sm">
            <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-4">User roles</p>
            <WorkloadBar label="Patients" value={stats?.patients ?? 0} total={stats?.totalUsers ?? 1} color="bg-clinical-blue" />
            <WorkloadBar label="Doctors"  value={stats?.doctors  ?? 0} total={stats?.totalUsers ?? 1} color="bg-risk-low" />
            <WorkloadBar label="Admins"   value={stats?.admins   ?? 0} total={stats?.totalUsers ?? 1} color="bg-risk-mid" />
          </div>
          <div className="bg-white border border-border rounded-2xl p-5 shadow-sm">
            <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-4">Risk distribution</p>
            <WorkloadBar label="Low risk"    value={stats?.lowRisk  ?? 0} total={totalScans} color="bg-risk-low" />
            <WorkloadBar label="Medium risk" value={stats?.medRisk  ?? 0} total={totalScans} color="bg-risk-mid" />
            <WorkloadBar label="High risk"   value={stats?.highRisk ?? 0} total={totalScans} color="bg-risk-high" />
          </div>
          <div>
            <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-3">Recent sign-ups</p>
            <div className="space-y-2">
              {(recentUsers ?? []).map((u) => (
                <div key={u.id} className="bg-white border border-border rounded-xl px-4 py-3 flex items-center gap-3 hover:border-clinical-blue/30 hover:shadow-sm transition-all duration-200">
                  <div className="size-8 rounded-xl bg-gradient-to-br from-clinical-blue/20 to-clinical-blue/8 text-clinical-blue flex items-center justify-center text-xs font-bold shrink-0">
                    {(u.full_name ?? u.id)[0].toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{u.full_name ?? "Unnamed user"}</div>
                    <div className="text-[10px] font-mono text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white border border-border rounded-2xl p-5 shadow-sm">
            <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-3">System health</p>
            <div className="space-y-2.5 text-xs">
              {[
                { label: "AI model",    value: "gemini-2.5-flash", status: null },
                { label: "AI gateway",  value: "● Operational",    status: "ok" },
                { label: "Database",    value: "● Operational",    status: "ok" },
              ].map((item) => (
                <div key={item.label} className="flex justify-between items-center">
                  <span className="text-muted-foreground">{item.label}</span>
                  <span className={`font-mono font-semibold ${item.status === "ok" ? "text-risk-low" : ""}`}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── SHARED COMPONENTS ────────────────────────────────────────────────────────
type GradientType = "blue" | "green" | "amber" | "red";
const gradientMap: Record<GradientType, string> = {
  blue:  "from-clinical-blue/10 to-clinical-blue/4 border-clinical-blue/15",
  green: "from-risk-low/10 to-risk-low/4 border-risk-low/15",
  amber: "from-risk-mid/10 to-risk-mid/4 border-risk-mid/15",
  red:   "from-risk-high/10 to-risk-high/4 border-risk-high/15",
};
const iconColorMap: Record<GradientType, string> = {
  blue:  "text-clinical-blue",
  green: "text-risk-low",
  amber: "text-risk-mid",
  red:   "text-risk-high",
};

function StatCard({ label, value, icon, accent, positive, gradient = "blue" }: {
  label: string; value: number | string; icon?: React.ReactNode;
  accent?: boolean; positive?: boolean; gradient?: GradientType;
}) {
  return (
    <div className={`bg-gradient-to-br ${gradientMap[gradient]} border rounded-2xl p-4 sm:p-5 hover:shadow-md transition-all duration-200`}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground leading-tight">{label}</p>
        {icon && <div className={`${iconColorMap[gradient]} opacity-70`}>{icon}</div>}
      </div>
      <div className={`text-2xl sm:text-3xl font-bold tracking-tight ${accent ? "text-risk-high" : positive ? "text-risk-low" : "text-foreground"}`}>
        {value}
      </div>
    </div>
  );
}

function SectionHeader({ title, linkTo, linkLabel, badge }: {
  title: string; linkTo?: string; linkLabel?: string; badge?: number;
}) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <h2 className="font-bold text-base">{title}</h2>
        {badge !== undefined && badge > 0 && (
          <span className="text-[10px] font-bold px-2 py-0.5 bg-risk-high/10 text-risk-high rounded-full">{badge}</span>
        )}
      </div>
      {linkTo && linkLabel && (
        <Link to={linkTo} className="text-xs text-clinical-blue font-semibold hover:underline flex items-center gap-1">
          {linkLabel} <ArrowRight className="size-3" />
        </Link>
      )}
    </div>
  );
}

function WorkloadBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="mb-3 last:mb-0">
      <div className="flex justify-between text-xs mb-1.5">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono font-semibold">{value} <span className="text-muted-foreground font-normal">({pct}%)</span></span>
      </div>
      <div className="h-2 bg-secondary rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    completed: "bg-risk-low/10 text-risk-low",
    reviewed:  "bg-clinical-blue/10 text-clinical-blue",
    analyzing: "bg-risk-mid/10 text-risk-mid",
    pending:   "bg-secondary text-muted-foreground",
    failed:    "bg-risk-high/10 text-risk-high",
  };
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg uppercase tracking-wide ${map[status] ?? "bg-secondary text-muted-foreground"}`}>
      {status}
    </span>
  );
}

function QuickAction({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <Link to={to}
      className="flex items-center gap-3 px-4 py-3 bg-white border border-border rounded-xl text-sm font-medium
                 hover:border-clinical-blue/40 hover:bg-clinical-blue/3 hover:text-clinical-blue
                 hover:shadow-sm transition-all duration-200 group">
      <span className="text-muted-foreground group-hover:text-clinical-blue transition-colors">{icon}</span>
      <span className="flex-1">{label}</span>
      <ArrowRight className="size-3.5 text-muted-foreground/30 group-hover:text-clinical-blue group-hover:translate-x-0.5 transition-all" />
    </Link>
  );
}

function EmptyCard({ icon, title, body, action }: {
  icon: React.ReactNode; title: string; body: string; action?: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-border rounded-2xl p-8 sm:p-10 text-center">
      <div className="flex justify-center mb-3">{icon}</div>
      <h3 className="font-bold mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground mb-4">{body}</p>
      {action}
    </div>
  );
}

// Suppress unused import warning
const _TrendingUp = TrendingUp;
void _TrendingUp;
