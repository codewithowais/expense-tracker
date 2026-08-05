"use client";

import { useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { useMounted } from "@/lib/hooks/use-mounted";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import {
  Download,
  FileJson,
  FileSpreadsheet,
  Info,
  Lock,
  Monitor,
  Moon,
  ShieldCheck,
  ShieldOff,
  Sun,
  Trash2,
  Upload,
  User,
} from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { LoadingPanel } from "@/components/shared/states";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { SyncSection } from "@/components/settings/sync-section";
import { useLockStore } from "@/stores/lock-store";
import { useSettings } from "@/lib/hooks/use-data";
import { settingsRepo } from "@/lib/repositories/settings";
import {
  clearAllData,
  exportBackupJSON,
  exportTransactionsCSV,
  importBackupJSON,
  importTransactionsCSV,
} from "@/lib/backup";
import { downloadFile } from "@/lib/csv";
import { APP_NAME, CURRENCY_LIST } from "@/lib/constants";
import type { CurrencyCode } from "@/lib/types";
import { cn } from "@/lib/utils";

const MONTH_START_DAYS = Array.from({ length: 28 }, (_, i) => i + 1);

function ordinal(n: number): string {
  const suffixes = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${suffixes[(v - 20) % 10] ?? suffixes[v] ?? suffixes[0]}`;
}

const THEME_OPTIONS = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const;

export default function SettingsPage() {
  const settings = useSettings();

  return (
    <div className="space-y-6 pb-10">
      <PageHeader title="Settings" description="Manage your profile, preferences, security, and data." />

      {settings === undefined ? (
        <LoadingPanel rows={6} />
      ) : (
        <div className="space-y-6">
          <ProfileSection name={settings.name} />
          <PreferencesSection currency={settings.currency} monthStartDay={settings.monthStartDay} />
          <SecuritySection />
          <DataManagementSection />
          <SyncSection />
          <DangerZoneSection />
          <AboutSection />
        </div>
      )}
    </div>
  );
}

function ProfileSection({ name: initialName }: { name: string }) {
  // The parent only mounts this section once settings have loaded, so the
  // initializer below already captures the persisted name on first render.
  const [name, setName] = useState(initialName);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await settingsRepo.update({ name: name.trim() });
      toast.success("Profile updated.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update profile.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SectionCard title="Profile" description="How Ledgerly refers to you.">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="display-name">
            <User className="size-3.5" /> Display name
          </Label>
          <Input
            id="display-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            maxLength={60}
          />
        </div>
        <Button onClick={handleSave} disabled={saving || name.trim() === initialName}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
    </SectionCard>
  );
}

function PreferencesSection({
  currency,
  monthStartDay,
}: {
  currency: CurrencyCode;
  monthStartDay: number;
}) {
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();
  const activeTheme = mounted ? (theme ?? "system") : undefined;

  async function handleCurrencyChange(value: string) {
    try {
      await settingsRepo.update({ currency: value as CurrencyCode });
      toast.success("Currency updated.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update currency.");
    }
  }

  async function handleMonthStartChange(value: string) {
    try {
      await settingsRepo.update({ monthStartDay: Number(value) });
      toast.success("Month start day updated.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update month start day.");
    }
  }

  return (
    <SectionCard title="Preferences" description="Currency, budgeting cycle, and appearance.">
      <div className="space-y-6">
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="currency-select">Currency</Label>
            <Select value={currency} onValueChange={handleCurrencyChange}>
              <SelectTrigger id="currency-select" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCY_LIST.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    {c.symbol} {c.name} ({c.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="month-start-select">Month start day</Label>
            <Select value={String(monthStartDay)} onValueChange={handleMonthStartChange}>
              <SelectTrigger id="month-start-select" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTH_START_DAYS.map((d) => (
                  <SelectItem key={d} value={String(d)}>
                    {ordinal(d)} of each month
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Useful if your salary lands mid-month — budgets and monthly views will follow this cycle
              instead of the calendar month.
            </p>
          </div>
        </div>

        <div className="space-y-1.5">
          <span className="text-sm font-medium">Theme</span>
          <div
            role="radiogroup"
            aria-label="Theme"
            className="inline-flex w-full flex-wrap gap-1 rounded-lg border border-border p-1 sm:w-auto"
          >
            {THEME_OPTIONS.map((opt) => {
              const isActive = activeTheme === opt.value;
              const Icon = opt.icon;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="radio"
                  aria-checked={isActive}
                  onClick={() => setTheme(opt.value)}
                  className={cn(
                    "flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors sm:flex-none",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <Icon className="size-4" aria-hidden />
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </SectionCard>
  );
}

function SecuritySection() {
  const pinRequired = useLockStore((s) => s.pinRequired);
  const lock = useLockStore((s) => s.lock);

  return (
    <SectionCard
      title="Security"
      description="The app lock is managed by your APP_PIN environment variable — the same PIN on every device."
    >
      <div className="flex flex-col items-start justify-between gap-4 rounded-xl border border-border p-4 sm:flex-row sm:items-center">
        <div className="flex items-start gap-3">
          <span
            className={cn(
              "grid size-9 shrink-0 place-items-center rounded-full",
              pinRequired ? "bg-income-soft text-income" : "bg-muted text-muted-foreground",
            )}
          >
            {pinRequired ? (
              <ShieldCheck className="size-4.5" />
            ) : (
              <ShieldOff className="size-4.5" />
            )}
          </span>
          <div>
            <p className="text-sm font-medium">
              {pinRequired ? "PIN lock is on" : "PIN lock is off"}
            </p>
            <p className="text-xs text-muted-foreground">
              {pinRequired
                ? "A PIN is required to unlock Ledgerly. It’s validated on the server and identical across your devices. To change it, update APP_PIN in your environment and redeploy."
                : "Set an APP_PIN value in your environment (.env) to require a PIN on every device."}
            </p>
          </div>
        </div>
        {pinRequired ? (
          <Button variant="outline" size="sm" className="gap-2" onClick={lock}>
            <Lock className="size-4" /> Lock now
          </Button>
        ) : null}
      </div>
    </SectionCard>
  );
}

function DataManagementSection() {
  const jsonInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  async function handleExportBackup() {
    try {
      const json = await exportBackupJSON();
      downloadFile("ledgerly-backup.json", json, "application/json");
      toast.success("Backup exported.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not export backup.");
    }
  }

  async function handleImportBackupFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const text = await file.text();
      const result = await importBackupJSON(text);
      toast.success(
        `Backup restored — ${result.transactions} transactions, ${result.categories} categories, ${result.budgets} budgets.`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not import backup.");
    }
  }

  async function handleExportCSV() {
    try {
      const csv = await exportTransactionsCSV();
      downloadFile("ledgerly-transactions.csv", csv, "text/csv");
      toast.success("Transactions exported.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not export transactions.");
    }
  }

  async function handleImportCSVFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const text = await file.text();
      const result = await importTransactionsCSV(text);
      const parts = [`Imported ${result.imported} transaction${result.imported === 1 ? "" : "s"}`];
      if (result.skipped) parts.push(`skipped ${result.skipped}`);
      if (result.createdCategories) parts.push(`created ${result.createdCategories} categories`);
      toast.success(parts.join(", ") + ".");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not import CSV.");
    }
  }

  return (
    <SectionCard
      title="Data management"
      description="Back up, restore, or bulk-import your data. Everything lives only in this browser."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-3 rounded-xl border border-border p-4">
          <div className="flex items-center gap-2">
            <FileJson className="size-4 text-primary" />
            <h3 className="text-sm font-medium">Full backup (JSON)</h3>
          </div>
          <p className="text-xs text-muted-foreground">
            Exports every category, transaction, and budget. Importing a backup replaces all current
            data.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={handleExportBackup}>
              <Download /> Export backup
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Upload /> Import backup
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Replace all data?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Importing a backup replaces every category, transaction, and budget currently
                    stored in this browser. This can’t be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => jsonInputRef.current?.click()}>
                    Choose file…
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <input
              ref={jsonInputRef}
              type="file"
              accept="application/json"
              className="hidden"
              aria-label="Choose backup JSON file"
              onChange={handleImportBackupFile}
            />
          </div>
        </div>

        <div className="space-y-3 rounded-xl border border-border p-4">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="size-4 text-primary" />
            <h3 className="text-sm font-medium">Transactions (CSV)</h3>
          </div>
          <p className="text-xs text-muted-foreground">
            Importing a CSV adds new transactions to what you already have — it never replaces
            anything. Expected columns:{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-[0.7rem]">
              date,type,category,amount,method,note
            </code>
            .
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={handleExportCSV}>
              <Download /> Export CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => csvInputRef.current?.click()}>
              <Upload /> Import CSV
            </Button>
            <input
              ref={csvInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              aria-label="Choose transactions CSV file"
              onChange={handleImportCSVFile}
            />
          </div>
        </div>
      </div>
    </SectionCard>
  );
}

function DangerZoneSection() {
  async function handleClearAll() {
    try {
      await clearAllData();
      toast.success("All financial data deleted.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete data.");
    }
  }

  return (
    <SectionCard
      title="Danger zone"
      description="Irreversible actions. Proceed with care."
      className="border-destructive/30"
    >
      <div className="flex flex-col items-start justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 sm:flex-row sm:items-center">
        <div>
          <p className="text-sm font-medium text-destructive">Delete all financial data</p>
          <p className="text-xs text-muted-foreground">
            Removes every transaction, budget, person &amp; debt, and savings goal (and syncs the
            deletion). Categories and app settings are kept. This can’t be undone.
          </p>
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm">
              <Trash2 /> Delete everything
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete all financial data?</AlertDialogTitle>
              <AlertDialogDescription>
                This permanently removes every transaction, budget, person &amp; debt, and savings
                goal, and syncs the deletion to your other devices. Categories and app settings are
                kept. This can’t be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction variant="destructive" onClick={handleClearAll}>
                Delete everything
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </SectionCard>
  );
}

function AboutSection() {
  return (
    <SectionCard title="About">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
          <Info className="size-4.5" />
        </span>
        <div className="space-y-1 text-sm">
          <p className="font-medium">
            {APP_NAME} <span className="font-normal text-muted-foreground">· Version 1.0</span>
          </p>
          <p className="text-xs text-muted-foreground">
            All of your data is stored locally in this browser — nothing is uploaded to a server, and
            no account is required. Export a backup regularly to keep your data safe across devices or
            browser resets.
          </p>
        </div>
      </div>
    </SectionCard>
  );
}
