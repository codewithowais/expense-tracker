import { NextResponse } from "next/server";
import { isSyncConfigured } from "@/lib/server/neon";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ configured: isSyncConfigured() });
}
