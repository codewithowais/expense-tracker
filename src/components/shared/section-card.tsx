import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface SectionCardProps {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  /** Convenience "See all" link rendered as the action. */
  href?: string;
  hrefLabel?: string;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}

export function SectionCard({
  title,
  description,
  action,
  href,
  hrefLabel = "See all",
  children,
  className,
  bodyClassName,
}: SectionCardProps) {
  return (
    <Card className={cn("card-elevated gap-0 overflow-hidden p-0", className)}>
      {(title || action || href) && (
        <div className="flex items-center justify-between gap-3 px-5 pt-5">
          <div className="space-y-0.5">
            {title ? <h2 className="font-heading text-base font-semibold">{title}</h2> : null}
            {description ? (
              <p className="text-xs text-muted-foreground">{description}</p>
            ) : null}
          </div>
          {action ??
            (href ? (
              <Link
                href={href}
                className="group inline-flex shrink-0 items-center gap-1 rounded-md text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                {hrefLabel}{" "}
                <ArrowRight className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
              </Link>
            ) : null)}
        </div>
      )}
      <div className={cn("p-5", bodyClassName)}>{children}</div>
    </Card>
  );
}
