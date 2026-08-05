"use client";

import { useState } from "react";
import { ArrowRight, Check, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { BrandMark } from "@/components/layout/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CURRENCY_LIST } from "@/lib/constants";
import { settingsRepo } from "@/lib/repositories/settings";
import { generateDemoData } from "@/lib/db/seed";
import type { CurrencyCode } from "@/lib/types";

type Step = "welcome" | "data";

export function Onboarding() {
  const [step, setStep] = useState<Step>("welcome");
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState<CurrencyCode>("PKR");
  const [saving, setSaving] = useState(false);

  async function finish(withDemo: boolean) {
    setSaving(true);
    try {
      await settingsRepo.update({ name: name.trim(), currency, hasCompletedSetup: true });
      if (withDemo) {
        const n = await generateDemoData();
        if (n > 0) toast.success(`Added ${n} sample transactions to explore.`);
      }
    } catch {
      toast.error("Couldn’t finish setup. Please try again.");
      setSaving(false);
    }
  }

  return (
    <div className="surface-hero surface-grain relative flex min-h-dvh items-center justify-center px-5 py-10">
      <div className="relative z-10 w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <BrandMark className="size-14 rounded-2xl" />
          <StepDots step={step} />
        </div>

        <div className="rounded-3xl bg-background/95 p-7 shadow-2xl backdrop-blur sm:p-8">
          {step === "welcome" && (
            <div className="space-y-6">
              <header className="space-y-1.5 text-center">
                <h1 className="font-heading text-2xl font-semibold">Welcome to Ledgerly</h1>
                <p className="text-sm text-muted-foreground">
                  A calm place to track your money. Let’s set a few basics.
                </p>
              </header>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="name">What should we call you?</Label>
                  <Input
                    id="name"
                    placeholder="Your name (optional)"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={40}
                    autoFocus
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="currency">Primary currency</Label>
                  <Select value={currency} onValueChange={(v) => setCurrency(v as CurrencyCode)}>
                    <SelectTrigger id="currency" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCY_LIST.map((c) => (
                        <SelectItem key={c.code} value={c.code}>
                          <span className="tabular-nums text-muted-foreground">{c.symbol}</span>{" "}
                          {c.name} ({c.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button className="w-full gap-2" size="lg" onClick={() => setStep("data")}>
                Continue <ArrowRight className="size-4" />
              </Button>
            </div>
          )}

          {step === "data" && (
            <div className="space-y-6">
              <header className="flex flex-col items-center space-y-1.5 text-center">
                <span className="grid size-11 place-items-center rounded-2xl bg-accent text-accent-foreground">
                  <Sparkles className="size-5" />
                </span>
                <h1 className="font-heading text-xl font-semibold">You’re all set</h1>
                <p className="text-sm text-muted-foreground">
                  Want to explore with sample data, or start with a clean slate?
                </p>
              </header>
              <div className="flex flex-col gap-2">
                <Button size="lg" className="gap-2" disabled={saving} onClick={() => finish(true)}>
                  <Sparkles className="size-4" /> Load sample data
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="gap-2"
                  disabled={saving}
                  onClick={() => finish(false)}
                >
                  <Check className="size-4" /> Start empty
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StepDots({ step }: { step: Step }) {
  const order: Step[] = ["welcome", "data"];
  const idx = order.indexOf(step);
  return (
    <div className="mt-4 flex items-center gap-2" aria-hidden>
      {order.map((_, i) => (
        <span
          key={i}
          className={`h-1.5 rounded-full transition-all ${
            i === idx ? "w-6 bg-white" : i < idx ? "w-1.5 bg-white/80" : "w-1.5 bg-white/30"
          }`}
        />
      ))}
    </div>
  );
}
