# Archiva - Intelligent Multimedia Archive

## Original Problem Statement
Rebuild Archiva from GitHub. Integrate OpenAI RAG. Add "Save as Project" from search summaries with summary persistence. Add "Append to Existing Project" from search.

## Architecture
- Frontend: React.js + Tailwind CSS + shadcn/ui + Framer Motion
- Backend: FastAPI + JWT auth
- Database: MongoDB
- AI: OpenAI text-embedding-3-small (embeddings), Emergent LLM key (GPT chat & tagging)

## What's Been Implemented (Feb 22, 2026)
1. Full rebuild from GitHub
2. OpenAI RAG pipeline (upload → AI tagging → embeddings → semantic search → AI chat)
3. Save to Project from search summaries (dialog with name input, summary seeded as first chat message)
4. **Append to Existing Project** — two-tab dialog: "New Project" / "Existing Project", file deduplication, summary appended as new chat message

## Backlog
- P1: Test with PDF, DOCX, images
- P2: Export project summaries as PDF
- P2: Batch re-indexing UI improvements
