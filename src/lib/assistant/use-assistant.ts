"use client";

import { useCallback, useRef, useState } from "react";
import { newId } from "@/lib/crypto";
import { todayISO } from "@/lib/format";
import { settingsRepo } from "@/lib/repositories/settings";
import { categoryRepo } from "@/lib/repositories/categories";
import { savingsGoalRepo } from "@/lib/repositories/savings";
import { assetRepo } from "@/lib/repositories/assets";
import { WRITE_TOOLS } from "@/lib/assistant/tools";
import {
  prepareWriteTool,
  runReadTool,
  type AssistantContext,
  type PreparedWrite,
  type ToolCall,
} from "@/lib/assistant/executors";

// --- Gemini wire types (minimal) -------------------------------------------
interface FunctionCall {
  name: string;
  args?: Record<string, unknown>;
}
interface Part {
  text?: string;
  functionCall?: FunctionCall;
  functionResponse?: { name: string; response: Record<string, unknown> };
  inlineData?: { mimeType: string; data: string };
}
interface Content {
  role: "user" | "model";
  parts: Part[];
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  error?: boolean;
}

export interface PendingConfirm {
  id: string;
  summary: string;
  prepared: PreparedWrite;
  /** functionResponse parts already accumulated this step (reads) to send with. */
  pendingResponses: Part[];
  callName: string;
}

const MAX_CONTENTS = 24;

export interface ImageInput {
  mimeType: string;
  /** base64 (no data: prefix). */
  data: string;
}

