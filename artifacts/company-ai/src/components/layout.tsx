import { ReactNode, useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import {
  useListGeminiConversations,
  useCreateGeminiConversation,
  useDeleteGeminiConversation,
  useRenameGeminiConversation,
} from "@workspace/api-client-react";
import { cn } from "@/lib/utils";

function GeminiStar({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M12 2C12 2 13.5 7.5 18 9C13.5 10.5 12 16 12 16C12 16 10.5 10.5 6 9C10.5 7.5 12 2 12 2Z"
        fill="url(#gemini-grad)"
      />
      <defs>
        <linearGradient id="gemini-grad" x1="6" y1="2" x2="18" y2="16" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#4285f4" />
          <stop offset="33%" stopColor="#ea4335" />
          <stop offset="66%" stopColor="#fbbc05" />
          <stop offset="100%" stopColor="#34a853" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="3" y1="6" x2="21" y2="6"/>
      <line x1="3" y1="12" x2="21" y2="12"/>
      <line x1="3" y1="18" x2="21" y2="18"/>
    </svg>
  );
}

function EditIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="11" cy="11" r="8"/>
      <path d="m21 21-4.35-4.35"/>
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  );
}

function DatabaseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="5" rx="9" ry="3"/>
      <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6"/>
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
      <path d="M10 11v6M14 11v6"/>
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
    </svg>
  );
}

function PinIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2l2.4 6.4L21 10l-4.8 4.4 1.4 6.6L12 18l-5.6 3 1.4-6.6L3 10l6.6-1.6L12 2z"/>
    </svg>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [location, setLocation] = useLocation();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [hoveredId, setHoveredId] = useState<number | null>(null);

  const { data: conversations = [], isLoading } = useListGeminiConversations();
  const createChat = useCreateGeminiConversation();
  const deleteChat = useDeleteGeminiConversation();
  const renameChat = useRenameGeminiConversation();

  useEffect(() => {
    if (window.innerWidth < 768) setSidebarOpen(false);
  }, []);

  const handleNewChat = () => {
    setLocation("/");
  };

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    await deleteChat.mutateAsync({ id });
    if (location === `/chat/${id}`) setLocation("/");
  };

  const handleRenameSubmit = async (id: number) => {
    if (editTitle.trim()) await renameChat.mutateAsync({ id, data: { title: editTitle } });
    setEditingId(null);
  };

  const getConversationTitle = (title: string) => {
    if (title.length > 28) return title.slice(0, 28) + "...";
    return title;
  };

  const activeChatId = location.startsWith("/chat/") ? parseInt(location.split("/chat/")[1]) : null;

  return (
    <div style={{ display: "flex", height: "100vh", width: "100%", overflow: "hidden", background: "#131314", color: "white" }}>
      
      {/* SIDEBAR */}
      <div style={{
        width: sidebarOpen ? "230px" : "72px",
        minWidth: sidebarOpen ? "230px" : "72px",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "#131314",
        transition: "width 0.2s ease, min-width 0.2s ease",
        overflow: "hidden",
        flexShrink: 0,
        zIndex: 10,
      }}>
        
        {/* Sidebar Top Icons */}
        <div style={{ padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: sidebarOpen ? "space-between" : "center", gap: "4px", marginBottom: "4px" }}>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            style={{ width: "40px", height: "40px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: "transparent", border: "none", color: "#e3e3e3", cursor: "pointer", flexShrink: 0 }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
          >
            <MenuIcon />
          </button>
          {sidebarOpen && (
            <button
              onClick={handleNewChat}
              style={{ width: "40px", height: "40px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: "transparent", border: "none", color: "#e3e3e3", cursor: "pointer" }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              title="New chat"
            >
              <EditIcon />
            </button>
          )}
        </div>

        {/* New Chat icon (collapsed only) */}
        {!sidebarOpen && (
          <div style={{ padding: "4px 16px", marginBottom: "8px" }}>
            <button
              onClick={handleNewChat}
              style={{ width: "40px", height: "40px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: "transparent", border: "none", color: "#e3e3e3", cursor: "pointer" }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              title="New chat"
            >
              <EditIcon />
            </button>
          </div>
        )}

        {/* Sidebar Content (only when open) */}
        {sidebarOpen && (
          <>
            {/* New chat button */}
            <div style={{ padding: "4px 12px 8px" }}>
              <button
                onClick={handleNewChat}
                className="sidebar-item"
                style={{ width: "100%", fontWeight: 400, fontSize: "14px" }}
              >
                <EditIcon />
                <span>New chat</span>
              </button>
              <button
                className="sidebar-item"
                style={{ width: "100%", marginTop: "2px" }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                <span>My stuff</span>
              </button>
            </div>

            {/* Knowledge Base (like Gems section) */}
            <div style={{ padding: "8px 12px 4px" }}>
              <div style={{ fontSize: "12px", color: "#9aa0a6", padding: "6px 12px 4px", fontWeight: 500, letterSpacing: "0.02em", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>SOURCES</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9aa0a6" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
              </div>
              <Link href="/knowledge-base">
                <button
                  className={cn("sidebar-item", location === "/knowledge-base" && "active")}
                  style={{ width: "100%", color: location === "/knowledge-base" ? "white" : "#e3e3e3" }}
                >
                  <DatabaseIcon />
                  <span>Knowledge Base</span>
                </button>
              </Link>
            </div>

            {/* Chats section */}
            <div style={{ padding: "8px 12px 4px" }}>
              <div style={{ fontSize: "12px", color: "#9aa0a6", padding: "6px 12px 4px", fontWeight: 500, letterSpacing: "0.02em" }}>
                CHATS
              </div>
            </div>

            {/* Conversation list */}
            <div style={{ flex: 1, overflowY: "auto", padding: "0 12px" }}>
              {isLoading ? (
                <div style={{ padding: "8px 12px", color: "#9aa0a6", fontSize: "14px" }}>Loading...</div>
              ) : conversations.length === 0 ? (
                <div style={{ padding: "8px 12px", color: "#9aa0a6", fontSize: "14px" }}>No chats yet</div>
              ) : (
                conversations.map((chat) => {
                  const isActive = activeChatId === chat.id;
                  return (
                    <div
                      key={chat.id}
                      style={{ position: "relative" }}
                      onMouseEnter={() => setHoveredId(chat.id)}
                      onMouseLeave={() => setHoveredId(null)}
                    >
                      <Link href={`/chat/${chat.id}`}>
                        <div
                          className={cn("sidebar-item", isActive && "active")}
                          style={{
                            color: isActive ? "white" : "#e3e3e3",
                            fontWeight: isActive ? 500 : 400,
                            paddingRight: hoveredId === chat.id ? "56px" : "12px",
                          }}
                        >
                          {editingId === chat.id ? (
                            <input
                              autoFocus
                              value={editTitle}
                              onChange={(e) => setEditTitle(e.target.value)}
                              onBlur={() => handleRenameSubmit(chat.id)}
                              onKeyDown={(e) => { if (e.key === "Enter") handleRenameSubmit(chat.id); if (e.key === "Escape") setEditingId(null); }}
                              onClick={(e) => e.preventDefault()}
                              style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: "4px", padding: "2px 6px", fontSize: "14px", color: "white", outline: "none", width: "100%" }}
                            />
                          ) : (
                            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {getConversationTitle(chat.title)}
                            </span>
                          )}
                        </div>
                      </Link>
                      {/* Hover actions */}
                      {hoveredId === chat.id && editingId !== chat.id && (
                        <div style={{ position: "absolute", right: "8px", top: "50%", transform: "translateY(-50%)", display: "flex", gap: "2px", zIndex: 1 }}>
                          <button
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                            style={{ width: "24px", height: "24px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: "transparent", border: "none", color: "#9aa0a6", cursor: "pointer" }}
                            onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.1)")}
                            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                            title="Pin"
                          >
                            <PinIcon />
                          </button>
                          <button
                            onClick={(e) => handleDelete(chat.id, e)}
                            style={{ width: "24px", height: "24px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: "transparent", border: "none", color: "#9aa0a6", cursor: "pointer" }}
                            onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.1)")}
                            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                            title="Delete"
                          >
                            <TrashIcon />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}

        {/* Sidebar bottom - settings */}
        <div style={{ padding: "12px 16px", marginTop: "auto", flexShrink: 0 }}>
          {sidebarOpen ? (
            <button
              className="sidebar-item"
              style={{ width: "100%", position: "relative" }}
            >
              <SettingsIcon />
              <span>Settings and help</span>
              <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#4285f4", marginLeft: "auto", flexShrink: 0 }}></span>
            </button>
          ) : (
            <button
              style={{ width: "40px", height: "40px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: "transparent", border: "none", color: "#9aa0a6", cursor: "pointer" }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              title="Settings"
            >
              <SettingsIcon />
            </button>
          )}
        </div>
      </div>

      {/* MAIN CONTENT */}
      <main style={{ flex: 1, display: "flex", flexDirection: "column", height: "100%", minWidth: 0, overflow: "hidden", position: "relative" }}>
        {children}
      </main>
    </div>
  );
}
