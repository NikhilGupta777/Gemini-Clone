import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { conversations, messages } from "@workspace/db/schema";
import { documentChunks } from "@workspace/db/schema";
import {
  CreateGeminiConversationBody,
  SendGeminiMessageBody,
  RenameGeminiConversationBody,
} from "@workspace/api-zod";
import { ai } from "@workspace/integrations-gemini-ai";
import { eq, desc, asc } from "drizzle-orm";

const router: IRouter = Router();

router.get("/conversations", async (req, res) => {
  try {
    const allConversations = await db
      .select()
      .from(conversations)
      .orderBy(desc(conversations.createdAt));
    res.json(allConversations);
  } catch (err) {
    req.log.error({ err }, "Failed to list conversations");
    res.status(500).json({ error: "Failed to list conversations" });
  }
});

router.post("/conversations", async (req, res) => {
  try {
    const body = CreateGeminiConversationBody.parse(req.body);
    const [conv] = await db
      .insert(conversations)
      .values({ title: body.title })
      .returning();
    res.status(201).json(conv);
  } catch (err) {
    req.log.error({ err }, "Failed to create conversation");
    res.status(500).json({ error: "Failed to create conversation" });
  }
});

router.get("/conversations/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const [conv] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, id));
    if (!conv) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }
    const msgs = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, id))
      .orderBy(asc(messages.createdAt));
    res.json({ ...conv, messages: msgs });
  } catch (err) {
    req.log.error({ err }, "Failed to get conversation");
    res.status(500).json({ error: "Failed to get conversation" });
  }
});

router.delete("/conversations/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const [conv] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, id));
    if (!conv) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }
    await db.delete(conversations).where(eq(conversations.id, id));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete conversation");
    res.status(500).json({ error: "Failed to delete conversation" });
  }
});

router.patch("/conversations/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const body = RenameGeminiConversationBody.parse(req.body);
    const [updated] = await db
      .update(conversations)
      .set({ title: body.title })
      .where(eq(conversations.id, id))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to rename conversation");
    res.status(500).json({ error: "Failed to rename conversation" });
  }
});

router.get("/conversations/:id/messages", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const msgs = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, id))
      .orderBy(asc(messages.createdAt));
    res.json(msgs);
  } catch (err) {
    req.log.error({ err }, "Failed to list messages");
    res.status(500).json({ error: "Failed to list messages" });
  }
});

router.post("/conversations/:id/messages", async (req, res) => {
  try {
    const conversationId = parseInt(req.params.id, 10);
    const body = SendGeminiMessageBody.parse(req.body);

    const [conv] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, conversationId));
    if (!conv) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }

    await db.insert(messages).values({
      conversationId,
      role: "user",
      content: body.content,
    });

    const chatMessages = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(asc(messages.createdAt));

    const chunks = await db.select().from(documentChunks).limit(20);
    let systemContext = "";
    if (chunks.length > 0) {
      const queryLower = body.content.toLowerCase();
      const relevantChunks = chunks
        .filter((c) => {
          const words = queryLower.split(/\s+/).filter((w) => w.length > 3);
          return words.some((w) => c.content.toLowerCase().includes(w));
        })
        .slice(0, 8);

      const contextChunks =
        relevantChunks.length > 0 ? relevantChunks : chunks.slice(0, 5);

      if (contextChunks.length > 0) {
        systemContext = `You are a helpful company AI assistant. Use the following company knowledge base to answer questions accurately. If the answer is not in the knowledge base, say so and provide general assistance.

COMPANY KNOWLEDGE BASE:
${contextChunks.map((c) => c.content).join("\n\n---\n\n")}

Always cite when you are drawing from company documents.`;
      }
    }

    if (!systemContext) {
      systemContext =
        "You are a helpful company AI assistant. Answer questions clearly, concisely, and professionally. When users upload company documents, you will use them to provide accurate, grounded answers.";
    }

    const geminiMessages = chatMessages.map((m) => ({
      role: m.role === "assistant" ? ("model" as const) : ("user" as const),
      parts: [{ text: m.content }],
    }));

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    let fullResponse = "";

    const stream = await ai.models.generateContentStream({
      model: "gemini-2.5-flash",
      contents: geminiMessages,
      config: {
        maxOutputTokens: 8192,
        systemInstruction: systemContext,
      },
    });

    for await (const chunk of stream) {
      const text = chunk.text;
      if (text) {
        fullResponse += text;
        res.write(`data: ${JSON.stringify({ content: text })}\n\n`);
      }
    }

    await db.insert(messages).values({
      conversationId,
      role: "assistant",
      content: fullResponse,
    });

    if (conv.title === "New Chat" || conv.title === body.content.slice(0, 50)) {
      const newTitle =
        body.content.length > 50
          ? body.content.slice(0, 50) + "..."
          : body.content;
      await db
        .update(conversations)
        .set({ title: newTitle })
        .where(eq(conversations.id, conversationId));
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    req.log.error({ err }, "Failed to send message");
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to process message" });
    } else {
      res.write(`data: ${JSON.stringify({ error: "Stream error" })}\n\n`);
      res.end();
    }
  }
});

export default router;
