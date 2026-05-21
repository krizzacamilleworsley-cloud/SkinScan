import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { RiskBadge } from "@/components/scan-ui";
import { Plus, Search, ArrowRight, Activity } from "lucide-react";

export const Route = createFileRoute("/_app/scans/")({ component: ScansList });

function ScansList() {
  const { user, roles } = useAuth();
  const isClinician = roles.includes("doctor") || roles.includes("admin");
  const [search, setSearch]           = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: scans, isLoading } = useQuery({
    queryKey: ["scans-all", user?.id, isClinician],
    queryFn: async () => {
      const q = supabase.from("scans")
        .select("id, prediction, confidence, risk_level, status, created_at, body_location, user_id")
        .order("created_at", { ascending: false });
      if (!isClinician) q.eq("user_id", user!.id);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const filtered = (scans ?? []).filter((s) => {
    const matchStatus = statusFilter === "all" || s.status === statusFilter;
    const matchSearch = !search ||
      (s.prediction ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (s.body_location ?? "").toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-widest text-clinical-blue mb-1">
            {isClinician ? "All patients" : "Scan history"}
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            {isClinician ? "All scans" : "My scans"}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {isClinician
              ? `${scans?.length ?? 0} total scans across all patients`
              : `${scans?.length ?? 0} scans in your history`}
          </p>
        </div>
        {!isClinician && (
          <Link to="/scans/new" className="btn-primary self-start sm:self-auto">
            <Plus className="size-4" /> New scan
          </Link>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <input className="w-full pl-10 pr-3.5 py-2.5 border border-border rounded-xl text-sm bg-white
                            focus:outline-none focus:ring-2 focus:ring-clinical-blue/25 focus:border-clinical-blue/50 transition-all"
            placeholder="Search prediction or location…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="border border-border rounded-xl px-3.5 py-2.5 text-sm bg-white
                           focus:outline-none focus:ring-2 focus:ring-clinical-blue/25 w-full sm:w-auto"
          value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">All statuses</option>
          <option value="completed">Completed</option>
          <option value="reviewed">Reviewed</option>
          <option value="analyzing">Analyzing</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white border border-border rounded-2xl overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="p-8 space-y-3">
            {[1,2,3,4,5].map((i) => <div key={i} className="skeleton h-12 rounded-xl" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <div className="size-14 rounded-2xl bg-clinical-blue/8 flex items-center justify-center mx-auto mb-3">
              <Activity className="size-7 text-clinical-blue/50" />
            </div>
            <p className="text-sm font-semibold mb-1">
              {search || statusFilter !== "all" ? "No scans match your filters." : "No scans yet."}
            </p>
            {!isClinician && !search && statusFilter === "all" && (
              <Link to="/scans/new" className="btn-primary inline-flex mt-3">
                <Plus className="size-4" /> Start your first scan
              </Link>
            )}
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm min-w-[600px]">
                <thead className="bg-gradient-to-r from-secondary to-secondary/60 text-[10px] uppercase tracking-widest text-muted-foreground">
                  <tr>
                    <th className="text-left px-5 py-3 font-semibold">Date</th>
                    {isClinician && <th className="text-left px-5 py-3 font-semibold">Patient</th>}
                    <th className="text-left px-5 py-3 font-semibold">Prediction</th>
                    <th className="text-left px-5 py-3 font-semibold">Location</th>
                    <th className="text-left px-5 py-3 font-semibold">Confidence</th>
                    <th className="text-left px-5 py-3 font-semibold">Risk</th>
                    <th className="text-left px-5 py-3 font-semibold">Status</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s) => (
                    <tr key={s.id} className="border-t border-border hover:bg-clinical-blue/3 transition-colors group">
                      <td className="px-5 py-3.5 font-mono text-xs text-muted-foreground">{new Date(s.created_at).toLocaleDateString()}</td>
                      {isClinician && <td className="px-5 py-3.5 font-mono text-xs text-muted-foreground">{(s.user_id as string).slice(0, 8)}…</td>}
                      <td className="px-5 py-3.5">
                        <Link to="/scans/$scanId" params={{ scanId: s.id }}
                          className="font-medium hover:text-clinical-blue transition-colors">
                          {s.prediction ?? "—"}
                        </Link>
                      </td>
                      <td className="px-5 py-3.5 text-muted-foreground text-xs">{s.body_location ?? "—"}</td>
                      <td className="px-5 py-3.5 font-mono text-xs">{s.confidence ? `${Number(s.confidence).toFixed(0)}%` : "—"}</td>
                      <td className="px-5 py-3.5"><RiskBadge level={s.risk_level as "low" | "medium" | "high" | null} /></td>
                      <td className="px-5 py-3.5"><StatusPill status={s.status} /></td>
                      <td className="px-5 py-3.5 text-right">
                        <Link to="/scans/$scanId" params={{ scanId: s.id }}
                          className="inline-flex items-center gap-1 text-xs text-clinical-blue font-semibold hover:underline">
                          {isClinician && s.status === "completed" ? "Review" : "View"} <ArrowRight className="size-3" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="sm:hidden divide-y divide-border">
              {filtered.map((s) => (
                <Link key={s.id} to="/scans/$scanId" params={{ scanId: s.id }}
                  className="flex items-start gap-3 p-4 hover:bg-clinical-blue/3 transition-colors">
                  <div className="size-10 rounded-xl bg-gradient-to-br from-clinical-blue/10 to-clinical-blue/5 flex items-center justify-center shrink-0">
                    <Activity className="size-4 text-clinical-blue" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-sm truncate">{s.prediction ?? "Analyzing…"}</p>
                      <RiskBadge level={s.risk_level as "low" | "medium" | "high" | null} />
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {s.body_location ?? "Unknown location"} · {new Date(s.created_at).toLocaleDateString()}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <StatusPill status={s.status} />
                      {s.confidence && <span className="text-[10px] font-mono text-muted-foreground">{Number(s.confidence).toFixed(0)}%</span>}
                    </div>
                  </div>
                  <ArrowRight className="size-4 text-muted-foreground/40 shrink-0 mt-1" />
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { cls: string; dot: string }> = {
    completed: { cls: "bg-risk-low/10 text-risk-low border-risk-low/20",         dot: "bg-risk-low" },
    reviewed:  { cls: "bg-clinical-blue/10 text-clinical-blue border-clinical-blue/20", dot: "bg-clinical-blue" },
    analyzing: { cls: "bg-risk-mid/10 text-risk-mid border-risk-mid/20",         dot: "bg-risk-mid" },
    pending:   { cls: "bg-secondary text-muted-foreground border-border",        dot: "bg-muted-foreground/50" },
    failed:    { cls: "bg-risk-high/10 text-risk-high border-risk-high/20",      dot: "bg-risk-high" },
  };
  const v = map[status] ?? map.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-lg border uppercase tracking-wide ${v.cls}`}>
      <span className={`size-1.5 rounded-full ${v.dot}`} />{status}
    </span>
  );
}
