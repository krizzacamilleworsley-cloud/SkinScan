import { AlertTriangle } from "lucide-react";

export function Disclaimer({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-start gap-3 p-3.5 bg-gradient-to-r from-clinical-blue/6 to-clinical-blue/3 border border-clinical-blue/15 rounded-xl text-xs text-muted-foreground ${className}`}>
      <span className="font-mono text-[9px] font-bold text-clinical-blue border border-clinical-blue/30 bg-clinical-blue/8 px-1.5 py-0.5 rounded-md uppercase tracking-tight shrink-0 mt-0.5">
        Notice
      </span>
      <p className="leading-relaxed">
        AI-generated analysis is <strong className="text-foreground font-semibold">not a medical diagnosis</strong>. Always consult a
        licensed dermatologist before acting on these results.
      </p>
    </div>
  );
}

export function RiskBadge({ level }: { level: "low" | "medium" | "high" | null | undefined }) {
  if (!level) return null;
  const map = {
    low:    { c: "bg-risk-low/10 text-risk-low border border-risk-low/20",     t: "LOW RISK" },
    medium: { c: "bg-risk-mid/10 text-risk-mid border border-risk-mid/20",     t: "MONITOR"  },
    high:   { c: "bg-risk-high/10 text-risk-high border border-risk-high/20",  t: "URGENT"   },
  } as const;
  const v = map[level];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 ${v.c} text-[10px] font-bold rounded-lg`}>
      {level === "high" && <AlertTriangle className="size-2.5" />}
      {v.t}
    </span>
  );
}
