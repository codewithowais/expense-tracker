"use client";

import { ThemeProvider } from "next-themes";
import { MotionConfig } from "motion/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { PwaRegister } from "@/components/pwa-register";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {/* `reducedMotion="user"` makes every motion/react animation honor the OS
          "reduce motion" setting — the global CSS media query only tames CSS
          transitions, not JS-driven framer animations. */}
      <MotionConfig reducedMotion="user">
        <TooltipProvider delayDuration={200}>
          {children}
          <Toaster position="top-center" richColors closeButton />
        </TooltipProvider>
      </MotionConfig>
      <PwaRegister />
    </ThemeProvider>
  );
}
