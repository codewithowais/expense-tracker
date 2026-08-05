import { cn } from "@/lib/utils";
import { APP_NAME } from "@/lib/constants";

export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm",
        className,
      )}
      aria-hidden
    >
      <svg viewBox="0 0 24 24" fill="none" className="size-5">
        <path
          d="M6 4.5h7.5a4 4 0 0 1 0 8H6V4.5Z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path d="M6 12.5h6M6 19.5V4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <circle cx="17.5" cy="17" r="2.5" stroke="currentColor" strokeWidth="2" />
      </svg>
    </span>
  );
}

export function Brand({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <BrandMark />
      <span className="font-heading text-lg font-semibold tracking-tight">{APP_NAME}</span>
    </div>
  );
}
