"use client";

import { useMemo, useState } from "react";
import { Coins, Gem, Plus, TrendingUp, Wallet } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { StatCardsSkeleton, LoadingPanel } from "@/components/shared/states";
import { Money } from "@/components/shared/money";
import { Button } from "@/components/ui/button";
import { AssetCard } from "@/components/assets/asset-card";
import { AssetDialog } from "@/components/assets/asset-dialog";
import { UpdateRateDialog } from "@/components/assets/update-rate-dialog";
import { summarizeAssets } from "@/lib/assets";
import { formatPercent } from "@/lib/format";
import { useAssets } from "@/lib/hooks/use-data";
import type { Asset } from "@/lib/types";

export default function AssetsPage() {
  const assets = useAssets();
  const ready = Boolean(assets);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Asset | undefined>(undefined);
  const [rateAsset, setRateAsset] = useState<Asset | null>(null);
  const [rateOpen, setRateOpen] = useState(false);

  const { valuations, totalCost, totalWorth, totalGain, totalGainPct, hasUnvalued } = useMemo(
    () => summarizeAssets(assets ?? []),
    [assets],
  );

  const hasAssets = (assets?.length ?? 0) > 0;

  function openCreate() {
    setEditing(undefined);
    setDialogOpen(true);
  }

  function openEdit(asset: Asset) {
    setEditing(asset);
    setDialogOpen(true);
  }

  function openRate(asset: Asset) {
    setRateAsset(asset);
    setRateOpen(true);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Assets"
        description="Track what you own — gold, property, shares — and its value over time."
        actions={
          <Button className="gap-2" onClick={openCreate} disabled={!ready}>
            <Plus className="size-4" /> Add asset
          </Button>
        }
      />

      {!ready ? (
        <div className="space-y-6">
          <StatCardsSkeleton count={3} />
          <LoadingPanel rows={4} />
        </div>
      ) : !hasAssets ? (
        <EmptyState
          icon={Gem}
          title="No assets yet"
          description="Add something you own — like gold, a property, or shares — with what you paid, then update its current value to see your gain or loss."
          action={
            <Button className="gap-2" onClick={openCreate}>
              <Plus className="size-4" /> Add asset
            </Button>
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard
              label="Total cost basis"
              icon={Wallet}
              accent="chart-1"
              value={<Money amount={totalCost} />}
            />
            <StatCard
              label="Current value"
              icon={Coins}
              accent="chart-4"
              value={<Money amount={totalWorth} />}
              hint={hasUnvalued ? "Some assets need a current value" : undefined}
            />
            <StatCard
              label="Total gain / loss"
              icon={TrendingUp}
              accent="chart-2"
              value={<Money amount={totalGain} tone="net" signed />}
              hint={
                totalCost > 0
                  ? `${totalGain >= 0 ? "+" : "−"}${formatPercent(Math.abs(totalGainPct), 1)} vs cost`
                  : undefined
              }
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {valuations.map((v) => (
              <AssetCard
                key={v.asset.id}
                valuation={v}
                onEdit={openEdit}
                onUpdateRate={openRate}
              />
            ))}
          </div>
        </>
      )}

      <AssetDialog open={dialogOpen} onOpenChange={setDialogOpen} asset={editing} />
      <UpdateRateDialog
        asset={rateAsset}
        open={rateOpen}
        onOpenChange={(v) => {
          setRateOpen(v);
          if (!v) setRateAsset(null);
        }}
      />
    </div>
  );
}
