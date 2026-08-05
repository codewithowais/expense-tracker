import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function appPin(): string {
  return (process.env.APP_PIN ?? "").trim();
}

/** Whether the app requires a PIN to unlock (i.e. APP_PIN is configured). */
export function GET() {
  return NextResponse.json({ pinRequired: appPin().length > 0 });
}

/** Validate a submitted PIN against the server-only APP_PIN. */
export async function POST(request: Request) {
  const pin = appPin();
  // No PIN configured → nothing to unlock against.
  if (!pin) return NextResponse.json({ ok: true });

  let body: { pin?: string };
  try {
    body = (await request.json()) as { pin?: string };
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const candidate = String(body.pin ?? "");
  // Constant-time-ish comparison.
  let diff = candidate.length ^ pin.length;
  for (let i = 0; i < Math.max(candidate.length, pin.length); i++) {
    diff |= (candidate.charCodeAt(i) || 0) ^ (pin.charCodeAt(i) || 0);
  }
  return NextResponse.json({ ok: diff === 0 });
}
