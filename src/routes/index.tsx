import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { ArrowRight, Microscope, Shield, Stethoscope, ScanLine } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  const { user, loading } = useAuth();
  if (!loading && user) return <Navigate to="/dashboard" />;

  return (
    <div className="min-h-screen bg-clinical-bg">
      {/* Nav */}
      <header className="border-b border-border bg-white">
        <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-lg overflow-hidden shrink-0">
              <img src="/skinscan-logo.png" alt="SkinScan AI" className="size-full object-cover" />
            </div>
            <span className="font-bold tracking-tight">SkinScan AI</span>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/auth" className="text-sm text-muted-foreground hover:text-foreground">
              Sign in
            </Link>
            <Link
              to="/auth"
              search={{ mode: "signup" }}
              className="text-sm font-medium px-4 py-2 bg-clinical-blue text-white rounded-md"
            >
              Get started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-7xl px-6 py-24 grid lg:grid-cols-12 gap-12 items-center">
        <div className="lg:col-span-7">
          <div className="font-mono text-[10px] uppercase tracking-widest text-clinical-blue mb-4">
            Clinical Decision Support — v1.0
          </div>
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight leading-[1.05] text-balance">
            AI-assisted skin analysis,<br />built for clinical rigor.
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-xl text-pretty">
            Upload a dermatology image, receive structured findings, differential
            diagnoses and care recommendations. Reviewed by your clinician.
          </p>
          <div className="mt-8 flex gap-3">
            <Link
              to="/auth"
              search={{ mode: "signup" }}
              className="inline-flex items-center gap-2 px-5 py-3 bg-clinical-blue text-white rounded-md font-medium"
            >
              Start a scan <ArrowRight className="size-4" />
            </Link>
            <Link
              to="/auth"
              className="inline-flex items-center px-5 py-3 border border-border rounded-md font-medium bg-white"
            >
              I have an account
            </Link>
          </div>
          <p className="mt-6 text-xs text-muted-foreground max-w-md">
            AI-generated analysis is not a medical diagnosis. Always consult a licensed
            dermatologist for medical decisions.
          </p>
        </div>

        <div className="lg:col-span-5">
          <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
            <div className="font-mono text-[10px] uppercase tracking-widest text-clinical-blue mb-4">
              How it works
            </div>
            <ol className="space-y-5">
              {[
                { icon: ScanLine, t: "Capture or upload", d: "Photograph the area in good light." },
                { icon: Microscope, t: "AI analysis", d: "Structured findings in seconds." },
                { icon: Stethoscope, t: "Clinician review", d: "Doctors verify before action." },
                { icon: Shield, t: "Stay informed", d: "Track changes over time." },
              ].map((s, i) => (
                <li key={i} className="flex gap-4">
                  <div className="size-10 rounded-lg bg-clinical-blue/5 text-clinical-blue flex items-center justify-center shrink-0">
                    <s.icon className="size-5" />
                  </div>
                  <div>
                    <div className="font-semibold text-sm">{s.t}</div>
                    <div className="text-xs text-muted-foreground">{s.d}</div>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>
    </div>
  );
}
