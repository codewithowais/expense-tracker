"use client";

import { useEffect } from "react";

/**
 * Registers the service worker so the app shell + static assets are cached and
 * the app opens/reloads while offline. Registered only in production builds —
 * a service worker in `next dev` fights Turbopack's HMR and can serve stale
 * chunks.
 */
export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Registration failures must never break the app.
      });
    };

    if (document.readyState === "complete") register();
    else {
      window.addEventListener("load", register, { once: true });
      return () => window.removeEventListener("load", register);
    }
  }, []);

  return null;
}
