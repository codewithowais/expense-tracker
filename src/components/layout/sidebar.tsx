"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Lock, Plus } from "lucide-react";
import { Brand } from "./brand";
import { NAV_GROUPS } from "@/lib/nav";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useQuickAdd } from "@/stores/ui-store";
import { useLockStore } from "@/stores/lock-store";

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar() {
  const pathname = usePathname();
  const openCreate = useQuickAdd((s) => s.openCreate);
  const lock = useLockStore((s) => s.lock);
  const pinRequired = useLockStore((s) => s.pinRequired);

  return (
    <aside className="sticky top-0 hidden h-dvh w-[260px] shrink-0 flex-col border-r border-border bg-sidebar px-4 py-5 lg:flex print:hidden">
      <div className="px-2">
        <Link href="/" aria-label="Ledgerly home">
          <Brand />
        </Link>
      </div>

      <Button className="mt-6 w-full justify-start gap-2 rounded-xl" onClick={() => openCreate()}>
        <Plus className="size-4" />
        Add transaction
      </Button>

      <nav className="mt-6 flex-1 space-y-6 overflow-y-auto pr-1">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="px-3 text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground/70">
              {group.label}
            </p>
            <ul className="mt-2 space-y-0.5">
              {group.items.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                        active
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                      )}
                    >
                      <item.icon
                        className={cn(
                          "size-[1.15rem] transition-colors",
                          active ? "text-sidebar-primary" : "text-muted-foreground group-hover:text-foreground",
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
      </nav>

      {pinRequired ? (
        <Button
          variant="ghost"
          className="mt-2 w-full justify-start gap-2 rounded-xl text-muted-foreground"
          onClick={lock}
        >
          <Lock className="size-4" />
          Lock app
        </Button>
      ) : null}
    </aside>
  );
}
