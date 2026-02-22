import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { Download, X, Smartphone } from "lucide-react";

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  useEffect(() => {
    // Check if already installed as PWA
    if (window.matchMedia('(display-mode: standalone)').matches) return;

    // Detect iOS
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    setIsIOS(ios);

    // Check if dismissed recently
    const dismissed = localStorage.getItem("archiva_pwa_dismissed");
    if (dismissed) {
      const dismissedAt = parseInt(dismissed, 10);
      if (Date.now() - dismissedAt < 7 * 24 * 60 * 60 * 1000) return; // 7 days
    }

    if (ios) {
      // On iOS, show custom instructions after a delay
      const timer = setTimeout(() => setShowBanner(true), 3000);
      return () => clearTimeout(timer);
    }

    // Chrome/Android install prompt
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowBanner(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (isIOS) {
      setShowIOSGuide(true);
      return;
    }
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const result = await deferredPrompt.userChoice;
    if (result.outcome === "accepted") {
      setShowBanner(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowBanner(false);
    setShowIOSGuide(false);
    localStorage.setItem("archiva_pwa_dismissed", Date.now().toString());
  };

  if (!showBanner) return null;

  return (
    <>
      {/* Install Banner */}
      <div
        className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-white border border-border rounded-xl shadow-lg p-4 z-50 fade-in"
        data-testid="install-prompt"
      >
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center shrink-0">
            <Smartphone className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm mb-0.5">Install Archiva</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {isIOS
                ? "Add Archiva to your Home Screen for quick access and a native app experience."
                : "Install Archiva for quick access, offline support, and a native app experience."}
            </p>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={handleDismiss} data-testid="dismiss-install">
            <X className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex gap-2 mt-3 ml-[52px]">
          <Button size="sm" className="gap-1.5" onClick={handleInstall} data-testid="install-app-btn">
            <Download className="w-3.5 h-3.5" />
            {isIOS ? "How to Install" : "Install App"}
          </Button>
          <Button variant="ghost" size="sm" onClick={handleDismiss}>
            Not now
          </Button>
        </div>
      </div>

      {/* iOS Instructions Modal */}
      {showIOSGuide && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-end md:items-center justify-center" onClick={handleDismiss}>
          <div
            className="bg-white rounded-t-2xl md:rounded-2xl w-full md:max-w-sm p-6 space-y-4 fade-in"
            onClick={(e) => e.stopPropagation()}
            data-testid="ios-install-guide"
          >
            <h3 className="font-bold text-lg">Install on iPhone / iPad</h3>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <span className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 text-sm font-semibold">1</span>
                <p className="text-sm">Tap the <strong>Share</strong> button <span className="inline-block w-5 h-5 align-middle">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 inline text-primary"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
                </span> at the bottom of Safari</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 text-sm font-semibold">2</span>
                <p className="text-sm">Scroll down and tap <strong>"Add to Home Screen"</strong></p>
              </div>
              <div className="flex items-start gap-3">
                <span className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 text-sm font-semibold">3</span>
                <p className="text-sm">Tap <strong>"Add"</strong> in the top-right corner</p>
              </div>
            </div>
            <Button className="w-full" onClick={handleDismiss} data-testid="ios-guide-done">Got it</Button>
          </div>
        </div>
      )}
    </>
  );
}
