import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import TextareaAutosize from "react-textarea-autosize";
import {
  useListGeminiMessages,
  useCreateGeminiConversation,
  useListGeminiConversations,
} from "@workspace/api-client-react";
import { ChatMessage } from "@/components/chat-message";
import { Layout } from "@/components/layout";

function GeminiStar({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M12 2C12 2 13.5 7.5 18 9C13.5 10.5 12 16 12 16C12 16 10.5 10.5 6 9C10.5 7.5 12 2 12 2Z"
        fill="url(#gstar)"
      />
      <defs>
        <linearGradient id="gstar" x1="6" y1="2" x2="18" y2="16" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#4285f4" />
          <stop offset="40%" stopColor="#ea4335" />
          <stop offset="70%" stopColor="#fbbc05" />
          <stop offset="100%" stopColor="#34a853" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  );
}

function ToolsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/>
    </svg>
  );
}

function MicIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
      <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8"/>
    </svg>
  );
}

function StopIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="6" width="12" height="12" rx="2"/>
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
    </svg>
  );
}

function MoreIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="5" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/><circle cx="12" cy="19" r="1" fill="currentColor"/>
    </svg>
  );
}

const SUGGESTIONS = [
  { emoji: "📄", text: "Summarize a document" },
  { emoji: "🔍", text: "Search knowledge base" },
  { emoji: "✉️", text: "Draft an email" },
  { emoji: "📊", text: "Analyze company data" },
  { emoji: "💡", text: "Brainstorm ideas" },
  { emoji: "📝", text: "Create a report" },
];

