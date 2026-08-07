"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { Wifi, WifiOff } from "lucide-react";

/**
 * Surfaces online/offline status as a snackbar instead of a full offline page.
 * The app is local-first, so offline is a normal, safe state — we just tell the
 * user their changes are saved on-device and will sync when the connection is
 * back. A single persistent toast (id "connectivity") is swapped in place.
 */
export function ConnectivityToast() {
  const wasOffline = useRef(false);

  useEffect(() => {
    if (typeof navigator === "undefined") return;

    const goOffline = () => {
      wasOffline.current = true;
      toast("You're offline", {
        id: "connectivity",
        description: "Changes save on this device and sync when you're back.",
        icon: <WifiOff className="size-4" />,
        duration: Infinity,
      });
    };

    const goOnline = () => {
      if (!wasOffline.current) return; // don't announce on a normal first load
      wasOffline.current = false;
      toast.success("Back online", {
        id: "connectivity",
        description: "Syncing your latest changes…",
        icon: <Wifi className="size-4" />,
        duration: 3000,
      });
    };

    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    if (!navigator.onLine) goOffline();

    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, []);

  return null;
}
