import Link from "next/link";
import { Compass } from "lucide-react";
import { Brand } from "@/components/layout/brand";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-background px-6 text-center">
      <Brand />
      <span className="grid size-16 place-items-center rounded-3xl bg-accent text-accent-foreground">
        <Compass className="size-8" strokeWidth={1.75} />
      </span>
      <div className="space-y-1.5">
        <h1 className="font-heading text-2xl font-semibold">Page not found</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          The page you’re looking for doesn’t exist or has moved.
        </p>
      </div>
      <Button asChild>
        <Link href="/">Back to dashboard</Link>
      </Button>
    </div>
  );
}