export function useAssistant() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const contentsRef = useRef<Content[]>([]);

  const pushMessage = useCallback((role: "user" | "assistant", text: string, error = false) => {
    setMessages((m) => [...m, { id: newId(), role, text, error }]);
  }, []);

  const buildContext = useCallback(async (): Promise<AssistantContext & { blob: string }> => {
    const settings = await settingsRepo.get();
    const currency = settings?.currency ?? "PKR";
    const monthStartDay = settings?.monthStartDay ?? 1;
    const [cats, goals, assets] = await Promise.all([
      categoryRepo.list(false),
      savingsGoalRepo.list(),
      assetRepo.list(),
    ]);
    const blob = [
      `Today: ${todayISO()}`,
      `Currency: ${currency}`,
      `Expense categories: ${cats.filter((c) => c.type === "expense").map((c) => c.name).join(", ") || "none"}`,
      `Income categories: ${cats.filter((c) => c.type === "income").map((c) => c.name).join(", ") || "none"}`,
      goals.length ? `Savings goals: ${goals.map((g) => g.name).join(", ")}` : "",
      assets.length ? `Assets: ${assets.map((a) => a.name).join(", ")}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    return { today: todayISO(), currency, monthStartDay, blob };
  }, []);

  /** One round-trip to the model; returns the model Content or throws a friendly message. */
  const callModel = useCallback(async (ctxBlob: string): Promise<Content> => {
    const res = await fetch("/api/assistant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: contentsRef.current.slice(-MAX_CONTENTS), context: ctxBlob }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      content?: Content;
      message?: string;
    };
    if (!res.ok || !data.content) {
      throw new Error(data.message ?? "The assistant is unavailable right now.");
    }
    return data.content;
  }, []);

  /**
   * Drive the tool loop from the current contentsRef until the model returns a
   * plain text answer or a write needs confirmation. `ctx`/`ctxBlob` are passed
   * through so reads/writes format money correctly.
   */
  const drive = useCallback(
    async (ctx: AssistantContext, ctxBlob: string): Promise<void> => {
      // Safety cap on loop iterations.
      for (let step = 0; step < 8; step++) {
        const content = await callModel(ctxBlob);
        contentsRef.current.push(content);

        const parts = content.parts ?? [];
        const text = parts
          .map((p) => p.text)
          .filter(Boolean)
          .join("\n")
          .trim();
        if (text) pushMessage("assistant", text);

        const calls = parts.filter((p) => p.functionCall).map((p) => p.functionCall as FunctionCall);
        if (calls.length === 0) return; // done — plain answer

        const responses: Part[] = [];
        let confirmCall: { call: ToolCall; prepared: PreparedWrite } | null = null;

        for (const c of calls) {
          const call: ToolCall = { name: c.name, args: c.args ?? {} };
          if (WRITE_TOOLS.has(c.name)) {
            const prep = await prepareWriteTool(c.name, call.args, ctx);
            if ("error" in prep) {
              responses.push({ functionResponse: { name: c.name, response: { error: prep.error } } });
            } else if (!confirmCall) {
              confirmCall = { call, prepared: prep };
            } else {
              // A second write in one turn — defer it with a note; rare.
              responses.push({
                functionResponse: { name: c.name, response: { deferred: "Handled one action at a time." } },
              });
            }
          } else {
            try {
              const result = await runReadTool(c.name, call.args, ctx);
              responses.push({ functionResponse: { name: c.name, response: result } });
            } catch {
              responses.push({ functionResponse: { name: c.name, response: { error: "read failed" } } });
            }
          }
        }

        if (confirmCall) {
          // Pause for user confirmation; resume happens in confirm()/cancel().
          setPending({
            id: newId(),
            summary: confirmCall.prepared.summary,
            prepared: confirmCall.prepared,
            pendingResponses: responses,
            callName: confirmCall.call.name,
          });
          return;
        }

        // Only reads / errors — feed results back and continue the loop.
        // Gemini expects tool results as a user-role content of functionResponse parts.
        contentsRef.current.push({ role: "user", parts: responses });
      }
    },
    [callModel, pushMessage],
  );

  const send = useCallback(
    async (text: string, opts?: { image?: ImageInput; docText?: string; docName?: string }) => {
      const trimmed = text.trim();
      const image = opts?.image;
      const docText = opts?.docText;
      if ((!trimmed && !image && !docText) || sending) return;

      const label = trimmed || (image ? "🧾 (receipt image)" : docText ? `📄 ${opts?.docName ?? "document"}` : "");
      pushMessage("user", label);

      const parts: Part[] = [];
      if (image) parts.push({ inlineData: { mimeType: image.mimeType, data: image.data } });
      const modelText = docText
        ? `${trimmed || "Extract and record the transaction(s) from this document."}\n\n[Document${opts?.docName ? ` "${opts.docName}"` : ""}]:\n${docText}`
        : trimmed || "Here is a receipt — add it as an expense.";
      parts.push({ text: modelText });
      contentsRef.current.push({ role: "user", parts });

      setSending(true);
      try {
        const ctx = await buildContext();
        await drive({ today: ctx.today, currency: ctx.currency, monthStartDay: ctx.monthStartDay }, ctx.blob);
      } catch (e) {
        pushMessage("assistant", e instanceof Error ? e.message : "Something went wrong.", true);
      } finally {
        setSending(false);
      }
    },
    [sending, pushMessage, buildContext, drive],
  );

  const resolveConfirm = useCallback(
    async (accept: boolean) => {
      const p = pending;
      if (!p) return;
      setPending(null);
      setSending(true);
      try {
        const responses = [...p.pendingResponses];
        if (accept) {
          const result = await p.prepared.run();
          responses.push({ functionResponse: { name: p.callName, response: result } });
          pushMessage("assistant", `✅ Done — ${p.summary}`);
        } else {
          responses.push({
            functionResponse: { name: p.callName, response: { cancelled: true } },
          });
          pushMessage("assistant", "Okay, cancelled — nothing was saved.");
        }
        contentsRef.current.push({ role: "user", parts: responses });
        const ctx = await buildContext();
        await drive({ today: ctx.today, currency: ctx.currency, monthStartDay: ctx.monthStartDay }, ctx.blob);
      } catch (e) {
        pushMessage("assistant", e instanceof Error ? e.message : "Couldn't complete that.", true);
      } finally {
        setSending(false);
      }
    },
    [pending, pushMessage, buildContext, drive],
  );

  const reset = useCallback(() => {
    contentsRef.current = [];
    setMessages([]);
    setPending(null);
  }, []);

  return {
    messages,
    sending,
    pending,
    send,
    confirm: () => resolveConfirm(true),
    cancel: () => resolveConfirm(false),
    reset,
  };
}
