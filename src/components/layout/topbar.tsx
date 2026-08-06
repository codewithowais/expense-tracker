"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Lock, LogOut, Menu } from "lucide-react";
import { Brand } from "./brand";
import { ThemeToggle } from "./theme-toggle";
import { SyncStatus } from "@/components/sync/sync-status";
import { NAV_GROUPS } from "@/lib/nav";
import { signOut } from "@/lib/auth/client";
import { setActiveUser } from "@/lib/db/database";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useLockStore } from "@/stores/lock-store";

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Topbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const lock = useLockStore((s) => s.lock);
  const pinRequired = useLockStore((s) => s.pinRequired);

  async function handleSignOut() {
    await signOut();
    setActiveUser(null);
    router.push("/login");
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-md sm:px-6 lg:justify-end print:hidden">
      {/* Mobile brand + menu */}
      <div className="flex items-center gap-2 lg:hidden">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full" aria-label="Open menu">
              <Menu className="size-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[280px] p-0">
            <SheetHeader className="border-b border-border px-5 py-4">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <Brand />
            </SheetHeader>
            <nav className="space-y-5 overflow-y-auto px-3 py-4">
              {NAV_GROUPS.map((group) => (
                <div key={group.label}>
                  <p className="px-3 text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground/70">
                    {group.label}
                  </p>
                  <ul className="mt-1.5 space-y-0.5">
                    {group.items.map((item) => {
                      const active = isActive(pathname, item.href);
                      return (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            onClick={() => setOpen(false)}
                            aria-current={active ? "page" : undefined}
                            className={cn(
                              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                              active
                                ? "bg-accent text-accent-foreground"
                                : "text-foreground/80 hover:bg-accent/60",
                            )}
                          >
                            <item.icon
                              className={cn(
                                "size-[1.15rem]",
                                active ? "text-primary" : "text-muted-foreground",
                              )}
                            />
                            {item.label}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
              {pinRequired ? (
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    lock();
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-foreground/80 hover:bg-accent/60"
                >
                  <Lock className="size-[1.15rem] text-muted-foreground" />
                  Lock app
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  void handleSignOut();
                }}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-foreground/80 hover:bg-accent/60"
              >
                <LogOut className="size-[1.15rem] text-muted-foreground" />
                Sign out
              </button>
            </nav>
          </SheetContent>
        </Sheet>
        <Link href="/" aria-label="Ledgerly home">
          <Brand />
        </Link>
      </div>

      <div className="flex items-center gap-1">
        <SyncStatus />
        {pinRequired ? (
          <Button
            variant="ghost"
            size="icon"
            className="hidden rounded-full lg:inline-flex"
            aria-label="Lock app"
            onClick={lock}
          >
            <Lock className="size-[1.1rem]" />
          </Button>
        ) : null}
        <Button
          variant="ghost"
          size="icon"
          className="hidden rounded-full lg:inline-flex"
          aria-label="Sign out"
          onClick={() => void handleSignOut()}
        >
          <LogOut className="size-[1.1rem]" />
        </Button>
        <ThemeToggle />
      </div>
    </header>
  );
}
