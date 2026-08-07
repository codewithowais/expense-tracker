"use client";

import { useEffect } from "react";

/**
 * Registers the service worker so the app shell + static assets are cached and
 * the app opens/reloads while offline. Registered only in production builds —
 * a service worker in `next dev` fights Turbopack's HMR and can serve stale
 * chunks.
 *
 * Also keeps the app on the LATEST version: it checks for a new worker on load
 * and whenever the tab regains focus, and reloads once when a new worker takes
 * control — so users aren't left running a stale cached build after a deploy.
 */
export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    const sw = navigator.serviceWorker;
    // Only auto-reload when REPLACING an existing worker (a real update) — never
    // on the first-ever install, and only once, so we can't loop.
    const hadController = Boolean(sw.controller);
    let refreshing = false;

    const onControllerChange = () => {
      if (!hadController || refreshing) return;
      refreshing = true;
      window.location.reload();
    };
    sw.addEventListener("controllerchange", onControllerChange);

    let reg: ServiceWorkerRegistration | undefined;

    const register = async () => {
      try {
        reg = await sw.register("/sw.js");
        // Proactively check for a newer worker right away.
        void reg.update().catch(() => {});
      } catch {
        // Registration failures must never break the app.
      }
    };

    // Re-check for updates when the user returns to the tab.
    const checkForUpdate = () => {
      if (document.visibilityState === "visible") void reg?.update().catch(() => {});
    };
    document.addEventListener("visibilitychange", checkForUpdate);

    if (document.readyState === "complete") void register();
    else window.addEventListener("load", register, { once: true });

    return () => {
      sw.removeEventListener("controllerchange", onControllerChange);
      document.removeEventListener("visibilitychange", checkForUpdate);
      window.removeEventListener("load", register);
    };
  }, []);

  return null;
}
