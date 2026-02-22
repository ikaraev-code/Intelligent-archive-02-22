# Archiva - Intelligent Multimedia Archive

## Original Problem Statement
Rebuild Archiva app from GitHub repository: https://github.com/ikaraev-code/Intelligent-archive
Then integrate OpenAI API key for full RAG pipeline and add "Save as Project" feature from search summaries.

## Architecture
- **Frontend**: React.js with Tailwind CSS, shadcn/ui components, Framer Motion animations
- **Backend**: FastAPI (Python) with JWT authentication
- **Database**: MongoDB
- **AI Integration**: 
  - OpenAI `text-embedding-3-small` for document embeddings & semantic search
  - Emergent LLM key for AI chat (GPT) & auto-tagging
- **PWA**: Service worker for offline support and installability

## User Personas
- Knowledge workers managing large document collections
- Researchers organizing research papers and notes
- Teams collaborating on document archives

## Core Requirements
1. JWT-based authentication (register/login)
2. File upload with drag & drop, AI auto-tagging
3. File library with grid/list views, filtering by tags/type
4. Smart search (keyword + semantic with embeddings)
5. AI Chat (RAG-powered Archivist) for document Q&A
6. Projects for organizing files into collections
7. File detail view with content preview (PDF, images, text, DOCX)
8. Dashboard with stats overview
9. PWA support for mobile installation
10. **NEW**: Save search summaries + selected files as Projects

## What's Been Implemented
### Feb 22, 2026 - Initial Rebuild
- Full rebuild from GitHub source code
- Backend: All API endpoints (auth, files, search, projects, AI chat, stats)
- Frontend: All 9 pages
- OpenAI embeddings & RAG pipeline fully operational

### Feb 22, 2026 - Save as Project Feature
- Added "Save as Project" button to ArticlePage
- Flow: Search → Select files → Summarize → Save as Project (with editable name)
- Project stores: selected file_ids, AI summary as description, search query context
- Shows confirmation with "Open Projects" navigation
- Also includes bottom CTA card for discoverability

## Prioritized Backlog
### P0 (Critical)
- None - all core features operational

### P1 (Important)
- Test with PDF, DOCX, and image uploads
- Batch re-indexing for existing files

### P2 (Nice to have)
- Performance optimization for large file libraries
- Advanced search filters (date range, file size)
- Batch file operations (multi-select, bulk tag)
- Export project summaries as PDF

## Next Tasks
- User can test the full Search → Summarize → Save as Project flow
- Consider adding ability to append more files to existing projects from search
