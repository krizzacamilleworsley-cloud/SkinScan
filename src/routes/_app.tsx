import {
  createFileRoute, Outlet, Link, useNavigate, useRouterState,
} from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useUnreadCounts } from "@/hooks/use-unread-counts";
import { NotificationBell } from "@/components/notification-bell";
import {
  LayoutDashboard, Images, ScanLine, Calendar, MessageSquare,
  User, Settings, Stethoscope, ShieldCheck, LogOut, Menu, X,
  ChevronRight,
} from "lucide-react";

export const Route = createFileRoute("/_app")({ component: AppShell });

interface NavItem { to: string; label: string; icon: typeof LayoutDashboard }

const patientNav: NavItem[] = [
  { to: "/dashboard",    label: "Dashboard",    icon: LayoutDashboard },
  { to: "/scans",        label: "My Scans",     icon: Images },
  { to: "/scans/new",    label: "New Scan",     icon: ScanLine },
  { to: "/appointments", label: "Appointments", icon: Calendar },
  { to: "/messages",     label: "Messages",     icon: MessageSquare },
];
const doctorNav: NavItem[] = [
  { to: "/dashboard",    label: "Dashboard",    icon: LayoutDashboard },
  { to: "/doctor",       label: "Review Queue", icon: Stethoscope },
  { to: "/appointments", label: "Appointments", icon: Calendar },
  { to: "/messages",     label: "Messages",     icon: MessageSquare },
];
const adminNav: NavItem[] = [
  { to: "/dashboard", label: "Dashboard",  icon: LayoutDashboard },
  { to: "/admin",     label: "Admin Panel", icon: ShieldCheck },
];

function pageTitle(p: string) {
  if (p.startsWith("/dashboard"))    return "Dashboard";
  if (p.startsWith("/scans/new"))    return "New Scan";
  if (p.startsWith("/scans"))        return "Scans";
  if (p.startsWith("/appointments")) return "Appointments";
  if (p.startsWith("/messages"))     return "Messages";
  if (p.startsWith("/doctor"))       return "Review Queue";
  if (p.startsWith("/admin"))        return "Admin Panel";
  if (p.startsWith("/profile"))      return "Profile";
  if (p.startsWith("/settings"))     return "Settings";
  return "SkinScan AI";
}