function useChatStream(conversationId: number | null) {
  const [streamingMessage, setStreamingMessage] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(async (content: string) => {
    if (!conversationId || isStreaming) return;
    setIsStreaming(true);
    setStreamingMessage("");

    abortRef.current = new AbortController();
    try {
      const resp = await fetch(`/api/gemini/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
        signal: abortRef.current.signal,
      });
      if (!resp.ok || !resp.body) throw new Error("Stream failed");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.done) break;
            if (data.content) setStreamingMessage((prev) => prev + data.content);
          } catch {}
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== "AbortError") console.error(err);
    } finally {
      setIsStreaming(false);
      setStreamingMessage("");
    }
  }, [conversationId, isStreaming]);

  const stopStream = () => {
    abortRef.current?.abort();
    setIsStreaming(false);
    setStreamingMessage("");
  };

  return { sendMessage, streamingMessage, isStreaming, stopStream };
}

export default function ChatPage() {
  const [location, setLocation] = useLocation();
  const conversationId = location.startsWith("/chat/") ? parseInt(location.split("/chat/")[1]) : null;

  const [input, setInput] = useState("");
  const [localMessages, setLocalMessages] = useState<Array<{ role: string; content: string; id?: number }>>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const createChat = useCreateGeminiConversation();
  const { data: conversations = [] } = useListGeminiConversations();
  const { data: messages = [], refetch } = useListGeminiMessages(
    conversationId as number,
    { query: { enabled: !!conversationId } }
  );
  const { sendMessage, streamingMessage, isStreaming, stopStream } = useChatStream(conversationId);

  const currentTitle = conversations.find((c) => c.id === conversationId)?.title;

  useEffect(() => {
    if (messages.length > 0) setLocalMessages(messages);
  }, [messages]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [localMessages, streamingMessage]);

  useEffect(() => {
    if (!isStreaming && conversationId) {
      refetch();
    }
  }, [isStreaming, conversationId, refetch]);

  const handleSubmit = async () => {
    if (!input.trim() || isStreaming) return;
    const content = input.trim();
    setInput("");

    if (!conversationId) {
      try {
        const chat = await createChat.mutateAsync({ data: { title: content.slice(0, 50) } });
        setLocation(`/chat/${chat.id}`);
        setTimeout(() => {
          setLocalMessages([{ role: "user", content }]);
          sendMessage(content);
        }, 100);
      } catch {}
      return;
    }

    setLocalMessages((prev) => [...prev, { role: "user", content }]);
    await sendMessage(content);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
  };

  const handleSuggestion = (text: string) => {
    setInput(text);
  };

  const displayMessages = conversationId ? localMessages : [];

  return (
    <Layout>
      <div style={{ display: "flex", flexDirection: "column", height: "100%", position: "relative" }}>
        
        {/* TOP BAR */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "8px 16px", height: "56px", flexShrink: 0,
        }}>
          <span style={{ fontSize: "18px", fontWeight: 400, color: "white", letterSpacing: "0.01em" }}>
            {conversationId && currentTitle ? currentTitle : "Gemini"}
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {conversationId && (
              <>
                <button style={iconBtnStyle} title="Share"><ShareIcon /></button>
                <button style={iconBtnStyle} title="More"><MoreIcon /></button>
              </>
            )}
            {/* PRO avatar */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "13px", color: "#9aa0a6", fontWeight: 500 }}>PRO</span>
              <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: "linear-gradient(135deg, #4285f4, #34a853)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", fontWeight: 600, color: "white" }}>
                C
              </div>
            </div>
          </div>
        </div>

        {/* MAIN AREA */}
        <div
          ref={scrollRef}
          style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}
        >
          {!conversationId || displayMessages.length === 0 ? (
            /* WELCOME SCREEN */
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 16px 120px" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: "32px" }}>
                <div style={{ marginBottom: "12px" }}>
                  <GeminiStar size={36} />
                </div>
                <div style={{ fontSize: "16px", color: "#e3e3e3", marginBottom: "6px", fontWeight: 400 }}>
                  Hi there
                </div>
                <div style={{ fontSize: "36px", color: "white", fontWeight: 400, textAlign: "center", lineHeight: 1.2 }}>
                  Where should we start?
                </div>
              </div>

              {/* Suggestions pills */}
              <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "8px", maxWidth: "600px" }}>
                {SUGGESTIONS.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => handleSuggestion(s.text)}
                    className="gemini-pill"
                  >
                    {s.emoji} {s.text}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* CHAT MESSAGES */
            <div style={{ maxWidth: "768px", width: "100%", margin: "0 auto", padding: "24px 16px 140px" }}>
              {displayMessages.map((msg, i) => (
                <ChatMessage key={msg.id ?? i} role={msg.role} content={msg.content} />
              ))}
              {isStreaming && streamingMessage && (
                <ChatMessage role="assistant" content={streamingMessage} isStreaming />
              )}
              {isStreaming && !streamingMessage && (
                <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "8px 0" }}>
                  <GeminiStar size={20} />
                  <div style={{ display: "flex", gap: "4px" }}>
                    {[0, 1, 2].map((i) => (
                      <div key={i} style={{
                        width: "8px", height: "8px", borderRadius: "50%", background: "#4285f4",
                        animation: "pulse 1.4s ease-in-out infinite",
                        animationDelay: `${i * 0.2}s`,
                      }} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* INPUT AREA - fixed at bottom */}
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0,
          padding: "0 16px 20px",
          background: "linear-gradient(to top, #131314 80%, transparent)",
        }}>
          <div style={{ maxWidth: "768px", margin: "0 auto" }}>
            {/* Input box exactly like Gemini */}
            <div className="gemini-input-box" style={{ padding: "12px 16px 8px" }}>
              <TextareaAutosize
                minRows={1}
                maxRows={8}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask Gemini"
                style={{
                  width: "100%", resize: "none", background: "transparent",
                  border: "none", outline: "none", color: "white",
                  fontSize: "16px", lineHeight: "1.5", fontFamily: "inherit",
                  caretColor: "#4285f4",
                }}
              />
              {/* Bottom toolbar */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "8px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  <button
                    style={{ ...toolbarBtnStyle }}
                    title="Attach files"
                  >
                    <PlusIcon />
                  </button>
                  <button style={{ ...toolbarBtnStyle, gap: "6px", padding: "6px 12px", borderRadius: "100px" }}>
                    <ToolsIcon />
                    <span style={{ fontSize: "14px" }}>Tools</span>
                  </button>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  {isStreaming ? (
                    <button
                      onClick={stopStream}
                      style={{ width: "36px", height: "36px", borderRadius: "50%", background: "#3c4043", border: "none", color: "white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                    >
                      <StopIcon />
                    </button>
                  ) : input.trim() ? (
                    <button
                      onClick={handleSubmit}
                      style={{ width: "36px", height: "36px", borderRadius: "50%", background: "#4285f4", border: "none", color: "white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                    >
                      <SendIcon />
                    </button>
                  ) : (
                    <button style={{ ...toolbarBtnStyle }} title="Voice input">
                      <MicIcon />
                    </button>
                  )}
                </div>
              </div>
            </div>
            <div style={{ textAlign: "center", marginTop: "8px", fontSize: "12px", color: "#6c6c72" }}>
              Gemini can make mistakes. Check important info.
            </div>
          </div>
        </div>

      </div>
    </Layout>
  );
}

const iconBtnStyle: React.CSSProperties = {
  width: "36px", height: "36px", borderRadius: "50%",
  background: "transparent", border: "none", color: "#9aa0a6",
  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
};

const toolbarBtnStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "center",
  background: "transparent", border: "none", color: "#9aa0a6",
  cursor: "pointer", padding: "6px", borderRadius: "50%",
};
