import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { User, Bell, Shield, Trash2, Eye, EyeOff, CheckCircle } from "lucide-react";

export const Route = createFileRoute("/_app/settings")({ component: SettingsPage });

interface Profile { id: string; full_name: string | null; phone: string | null; avatar_url: string | null }
type Tab = "profile" | "notifications" | "security";

function SettingsPage() {
  const [tab, setTab] = useState<Tab>("profile");
  const tabs: { id: Tab; label: string; icon: typeof User }[] = [
    { id: "profile",       label: "Profile",       icon: User },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "security",      label: "Security",      icon: Shield },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto">
      <div className="mb-6">
        <p className="text-[10px] font-mono uppercase tracking-widest text-clinical-blue mb-1">Account</p>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage your profile, notifications, and security preferences.</p>
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
      {tab === "profile"       && <ProfileTab />}
      {tab === "notifications" && <NotificationsTab />}
      {tab === "security"      && <SecurityTab />}
    </div>
  );
}

// ── Profile tab ───────────────────────────────────────────────────────────────

function ProfileTab() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user!.id)
        .single();
      if (error) throw error;
      return data as Profile;
    },
    enabled: !!user,
  });

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name ?? "");
      setPhone(profile.phone ?? "");
    }
  }, [profile]);

  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("profiles")
        .upsert({
          id: user!.id,
          full_name: fullName.trim() || null,
          phone: phone.trim() || null,
          updated_at: new Date().toISOString(),
        });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile", user?.id] });
      toast.success("Profile updated");
    },
    onError: () => toast.error("Failed to update profile"),
  });

  return (
    <Card title="Personal information" description="Update your name and contact details.">
      <form
        onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}
        className="space-y-5"
      >
        <Field label="Email address">
          <input
            className="input-base bg-secondary cursor-not-allowed"
            value={user?.email ?? ""}
            disabled
          />
          <p className="text-[10px] text-muted-foreground mt-1">
            Email cannot be changed here. Contact support if needed.
          </p>
        </Field>
        <Field label="Full name">
          <input
            className="input-base"
            placeholder="Your full name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
        </Field>
        <Field label="Phone number">
          <input
            className="input-base"
            placeholder="+1 555 000 0000"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </Field>
        <div className="pt-1">
          <button type="submit" disabled={mutation.isPending} className="btn-primary">
            {mutation.isPending ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
    </Card>
  );
}

// ── Notifications tab ─────────────────────────────────────────────────────────

interface NotifPrefs {
  scan_completed: boolean;
  appointment_reminder: boolean;
  new_message: boolean;
  doctor_review: boolean;
  marketing: boolean;
}

const DEFAULT_PREFS: NotifPrefs = {
  scan_completed: true,
  appointment_reminder: true,
  new_message: true,
  doctor_review: true,
  marketing: false,
};

