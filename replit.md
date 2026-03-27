# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Company AI Assistant — a Gemini-like chatbot for company knowledge.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (ESM bundle)
- **AI**: Gemini (via Replit AI Integrations — no API key needed)
- **Frontend**: React + Vite + TailwindCSS + shadcn/ui

## Features

- Gemini-like chat interface with streaming responses
- Conversation history (sidebar with past chats)
- Knowledge base management — upload PDFs, TXT, CSV, DOCX files
- RAG (Retrieval-Augmented Generation) — answers grounded in company documents
- Markdown rendering for AI responses

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── api-server/         # Express API server
│   └── company-ai/         # React+Vite frontend (Gemini-like UI)
├── lib/
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   ├── db/                 # Drizzle ORM schema + DB connection
│   └── integrations-gemini-ai/  # Gemini SDK client + image/batch utils
├── scripts/                # Utility scripts
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── tsconfig.json
└── package.json
```

## Database Schema

- `conversations` — chat sessions (id, title, createdAt)
- `messages` — chat messages (id, conversationId, role, content, createdAt)
- `documents` — uploaded company documents (id, name, filename, size, mimeType, content, chunkCount, createdAt)
- `document_chunks` — text chunks for RAG retrieval (id, documentId, chunkIndex, content)

## API Routes

All routes are under `/api`:

- `GET /api/healthz` — health check
- `GET /api/gemini/conversations` — list conversations
- `POST /api/gemini/conversations` — create conversation
- `GET /api/gemini/conversations/:id` — get conversation with messages
- `DELETE /api/gemini/conversations/:id` — delete conversation
- `PATCH /api/gemini/conversations/:id` — rename conversation
- `GET /api/gemini/conversations/:id/messages` — list messages
- `POST /api/gemini/conversations/:id/messages` — send message (SSE stream)
- `GET /api/documents` — list documents
- `POST /api/documents` — upload document (multipart/form-data)
- `DELETE /api/documents/:id` — delete document

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all lib packages as project references.

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages that define it
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references

## Packages

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server with routes for Gemini chat and document management.

- Depends on: `@workspace/db`, `@workspace/api-zod`, `@workspace/integrations-gemini-ai`
- Uses multer for file uploads

### `artifacts/company-ai` (`@workspace/company-ai`)

React+Vite frontend with Gemini-like UI.

- Uses wouter for routing
- Uses @tanstack/react-query for data fetching
- Uses react-markdown + remark-gfm for markdown rendering
- Custom SSE streaming hook for chat responses

### `lib/integrations-gemini-ai` (`@workspace/integrations-gemini-ai`)

Gemini SDK client via Replit AI Integrations (no user API key required). Includes image generation and batch processing utilities.

### `lib/db` (`@workspace/db`)

Database layer using Drizzle ORM with PostgreSQL.

- `drizzle.config.ts` — Drizzle Kit config (requires `DATABASE_URL`)
- Run migrations: `pnpm --filter @workspace/db run push`
