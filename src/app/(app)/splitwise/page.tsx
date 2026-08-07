"use client";

import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { SplitwiseInsights } from "@/components/splitwise/splitwise-insights";
import { splitwiseRepo } from "@/lib/repositories/splitwise";
import { useSplitwiseReport } from "@/lib/hooks/use-data";
import { EMPTY_REPORT } from "@/lib/splitwise/types";

export default function SplitwisePage() {
  const report = useSplitwiseReport();
  const [importing, setImporting] = useState(false);

  async function onImportFile(file: File) {
    setImporting(true);
    try {
      const text = await file.text();
      const { group, added } = await splitwiseRepo.importHtml(text);
      toast.success(`Imported ${added.toLocaleString()} entries from “${group}”`, {
        description: "Balances added to People & Debts.",
      });
    } catch {
      toast.error("Couldn’t read that file. Make sure it’s a Splitwise printable-summary HTML export.");
    } finally {
      setImporting(false);
    }
  }

  async function onClear() {
    try {
      await splitwiseRepo.clear();
      toast.success("Imported Splitwise data cleared");
    } catch {
      toast.error("Couldn’t clear the data. Please try again.");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Splitwise Insights"
        description="Import your Splitwise history and analyze it by person, year, month, and place."
      />
      <SplitwiseInsights
        report={report ?? EMPTY_REPORT}
        importing={importing}
        onImportFile={onImportFile}
        onClear={onClear}
      />
    </div>
  );
}
