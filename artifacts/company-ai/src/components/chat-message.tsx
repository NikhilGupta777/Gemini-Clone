import { memo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface ChatMessageProps {
  role: string;
  content: string;
  isStreaming?: boolean;
}

function GeminiStar({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
      <path d="M12 2C12 2 13.5 7.5 18 9C13.5 10.5 12 16 12 16C12 16 10.5 10.5 6 9C10.5 7.5 12 2 12 2Z" fill="url(#gstar-msg)"/>
      <defs>
        <linearGradient id="gstar-msg" x1="6" y1="2" x2="18" y2="16" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#4285f4"/><stop offset="40%" stopColor="#ea4335"/>
          <stop offset="70%" stopColor="#fbbc05"/><stop offset="100%" stopColor="#34a853"/>
        </linearGradient>
      </defs>
    </svg>
  );
}

function ThumbsUpIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/><path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>;
}

function ThumbsDownIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10z"/><path d="M17 2h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/></svg>;
}

function RefreshIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>;
}

function CopyIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>;
}

function MoreHIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg>;
}

export const ChatMessage = memo(function ChatMessage({ role, content, isStreaming }: ChatMessageProps) {
  const isAI = role === "assistant" || role === "model";
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (!isAI) {
    return (
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "16px" }}>
        <div style={{
          background: "#2d2e2f",
          borderRadius: "20px",
          padding: "10px 18px",
          maxWidth: "70%",
          fontSize: "15px",
          lineHeight: "1.5",
          color: "#e3e3e3",
          wordBreak: "break-word",
        }}>
          {content}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", gap: "12px", marginBottom: "24px", alignItems: "flex-start" }}>
      <div style={{ marginTop: "2px", flexShrink: 0 }}>
        <GeminiStar size={22} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          className={`gemini-response${isStreaming ? " streaming-cursor" : ""}`}
          style={{ color: "#e3e3e3", fontSize: "15px", lineHeight: "1.7" }}
        >
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {content}
          </ReactMarkdown>
        </div>

        {/* Action buttons - only for completed messages */}
        {!isStreaming && (
          <div style={{ display: "flex", alignItems: "center", gap: "2px", marginTop: "12px" }}>
            {[
              { icon: <ThumbsUpIcon />, title: "Good response" },
              { icon: <ThumbsDownIcon />, title: "Bad response" },
              { icon: <RefreshIcon />, title: "Regenerate" },
              { icon: <CopyIcon />, title: copied ? "Copied!" : "Copy" },
              { icon: <MoreHIcon />, title: "More" },
            ].map((btn, i) => (
              <button
                key={i}
                onClick={i === 3 ? handleCopy : undefined}
                title={btn.title}
                style={{
                  width: "32px", height: "32px", borderRadius: "50%",
                  background: "transparent", border: "none",
                  color: "#9aa0a6", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "background 0.15s",
                }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              >
                {btn.icon}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});
