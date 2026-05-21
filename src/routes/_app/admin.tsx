import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import {
  Users, Activity, ShieldCheck, AlertTriangle, Download,
  FileText, TrendingUp, RefreshCw, Search, ChevronDown,
} from "lucide-react";

export const Route = createFileRoute("/_app/admin")({ component: AdminPanel });

type AdminTab = "overview" | "users" | "reports";

interface UserRow {
  id: string;
  full_name: string | null;
  created_at: string;
  roles: string[];
}

function AdminPanel() {
  const { roles, loading } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<AdminTab>("overview");

  useEffect(() => {
    if (!loading && !roles.includes("admin")) navigate({ to: "/dashboard" });
  }, [roles, loading, navigate]);

  const tabs: { id: AdminTab; label: string; icon: typeof Users }[] = [
    { id: "overview", label: "Overview",  icon: Activity },
    { id: "users",    label: "Users",     icon: Users },
    { id: "reports",  label: "Reports",   icon: FileText },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <p className="text-[10px] font-mono uppercase tracking-widest text-clinical-blue mb-1">Administration</p>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Admin Panel</h1>
        <p className="text-muted-foreground text-sm mt-1">Platform management, analytics, and reporting.</p>
      </div>

      <div className="flex gap-1 bg-secondary rounded-xl p-1 mb-6 w-full sm:w-fit overflow-x-auto">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150 whitespace-nowrap ${
              tab === t.id ? "bg-white text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}>
            <t.icon className="size-4" />{t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && <OverviewTab />}
      {tab === "users"    && <UsersTab />}
      {tab === "reports"  && <ReportsTab />}
    </div>
  );
}

// ── Overview tab ──────────────────────────────────────────────────────────────
function OverviewTab() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const [scansRes, profilesRes, roleRows, statusRows, riskRows, predRows] = await Promise.all([
        supabase.from("scans").select("id", { count: "exact", head: true }),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("user_roles").select("role"),
        supabase.from("scans").select("status"),
        supabase.from("scans").select("risk_level").not("risk_level", "is", null),
        supabase.from("scans").select("prediction").not("prediction", "is", null),
      ]);
      const byRole   = tally((roleRows.data   ?? []).map((r) => r.role));
      const byStatus = tally((statusRows.data ?? []).map((r) => r.status));
      const byRisk   = tally((riskRows.data   ?? []).map((r) => r.risk_level as string));
      const byPred   = tally((predRows.data   ?? []).map((r) => r.prediction as string));
      const topConditions = Object.entries(byPred)
        .sort((a, b) => b[1] - a[1]).slice(0, 6)
        .map(([name, count]) => ({ name, count }));
      return { totalUsers: profilesRes.count ?? 0, totalScans: scansRes.count ?? 0, byRole, byStatus, byRisk, topConditions };
    },
  });

  const total = stats?.totalScans ?? 1;
  const totalUsers = stats?.totalUsers ?? 1;

  if (isLoading) return (
    <div className="space-y-4">
      {[1,2,3].map((i) => <div key={i} className="skeleton h-24 rounded-2xl" />)}
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Top stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[
          { label: "Total users",  value: stats?.totalUsers ?? 0, icon: <Users className="size-4" />,         gradient: "from-clinical-blue/10 to-clinical-blue/4 border-clinical-blue/15",  text: "text-clinical-blue" },
          { label: "Total scans",  value: stats?.totalScans ?? 0, icon: <Activity className="size-4" />,      gradient: "from-risk-low/10 to-risk-low/4 border-risk-low/15",               text: "text-risk-low" },
          { label: "Doctors",      value: stats?.byRole.doctor ?? 0, icon: <ShieldCheck className="size-4" />, gradient: "from-risk-mid/10 to-risk-mid/4 border-risk-mid/15",              text: "text-risk-mid" },
          { label: "High-risk",    value: stats?.byRisk.high ?? 0, icon: <AlertTriangle className="size-4" />, gradient: "from-risk-high/10 to-risk-high/4 border-risk-high/15",           text: "text-risk-high" },
        ].map((s) => (
          <div key={s.label} className={`bg-gradient-to-br ${s.gradient} border rounded-2xl p-4 sm:p-5 hover:shadow-md transition-all duration-200`}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">{s.label}</p>
              <div className={s.text}>{s.icon}</div>
            </div>
            <div className={`text-2xl sm:text-3xl font-bold tracking-tight ${s.text}`}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Scan status */}
        <div className="bg-white border border-border rounded-2xl p-5 shadow-sm">
          <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-4">Scan status breakdown</p>
          {[
            { key: "completed", label: "Completed", color: "bg-risk-low" },
            { key: "reviewed",  label: "Reviewed",  color: "bg-clinical-blue" },
            { key: "pending",   label: "Pending",   color: "bg-muted-foreground/30" },
            { key: "analyzing", label: "Analyzing", color: "bg-risk-mid" },
            { key: "failed",    label: "Failed",    color: "bg-risk-high" },
          ].map((item) => (
            <BarRow key={item.key} label={item.label} value={stats?.byStatus[item.key] ?? 0} total={total} color={item.color} />
          ))}
        </div>

        {/* Risk distribution */}
        <div className="bg-white border border-border rounded-2xl p-5 shadow-sm">
          <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-4">Risk distribution</p>
          <BarRow label="Low risk"    value={stats?.byRisk.low    ?? 0} total={total} color="bg-risk-low" />
          <BarRow label="Medium risk" value={stats?.byRisk.medium ?? 0} total={total} color="bg-risk-mid" />
          <BarRow label="High risk"   value={stats?.byRisk.high   ?? 0} total={total} color="bg-risk-high" />
          <div className="mt-5 pt-4 border-t border-border">
            <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-3">User roles</p>
            <BarRow label="Patients" value={stats?.byRole.patient ?? 0} total={totalUsers} color="bg-clinical-blue" />
            <BarRow label="Doctors"  value={stats?.byRole.doctor  ?? 0} total={totalUsers} color="bg-risk-low" />
            <BarRow label="Admins"   value={stats?.byRole.admin   ?? 0} total={totalUsers} color="bg-risk-mid" />
          </div>
        </div>

        {/* Top conditions + system health */}
        <div className="space-y-4">
          <div className="bg-white border border-border rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="size-4 text-clinical-blue" />
              <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Top conditions</p>
            </div>
            <div className="space-y-2">
              {(stats?.topConditions ?? []).map((c, i) => (
                <div key={c.name} className="flex items-center gap-3">
                  <span className="text-[10px] font-mono text-muted-foreground w-4 shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between text-xs mb-0.5">
                      <span className="font-medium truncate">{c.name}</span>
                      <span className="font-mono text-muted-foreground shrink-0 ml-2">{c.count}</span>
                    </div>
                    <div className="h-1 bg-secondary rounded-full overflow-hidden">
                      <div className="h-full bg-clinical-blue/60 rounded-full"
                        style={{ width: `${Math.round((c.count / total) * 100)}%` }} />
                    </div>
                  </div>
                </div>
              ))}
              {(stats?.topConditions ?? []).length === 0 && (
                <p className="text-xs text-muted-foreground">No data yet.</p>
              )}
            </div>
          </div>
          <div className="bg-white border border-border rounded-2xl p-5 shadow-sm">
            <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-3">System health</p>
            <div className="space-y-2.5 text-xs">
              {[
                { label: "AI model",   value: "gemini-2.5-flash", ok: false },
                { label: "AI gateway", value: "Operational",      ok: true },
                { label: "Database",   value: "Operational",      ok: true },
                { label: "Auth",       value: "Operational",      ok: true },
              ].map((r) => (
                <div key={r.label} className="flex justify-between items-center">
                  <span className="text-muted-foreground">{r.label}</span>
                  <span className={`font-semibold ${r.ok ? "text-risk-low" : "font-mono text-foreground"}`}>
                    {r.ok ? "● " : ""}{r.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Users tab ─────────────────────────────────────────────────────────────────
function UsersTab() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  const { data: users, isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { data: profiles, error } = await supabase.from("profiles")
        .select("id, full_name, created_at").order("created_at", { ascending: false });
      if (error) throw error;
      const { data: roleRows } = await supabase.from("user_roles").select("user_id, role");
      const roleMap = (roleRows ?? []).reduce<Record<string, string[]>>((a, r) => {
        if (!a[r.user_id]) a[r.user_id] = [];
        a[r.user_id].push(r.role);
        return a;
      }, {});
      return (profiles ?? []).map((p) => ({ ...p, roles: roleMap[p.id] ?? [] })) as UserRow[];
    },
  });

  const changeRole = useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string; newRole: string }) => {
      await supabase.from("user_roles").delete().eq("user_id", userId);
      if (newRole !== "none") {
        const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: newRole });
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-users"] }); toast.success("Role updated"); },
    onError: () => toast.error("Failed to update role"),
  });

  const filtered = (users ?? []).filter((u) => {
    const matchRole = roleFilter === "all" || (u.roles[0] ?? "none") === roleFilter;
    const matchSearch = !search || (u.full_name ?? "").toLowerCase().includes(search.toLowerCase()) || u.id.includes(search);
    return matchRole && matchSearch;
  });

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <input className="w-full pl-10 pr-3.5 py-2.5 border border-border rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-clinical-blue/25 transition-all"
            placeholder="Search by name or ID…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="border border-border rounded-xl px-3.5 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-clinical-blue/25 w-full sm:w-auto"
          value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
          <option value="all">All roles</option>
          <option value="patient">Patients</option>
          <option value="doctor">Doctors</option>
          <option value="admin">Admins</option>
          <option value="none">No role</option>
        </select>
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block bg-white border border-border rounded-2xl overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gradient-to-r from-secondary to-secondary/60 text-[10px] uppercase tracking-widest text-muted-foreground">
            <tr>
              <th className="text-left px-5 py-3 font-semibold">User</th>
              <th className="text-left px-5 py-3 font-semibold">Joined</th>
              <th className="text-left px-5 py-3 font-semibold">Role</th>
              <th className="text-left px-5 py-3 font-semibold">Change role</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={4} className="px-5 py-12 text-center text-muted-foreground">Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={4} className="px-5 py-12 text-center text-muted-foreground text-sm">No users found.</td></tr>
            ) : filtered.map((u) => (
              <tr key={u.id} className="border-t border-border hover:bg-clinical-blue/3 transition-colors">
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="size-9 rounded-xl bg-gradient-to-br from-clinical-blue/20 to-clinical-blue/8 text-clinical-blue flex items-center justify-center text-xs font-bold shrink-0">
                      {(u.full_name ?? u.id)[0].toUpperCase()}
                    </div>
                    <div>
                      <div className="font-medium text-sm">{u.full_name ?? "Unnamed"}</div>
                      <div className="text-[10px] font-mono text-muted-foreground">{u.id.slice(0, 14)}…</div>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3.5 font-mono text-xs text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</td>
                <td className="px-5 py-3.5"><RoleBadge role={u.roles[0] ?? "none"} /></td>
                <td className="px-5 py-3.5">
                  <div className="relative inline-block">
                    <select className="appearance-none border border-border rounded-xl px-3 py-1.5 pr-7 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-clinical-blue/25 cursor-pointer"
                      value={u.roles[0] ?? "none"}
                      onChange={(e) => changeRole.mutate({ userId: u.id, newRole: e.target.value })}>
                      <option value="none">No role</option>
                      <option value="patient">Patient</option>
                      <option value="doctor">Doctor</option>
                      <option value="admin">Admin</option>
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 size-3 text-muted-foreground pointer-events-none" />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="sm:hidden space-y-3">
        {isLoading ? (
          [1,2,3].map((i) => <div key={i} className="skeleton h-20 rounded-2xl" />)
        ) : filtered.map((u) => (
          <div key={u.id} className="bg-white border border-border rounded-2xl p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="size-10 rounded-xl bg-gradient-to-br from-clinical-blue/20 to-clinical-blue/8 text-clinical-blue flex items-center justify-center text-sm font-bold shrink-0">
                {(u.full_name ?? u.id)[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm truncate">{u.full_name ?? "Unnamed"}</div>
                <div className="text-[10px] font-mono text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</div>
              </div>
              <RoleBadge role={u.roles[0] ?? "none"} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Change role:</span>
              <select className="border border-border rounded-xl px-3 py-1.5 text-xs bg-white focus:outline-none"
                value={u.roles[0] ?? "none"}
                onChange={(e) => changeRole.mutate({ userId: u.id, newRole: e.target.value })}>
                <option value="none">No role</option>
                <option value="patient">Patient</option>
                <option value="doctor">Doctor</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>
        ))}
      </div>

      {filtered.length > 0 && (
        <p className="text-xs text-muted-foreground mt-3 text-right">{filtered.length} user{filtered.length !== 1 ? "s" : ""}</p>
      )}
    </div>
  );
}

// ── Reports tab ───────────────────────────────────────────────────────────────
function ReportsTab() {
  const printRef = useRef<HTMLDivElement>(null);

  const { data: reportData, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["admin-report"],
    queryFn: async () => {
      const [scansRes, profilesRes, roleRows, statusRows, riskRows, predRows, recentScans] = await Promise.all([
        supabase.from("scans").select("id", { count: "exact", head: true }),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("user_roles").select("role"),
        supabase.from("scans").select("status"),
        supabase.from("scans").select("risk_level").not("risk_level", "is", null),
        supabase.from("scans").select("prediction").not("prediction", "is", null),
        supabase.from("scans").select("id, prediction, risk_level, status, created_at, confidence")
          .order("created_at", { ascending: false }).limit(20),
      ]);
      const byRole   = tally((roleRows.data   ?? []).map((r) => r.role));
      const byStatus = tally((statusRows.data ?? []).map((r) => r.status));
      const byRisk   = tally((riskRows.data   ?? []).map((r) => r.risk_level as string));
      const byPred   = tally((predRows.data   ?? []).map((r) => r.prediction as string));
      const topConditions = Object.entries(byPred).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, count]) => ({ name, count }));
      return {
        generatedAt: new Date().toLocaleString(),
        totalUsers: profilesRes.count ?? 0,
        totalScans: scansRes.count ?? 0,
        byRole, byStatus, byRisk, topConditions,
        recentScans: recentScans.data ?? [],
      };
    },
  });

  const handlePrint = () => {
    if (!printRef.current) return;
    const content = printRef.current.innerHTML;
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) return;
    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>SkinScan AI — Analytics Report</title>
        <meta charset="utf-8" />
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1a1a2e; background: #fff; font-size: 11px; }
          .report-page { max-width: 800px; margin: 0 auto; padding: 40px; }
          .report-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; padding-bottom: 20px; border-bottom: 2px solid #2563eb; }
          .report-logo { display: flex; align-items: center; gap: 12px; }
          .report-logo-icon { width: 40px; height: 40px; background: linear-gradient(135deg, #2563eb, #1d4ed8); border-radius: 10px; display: flex; align-items: center; justify-content: center; color: white; font-weight: 800; font-size: 18px; }
          .report-logo-text h1 { font-size: 18px; font-weight: 800; color: #1a1a2e; }
          .report-logo-text p { font-size: 10px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.1em; margin-top: 2px; }
          .report-meta { text-align: right; }
          .report-meta h2 { font-size: 14px; font-weight: 700; color: #2563eb; }
          .report-meta p { font-size: 10px; color: #6b7280; margin-top: 4px; }
          .section { margin-bottom: 28px; }
          .section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; color: #6b7280; margin-bottom: 12px; padding-bottom: 6px; border-bottom: 1px solid #e5e7eb; }
          .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
          .stat-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; }
          .stat-label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.1em; color: #94a3b8; margin-bottom: 6px; }
          .stat-value { font-size: 24px; font-weight: 800; color: #1a1a2e; }
          .stat-value.blue  { color: #2563eb; }
          .stat-value.green { color: #16a34a; }
          .stat-value.amber { color: #d97706; }
          .stat-value.red   { color: #dc2626; }
          .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
          .three-col { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; }
          .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; }
          .card-title { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #6b7280; margin-bottom: 12px; }
          .bar-row { margin-bottom: 8px; }
          .bar-label { display: flex; justify-content: space-between; font-size: 10px; margin-bottom: 3px; }
          .bar-label span:first-child { color: #374151; }
          .bar-label span:last-child { color: #6b7280; font-family: monospace; }
          .bar-track { height: 6px; background: #e5e7eb; border-radius: 99px; overflow: hidden; }
          .bar-fill { height: 100%; border-radius: 99px; }
          .bar-blue  { background: #2563eb; }
          .bar-green { background: #16a34a; }
          .bar-amber { background: #d97706; }
          .bar-red   { background: #dc2626; }
          .bar-gray  { background: #9ca3af; }
          .condition-row { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
          .condition-rank { font-size: 9px; font-family: monospace; color: #9ca3af; width: 14px; }
          .condition-name { flex: 1; font-size: 10px; font-weight: 500; }
          .condition-count { font-size: 10px; font-family: monospace; color: #6b7280; }
          table { width: 100%; border-collapse: collapse; font-size: 10px; }
          th { text-align: left; padding: 8px 10px; background: #f1f5f9; font-size: 9px; text-transform: uppercase; letter-spacing: 0.08em; color: #6b7280; font-weight: 700; }
          td { padding: 8px 10px; border-bottom: 1px solid #f1f5f9; color: #374151; }
          tr:last-child td { border-bottom: none; }
          .badge { display: inline-block; padding: 2px 7px; border-radius: 6px; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
          .badge-low    { background: #dcfce7; color: #16a34a; }
          .badge-medium { background: #fef3c7; color: #d97706; }
          .badge-high   { background: #fee2e2; color: #dc2626; }
          .badge-completed { background: #dcfce7; color: #16a34a; }
          .badge-reviewed  { background: #dbeafe; color: #2563eb; }
          .badge-pending   { background: #f1f5f9; color: #6b7280; }
          .badge-analyzing { background: #fef3c7; color: #d97706; }
          .badge-failed    { background: #fee2e2; color: #dc2626; }
          .report-footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e7eb; display: flex; justify-content: space-between; font-size: 9px; color: #9ca3af; }
          .disclaimer { background: #fef9c3; border: 1px solid #fde68a; border-radius: 8px; padding: 10px 14px; font-size: 9px; color: #92400e; margin-top: 20px; }
          @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
        </style>
      </head>
      <body>
        <div class="report-page">
          ${content}
        </div>
        <script>window.onload = function() { window.print(); }<\/script>
      </body>
      </html>
    `);
    win.document.close();
  };

  const total = reportData?.totalScans ?? 1;

  return (
    <div>
      {/* Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-5">
        <div>
          <h2 className="font-bold text-base">Analytics Report</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {reportData ? `Generated: ${reportData.generatedAt}` : "Click refresh to generate"}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => refetch()} disabled={isFetching}
            className="btn-ghost text-sm">
            <RefreshCw className={`size-4 ${isFetching ? "animate-spin" : ""}`} />
            {isFetching ? "Generating…" : "Refresh"}
          </button>
          <button onClick={handlePrint} disabled={!reportData || isLoading}
            className="btn-primary">
            <Download className="size-4" /> Download PDF
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1,2,3].map((i) => <div key={i} className="skeleton h-32 rounded-2xl" />)}
        </div>
      ) : !reportData ? (
        <div className="bg-white border border-border rounded-2xl p-12 text-center">
          <FileText className="size-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm font-semibold mb-1">No report generated yet</p>
          <p className="text-xs text-muted-foreground">Click "Refresh" to generate the analytics report.</p>
        </div>
      ) : (
        /* ── Printable report ── */
        <div className="bg-white border border-border rounded-2xl overflow-hidden shadow-sm">
          <div ref={printRef} className="p-6 sm:p-8">
            {/* Report header */}
            <div className="report-header flex justify-between items-start pb-5 mb-6 border-b-2 border-clinical-blue">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl overflow-hidden shrink-0">
                  <img src="/skinscan-logo.png" alt="SkinScan AI" className="size-full object-cover" />
                </div>
                <div>
                  <h1 className="font-bold text-lg text-foreground">SkinScan AI</h1>
                  <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Clinical Suite</p>
                </div>
              </div>
              <div className="text-right">
                <h2 className="font-bold text-base text-clinical-blue">Analytics Report</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Generated: {reportData.generatedAt}</p>
                <p className="text-[10px] font-mono text-muted-foreground">Oriental Mindoro, Philippines</p>
              </div>
            </div>

            {/* Summary stats */}
            <div className="section mb-6">
              <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-3 pb-1.5 border-b border-border">Platform Summary</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "Total users",  value: reportData.totalUsers, cls: "text-clinical-blue" },
                  { label: "Total scans",  value: reportData.totalScans, cls: "text-risk-low" },
                  { label: "Reviewed",     value: reportData.byStatus.reviewed ?? 0, cls: "text-clinical-blue" },
                  { label: "High-risk",    value: reportData.byRisk.high ?? 0, cls: "text-risk-high" },
                ].map((s) => (
                  <div key={s.label} className="bg-secondary/50 border border-border rounded-xl p-3.5">
                    <p className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground mb-1.5">{s.label}</p>
                    <p className={`text-2xl font-bold ${s.cls}`}>{s.value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Charts row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              {/* Scan status */}
              <div className="bg-secondary/30 border border-border rounded-xl p-4">
                <p className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground mb-3">Scan status</p>
                {[
                  { key: "completed", label: "Completed", color: "bg-risk-low",         pct: Math.round(((reportData.byStatus.completed ?? 0) / total) * 100) },
                  { key: "reviewed",  label: "Reviewed",  color: "bg-clinical-blue",    pct: Math.round(((reportData.byStatus.reviewed  ?? 0) / total) * 100) },
                  { key: "pending",   label: "Pending",   color: "bg-muted-foreground/40", pct: Math.round(((reportData.byStatus.pending ?? 0) / total) * 100) },
                  { key: "analyzing", label: "Analyzing", color: "bg-risk-mid",         pct: Math.round(((reportData.byStatus.analyzing ?? 0) / total) * 100) },
                  { key: "failed",    label: "Failed",    color: "bg-risk-high",        pct: Math.round(((reportData.byStatus.failed ?? 0) / total) * 100) },
                ].map((item) => (
                  <div key={item.key} className="mb-2.5 last:mb-0">
                    <div className="flex justify-between text-[10px] mb-1">
                      <span className="text-muted-foreground">{item.label}</span>
                      <span className="font-mono">{reportData.byStatus[item.key] ?? 0} ({item.pct}%)</span>
                    </div>
                    <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                      <div className={`h-full ${item.color} rounded-full`} style={{ width: `${item.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>

              {/* Risk distribution */}
              <div className="bg-secondary/30 border border-border rounded-xl p-4">
                <p className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground mb-3">Risk distribution</p>
                {[
                  { key: "low",    label: "Low risk",    color: "bg-risk-low" },
                  { key: "medium", label: "Medium risk", color: "bg-risk-mid" },
                  { key: "high",   label: "High risk",   color: "bg-risk-high" },
                ].map((item) => {
                  const val = reportData.byRisk[item.key] ?? 0;
                  const pct = Math.round((val / total) * 100);
                  return (
                    <div key={item.key} className="mb-2.5 last:mb-0">
                      <div className="flex justify-between text-[10px] mb-1">
                        <span className="text-muted-foreground">{item.label}</span>
                        <span className="font-mono">{val} ({pct}%)</span>
                      </div>
                      <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                        <div className={`h-full ${item.color} rounded-full`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
                <div className="mt-4 pt-3 border-t border-border">
                  <p className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground mb-2">User roles</p>
                  {[
                    { key: "patient", label: "Patients", color: "bg-clinical-blue" },
                    { key: "doctor",  label: "Doctors",  color: "bg-risk-low" },
                    { key: "admin",   label: "Admins",   color: "bg-risk-mid" },
                  ].map((item) => {
                    const val = reportData.byRole[item.key] ?? 0;
                    const pct = Math.round((val / (reportData.totalUsers || 1)) * 100);
                    return (
                      <div key={item.key} className="mb-2 last:mb-0">
                        <div className="flex justify-between text-[10px] mb-1">
                          <span className="text-muted-foreground">{item.label}</span>
                          <span className="font-mono">{val} ({pct}%)</span>
                        </div>
                        <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                          <div className={`h-full ${item.color} rounded-full`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Top conditions */}
              <div className="bg-secondary/30 border border-border rounded-xl p-4">
                <p className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground mb-3">Top conditions detected</p>
                <div className="space-y-2">
                  {reportData.topConditions.map((c, i) => (
                    <div key={c.name} className="flex items-center gap-2">
                      <span className="text-[9px] font-mono text-muted-foreground w-4 shrink-0">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between text-[10px] mb-0.5">
                          <span className="font-medium truncate">{c.name}</span>
                          <span className="font-mono text-muted-foreground ml-1 shrink-0">{c.count}</span>
                        </div>
                        <div className="h-1 bg-secondary rounded-full overflow-hidden">
                          <div className="h-full bg-clinical-blue/50 rounded-full"
                            style={{ width: `${Math.round((c.count / total) * 100)}%` }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Recent scans table */}
            <div className="mb-6">
              <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-3 pb-1.5 border-b border-border">Recent Scans (Last 20)</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs min-w-[500px]">
                  <thead className="bg-secondary/60 text-[9px] uppercase tracking-widest text-muted-foreground">
                    <tr>
                      <th className="text-left px-3 py-2 font-semibold">Date</th>
                      <th className="text-left px-3 py-2 font-semibold">Prediction</th>
                      <th className="text-left px-3 py-2 font-semibold">Confidence</th>
                      <th className="text-left px-3 py-2 font-semibold">Risk</th>
                      <th className="text-left px-3 py-2 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.recentScans.map((s) => (
                      <tr key={s.id} className="border-t border-border">
                        <td className="px-3 py-2 font-mono text-muted-foreground">{new Date(s.created_at).toLocaleDateString()}</td>
                        <td className="px-3 py-2 font-medium">{s.prediction ?? "—"}</td>
                        <td className="px-3 py-2 font-mono">{s.confidence ? `${Number(s.confidence).toFixed(0)}%` : "—"}</td>
                        <td className="px-3 py-2">
                          {s.risk_level && (
                            <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                              s.risk_level === "high" ? "bg-risk-high/10 text-risk-high" :
                              s.risk_level === "medium" ? "bg-risk-mid/10 text-risk-mid" :
                              "bg-risk-low/10 text-risk-low"
                            }`}>{s.risk_level}</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                            s.status === "reviewed" ? "bg-clinical-blue/10 text-clinical-blue" :
                            s.status === "completed" ? "bg-risk-low/10 text-risk-low" :
                            s.status === "failed" ? "bg-risk-high/10 text-risk-high" :
                            "bg-secondary text-muted-foreground"
                          }`}>{s.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Disclaimer */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-xs text-amber-800">
              <strong>Disclaimer:</strong> This report is generated from SkinScan AI platform data for administrative purposes only.
              AI-generated scan results are clinical decision support tools and do not constitute medical diagnoses.
              All findings must be reviewed by a licensed dermatologist before clinical action is taken.
            </div>

            {/* Footer */}
            <div className="mt-5 pt-4 border-t border-border flex justify-between text-[10px] text-muted-foreground">
              <span>SkinScan AI — Clinical Suite · Oriental Mindoro, Philippines</span>
              <span>Confidential — For administrative use only</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Shared helpers ────────────────────────────────────────────────────────────
function tally(arr: string[]) {
  return arr.reduce<Record<string, number>>((a, v) => { a[v] = (a[v] ?? 0) + 1; return a; }, {});
}

function BarRow({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
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

function RoleBadge({ role }: { role: string }) {
  const map: Record<string, string> = {
    admin:   "bg-risk-high/10 text-risk-high border-risk-high/20",
    doctor:  "bg-risk-low/10 text-risk-low border-risk-low/20",
    patient: "bg-clinical-blue/10 text-clinical-blue border-clinical-blue/20",
    none:    "bg-secondary text-muted-foreground border-border",
  };
  return (
    <span className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-lg border uppercase tracking-wide ${map[role] ?? map.none}`}>
      {role}
    </span>
  );
}

// Suppress unused imports
const _Search = Search; void _Search;
