import { AppGate } from "@/components/auth/app-gate";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { QuickAddSheet } from "@/components/transactions/quick-add-sheet";
import { SyncProvider } from "@/components/sync/sync-provider";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <AppGate>
      <div className="flex min-h-dvh bg-background">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar />
          <main className="flex-1 px-4 pb-28 pt-6 sm:px-6 lg:px-8 lg:pb-12">
            <div className="mx-auto w-full max-w-6xl">{children}</div>
          </main>
        </div>
      </div>
      <MobileNav />
      <QuickAddSheet />
      <SyncProvider />
    </AppGate>
  );
}
