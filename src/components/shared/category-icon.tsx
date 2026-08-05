import { createElement } from "react";
import { resolveIcon } from "@/lib/icon-map";
import { cn } from "@/lib/utils";

const SIZES = {
  sm: { box: "size-8 rounded-lg", icon: "size-4" },
  md: { box: "size-10 rounded-xl", icon: "size-[1.15rem]" },
  lg: { box: "size-12 rounded-2xl", icon: "size-6" },
} as const;

interface CategoryIconProps {
  icon: string;
  /** A chart palette token, e.g. "chart-1". */
  color: string;
  size?: keyof typeof SIZES;
  className?: string;
}

/** A category's icon in a soft, color-tinted tile. */
export function CategoryIcon({ icon, color, size = "md", className }: CategoryIconProps) {
  const s = SIZES[size];
  return (
    <span
      className={cn("grid shrink-0 place-items-center", s.box, className)}
      style={{
        backgroundColor: `color-mix(in oklab, var(--${color}) 16%, transparent)`,
        color: `var(--${color})`,
      }}
    >
      {createElement(resolveIcon(icon), { className: s.icon, strokeWidth: 2, "aria-hidden": true })}
    </span>
  );
}
