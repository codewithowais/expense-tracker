import { NextRequest, NextResponse } from "next/server";
import { getActiveUser } from "@/lib/auth/session";
import { BASE_SYSTEM_PROMPT, FUNCTION_DECLARATIONS } from "@/lib/assistant/tools";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Assistant relay. Holds the Gemini API key server-side and forwards one
 * generateContent step at a time. The tool-calling loop itself is orchestrated
 * by the client (executors run against the local ledger), so this route is a
 * thin, stateless proxy: it never touches the user's data.
 */

const MODEL = process.env.ASSISTANT_MODEL ?? "gemini-2.5-flash";

interface AssistantRequest {
  contents: unknown;
  /** Live context (date, currency, category names) appended to the system prompt. */
  context?: string;
}

export async function POST(req: NextRequest) {
  const user = await getActiveUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error: "no-key",
        message:
          "The assistant isn't configured yet. Add a GEMINI_API_KEY (free from Google AI Studio) in the environment.",
      },
      { status: 503 },
    );
  }

  let body: AssistantRequest;
  try {
    body = (await req.json()) as AssistantRequest;
  } catch {
    return NextResponse.json({ error: "bad-request" }, { status: 400 });
  }
  if (!Array.isArray(body.contents)) {
    return NextResponse.json({ error: "bad-request" }, { status: 400 });
  }

  const systemText = body.context
    ? `${BASE_SYSTEM_PROMPT}\n\nContext:\n${body.context}`
    : BASE_SYSTEM_PROMPT;

  const payload = {
    systemInstruction: { parts: [{ text: systemText }] },
    contents: body.contents,
    tools: [{ functionDeclarations: FUNCTION_DECLARATIONS }],
    generationConfig: { temperature: 0.3 },
  };

  try {
    // v1beta is the endpoint that serves current models (gemini-2.5-flash) with
    // systemInstruction + function-calling; v1 404s on newer models.
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify(payload),
      },
    );

    if (!res.ok) {
      let detail = "";
      try {
        const err = (await res.json()) as { error?: { message?: string } };
        detail = err.error?.message ?? "";
      } catch {
        /* ignore */
      }
      // Log the full upstream error server-side (visible in deploy logs).
      console.error("[assistant] gemini", res.status, detail);
      const message =
        res.status === 429
          ? "The free AI limit was hit for now — try again in a minute."
          : /api[_ ]?key|invalid|permission|denied/i.test(detail)
            ? "The GEMINI_API_KEY looks invalid or unauthorized — double-check it in your environment."
            : detail
              ? `Assistant error: ${detail.slice(0, 180)}`
              : "The assistant service had an error. Please try again.";
      return NextResponse.json({ error: "upstream", message }, { status: 502 });
    }

    const data = (await res.json()) as {
      candidates?: { content?: unknown; finishReason?: string }[];
      promptFeedback?: { blockReason?: string };
    };

    const candidate = data.candidates?.[0];
    if (!candidate?.content) {
      const blocked = data.promptFeedback?.blockReason;
      return NextResponse.json({
        content: {
          role: "model",
          parts: [
            {
              text: blocked
                ? "I can't help with that request."
                : "Sorry, I didn't get a response. Please try rephrasing.",
            },
          ],
        },
      });
    }

    return NextResponse.json({ content: candidate.content });
  } catch {
    return NextResponse.json(
      { error: "fetch-failed", message: "Couldn't reach the assistant service." },
      { status: 502 },
    );
  }
}
