# Archiva - Intelligent Multimedia Archive

## Original Problem Statement
Rebuild an application from GitHub repository `https://github.com/ikaraev-code/Intelligent-archive` and extend it with AI-powered features.

## Core Requirements
1. **Rebuild App** from GitHub repo
2. **OpenAI RAG Integration** - auto-tagging, embeddings, semantic search, AI chat
3. **Save Search to Project** - save search results + summary as new project
4. **Append Search to Project** - append to existing project
5. **Export Project to PDF** - full project export
6. **File Upload in Chat** - paperclip button + drag-and-drop in both chat interfaces
7. **Embedding Status Indicators** - real-time visual feedback on file upload/embedding lifecycle
8. **Cascade File Delete** - delete file removes embeddings + cleans project references
9. **Priority File Search** - recently uploaded files boosted in AI Archivist RAG
10. **Unique Test IDs** - desktop/mobile sidebar have distinct data-testid attributes
11. **RAG Source Deduplication** - sources array has unique file entries, deleted files skipped
12. **Batch Re-indexing** - Library panel with stats breakdown + filtered re-index
13. **Dashboard Embedding Health** - donut chart widget showing search readiness at a glance

## Tech Stack
- Frontend: React + Tailwind CSS + shadcn/ui
- Backend: FastAPI + Motor (async MongoDB)
- Database: MongoDB
- AI: OpenAI (text-embedding-3-small for embeddings, GPT-5.2 via Emergent LLM key for chat)
- PDF: fpdf2

## Completed Features (All Tested)
- [x] App rebuild from GitHub
- [x] OpenAI RAG pipeline (embeddings + semantic search + AI chat)
- [x] Save/Append search to project
- [x] PDF export (from project view + card)
- [x] File upload in chat (click + drag-and-drop)
- [x] Immediate content access bug fix
- [x] P0: Embedding status indicators with retry + error messages (Feb 23)
- [x] Cascade file delete with project inactive status (Feb 23)
- [x] P1: Priority file search in AI Archivist (Feb 23)
- [x] P2: Unique data-testid for desktop/mobile sidebar (Feb 23)
- [x] P3: RAG source deduplication + deleted file skip (Feb 23)
- [x] Batch Re-indexing UI with stats + filtered reindex (Feb 23)
- [x] Dashboard Embedding Health donut widget (Feb 23)

## Future / Backlog
- Test with diverse file types (PDF, DOCX, images)
- Project comparison view
- Optionally clear project chat history when files are removed
- Smart Collections (AI auto-groups related files into suggested projects)

## Credentials
- Test user: test@archiva.com / test123
