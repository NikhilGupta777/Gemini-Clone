import { integer, pgTable, serial, text } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

import { documents } from "./documents";

export const documentChunks = pgTable("document_chunks", {
  id: serial("id").primaryKey(),
  documentId: integer("document_id")
    .notNull()
    .references(() => documents.id, { onDelete: "cascade" }),
  chunkIndex: integer("chunk_index").notNull(),
  content: text("content").notNull(),
});

export const insertDocumentChunkSchema = createInsertSchema(documentChunks).omit({
  id: true,
});

export type DocumentChunk = typeof documentChunks.$inferSelect;
export type InsertDocumentChunk = z.infer<typeof insertDocumentChunkSchema>;