function AppShell() {
  const { user, loading, roles, signOut } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const unread   = useUnreadCounts();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (pathname.startsWith("/messages"))     unread.clearMessages();
    if (pathname.startsWith("/appointments")) unread.clearAppointments();
    setMobileOpen(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-clinical-bg">
        <div className="flex flex-col items-center gap-3">
          <div className="size-10 rounded-xl overflow-hidden shadow-lg animate-pulse shrink-0">
            <img src="/skinscan-logo.png" alt="SkinScan AI" className="size-full object-cover" />
          </div>
          <p className="text-sm text-muted-foreground">Loading…</p>
        </div>
      </div>
    );
  }

  const visibleNav = roles.includes("admin") ? adminNav : roles.includes("doctor") ? doctorNav : patientNav;
  const roleLabel  = roles.includes("admin") ? "Admin" : roles.includes("doctor") ? "Doctor" : "Patient";
  const roleColor  = roles.includes("admin")
    ? "bg-risk-high/20 text-risk-high"
    : roles.includes("doctor")
    ? "bg-risk-low/20 text-risk-low"
    : "bg-clinical-blue/20 text-white/90";

  const hasDot = (to: string) => {
    if (to === "/messages")     return unread.messages;
    if (to === "/appointments") return unread.appointments;
    return false;
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-5 pt-6 pb-4">
        <Link to="/dashboard" className="flex items-center gap-3 group" onClick={() => setMobileOpen(false)}>
          <div className="size-9 rounded-xl overflow-hidden shadow-lg shadow-clinical-blue/30 group-hover:shadow-clinical-blue/50 transition-shadow shrink-0">
            <img src="/skinscan-logo.png" alt="SkinScan AI" className="size-full object-cover" />
          </div>
          <div>
            <div className="font-bold text-white tracking-tight leading-none">SkinScan AI</div>
            <div className="text-[10px] text-white/40 font-mono uppercase tracking-widest mt-0.5">Clinical Suite</div>
          </div>
        </Link>
      </div>

      {/* Nav label */}
      <div className="px-5 mb-2">
        <span className="text-[9px] font-mono uppercase tracking-[0.15em] text-white/30">Navigation</span>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
        {visibleNav.map((n) => {
          const active = pathname === n.to || (n.to !== "/dashboard" && pathname.startsWith(n.to));
          const dot    = hasDot(n.to);
          return (
            <Link
              key={n.to}
              to={n.to}
              className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                active
                  ? "bg-white/10 text-white shadow-sm"
                  : "text-white/55 hover:text-white hover:bg-white/8"
              }`}
            >
              <span className="relative shrink-0">
                <n.icon className={`size-4 transition-transform duration-150 ${active ? "" : "group-hover:scale-110"}`} />
                {dot && (
                  <span className="absolute -top-1 -right-1 size-2 rounded-full bg-red-400 ring-1 ring-sidebar animate-pulse" />
                )}
              </span>
              <span className="flex-1 truncate">{n.label}</span>
              {active && <ChevronRight className="size-3 text-white/40 shrink-0" />}
              {dot && !active && (
                <span className="size-1.5 rounded-full bg-red-400 shrink-0" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Divider */}
      <div className="mx-5 my-3 h-px bg-white/8" />

      {/* Secondary nav */}
      <div className="px-3 space-y-0.5 mb-3">
        {[
          { to: "/profile",  icon: User,     label: "Profile" },
          { to: "/settings", icon: Settings, label: "Settings" },
        ].map(({ to, icon: Icon, label }) => (
          <Link
            key={to}
            to={to}
            className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium text-white/45 hover:text-white hover:bg-white/8 transition-all duration-150"
          >
            <Icon className="size-4" />
            {label}
          </Link>
        ))}
      </div>

      {/* User footer */}
      <div className="mx-3 mb-4 p-3 rounded-2xl bg-white/6 border border-white/8">
        <div className="flex items-center gap-3 mb-3">
          <div className="size-9 rounded-xl bg-gradient-to-br from-clinical-blue/60 to-clinical-blue/30 flex items-center justify-center text-white font-bold text-sm shrink-0">
            {(user.email ?? "?")[0].toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold text-white truncate">{user.email}</div>
            <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md ${roleColor}`}>
              {roleLabel}
            </span>
          </div>
        </div>
        <button
          onClick={() => signOut()}
          className="w-full flex items-center justify-center gap-2 text-xs px-3 py-2 rounded-lg bg-white/6 text-white/50 hover:bg-white/12 hover:text-white/80 transition-all duration-150"
        >
          <LogOut className="size-3" /> Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-clinical-bg font-sans text-foreground">
      {/* ── Desktop sidebar ──────────────────────────────────────────────────── */}
      <aside className="hidden lg:flex w-64 bg-sidebar flex-col shrink-0 fixed inset-y-0 left-0 z-30">
        <SidebarContent />
      </aside>

      {/* ── Mobile sidebar overlay ───────────────────────────────────────────── */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative w-72 bg-sidebar flex flex-col shadow-2xl fade-in-up">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-4 size-8 flex items-center justify-center rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="size-4" />
            </button>
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* ── Main content ─────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col lg:ml-64 min-h-screen">
        {/* Top header */}
        <header className="sticky top-0 z-20 h-14 bg-white/80 backdrop-blur-md border-b border-border flex items-center justify-between px-4 sm:px-6 shrink-0 shadow-sm shadow-black/4">
          <div className="flex items-center gap-3">
            {/* Mobile menu button */}
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden size-9 flex items-center justify-center rounded-xl text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
            >
              <Menu className="size-5" />
            </button>
            <div>
              <h1 className="font-semibold text-sm text-foreground">{pageTitle(pathname)}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
