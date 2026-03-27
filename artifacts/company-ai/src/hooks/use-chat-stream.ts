import { useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";

export function useChatStream(conversationId: number | null) {
  const queryClient = useQueryClient();
  const [streamingMessage, setStreamingMessage] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!conversationId) return;

      setIsStreaming(true);
      setStreamingMessage("");
      setError(null);

      try {
        const res = await fetch(`/api/gemini/conversations/${conversationId}/messages`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ content }),
        });

        if (!res.ok) {
          throw new Error("Failed to send message");
        }

        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        
        if (!reader) {
          throw new Error("No response stream");
        }

        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n\n");
          
          // Keep the last partial chunk in the buffer
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));
                
                if (data.content) {
                  setStreamingMessage((prev) => prev + data.content);
                }
                
                if (data.done) {
                  // When complete, invalidate the messages query to fetch the finalized DB records
                  queryClient.invalidateQueries({
                    queryKey: [`/api/gemini/conversations/${conversationId}/messages`],
                  });
                  setIsStreaming(false);
                  setStreamingMessage("");
                }
              } catch (e) {
                console.error("Failed to parse SSE chunk", e);
              }
            }
          }
        }
      } catch (err) {
        console.error("Chat stream error:", err);
        setError(err instanceof Error ? err.message : "An error occurred");
        setIsStreaming(false);
      }
    },
    [conversationId, queryClient]
  );

  return {
    sendMessage,
    streamingMessage,
    isStreaming,
    error,
  };
}
