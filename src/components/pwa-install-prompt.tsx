/**
 * PWAInstallPrompt
 *
 * Shows a bottom banner when the browser fires the `beforeinstallprompt` event,
 * letting users install SkinScan AI as a PWA from within the app.
 *
 * - Appears automatically when the browser decides the app is installable
 * - Dismissed state is persisted in localStorage for 30 days
 * - Works on Chrome/Edge desktop and Android Chrome
 * - iOS Safari shows a manual instruction instead (no beforeinstallprompt support)
 */

import { useState, useEffect } from "react";
import { Download, X, Share } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISSED_KEY = "pwa_install_dismissed_until";

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Already installed as PWA
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
      return;
    }

    // Check if dismissed recently
    const dismissedUntil = localStorage.getItem(DISMISSED_KEY);
    if (dismissedUntil && Date.now() < Number(dismissedUntil)) return;

    // Detect iOS
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !(window as unknown as { MSStream?: unknown }).MSStream;
    setIsIOS(ios);

    if (ios) {
      // iOS Safari: show manual instructions after a short delay
      const timer = setTimeout(() => setShowBanner(true), 3000);
      return () => clearTimeout(timer);
    }

    // Chrome/Edge: listen for the install prompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowBanner(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setIsInstalled(true);
    }
    setShowBanner(false);
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowBanner(false);
    // Don't show again for 30 days
    localStorage.setItem(DISMISSED_KEY, String(Date.now() + 30 * 24 * 60 * 60 * 1000));
  };

  if (!showBanner || isInstalled) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-80 z-50 fade-in-up">
      <div className="bg-white border border-border rounded-2xl shadow-xl shadow-black/10 overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 p-4 border-b border-border">
          <div className="size-10 rounded-xl overflow-hidden shrink-0 shadow-sm">
            <img src="/icon-192.png" alt="SkinScan AI" className="size-full object-cover" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm">Install SkinScan AI</div>
            <div className="text-xs text-muted-foreground">Add to your home screen</div>
          </div>
          <button
            onClick={handleDismiss}
            className="size-7 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary transition-colors shrink-0"
            aria-label="Dismiss"
          >
            <X className="size-3.5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4">
          {isIOS ? (
            <div className="text-xs text-muted-foreground space-y-2">
              <p>To install on iOS:</p>
              <ol className="space-y-1.5 list-none">
                <li className="flex items-center gap-2">
                  <span className="size-5 rounded-full bg-clinical-blue/10 text-clinical-blue flex items-center justify-center text-[10px] font-bold shrink-0">1</span>
                  <span>Tap the <Share className="size-3 inline" /> Share button in Safari</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="size-5 rounded-full bg-clinical-blue/10 text-clinical-blue flex items-center justify-center text-[10px] font-bold shrink-0">2</span>
                  <span>Scroll down and tap <strong>"Add to Home Screen"</strong></span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="size-5 rounded-full bg-clinical-blue/10 text-clinical-blue flex items-center justify-center text-[10px] font-bold shrink-0">3</span>
                  <span>Tap <strong>"Add"</strong> to confirm</span>
                </li>
              </ol>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground mb-3">
              Install SkinScan AI for faster access, offline support, and a native app experience.
            </p>
          )}

          {!isIOS && (
            <div className="flex gap-2 mt-3">
              <button
                onClick={handleInstall}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-clinical-blue text-white rounded-xl text-sm font-semibold hover:bg-clinical-blue/90 transition-colors"
              >
                <Download className="size-4" /> Install app
              </button>
              <button
                onClick={handleDismiss}
                className="px-4 py-2.5 border border-border rounded-xl text-sm font-medium text-muted-foreground hover:bg-secondary transition-colors"
              >
                Not now
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
