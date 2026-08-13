'use client';

import { useEffect, useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';

/**
 * `BeforeInstallPromptEvent` is not part of the standard TS DOM lib, so we
 * declare the bits we use. Browsers that support PWA install fire this event
 * (Chrome/Edge on Android & desktop). Safari/iOS use a different mechanism
 * (the user adds to home screen via the Share sheet) and never fire this.
 */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// ────────────────────────────────────────────────────────────────────────────
// Module-level singleton — holds the deferred prompt across hook instances so
// any component can call `promptInstall()`. We use a tiny pub/sub instead of
// zustand to keep PWA plumbing isolated from the user-facing wedding store.
// ────────────────────────────────────────────────────────────────────────────
let deferredPrompt: BeforeInstallPromptEvent | null = null;
let availabilityListeners = new Set<(available: boolean) => void>();

function setDeferredPrompt(event: BeforeInstallPromptEvent | null) {
  deferredPrompt = event;
  const available = !!event;
  availabilityListeners.forEach((fn) => fn(available));
}

function subscribeAvailability(fn: (available: boolean) => void): () => void {
  availabilityListeners.add(fn);
  return () => {
    availabilityListeners.delete(fn);
  };
}

export interface UsePWAInstall {
  /** True when the browser has fired `beforeinstallprompt` and not yet consumed it. */
  canInstall: boolean;
  /** True when the app is running as an installed PWA (display-mode: standalone). */
  isInstalled: boolean;
  /** Triggers the native install prompt. Returns the user's choice, or 'unavailable'. */
  promptInstall: () => Promise<'accepted' | 'dismissed' | 'unavailable'>;
}

/**
 * usePWAInstall — shared hook for reading/triggering the PWA install flow.
 *
 * @example
 * const { canInstall, promptInstall } = usePWAInstall();
 * if (canInstall) <button onClick={() => promptInstall()}>Install</button>
 */
export function usePWAInstall(): UsePWAInstall {
  const [canInstall, setCanInstall] = useState<boolean>(!!deferredPrompt);
  const [isInstalled, setIsInstalled] = useState<boolean>(false);

  useEffect(() => {
    const unsubscribe = subscribeAvailability(setCanInstall);

    // Detect standalone display mode (already installed).
    const mq = window.matchMedia('(display-mode: standalone)');
    const updateInstalled = () => setIsInstalled(mq.matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);
    updateInstalled();
    mq.addEventListener?.('change', updateInstalled);

    return () => {
      unsubscribe();
      mq.removeEventListener?.('change', updateInstalled);
    };
  }, []);

  const promptInstall = useCallback<
    UsePWAInstall['promptInstall']
  >(async () => {
    if (!deferredPrompt) return 'unavailable';
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      // The event can only be used once.
      setDeferredPrompt(null);
      return choice.outcome;
    } catch {
      setDeferredPrompt(null);
      return 'unavailable';
    }
  }, []);

  return { canInstall, promptInstall, isInstalled };
}

/**
 * PWARegister — invisible component.
 *
 * Responsibilities:
 *  1. Register `/sw.js` on mount (graceful no-op if SW is unsupported).
 *  2. Toast "Available offline" when the SW first takes control.
 *  3. Reload an already-controlled Wewed tab once when a newer SW takes control.
 *  4. Capture `beforeinstallprompt` so the install-prompt banner can fire it later.
 *  5. Listen for `appinstalled` to celebrate + clear the deferred prompt.
 *
 * Renders `null` — no UI.
 */
export function PWARegister() {
  const { toast } = useToast();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;

    const hadControllerAtMount = !!navigator.serviceWorker.controller;
    let reloadingForUpdate = false;
    let toastedReady = false;
    let cancelled = false;

    const fireReadyToast = () => {
      if (toastedReady) return;
      toastedReady = true;
      toast({
        title: 'Available offline',
        description: 'wewed is ready — programme, songbook & map work without a connection.',
      });
    };

    const onControllerChange = () => {
      if (cancelled) return;

      if (hadControllerAtMount) {
        if (reloadingForUpdate) return;
        reloadingForUpdate = true;
        window.location.reload();
        return;
      }

      fireReadyToast();
    };

    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    const register = async () => {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });

        // Update flow: when a new SW finishes installing, ask it to skip waiting.
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (!newWorker) return;
          newWorker.addEventListener('statechange', () => {
            if (cancelled) return;
            if (
              newWorker.state === 'installed' &&
              navigator.serviceWorker.controller
            ) {
              newWorker.postMessage('wewed:skip-waiting');
            }
          });
        });
      } catch (err) {
        // Silent failure — the site still works without a service worker.
        console.warn('[wewed] Service worker registration failed:', err);
      }
    };

    register();

    // Capture the deferred install prompt.
    const onBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);

    // When the app finishes installing, celebrate + clear deferred prompt.
    const onAppInstalled = () => {
      setDeferredPrompt(null);
      toast({
        title: 'Installed',
        description: 'wewed is on your home screen — tap to open anytime, even offline.',
      });
    };
    window.addEventListener('appinstalled', onAppInstalled);

    return () => {
      cancelled = true;
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, [toast]);

  return null;
}