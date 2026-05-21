import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { User, Mail, Shield, Calendar } from "lucide-react";

export const Route = createFileRoute("/_app/profile")({ component: ProfilePage });

function ProfilePage() {
  const { user, roles } = useAuth();

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user!.id).single();
      return data;
    },
    enabled: !!user,
  });

  const roleLabel = roles.includes("admin") ? "Admin" : roles.includes("doctor") ? "Doctor" : "Patient";
  const roleColor = roles.includes("admin")
    ? "bg-risk-high/10 text-risk-high border-risk-high/20"
    : roles.includes("doctor")
    ? "bg-risk-low/10 text-risk-low border-risk-low/20"
    : "bg-clinical-blue/10 text-clinical-blue border-clinical-blue/20";

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto">
      <div className="mb-6">
        <p className="text-[10px] font-mono uppercase tracking-widest text-clinical-blue mb-1">Account</p>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Profile</h1>
        <p className="text-muted-foreground text-sm mt-1">Your account information and role details.</p>
      </div>

      {/* Avatar card */}
      <div className="bg-white border border-border rounded-2xl p-6 mb-4 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="size-16 rounded-2xl bg-gradient-to-br from-clinical-blue/20 to-clinical-blue/8 flex items-center justify-center text-clinical-blue font-bold text-2xl shrink-0">
            {(profile?.full_name ?? user?.email ?? "?")[0].toUpperCase()}
          </div>
          <div>
            <div className="font-bold text-lg">{profile?.full_name ?? "Unnamed user"}</div>
            <div className="text-sm text-muted-foreground">{user?.email}</div>
            <span className={`inline-flex items-center gap-1.5 mt-1.5 text-[10px] font-bold px-2.5 py-1 rounded-lg border ${roleColor}`}>
              <Shield className="size-3" /> {roleLabel}
            </span>
          </div>
        </div>
      </div>

      {/* Details */}
      <div className="bg-white border border-border rounded-2xl p-6 shadow-sm space-y-4">
        <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-widest font-mono text-[10px]">Account details</h2>
        {[
          { icon: <User className="size-4" />,     label: "Full name",  value: profile?.full_name ?? "Not set" },
          { icon: <Mail className="size-4" />,     label: "Email",      value: user?.email ?? "" },
          { icon: <Shield className="size-4" />,   label: "Role",       value: roleLabel },
          { icon: <Calendar className="size-4" />, label: "Member since", value: user?.created_at ? new Date(user.created_at).toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" }) : "—" },
        ].map((row) => (
          <div key={row.label} className="flex items-center gap-3 py-2.5 border-b border-border last:border-0">
            <div className="size-8 rounded-xl bg-secondary flex items-center justify-center text-muted-foreground shrink-0">
              {row.icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">{row.label}</p>
              <p className="text-sm font-medium truncate">{row.value}</p>
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground mt-4 text-center">
        To update your profile details, visit <a href="/settings" className="text-clinical-blue hover:underline font-medium">Settings</a>.
      </p>
    </div>
  );
}
