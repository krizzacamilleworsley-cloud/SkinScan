import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { RiskBadge } from "@/components/scan-ui";
import { AlertTriangle, CheckCircle, Clock, Filter, ArrowRight, Stethoscope } from "lucide-react";

export const Route = createFileRoute("/_app/doctor")({ component: DoctorPortal });

type QueueFilter = "needs_review" | "reviewed" | "all";

function DoctorPortal() {
  const { roles, loading } = useAuth();
  const navigate = useNavigate();
  const [filter, setFilter]       = useState<QueueFilter>("needs_review");
  const [riskFilter, setRiskFilter] = useState("all");

  useEffect(() => {
    if (!loading && !roles.includes("doctor") && !roles.includes("admin")) navigate({ to: "/dashboard" });
  }, [roles, loading, navigate]);

  const { data: scans, isLoading } = useQuery({
    queryKey: ["doctor-queue", filter],
    queryFn: async () => {
      const q = supabase.from("scans")
        .select("id, prediction, confidence, risk_level, status, created_at, user_id, body_location, doctor_review")
        .order("risk_level", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(100);
      if (filter === "needs_review") q.eq("status", "completed");
      else if (filter === "reviewed") q.eq("status", "reviewed");
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const filtered         = (scans ?? []).filter((s) => riskFilter === "all" || s.risk_level === riskFilter);
  const needsReviewCount = (scans ?? []).filter((s) => s.status === "completed").length;

  const filterTabs: { id: QueueFilter; label: string; icon: React.ReactNode }[] = [
    { id: "needs_review", label: "Needs review", icon: <Clock className="size-3.5" /> },
    { id: "reviewed",     label: "Reviewed",     icon: <CheckCircle className="size-3.5" /> },
    { id: "all",          label: "All scans",    icon: <Filter className="size-3.5" /> },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-widest text-clinical-blue mb-1">Clinician workspace</p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Review Queue</h1>
          <p className="text-muted-foreground text-sm mt-1">Review AI-analysed scans and submit your clinical assessment.</p>
        </div>
        {needsReviewCount > 0 && (
          <div className="flex items-center gap-2.5 px-4 py-2.5 bg-risk-high/8 border border-risk-high/20 rounded-xl self-start sm:self-auto">
            <div className="size-2 rounded-full bg-risk-high animate-pulse" />
            <span className="text-sm font-semibold text-risk-high">
              {needsReviewCount} scan{needsReviewCount !== 1 ? "s" : ""} awaiting review
            </span>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-5">
        <div className="flex gap-1 bg-secondary rounded-xl p-1 w-full sm:w-auto">
          {filterTabs.map((f) => (
            <button key={f.id} onClick={() => setFilter(f.id)}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all duration-150 ${
                filter === f.id ? "bg-white text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}>
              {f.icon} {f.label}
              {f.id === "needs_review" && needsReviewCount > 0 && (
                <span className="ml-1 size-4 flex items-center justify-center rounded-full bg-risk-high text-white text-[9px] font-bold">{needsReviewCount}</span>
              )}
            </button>
          ))}
        </div>
        <select className="border border-border rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-clinical-blue/25 w-full sm:w-auto"
          value={riskFilter} onChange={(e) => setRiskFilter(e.target.value)}>
          <option value="all">All risk levels</option>
          <option value="high">High risk</option>
          <option value="medium">Medium risk</option>
          <option value="low">Low risk</option>
        </select>
      </div>

      {/* Queue */}
      <div className="bg-white border border-border rounded-2xl overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="p-8 space-y-3">
            {[1,2,3,4,5].map((i) => <div key={i} className="skeleton h-12 rounded-xl" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <div className="size-14 rounded-2xl bg-risk-low/10 flex items-center justify-center mx-auto mb-3">
              <CheckCircle className="size-7 text-risk-low" />
            </div>
            <div className="font-semibold text-sm mb-1">
              {filter === "needs_review" ? "All caught up!" : "No scans found."}
            </div>
            <p className="text-xs text-muted-foreground">
              {filter === "needs_review" ? "No scans are waiting for your review right now." : "Try a different filter."}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm min-w-[600px]">
                <thead className="bg-gradient-to-r from-secondary to-secondary/60 text-[10px] uppercase tracking-widest text-muted-foreground">
                  <tr>
                    <th className="text-left px-5 py-3 font-semibold">Date</th>
                    <th className="text-left px-5 py-3 font-semibold">Patient</th>
                    <th className="text-left px-5 py-3 font-semibold">AI prediction</th>
                    <th className="text-left px-5 py-3 font-semibold">Location</th>
                    <th className="text-left px-5 py-3 font-semibold">Conf.</th>
                    <th className="text-left px-5 py-3 font-semibold">Risk</th>
                    <th className="text-left px-5 py-3 font-semibold">Status</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s) => (
                    <tr key={s.id} className={`border-t border-border transition-colors ${
                      s.risk_level === "high" && s.status === "completed"
                        ? "bg-risk-high/3 hover:bg-risk-high/6"
                        : "hover:bg-clinical-blue/3"
                    }`}>
                      <td className="px-5 py-3.5 font-mono text-xs text-muted-foreground">{new Date(s.created_at).toLocaleDateString()}</td>
                      <td className="px-5 py-3.5 font-mono text-xs text-muted-foreground">{(s.user_id as string).slice(0, 8)}…</td>
                      <td className="px-5 py-3.5 font-medium">{s.prediction ?? "—"}</td>
                      <td className="px-5 py-3.5 text-muted-foreground text-xs">{s.body_location ?? "—"}</td>
                      <td className="px-5 py-3.5 font-mono text-xs">{s.confidence ? `${Number(s.confidence).toFixed(0)}%` : "—"}</td>
                      <td className="px-5 py-3.5"><RiskBadge level={s.risk_level as "low" | "medium" | "high" | null} /></td>
                      <td className="px-5 py-3.5"><StatusPill status={s.status} /></td>
                      <td className="px-5 py-3.5 text-right">
                        <Link to="/scans/$scanId" params={{ scanId: s.id }}
                          className={`inline-flex items-center gap-1 text-xs font-semibold hover:underline transition-colors ${
                            s.status === "completed" ? "text-clinical-blue" : "text-muted-foreground hover:text-clinical-blue"
                          }`}>
                          {s.status === "completed" ? "Review" : "View"} <ArrowRight className="size-3" />
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
                <div key={s.id} className={`p-4 ${s.risk_level === "high" && s.status === "completed" ? "bg-risk-high/3" : ""}`}>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{s.prediction ?? "—"}</p>
                      <p className="text-xs text-muted-foreground font-mono mt-0.5">
                        Patient {(s.user_id as string).slice(0, 8)}… · {new Date(s.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <RiskBadge level={s.risk_level as "low" | "medium" | "high" | null} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <StatusPill status={s.status} />
                      {s.confidence && <span className="text-[10px] font-mono text-muted-foreground">{Number(s.confidence).toFixed(0)}%</span>}
                    </div>
                    <Link to="/scans/$scanId" params={{ scanId: s.id }}
                      className="inline-flex items-center gap-1 text-xs text-clinical-blue font-semibold">
                      {s.status === "completed" ? "Review" : "View"} <ArrowRight className="size-3" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {filtered.length > 0 && (
        <p className="text-xs text-muted-foreground mt-3 text-right">
          Showing {filtered.length} scan{filtered.length !== 1 ? "s" : ""}
          {riskFilter !== "all" ? ` · ${riskFilter} risk` : ""}
        </p>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { cls: string; dot: string }> = {
    completed: { cls: "bg-risk-low/10 text-risk-low border-risk-low/20",         dot: "bg-risk-low" },
    reviewed:  { cls: "bg-clinical-blue/10 text-clinical-blue border-clinical-blue/20", dot: "bg-clinical-blue" },
    analyzing: { cls: "bg-risk-mid/10 text-risk-mid border-risk-mid/20",         dot: "bg-risk-mid" },
    pending:   { cls: "bg-secondary text-muted-foreground border-border",        dot: "bg-muted-foreground" },
    failed:    { cls: "bg-risk-high/10 text-risk-high border-risk-high/20",      dot: "bg-risk-high" },
  };
  const v = map[status] ?? map.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-lg border uppercase tracking-wide ${v.cls}`}>
      <span className={`size-1.5 rounded-full ${v.dot}`} />{status}
    </span>
  );
}

// Suppress unused import
const _Stethoscope = Stethoscope; void _Stethoscope;
