"use client";

import { useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useMoney } from "@/lib/hooks/use-data";
import { fetchLiveRate, type FetchableMetal } from "@/lib/rates";

interface LiveRateButtonProps {
  metal: FetchableMetal;
  unit: string;
  /** Receives the fetched pure-metal rate scaled to the asset's unit. */
  onRate: (perUnit: number) => void;
}

/** Fetches the international spot rate and fills the current-rate field. */
export function LiveRateButton({ metal, unit, onRate }: LiveRateButtonProps) {
  const { code } = useMoney();
  const [loading, setLoading] = useState(false);

  async function handleFetch() {
    setLoading(true);
    try {
      const rate = await fetchLiveRate(metal, code, unit);
      onRate(rate.perUnit);
      toast.success(`Live ${metal} rate applied — adjust for purity or local premium`);
    } catch {
      toast.error("Couldn’t fetch a live rate. Enter it manually.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="gap-1.5"
      onClick={() => void handleFetch()}
      disabled={loading}
    >
      {loading ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
      Use live rate
    </Button>
  );
}
