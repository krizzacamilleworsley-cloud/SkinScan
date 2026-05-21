import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  Link,
} from "@tanstack/react-router";
import { useEffect } from "react";

import appCss from "../styles.css?url";
import { AuthProvider } from "@/lib/auth";
import { Toaster } from "@/components/ui/sonner";
import { NotificationProvider } from "@/hooks/use-notification-store";
import { PWAInstallPrompt } from "@/components/pwa-install-prompt";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-clinical-bg px-4">
      <div className="max-w-md text-center">
        <div className="font-mono text-[10px] uppercase tracking-widest text-clinical-blue mb-2">Error 404</div>
        <h1 className="text-3xl font-bold tracking-tight">Page not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist.
        </p>
        <Link to="/"
          className="mt-6 inline-flex items-center justify-center rounded-md bg-clinical-blue px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity">
          Go home
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-clinical-bg px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight">This page didn't load</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <button
          onClick={() => { router.invalidate(); reset(); }}
          className="mt-6 inline-flex items-center justify-center rounded-md bg-clinical-blue px-4 py-2 text-sm font-medium text-white">
          Try again
        </button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "SkinScan AI — Clinical Dermatology Suite" },
      { name: "description", content: "AI-powered skin lesion analysis for patients and clinicians. Clinical decision support — not a medical diagnosis." },
      { name: "application-name", content: "SkinScan AI" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },
      { name: "apple-mobile-web-app-title", content: "SkinScan AI" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "theme-color", content: "#2563eb" },
      { name: "msapplication-TileColor", content: "#2563eb" },
      { name: "msapplication-tap-highlight", content: "no" },
      // Open Graph
      { property: "og:type", content: "website" },
      { property: "og:title", content: "SkinScan AI — Clinical Dermatology Suite" },
      { property: "og:description", content: "AI-powered skin lesion analysis for patients and clinicians." },
      { property: "og:image", content: "/skinscan-logo.png" },
      // Twitter
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "SkinScan AI" },
      { name: "twitter:description", content: "AI-powered skin lesion analysis for patients and clinicians." },
      { name: "twitter:image", content: "/skinscan-logo.png" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500&display=swap",
      },
      // PWA manifest
      { rel: "manifest", href: "/manifest.json" },
      // Favicon — properly sized PNGs generated from the logo
      { rel: "icon", href: "/favicon-32.png?v=2", type: "image/png", sizes: "32x32" },
      { rel: "icon", href: "/icon-192.png?v=2",   type: "image/png", sizes: "192x192" },
      { rel: "icon", href: "/icon-512.png?v=2",   type: "image/png", sizes: "512x512" },
      // Apple touch icon (iOS home screen, 180x180)
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png?v=2", sizes: "180x180" },
      // Fallback SVG
      { rel: "icon", href: "/favicon.svg?v=2", type: "image/svg+xml" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

// Register service worker for PWA
function usePWA() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    // In production, vite-plugin-pwa generates /sw.js with Workbox
    // In dev, this is a no-op (devOptions.enabled = false)
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then((reg) => {
          // Check for updates every 60 seconds
          setInterval(() => reg.update(), 60_000);
        })
        .catch(() => {
          // SW not available — app still works normally
        });
    });
  }, []);
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  usePWA();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <NotificationProvider>
          <Outlet />
          <Toaster />
          <PWAInstallPrompt />
        </NotificationProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
