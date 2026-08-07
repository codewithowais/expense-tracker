import { NextRequest, NextResponse } from "next/server";
import { getActiveUser } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Extract plain text from an uploaded PDF, server-side, so the assistant can
 * read a salary slip / invoice as cheap text instead of an expensive image.
 * (Photos are handled by the model's vision directly — see the assistant.)
 */

// Bound the text we return so a huge PDF can't blow up the token budget.
const MAX_CHARS = 12000;

export async function POST(req: NextRequest) {
  const user = await getActiveUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { data?: string; mimeType?: string };
  try {
    body = (await req.json()) as { data?: string; mimeType?: string };
  } catch {
    return NextResponse.json({ error: "bad-request" }, { status: 400 });
  }

  if (!body.data || body.mimeType !== "application/pdf") {
    return NextResponse.json({ error: "only PDF is supported here" }, { status: 400 });
  }

  try {
    const bytes = new Uint8Array(Buffer.from(body.data, "base64"));
    // Import lazily so the pdf.js bundle only loads when a PDF is actually sent.
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(bytes);
    const { text } = await extractText(pdf, { mergePages: true });
    const clean = (typeof text === "string" ? text : String(text)).trim();
    if (!clean) {
      return NextResponse.json({
        text: "",
        note: "No selectable text found — this PDF may be a scan. Try a photo instead.",
      });
    }
    return NextResponse.json({
      text: clean.slice(0, MAX_CHARS),
      truncated: clean.length > MAX_CHARS,
    });
  } catch {
    return NextResponse.json({ error: "extract-failed" }, { status: 502 });
  }
}
