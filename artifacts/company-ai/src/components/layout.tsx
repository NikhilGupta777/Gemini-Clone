import { ReactNode, useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { 
  MessageSquare, 
  PlusCircle, 
  Menu, 
  Database, 
  ChevronLeft,
  Settings,
  MoreVertical,
  Trash2,
  Edit2
} from "lucide-react";
import { 
  useListGeminiConversations, 
  useCreateGeminiConversation,
  useDeleteGeminiConversation,
  useRenameGeminiConversation
} from "@workspace/api-client-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export function Layout({ children }: { children: ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [location, setLocation] = useLocation();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");

  const { data: conversations = [], isLoading } = useListGeminiConversations();
  const createChat = useCreateGeminiConversation();
  const deleteChat = useDeleteGeminiConversation();
  const renameChat = useRenameGeminiConversation();

  // Close sidebar on mobile on initial load
  useEffect(() => {
    if (window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
  }, []);

  const handleNewChat = async () => {
    try {
      const chat = await createChat.mutateAsync({
        data: { title: "New Conversation" }
      });
      setLocation(`/chat/${chat.id}`);
      if (window.innerWidth < 768) setIsSidebarOpen(false);
    } catch (error) {
      console.error("Failed to create chat", error);
    }
  };

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this conversation?")) {
      await deleteChat.mutateAsync({ id });
      if (location === `/chat/${id}`) {
        setLocation("/");
      }
    }
  };

  const handleRenameSubmit = async (id: number) => {
    if (editTitle.trim()) {
      await renameChat.mutateAsync({ id, data: { title: editTitle } });
    }
    setEditingId(null);
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      {/* Mobile overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{ 
          width: isSidebarOpen ? 280 : 0,
          opacity: isSidebarOpen ? 1 : 0,
        }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        className="fixed md:relative z-50 flex h-full flex-col border-r border-border bg-sidebar shrink-0 overflow-hidden shadow-2xl md:shadow-none"
      >
        <div className="flex items-center justify-between p-4 min-w-[280px]">
          <Link href="/" className="flex items-center gap-3 px-2">
            <img src={`${import.meta.env.BASE_URL}images/logo.png`} alt="Logo" className="w-8 h-8 rounded-lg shadow-lg" />
            <span className="font-display font-semibold text-lg tracking-wide text-foreground">Company AI</span>
          </Link>
          <button 
            onClick={() => setIsSidebarOpen(false)}
            className="md:hidden p-2 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
        </div>

        <div className="px-4 py-2 min-w-[280px]">
          <button
            onClick={handleNewChat}
            disabled={createChat.isPending}
            className="flex w-full items-center gap-2 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 px-4 py-3 text-sm font-semibold transition-all hover:scale-[1.02] active:scale-95 shadow-sm border border-primary/20 disabled:opacity-50"
          >
            <PlusCircle size={18} />
            {createChat.isPending ? "Creating..." : "New chat"}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1 min-w-[280px]">
          <h3 className="px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 mt-4">
            Recent
          </h3>
          
          {isLoading ? (
            <div className="px-3 text-sm text-muted-foreground animate-pulse">Loading...</div>
          ) : conversations.length === 0 ? (
            <div className="px-3 text-sm text-muted-foreground">No conversations yet</div>
          ) : (
            conversations.map((chat) => {
              const isActive = location === `/chat/${chat.id}`;
              return (
                <div key={chat.id} className="group relative flex items-center">
                  <Link
                    href={`/chat/${chat.id}`}
                    onClick={() => window.innerWidth < 768 && setIsSidebarOpen(false)}
                    className={cn(
                      "flex-1 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all duration-200 truncate",
                      isActive 
                        ? "bg-secondary text-primary font-medium shadow-sm" 
                        : "text-foreground hover:bg-muted/50 hover:text-foreground"
                    )}
                  >
                    <MessageSquare size={16} className={isActive ? "text-primary" : "text-muted-foreground"} />
                    
                    {editingId === chat.id ? (
                      <input
                        autoFocus
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        onBlur={() => handleRenameSubmit(chat.id)}
                        onKeyDown={(e) => e.key === 'Enter' && handleRenameSubmit(chat.id)}
                        onClick={(e) => e.preventDefault()}
                        className="bg-background border border-border rounded px-2 py-0.5 text-sm w-full outline-none ring-1 ring-primary/30"
                      />
                    ) : (
                      <span className="truncate">{chat.title}</span>
                    )}
                  </Link>

                  {/* Actions Dropdown Trigger (simulated with simple hover icons for speed) */}
                  <div className={cn(
                    "absolute right-2 flex gap-1 opacity-0 transition-opacity",
                    "group-hover:opacity-100",
                    isActive && "opacity-100"
                  )}>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setEditingId(chat.id);
                        setEditTitle(chat.title);
                      }}
                      className="p-1.5 rounded-md hover:bg-background/80 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={(e) => handleDelete(chat.id, e)}
                      className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="p-4 border-t border-border/50 min-w-[280px]">
          <Link
            href="/knowledge-base"
            onClick={() => window.innerWidth < 768 && setIsSidebarOpen(false)}
            className={cn(
              "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200",
              location === "/knowledge-base"
                ? "bg-secondary text-primary shadow-sm border border-border"
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground border border-transparent"
            )}
          >
            <Database size={18} className={location === "/knowledge-base" ? "text-primary" : ""} />
            Knowledge Base
          </Link>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex flex-1 flex-col relative h-full min-w-0">
        <header className="absolute top-0 w-full z-30 flex items-center p-4 bg-gradient-to-b from-background via-background/90 to-transparent pointer-events-none">
          {!isSidebarOpen && (
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="p-2.5 rounded-xl bg-card border border-border/50 shadow-lg text-foreground hover:text-primary transition-colors pointer-events-auto group"
            >
              <Menu size={20} className="group-hover:scale-110 transition-transform" />
            </button>
          )}
        </header>

        <div className="flex-1 overflow-hidden relative">
          {children}
        </div>
      </main>
    </div>
  );
}