function NotificationsTab() {
  const { user } = useAuth();
  const STORAGE_KEY = `notif_prefs_${user?.id}`;

  const [prefs, setPrefs] = useState<NotifPrefs>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? (JSON.parse(stored) as NotifPrefs) : DEFAULT_PREFS;
    } catch {
      return DEFAULT_PREFS;
    }
  });
  const [saved, setSaved] = useState(false);

  const toggle = (key: keyof NotifPrefs) =>
    setPrefs((p) => ({ ...p, [key]: !p[key] }));

  const save = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    setSaved(true);
    toast.success("Notification preferences saved");
    setTimeout(() => setSaved(false), 2000);
  };

  const items: { key: keyof NotifPrefs; label: string; desc: string }[] = [
    { key: "scan_completed",       label: "Scan analysis complete",    desc: "Notify when your AI analysis finishes." },
    { key: "appointment_reminder", label: "Appointment reminders",     desc: "Remind you 24 hours before an appointment." },
    { key: "new_message",          label: "New messages",              desc: "Notify when a clinician replies to you." },
    { key: "doctor_review",        label: "Doctor review complete",    desc: "Notify when a doctor reviews your scan." },
    { key: "marketing",            label: "Product updates & tips",    desc: "Occasional tips and feature announcements." },
  ];

  return (
    <Card title="Notification preferences" description="Choose what you want to be notified about.">
      <div className="space-y-4">
        {items.map((item) => (
          <div key={item.key} className="flex items-start justify-between gap-4 py-3 border-b border-border last:border-0">
            <div>
              <div className="text-sm font-medium">{item.label}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{item.desc}</div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={prefs[item.key]}
              onClick={() => toggle(item.key)}
              className={`relative shrink-0 w-10 h-5 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-clinical-blue/30 ${
                prefs[item.key] ? "bg-clinical-blue" : "bg-border"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 size-4 bg-white rounded-full shadow transition-transform ${
                  prefs[item.key] ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        ))}
      </div>
      <div className="pt-4">
        <button
          onClick={save}
          className="px-4 py-2 bg-clinical-blue text-white rounded-md text-sm font-medium hover:opacity-90"
        >
          {saved ? "Saved ✓" : "Save preferences"}
        </button>
      </div>
    </Card>
  );
}

// ── Security tab ──────────────────────────────────────────────────────────────

function SecurityTab() {
  const { user, roles, signOut } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [changingPw, setChangingPw] = useState(false);
  const [pwSuccess, setPwSuccess] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteInput, setDeleteInput] = useState("");

  const isDoctor = roles.includes("doctor");

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) return toast.error("Password must be at least 8 characters");
    if (newPassword !== confirmPassword) return toast.error("Passwords do not match");
    if (newPassword === currentPassword) return toast.error("New password must differ from current");
    setChangingPw(true);
    // Re-authenticate first to verify current password
    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email: user?.email ?? "",
      password: currentPassword,
    });
    if (signInErr) {
      setChangingPw(false);
      return toast.error("Current password is incorrect");
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setChangingPw(false);
    if (error) {
      toast.error(error.message);
    } else {
      setPwSuccess(true);
      toast.success("Password updated successfully");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => setPwSuccess(false), 4000);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteInput !== user?.email) return toast.error("Email does not match");
    toast.info("Please contact support to fully delete your account.");
    await signOut();
  };

  return (
    <div className="space-y-6">
      <Card
        title={isDoctor ? "Change your password" : "Change password"}
        description={
          isDoctor
            ? "Update your clinician account password. You'll need your current password to confirm."
            : "Update your account password. You'll need your current password to confirm."
        }
      >
        {pwSuccess && (
          <div className="mb-4 flex items-center gap-2 px-4 py-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700">
            <CheckCircle className="size-4 shrink-0" />
            Password updated successfully. Use your new password next time you sign in.
          </div>
        )}
        <form onSubmit={handlePasswordChange} className="space-y-4">
          <Field label="Current password">
            <div className="relative">
              <input
                type={showPw ? "text" : "password"}
                className="input-base pr-10"
                placeholder="Enter your current password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={showPw ? "Hide password" : "Show password"}
              >
                {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </Field>
          <Field label="New password">
            <input
              type={showPw ? "text" : "password"}
              className="input-base"
              placeholder="At least 8 characters"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
            />
            {newPassword.length > 0 && (
              <PasswordStrength password={newPassword} />
            )}
          </Field>
          <Field label="Confirm new password">
            <input
              type={showPw ? "text" : "password"}
              className={`input-base ${
                confirmPassword && confirmPassword !== newPassword
                  ? "border-risk-high focus:ring-risk-high/20"
                  : ""
              }`}
              placeholder="Repeat new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
            />
            {confirmPassword && confirmPassword !== newPassword && (
              <p className="text-[11px] text-risk-high mt-1">Passwords do not match</p>
            )}
          </Field>
          <button
            type="submit"
            disabled={changingPw || !currentPassword || !newPassword || newPassword !== confirmPassword}
            className="px-4 py-2 bg-clinical-blue text-white rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {changingPw ? "Updating…" : "Update password"}
          </button>
        </form>
      </Card>

      <Card title="Active sessions" description="You are currently signed in on this device.">
        <div className="flex items-center justify-between py-2">
          <div>
            <div className="text-sm font-medium">Current session</div>
            <div className="text-xs text-muted-foreground font-mono">{user?.email}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5 capitalize">
              Role: {roles[0] ?? "patient"}
            </div>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 bg-green-50 text-green-700 border border-green-200 rounded">
            Active
          </span>
        </div>
        <button
          onClick={() =>
            supabase.auth
              .signOut({ scope: "global" })
              .then(() => toast.success("Signed out of all devices"))
          }
          className="mt-3 text-xs text-muted-foreground hover:text-foreground underline"
        >
          Sign out of all devices
        </button>
      </Card>

      <Card title="Danger zone" description="Irreversible actions for your account." danger>
        {!showDeleteConfirm ? (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="flex items-center gap-2 px-4 py-2 border border-red-300 text-red-600 rounded-md text-sm font-medium hover:bg-red-50"
          >
            <Trash2 className="size-4" /> Delete account
          </button>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Type your email <strong>{user?.email}</strong> to confirm deletion.
            </p>
            <input
              className="input-base border-red-300 focus:ring-red-200"
              placeholder={user?.email ?? ""}
              value={deleteInput}
              onChange={(e) => setDeleteInput(e.target.value)}
            />
            <div className="flex gap-3">
              <button
                onClick={handleDeleteAccount}
                className="px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700"
              >
                Confirm deletion
              </button>
              <button
                onClick={() => { setShowDeleteConfirm(false); setDeleteInput(""); }}
                className="px-4 py-2 border border-border rounded-md text-sm font-medium hover:bg-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

// ── Password strength indicator ───────────────────────────────────────────────
function PasswordStrength({ password }: { password: string }) {
  const checks = [
    { label: "8+ characters", ok: password.length >= 8 },
    { label: "Uppercase letter", ok: /[A-Z]/.test(password) },
    { label: "Number", ok: /\d/.test(password) },
    { label: "Special character", ok: /[^A-Za-z0-9]/.test(password) },
  ];
  const score = checks.filter((c) => c.ok).length;
  const colors = ["bg-risk-high", "bg-risk-high", "bg-risk-mid", "bg-risk-mid", "bg-risk-low"];
  const labels = ["", "Weak", "Weak", "Fair", "Strong"];

  return (
    <div className="mt-2">
      <div className="flex gap-1 mb-1">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${
              i < score ? colors[score] : "bg-secondary"
            }`}
          />
        ))}
      </div>
      <div className="flex items-center justify-between">
        <div className="flex gap-3">
          {checks.map((c) => (
            <span key={c.label} className={`text-[10px] ${c.ok ? "text-risk-low" : "text-muted-foreground"}`}>
              {c.ok ? "✓" : "·"} {c.label}
            </span>
          ))}
        </div>
        {score > 0 && (
          <span className={`text-[10px] font-bold ${colors[score].replace("bg-", "text-")}`}>
            {labels[score]}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Shared helpers ────────────────────────────────────────────────────────────

function Card({
  title, description, children, danger,
}: { title: string; description: string; children: React.ReactNode; danger?: boolean }) {
  return (
    <div className={`bg-white border rounded-2xl p-5 sm:p-6 shadow-sm ${danger ? "border-red-200" : "border-border"}`}>
      <div className="mb-5">
        <h2 className={`font-bold text-base ${danger ? "text-red-600" : ""}`}>{title}</h2>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1.5">{label}</label>
      {children}
    </div>
  );
}
