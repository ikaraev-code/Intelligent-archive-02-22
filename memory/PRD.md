# Archiva - Intelligent Multimedia Archive

## Original Problem Statement
Rebuild Archiva from GitHub. Integrate OpenAI RAG. Save/append search summaries to projects. Export projects as PDF.

## Architecture
- Frontend: React.js + Tailwind CSS + shadcn/ui + Framer Motion
- Backend: FastAPI + JWT auth + fpdf2 (PDF generation)
- Database: MongoDB
- AI: OpenAI text-embedding-3-small (embeddings), Emergent LLM key (GPT chat & tagging)

## What's Been Implemented (Feb 22, 2026)
1. Full rebuild from GitHub
2. OpenAI RAG pipeline (upload -> AI tagging -> embeddings -> semantic search -> AI chat)
3. Save to Project from search summaries (dialog, summary seeded as first chat message)
4. Append to Existing Project (two-tab dialog, file deduplication)
5. **Export Project as PDF** — generates formatted PDF with title, description, source files + tags, full conversation history with markdown rendering, sources. Opens in new tab for preview/save.

## Backlog
- P1: Test with diverse file types (PDF, DOCX, images)
- P2: Batch re-indexing UI
- P2: Comparison view between projects
