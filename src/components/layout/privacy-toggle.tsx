"use client";

import { useEffect } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePrivacy } from "@/stores/ui-store";
import { cn } from "@/lib/utils";

/**
 * One-click privacy toggle: blurs every money amount app-wide. It flips a
 * `data-hide-amounts` flag on <html>, which a single CSS rule turns into a blur
 * on anything tagged `.amount` (see globals.css). The choice is persisted, so it
 * survives reloads.
 */
export function PrivacyToggle({ className }: { className?: string }) {
  const hidden = usePrivacy((s) => s.amountsHidden);
  const toggle = usePrivacy((s) => s.toggle);

  useEffect(() => {
    document.documentElement.dataset.hideAmounts = hidden ? "true" : "";
  }, [hidden]);

  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn("rounded-full", className)}
      aria-pressed={hidden}
      aria-label={hidden ? "Show amounts" : "Hide amounts"}
      title={hidden ? "Show amounts" : "Hide amounts"}
      onClick={toggle}
    >
      {hidden ? <EyeOff className="size-[1.1rem]" /> : <Eye className="size-[1.1rem]" />}
    </Button>
  );
}
