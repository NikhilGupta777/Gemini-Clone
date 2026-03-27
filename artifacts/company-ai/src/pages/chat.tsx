import { useState, useRef, useEffect } from "react";
import { useRoute } from "wouter";
import TextareaAutosize from "react-textarea-autosize";
import { ArrowUp, Sparkles, FileText, Database, ShieldAlert } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  useGetGeminiConversation, 
  useListGeminiMessages,
  useCreateGeminiConversation 
} from "@workspace/api-client-react";
import { useChatStream } from "@/hooks/use-chat-stream";
import { ChatMessage } from "@/components/chat-message";
import { Layout } from "@/components/layout";

const SUGGESTIONS = [
  { icon: FileText, text: "Summarize the Q3 financial report" },
  { icon: Database, text: "Search knowledge base for PTO policy" },
  { icon: Sparkles, text: "Draft an email to the marketing team" },
  { icon: ShieldAlert, text: "What are the latest compliance updates?" },
];

export default function ChatPage() {
  const [match, params] = useRoute("/chat/:id");
  const [, setLocation] = useRoute("/"); // for redirection if creating new
  const conversationId = match ? parseInt(params.id, 10) : null;

  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const createChat = useCreateGeminiConversation();
  
  // Only fetch if we have an ID
  const { data: messages = [], isLoading: isLoadingMessages } = useListGeminiMessages(
    conversationId as number,
    { query: { enabled: !!conversationId } }
  );

  const { sendMessage, streamingMessage, isStreaming } = useChatStream(conversationId);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth"
      });
    }
  }, [messages, streamingMessage]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isStreaming) return;

    const content = input.trim();
    setInput("");

    if (!conversationId) {
      // Create new conversation first
      try {
        const chat = await createChat.mutateAsync({
          data: { title: content.slice(0, 40) + "..." }
        });
        // We can't immediately stream in the same render loop due to wouter changing location,
        // so we'd navigate there. But for smooth UX, we ideally want to create and stream.
        // For simplicity: redirect to the new chat, user has to send again, OR we can handle it 
        // with a temporary state. Let's just create and redirect for now.
        window.location.href = `/chat/${chat.id}?prompt=${encodeURIComponent(content)}`;
      } catch (err) {
        console.error("Failed to create chat", err);
      }
      return;
    }

    await sendMessage(content);
  };

  // Check URL params for initial prompt (from the flow above)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const prompt = urlParams.get('prompt');
    if (prompt && conversationId && messages.length === 0 && !isStreaming) {
      // Clear URL param
      window.history.replaceState({}, '', `/chat/${conversationId}`);
      sendMessage(prompt);
    }
  }, [conversationId, messages.length, isStreaming, sendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <Layout>
      <div className="flex flex-col h-full w-full relative">
        
        {/* Chat Area */}
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto pb-36 pt-16 px-4 md:px-0 scroll-smooth"
        >
          {!conversationId ? (
            <div className="h-full flex flex-col items-center justify-center max-w-3xl mx-auto px-6">
              <motion.div
                initial={{ scale: 0.9, opacity: 0, filter: 'blur(10px)' }}
                animate={{ scale: 1, opacity: 1, filter: 'blur(0px)' }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="absolute inset-0 pointer-events-none -z-10"
              >
                <img 
                  src={`${import.meta.env.BASE_URL}images/welcome-bg.png`}
                  alt="" 
                  className="w-full h-full object-cover opacity-20"
                />
              </motion.div>

              <motion.div 
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="text-center mb-12"
              >
                <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-tr from-primary via-blue-500 to-purple-600 p-0.5 shadow-2xl shadow-primary/20">
                  <div className="w-full h-full bg-background rounded-2xl flex items-center justify-center">
                    <img src={`${import.meta.env.BASE_URL}images/logo.png`} alt="Logo" className="w-12 h-12" />
                  </div>
                </div>
                <h1 className="text-4xl md:text-5xl font-bold mb-4">
                  Hello, <span className="gemini-gradient-text">Company Name</span>
                </h1>
                <p className="text-lg text-muted-foreground">How can I help you today?</p>
              </motion.div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
                {SUGGESTIONS.map((s, i) => (
                  <motion.button
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 + i * 0.1 }}
                    onClick={() => setInput(s.text)}
                    className="flex flex-col text-left p-5 rounded-2xl border border-border/50 bg-card/40 hover:bg-card hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 group"
                  >
                    <s.icon className="w-6 h-6 text-muted-foreground group-hover:text-primary mb-3 transition-colors" />
                    <span className="text-sm font-medium text-foreground/80 group-hover:text-foreground">{s.text}</span>
                  </motion.button>
                ))}
              </div>
            </div>
          ) : isLoadingMessages ? (
            <div className="h-full flex items-center justify-center">
              <div className="animate-pulse flex items-center gap-3 text-muted-foreground">
                <Sparkles className="w-5 h-5" />
                <span>Loading conversation...</span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2 min-h-full justify-end py-8">
              {messages.map((msg) => (
                <ChatMessage 
                  key={msg.id} 
                  role={msg.role} 
                  content={msg.content} 
                />
              ))}
              
              {/* Optimistic User Message (if we want to show it before DB sync) is handled by React Query optimistic updates ideally, but we rely on local DB state here. The SSE stream sends chunks for AI. The user message is saved synchronously usually. */}

              {/* Streaming AI Message */}
              {isStreaming && streamingMessage && (
                <ChatMessage 
                  role="assistant" 
                  content={streamingMessage} 
                  isStreaming={true} 
                />
              )}
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="absolute bottom-0 w-full bg-gradient-to-t from-background via-background to-transparent pt-10 pb-6 px-4">
          <div className="max-w-3xl mx-auto">
            <form 
              onSubmit={handleSubmit}
              className="relative flex items-end gap-2 bg-card rounded-3xl border-2 border-border/60 p-2 shadow-xl shadow-black/20 focus-within:border-primary/50 focus-within:ring-4 focus-within:ring-primary/10 transition-all duration-300"
            >
              <div className="absolute -top-8 left-4 flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs font-semibold text-primary shadow-sm backdrop-blur-md">
                <Database size={12} />
                <span>Powered by Knowledge Base</span>
              </div>

              <TextareaAutosize
                minRows={1}
                maxRows={6}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask Company AI anything..."
                className="flex-1 resize-none bg-transparent px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none scrollbar-hide text-base leading-relaxed"
              />

              <button
                type="submit"
                disabled={!input.trim() || isStreaming || createChat.isPending}
                className="mb-1 p-3 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/25 hover:bg-primary/90 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:scale-100 disabled:shadow-none transition-all duration-200 shrink-0"
              >
                <ArrowUp size={20} className="stroke-[2.5]" />
              </button>
            </form>
            <div className="text-center mt-3 text-xs text-muted-foreground font-medium tracking-wide">
              Company AI can make mistakes. Check important info.
            </div>
          </div>
        </div>

      </div>
    </Layout>
  );
}
