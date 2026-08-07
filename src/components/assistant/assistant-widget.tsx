"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Loader2, Paperclip, RotateCcw, Send, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAssistant, type ImageInput } from "@/lib/assistant/use-assistant";
import { cn } from "@/lib/utils";

type Attachment =
  | { kind: "image"; image: ImageInput; name: string }
  | { kind: "pdf"; text: string; name: string };

const SUGGESTIONS = [
  "Spent 500 on groceries today",
  "How much did I spend this month?",
  "How much can I still spend?",
  "What's my net worth?",
  "Who owes me money?",
  "Show my 6-month spending trend",
];

function fileToImage(file: File): Promise<ImageInput> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result);
      const base64 = url.includes(",") ? url.slice(url.indexOf(",") + 1) : url;
      resolve({ mimeType: file.type || "image/jpeg", data: base64 });
    };
    reader.onerror = () => reject(new Error("read-failed"));
    reader.readAsDataURL(file);
  });
}

export function AssistantWidget() {
  const [open, setOpen] = useState(false);
  const { messages, sending, pending, send, confirm, cancel, reset } = useAssistant();
  const [input, setInput] = useState("");
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [attaching, setAttaching] = useState(false);
  const [attachError, setAttachError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, pending, sending, open]);

  function handleSend() {
    if (sending || attaching) return;
    const text = input;
    const att = attachment;
    if (!text.trim() && !att) return;
    setInput("");
    setAttachment(null);
    setAttachError(null);
    if (att?.kind === "image") void send(text, { image: att.image });
    else if (att?.kind === "pdf") void send(text, { docText: att.text, docName: att.name });
    else void send(text);
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setAttachError(null);
    try {
      const { mimeType, data } = await fileToImage(file);
      if (mimeType === "application/pdf") {
        // Extract text server-side (cheap tokens) instead of sending the PDF bytes.
        setAttaching(true);
        const res = await fetch("/api/extract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data, mimeType }),
        });
        const out = (await res.json().catch(() => ({}))) as { text?: string; note?: string };
        if (!res.ok || !out.text) {
          setAttachError(out.note ?? "Couldn't read that PDF. Try a photo instead.");
          return;
        }
        setAttachment({ kind: "pdf", text: out.text, name: file.name });
      } else if (mimeType.startsWith("image/")) {
        setAttachment({ kind: "image", image: { mimeType, data }, name: file.name });
      } else {
        setAttachError("Unsupported file — attach an image or a PDF.");
      }
    } catch {
      setAttachError("Couldn't read that file.");
    } finally {
      setAttaching(false);
    }
  }

  return (
    <>
      {/* Launcher */}
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open assistant"
          className="fixed bottom-24 right-4 z-40 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lift transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:bottom-6 sm:right-6 print:hidden"
        >
          <Sparkles className="size-6" />
        </button>
      ) : null}

      {/* Panel */}
      {open ? (
        <div className="fixed bottom-24 right-4 z-40 flex h-[560px] max-h-[calc(100dvh-7rem)] w-[calc(100vw-2rem)] max-w-[400px] flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-lift sm:bottom-6 sm:right-6 print:hidden">
          {/* Header */}
          <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-full bg-primary/10 text-primary">
                <Sparkles className="size-4" />
              </span>
              <div className="leading-tight">
                <p className="font-heading text-sm font-semibold">Assistant</p>
                <p className="text-[0.7rem] text-muted-foreground">Ask or tell me about your money</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon-sm" aria-label="New chat" onClick={reset}>
                <RotateCcw className="size-4" />
              </Button>
              <Button variant="ghost" size="icon-sm" aria-label="Close" onClick={() => setOpen(false)}>
                <X className="size-4" />
              </Button>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {messages.length === 0 ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Hi! Try one of these, or type your own:
                </p>
                <div className="flex flex-col gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => void send(s)}
                      disabled={sending}
                      className="rounded-xl border border-border bg-muted/40 px-3 py-2 text-left text-sm transition-colors hover:bg-accent/60 disabled:opacity-50"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m) => (
                <div key={m.id} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                  <div
                    className={cn(
                      "max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm",
                      m.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : m.error
                          ? "bg-expense-soft text-expense"
                          : "bg-muted text-foreground",
                    )}
                  >
                    {m.text}
                  </div>
                </div>
              ))
            )}

            {/* Confirmation card */}
            {pending ? (
              <div className="rounded-2xl border border-primary/30 bg-primary/5 p-3">
                <p className="text-xs font-medium text-muted-foreground">Confirm this action</p>
                <p className="mt-1 text-sm font-medium text-foreground">{pending.summary}</p>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" className="flex-1 gap-1.5" onClick={confirm} disabled={sending}>
                    <Check className="size-4" /> Confirm
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1" onClick={cancel} disabled={sending}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : null}

            {sending && !pending ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" /> Thinking…
              </div>
            ) : null}
          </div>

          {/* Composer */}
          <div className="border-t border-border p-3">
            {attaching ? (
              <div className="mb-2 flex items-center gap-2 rounded-lg bg-muted px-2 py-1 text-xs text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" /> Reading file…
              </div>
            ) : attachment ? (
              <div className="mb-2 flex items-center gap-2 rounded-lg bg-muted px-2 py-1 text-xs">
                <Paperclip className="size-3.5" />
                <span className="min-w-0 flex-1 truncate">
                  {attachment.name}
                  {attachment.kind === "pdf" ? " · text extracted" : ""}
                </span>
                <button type="button" aria-label="Remove attachment" onClick={() => setAttachment(null)}>
                  <X className="size-3.5" />
                </button>
              </div>
            ) : attachError ? (
              <p className="mb-2 text-xs text-expense">{attachError}</p>
            ) : null}
            <div className="flex items-end gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={(e) => void handleFile(e.target.files?.[0])}
              />
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 rounded-full"
                aria-label="Attach receipt or PDF"
                onClick={() => fileRef.current?.click()}
                disabled={sending || attaching}
              >
                <Paperclip className="size-[1.1rem]" />
              </Button>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                rows={1}
                placeholder="Message the assistant…"
                className="max-h-28 min-h-[2.5rem] flex-1 resize-none rounded-2xl border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40"
              />
              <Button
                size="icon"
                className="shrink-0 rounded-full"
                aria-label="Send"
                onClick={handleSend}
                disabled={sending || attaching || (!input.trim() && !attachment)}
              >
                <Send className="size-[1.1rem]" />
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
