import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Disclaimer, RiskBadge } from "@/components/scan-ui";
import { useAuth } from "@/lib/auth";
import { analyzeScan, submitDoctorReview } from "@/lib/scans.functions";
import { toast } from "sonner";
import { ArrowLeft, Stethoscope, RefreshCw, CheckCircle, Loader2, User, Calendar, MapPin } from "lucide-react";

export const Route = createFileRoute("/_app/scans/$scanId")({ component: ScanDetail });

type Diff = { name: string; probability: number };
type Rec  = { title: string; detail: string; urgency: "routine" | "soon" | "urgent" };

function ScanDetail() {
  const { scanId }    = Route.useParams();
  const { roles, user } = useAuth();
  const navigate      = useNavigate();
  const qc            = useQueryClient();
  const isClinician   = roles.includes("doctor") || roles.includes("admin");

  const [imgUrl, setImgUrl]         = useState<string | null>(null);
  const [reviewText, setReviewText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [reanalyzing, setReanalyzing] = useState(false);

  const analyze      = useServerFn(analyzeScan);
  const submitReview = useServerFn(submitDoctorReview);

  const { data: scan, isLoading } = useQuery({
    queryKey: ["scan", scanId],
    queryFn: async () => {
      const { data, error } = await supabase.from("scans").select("*").eq("id", scanId).single();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!scan?.image_path) return;
    supabase.storage.from("scan-images").createSignedUrl(scan.image_path, 60 * 30)
      .then(({ data }) => setImgUrl(data?.signedUrl ?? null));
  }, [scan?.image_path]);

  useEffect(() => {
    if (scan?.doctor_review) setReviewText(scan.doctor_review as string);
  }, [scan?.doctor_review]);

  const handleReanalyze = async () => {
    setReanalyzing(true);
    try {
      await analyze({ data: { scanId } });
      toast.success("Re-analysis complete");
      qc.invalidateQueries({ queryKey: ["scan", scanId] });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Re-analysis failed");
    } finally { setReanalyzing(false); }
  };

  const handleSubmitReview = async () => {
    if (!reviewText.trim()) return toast.error("Review cannot be empty");
    setSubmitting(true);
    try {
      await submitReview({ data: { scanId, review: reviewText } });
      toast.success("Review submitted");
      qc.invalidateQueries({ queryKey: ["scan", scanId] });
      qc.invalidateQueries({ queryKey: ["doctor-queue"] });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to submit review");
    } finally { setSubmitting(false); }
  };

  if (isLoading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="size-8 border-2 border-clinical-blue/30 border-t-clinical-blue rounded-full animate-spin" />
    </div>
  );
  if (!scan) return <div className="p-8 text-sm text-muted-foreground">Scan not found.</div>;

  const isOwner = scan.user_id === user?.id;
  if (!isClinician && !isOwner) {
    return (
      <div className="p-8 max-w-md mx-auto text-center mt-20">
        <div className="size-14 rounded-2xl bg-risk-high/10 flex items-center justify-center mx-auto mb-4">
          <Stethoscope className="size-7 text-risk-high" />
        </div>
        <h2 className="font-bold text-lg mb-2">Access denied</h2>
        <p className="text-sm text-muted-foreground mb-6">You can only view your own scan results.</p>
        <Link to="/scans" className="btn-primary inline-flex"><ArrowLeft className="size-4" /> Back to my scans</Link>
      </div>
    );
  }

  const conf  = Number(scan.confidence ?? 0);
  const diffs = (scan.differential    as Diff[] | null) ?? [];
  const recs  = (scan.recommendations as Rec[]  | null) ?? [];
  const backTo    = isClinician ? "/doctor" : "/scans";
  const backLabel = isClinician ? "Review queue" : "All scans";

  const urgencyStyle: Record<string, string> = {
    urgent:  "bg-risk-high/10 text-risk-high border-risk-high/20",
    soon:    "bg-risk-mid/10 text-risk-mid border-risk-mid/20",
    routine: "bg-risk-low/10 text-risk-low border-risk-low/20",
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <Link to={backTo} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="size-4" /> {backLabel}
        </Link>
        <div className="flex items-center gap-2 flex-wrap">
          <StatusBadge status={scan.status} />
          {(isClinician || (isOwner && scan.status === "failed")) && (
            <button onClick={handleReanalyze} disabled={reanalyzing || scan.status === "analyzing"}
              className="btn-ghost text-xs px-3 py-1.5">
              {reanalyzing ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}
              Re-analyze
            </button>
          )}
        </div>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 mb-5">
        {/* Image + AI result */}
        <div className="lg:col-span-8 bg-white border border-border rounded-2xl overflow-hidden shadow-sm">
          <div className="flex flex-col sm:flex-row">
            {/* Image */}
            <div className="relative sm:w-2/5 bg-secondary shrink-0 min-h-48">
              {imgUrl ? (
                <img src={imgUrl} alt="scan" className="w-full h-full object-cover" />
              ) : (
                <div className="size-full flex items-center justify-center text-xs text-muted-foreground min-h-48">
                  <div className="skeleton size-full absolute inset-0" />
                </div>
              )}
              <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-lg text-[10px] text-white font-mono">
                {scan.id.slice(0, 8).toUpperCase()}
              </div>
              {isClinician && (
                <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-lg text-[10px] text-white font-mono flex items-center gap-1">
                  <User className="size-3" /> {(scan.user_id as string).slice(0, 8)}…
                </div>
              )}
            </div>

            {/* AI result */}
            <div className="p-5 sm:p-6 flex-1 min-w-0">
              <div className="flex justify-between items-start mb-4 gap-2 flex-wrap">
                <div>
                  <p className="text-[10px] font-bold text-clinical-blue uppercase tracking-widest mb-1">AI assessment</p>
                  <h2 className="text-xl sm:text-2xl font-bold tracking-tight">{scan.prediction ?? "—"}</h2>
                  {scan.body_location && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                      <MapPin className="size-3" />{scan.body_location as string}
                    </div>
                  )}
                </div>
                <RiskBadge level={scan.risk_level as "low" | "medium" | "high" | null} />
              </div>

              {/* Confidence bar */}
              <div className="mb-4">
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-muted-foreground font-medium">Confidence</span>
                  <span className="text-clinical-blue font-bold font-mono">{conf.toFixed(1)}%</span>
                </div>
                <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-clinical-blue to-clinical-blue/80 rounded-full transition-all duration-700"
                    style={{ width: `${conf}%` }} />
                </div>
              </div>

              {scan.explanation && (
                <div className="p-3.5 bg-gradient-to-br from-clinical-blue/5 to-clinical-blue/3 border border-clinical-blue/12 rounded-xl">
                  <p className="text-[10px] font-bold text-clinical-blue uppercase tracking-widest mb-1.5">Explanation</p>
                  <p className="text-xs sm:text-sm leading-relaxed">{scan.explanation as string}</p>
                </div>
              )}

              {scan.notes && (
                <div className="mt-3 p-3 bg-secondary/60 rounded-xl">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Patient notes</p>
                  <p className="text-xs text-muted-foreground italic">{scan.notes as string}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Differential + metadata */}
        <div className="lg:col-span-4 bg-white border border-border rounded-2xl p-5 shadow-sm">
          <h3 className="text-sm font-bold mb-4">Differential diagnosis</h3>
          <div className="space-y-3">
            {diffs.map((d, i) => (
              <div key={i}>
                <div className="flex justify-between text-xs mb-1">
                  <span className={`font-medium ${i === 0 ? "text-foreground" : "text-muted-foreground"}`}>{d.name}</span>
                  <span className="font-mono text-muted-foreground">{d.probability.toFixed(0)}%</span>
                </div>
                <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${d.probability}%`, backgroundColor: i === 0 ? "var(--color-clinical-blue)" : "var(--color-muted-foreground)", opacity: i === 0 ? 1 : 0.35 }} />
                </div>
              </div>
            ))}
            {diffs.length === 0 && <p className="text-xs text-muted-foreground">No differentials available.</p>}
          </div>

          <div className="mt-5 pt-4 border-t border-border space-y-2.5">
            <MetaRow icon={<Calendar className="size-3" />} label="Date" value={new Date(scan.created_at).toLocaleDateString()} />
            <MetaRow icon={<div className="size-3" />} label="Status" value={scan.status} />
            {scan.reviewed_at && (
              <MetaRow icon={<CheckCircle className="size-3 text-risk-low" />} label="Reviewed"
                value={new Date(scan.reviewed_at as string).toLocaleDateString()} />
            )}
          </div>
        </div>
      </div>

      {/* Recommendations */}
      {recs.length > 0 && (
        <section className="mb-5">
          <h3 className="text-base font-bold mb-3">Recommendations</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {recs.map((r, i) => (
              <div key={i} className="bg-white border border-border rounded-2xl p-4 sm:p-5 hover:shadow-sm transition-all duration-200">
                <div className="flex justify-between items-start mb-2">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Protocol {String.fromCharCode(65 + i)}</p>
                  <span className={`text-[10px] font-bold uppercase tracking-tight px-2 py-0.5 rounded-lg border ${urgencyStyle[r.urgency]}`}>{r.urgency}</span>
                </div>
                <div className="font-bold text-sm mb-1">{r.title}</div>
                <p className="text-xs text-muted-foreground leading-relaxed">{r.detail}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Doctor review */}
      {isClinician ? (
        <div className="bg-white border border-border rounded-2xl p-5 sm:p-6 mb-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <div className="size-8 rounded-xl bg-clinical-blue/10 flex items-center justify-center">
              <Stethoscope className="size-4 text-clinical-blue" />
            </div>
            <p className="text-[10px] font-bold text-clinical-blue uppercase tracking-widest">Clinician review</p>
            {scan.status === "reviewed" && (
              <span className="ml-auto flex items-center gap-1.5 text-[10px] font-bold text-risk-low bg-risk-low/10 border border-risk-low/20 px-2.5 py-1 rounded-lg">
                <CheckCircle className="size-3" /> Reviewed
              </span>
            )}
          </div>
          <textarea className="input-base resize-none mb-3" rows={5}
            placeholder="Write your clinical assessment, notes, and recommendations for the patient…"
            value={reviewText} onChange={(e) => setReviewText(e.target.value)} />
          <div className="flex items-center gap-3 flex-wrap">
            <button onClick={handleSubmitReview} disabled={submitting || !reviewText.trim()} className="btn-primary">
              {submitting
                ? <><Loader2 className="size-4 animate-spin" /> Submitting…</>
                : <><CheckCircle className="size-4" /> {scan.status === "reviewed" ? "Update review" : "Submit review"}</>}
            </button>
            <span className="text-xs text-muted-foreground">This will mark the scan as reviewed and notify the patient.</span>
          </div>
        </div>
      ) : scan.doctor_review ? (
        <div className="bg-white border border-border rounded-2xl p-5 sm:p-6 mb-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className="size-8 rounded-xl bg-clinical-blue/10 flex items-center justify-center">
              <Stethoscope className="size-4 text-clinical-blue" />
            </div>
            <p className="text-[10px] font-bold text-clinical-blue uppercase tracking-widest">Clinician review</p>
            {scan.reviewed_at && (
              <span className="ml-auto text-[10px] text-muted-foreground font-mono">
                {new Date(scan.reviewed_at as string).toLocaleDateString()}
              </span>
            )}
          </div>
          <p className="text-sm leading-relaxed">{scan.doctor_review as string}</p>
        </div>
      ) : null}

      <Disclaimer />
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { cls: string; dot: string }> = {
    completed: { cls: "bg-risk-low/10 text-risk-low border-risk-low/20",         dot: "bg-risk-low" },
    reviewed:  { cls: "bg-clinical-blue/10 text-clinical-blue border-clinical-blue/20", dot: "bg-clinical-blue" },
    analyzing: { cls: "bg-risk-mid/10 text-risk-mid border-risk-mid/20",         dot: "bg-risk-mid animate-pulse" },
    pending:   { cls: "bg-secondary text-muted-foreground border-border",        dot: "bg-muted-foreground/50" },
    failed:    { cls: "bg-risk-high/10 text-risk-high border-risk-high/20",      dot: "bg-risk-high" },
  };
  const v = map[status] ?? map.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-lg border uppercase tracking-wide ${v.cls}`}>
      <span className={`size-1.5 rounded-full ${v.dot}`} />{status}
    </span>
  );
}

function MetaRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex justify-between items-center text-xs">
      <span className="flex items-center gap-1.5 text-muted-foreground">{icon}{label}</span>
      <span className="font-mono font-medium capitalize">{value}</span>
    </div>
  );
}

// Suppress unused import
const _navigate = useNavigate; void _navigate;
