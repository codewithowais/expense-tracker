"use client";

/** Whether the app requires a PIN (APP_PIN configured on the server). */
export async function fetchPinRequired(): Promise<boolean> {
  try {
    const res = await fetch("/api/lock", { cache: "no-store" });
    if (!res.ok) return false;
    const data = (await res.json()) as { pinRequired: boolean };
    return Boolean(data.pinRequired);
  } catch {
    // No server / offline → cannot enforce a server PIN; don't hard-lock out.
    return false;
  }
}

/** Validate a PIN against the server. Returns true when correct. */
export async function verifyAppPin(pin: string): Promise<boolean> {
  try {
    const res = await fetch("/api/lock", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pin }),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { ok: boolean };
    return Boolean(data.ok);
  } catch {
    return false;
  }
}
