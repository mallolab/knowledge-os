# Knowledge OS

A crafted semantic workspace for deep thinking.

Knowledge OS combines structured note capture, AI enrichment, and vector-based retrieval into a focused, minimal interface designed for clarity and cognitive flow.

## Live Demo

https://knowledge-os-five.vercel.app/

## Product Demo

![Knowledge OS demo](./public/knowledge-os-demo.gif)

## Case Study

https://knowledge-os-five.vercel.app/case-study

---

## Core Features

- AI-powered summarization and tagging
- Embedding-based semantic search (pgvector)
- Command palette (Cmd+K) for actions and filtering
- Instant local search fallback while semantic results load
- Collection-based filtering
- Secure auth (Supabase + RLS)
- Demo mode with rate-limited AI actions

---

## Tech Stack

### Frontend

- Next.js (App Router)
- TypeScript
- shadcn/ui
- TailwindCSS

### Backend

- Supabase (Postgres + Auth)
- pgvector for similarity search
- Row-Level Security

### AI

- OpenAI Responses API
- text-embedding-3-small
- JSON-structured summarization

### Deployment

- Vercel

---

## Architecture

1. User creates note.
2. On enrich:
- Generate structured JSON summary + tags.
- Generate embedding vector.
- Store summary, tags, and embedding.
3. On semantic search:
- Generate query embedding.
- Call Postgres RPC `match_notes`.
- Return similarity-ranked results.

---

## Design Philosophy

- Editorial typography.
- Paper-like color palette.
- Low visual noise.
- Motion used intentionally.
- AI as quiet augmentation.

---

## Why I Built This

Knowledge systems should feel calm and precise.
This project explores how AI can enhance clarity without overwhelming the interface.
