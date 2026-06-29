import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/dashboard/Bits";
import { Send, Wand2, Loader2, Download, Plus, Copy, Check } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { supabase } from "@/integrations/supabase/client";
import { openPrintablePdf } from "@/lib/pdf";
import { parseDocumentMessage } from "@/lib/document-utils";
import { getUser } from "@/lib/auth";
import { clearChatMessages, loadChatMessages, saveChatMessages } from "@/lib/chat-storage";

export const Route = createFileRoute("/dashboard/medecin/assistant")({
  component: Assistant,
});

const SUGGESTIONS: string[] = [
  "How many leave days do I have left?",
  "What's the remote-work policy?",
  "How do I request a salary certificate?",
  "Who do I contact for internal mobility?",
];

function Assistant() {
  const [input, setInput] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const { messages, sendMessage, status, error, setMessages } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
      body: { role: "medecin" },
      fetch: async (url, init) => {
        const { data } = await supabase.auth.getSession();
        const headers = new Headers(init?.headers);
        if (data.session?.access_token) {
          headers.set("authorization", `Bearer ${data.session.access_token}`);
        }
        return fetch(url, { ...init, headers });
      },
    }),
  });

  const isLoading = status === "submitted" || status === "streaming";

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  useEffect(() => {
    const user = getUser();
    setUserId(user?.id ?? null);
  }, []);

  useEffect(() => {
    if (!userId) return;
    const stored = loadChatMessages("medecin", userId) as typeof messages;
    if (stored.length) {
      setMessages(stored);
      setShowSuggestions(false);
    }
  }, [userId, setMessages]);

  useEffect(() => {
    if (!userId) return;
    saveChatMessages("medecin", userId, messages);
  }, [messages, userId]);

  function send(text: string) {
    if (!text.trim() || isLoading) return;
    void sendMessage({ text });
    setInput("");
    setShowSuggestions(false);
  }

  function startNewChat() {
    setMessages([]);
    if (userId) {
      clearChatMessages("medecin", userId);
    }
    setInput("");
    setShowSuggestions(true);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="AI HR"
        title="Your HR assistant"
        subtitle="Grounded in your validated company policies — escalates to humans on sensitive topics."
        right={
          <button
            type="button"
            onClick={startNewChat}
            className="btn-ghost inline-flex items-center gap-2 text-xs !px-3 !py-2"
          >
            <Plus className="w-4 h-4" /> New chat
          </button>
        }
      />
      <div className="glow-card rounded-3xl p-6 flex flex-col h-[60vh]">
        <div className="flex-1 overflow-y-auto space-y-3 pr-2">
          {messages.length === 0 && (
            <div className="text-sm text-muted-foreground bg-secondary/40 rounded-2xl px-4 py-3">
              Hi — I'm your Wasl by Humanai assistant. Ask me anything about your HR; I'll answer from validated policies only and route sensitive requests to a human referent.
            </div>
          )}
          {messages.map((m) => {
            const text = m.parts
              .map((p) => (p.type === "text" ? p.text : ""))
              .join("");
            const documentData = m.role === "assistant" ? parseDocumentMessage(text) : null;
            return (
              <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm break-words ${
                    m.role === "user" ? "text-white bg-accent" : "bg-secondary text-foreground"
                  }`}
                >
                  {m.role === "assistant" ? (
                    <>
                      <div className="md-chat">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{text || (isLoading ? "…" : "")}</ReactMarkdown>
                      </div>
                      {documentData ? (
                        <button
                          type="button"
                          onClick={() => openPrintablePdf(documentData)}
                          className="mt-3 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-[11px] font-medium text-foreground hover:bg-secondary"
                        >
                          <Download className="w-3.5 h-3.5" /> Download PDF
                        </button>
                      ) : null}
                    </>
                  ) : (
                    <div className="md-chat on-accent"><ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown></div>
                  )}
                </div>
              </div>
            );
          })}
          {isLoading && messages[messages.length - 1]?.role === "user" && (
            <div className="flex justify-start">
              <div className="bg-secondary text-muted-foreground rounded-2xl px-4 py-2.5 text-sm inline-flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Thinking…
              </div>
            </div>
          )}
          {error && (
            <div className="text-xs text-destructive bg-destructive/10 rounded-xl px-3 py-2">
              {error.message || "Something went wrong. Please try again."}
            </div>
          )}
          <div ref={endRef} />
        </div>
        {showSuggestions && (
          <div className="flex flex-wrap gap-2 my-3">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => {
                  setShowSuggestions(false);
                  send(s);
                }}
                disabled={isLoading}
                className="text-xs px-3 py-1.5 rounded-full bg-secondary hover:bg-accent hover:text-white transition disabled:opacity-50"
              >
                <Wand2 className="w-3 h-3 inline mr-1" />{s}
              </button>
            ))}
          </div>
        )}
        <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="flex gap-2">
          <input
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              if (showSuggestions && e.target.value.trim()) {
                setShowSuggestions(false);
              }
            }}
            placeholder="Ask anything…"
            autoComplete="off"
            spellCheck={false}
            disabled={isLoading}
            className="flex-1 rounded-xl border border-border bg-secondary/40 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent transition"
          />
          <button type="submit" disabled={isLoading || !input.trim()} className="btn-primary !px-4 disabled:opacity-50">
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </form>
      </div>
    </div>
  );
}
