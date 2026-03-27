import { Router, type IRouter } from "express";
import multer from "multer";
import { db } from "@workspace/db";
import { documents, documentChunks } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

function splitIntoChunks(text: string, chunkSize = 800, overlap = 100): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.slice(start, end));
    start += chunkSize - overlap;
  }
  return chunks;
}

function extractTextFromBuffer(buffer: Buffer, mimeType: string, filename: string): string {
  const text = buffer.toString("utf-8");
  if (
    mimeType === "text/plain" ||
    mimeType === "text/csv" ||
    mimeType === "text/markdown" ||
    filename.endsWith(".txt") ||
    filename.endsWith(".csv") ||
    filename.endsWith(".md")
  ) {
    return text;
  }

  if (
    mimeType === "application/pdf" ||
    filename.endsWith(".pdf")
  ) {
    const readable = text.replace(/[^\x20-\x7E\n\r\t]/g, " ").replace(/\s+/g, " ").trim();
    return readable || `[PDF document: ${filename}. Text extraction is limited. Content length: ${buffer.length} bytes]`;
  }

  if (
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    filename.endsWith(".docx")
  ) {
    const readable = text.replace(/[^\x20-\x7E\n\r\t]/g, " ").replace(/\s+/g, " ").trim();
    return readable || `[Word document: ${filename}. Content length: ${buffer.length} bytes]`;
  }

  if (
    mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    filename.endsWith(".xlsx")
  ) {
    return `[Excel spreadsheet: ${filename}. Content length: ${buffer.length} bytes. Please upload as CSV for full text extraction]`;
  }

  const readable = text.replace(/[^\x20-\x7E\n\r\t]/g, " ").replace(/\s+/g, " ").trim();
  return readable || `[Document: ${filename}. Content length: ${buffer.length} bytes]`;
}

router.get("/", async (req, res) => {
  try {
    const docs = await db.select({
      id: documents.id,
      name: documents.name,
      filename: documents.filename,
      size: documents.size,
      mimeType: documents.mimeType,
      chunkCount: documents.chunkCount,
      createdAt: documents.createdAt,
    }).from(documents);
    res.json(docs);
  } catch (err) {
    req.log.error({ err }, "Failed to list documents");
    res.status(500).json({ error: "Failed to list documents" });
  }
});

router.post("/", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }

    const { originalname, mimetype, buffer, size } = req.file;
    const name = (req.body.name as string) || originalname;

    const extractedText = extractTextFromBuffer(buffer, mimetype, originalname);
    const chunks = splitIntoChunks(extractedText);

    const [doc] = await db
      .insert(documents)
      .values({
        name,
        filename: originalname,
        size,
        mimeType: mimetype,
        content: extractedText,
        chunkCount: chunks.length,
      })
      .returning();

    if (chunks.length > 0) {
      await db.insert(documentChunks).values(
        chunks.map((content, chunkIndex) => ({
          documentId: doc.id,
          chunkIndex,
          content,
        }))
      );
    }

    res.status(201).json({
      id: doc.id,
      name: doc.name,
      filename: doc.filename,
      size: doc.size,
      mimeType: doc.mimeType,
      chunkCount: doc.chunkCount,
      createdAt: doc.createdAt,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to upload document");
    res.status(500).json({ error: "Failed to upload document" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const [doc] = await db.select().from(documents).where(eq(documents.id, id));
    if (!doc) {
      res.status(404).json({ error: "Document not found" });
      return;
    }
    await db.delete(documents).where(eq(documents.id, id));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete document");
    res.status(500).json({ error: "Failed to delete document" });
  }
});

export default router;
