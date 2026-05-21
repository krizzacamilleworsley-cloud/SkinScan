import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Eye, EyeOff, Activity, Shield, Stethoscope } from "lucide-react";

const search = z.object({ mode: z.enum(["signin", "signup"]).optional() });
export const Route = createFileRoute("/auth")({ validateSearch: search, component: AuthPage });

function AuthPage() {
  const { mode: initialMode } = Route.useSearch();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [mode, setMode]         = useState<"signin" | "signup">(initialMode ?? "signin");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPw, setShowPw]     = useState(false);
  const [busy, setBusy]         = useState(false);

  useEffect(() => { if (user) navigate({ to: "/dashboard" }); }, [user, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: window.location.origin + "/dashboard", data: { full_name: fullName } },
        });
        if (error) throw error;
        toast.success("Account created — you're signed in.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Authentication failed");
    } finally { setBusy(false); }
  };

  const google = async () => {
    setBusy(true);
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/dashboard" });
    if (r.error) { toast.error(r.error.message ?? "Google sign-in failed"); setBusy(false); }
  };

  return (
    <div className="min-h-screen flex bg-clinical-bg">
      {/* ── Form side ─────────────────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm fade-in-up">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-10">
            <div className="size-10 rounded-xl overflow-hidden shadow-lg shadow-clinical-blue/25 shrink-0">
              <img src="/skinscan-logo.png" alt="SkinScan AI" className="size-full object-cover" />
            </div>
            <div>
              <div className="font-bold tracking-tight text-foreground">SkinScan AI</div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Clinical Suite</div>
            </div>
          </div>

          <p className="text-[10px] font-mono uppercase tracking-widest text-clinical-blue mb-1.5">
            {mode === "signup" ? "Create account" : "Welcome back"}
          </p>
          <h1 className="text-2xl font-bold tracking-tight mb-2">
            {mode === "signup" ? "Sign up to start scanning" : "Sign in to your account"}
          </h1>
          <p className="text-sm text-muted-foreground mb-8">
            {mode === "signup"
              ? "Join SkinScan AI for AI-powered dermatology triage."
              : "Access your clinical dashboard and scan history."}
          </p>

          {/* Google */}
          <button onClick={google} disabled={busy}
            className="w-full mb-4 px-4 py-2.5 border border-border bg-white rounded-xl text-sm font-medium
                       hover:bg-secondary hover:border-clinical-blue/30 hover:shadow-sm
                       active:scale-[0.99] transition-all duration-150 disabled:opacity-50 flex items-center justify-center gap-2.5">
            <svg className="size-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </button>

          <div className="relative my-6 flex items-center gap-3">
            <div className="flex-1 h-px bg-border" />
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">or</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <form onSubmit={submit} className="space-y-3.5">
            {mode === "signup" && (
              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">Full name</label>
                <input type="text" required placeholder="Your full name" value={fullName}
                  onChange={(e) => setFullName(e.target.value)} className="input-base" />
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">Email address</label>
              <input type="email" required placeholder="you@example.com" value={email}
                onChange={(e) => setEmail(e.target.value)} className="input-base" />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">Password</label>
              <div className="relative">
                <input type={showPw ? "text" : "password"} required minLength={8}
                  placeholder="Min. 8 characters" value={password}
                  onChange={(e) => setPassword(e.target.value)} className="input-base pr-10" />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                  {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
            <button disabled={busy} className="btn-primary w-full justify-center mt-1">
              {busy ? (
                <span className="flex items-center gap-2">
                  <span className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Please wait…
                </span>
              ) : mode === "signup" ? "Create account" : "Sign in"}
            </button>
          </form>

          <button onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="mt-5 text-xs text-muted-foreground hover:text-foreground transition-colors w-full text-center">
            {mode === "signin"
              ? <>Don't have an account? <span className="text-clinical-blue font-semibold">Sign up</span></>
              : <>Have an account? <span className="text-clinical-blue font-semibold">Sign in</span></>}
          </button>
        </div>
      </div>

      {/* ── Visual side ───────────────────────────────────────────────────── */}
      <div className="hidden lg:flex w-[480px] bg-sidebar flex-col items-center justify-center p-12 relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 bg-gradient-to-br from-clinical-blue/20 via-transparent to-transparent pointer-events-none" />
        <div className="absolute top-0 right-0 size-64 bg-clinical-blue/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 size-48 bg-risk-low/10 rounded-full translate-y-1/2 -translate-x-1/2 blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-xs text-center">
          {/* Scan animation */}
          <div className="aspect-square w-48 mx-auto rounded-3xl bg-white/6 border border-white/12 flex items-center justify-center relative overflow-hidden mb-8 shadow-2xl">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-clinical-blue to-transparent scan-line" />
            <div className="text-center">
              <Activity className="size-12 text-clinical-blue/60 mx-auto mb-2" />
              <div className="text-[10px] font-mono uppercase tracking-widest text-white/40">AI Analysis</div>
            </div>
          </div>

          <h2 className="text-2xl font-bold text-white mb-3 tracking-tight">
            Clinical-grade AI<br />dermatology triage
          </h2>
          <p className="text-sm text-white/50 leading-relaxed mb-8">
            Powered by Gemini 2.5 Flash. Instant skin lesion analysis with risk stratification and clinical recommendations.
          </p>

          {/* Feature pills */}
          <div className="flex flex-wrap justify-center gap-2">
            {[
              { icon: <Activity className="size-3" />, label: "AI Analysis" },
              { icon: <Shield className="size-3" />,   label: "Secure & Private" },
              { icon: <Stethoscope className="size-3" />, label: "Clinician Review" },
            ].map((f) => (
              <span key={f.label} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/8 border border-white/12 rounded-full text-[11px] font-medium text-white/70">
                {f.icon} {f.label}
              </span>
            ))}
          </div>
        </div>

        <p className="absolute bottom-6 left-6 right-6 text-[10px] text-white/25 text-center leading-relaxed">
          SkinScan AI does not provide a medical diagnosis. All results are clinical decision support and must be reviewed by a licensed dermatologist.
        </p>
      </div>
    </div>
  );
}
