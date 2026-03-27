import { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { User, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface ChatMessageProps {
  role: string;
  content: string;
  isStreaming?: boolean;
}

export const ChatMessage = memo(function ChatMessage({ role, content, isStreaming }: ChatMessageProps) {
  const isAI = role === "assistant" || role === "model";

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn(
        "flex w-full px-4 py-6 md:px-8 max-w-4xl mx-auto gap-4 md:gap-6",
        isAI ? "" : "justify-end"
      )}
    >
      {isAI && (
        <div className="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-blue-600 shadow-lg shadow-primary/20">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
      )}

      <div
        className={cn(
          "flex flex-col gap-2 max-w-[85%] md:max-w-[75%]",
          isAI ? "items-start" : "items-end"
        )}
      >
        <div 
          className={cn(
            "relative px-5 py-4 text-base shadow-sm",
            isAI 
              ? "bg-secondary/50 rounded-2xl rounded-tl-sm text-foreground border border-border/40" 
              : "bg-primary text-primary-foreground rounded-2xl rounded-tr-sm"
          )}
        >
          {isAI ? (
            <div className={cn("prose prose-invert max-w-none prose-p:leading-relaxed prose-pre:p-0", isStreaming && "after:content-[''] after:inline-block after:w-1.5 after:h-4 after:ml-1 after:bg-primary after:animate-pulse")}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {content}
              </ReactMarkdown>
            </div>
          ) : (
            <div className="whitespace-pre-wrap">{content}</div>
          )}
        </div>
      </div>

      {!isAI && (
        <div className="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-full bg-accent border border-border/50">
          <User className="w-5 h-5 text-accent-foreground/70" />
        </div>
      )}
    </motion.div>
  );
});
