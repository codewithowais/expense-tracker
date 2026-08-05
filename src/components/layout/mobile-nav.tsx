"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus } from "lucide-react";
import { MOBILE_NAV } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { useQuickAdd } from "@/stores/ui-store";

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function MobileNav() {
  const pathname = usePathname();
  const openCreate = useQuickAdd((s) => s.openCreate);

  // Split around a central floating action button.
  const left = MOBILE_NAV.slice(0, 2);
  const right = MOBILE_NAV.slice(2);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden">
      <div className="mx-auto grid max-w-md grid-cols-5 items-center px-2">
        {left.map((item) => (
          <NavButton key={item.href} item={item} active={isActive(pathname, item.href)} />
        ))}
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => openCreate()}
            aria-label="Add transaction"
            className="grid size-13 -translate-y-3 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/25 transition-transform active:scale-95"
            style={{ width: "3.25rem", height: "3.25rem" }}
          >
            <Plus className="size-6" />
          </button>
        </div>
        {right.map((item) => (
          <NavButton key={item.href} item={item} active={isActive(pathname, item.href)} />
        ))}
      </div>
    </nav>
  );
}

function NavButton({
  item,
  active,
}: {
  item: (typeof MOBILE_NAV)[number];
  active: boolean;
}) {
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex flex-col items-center gap-1 py-2.5 text-[0.68rem] font-medium transition-colors",
        active ? "text-primary" : "text-muted-foreground",
      )}
    >
      <item.icon className={cn("size-[1.35rem]", active && "fill-primary/10")} />
      {item.label}
    </Link>
  );
}
