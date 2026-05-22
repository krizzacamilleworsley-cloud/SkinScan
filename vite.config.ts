// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  cloudflare: false,
  tanstackStart: {
    serverFns: {
      disableCsrfMiddlewareWarning: true,
    },
  },
  vite: {
    plugins: [
      VitePWA({
        // Use the hand-written sw.js in public/ — copied as-is to dist
        strategies: "injectManifest",
        srcDir: "public",
        filename: "sw.js",
        // We register the SW manually in __root.tsx
        injectRegister: null,
        // Don't inject the __WB_MANIFEST placeholder (no Workbox in our SW)
        injectManifest: {
          injectionPoint: undefined,
        },
        manifest: {
          name: "SkinScan AI — Clinical Dermatology Suite",
          short_name: "SkinScan AI",
          description:
            "AI-powered skin lesion analysis for patients and clinicians. Clinical decision support — not a medical diagnosis.",
          start_url: "/",
          display: "standalone",
          background_color: "#f9fafb",
          theme_color: "#2563eb",
          orientation: "portrait-primary",
          scope: "/",
          lang: "en",
          categories: ["medical", "health"],
          icons: [
            {
              src: "/favicon-32.png",
              sizes: "32x32",
              type: "image/png",
            },
            {
              src: "/apple-touch-icon.png",
              sizes: "180x180",
              type: "image/png",
            },
            {
              src: "/icon-192.png",
              sizes: "192x192",
              type: "image/png",
              purpose: "any",
            },
            {
              src: "/icon-512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "any maskable",
            },
          ],
          shortcuts: [
            {
              name: "New Scan",
              short_name: "Scan",
              description: "Start a new skin scan",
              url: "/scans/new",
              icons: [{ src: "/icon-192.png", sizes: "192x192" }],
            },
            {
              name: "Appointments",
              short_name: "Appointments",
              description: "View your appointments",
              url: "/appointments",
              icons: [{ src: "/icon-192.png", sizes: "192x192" }],
            },
          ],
        },
        devOptions: {
          // Enable in dev so the install prompt works on localhost
          enabled: true,
          type: "module",
        },
      }),
    ],
  },
});
